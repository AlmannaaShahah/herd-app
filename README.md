# 🐑 نظام إدارة الحاشية — دليل الإطلاق الكامل

## هيكل المشروع
```
herd-app/
├── server.js       ← الخادم الرئيسي
├── package.json    ← المكتبات
├── database.sql    ← قاعدة البيانات
├── .env            ← الإعدادات السرية
└── public/
    └── index.html  ← الواجهة الكاملة
```

---

## الخطوة 1 — حملي البرامج على حاسوبك

1. Node.js: https://nodejs.org (اختاري LTS)
2. XAMPP: https://apachefriends.org
3. VS Code: https://code.visualstudio.com
4. Git: https://git-scm.com

---

## الخطوة 2 — إعداد قاعدة البيانات محلياً

1. شغّلي XAMPP واضغطي Start بجانب MySQL
2. افتحي phpMyAdmin: http://localhost/phpmyadmin
3. اضغطي SQL والصقي محتوى ملف database.sql
4. اضغطي Go

---

## الخطوة 3 — تعديل ملف .env

افتحي ملف .env وعدّلي:
```
DB_HOST=localhost
DB_USER=root
DB_PASS=         ← اتركيه فارغاً إذا ما عندك كلمة مرور لـ MySQL
DB_NAME=herd_system
JWT_SECRET=اكتبي_هنا_أي_كلمة_طويلة_مثل_abc123xyz456
PORT=3000
```

---

## الخطوة 4 — تشغيل المشروع محلياً

افتحي Terminal داخل مجلد herd-app واكتبي:
```bash
npm install
npm start
```

افتحي المتصفح: http://localhost:3000

---

## الخطوة 5 — الرفع على Railway (للإنترنت)

### أ) إنشاء حسابات
1. GitHub: https://github.com → إنشاء حساب
2. Railway: https://railway.app → سجّلي بحساب GitHub

### ب) رفع الكود على GitHub
1. حملي GitHub Desktop: https://desktop.github.com
2. افتحيه واختاري File → Add Local Repository
3. اختاري مجلد herd-app
4. اضغطي Publish Repository
5. اتركي الاسم herd-app واضغطي Publish

### ج) ربط Railway بـ GitHub
1. اذهبي لـ railway.app واضغطي New Project
2. اختاري Deploy from GitHub repo
3. اختاري مستودع herd-app
4. Railway سيبدأ النشر تلقائياً

### د) إضافة قاعدة بيانات MySQL على Railway
1. داخل مشروعك اضغطي + New
2. اختاري Database → MySQL
3. بعد الإنشاء اضغطي على MySQL
4. اذهبي لـ Variables وانسخي هذه القيم:
   - MYSQLHOST
   - MYSQLUSER
   - MYSQLPASSWORD
   - MYSQLDATABASE

### هـ) إضافة متغيرات البيئة في Railway
1. اضغطي على مشروعك الرئيسي (herd-app)
2. اذهبي لـ Variables وأضيفي:
```
DB_HOST    = قيمة MYSQLHOST
DB_USER    = قيمة MYSQLUSER
DB_PASS    = قيمة MYSQLPASSWORD
DB_NAME    = قيمة MYSQLDATABASE
JWT_SECRET = اي_كلمة_سرية_طويلة
```

### و) تشغيل قاعدة البيانات على Railway
1. اضغطي على MySQL في Railway
2. اذهبي لـ Query
3. الصقي محتوى database.sql واضغطي Run

### ز) الحصول على الرابط
1. اضغطي على مشروعك
2. اذهبي لـ Settings → Networking
3. اضغطي Generate Domain
4. ستحصلين على رابط مثل: https://herd-app.up.railway.app ✅

---

## بيانات الدخول الافتراضية

| الدور | المستخدم | كلمة المرور |
|-------|---------|------------|
| 👑 سوبر أدمن (أنتِ) | superadmin | superadmin123 |

⚠️ غيّري كلمة مرور السوبر أدمن فور الدخول!

---

## كيف يعمل النظام للمزارعين

1. المزارع يفتح موقعك ويضغط "إنشاء حساب"
2. يملأ اسم المزرعة + بريده + كلمة مرور
3. يظهر له: "في انتظار موافقة الإدارة"
4. أنتِ تدخلين كسوبر أدمن وتوافقين عليه
5. المزارع يدخل ويبدأ يضيف حيوانات حاشيته
6. يضيف أعضاءه ويعطيهم رقم المزرعة + اسم مستخدم

---

## الأدوار في النظام

| الدور | الصلاحيات |
|-------|-----------|
| 👑 سوبر أدمن (أنتِ) | قبول/رفض المزارعين، إيقاف الحسابات |
| 🌾 صاحب المزرعة | إدارة حاشيته + أعضاءه كاملاً |
| 🛠️ مشرف المزرعة | إضافة/تعديل/حذف الحيوانات |
| 👁️ عضو | عرض البيانات فقط |
