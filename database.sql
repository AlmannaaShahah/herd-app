-- ============================================================
--  قاعدة بيانات نظام إدارة الحاشية — متعدد المزارعين
--  شغّله مرة واحدة فقط في MySQL
-- ============================================================

DROP DATABASE IF EXISTS herd_system;
CREATE DATABASE herd_system CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE herd_system;

-- ── المزارعون (كل مزارع عنده حاشيته المستقلة) ──────────────
CREATE TABLE farmers (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  farm_name     VARCHAR(150) NOT NULL,
  owner_name    VARCHAR(100) NOT NULL,
  email         VARCHAR(150) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  status        ENUM('pending','active','suspended') DEFAULT 'pending',
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ── أعضاء كل مزرعة ──────────────────────────────────────────
CREATE TABLE members (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  farmer_id     INT NOT NULL,
  username      VARCHAR(80) NOT NULL,
  full_name     VARCHAR(100),
  password_hash VARCHAR(255) NOT NULL,
  role          ENUM('admin','member') DEFAULT 'member',
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (farmer_id) REFERENCES farmers(id) ON DELETE CASCADE,
  UNIQUE KEY uniq_member (farmer_id, username)
);

-- ── الحيوانات ─────────────────────────────────────────────────
CREATE TABLE animals (
  id               INT AUTO_INCREMENT PRIMARY KEY,
  farmer_id        INT NOT NULL,
  animal_number    VARCHAR(30) NOT NULL,
  animal_type      ENUM('غنم','بقر','إبل') DEFAULT 'غنم',
  breed            VARCHAR(80),
  age_label        ENUM('رخلة','ثني','سديس','جامع') DEFAULT 'رخلة',
  gender           ENUM('أنثى','ذكر') NOT NULL,
  body_color       VARCHAR(50),
  birth_date       DATE,
  ear_color        VARCHAR(50),
  mother_id        INT DEFAULT NULL,
  notes            TEXT,
  status           ENUM('alive','dead','slaughtered') DEFAULT 'alive',
  death_reason     VARCHAR(255),
  death_date       DATE,
  slaughter_reason VARCHAR(255),
  slaughter_date   DATE,
  created_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (farmer_id) REFERENCES farmers(id) ON DELETE CASCADE,
  FOREIGN KEY (mother_id) REFERENCES animals(id) ON DELETE SET NULL,
  UNIQUE KEY uniq_animal (farmer_id, animal_number)
);

-- ── السوبر أدمن (أنتِ) ──────────────────────────────────────
CREATE TABLE admins (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  username      VARCHAR(80) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- كلمة مرور السوبر أدمن: superadmin123
INSERT INTO admins (username, password_hash) VALUES
('superadmin', '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy');
