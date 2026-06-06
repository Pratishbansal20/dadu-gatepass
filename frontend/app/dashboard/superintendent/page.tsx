"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/lib/auth-store";
import { passesApi, type Pass, ApiError } from "@/lib/api";
import { DashboardLayout } from "@/components/DashboardLayout";
import { PassCard } from "@/components/passes/PassCard";
import { PassCardSkeleton } from "@/components/passes/PassCardSkeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/toaster";
import { CheckCircle2, XCircle, Loader2, Inbox } from "lucide-react";

export default function SuperintendentDashboard() {
  const router = useRouter();
  const { user, accessToken, isLoggedIn } = useAuthStore();
  const { toast } = useToast();

  const [pendingPasses, setPendingPasses] = useState<Pass[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [acting,   setActing]   = useState<number | null>(null);
  const [rejectReason, setRejectReason] = useState<Record<number, string>>({});

  const isConferenceSupervisor = user?.role === "CONFERENCE_SUPERVISOR";
  const title = isConferenceSupervisor ? "Conference Supervisor" : "Hostel Superintendent";

  useEffect(() => {
    const allowed = ["HOSTEL_SUPERINTENDENT", "CONFERENCE_SUPERVISOR", "SUPER_ADMIN"];
    if (!isLoggedIn || !allowed.includes(user?.role ?? "")) { router.replace("/login"); return; }
    loadPending();
  }, [isLoggedIn]);

  async function loadPending() {
    if (!accessToken) return;
    try {
      const passes = isConferenceSupervisor
        ? await passesApi.pendingConference(accessToken)
        : await passesApi.pendingVisitor(accessToken);
      setPendingPasses(passes);
    } catch {
      toast({ title: "Failed to load passes", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  async function handleDecision(passId: number, approved: boolean) {
    if (!accessToken) return;
    setActing(passId);
    try {
      await passesApi.approve(accessToken, passId, approved, rejectReason[passId]);
      toast({
        title: approved ? "Pass approved" : "Pass rejected",
        description: approved ? "OTP has been sent to the visitor." : undefined,
      });
      setPendingPasses((prev) => prev.filter((p) => p.id !== passId));
    } catch (err) {
      toast({
        title: "Action failed",
        description: err instanceof ApiError ? err.message : "Error",
        variant: "destructive",
      });
    } finally {
      setActing(null);
    }
  }

  return (
    <DashboardLayout
      title={`${title} Dashboard`}
      subtitle="Review and act on pending pass applications"
    >
      <div className="space-y-6">

        {/* Heading + count chip */}
        <div className="flex items-center gap-3">
          <h2 className="text-xl font-display">Pending Applications</h2>
          {!loading && pendingPasses.length > 0 && (
            <span className="px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800 text-xs font-semibold border border-amber-200">
              {pendingPasses.length}
            </span>
          )}
        </div>

        {loading ? (
          <div className="grid gap-5 sm:grid-cols-2">
            {[1, 2, 3].map((i) => <PassCardSkeleton key={i} />)}
          </div>
        ) : pendingPasses.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border py-16 text-center">
            <Inbox className="w-10 h-10 mx-auto mb-3 text-muted-foreground opacity-30" />
            <p className="text-muted-foreground text-sm">No pending applications. All clear.</p>
          </div>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2">
            {pendingPasses.map((pass) => (
              <PassCard
                key={pass.id}
                pass={pass}
                actions={
                  <div className="space-y-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs">Rejection reason (optional)</Label>
                      <Input
                        placeholder="Reason for rejection"
                        value={rejectReason[pass.id] ?? ""}
                        onChange={(e) => setRejectReason((r) => ({ ...r, [pass.id]: e.target.value }))}
                        className="text-xs h-8"
                      />
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" variant="amber" className="flex-1"
                        disabled={acting === pass.id} onClick={() => handleDecision(pass.id, true)}>
                        {acting === pass.id
                          ? <Loader2 className="w-4 h-4 animate-spin" />
                          : <><CheckCircle2 className="w-4 h-4 mr-1" />Approve</>
                        }
                      </Button>
                      <Button size="sm" variant="outline"
                        className="flex-1 border-red-200 text-red-700 hover:bg-red-50"
                        disabled={acting === pass.id} onClick={() => handleDecision(pass.id, false)}>
                        <XCircle className="w-4 h-4 mr-1" />Reject
                      </Button>
                    </div>
                  </div>
                }
              />
            ))}
          </div>
        )}

      </div>
    </DashboardLayout>
  );
}
