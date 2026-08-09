// ============================================
// EasyArts - Application frontend (SPA vanilla JS)
// ============================================

let CURRENT_USER = null;
let CACHE = { disciplines: [], teachers: [], students: [] };

const NAV_ITEMS = [
  { key: "dashboard", label: "Tableau de bord", icon: "🏠" },
  { key: "students", label: "Élèves / Artistes", icon: "👥" },
  { key: "disciplines", label: "Disciplines artistiques", icon: "🎨" },
  { key: "sales", label: "Ventes", icon: "🛒" },
  { key: "teachers", label: "Enseignants", icon: "🎓" },
  { key: "grades", label: "Notes et évaluations", icon: "📋" },
  { key: "finance", label: "Finances", icon: "💰" },
  { key: "certificates", label: "Documents & Attestations", icon: "📜" },
  { key: "settings", label: "Paramètres", icon: "⚙️", adminOnly: true },
  { key: "users", label: "Comptes secrétaires", icon: "🔐", adminOnly: true },
];

// ---------- Utilitaires ----------
function money(n) { return Number(n || 0).toLocaleString("fr-FR"); }
function dateFr(s) { return s ? new Date(s).toLocaleDateString("fr-FR") : "—"; }
function toast(msg, isError) {
  const el = document.createElement("div");
  el.className = "toast" + (isError ? " error" : "");
  el.textContent = msg;
  document.getElementById("toast-root").appendChild(el);
  setTimeout(() => el.remove(), 3000);
}
function el(html) { const d = document.createElement("div"); d.innerHTML = html.trim(); return d.firstChild; }
function closeModal() { document.getElementById("modal-root").innerHTML = ""; }

function nameOf(list, id) {
  const item = list.find((x) => String(x.id) === String(id));
  return item ? (item.name || (item.first_name + " " + item.last_name)) : "—";
}

// ---------- Connexion ----------
document.getElementById("login-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const username = document.getElementById("login-username").value.trim();
  const password = document.getElementById("login-password").value;
  const errEl = document.getElementById("login-error");
  errEl.textContent = "";
  try {
    const res = await Api.login(username, password);
    Api.setToken(res.token);
    await boot();
  } catch (err) {
    errEl.textContent = err.message;
  }
});

document.getElementById("logout-btn").addEventListener("click", async () => {
  try { await Api.logout(); } catch (e) {}
  Api.setToken(null);
  location.reload();
});

async function boot() {
  try {
    const { user } = await Api.me();
    CURRENT_USER = user;
  } catch (e) {
    document.getElementById("login-screen").classList.remove("hidden");
    document.getElementById("app").classList.add("hidden");
    return;
  }
  document.getElementById("login-screen").classList.add("hidden");
  document.getElementById("app").classList.remove("hidden");
  document.getElementById("user-name").textContent = CURRENT_USER.full_name;
  document.getElementById("user-role").textContent = CURRENT_USER.role === "admin" ? "Super Administrateur" : "Secrétaire";
  document.getElementById("user-avatar").textContent = CURRENT_USER.full_name.charAt(0).toUpperCase();
  document.getElementById("date-badge").textContent = new Date().toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric", weekday: "long" });

  renderNav();
  await preloadCache();
  window.addEventListener("hashchange", route);
  route();
}

function renderNav() {
  const nav = document.getElementById("sidebar-nav");
  nav.innerHTML = "";
  NAV_ITEMS.forEach((item) => {
    if (item.adminOnly && CURRENT_USER.role !== "admin") return;
    const btn = document.createElement("button");
    btn.className = "nav-item";
    btn.dataset.key = item.key;
    btn.innerHTML = `<span class="icon">${item.icon}</span><span class="label">${item.label}</span>`;
    btn.addEventListener("click", () => { location.hash = "#/" + item.key; });
    nav.appendChild(btn);
  });
}

async function preloadCache() {
  try {
    const [disciplines, teachers, students] = await Promise.all([
      Api.list("disciplines"), Api.list("teachers"), Api.list("students"),
    ]);
    CACHE = { disciplines, teachers, students };
  } catch (e) { /* comptes secrétaire restreints : ignorer */ }
}

// ---------- Routage ----------
function route() {
  const key = (location.hash.replace("#/", "") || "dashboard").split("?")[0];
  document.querySelectorAll(".nav-item").forEach((b) => b.classList.toggle("active", b.dataset.key === key));
  const titles = {
    dashboard: ["Bienvenue, " + CURRENT_USER.full_name + " !", "Voici ce qui se passe aujourd'hui dans votre centre."],
    students: ["Élèves / Artistes", "Gérez les informations des élèves et artistes"],
    disciplines: ["Disciplines artistiques", "Gérez les disciplines et spécialités"],
    sales: ["Ventes", "Gérez les ventes de produits et services"],
    teachers: ["Enseignants", "Gérez les informations des enseignants"],
    grades: ["Notes et évaluations", "Saisissez et suivez les notes"],
    finance: ["Finances", "Gérez les finances, paiements et dépenses"],
    certificates: ["Documents & Attestations", "Émettez des attestations et documents officiels"],
    settings: ["Paramètres", "Informations et configuration du centre"],
    users: ["Comptes secrétaires", "Créez et gérez les comptes du personnel"],
  };
  const [t, s] = titles[key] || titles.dashboard;
  document.getElementById("page-title").textContent = t;
  document.getElementById("page-subtitle").textContent = s;

  const content = document.getElementById("app-content");
  content.innerHTML = "";
  const renderers = {
    dashboard: renderDashboard, students: () => renderModule("students"), disciplines: () => renderModule("disciplines"),
    sales: () => renderModule("sales"), teachers: () => renderModule("teachers"), grades: () => renderModule("grades"),
    finance: renderFinance, certificates: renderCertificates, settings: renderSettings, users: renderUsers,
  };
  (renderers[key] || renderDashboard)();
}

// ============================================
// TABLEAU DE BORD
// ============================================
async function renderDashboard() {
  const content = document.getElementById("app-content");
  let stats;
  try { stats = await Api.dashboard(); } catch (e) { toast(e.message, true); return; }

  const cards = [
    { key: "students", label: "Élèves / Artistes", icon: "👥", cls: "c-purple", value: stats.students },
    { key: "disciplines", label: "Disciplines artistiques", icon: "🎨", cls: "c-blue", value: stats.disciplines },
    { key: "sales", label: "Ventes", icon: "🛒", cls: "c-orange", value: stats.sales_month },
    { key: "teachers", label: "Enseignants", icon: "🎓", cls: "c-green", value: stats.teachers },
    { key: "grades", label: "Notes et évaluations", icon: "📋", cls: "c-pink", value: "" },
    { key: "finance", label: "Finances", icon: "💰", cls: "c-teal", value: "" },
  ];
  const grid = el(`<div class="module-grid"></div>`);
  cards.forEach((c) => {
    const card = el(`<button class="module-card ${c.cls}">
      <div><div class="m-icon">${c.icon}</div><h3>${c.label}</h3><p>Accéder au module</p></div>
      <div class="m-arrow">→</div>
    </button>`);
    card.addEventListener("click", () => location.hash = "#/" + c.key);
    grid.appendChild(card);
  });
  content.appendChild(grid);

  content.appendChild(el(`
    <div class="panel">
      <div class="panel-title"><h3>Aperçu général — ce mois</h3></div>
      <div class="stat-row">
        <div class="stat-card"><div class="s-icon" style="background:#f3e8ff;">👥</div><div class="s-value">${stats.students}</div><div class="s-label">Élèves / Artistes</div></div>
        <div class="stat-card"><div class="s-icon" style="background:#e0f0ff;">🎓</div><div class="s-value">${stats.teachers}</div><div class="s-label">Enseignants</div></div>
        <div class="stat-card"><div class="s-icon" style="background:#fff3e0;">🎨</div><div class="s-value">${stats.disciplines}</div><div class="s-label">Disciplines</div></div>
        <div class="stat-card"><div class="s-icon" style="background:#e0fbe8;">🛒</div><div class="s-value">${stats.sales_month}</div><div class="s-label">Ventes ce mois</div></div>
      </div>
    </div>
  `));

  content.appendChild(el(`
    <div class="panel">
      <div class="panel-title"><h3>Résumé financier — ce mois</h3></div>
      <div class="finance-grid">
        <div class="finance-card income"><div class="f-label">Recettes totales</div><div class="f-value">${money(stats.income_month)} FCFA</div></div>
        <div class="finance-card expense"><div class="f-label">Dépenses totales</div><div class="f-value">${money(stats.expense_month)} FCFA</div></div>
        <div class="finance-card net"><div class="f-label">Bénéfice net</div><div class="f-value">${money(stats.net_month)} FCFA</div></div>
      </div>
    </div>
  `));

  const quick = el(`
    <div class="panel">
      <div class="panel-title"><h3>Actions rapides</h3></div>
      <div class="quick-actions">
        <button class="quick-action" data-go="students"><span class="qa-icon" style="background:#8b3ff9;">＋</span>Ajouter élève</button>
        <button class="quick-action" data-go="teachers"><span class="qa-icon" style="background:#2e6df6;">＋</span>Ajouter enseignant</button>
        <button class="quick-action" data-go="sales"><span class="qa-icon" style="background:#ff8a00;">＋</span>Nouvelle vente</button>
        <button class="quick-action" data-go="finance"><span class="qa-icon" style="background:#16a34a;">＋</span>Enregistrer paiement</button>
      </div>
    </div>
  `);
  quick.querySelectorAll("[data-go]").forEach((b) => b.addEventListener("click", () => location.hash = "#/" + b.dataset.go));
  content.appendChild(quick);
}

// ============================================
// CONFIGURATION DES MODULES CRUD GÉNÉRIQUES
// ============================================
function getModuleConfig(table) {
  const configs = {
    students: {
      title: "Élève / Artiste",
      columns: [
        { key: "matricule", label: "Matricule" },
        { key: "name", label: "Nom", render: (r) => `${r.first_name} ${r.last_name}` },
        { key: "discipline_id", label: "Discipline", render: (r) => nameOf(CACHE.disciplines, r.discipline_id) },
        { key: "phone", label: "Téléphone" },
        { key: "status", label: "Statut", render: (r) => `<span class="tag tag-${r.status}">${statusLabel(r.status)}</span>` },
      ],
      fields: [
        { key: "matricule", label: "Matricule", type: "text" },
        { key: "first_name", label: "Prénom", type: "text", required: true },
        { key: "last_name", label: "Nom", type: "text", required: true },
        { key: "birth_date", label: "Date de naissance", type: "date" },
        { key: "gender", label: "Sexe", type: "select", options: [["M", "Masculin"], ["F", "Féminin"]] },
        { key: "phone", label: "Téléphone", type: "text" },
        { key: "parent_name", label: "Parent / Tuteur", type: "text" },
        { key: "parent_phone", label: "Téléphone parent", type: "text" },
        { key: "discipline_id", label: "Discipline", type: "select", optionsFrom: "disciplines" },
        { key: "status", label: "Statut", type: "select", options: [["actif", "Actif"], ["stage", "En stage"], ["termine_formation", "Formation terminée"], ["abandon", "Abandon"]] },
        { key: "address", label: "Adresse", type: "text", full: true },
        { key: "notes", label: "Notes", type: "textarea", full: true },
      ],
      rowActions: (r) => [{ label: "🖨️ Fiche", onClick: async () => PrintDocs.enrollment(await Api.printData("enrollment", r.id)) }],
    },
    disciplines: {
      title: "Discipline artistique",
      columns: [
        { key: "name", label: "Nom" },
        { key: "teacher_id", label: "Enseignant", render: (r) => nameOf(CACHE.teachers, r.teacher_id) },
        { key: "price", label: "Tarif", render: (r) => money(r.price) + " FCFA" },
        { key: "active", label: "Statut", render: (r) => r.active ? '<span class="tag tag-actif">Active</span>' : '<span class="tag tag-abandon">Inactive</span>' },
      ],
      fields: [
        { key: "name", label: "Nom de la discipline", type: "text", required: true },
        { key: "description", label: "Description", type: "textarea", full: true },
        { key: "price", label: "Tarif (FCFA)", type: "number" },
        { key: "teacher_id", label: "Enseignant référent", type: "select", optionsFrom: "teachers" },
        { key: "active", label: "Statut", type: "select", options: [[1, "Active"], [0, "Inactive"]] },
      ],
    },
    teachers: {
      title: "Enseignant",
      columns: [
        { key: "name", label: "Nom", render: (r) => `${r.first_name} ${r.last_name}` },
        { key: "specialty", label: "Spécialité" },
        { key: "phone", label: "Téléphone" },
        { key: "salary", label: "Salaire", render: (r) => money(r.salary) + " FCFA" },
      ],
      fields: [
        { key: "first_name", label: "Prénom", type: "text", required: true },
        { key: "last_name", label: "Nom", type: "text", required: true },
        { key: "phone", label: "Téléphone", type: "text" },
        { key: "email", label: "Email", type: "text" },
        { key: "specialty", label: "Spécialité", type: "text" },
        { key: "salary", label: "Salaire mensuel (FCFA)", type: "number" },
        { key: "hire_date", label: "Date d'embauche", type: "date" },
      ],
    },
    sales: {
      title: "Vente",
      columns: [
        { key: "sale_date", label: "Date", render: (r) => dateFr(r.sale_date) },
        { key: "item", label: "Article / Service" },
        { key: "quantity", label: "Qté" },
        { key: "amount", label: "Montant", render: (r) => money(r.amount) + " FCFA" },
        { key: "buyer_name", label: "Acheteur" },
      ],
      fields: [
        { key: "item", label: "Article / Service", type: "text", required: true },
        { key: "quantity", label: "Quantité", type: "number" },
        { key: "unit_price", label: "Prix unitaire (FCFA)", type: "number" },
        { key: "amount", label: "Montant total (FCFA)", type: "number", required: true },
        { key: "buyer_name", label: "Nom de l'acheteur", type: "text" },
        { key: "student_id", label: "Élève lié (optionnel)", type: "select", optionsFrom: "students" },
        { key: "description", label: "Description", type: "textarea", full: true },
      ],
    },
    grades: {
      title: "Note / Évaluation",
      columns: [
        { key: "student_id", label: "Élève", render: (r) => nameOf(CACHE.students, r.student_id) },
        { key: "discipline_id", label: "Discipline", render: (r) => nameOf(CACHE.disciplines, r.discipline_id) },
        { key: "evaluation_name", label: "Évaluation" },
        { key: "score", label: "Note", render: (r) => `${r.score} / ${r.max_score}` },
        { key: "eval_date", label: "Date", render: (r) => dateFr(r.eval_date) },
      ],
      fields: [
        { key: "student_id", label: "Élève", type: "select", optionsFrom: "students", required: true },
        { key: "discipline_id", label: "Discipline", type: "select", optionsFrom: "disciplines" },
        { key: "evaluation_name", label: "Nom de l'évaluation", type: "text", required: true },
        { key: "score", label: "Note obtenue", type: "number", required: true },
        { key: "max_score", label: "Note maximale", type: "number" },
        { key: "comment", label: "Commentaire", type: "textarea", full: true },
      ],
    },
  };
  return configs[table];
}

function statusLabel(s) {
  return { actif: "Actif", stage: "En stage", termine_formation: "Formation terminée", abandon: "Abandon" }[s] || s;
}

// ---------- Rendu générique liste + formulaire ----------
async function renderModule(table) {
  const cfg = getModuleConfig(table);
  const content = document.getElementById("app-content");
  let rows;
  try { rows = await Api.list(table); } catch (e) { toast(e.message, true); return; }

  const header = el(`<div class="view-header">
    <h2>${cfg.title}s</h2>
    <button class="btn btn-primary" id="add-btn">＋ Ajouter</button>
  </div>`);
  header.querySelector("#add-btn").addEventListener("click", () => openForm(table, cfg));
  content.appendChild(header);

  content.appendChild(await buildTable(table, cfg, rows));
}

async function buildTable(table, cfg, rows) {
  if (!rows.length) {
    return el(`<div class="table-wrap"><div class="empty-state">Aucune donnée pour le moment. Cliquez sur "Ajouter" pour commencer.</div></div>`);
  }
  const thead = cfg.columns.map((c) => `<th>${c.label}</th>`).join("") + "<th>Actions</th>";
  const wrap = el(`<div class="table-wrap"><table><thead><tr>${thead}</tr></thead><tbody></tbody></table></div>`);
  const tbody = wrap.querySelector("tbody");
  rows.forEach((r) => {
    const tds = cfg.columns.map((c) => `<td>${c.render ? c.render(r) : (r[c.key] ?? "—")}</td>`).join("");
    const tr = el(`<tr>${tds}<td class="row-actions"></td></tr>`);
    const actionsCell = tr.querySelector(".row-actions");
    if (cfg.rowActions) {
      cfg.rowActions(r).forEach((a) => {
        const b = el(`<button class="btn btn-sm btn-secondary">${a.label}</button>`);
        b.addEventListener("click", () => a.onClick());
        actionsCell.appendChild(b);
      });
    }
    const editBtn = el(`<button class="btn btn-sm btn-secondary">✏️</button>`);
    editBtn.addEventListener("click", () => openForm(table, cfg, r));
    actionsCell.appendChild(editBtn);
    const delBtn = el(`<button class="btn btn-sm btn-danger">🗑️</button>`);
    delBtn.addEventListener("click", async () => {
      if (!confirm("Supprimer définitivement cet élément ?")) return;
      try { await Api.remove(table, r.id); toast("Supprimé."); route(); } catch (e) { toast(e.message, true); }
    });
    actionsCell.appendChild(delBtn);
    tbody.appendChild(tr);
  });
  return wrap;
}

function optionsForField(field) {
  if (field.options) return field.options;
  if (field.optionsFrom) {
    const list = CACHE[field.optionsFrom] || [];
    return list.map((x) => [x.id, x.name || (x.first_name + " " + x.last_name)]);
  }
  return [];
}

function openForm(table, cfg, existing) {
  const isEdit = !!existing;
  const fieldsHtml = cfg.fields.map((f) => {
    const val = existing ? existing[f.key] : (f.key === "max_score" ? 20 : f.key === "quantity" ? 1 : f.key === "active" ? 1 : "");
    let inputHtml;
    if (f.type === "select") {
      const opts = optionsForField(f);
      inputHtml = `<select id="f-${f.key}" ${f.required ? "required" : ""}>
        <option value="">— Sélectionner —</option>
        ${opts.map(([v, l]) => `<option value="${v}" ${String(val) === String(v) ? "selected" : ""}>${l}</option>`).join("")}
      </select>`;
    } else if (f.type === "textarea") {
      inputHtml = `<textarea id="f-${f.key}" rows="3">${val ?? ""}</textarea>`;
    } else {
      inputHtml = `<input type="${f.type}" id="f-${f.key}" value="${val ?? ""}" ${f.required ? "required" : ""} />`;
    }
    return `<div class="field ${f.full ? "full" : ""}"><label>${f.label}</label>${inputHtml}</div>`;
  }).join("");

  const modal = el(`<div class="modal-overlay">
    <div class="modal-box">
      <h3>${isEdit ? "Modifier" : "Ajouter"} — ${cfg.title}</h3>
      <form id="entity-form"><div class="form-grid">${fieldsHtml}</div>
        <div class="modal-actions">
          <button type="button" class="btn btn-secondary" id="cancel-btn">Annuler</button>
          <button type="submit" class="btn btn-primary">Enregistrer</button>
        </div>
      </form>
    </div>
  </div>`);
  document.getElementById("modal-root").appendChild(modal);
  modal.querySelector("#cancel-btn").addEventListener("click", closeModal);
  modal.addEventListener("click", (e) => { if (e.target === modal) closeModal(); });

  modal.querySelector("#entity-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const body = {};
    cfg.fields.forEach((f) => {
      const elm = document.getElementById("f-" + f.key);
      let v = elm.value;
      if (f.type === "number") v = v === "" ? null : Number(v);
      if (f.type === "select" && v === "") v = null;
      body[f.key] = v;
    });
    try {
      if (isEdit) await Api.update(table, existing.id, body);
      else await Api.create(table, body);
      toast("Enregistré avec succès.");
      closeModal();
      await preloadCache();
      route();
    } catch (err) { toast(err.message, true); }
  });
}

// ============================================
// FINANCES (paiements, dépenses, salaires enseignants)
// ============================================
let financeTab = "payments";
async function renderFinance() {
  const content = document.getElementById("app-content");
  const tabs = el(`<div class="tabs">
    <button class="tab-btn" data-t="payments">Paiements élèves</button>
    <button class="tab-btn" data-t="expenses">Dépenses</button>
    <button class="tab-btn" data-t="teacher_payments">Salaires enseignants</button>
  </div>`);
  tabs.querySelectorAll(".tab-btn").forEach((b) => {
    b.classList.toggle("active", b.dataset.t === financeTab);
    b.addEventListener("click", () => { financeTab = b.dataset.t; route(); });
  });
  content.appendChild(tabs);

  const financeConfigs = {
    payments: {
      title: "Paiement", table: "payments",
      columns: [
        { key: "receipt_number", label: "N° Reçu" },
        { key: "student_id", label: "Élève", render: (r) => nameOf(CACHE.students, r.student_id) },
        { key: "amount", label: "Montant", render: (r) => money(r.amount) + " FCFA" },
        { key: "method", label: "Mode" },
        { key: "pay_date", label: "Date", render: (r) => dateFr(r.pay_date) },
      ],
      fields: [
        { key: "student_id", label: "Élève", type: "select", optionsFrom: "students", required: true },
        { key: "amount", label: "Montant (FCFA)", type: "number", required: true },
        { key: "method", label: "Mode de paiement", type: "select", options: [["espèces", "Espèces"], ["mobile money", "Mobile Money"], ["virement", "Virement"], ["chèque", "Chèque"]] },
        { key: "description", label: "Motif", type: "text", full: true },
      ],
      rowActions: (r) => [{ label: "🖨️ Quittance", onClick: async () => PrintDocs.receipt(await Api.printData("receipt", r.id)) }],
    },
    expenses: {
      title: "Dépense", table: "expenses",
      columns: [
        { key: "expense_date", label: "Date", render: (r) => dateFr(r.expense_date) },
        { key: "category", label: "Catégorie" },
        { key: "amount", label: "Montant", render: (r) => money(r.amount) + " FCFA" },
        { key: "description", label: "Description" },
      ],
      fields: [
        { key: "category", label: "Catégorie", type: "text", required: true },
        { key: "amount", label: "Montant (FCFA)", type: "number", required: true },
        { key: "description", label: "Description", type: "textarea", full: true },
      ],
    },
    teacher_payments: {
      title: "Salaire enseignant", table: "teacher_payments",
      columns: [
        { key: "teacher_id", label: "Enseignant", render: (r) => nameOf(CACHE.teachers, r.teacher_id) },
        { key: "amount", label: "Montant", render: (r) => money(r.amount) + " FCFA" },
        { key: "pay_date", label: "Date", render: (r) => dateFr(r.pay_date) },
      ],
      fields: [
        { key: "teacher_id", label: "Enseignant", type: "select", optionsFrom: "teachers", required: true },
        { key: "amount", label: "Montant (FCFA)", type: "number", required: true },
        { key: "description", label: "Note", type: "text", full: true },
      ],
    },
  };
  const cfg = financeConfigs[financeTab];
  let rows;
  try { rows = await Api.list(cfg.table); } catch (e) { toast(e.message, true); return; }

  const header = el(`<div class="view-header"><h2>${cfg.title}s</h2><button class="btn btn-primary" id="add-btn">＋ Ajouter</button></div>`);
  header.querySelector("#add-btn").addEventListener("click", () => openForm(cfg.table, cfg));
  content.appendChild(header);
  content.appendChild(await buildTable(cfg.table, cfg, rows));
}

// ============================================
// ATTESTATIONS / DOCUMENTS
// ============================================
async function renderCertificates() {
  const content = document.getElementById("app-content");
  const cfg = {
    title: "Attestation", table: "certificates",
    columns: [
      { key: "cert_number", label: "N°" },
      { key: "student_id", label: "Élève", render: (r) => nameOf(CACHE.students, r.student_id) },
      { key: "cert_type", label: "Type", render: (r) => ({ fin_stage: "Fin de stage", fin_formation: "Fin de formation", participation: "Participation", autre: "Autre" }[r.cert_type]) },
      { key: "issue_date", label: "Date d'émission", render: (r) => dateFr(r.issue_date) },
    ],
    fields: [
      { key: "student_id", label: "Élève", type: "select", optionsFrom: "students", required: true },
      { key: "cert_type", label: "Type d'attestation", type: "select", options: [["fin_stage", "Fin de stage"], ["fin_formation", "Fin de formation"], ["participation", "Participation"], ["autre", "Autre"]], required: true },
      { key: "title", label: "Titre personnalisé (si autre)", type: "text", full: true },
    ],
    rowActions: (r) => [{ label: "🖨️ Imprimer", onClick: async () => PrintDocs.certificate(await Api.printData("certificate", r.id)) }],
  };
  let rows;
  try { rows = await Api.list("certificates"); } catch (e) { toast(e.message, true); return; }
  const header = el(`<div class="view-header"><h2>Attestations émises</h2><button class="btn btn-primary" id="add-btn">＋ Émettre une attestation</button></div>`);
  header.querySelector("#add-btn").addEventListener("click", () => openForm("certificates", cfg));
  content.appendChild(header);
  content.appendChild(await buildTable("certificates", cfg, rows));
}

// ============================================
// PARAMÈTRES DU CENTRE (admin)
// ============================================
async function renderSettings() {
  const content = document.getElementById("app-content");
  let s;
  try { s = await Api.settings.get(); } catch (e) { toast(e.message, true); return; }
  const panel = el(`<div class="panel">
    <div class="panel-title"><h3>Informations du centre</h3></div>
    <form id="settings-form" class="form-grid">
      <div class="field"><label>Nom du centre</label><input id="s-name" value="${s.name || ""}" /></div>
      <div class="field"><label>Slogan</label><input id="s-slogan" value="${s.slogan || ""}" /></div>
      <div class="field"><label>Téléphone</label><input id="s-phone" value="${s.phone || ""}" /></div>
      <div class="field"><label>Email</label><input id="s-email" value="${s.email || ""}" /></div>
      <div class="field full"><label>Adresse</label><input id="s-address" value="${s.address || ""}" /></div>
      <div class="field"><label>Nom du directeur</label><input id="s-director_name" value="${s.director_name || ""}" /></div>
      <div class="field"><label>Devise</label><input id="s-currency" value="${s.currency || "FCFA"}" /></div>
      <div class="field full"><label>URL du logo</label><input id="s-logo_url" value="${s.logo_url || ""}" /></div>
      <div class="field full"><button class="btn btn-primary" type="submit">Enregistrer les paramètres</button></div>
    </form>
  </div>`);
  panel.querySelector("#settings-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const body = {};
    ["name", "slogan", "phone", "email", "address", "director_name", "currency", "logo_url"].forEach((k) => {
      body[k] = document.getElementById("s-" + k).value;
    });
    try { await Api.settings.update(body); toast("Paramètres enregistrés."); } catch (err) { toast(err.message, true); }
  });
  content.appendChild(panel);
}

// ============================================
// COMPTES SECRÉTAIRES (admin)
// ============================================
async function renderUsers() {
  const content = document.getElementById("app-content");
  let rows;
  try { rows = await Api.call ? [] : await (await fetch("/api/users", { headers: { Authorization: "Bearer " + Api.token() } })).json(); } catch (e) { rows = []; }
  // (appel direct car /users n'est pas dans la config CRUD générique)
  const header = el(`<div class="view-header"><h2>Comptes secrétaires</h2><button class="btn btn-primary" id="add-btn">＋ Créer un compte</button></div>`);
  content.appendChild(header);

  const wrap = el(`<div class="table-wrap"><table><thead><tr><th>Nom</th><th>Identifiant</th><th>Statut</th><th>Actions</th></tr></thead><tbody></tbody></table></div>`);
  const tbody = wrap.querySelector("tbody");
  (rows || []).filter((u) => u.role === "secretary").forEach((u) => {
    const tr = el(`<tr>
      <td>${u.full_name}</td><td>${u.username}</td>
      <td>${u.active ? '<span class="tag tag-actif">Actif</span>' : '<span class="tag tag-abandon">Désactivé</span>'}</td>
      <td class="row-actions"></td>
    </tr>`);
    const toggleBtn = el(`<button class="btn btn-sm btn-secondary">${u.active ? "Désactiver" : "Activer"}</button>`);
    toggleBtn.addEventListener("click", async () => {
      await fetch("/api/users/" + u.id, { method: "PUT", headers: { "Content-Type": "application/json", Authorization: "Bearer " + Api.token() }, body: JSON.stringify({ active: u.active ? 0 : 1 }) });
      route();
    });
    tr.querySelector(".row-actions").appendChild(toggleBtn);
    tbody.appendChild(tr);
  });
  content.appendChild(rows && rows.length ? wrap : el(`<div class="table-wrap"><div class="empty-state">Aucun compte secrétaire pour le moment.</div></div>`));

  header.querySelector("#add-btn").addEventListener("click", () => {
    const modal = el(`<div class="modal-overlay"><div class="modal-box">
      <h3>Créer un compte secrétaire</h3>
      <form id="user-form">
        <div class="field"><label>Nom complet</label><input id="u-full_name" required /></div>
        <div class="field"><label>Identifiant</label><input id="u-username" required /></div>
        <div class="field"><label>Mot de passe temporaire</label><input id="u-password" type="text" required /></div>
        <div class="modal-actions">
          <button type="button" class="btn btn-secondary" id="cancel-btn">Annuler</button>
          <button type="submit" class="btn btn-primary">Créer</button>
        </div>
      </form>
    </div></div>`);
    document.getElementById("modal-root").appendChild(modal);
    modal.querySelector("#cancel-btn").addEventListener("click", closeModal);
    modal.querySelector("#user-form").addEventListener("submit", async (e) => {
      e.preventDefault();
      const body = {
        full_name: document.getElementById("u-full_name").value,
        username: document.getElementById("u-username").value,
        password: document.getElementById("u-password").value,
      };
      const res = await fetch("/api/users", { method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer " + Api.token() }, body: JSON.stringify(body) });
      if (res.ok) { toast("Compte créé."); closeModal(); route(); } else { const d = await res.json(); toast(d.error, true); }
    });
  });
}

// ---------- Démarrage ----------
if (Api.token()) boot(); else { document.getElementById("login-screen").classList.remove("hidden"); }
