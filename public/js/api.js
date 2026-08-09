const Api = (() => {
  function token() { return localStorage.getItem("ea_token"); }
  function setToken(t) { t ? localStorage.setItem("ea_token", t) : localStorage.removeItem("ea_token"); }

  async function call(path, options = {}) {
    const headers = Object.assign(
      { "Content-Type": "application/json" },
      options.headers || {}
    );
    if (token()) headers["Authorization"] = "Bearer " + token();
    const res = await fetch("/api" + path, Object.assign({}, options, { headers }));
    let data = null;
    try { data = await res.json(); } catch (e) { /* empty body */ }
    if (!res.ok) throw new Error((data && data.error) || "Erreur (" + res.status + ")");
    return data;
  }

  return {
    login: (username, password) => call("/login", { method: "POST", body: JSON.stringify({ username, password }) }),
    logout: () => call("/logout", { method: "POST" }),
    me: () => call("/me"),
    dashboard: () => call("/dashboard"),
    settings: { get: () => call("/settings"), update: (b) => call("/settings", { method: "PUT", body: JSON.stringify(b) }) },
    list: (table) => call("/" + table),
    get: (table, id) => call("/" + table + "/" + id),
    create: (table, body) => call("/" + table, { method: "POST", body: JSON.stringify(body) }),
    update: (table, id, body) => call("/" + table + "/" + id, { method: "PUT", body: JSON.stringify(body) }),
    remove: (table, id) => call("/" + table + "/" + id, { method: "DELETE" }),
    printData: (type, id) => call("/print/" + type + "/" + id),
    setToken,
    token,
  };
})();
