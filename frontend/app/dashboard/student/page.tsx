"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/lib/auth-store";
import { passesApi, authApi, type Pass, type PermanentPass, ApiError } from "@/lib/api";
import { DashboardLayout } from "@/components/DashboardLayout";
import { PassCard } from "@/components/passes/PassCard";
import { PermanentPassCard } from "@/components/passes/PermanentPassCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/toaster";
import { Plus, X, QrCode, Loader2 } from "lucide-react";

export default function StudentDashboard() {
  const router = useRouter();
  const { user, accessToken, isLoggedIn } = useAuthStore();
  const { toast } = useToast();

  const [passes, setPasses] = useState<Pass[]>([]);
  const [permanentPass, setPermanentPass] = useState<PermanentPass | null>(null);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [form, setForm] = useState({
    visitor_name: "",
    visitor_phone: "",
    purpose: "",
    visit_date: "",
    entry_time: "",
    exit_time: "",
  });

  useEffect(() => {
    if (!isLoggedIn || user?.role !== "STUDENT") {
      router.replace("/login");
      return;
    }
    loadData();
  }, [isLoggedIn]);

  async function loadData() {
    if (!accessToken) return;
    try {
      const [myPasses, permPass] = await Promise.all([
        passesApi.myPasses(accessToken),
        passesApi.permanentPass(accessToken),
      ]);
      setPasses(myPasses.filter((p) => p.pass_type !== "PERMANENT_RESIDENT"));
      setPermanentPass(permPass);
    } catch {
      toast({ title: "Failed to load passes", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!accessToken) return;
    setSubmitting(true);
    try {
      await passesApi.applyVisitor(accessToken, form);
      toast({ title: "Visitor pass submitted", description: "Awaiting superintendent approval" });
      setShowForm(false);
      setForm({ visitor_name: "", visitor_phone: "", purpose: "", visit_date: "", entry_time: "", exit_time: "" });
      loadData();
    } catch (err) {
      toast({
        title: "Submission failed",
        description: err instanceof ApiError ? err.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <DashboardLayout
      title="Student Dashboard"
      subtitle="Manage your campus passes and visitor requests"
    >
      <div className="grid gap-8">
        {/* Permanent Pass */}
        <section>
          <h2 className="text-xl font-display text-foreground mb-4">Your Resident Pass</h2>
          {permanentPass ? (
            <PermanentPassCard pass={permanentPass} />
          ) : (
            <div className="h-24 skeleton rounded-xl" />
          )}
        </section>

        {/* Visitor Passes */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-display text-foreground">Visitor Day Passes</h2>
            <Button
              size="sm"
              variant="amber"
              onClick={() => setShowForm((v) => !v)}
            >
              {showForm ? <X className="w-4 h-4 mr-1" /> : <Plus className="w-4 h-4 mr-1" />}
              {showForm ? "Cancel" : "New Request"}
            </Button>
          </div>

          {showForm && (
            <form
              onSubmit={handleSubmit}
              className="bg-card border border-border rounded-xl p-6 mb-6 space-y-4 animate-fade-in"
            >
              <h3 className="font-semibold text-foreground">Request Visitor Pass</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>Visitor Name</Label>
                  <Input required value={form.visitor_name} onChange={(e) => setForm((f) => ({ ...f, visitor_name: e.target.value }))} placeholder="Full name" />
                </div>
                <div className="space-y-1.5">
                  <Label>Visitor Phone</Label>
                  <Input required type="tel" pattern="[0-9]{10}" maxLength={10} value={form.visitor_phone} onChange={(e) => setForm((f) => ({ ...f, visitor_phone: e.target.value }))} placeholder="10-digit number" />
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label>Purpose of Visit</Label>
                  <Input required value={form.purpose} onChange={(e) => setForm((f) => ({ ...f, purpose: e.target.value }))} placeholder="Reason for visit" />
                </div>
                <div className="space-y-1.5">
                  <Label>Visit Date</Label>
                  <Input required type="date" value={form.visit_date} onChange={(e) => setForm((f) => ({ ...f, visit_date: e.target.value }))} />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1.5">
                    <Label>Entry Time</Label>
                    <Input required type="time" value={form.entry_time} onChange={(e) => setForm((f) => ({ ...f, entry_time: e.target.value }))} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Exit Time</Label>
                    <Input required type="time" value={form.exit_time} onChange={(e) => setForm((f) => ({ ...f, exit_time: e.target.value }))} />
                  </div>
                </div>
              </div>
              <Button type="submit" variant="amber" disabled={submitting}>
                {submitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Submit Request
              </Button>
            </form>
          )}

          {loading ? (
            <div className="space-y-4">
              {[1, 2].map((i) => (
                <div key={i} className="h-36 skeleton rounded-xl" />
              ))}
            </div>
          ) : passes.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border p-12 text-center text-muted-foreground">
              <QrCode className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p className="text-sm">No visitor passes yet. Request one above.</p>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {passes.map((p) => (
                <PassCard key={p.id} pass={p} />
              ))}
            </div>
          )}
        </section>
      </div>
    </DashboardLayout>
  );
}
