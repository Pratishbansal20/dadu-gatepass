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
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/toaster";
import { Plus, X, Car, FileText, Loader2 } from "lucide-react";

type Tab = "passes" | "conference" | "vehicles";

export default function FacultyDashboard() {
  const router = useRouter();
  const { user, accessToken, isLoggedIn } = useAuthStore();
  const { toast } = useToast();
  const [tab, setTab] = useState<Tab>("passes");

  const [passes, setPasses] = useState<Pass[]>([]);
  const [permanentPass, setPermanentPass] = useState<PermanentPass | null>(null);
  const [rfidTags, setRfidTags] = useState<RFIDTag[]>([]);
  const [loading, setLoading] = useState(true);
  const [showConfForm, setShowConfForm] = useState(false);
  const [showRfidForm, setShowRfidForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [confForm, setConfForm] = useState({
    participant_name: "",
    participant_email: "",
    participant_phone: "",
    conference_name: "",
    valid_from: "",
    valid_until: "",
  });
  const [rfidForm, setRfidForm] = useState({
    tag_number: "",
    vehicle_number: "",
    vehicle_model: "",
  });

  useEffect(() => {
    if (!isLoggedIn || user?.role !== "FACULTY") {
      router.replace("/login");
      return;
    }
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

  const rfidStatusVariant = (s: string) =>
    ({ PENDING: "pending", ACTIVE: "approved", REVOKED: "rejected" } as Record<string, any>)[s] ?? "default";

  return (
    <DashboardLayout title="Faculty Dashboard" subtitle="Manage passes and vehicle access">
      <div className="space-y-8">
        {/* Permanent Pass */}
        {permanentPass && <PermanentPassCard pass={permanentPass} />}

        {/* Tab nav */}
        <div className="flex gap-2 border-b border-border pb-0">
          {(["passes", "conference", "vehicles"] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-2 text-sm font-medium capitalize border-b-2 transition-colors ${
                tab === t
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              {t === "conference" ? "Conference Passes" : t === "vehicles" ? "Vehicle / RFID" : "My Passes"}
            </button>
          ))}
        </div>

        {/* Tab: My Passes */}
        {tab === "passes" && (
          <div>
            {loading ? (
              <div className="space-y-3">{[1, 2].map((i) => <div key={i} className="h-36 skeleton rounded-xl" />)}</div>
            ) : passes.length === 0 ? (
              <p className="text-muted-foreground text-sm">No passes yet.</p>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2">{passes.map((p) => <PassCard key={p.id} pass={p} />)}</div>
            )}
          </div>
        )}

        {/* Tab: Conference */}
        {tab === "conference" && (
          <div>
            <div className="flex justify-end mb-4">
              <Button size="sm" variant="amber" onClick={() => setShowConfForm((v) => !v)}>
                {showConfForm ? <X className="w-4 h-4 mr-1" /> : <Plus className="w-4 h-4 mr-1" />}
                {showConfForm ? "Cancel" : "New Conference Pass"}
              </Button>
            </div>
            {showConfForm && (
              <form onSubmit={handleConferenceSubmit} className="bg-card border border-border rounded-xl p-6 mb-6 space-y-4 animate-fade-in">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5"><Label>Participant Name</Label><Input required value={confForm.participant_name} onChange={(e) => setConfForm((f) => ({ ...f, participant_name: e.target.value }))} /></div>
                  <div className="space-y-1.5"><Label>Participant Email</Label><Input required type="email" value={confForm.participant_email} onChange={(e) => setConfForm((f) => ({ ...f, participant_email: e.target.value }))} /></div>
                  <div className="space-y-1.5"><Label>Participant Phone</Label><Input required type="tel" pattern="[0-9]{10}" maxLength={10} value={confForm.participant_phone} onChange={(e) => setConfForm((f) => ({ ...f, participant_phone: e.target.value }))} placeholder="10-digit number" /></div>
                  <div className="space-y-1.5"><Label>Conference Name</Label><Input required value={confForm.conference_name} onChange={(e) => setConfForm((f) => ({ ...f, conference_name: e.target.value }))} /></div>
                  <div className="space-y-1.5"><Label>Valid From</Label><Input required type="date" value={confForm.valid_from} onChange={(e) => setConfForm((f) => ({ ...f, valid_from: e.target.value }))} /></div>
                  <div className="space-y-1.5"><Label>Valid Until</Label><Input required type="date" value={confForm.valid_until} onChange={(e) => setConfForm((f) => ({ ...f, valid_until: e.target.value }))} /></div>
                </div>
                <Button type="submit" variant="amber" disabled={submitting}>
                  {submitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  Submit
                </Button>
              </form>
            )}
            <div className="grid gap-4 sm:grid-cols-2">
              {passes.filter((p) => p.pass_type === "CONFERENCE_PARTICIPANT").map((p) => <PassCard key={p.id} pass={p} />)}
            </div>
          </div>
        )}

        {/* Tab: Vehicles */}
        {tab === "vehicles" && (
          <div>
            <div className="flex justify-end mb-4">
              <Button size="sm" variant="amber" onClick={() => setShowRfidForm((v) => !v)}>
                {showRfidForm ? <X className="w-4 h-4 mr-1" /> : <Car className="w-4 h-4 mr-1" />}
                {showRfidForm ? "Cancel" : "Register Vehicle"}
              </Button>
            </div>
            {showRfidForm && (
              <form onSubmit={handleRfidSubmit} className="bg-card border border-border rounded-xl p-6 mb-6 space-y-4 animate-fade-in">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="space-y-1.5"><Label>RFID Tag Number</Label><Input required value={rfidForm.tag_number} onChange={(e) => setRfidForm((f) => ({ ...f, tag_number: e.target.value }))} placeholder="TAG-001" /></div>
                  <div className="space-y-1.5"><Label>Vehicle Number</Label><Input required value={rfidForm.vehicle_number} onChange={(e) => setRfidForm((f) => ({ ...f, vehicle_number: e.target.value }))} placeholder="RJ14AB1234" /></div>
                  <div className="space-y-1.5"><Label>Vehicle Model</Label><Input required value={rfidForm.vehicle_model} onChange={(e) => setRfidForm((f) => ({ ...f, vehicle_model: e.target.value }))} placeholder="Honda City" /></div>
                </div>
                <Button type="submit" variant="amber" disabled={submitting}>
                  {submitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  Submit Application
                </Button>
              </form>
            )}
            <div className="space-y-3">
              {rfidTags.map((tag) => (
                <div key={tag.id} className="bg-card border border-border rounded-xl p-4 flex items-center justify-between">
                  <div>
                    <p className="font-mono text-sm text-foreground">{tag.tag_number}</p>
                    <p className="text-sm text-muted-foreground">{tag.vehicle_model} · {tag.vehicle_number}</p>
                  </div>
                  <Badge variant={rfidStatusVariant(tag.status)}>{tag.status}</Badge>
                </div>
              ))}
              {rfidTags.length === 0 && !loading && (
                <p className="text-muted-foreground text-sm">No RFID tags registered.</p>
              )}
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
