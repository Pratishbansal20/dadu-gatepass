"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/lib/auth-store";
import { adminApi, vehiclesApi, passesApi, type User, type AuditLog, type RFIDTag, type Pass, ApiError } from "@/lib/api";
import { DashboardLayout } from "@/components/DashboardLayout";
import { PassCard } from "@/components/passes/PassCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/toaster";
import { cn, formatDateTime, roleLabel } from "@/lib/utils";
import {
  Users, ClipboardList, Car, Loader2, RefreshCw,
  CheckCircle2, XCircle, UserPlus, Wifi, FileText, Inbox,
} from "lucide-react";

type Tab = "users" | "audit" | "rfid" | "passes";

const TABS: { id: Tab; label: string; Icon: React.ElementType }[] = [
  { id: "users",  label: "Users",          Icon: Users        },
  { id: "audit",  label: "Audit Log",      Icon: ClipboardList },
  { id: "rfid",   label: "RFID Tags",      Icon: Wifi         },
  { id: "passes", label: "Pending Passes", Icon: FileText     },
];

const ROLES = [
  "STUDENT", "FACULTY", "HOSTEL_SUPERINTENDENT",
  "CONFERENCE_SUPERVISOR", "GATE_SECURITY", "SUPER_ADMIN",
];

// ── Shared dot+pill badge ─────────────────────────────────────────────────────
function DotBadge({
  active, trueLabel = "Active", falseLabel = "Inactive",
}: { active: boolean; trueLabel?: string; falseLabel?: string }) {
  return (
    <span className={cn(
      "inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full border",
      "text-[10px] font-mono font-semibold uppercase tracking-wide",
      active
        ? "bg-emerald-50 text-emerald-700 border-emerald-200"
        : "bg-slate-50 text-slate-500 border-slate-200",
    )}>
      <span className={cn("w-1.5 h-1.5 rounded-full shrink-0", active ? "bg-emerald-400" : "bg-slate-400")} />
      {active ? trueLabel : falseLabel}
    </span>
  );
}

function RFIDStatusBadge({ status }: { status: string }) {
  const cfg = {
    PENDING: { dot: "bg-amber-400",  pill: "bg-amber-50  text-amber-700  border-amber-200",  label: "Pending" },
    ACTIVE:  { dot: "bg-emerald-400",pill: "bg-emerald-50 text-emerald-700 border-emerald-200",label: "Active"  },
    REVOKED: { dot: "bg-red-400",    pill: "bg-red-50    text-red-700    border-red-200",    label: "Revoked" },
  }[status] ?? { dot: "bg-slate-400", pill: "bg-slate-50 text-slate-500 border-slate-200", label: status };

  return (
    <span className={cn(
      "inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full border",
      "text-[10px] font-mono font-semibold uppercase tracking-wide",
      cfg.pill,
    )}>
      <span className={cn("w-1.5 h-1.5 rounded-full shrink-0", cfg.dot)} />
      {cfg.label}
    </span>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function AdminDashboard() {
  const router = useRouter();
  const { user: me, accessToken, isLoggedIn } = useAuthStore();
  const { toast } = useToast();
  const [tab, setTab] = useState<Tab>("users");

  const [users,        setUsers]        = useState<User[]>([]);
  const [auditLogs,    setAuditLogs]    = useState<AuditLog[]>([]);
  const [rfidTags,     setRfidTags]     = useState<RFIDTag[]>([]);
  const [pendingPasses,setPendingPasses]= useState<Pass[]>([]);
  const [loading,      setLoading]      = useState(false);
  const [acting,       setActing]       = useState<number | null>(null);
  const [showCreateUser,setShowCreateUser]=useState(false);
  const [submitting,   setSubmitting]   = useState(false);

  const [newUser, setNewUser] = useState({
    email: "", password: "", full_name: "", phone: "", role: "STUDENT", campus_id: "",
  });

  useEffect(() => {
    if (!isLoggedIn || me?.role !== "SUPER_ADMIN") { router.replace("/login"); return; }
    loadTab("users");
  }, [isLoggedIn]);

  async function loadTab(t: Tab) {
    if (!accessToken) return;
    setLoading(true);
    try {
      if (t === "users")  setUsers(await adminApi.users(accessToken));
      else if (t === "audit") setAuditLogs(await adminApi.auditLogs(accessToken, { limit: 200 }));
      else if (t === "rfid")  setRfidTags(await vehiclesApi.allTags(accessToken));
      else if (t === "passes") {
        const [v, c] = await Promise.all([
          passesApi.pendingVisitor(accessToken),
          passesApi.pendingConference(accessToken),
        ]);
        setPendingPasses([...v, ...c]);
      }
    } catch {
      toast({ title: "Load failed", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  function switchTab(t: Tab) { setTab(t); loadTab(t); }

  async function handleCreateUser(e: React.FormEvent) {
    e.preventDefault();
    if (!accessToken) return;
    setSubmitting(true);
    try {
      await adminApi.createUser(accessToken, newUser);
      toast({ title: "User created" });
      setShowCreateUser(false);
      setNewUser({ email: "", password: "", full_name: "", phone: "", role: "STUDENT", campus_id: "" });
      loadTab("users");
    } catch (err) {
      toast({ title: "Failed", description: err instanceof ApiError ? err.message : "Error", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  }

  async function handleRfidApprove(tagId: number) {
    if (!accessToken) return;
    setActing(tagId);
    try {
      await vehiclesApi.approveTag(accessToken, tagId);
      toast({ title: "RFID tag activated" });
      loadTab("rfid");
    } catch (err) {
      toast({ title: "Failed", description: err instanceof ApiError ? err.message : "Error", variant: "destructive" });
    } finally {
      setActing(null);
    }
  }

  async function handlePassApprove(passId: number, approved: boolean) {
    if (!accessToken) return;
    setActing(passId);
    try {
      await passesApi.approve(accessToken, passId, approved);
      toast({ title: approved ? "Pass approved" : "Pass rejected" });
      setPendingPasses((prev) => prev.filter((p) => p.id !== passId));
    } catch (err) {
      toast({ title: "Failed", description: err instanceof ApiError ? err.message : "Error", variant: "destructive" });
    } finally {
      setActing(null);
    }
  }

  return (
    <DashboardLayout title="Admin Dashboard" subtitle="System-wide management and audit">
      <div className="space-y-6">

        {/* ── Tab nav ── */}
        <div className="flex gap-1 bg-muted rounded-lg p-1 border border-border">
          {TABS.map(({ id, label, Icon }) => (
            <button
              key={id}
              onClick={() => switchTab(id)}
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

        {/* ════════════════════════════════════════════════════════════ USERS */}
        {tab === "users" && (
          <div className="space-y-4 animate-fade-in">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-display">All Users</h2>
              <Button size="sm" variant="amber" onClick={() => setShowCreateUser((v) => !v)}>
                {showCreateUser
                  ? <><XCircle className="w-4 h-4 mr-1.5" />Cancel</>
                  : <><UserPlus className="w-4 h-4 mr-1.5" />Add User</>
                }
              </Button>
            </div>

            {/* Create-user form */}
            {showCreateUser && (
              <form onSubmit={handleCreateUser}
                className="bg-card border border-border rounded-xl p-6 space-y-4 animate-fade-in shadow-sm">
                <h3 className="font-display text-base text-foreground">New User</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5"><Label>Full Name</Label>
                    <Input required value={newUser.full_name} onChange={(e) => setNewUser((u) => ({ ...u, full_name: e.target.value }))} />
                  </div>
                  <div className="space-y-1.5"><Label>Email</Label>
                    <Input required type="email" value={newUser.email} onChange={(e) => setNewUser((u) => ({ ...u, email: e.target.value }))} />
                  </div>
                  <div className="space-y-1.5"><Label>Password</Label>
                    <Input required type="password" value={newUser.password} onChange={(e) => setNewUser((u) => ({ ...u, password: e.target.value }))} />
                  </div>
                  <div className="space-y-1.5"><Label>Phone</Label>
                    <Input required value={newUser.phone} onChange={(e) => setNewUser((u) => ({ ...u, phone: e.target.value }))} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Role</Label>
                    <select
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                      value={newUser.role}
                      onChange={(e) => setNewUser((u) => ({ ...u, role: e.target.value }))}
                    >
                      {ROLES.map((r) => <option key={r} value={r}>{roleLabel(r)}</option>)}
                    </select>
                  </div>
                  <div className="space-y-1.5"><Label>Campus ID</Label>
                    <Input value={newUser.campus_id} onChange={(e) => setNewUser((u) => ({ ...u, campus_id: e.target.value }))} placeholder="Optional" />
                  </div>
                </div>
                <Button type="submit" variant="amber" disabled={submitting}>
                  {submitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  Create User
                </Button>
              </form>
            )}

            {/* Users table */}
            {loading ? (
              <div className="space-y-2">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className="h-12 skeleton rounded-lg" style={{ opacity: 1 - i * 0.12 }} />
                ))}
              </div>
            ) : users.length === 0 ? (
              <EmptyState icon={<Users />} message="No users found." />
            ) : (
              <div className="rounded-xl border border-border shadow-sm overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-muted/60 border-b border-border">
                    <tr>
                      {["Name", "Email", "Role", "Campus ID", "Status"].map((h) => (
                        <th key={h} className="text-left px-4 py-3 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((u, i) => (
                      <tr key={u.id} className={cn(
                        "border-b border-border last:border-0 transition-colors hover:bg-muted/40",
                        i % 2 === 1 && "bg-muted/20",
                      )}>
                        <td className="px-4 py-3 font-medium text-foreground">{u.full_name}</td>
                        <td className="px-4 py-3 text-muted-foreground font-mono text-xs">{u.email}</td>
                        <td className="px-4 py-3">
                          <span className="text-xs font-medium text-muted-foreground">{roleLabel(u.role)}</span>
                        </td>
                        <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{u.campus_id}</td>
                        <td className="px-4 py-3">
                          <DotBadge active={u.is_active} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ════════════════════════════════════════════════════════ AUDIT LOG */}
        {tab === "audit" && (
          <div className="space-y-4 animate-fade-in">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-display">Audit Log</h2>
              <button
                onClick={() => loadTab("audit")}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-border text-xs text-muted-foreground hover:bg-muted transition-colors"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Refresh
              </button>
            </div>

            {loading ? (
              <div className="space-y-2">
                {[...Array(6)].map((_, i) => (
                  <div key={i} className="h-10 skeleton rounded-lg" style={{ opacity: 1 - i * 0.1 }} />
                ))}
              </div>
            ) : auditLogs.length === 0 ? (
              <EmptyState icon={<ClipboardList />} message="No audit entries yet." />
            ) : (
              <div className="rounded-xl border border-border shadow-sm overflow-hidden">
                {/* Sticky header + scrollable body */}
                <div className="max-h-[600px] overflow-y-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/60 border-b border-border sticky top-0 z-10">
                      <tr>
                        {["Time", "Action", "Type", "ID", "Metadata"].map((h) => (
                          <th key={h} className="text-left px-4 py-3 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider whitespace-nowrap">
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {auditLogs.map((log, i) => (
                        <tr key={log.id} className={cn(
                          "border-b border-border last:border-0 transition-colors hover:bg-muted/40",
                          i % 2 === 1 && "bg-muted/20",
                        )}>
                          <td className="px-4 py-2.5 text-xs text-muted-foreground font-mono whitespace-nowrap">
                            {formatDateTime(log.timestamp)}
                          </td>
                          <td className="px-4 py-2.5">
                            <span className="font-mono text-xs font-semibold text-foreground bg-muted px-1.5 py-0.5 rounded">
                              {log.action}
                            </span>
                          </td>
                          <td className="px-4 py-2.5 text-xs text-muted-foreground">{log.entity_type}</td>
                          <td className="px-4 py-2.5 text-xs font-mono text-muted-foreground">{log.entity_id}</td>
                          <td className="px-4 py-2.5 text-xs text-muted-foreground truncate max-w-[200px]">
                            {log.metadata_json}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="px-4 py-2 border-t border-border bg-muted/30">
                  <p className="text-[11px] text-muted-foreground font-mono">{auditLogs.length} entries</p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ════════════════════════════════════════════════════════ RFID TAGS */}
        {tab === "rfid" && (
          <div className="space-y-4 animate-fade-in">
            <h2 className="text-xl font-display">RFID Tag Applications</h2>
            {loading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => <div key={i} className="h-16 skeleton rounded-xl" />)}
              </div>
            ) : rfidTags.length === 0 ? (
              <EmptyState icon={<Wifi />} message="No RFID tag applications." />
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
                    <div className="flex items-center gap-3 shrink-0">
                      <RFIDStatusBadge status={tag.status} />
                      {tag.status === "PENDING" && (
                        <Button size="sm" variant="amber" disabled={acting === tag.id} onClick={() => handleRfidApprove(tag.id)}>
                          {acting === tag.id ? <Loader2 className="w-4 h-4 animate-spin" /> : "Activate"}
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ═══════════════════════════════════════════════════ PENDING PASSES */}
        {tab === "passes" && (
          <div className="space-y-4 animate-fade-in">
            <h2 className="text-xl font-display">All Pending Passes</h2>
            {loading ? (
              <div className="space-y-3">
                {[1, 2].map((i) => <div key={i} className="h-44 skeleton rounded-xl" />)}
              </div>
            ) : pendingPasses.length === 0 ? (
              <EmptyState icon={<FileText />} message="No pending passes. All caught up." />
            ) : (
              <div className="grid gap-4 sm:grid-cols-2">
                {pendingPasses.map((pass) => (
                  <PassCard
                    key={pass.id}
                    pass={pass}
                    actions={
                      <div className="flex gap-2">
                        <Button size="sm" variant="amber" className="flex-1"
                          disabled={acting === pass.id} onClick={() => handlePassApprove(pass.id, true)}>
                          {acting === pass.id
                            ? <Loader2 className="w-4 h-4 animate-spin" />
                            : <><CheckCircle2 className="w-4 h-4 mr-1" />Approve</>
                          }
                        </Button>
                        <Button size="sm" variant="outline" className="flex-1 border-red-200 text-red-700 hover:bg-red-50"
                          disabled={acting === pass.id} onClick={() => handlePassApprove(pass.id, false)}>
                          <XCircle className="w-4 h-4 mr-1" />Reject
                        </Button>
                      </div>
                    }
                  />
                ))}
              </div>
            )}
          </div>
        )}

      </div>
    </DashboardLayout>
  );
}

// ── Shared empty state ────────────────────────────────────────────────────────
function EmptyState({ icon, message }: { icon: React.ReactNode; message: string }) {
  return (
    <div className="rounded-xl border border-dashed border-border py-14 flex flex-col items-center gap-3 text-center">
      <span className="[&>svg]:w-9 [&>svg]:h-9 text-muted-foreground/30">{icon}</span>
      <p className="text-sm text-muted-foreground">{message}</p>
    </div>
  );
}
