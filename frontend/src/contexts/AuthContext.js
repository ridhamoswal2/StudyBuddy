import { createContext, useContext, useState, useEffect, useCallback } from "react";
import axios from "axios";
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  updateProfile,
  GoogleAuthProvider,
  signInWithPopup,
} from "firebase/auth";
import { auth } from "../firebase";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const AuthContext = createContext(null);

axios.defaults.withCredentials = false;

axios.interceptors.request.use(async (config) => {
  const current = auth.currentUser;
  if (current) {
    const token = await current.getIdToken();
    config.headers = config.headers || {};
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

function formatApiErrorDetail(detail) {
  if (detail == null) return "Something went wrong. Please try again.";
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail))
    return detail.map((e) => (e && typeof e.msg === "string" ? e.msg : JSON.stringify(e))).filter(Boolean).join(" ");
  if (detail && typeof detail.msg === "string") return detail.msg;
  return String(detail);
}

function formatAnyError(error) {
  if (!error) return "Something went wrong. Please try again.";
  const apiDetail = error.response?.data?.detail;
  if (apiDetail) return formatApiErrorDetail(apiDetail);
  if (typeof error.message === "string" && error.message.trim()) return error.message;
  if (typeof error.code === "string" && error.code.trim()) return error.code;
  return "Something went wrong. Please try again.";
}

export function AuthProvider({ children }) {
  const googleProvider = new GoogleAuthProvider();
  const [user, setUser] = useState(null); // null = checking, false = not auth'd
  const [loading, setLoading] = useState(true);

  const checkAuth = useCallback(async () => {
    return onAuthStateChanged(auth, async (firebaseUser) => {
      if (!firebaseUser) {
        setUser(false);
        setLoading(false);
        return;
      }
      try {
        const res = await axios.get(`${API}/auth/me`);
        setUser(res.data);
      } catch {
        setUser(false);
      } finally {
        setLoading(false);
      }
    });
  }, []);

  useEffect(() => {
    const unsubscribe = checkAuth();
    return () => {
      if (typeof unsubscribe === "function") unsubscribe();
    };
  }, [checkAuth]);

  const login = async (email, password) => {
    try {
      await signInWithEmailAndPassword(auth, email, password);
      const res = await axios.post(`${API}/auth/login`, { email, password });
      setUser(res.data);
      return { success: true };
    } catch (e) {
      return { success: false, error: formatAnyError(e) };
    }
  };

  const register = async (name, email, password) => {
    try {
      const cred = await createUserWithEmailAndPassword(auth, email, password);
      await updateProfile(cred.user, { displayName: name });
      const res = await axios.post(`${API}/auth/register`, { name, email, password });
      setUser(res.data);
      return { success: true };
    } catch (e) {
      return { success: false, error: formatAnyError(e) };
    }
  };

  const logout = async () => {
    try {
      await axios.post(`${API}/auth/logout`, {});
      await signOut(auth);
    } catch { /* ignore */ }
    setUser(false);
  };

  const signInWithGoogle = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
      const res = await axios.get(`${API}/auth/me`);
      setUser(res.data);
      return { success: true };
    } catch (e) {
      return { success: false, error: formatAnyError(e) };
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, signInWithGoogle }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
