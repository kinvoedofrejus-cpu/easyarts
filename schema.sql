-- ============================================
-- EasyArts - Schéma de la base de données D1
-- ============================================

-- Informations du centre (une seule ligne, id=1)
CREATE TABLE IF NOT EXISTS center_info (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  name TEXT NOT NULL DEFAULT 'EasyArts',
  slogan TEXT DEFAULT 'Gérer - Enseigner - Inspirer',
  address TEXT,
  phone TEXT,
  email TEXT,
  logo_url TEXT,
  director_name TEXT,
  currency TEXT DEFAULT 'FCFA'
);
INSERT OR IGNORE INTO center_info (id, name) VALUES (1, 'EasyArts');

-- Comptes utilisateurs (admin / secrétaire)
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  full_name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin','secretary')),
  active INTEGER NOT NULL DEFAULT 1,
  -- droits fins pour les comptes secrétaire (JSON: {"students":true,"finance":false,...})
  permissions TEXT DEFAULT '{}',
  created_at TEXT DEFAULT (datetime('now'))
);

-- Sessions (jetons de connexion)
CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL,
  created_at TEXT DEFAULT (datetime('now')),
  expires_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Disciplines artistiques
CREATE TABLE IF NOT EXISTS disciplines (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  description TEXT,
  price REAL DEFAULT 0,
  teacher_id INTEGER,
  active INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (teacher_id) REFERENCES teachers(id)
);

-- Enseignants
CREATE TABLE IF NOT EXISTS teachers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  specialty TEXT,
  salary REAL DEFAULT 0,
  hire_date TEXT,
  active INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now'))
);

-- Élèves / Artistes
CREATE TABLE IF NOT EXISTS students (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  matricule TEXT UNIQUE,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  birth_date TEXT,
  gender TEXT,
  phone TEXT,
  parent_name TEXT,
  parent_phone TEXT,
  address TEXT,
  discipline_id INTEGER,
  enrollment_date TEXT DEFAULT (datetime('now')),
  status TEXT DEFAULT 'actif' CHECK (status IN ('actif','stage','termine_formation','abandon')),
  photo_url TEXT,
  notes TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (discipline_id) REFERENCES disciplines(id)
);

-- Ventes (produits / services)
CREATE TABLE IF NOT EXISTS sales (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sale_date TEXT DEFAULT (datetime('now')),
  item TEXT NOT NULL,
  quantity INTEGER DEFAULT 1,
  unit_price REAL DEFAULT 0,
  amount REAL NOT NULL,
  student_id INTEGER,
  buyer_name TEXT,
  description TEXT,
  created_by INTEGER,
  FOREIGN KEY (student_id) REFERENCES students(id)
);

-- Notes et évaluations
CREATE TABLE IF NOT EXISTS grades (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  student_id INTEGER NOT NULL,
  discipline_id INTEGER,
  evaluation_name TEXT NOT NULL,
  score REAL NOT NULL,
  max_score REAL DEFAULT 20,
  eval_date TEXT DEFAULT (datetime('now')),
  comment TEXT,
  FOREIGN KEY (student_id) REFERENCES students(id),
  FOREIGN KEY (discipline_id) REFERENCES disciplines(id)
);

-- Paiements des élèves (encaissements)
CREATE TABLE IF NOT EXISTS payments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  receipt_number TEXT UNIQUE,
  student_id INTEGER NOT NULL,
  amount REAL NOT NULL,
  pay_date TEXT DEFAULT (datetime('now')),
  method TEXT DEFAULT 'espèces',
  description TEXT,
  created_by INTEGER,
  FOREIGN KEY (student_id) REFERENCES students(id)
);

-- Dépenses
CREATE TABLE IF NOT EXISTS expenses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  expense_date TEXT DEFAULT (datetime('now')),
  category TEXT,
  amount REAL NOT NULL,
  description TEXT,
  created_by INTEGER
);

-- Salaires payés aux enseignants
CREATE TABLE IF NOT EXISTS teacher_payments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  teacher_id INTEGER NOT NULL,
  amount REAL NOT NULL,
  pay_date TEXT DEFAULT (datetime('now')),
  description TEXT,
  FOREIGN KEY (teacher_id) REFERENCES teachers(id)
);

-- Attestations émises
CREATE TABLE IF NOT EXISTS certificates (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  cert_number TEXT UNIQUE,
  student_id INTEGER NOT NULL,
  cert_type TEXT NOT NULL CHECK (cert_type IN ('fin_stage','fin_formation','participation','autre')),
  title TEXT,
  issue_date TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (student_id) REFERENCES students(id)
);

-- Compte administrateur par défaut : admin / admin123 (À CHANGER après 1ère connexion)
-- Hash SHA-256 de "admin123"
INSERT OR IGNORE INTO users (id, username, password_hash, full_name, role)
VALUES (1, 'admin', '240be518fabd2724ddb6f04eeb1da5967448d7e831c08c8fa822809f74c720a', 'Administrateur', 'admin');
