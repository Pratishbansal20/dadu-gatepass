"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { authApi, ApiError } from "@/lib/api";
import { useAuthStore } from "@/lib/auth-store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ShieldCheck, Eye, EyeOff } from "lucide-react";

const ROLE_DESTINATIONS: Record<string, string> = {
  STUDENT: "/dashboard/student",
  FACULTY: "/dashboard/faculty",
  HOSTEL_SUPERINTENDENT: "/dashboard/superintendent",
  CONFERENCE_SUPERVISOR: "/dashboard/superintendent",
  GATE_SECURITY: "/dashboard/gate",
  SUPER_ADMIN: "/dashboard/admin",
};

export default function LoginPage() {
  const router = useRouter();
  const { setAuth } = useAuthStore();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const tokens = await authApi.login(email, password);
      const me = await authApi.me(tokens.access_token);
      setAuth(me, tokens.access_token, tokens.refresh_token);
      router.replace(ROLE_DESTINATIONS[me.role] ?? "/");
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError("Unable to connect. Make sure the server is running.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0f172a] flex grain-texture">
      {/* Left panel */}
      <div className="hidden lg:flex lg:w-1/2 flex-col justify-between p-12 bg-gradient-to-br from-slate-800 to-slate-900 border-r border-white/5">
        <div className="flex items-center gap-3">
          <ShieldCheck className="w-8 h-8 text-amber-400" />
          <span className="text-white font-display text-xl">BITS Gatepass</span>
        </div>
        <div>
          <blockquote className="text-3xl font-display text-white leading-snug">
            "Secure. Swift.<br />Accountable."
          </blockquote>
          <p className="mt-4 text-slate-400 text-sm">
            Campus gate pass management system · BITS Pilani
          </p>
        </div>
        <div className="grid grid-cols-2 gap-4 text-xs text-slate-500">
          <div>
            <p className="text-amber-400 font-mono text-lg font-bold">6</p>
            <p>User Roles</p>
          </div>
          <div>
            <p className="text-amber-400 font-mono text-lg font-bold">4</p>
            <p>Pass Types</p>
          </div>
          <div>
            <p className="text-amber-400 font-mono text-lg font-bold">OTP</p>
            <p>Verified Entry</p>
          </div>
          <div>
            <p className="text-amber-400 font-mono text-lg font-bold">RFID</p>
            <p>Vehicle Access</p>
          </div>
        </div>
      </div>

      {/* Right panel */}
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-md">
          <div className="lg:hidden flex items-center gap-2 mb-8">
            <ShieldCheck className="w-6 h-6 text-amber-400" />
            <span className="text-white font-display text-lg">BITS Gatepass</span>
          </div>

          <div className="bg-[#1e293b] rounded-2xl border border-white/10 p-8 shadow-2xl">
            <h1 className="text-2xl font-display text-white mb-1">Sign in</h1>
            <p className="text-sm text-slate-400 mb-8">Access your campus pass portal</p>

            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="email" className="text-slate-300">
                  Email
                </Label>
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@bits.ac.in"
                  required
                  className="bg-[#0f172a] border-white/10 text-white placeholder:text-slate-600 focus-visible:ring-amber-500"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password" className="text-slate-300">
                  Password
                </Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    className="bg-[#0f172a] border-white/10 text-white placeholder:text-slate-600 focus-visible:ring-amber-500 pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {error && (
                <div className="rounded-md bg-red-900/30 border border-red-700/50 px-4 py-3 text-sm text-red-400">
                  {error}
                </div>
              )}

              <Button
                type="submit"
                variant="amber"
                className="w-full"
                disabled={loading}
              >
                {loading ? "Signing in…" : "Sign in"}
              </Button>
            </form>

            {/* Demo credentials hint */}
            <div className="mt-6 pt-6 border-t border-white/10">
              <p className="text-xs text-slate-500 mb-3">Demo credentials:</p>
              <div className="grid grid-cols-2 gap-1 text-xs font-mono text-slate-500">
                <span>admin@bits.ac.in</span><span>Admin@123</span>
                <span>student@bits.ac.in</span><span>Student@123</span>
                <span>gate@bits.ac.in</span><span>Gate@123</span>
                <span>faculty@bits.ac.in</span><span>Faculty@123</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
