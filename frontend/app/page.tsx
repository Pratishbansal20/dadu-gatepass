"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/lib/auth-store";

export default function HomePage() {
  const router = useRouter();
  const { user, isLoggedIn } = useAuthStore();

  useEffect(() => {
    if (!isLoggedIn) {
      router.replace("/login");
      return;
    }
    const roleRoutes: Record<string, string> = {
      STUDENT: "/dashboard/student",
      FACULTY: "/dashboard/faculty",
      HOSTEL_SUPERINTENDENT: "/dashboard/superintendent",
      CONFERENCE_SUPERVISOR: "/dashboard/superintendent",
      GATE_SECURITY: "/dashboard/gate",
      SUPER_ADMIN: "/dashboard/admin",
    };
    const dest = roleRoutes[user!.role] ?? "/login";
    router.replace(dest);
  }, [isLoggedIn, user, router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
    </div>
  );
}
