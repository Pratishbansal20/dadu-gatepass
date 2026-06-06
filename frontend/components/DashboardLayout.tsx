"use client";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/lib/auth-store";
import { roleLabel } from "@/lib/utils";
import { LogOut, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";

interface DashboardLayoutProps {
  children: React.ReactNode;
  title: string;
  subtitle?: string;
}

export function DashboardLayout({ children, title, subtitle }: DashboardLayoutProps) {
  const router = useRouter();
  const { user, clearAuth } = useAuthStore();

  const handleLogout = () => { clearAuth(); router.replace("/login"); };

  return (
    <div className="min-h-screen bg-background grain-texture">

      {/* ── Sticky nav ── */}
      <header className="sticky top-0 z-40 border-b border-border bg-card/90 backdrop-blur-sm shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <ShieldCheck className="w-6 h-6 text-primary" />
            <span className="font-display text-lg text-foreground hidden sm:block">BITS Gatepass</span>
          </div>
          <div className="flex items-center gap-4">
            {user && (
              <div className="text-right hidden sm:block">
                <p className="text-sm font-medium text-foreground">{user.full_name}</p>
                <p className="text-xs text-muted-foreground">{roleLabel(user.role)}</p>
              </div>
            )}
            <Button variant="ghost" size="icon" onClick={handleLogout} title="Sign out">
              <LogOut className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </header>

      {/* ── Hero band ── extends low so content can overlap */}
      <div className="relative bg-gradient-to-br from-slate-800 to-slate-900 text-white px-4 pt-10 pb-16 overflow-hidden">
        <div aria-hidden className="pointer-events-none absolute -top-20 -right-20 w-64 h-64 rounded-full bg-amber-400/6 blur-3xl" />
        <div className="relative max-w-7xl mx-auto">
          <h1 className="text-3xl sm:text-4xl font-display">{title}</h1>
          {subtitle && <p className="mt-2 text-slate-400 text-sm">{subtitle}</p>}
        </div>
      </div>

      {/* ── Content overlaps the bottom of the hero ── */}
      <main className="relative z-10 -mt-8 bg-background rounded-t-2xl pt-8 max-w-full">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 pb-12">
          {children}
        </div>
      </main>

    </div>
  );
}
