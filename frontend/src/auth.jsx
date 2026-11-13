import { createContext, useContext, useEffect, useState } from "react";
import { api, getToken, setToken } from "./api.js";

const AuthContext = createContext(null);
export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(!!getToken());

  useEffect(() => {
    if (getToken()) {
      api.me().then(setUser).catch(() => setToken(null)).finally(() => setLoading(false));
    }
    const onLogout = () => setUser(null);
    window.addEventListener("dd-logout", onLogout);
    return () => window.removeEventListener("dd-logout", onLogout);
  }, []);

  const finish = (res) => {
    setToken(res.token);
    setUser(res.user);
  };

  const value = {
    user,
    loading,
    login: async (email, password) => finish(await api.login(email, password)),
    register: async (name, email, password) => finish(await api.register(name, email, password)),
    logout: () => {
      setToken(null);
      setUser(null);
    },
  };
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
