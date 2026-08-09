// ============================================
// EasyArts - Worker API (Cloudflare Workers + D1)
// ============================================

const SESSION_DAYS = 7;

// Modules protégés par permission (pour les comptes secrétaire)
const MODULES = ["students", "disciplines", "teachers", "sales", "grades", "finance", "settings", "users"];

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
}

async function sha256(text) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function genToken() {
  return crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "");
}

function genReceiptNumber() {
  const d = new Date();
  return `QT-${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}-${Math.floor(1000 + Math.random() * 9000)}`;
}

function genCertNumber(type) {
  const prefix = type === "fin_stage" ? "ATS" : type === "fin_formation" ? "ATF" : "ATT";
  const d = new Date();
  return `${prefix}-${d.getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
}

async function getUserFromRequest(request, env) {
  const auth = request.headers.get("Authorization") || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;
  if (!token) return null;
  const row = await env.DB.prepare(
    `SELECT s.token, s.expires_at, u.id, u.username, u.full_name, u.role, u.permissions, u.active
     FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token = ?`
  )
    .bind(token)
    .first();
  if (!row) return null;
  if (new Date(row.expires_at) < new Date()) return null;
  if (!row.active) return null;
  return {
    id: row.id,
    username: row.username,
    full_name: row.full_name,
    role: row.role,
    permissions: row.permissions ? JSON.parse(row.permissions) : {},
  };
}

function canAccess(user, moduleName, write = false) {
  if (!user) return false;
  if (user.role === "admin") return true;
  // secrétaire : accès par défaut à tout sauf users/settings, sauf restriction explicite
  if (["users", "settings"].includes(moduleName)) return false;
  if (user.permissions && user.permissions[moduleName] === false) return false;
  if (write && user.permissions && user.permissions[moduleName + "_write"] === false) return false;
  return true;
}

// Config générique des tables pour le CRUD
const TABLES = {
  students: {
    module: "students",
    cols: ["matricule", "first_name", "last_name", "birth_date", "gender", "phone", "parent_name", "parent_phone", "address", "discipline_id", "enrollment_date", "status", "photo_url", "notes"],
    order: "last_name ASC",
  },
  disciplines: {
    module: "disciplines",
    cols: ["name", "description", "price", "teacher_id", "active"],
    order: "name ASC",
  },
  teachers: {
    module: "teachers",
    cols: ["first_name", "last_name", "phone", "email", "specialty", "salary", "hire_date", "active"],
    order: "last_name ASC",
  },
  sales: {
    module: "sales",
    cols: ["sale_date", "item", "quantity", "unit_price", "amount", "student_id", "buyer_name", "description"],
    order: "sale_date DESC",
  },
  grades: {
    module: "grades",
    cols: ["student_id", "discipline_id", "evaluation_name", "score", "max_score", "eval_date", "comment"],
    order: "eval_date DESC",
  },
  payments: {
    module: "finance",
    cols: ["receipt_number", "student_id", "amount", "pay_date", "method", "description"],
    order: "pay_date DESC",
  },
  expenses: {
    module: "finance",
    cols: ["expense_date", "category", "amount", "description"],
    order: "expense_date DESC",
  },
  teacher_payments: {
    module: "finance",
    cols: ["teacher_id", "amount", "pay_date", "description"],
    order: "pay_date DESC",
  },
  certificates: {
    module: "students",
    cols: ["cert_number", "student_id", "cert_type", "title", "issue_date"],
    order: "issue_date DESC",
  },
};

async function handleCrud(request, env, user, table, id) {
  const cfg = TABLES[table];
  if (!cfg) return json({ error: "Table inconnue" }, 404);

  if (request.method === "GET") {
    if (!canAccess(user, cfg.module)) return json({ error: "Accès refusé" }, 403);
    if (id) {
      const row = await env.DB.prepare(`SELECT * FROM ${table} WHERE id = ?`).bind(id).first();
      if (!row) return json({ error: "Introuvable" }, 404);
      return json(row);
    }
    const { results } = await env.DB.prepare(`SELECT * FROM ${table} ORDER BY ${cfg.order}`).all();
    return json(results);
  }

  if (request.method === "POST") {
    if (!canAccess(user, cfg.module, true)) return json({ error: "Accès refusé" }, 403);
    const body = await request.json();

    // Numérotation automatique
    if (table === "payments" && !body.receipt_number) body.receipt_number = genReceiptNumber();
    if (table === "certificates" && !body.cert_number) body.cert_number = genCertNumber(body.cert_type);

    const cols = cfg.cols.filter((c) => body[c] !== undefined);
    const placeholders = cols.map(() => "?").join(",");
    const values = cols.map((c) => body[c]);
    const res = await env.DB.prepare(`INSERT INTO ${table} (${cols.join(",")}) VALUES (${placeholders})`)
      .bind(...values)
      .run();
    const newRow = await env.DB.prepare(`SELECT * FROM ${table} WHERE id = ?`).bind(res.meta.last_row_id).first();
    return json(newRow, 201);
  }

  if (request.method === "PUT") {
    if (!canAccess(user, cfg.module, true)) return json({ error: "Accès refusé" }, 403);
    if (!id) return json({ error: "ID manquant" }, 400);
    const body = await request.json();
    const cols = cfg.cols.filter((c) => body[c] !== undefined);
    if (cols.length === 0) return json({ error: "Rien à mettre à jour" }, 400);
    const setClause = cols.map((c) => `${c} = ?`).join(", ");
    const values = cols.map((c) => body[c]);
    await env.DB.prepare(`UPDATE ${table} SET ${setClause} WHERE id = ?`)
      .bind(...values, id)
      .run();
    const row = await env.DB.prepare(`SELECT * FROM ${table} WHERE id = ?`).bind(id).first();
    return json(row);
  }

  if (request.method === "DELETE") {
    if (!canAccess(user, cfg.module, true)) return json({ error: "Accès refusé" }, 403);
    if (!id) return json({ error: "ID manquant" }, 400);
    await env.DB.prepare(`DELETE FROM ${table} WHERE id = ?`).bind(id).run();
    return json({ ok: true });
  }

  return json({ error: "Méthode non supportée" }, 405);
}

async function handleDashboard(env) {
  const [students, teachers, disciplines, sales, revIncome, revExpense] = await Promise.all([
    env.DB.prepare("SELECT COUNT(*) c FROM students WHERE status != 'abandon'").first(),
    env.DB.prepare("SELECT COUNT(*) c FROM teachers WHERE active = 1").first(),
    env.DB.prepare("SELECT COUNT(*) c FROM disciplines WHERE active = 1").first(),
    env.DB.prepare("SELECT COUNT(*) c FROM sales WHERE sale_date >= date('now','start of month')").first(),
    env.DB.prepare(
      "SELECT COALESCE(SUM(amount),0) t FROM payments WHERE pay_date >= date('now','start of month')"
    ).first(),
    env.DB.prepare(
      "SELECT COALESCE(SUM(amount),0) t FROM expenses WHERE expense_date >= date('now','start of month')"
    ).first(),
  ]);
  const income = revIncome.t || 0;
  const expense = revExpense.t || 0;
  return json({
    students: students.c,
    teachers: teachers.c,
    disciplines: disciplines.c,
    sales_month: sales.c,
    income_month: income,
    expense_month: expense,
    net_month: income - expense,
  });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;

    if (request.method === "OPTIONS") {
      return new Response(null, {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, Authorization",
        },
      });
    }

    // ---- Routes API ----
    if (path.startsWith("/api/")) {
      try {
        // Connexion (pas d'auth requise)
        if (path === "/api/login" && request.method === "POST") {
          const { username, password } = await request.json();
          const hash = await sha256(password || "");
          const u = await env.DB.prepare(
            "SELECT id, username, full_name, role, permissions, active FROM users WHERE username = ? AND password_hash = ?"
          )
            .bind(username, hash)
            .first();
          if (!u || !u.active) return json({ error: "Identifiants incorrects" }, 401);
          const token = genToken();
          const expires = new Date(Date.now() + SESSION_DAYS * 86400000).toISOString();
          await env.DB.prepare("INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)")
            .bind(token, u.id, expires)
            .run();
          return json({
            token,
            user: { id: u.id, username: u.username, full_name: u.full_name, role: u.role },
          });
        }

        // Toutes les routes suivantes nécessitent une authentification
        const user = await getUserFromRequest(request, env);

        if (path === "/api/logout" && request.method === "POST") {
          const auth = request.headers.get("Authorization") || "";
          const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;
          if (token) await env.DB.prepare("DELETE FROM sessions WHERE token = ?").bind(token).run();
          return json({ ok: true });
        }

        if (!user) return json({ error: "Non authentifié" }, 401);

        if (path === "/api/me") return json({ user });

        if (path === "/api/dashboard") return await handleDashboard(env);

        // Paramètres du centre
        if (path === "/api/settings") {
          if (request.method === "GET") {
            const row = await env.DB.prepare("SELECT * FROM center_info WHERE id = 1").first();
            return json(row);
          }
          if (request.method === "PUT") {
            if (user.role !== "admin") return json({ error: "Réservé à l'administrateur" }, 403);
            const body = await request.json();
            const cols = ["name", "slogan", "address", "phone", "email", "logo_url", "director_name", "currency"].filter(
              (c) => body[c] !== undefined
            );
            const setClause = cols.map((c) => `${c} = ?`).join(", ");
            const values = cols.map((c) => body[c]);
            await env.DB.prepare(`UPDATE center_info SET ${setClause} WHERE id = 1`)
              .bind(...values)
              .run();
            const row = await env.DB.prepare("SELECT * FROM center_info WHERE id = 1").first();
            return json(row);
          }
        }

        // Comptes utilisateurs (admin seulement) — création de comptes secrétaire
        if (path === "/api/users" || path.match(/^\/api\/users\/\d+$/)) {
          if (user.role !== "admin") return json({ error: "Réservé à l'administrateur" }, 403);
          const id = path.match(/^\/api\/users\/(\d+)$/)?.[1];

          if (request.method === "GET" && !id) {
            const { results } = await env.DB.prepare(
              "SELECT id, username, full_name, role, active, permissions, created_at FROM users ORDER BY created_at DESC"
            ).all();
            return json(results);
          }
          if (request.method === "POST") {
            const body = await request.json();
            const hash = await sha256(body.password || "changeme123");
            const res = await env.DB.prepare(
              "INSERT INTO users (username, password_hash, full_name, role, permissions) VALUES (?,?,?,?,?)"
            )
              .bind(body.username, hash, body.full_name, "secretary", JSON.stringify(body.permissions || {}))
              .run();
            const row = await env.DB.prepare(
              "SELECT id, username, full_name, role, active, permissions FROM users WHERE id = ?"
            )
              .bind(res.meta.last_row_id)
              .first();
            return json(row, 201);
          }
          if (request.method === "PUT" && id) {
            const body = await request.json();
            const sets = [];
            const values = [];
            if (body.full_name !== undefined) { sets.push("full_name = ?"); values.push(body.full_name); }
            if (body.active !== undefined) { sets.push("active = ?"); values.push(body.active ? 1 : 0); }
            if (body.permissions !== undefined) { sets.push("permissions = ?"); values.push(JSON.stringify(body.permissions)); }
            if (body.password) { sets.push("password_hash = ?"); values.push(await sha256(body.password)); }
            if (sets.length) {
              await env.DB.prepare(`UPDATE users SET ${sets.join(", ")} WHERE id = ?`).bind(...values, id).run();
            }
            const row = await env.DB.prepare(
              "SELECT id, username, full_name, role, active, permissions FROM users WHERE id = ?"
            )
              .bind(id)
              .first();
            return json(row);
          }
          if (request.method === "DELETE" && id) {
            await env.DB.prepare("DELETE FROM users WHERE id = ?").bind(id).run();
            return json({ ok: true });
          }
        }

        // Impression : données groupées pour quittance / fiche d'inscription / attestation
        if (path.match(/^\/api\/print\/(receipt|enrollment|certificate)\/\d+$/)) {
          const [, , type, id] = path.match(/^\/api\/print\/(receipt|enrollment|certificate)\/(\d+)$/);
          const center = await env.DB.prepare("SELECT * FROM center_info WHERE id = 1").first();
          if (type === "receipt") {
            const p = await env.DB.prepare(
              `SELECT p.*, s.first_name, s.last_name, s.matricule FROM payments p JOIN students s ON s.id = p.student_id WHERE p.id = ?`
            )
              .bind(id)
              .first();
            if (!p) return json({ error: "Introuvable" }, 404);
            return json({ center, payment: p });
          }
          if (type === "enrollment") {
            const s = await env.DB.prepare(
              `SELECT s.*, d.name as discipline_name FROM students s LEFT JOIN disciplines d ON d.id = s.discipline_id WHERE s.id = ?`
            )
              .bind(id)
              .first();
            if (!s) return json({ error: "Introuvable" }, 404);
            return json({ center, student: s });
          }
          if (type === "certificate") {
            const c = await env.DB.prepare(
              `SELECT c.*, s.first_name, s.last_name, s.matricule FROM certificates c JOIN students s ON s.id = c.student_id WHERE c.id = ?`
            )
              .bind(id)
              .first();
            if (!c) return json({ error: "Introuvable" }, 404);
            return json({ center, certificate: c });
          }
        }

        // CRUD générique pour toutes les rubriques
        const crudMatch = path.match(/^\/api\/([a-z_]+)(?:\/(\d+))?$/);
        if (crudMatch) {
          const [, table, id] = crudMatch;
          if (TABLES[table]) return await handleCrud(request, env, user, table, id);
        }

        return json({ error: "Route inconnue" }, 404);
      } catch (err) {
        return json({ error: "Erreur serveur : " + err.message }, 500);
      }
    }

    // ---- Fichiers statiques (frontend) ----
    return env.ASSETS.fetch(request);
  },
};
