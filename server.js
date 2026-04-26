require("dotenv").config();
const express = require("express");
const mysql   = require("mysql2/promise");
const bcrypt  = require("bcryptjs");
const jwt     = require("jsonwebtoken");
const cors    = require("cors");
const path    = require("path");

const app    = express();
const PORT   = process.env.PORT || 3000;
const SECRET = process.env.JWT_SECRET || "herd_secret";

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// ── اتصال قاعدة البيانات ─────────────────────────────────
let db;
async function getDB() {
  if (db) return db;
  const url = process.env.MYSQL_URL || process.env.DATABASE_URL;
  if (url) {
    db = mysql.createPool(url);
  } else {
    db = mysql.createPool({
      host:     process.env.DB_HOST     || "localhost",
      user:     process.env.DB_USER     || "root",
      password: process.env.DB_PASS     || "",
      database: process.env.DB_NAME     || "herd_system",
      port:     process.env.DB_PORT     || 3306,
    });
  }
  return db;
}

// ── تهيئة قاعدة البيانات تلقائياً ──────────────────────────
async function initDB() {
  const pool = await getDB();
  await pool.query(`CREATE TABLE IF NOT EXISTS farmers (
    id INT AUTO_INCREMENT PRIMARY KEY,
    farm_name VARCHAR(150) NOT NULL,
    owner_name VARCHAR(100) NOT NULL,
    email VARCHAR(150) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    status ENUM('pending','active','suspended') DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`);
  await pool.query(`CREATE TABLE IF NOT EXISTS members (
    id INT AUTO_INCREMENT PRIMARY KEY,
    farmer_id INT NOT NULL,
    username VARCHAR(80) NOT NULL,
    full_name VARCHAR(100),
    password_hash VARCHAR(255) NOT NULL,
    role ENUM('admin','member') DEFAULT 'member',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (farmer_id) REFERENCES farmers(id) ON DELETE CASCADE,
    UNIQUE KEY uniq_member (farmer_id, username)
  )`);
  await pool.query(`CREATE TABLE IF NOT EXISTS animals (
    id INT AUTO_INCREMENT PRIMARY KEY,
    farmer_id INT NOT NULL,
    animal_number VARCHAR(30) NOT NULL,
    animal_type VARCHAR(20) DEFAULT 'غنم',
    breed VARCHAR(80),
    age_label VARCHAR(20) DEFAULT 'رخلة',
    gender VARCHAR(10) NOT NULL,
    body_color VARCHAR(50),
    birth_date DATE,
    ear_color VARCHAR(50),
    mother_id INT DEFAULT NULL,
    notes TEXT,
    status VARCHAR(20) DEFAULT 'alive',
    death_reason VARCHAR(255),
    death_date DATE,
    slaughter_reason VARCHAR(255),
    slaughter_date DATE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (farmer_id) REFERENCES farmers(id) ON DELETE CASCADE,
    FOREIGN KEY (mother_id) REFERENCES animals(id) ON DELETE SET NULL,
    UNIQUE KEY uniq_animal (farmer_id, animal_number)
  )`);
  await pool.query(`CREATE TABLE IF NOT EXISTS admins (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(80) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`);
  // إضافة السوبر أدمن إذا ما موجود - كلمة المرور: superadmin123
  const [admins] = await pool.query("SELECT id FROM admins LIMIT 1");
  if (!admins.length) {
    const hash = await bcrypt.hash("superadmin123", 10);
    await pool.query("INSERT INTO admins (username, password_hash) VALUES (?, ?)", ["superadmin", hash]);
  }
  console.log("✅ قاعدة البيانات جاهزة");
}

// ── MIDDLEWARE ────────────────────────────────────────────────
function authFarmer(req, res, next) {
  const token = req.headers["authorization"]?.split(" ")[1];
  if (!token) return res.status(401).json({ error: "غير مصرح" });
  try {
    const p = jwt.verify(token, SECRET);
    if (p.type !== "farmer" && p.type !== "member") throw new Error();
    req.farmer_id = p.farmer_id;
    req.user = p;
    next();
  } catch { res.status(401).json({ error: "انتهت الجلسة" }); }
}

function adminOnly(req, res, next) {
  if (req.user.role !== "admin" && req.user.type !== "farmer")
    return res.status(403).json({ error: "للمشرف فقط" });
  next();
}

function authSuper(req, res, next) {
  const token = req.headers["authorization"]?.split(" ")[1];
  if (!token) return res.status(401).json({ error: "غير مصرح" });
  try {
    const p = jwt.verify(token, SECRET);
    if (p.type !== "superadmin") throw new Error();
    req.user = p;
    next();
  } catch { res.status(401).json({ error: "انتهت الجلسة" }); }
}

// ════════════════════════════════════════════════════════════
//  AUTH
// ════════════════════════════════════════════════════════════
app.post("/api/register", async (req, res) => {
  const { farm_name, owner_name, email, password } = req.body;
  if (!farm_name || !owner_name || !email || !password)
    return res.status(400).json({ error: "جميع الحقول مطلوبة" });
  if (password.length < 6)
    return res.status(400).json({ error: "كلمة المرور 6 أحرف على الأقل" });
  const pool = await getDB();
  const [ex] = await pool.query("SELECT id FROM farmers WHERE email=?", [email]);
  if (ex.length) return res.status(400).json({ error: "البريد الإلكتروني مسجل مسبقاً" });
  const hash = await bcrypt.hash(password, 10);
  await pool.query(
    "INSERT INTO farmers (farm_name,owner_name,email,password_hash,status) VALUES (?,?,?,?,'pending')",
    [farm_name, owner_name, email, hash]
  );
  res.json({ success: true, message: "تم التسجيل بنجاح — في انتظار موافقة الإدارة" });
});

app.post("/api/login/farmer", async (req, res) => {
  const { email, password } = req.body;
  const pool = await getDB();
  const [rows] = await pool.query("SELECT * FROM farmers WHERE email=?", [email]);
  if (!rows.length) return res.status(401).json({ error: "البريد غير موجود" });
  const f = rows[0];
  if (f.status === "pending")   return res.status(403).json({ error: "حسابك في انتظار موافقة الإدارة" });
  if (f.status === "suspended") return res.status(403).json({ error: "حسابك موقوف" });
  if (!await bcrypt.compare(password, f.password_hash))
    return res.status(401).json({ error: "كلمة المرور غير صحيحة" });
  const token = jwt.sign(
    { type:"farmer", farmer_id:f.id, farm_name:f.farm_name, owner_name:f.owner_name, role:"admin" },
    SECRET, { expiresIn:"24h" }
  );
  res.json({ token, farm_name:f.farm_name, owner_name:f.owner_name, role:"admin", type:"farmer" });
});

app.post("/api/login/member", async (req, res) => {
  const { farm_id, username, password } = req.body;
  const pool = await getDB();
  const [rows] = await pool.query(
    "SELECT m.*, f.farm_name, f.status AS farm_status FROM members m JOIN farmers f ON f.id=m.farmer_id WHERE m.farmer_id=? AND m.username=?",
    [farm_id, username]
  );
  if (!rows.length) return res.status(401).json({ error: "اسم المستخدم غير موجود" });
  const m = rows[0];
  if (m.farm_status !== "active") return res.status(403).json({ error: "المزرعة غير نشطة" });
  if (!await bcrypt.compare(password, m.password_hash))
    return res.status(401).json({ error: "كلمة المرور غير صحيحة" });
  const token = jwt.sign(
    { type:"member", farmer_id:m.farmer_id, farm_name:m.farm_name, username:m.username, full_name:m.full_name, role:m.role },
    SECRET, { expiresIn:"24h" }
  );
  res.json({ token, farm_name:m.farm_name, full_name:m.full_name, role:m.role, type:"member" });
});

app.post("/api/login/super", async (req, res) => {
  const { username, password } = req.body;
  const pool = await getDB();
  const [rows] = await pool.query("SELECT * FROM admins WHERE username=?", [username]);
  if (!rows.length) return res.status(401).json({ error: "غير موجود" });
  if (!await bcrypt.compare(password, rows[0].password_hash))
    return res.status(401).json({ error: "كلمة المرور خاطئة" });
  const token = jwt.sign({ type:"superadmin", username }, SECRET, { expiresIn:"24h" });
  res.json({ token, type:"superadmin" });
});

// ════════════════════════════════════════════════════════════
//  ANIMALS
// ════════════════════════════════════════════════════════════
app.get("/api/animals", authFarmer, async (req, res) => {
  const pool = await getDB();
  const [rows] = await pool.query(`
    SELECT a.*, m.animal_number AS mother_number
    FROM animals a LEFT JOIN animals m ON m.id=a.mother_id
    WHERE a.farmer_id=? ORDER BY a.animal_number
  `, [req.farmer_id]);
  res.json(rows);
});

app.get("/api/animals/:number", authFarmer, async (req, res) => {
  const pool = await getDB();
  const [rows] = await pool.query(`
    SELECT a.*, m.animal_number AS mother_number
    FROM animals a LEFT JOIN animals m ON m.id=a.mother_id
    WHERE a.farmer_id=? AND a.animal_number=?
  `, [req.farmer_id, req.params.number]);
  if (!rows.length) return res.status(404).json({ error: "غير موجود" });
  const animal = rows[0];
  const [children] = await pool.query(
    "SELECT animal_number,gender,age_label,animal_type FROM animals WHERE mother_id=? AND farmer_id=? AND status='alive'",
    [animal.id, req.farmer_id]
  );
  animal.children = children;
  res.json(animal);
});

app.post("/api/animals", authFarmer, adminOnly, async (req, res) => {
  const { animal_number,animal_type,breed,age_label,gender,body_color,birth_date,ear_color,mother_number,notes } = req.body;
  if (!animal_number || !gender) return res.status(400).json({ error: "الرقم والجنس مطلوبان" });
  const pool = await getDB();
  const [ex] = await pool.query("SELECT id FROM animals WHERE farmer_id=? AND animal_number=?", [req.farmer_id, animal_number]);
  if (ex.length) return res.status(400).json({ error: `الرقم ${animal_number} موجود مسبقاً` });
  let mother_id = null;
  if (mother_number) {
    const [m] = await pool.query("SELECT id FROM animals WHERE farmer_id=? AND animal_number=?", [req.farmer_id, mother_number]);
    if (!m.length) return res.status(400).json({ error: `رقم الأم "${mother_number}" غير موجود` });
    mother_id = m[0].id;
  }
  await pool.query(
    "INSERT INTO animals (farmer_id,animal_number,animal_type,breed,age_label,gender,body_color,birth_date,ear_color,mother_id,notes) VALUES (?,?,?,?,?,?,?,?,?,?,?)",
    [req.farmer_id,animal_number,animal_type||"غنم",breed||null,age_label||"رخلة",gender,body_color||null,birth_date||null,ear_color||null,mother_id,notes||null]
  );
  res.json({ success: true });
});

app.put("/api/animals/:id", authFarmer, adminOnly, async (req, res) => {
  const { animal_number,animal_type,breed,age_label,gender,body_color,birth_date,ear_color,mother_number,notes } = req.body;
  const pool = await getDB();
  let mother_id = null;
  if (mother_number) {
    const [m] = await pool.query("SELECT id FROM animals WHERE farmer_id=? AND animal_number=?", [req.farmer_id, mother_number]);
    if (!m.length) return res.status(400).json({ error: `رقم الأم "${mother_number}" غير موجود` });
    mother_id = m[0].id;
  }
  await pool.query(
    "UPDATE animals SET animal_number=?,animal_type=?,breed=?,age_label=?,gender=?,body_color=?,birth_date=?,ear_color=?,mother_id=?,notes=? WHERE id=? AND farmer_id=?",
    [animal_number,animal_type,breed,age_label,gender,body_color,birth_date||null,ear_color,mother_id,notes,req.params.id,req.farmer_id]
  );
  res.json({ success: true });
});

app.patch("/api/animals/:id/death", authFarmer, adminOnly, async (req, res) => {
  const { death_reason, death_date } = req.body;
  if (!death_reason) return res.status(400).json({ error: "سبب الوفاة مطلوب" });
  const pool = await getDB();
  await pool.query("UPDATE animals SET status='dead',death_reason=?,death_date=? WHERE id=? AND farmer_id=?",
    [death_reason, death_date||new Date(), req.params.id, req.farmer_id]);
  res.json({ success: true });
});

app.patch("/api/animals/:id/slaughter", authFarmer, adminOnly, async (req, res) => {
  const { slaughter_reason, slaughter_date } = req.body;
  const pool = await getDB();
  await pool.query("UPDATE animals SET status='slaughtered',slaughter_reason=?,slaughter_date=? WHERE id=? AND farmer_id=?",
    [slaughter_reason||"ذبح للأكل", slaughter_date||new Date(), req.params.id, req.farmer_id]);
  res.json({ success: true });
});

app.delete("/api/animals/:id", authFarmer, adminOnly, async (req, res) => {
  const pool = await getDB();
  await pool.query("UPDATE animals SET mother_id=NULL WHERE mother_id=? AND farmer_id=?", [req.params.id, req.farmer_id]);
  await pool.query("DELETE FROM animals WHERE id=? AND farmer_id=?", [req.params.id, req.farmer_id]);
  res.json({ success: true });
});

// ════════════════════════════════════════════════════════════
//  REPORT
// ════════════════════════════════════════════════════════════
app.get("/api/report", authFarmer, async (req, res) => {
  const pool = await getDB();
  const fid = req.farmer_id;
  const [[t]] = await pool.query(`SELECT
    COUNT(*) total, SUM(status='alive') alive, SUM(status='dead') dead,
    SUM(status='slaughtered') slaughtered,
    SUM(status='alive' AND gender='أنثى') females,
    SUM(status='alive' AND gender='ذكر') males,
    SUM(status='alive' AND mother_id IS NULL AND gender='أنثى') mothers,
    SUM(status='alive' AND mother_id IS NOT NULL) kids
    FROM animals WHERE farmer_id=?`, [fid]);
  const [breeds] = await pool.query("SELECT breed,gender,COUNT(*) cnt FROM animals WHERE farmer_id=? AND status='alive' GROUP BY breed,gender ORDER BY cnt DESC", [fid]);
  const [dead]   = await pool.query("SELECT animal_number,gender,age_label,death_reason,death_date FROM animals WHERE farmer_id=? AND status='dead' ORDER BY death_date DESC", [fid]);
  const [slau]   = await pool.query("SELECT animal_number,age_label,slaughter_reason,slaughter_date FROM animals WHERE farmer_id=? AND status='slaughtered' ORDER BY slaughter_date DESC", [fid]);
  const [moms]   = await pool.query(`SELECT a.animal_number,a.breed,COUNT(c.id) kids_count,MAX(c.birth_date) last_birth
    FROM animals a LEFT JOIN animals c ON c.mother_id=a.id AND c.status='alive'
    WHERE a.farmer_id=? AND a.gender='أنثى' AND a.status='alive'
    GROUP BY a.id HAVING kids_count>0 ORDER BY kids_count DESC LIMIT 5`, [fid]);
  const [ready]  = await pool.query("SELECT animal_number,age_label,breed,birth_date FROM animals WHERE farmer_id=? AND gender='أنثى' AND status='alive' AND age_label IN ('ثني','سديس','جامع') ORDER BY animal_number", [fid]);
  const [[k3m]]  = await pool.query("SELECT COUNT(*) cnt FROM animals WHERE farmer_id=? AND mother_id IS NOT NULL AND status='alive' AND birth_date>=DATE_SUB(NOW(),INTERVAL 3 MONTH)", [fid]);
  res.json({ totals:t, breeds, dead, slau, moms, ready, kids3m:k3m.cnt });
});

// ════════════════════════════════════════════════════════════
//  MEMBERS
// ════════════════════════════════════════════════════════════
app.get("/api/members", authFarmer, adminOnly, async (req, res) => {
  const pool = await getDB();
  const [rows] = await pool.query("SELECT id,username,full_name,role,created_at FROM members WHERE farmer_id=?", [req.farmer_id]);
  res.json(rows);
});

app.post("/api/members", authFarmer, adminOnly, async (req, res) => {
  const { username, password, full_name, role } = req.body;
  if (!username || !password) return res.status(400).json({ error: "اسم المستخدم وكلمة المرور مطلوبان" });
  const pool = await getDB();
  const [ex] = await pool.query("SELECT id FROM members WHERE farmer_id=? AND username=?", [req.farmer_id, username]);
  if (ex.length) return res.status(400).json({ error: "اسم المستخدم موجود مسبقاً" });
  const hash = await bcrypt.hash(password, 10);
  await pool.query("INSERT INTO members (farmer_id,username,full_name,password_hash,role) VALUES (?,?,?,?,?)",
    [req.farmer_id, username, full_name||username, hash, role||"member"]);
  res.json({ success: true });
});

app.delete("/api/members/:id", authFarmer, adminOnly, async (req, res) => {
  const pool = await getDB();
  await pool.query("DELETE FROM members WHERE id=? AND farmer_id=?", [req.params.id, req.farmer_id]);
  res.json({ success: true });
});

// ════════════════════════════════════════════════════════════
//  SUPER ADMIN
// ════════════════════════════════════════════════════════════
app.get("/api/super/farmers", authSuper, async (req, res) => {
  const pool = await getDB();
  const [rows] = await pool.query(`SELECT f.*, COUNT(a.id) animal_count
    FROM farmers f LEFT JOIN animals a ON a.farmer_id=f.id
    GROUP BY f.id ORDER BY f.created_at DESC`);
  res.json(rows);
});

app.patch("/api/super/farmers/:id/status", authSuper, async (req, res) => {
  const pool = await getDB();
  await pool.query("UPDATE farmers SET status=? WHERE id=?", [req.body.status, req.params.id]);
  res.json({ success: true });
});

app.delete("/api/super/farmers/:id", authSuper, async (req, res) => {
  const pool = await getDB();
  await pool.query("DELETE FROM farmers WHERE id=?", [req.params.id]);
  res.json({ success: true });
});

app.get("/api/super/stats", authSuper, async (req, res) => {
  const pool = await getDB();
  const [[f]] = await pool.query("SELECT COUNT(*) total, SUM(status='active') active, SUM(status='pending') pending FROM farmers");
  const [[a]] = await pool.query("SELECT COUNT(*) total FROM animals");
  res.json({ farmers:f, animals:a });
});

// ── تشغيل السيرفر ─────────────────────────────────────────
app.listen(PORT, async () => {
  console.log(`✅ السيرفر يعمل على المنفذ ${PORT}`);
  await initDB();
});
