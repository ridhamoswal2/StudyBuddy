import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { BookOpen, LogIn, Eye, EyeOff } from "lucide-react";

export default function LoginPage() {
  const { login, signInWithGoogle } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleGoogle = async () => {
    setError("");
    setLoading(true);
    const result = await signInWithGoogle();
    if (result.success) {
      navigate("/");
    } else {
      setError(result.error);
    }
    setLoading(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    const result = await login(email, password);
    if (result.success) {
      navigate("/");
    } else {
      setError(result.error);
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-[#FFFDF7] flex items-center justify-center p-6" data-testid="login-page">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="flex items-center justify-center gap-3 mb-10 animate-slide-up">
          <div className="w-12 h-12 bg-[#FFDE59] border-2 border-[#0A0A0A] shadow-[4px_4px_0px_#0A0A0A] flex items-center justify-center">
            <BookOpen size={24} strokeWidth={2.5} />
          </div>
          <h1 className="text-2xl font-extrabold tracking-tight" style={{ fontFamily: 'Outfit, sans-serif' }}>
            StudyBuddy
          </h1>
        </div>

        {/* Form card */}
        <div className="bg-white border-2 border-[#0A0A0A] shadow-[6px_6px_0px_#0A0A0A] p-8 animate-slide-up stagger-1" data-testid="login-form">
          <h2 className="text-xl font-extrabold mb-1" style={{ fontFamily: 'Outfit, sans-serif' }}>Welcome back</h2>
          <p className="text-sm text-[#52525B] mb-6">Sign in to continue learning</p>

          {error && (
            <div className="bg-[#FF6B6B] border-2 border-[#0A0A0A] p-3 mb-4 text-sm font-bold" data-testid="login-error">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-sm font-bold uppercase tracking-wider block mb-2">Email</label>
              <input
                data-testid="login-email-input"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="you@example.com"
                className="w-full bg-white border-2 border-[#0A0A0A] p-3 text-sm font-medium focus:outline-none focus:shadow-[4px_4px_0px_#0A0A0A] transition-shadow"
              />
            </div>
            <div>
              <label className="text-sm font-bold uppercase tracking-wider block mb-2">Password</label>
              <div className="relative">
                <input
                  data-testid="login-password-input"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  placeholder="Your password"
                  className="w-full bg-white border-2 border-[#0A0A0A] p-3 pr-12 text-sm font-medium focus:outline-none focus:shadow-[4px_4px_0px_#0A0A0A] transition-shadow"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#52525B]"
                  data-testid="toggle-password-visibility"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>
            <button
              data-testid="login-submit-btn"
              type="submit"
              disabled={loading}
              className="w-full bg-[#FFDE59] border-2 border-[#0A0A0A] shadow-[4px_4px_0px_#0A0A0A] px-6 py-3 font-bold text-sm neo-btn disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading ? "Signing in..." : <><LogIn size={18} strokeWidth={2.5} /> Sign In</>}
            </button>

            <button
              type="button"
              onClick={handleGoogle}
              disabled={loading}
              className="w-full bg-[#B2F5EA] border-2 border-[#0A0A0A] shadow-[4px_4px_0px_#0A0A0A] px-6 py-3 font-bold text-sm neo-btn disabled:opacity-50 flex items-center justify-center gap-2"
            >
              <span className="w-5 h-5 border-2 border-[#0A0A0A] bg-white inline-flex items-center justify-center text-xs font-black">G</span>
              Continue with Google
            </button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-sm text-[#52525B]">
              Don't have an account?{" "}
              <Link to="/register" data-testid="go-to-register" className="font-bold text-[#0A0A0A] underline">
                Sign up
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
