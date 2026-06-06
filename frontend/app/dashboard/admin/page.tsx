"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/lib/auth-store";
import { adminApi, vehiclesApi, passesApi, type User, type AuditLog, type RFIDTag, type Pass, ApiError } from "@/lib/api";
import { DashboardLayout } from "@/components/DashboardLayout";
import { PassCard } from "@/components/passes/PassCard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/toaster";
import { Users, ClipboardList, Car, Loader2, RefreshCw, CheckCircle2, XCircle } from "lucide-react";
import { formatDateTime, roleLabel } from "@/lib/utils";

type Tab = "users" | "audit" | "rfid" | "passes";

export default function AdminDashboard() {
  const router = useRouter();
  const { user: me, accessToken, isLoggedIn } = useAuthStore();
  const { toast } = useToast();
  const [tab, setTab] = useState<Tab>("users");

  const [users, setUsers] = useState<User[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [rfidTags, setRfidTags] = useState<RFIDTag[]>([]);
  const [pendingPasses, setPendingPasses] = useState<Pass[]>([]);
  const [loading, setLoading] = useState(false);
  const [acting, setActing] = useState<number | null>(null);
  const [showCreateUser, setShowCreateUser] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [newUser, setNewUser] = useState({
    email: "", password: "", full_name: "", phone: "", role: "STUDENT", campus_id: "",
  });

  useEffect(() => {
    if (!isLoggedIn || me?.role !== "SUPER_ADMIN") {
      router.replace("/login");
      return;
    }
    loadTab("users");
  }, [isLoggedIn]);

  async function loadTab(t: Tab) {
    if (!accessToken) return;
    setLoading(true);
    try {
      if (t === "users") setUsers(await adminApi.users(accessToken));
      else if (t === "audit") setAuditLogs(await adminApi.auditLogs(accessToken, { limit: 200 }));
      else if (t === "rfid") setRfidTags(await vehiclesApi.allTags(accessToken));
      else if (t === "passes") {
        const [visitor, conf] = await Promise.all([
          passesApi.pendingVisitor(accessToken),
          passesApi.pendingConference(accessToken),
        ]);
        setPendingPasses([...visitor, ...conf]);
      }
    } catch {
      toast({ title: "Load failed", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  function switchTab(t: Tab) {
    setTab(t);
    loadTab(t);
  }

  async function handleCreateUser(e: React.FormEvent) {
    e.preventDefault();
    if (!accessToken) return;
    setSubmitting(true);
    try {
      await adminApi.createUser(accessToken, newUser);
      toast({ title: "User created" });
      setShowCreateUser(false);
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

  const ROLES = ["STUDENT", "FACULTY", "HOSTEL_SUPERINTENDENT", "CONFERENCE_SUPERVISOR", "GATE_SECURITY", "SUPER_ADMIN"];

  return (
    <DashboardLayout title="Admin Dashboard" subtitle="System-wide management and audit">
      <div className="space-y-6">
        {/* Tab nav */}
        <div className="flex gap-1 bg-muted rounded-lg p-1">
          {(
            [
              { id: "users", label: "Users", Icon: Users },
              { id: "audit", label: "Audit Log", Icon: ClipboardList },
              { id: "rfid", label: "RFID Tags", Icon: Car },
              { id: "passes", label: "Pending Passes", Icon: CheckCircle2 },
            ] as { id: Tab; label: string; Icon: React.ElementType }[]
          ).map(({ id, label, Icon }) => (
            <button
              key={id}
              onClick={() => switchTab(id)}
              className={`flex items-center gap-2 flex-1 justify-center px-3 py-2 rounded-md text-sm font-medium transition-all ${
                tab === id ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Icon className="w-4 h-4" />
              <span className="hidden sm:inline">{label}</span>
            </button>
          ))}
        </div>

        {/* Users */}
        {tab === "users" && (
          <div className="space-y-4 animate-fade-in">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-display">All Users</h2>
              <Button size="sm" variant="amber" onClick={() => setShowCreateUser((v) => !v)}>
                {showCreateUser ? "Cancel" : "Add User"}
              </Button>
            </div>
            {showCreateUser && (
              <form onSubmit={handleCreateUser} className="bg-card border border-border rounded-xl p-6 space-y-4 animate-fade-in">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5"><Label>Full Name</Label><Input required value={newUser.full_name} onChange={(e) => setNewUser((u) => ({ ...u, full_name: e.target.value }))} /></div>
                  <div className="space-y-1.5"><Label>Email</Label><Input required type="email" value={newUser.email} onChange={(e) => setNewUser((u) => ({ ...u, email: e.target.value }))} /></div>
                  <div className="space-y-1.5"><Label>Password</Label><Input required type="password" value={newUser.password} onChange={(e) => setNewUser((u) => ({ ...u, password: e.target.value }))} /></div>
                  <div className="space-y-1.5"><Label>Phone</Label><Input required value={newUser.phone} onChange={(e) => setNewUser((u) => ({ ...u, phone: e.target.value }))} /></div>
                  <div className="space-y-1.5">
                    <Label>Role</Label>
                    <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={newUser.role} onChange={(e) => setNewUser((u) => ({ ...u, role: e.target.value }))}>
                      {ROLES.map((r) => <option key={r} value={r}>{roleLabel(r)}</option>)}
                    </select>
                  </div>
                  <div className="space-y-1.5"><Label>Campus ID</Label><Input value={newUser.campus_id} onChange={(e) => setNewUser((u) => ({ ...u, campus_id: e.target.value }))} /></div>
                </div>
                <Button type="submit" variant="amber" disabled={submitting}>
                  {submitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  Create User
                </Button>
              </form>
            )}
            {loading ? (
              <div className="space-y-2">{[1,2,3,4].map((i) => <div key={i} className="h-14 skeleton rounded-lg" />)}</div>
            ) : (
              <div className="rounded-xl border border-border overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50">
                    <tr>
                      {["Name", "Email", "Role", "Campus ID", "Status"].map((h) => (
                        <th key={h} className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wide">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {users.map((u) => (
                      <tr key={u.id} className="hover:bg-muted/30">
                        <td className="px-4 py-3 font-medium">{u.full_name}</td>
                        <td className="px-4 py-3 text-muted-foreground font-mono text-xs">{u.email}</td>
                        <td className="px-4 py-3"><Badge variant="outline" className="text-xs">{roleLabel(u.role)}</Badge></td>
                        <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{u.campus_id ?? "—"}</td>
                        <td className="px-4 py-3"><Badge variant={u.is_active ? "approved" : "rejected"} className="text-xs">{u.is_active ? "Active" : "Inactive"}</Badge></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Audit Log */}
        {tab === "audit" && (
          <div className="space-y-4 animate-fade-in">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-display">Audit Log</h2>
              <Button size="sm" variant="outline" onClick={() => loadTab("audit")}>
                <RefreshCw className="w-4 h-4 mr-2" />
                Refresh
              </Button>
            </div>
            {loading ? (
              <div className="space-y-2">{[...Array(6)].map((_, i) => <div key={i} className="h-12 skeleton rounded-lg" />)}</div>
            ) : (
              <div className="rounded-xl border border-border overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50">
                    <tr>
                      {["Time", "Action", "Entity", "Entity ID", "Metadata"].map((h) => (
                        <th key={h} className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wide">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {auditLogs.map((log) => (
                      <tr key={log.id} className="hover:bg-muted/30">
                        <td className="px-4 py-2.5 text-xs text-muted-foreground font-mono whitespace-nowrap">{formatDateTime(log.timestamp)}</td>
                        <td className="px-4 py-2.5 font-mono text-xs font-medium">{log.action}</td>
                        <td className="px-4 py-2.5 text-xs text-muted-foreground">{log.entity_type}</td>
                        <td className="px-4 py-2.5 text-xs font-mono text-muted-foreground">{log.entity_id ?? "—"}</td>
                        <td className="px-4 py-2.5 text-xs text-muted-foreground truncate max-w-xs">{log.metadata_json ?? "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* RFID Tags */}
        {tab === "rfid" && (
          <div className="space-y-4 animate-fade-in">
            <h2 className="text-xl font-display">RFID Tag Applications</h2>
            {loading ? (
              <div className="space-y-2">{[1,2,3].map((i) => <div key={i} className="h-16 skeleton rounded-xl" />)}</div>
            ) : (
              <div className="space-y-3">
                {rfidTags.map((tag) => (
                  <div key={tag.id} className="bg-card border border-border rounded-xl p-4 flex items-center justify-between gap-4">
                    <div>
                      <p className="font-mono text-sm font-medium">{tag.tag_number}</p>
                      <p className="text-sm text-muted-foreground">{tag.vehicle_model} · {tag.vehicle_number}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge variant={({ PENDING: "pending", ACTIVE: "approved", REVOKED: "rejected" } as Record<string, any>)[tag.status] ?? "default"}>{tag.status}</Badge>
                      {tag.status === "PENDING" && (
                        <Button size="sm" variant="amber" disabled={acting === tag.id} onClick={() => handleRfidApprove(tag.id)}>
                          {acting === tag.id ? <Loader2 className="w-4 h-4 animate-spin" /> : "Activate"}
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
                {rfidTags.length === 0 && <p className="text-muted-foreground text-sm">No RFID applications.</p>}
              </div>
            )}
          </div>
        )}

        {/* Pending Passes */}
        {tab === "passes" && (
          <div className="space-y-4 animate-fade-in">
            <h2 className="text-xl font-display">All Pending Passes</h2>
            {loading ? (
              <div className="space-y-3">{[1,2].map((i) => <div key={i} className="h-40 skeleton rounded-xl" />)}</div>
            ) : pendingPasses.length === 0 ? (
              <p className="text-muted-foreground text-sm">No pending passes.</p>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2">
                {pendingPasses.map((pass) => (
                  <PassCard
                    key={pass.id}
                    pass={pass}
                    actions={
                      <div className="flex gap-2">
                        <Button size="sm" variant="amber" className="flex-1" disabled={acting === pass.id} onClick={() => handlePassApprove(pass.id, true)}>
                          {acting === pass.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <><CheckCircle2 className="w-4 h-4 mr-1" />Approve</>}
                        </Button>
                        <Button size="sm" variant="outline" className="flex-1 border-red-200 text-red-700" disabled={acting === pass.id} onClick={() => handlePassApprove(pass.id, false)}>
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
