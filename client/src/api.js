// Thin REST client for the work log API. In dev, Vite proxies /api to the
// Express server (see vite.config.js).

const BASE = "/api";
export const TOKEN_KEY = "work_log_token";

function authHeaders() {
  const token = localStorage.getItem(TOKEN_KEY);
  return token ? { Authorization: `Bearer ${token}` } : {};
}

// `auth: true` (default) means a 401 should force a global logout. Login /
// status calls pass `auth: false` so a wrong password just surfaces an error.
async function request(path, options = {}, { auth = true } = {}) {
  const response = await fetch(`${BASE}${path}`, {
    headers: { "Content-Type": "application/json", ...authHeaders() },
    ...options,
  });

  if (response.status === 401) {
    if (auth) window.dispatchEvent(new Event("auth:unauthorized"));
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error || "Unauthorized");
  }

  if (!response.ok) {
    const message = await response.text().catch(() => "");
    throw new Error(message || `Request failed: ${response.status}`);
  }

  if (response.status === 204) return null;
  return response.json();
}

// Sends an already-built report HTML string to the server, which renders it
// to a real PDF via headless Chrome (see server/src/routes/pdf.js) and
// returns the binary — used by the PDF preview drawer instead of the JSON
// `request()` helper above, since the response here isn't JSON.
async function renderPdf(html) {
  const response = await fetch(`${BASE}/pdf/render`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify({ html }),
  });

  if (response.status === 401) {
    window.dispatchEvent(new Event("auth:unauthorized"));
    throw new Error("Unauthorized");
  }

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.message || body.error || `Request failed: ${response.status}`);
  }

  return response.blob();
}

export const api = {
  getData() {
    return request("/data");
  },
  renderPdf,
  create(collection, item) {
    return request(`/${collection}`, {
      method: "POST",
      body: JSON.stringify(item),
    });
  },
  update(collection, id, item) {
    return request(`/${collection}/${id}`, {
      method: "PUT",
      body: JSON.stringify(item),
    });
  },
  remove(collection, id) {
    return request(`/${collection}/${id}`, { method: "DELETE" });
  },
};

export const authApi = {
  status() {
    return request("/auth/status", {}, { auth: false });
  },
  login(password) {
    return request(
      "/login",
      { method: "POST", body: JSON.stringify({ password }) },
      { auth: false }
    );
  },
  logout() {
    return request("/logout", { method: "POST" }, { auth: false });
  },
};
