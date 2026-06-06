"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/lib/auth-store";
import { passesApi, vehiclesApi, type Pass, type RFIDTag, type PermanentPass, ApiError } from "@/lib/api";
import { DashboardLayout } from "@/components/DashboardLayout";
import { PassCard } from "@/components/passes/PassCard";
import { PermanentPassCard } from "@/components/passes/PermanentPassCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/toaster";
import { PassCardSkeleton } from "@/components/passes/PassCardSkeleton";
import { cn } from "@/lib/utils";
import { Plus, X, Car, FileText, Loader2, QrCode } from "lucide-react";

type Tab = "passes" | "conference" | "vehicles";

// Dot+pill badge consistent with PassCard / admin
function RFIDStatusBadge({ status }: { status: string }) {
  const cfg = {
    PENDING: { dot: "bg-amber-400",   pill: "bg-amber-50  text-amber-700  border-amber-200",   label: "Pending" },
    ACTIVE:  { dot: "bg-emerald-400", pill: "bg-emerald-50 text-emerald-700 border-emerald-200", label: "Active"  },
    REVOKED: { dot: "bg-red-400",     pill: "bg-red-50    text-red-700    border-red-200",     label: "Revoked" },
  }[status] ?? { dot: "bg-slate-400", pill: "bg-slate-50 text-slate-500 border-slate-200", label: status };

  return (
    <span className={cn(
      "inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full border",
      "text-[10px] font-mono font-semibold uppercase tracking-wide shrink-0",
      cfg.pill,
    )}>
      <span className={cn("w-1.5 h-1.5 rounded-full", cfg.dot)} />
      {cfg.label}
    </span>
  );
}

function EmptyState({ icon, message }: { icon: React.ReactNode; message: string }) {
  return (
    <div className="rounded-xl border border-dashed border-border py-14 flex flex-col items-center gap-3 text-center">
      <span className="[&>svg]:w-9 [&>svg]:h-9 text-muted-foreground/30">{icon}</span>
      <p className="text-sm text-muted-foreground">{message}</p>
    </div>
  );
}

export default function FacultyDashboard() {
  const router = useRouter();
  const { user, accessToken, isLoggedIn } = useAuthStore();
  const { toast } = useToast();
  const [tab, setTab] = useState<Tab>("passes");

  const [passes,        setPasses]        = useState<Pass[]>([]);
  const [permanentPass, setPermanentPass] = useState<PermanentPass | null>(null);
  const [rfidTags,      setRfidTags]      = useState<RFIDTag[]>([]);
  const [loading,       setLoading]       = useState(true);
  const [showConfForm,  setShowConfForm]  = useState(false);
  const [showRfidForm,  setShowRfidForm]  = useState(false);
  const [submitting,    setSubmitting]    = useState(false);

  const [confForm, setConfForm] = useState({
    participant_name: "", participant_email: "", participant_phone: "",
    conference_name: "", valid_from: "", valid_until: "",
  });
  const [rfidForm, setRfidForm] = useState({
    tag_number: "", vehicle_number: "", vehicle_model: "",
  });

  useEffect(() => {
    if (!isLoggedIn || user?.role !== "FACULTY") { router.replace("/login"); return; }
    loadData();
  }, [isLoggedIn]);

  async function loadData() {
    if (!accessToken) return;
    try {
      const [myPasses, permPass, tags] = await Promise.all([
        passesApi.myPasses(accessToken),
        passesApi.permanentPass(accessToken),
        vehiclesApi.myTags(accessToken),
      ]);
      setPasses(myPasses.filter((p) => p.pass_type !== "PERMANENT_RESIDENT"));
      setPermanentPass(permPass);
      setRfidTags(tags);
    } catch {
      toast({ title: "Failed to load data", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  async function handleConferenceSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!accessToken) return;
    setSubmitting(true);
    try {
      await passesApi.applyConference(accessToken, confForm);
      toast({ title: "Conference pass submitted", description: "Awaiting supervisor approval" });
      setShowConfForm(false);
      loadData();
    } catch (err) {
      toast({ title: "Failed", description: err instanceof ApiError ? err.message : "Error", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  }

  async function handleRfidSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!accessToken) return;
    setSubmitting(true);
    try {
      await vehiclesApi.submitRfid(accessToken, rfidForm);
      toast({ title: "RFID application submitted", description: "Awaiting admin activation" });
      setShowRfidForm(false);
      loadData();
    } catch (err) {
      toast({ title: "Failed", description: err instanceof ApiError ? err.message : "Error", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  }

  const conferencePasses = passes.filter((p) => p.pass_type === "CONFERENCE_PARTICIPANT");

  return (
    <DashboardLayout title="Faculty Dashboard" subtitle="Manage passes and vehicle access">
      <div className="space-y-8">

        {/* Permanent Pass */}
        {permanentPass && <PermanentPassCard pass={permanentPass} />}

        {/* ── Pill tab nav ── */}
        <div className="flex gap-1 bg-muted rounded-lg p-1 border border-border">
          {(
            [
              { id: "passes",     label: "My Passes",       Icon: QrCode    },
              { id: "conference", label: "Conference",       Icon: FileText  },
              { id: "vehicles",   label: "Vehicle / RFID",  Icon: Car       },
            ] as { id: Tab; label: string; Icon: React.ElementType }[]
          ).map(({ id, label, Icon }) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={cn(
                "flex items-center gap-2 flex-1 justify-center px-3 py-2 rounded-md text-sm font-medium transition-all",
                tab === id
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <Icon className="w-4 h-4 shrink-0" />
              <span className="hidden sm:inline">{label}</span>
            </button>
          ))}
        </div>

        {/* ── My Passes ── */}
        {tab === "passes" && (
          <div className="animate-fade-in">
            {loading ? (
              <div className="space-y-3">
                {[1, 2].map((i) => <PassCardSkeleton key={i} />)}
              </div>
            ) : passes.length === 0 ? (
              <EmptyState icon={<QrCode />} message="No passes yet." />
            ) : (
              <div className="grid gap-4 sm:grid-cols-2">
                {passes.map((p) => <PassCard key={p.id} pass={p} />)}
              </div>
            )}
          </div>
        )}

        {/* ── Conference Passes ── */}
        {tab === "conference" && (
          <div className="space-y-4 animate-fade-in">
            <div className="flex justify-end">
              <Button size="sm" variant="amber" onClick={() => setShowConfForm((v) => !v)}>
                {showConfForm ? <><X className="w-4 h-4 mr-1" />Cancel</> : <><Plus className="w-4 h-4 mr-1" />New Conference Pass</>}
              </Button>
            </div>

            {showConfForm && (
              <form onSubmit={handleConferenceSubmit}
                className="bg-card border border-border rounded-xl p-6 mb-2 space-y-4 shadow-sm animate-fade-in">
                <h3 className="font-display text-base text-foreground">Conference Pass Application</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5"><Label>Participant Name</Label>
                    <Input required value={confForm.participant_name} onChange={(e) => setConfForm((f) => ({ ...f, participant_name: e.target.value }))} />
                  </div>
                  <div className="space-y-1.5"><Label>Participant Email</Label>
                    <Input required type="email" value={confForm.participant_email} onChange={(e) => setConfForm((f) => ({ ...f, participant_email: e.target.value }))} />
                  </div>
                  <div className="space-y-1.5"><Label>Participant Phone</Label>
                    <Input required type="tel" pattern="[0-9]{10}" maxLength={10} value={confForm.participant_phone}
                      onChange={(e) => setConfForm((f) => ({ ...f, participant_phone: e.target.value }))} placeholder="10-digit number" />
                  </div>
                  <div className="space-y-1.5"><Label>Conference Name</Label>
                    <Input required value={confForm.conference_name} onChange={(e) => setConfForm((f) => ({ ...f, conference_name: e.target.value }))} />
                  </div>
                  <div className="space-y-1.5"><Label>Valid From</Label>
                    <Input required type="date" value={confForm.valid_from} onChange={(e) => setConfForm((f) => ({ ...f, valid_from: e.target.value }))} />
                  </div>
                  <div className="space-y-1.5"><Label>Valid Until</Label>
                    <Input required type="date" value={confForm.valid_until} onChange={(e) => setConfForm((f) => ({ ...f, valid_until: e.target.value }))} />
                  </div>
                </div>
                <Button type="submit" variant="amber" disabled={submitting}>
                  {submitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}Submit
                </Button>
              </form>
            )}

            {loading ? (
              <div className="grid gap-4 sm:grid-cols-2">
                {[1, 2].map((i) => <PassCardSkeleton key={i} />)}
              </div>
            ) : conferencePasses.length === 0 ? (
              <EmptyState icon={<FileText />} message="No conference passes yet." />
            ) : (
              <div className="grid gap-4 sm:grid-cols-2">
                {conferencePasses.map((p) => <PassCard key={p.id} pass={p} />)}
              </div>
            )}
          </div>
        )}

        {/* ── Vehicle / RFID ── */}
        {tab === "vehicles" && (
          <div className="space-y-4 animate-fade-in">
            <div className="flex justify-end">
              <Button size="sm" variant="amber" onClick={() => setShowRfidForm((v) => !v)}>
                {showRfidForm ? <><X className="w-4 h-4 mr-1" />Cancel</> : <><Car className="w-4 h-4 mr-1" />Register Vehicle</>}
              </Button>
            </div>

            {showRfidForm && (
              <form onSubmit={handleRfidSubmit}
                className="bg-card border border-border rounded-xl p-6 mb-2 space-y-4 shadow-sm animate-fade-in">
                <h3 className="font-display text-base text-foreground">Vehicle Registration</h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="space-y-1.5"><Label>RFID Tag Number</Label>
                    <Input required value={rfidForm.tag_number} onChange={(e) => setRfidForm((f) => ({ ...f, tag_number: e.target.value }))} placeholder="TAG-001" />
                  </div>
                  <div className="space-y-1.5"><Label>Vehicle Number</Label>
                    <Input required value={rfidForm.vehicle_number} onChange={(e) => setRfidForm((f) => ({ ...f, vehicle_number: e.target.value }))} placeholder="RJ14AB1234" />
                  </div>
                  <div className="space-y-1.5"><Label>Vehicle Model</Label>
                    <Input required value={rfidForm.vehicle_model} onChange={(e) => setRfidForm((f) => ({ ...f, vehicle_model: e.target.value }))} placeholder="Honda City" />
                  </div>
                </div>
                <Button type="submit" variant="amber" disabled={submitting}>
                  {submitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}Submit Application
                </Button>
              </form>
            )}

            {loading ? (
              <div className="space-y-3">
                {[1, 2].map((i) => <div key={i} className="h-16 skeleton rounded-xl" />)}
              </div>
            ) : rfidTags.length === 0 ? (
              <EmptyState icon={<Car />} message="No RFID tags registered." />
            ) : (
              <div className="space-y-2">
                {rfidTags.map((tag) => (
                  <div key={tag.id}
                    className="bg-card border border-border rounded-xl px-4 py-3.5 flex items-center justify-between gap-4 shadow-sm">
                    <div className="min-w-0">
                      <p className="font-mono text-sm font-semibold text-foreground">{tag.tag_number}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {tag.vehicle_model} · {tag.vehicle_number}
                      </p>
                    </div>
                    <RFIDStatusBadge status={tag.status} />
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

      </div>
    </DashboardLayout>
  );
}

