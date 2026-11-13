const BASE = import.meta.env.VITE_API_URL || "";

export const getToken = () => localStorage.getItem("dd_token");
export const setToken = (t) => (t ? localStorage.setItem("dd_token", t) : localStorage.removeItem("dd_token"));

async function request(path, { method = "GET", body, form } = {}) {
  const headers = {};
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  let payload;
  if (form) {
    payload = form;
  } else if (body !== undefined) {
    headers["Content-Type"] = "application/json";
    payload = JSON.stringify(body);
  }

  let res;
  try {
    res = await fetch(`${BASE}/api${path}`, { method, headers, body: payload });
  } catch {
    throw new Error("Cannot reach the server. Is the backend running?");
  }

  if (res.status === 401 && token) {
    setToken(null);
    window.dispatchEvent(new Event("dd-logout"));
  }
  if (!res.ok) {
    let msg = res.statusText || "Request failed";
    try {
      const j = await res.json();
      msg = typeof j.detail === "string" ? j.detail : JSON.stringify(j.detail);
    } catch {}
    throw new Error(msg);
  }
  if (res.status === 204) return null;
  return res.json();
}

export const api = {
  register: (name, email, password) => request("/auth/register", { method: "POST", body: { name, email, password } }),
  login: (email, password) => request("/auth/login", { method: "POST", body: { email, password } }),
  me: () => request("/auth/me"),

  listVideos: () => request("/videos"),
  addYoutube: (url) => request("/videos/youtube", { method: "POST", body: { url } }),
  upload: (file) => {
    const form = new FormData();
    form.append("file", file);
    return request("/videos/upload", { method: "POST", form });
  },
  getVideo: (id) => request(`/videos/${id}`),
  getTranscript: (id) => request(`/videos/${id}/transcript`),
  search: (id, q) => request(`/videos/${id}/search?q=${encodeURIComponent(q)}`),
  deleteVideo: (id) => request(`/videos/${id}`, { method: "DELETE" }),

  chat: (id, question) => request(`/videos/${id}/chat`, { method: "POST", body: { question } }),
  chatHistory: (id) => request(`/videos/${id}/chat`),
  clearChat: (id) => request(`/videos/${id}/chat`, { method: "DELETE" }),
};

export function fmtTime(sec) {
  sec = Math.max(0, Math.floor(sec || 0));
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  return h ? `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}` : `${m}:${String(s).padStart(2, "0")}`;
}

export function parseTime(str) {
  const p = str.split(":").map(Number);
  return p.length === 3 ? p[0] * 3600 + p[1] * 60 + p[2] : p[0] * 60 + p[1];
}
