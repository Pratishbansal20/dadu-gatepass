"use client";
import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/lib/auth-store";
import { gateApi, type Pass, type RFIDScanResult, type AuditEntry, ApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toaster";
import {
  QrCode, Wifi, AlertTriangle, ClipboardList, RefreshCw,
  CheckCircle2, XCircle, Car, Loader2, ShieldCheck, LogOut,
} from "lucide-react";
import { cn, formatDateTime, formatTime, passTypeLabel } from "@/lib/utils";

type Panel = "qr" | "rfid" | "active" | "log";

interface ScanResult {
  type: "success" | "error";
  message: string;
  pass?: Pass;
  rfid?: RFIDScanResult;
}

// ─── Tab config ────────────────────────────────────────────────────────────────

const TABS: { id: Panel; label: string; shortLabel: string; Icon: React.ElementType }[] = [
  { id: "qr",     label: "QR Scanner",    shortLabel: "QR",     Icon: QrCode       },
  { id: "rfid",   label: "RFID Scanner",  shortLabel: "RFID",   Icon: Wifi         },
  { id: "active", label: "Active Passes", shortLabel: "Active", Icon: AlertTriangle },
  { id: "log",    label: "Today's Log",   shortLabel: "Log",    Icon: ClipboardList },
];

// ─── Page ──────────────────────────────────────────────────────────────────────

export default function GateDashboard() {
  const router  = useRouter();
  const { user, accessToken, isLoggedIn, clearAuth } = useAuthStore();
  const { toast } = useToast();

  const [panel,        setPanel]        = useState<Panel>("qr");
  const [qrToken,      setQrToken]      = useState("");
  const [rfidTag,      setRfidTag]      = useState("");
  const [activePasses, setActivePasses] = useState<Pass[]>([]);
  const [todayLog,     setTodayLog]     = useState<AuditEntry[]>([]);
  const [scanning,     setScanning]     = useState(false);
  const [scanResult,   setScanResult]   = useState<ScanResult | null>(null);
  const [loading,      setLoading]      = useState(false);
  const qrInputRef = useRef<HTMLInputElement>(null);

  const handleLogout = () => { clearAuth(); router.replace("/login"); };

  useEffect(() => {
    const allowed = ["GATE_SECURITY", "SUPER_ADMIN"];
    if (!isLoggedIn || !allowed.includes(user?.role ?? "")) {
      router.replace("/login");
      return;
    }
    loadActivePasses();
    loadTodayLog();
  }, [isLoggedIn]);

  useEffect(() => {
    if (panel === "qr") qrInputRef.current?.focus();
  }, [panel]);

  // ─── Data loaders ─────────────────────────────────────────────────────────

  async function loadActivePasses() {
    if (!accessToken) return;
    setLoading(true);
    try {
      setActivePasses(await gateApi.activePasses(accessToken));
    } catch {
      toast({ title: "Failed to load active passes", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  async function loadTodayLog() {
    if (!accessToken) return;
    try {
      setTodayLog(await gateApi.todayLog(accessToken));
    } catch {}
  }

  // ─── Scan handlers ────────────────────────────────────────────────────────

  async function handleQrScan(e: React.FormEvent) {
    e.preventDefault();
    if (!accessToken || !qrToken.trim()) return;
    setScanning(true);
    setScanResult(null);
    try {
      const pass = await gateApi.scanQr(accessToken, qrToken.trim());
      setScanResult({
        type: "success",
        message: `Entry granted: ${pass.visitor_name ?? pass.applicant?.full_name}`,
        pass,
      });
      setQrToken("");
      loadActivePasses();
      loadTodayLog();
    } catch (err) {
      setScanResult({
        type: "error",
        message: err instanceof ApiError ? err.message : "QR scan failed",
      });
    } finally {
      setScanning(false);
    }
  }

  async function handleRfidScan(e: React.FormEvent) {
    e.preventDefault();
    if (!accessToken || !rfidTag.trim()) return;
    setScanning(true);
    setScanResult(null);
    try {
      const result = await gateApi.scanRfid(accessToken, rfidTag.trim());
      setScanResult({
        type: "success",
        message: `Vehicle authorized: ${result.faculty_name}`,
        rfid: result,
      });
      setRfidTag("");
    } catch (err) {
      setScanResult({
        type: "error",
        message: err instanceof ApiError ? err.message : "RFID scan failed",
      });
    } finally {
      setScanning(false);
    }
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-slate-950 text-white">

      {/* ── Sticky nav bar ── */}
      <header className="sticky top-0 z-40 bg-slate-900/90 backdrop-blur-sm border-b border-slate-800">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-4">
          {/* Left: logo + status dot */}
          <div className="flex items-center gap-3">
            <ShieldCheck className="w-5 h-5 text-amber-400 shrink-0" />
            <span className="font-display text-base text-white hidden sm:block">BITS Gatepass</span>
            <span className="text-slate-700 hidden sm:block">·</span>
            <div className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-[10px] font-mono tracking-widest text-emerald-400 uppercase">Gate Live</span>
            </div>
          </div>

          {/* Right: user info + logout */}
          <div className="flex items-center gap-3">
            {user && (
              <div className="text-right hidden sm:block">
                <p className="text-sm font-medium text-white leading-tight">{user.full_name}</p>
                <p className="text-[10px] text-slate-500 font-mono uppercase tracking-wide">Gate Security</p>
              </div>
            )}
            <button
              onClick={handleLogout}
              title="Sign out"
              className="p-2 rounded-md text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* ── Main content ── */}
      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-6 space-y-5">

        {/* ── Scan result banner ── */}
        {scanResult && (
          <div
            className={cn(
              "rounded-xl border p-4 flex items-center gap-4 animate-fade-in",
              scanResult.type === "success"
                ? "bg-emerald-950 border-emerald-700"
                : "bg-red-950  border-red-900",
            )}
          >
            {scanResult.type === "success"
              ? <CheckCircle2 className="w-7 h-7 text-emerald-400 shrink-0" />
              : <XCircle     className="w-7 h-7 text-red-400     shrink-0" />
            }
            <div className="flex-1 min-w-0">
              <p className={cn(
                "font-semibold text-base leading-tight",
                scanResult.type === "success" ? "text-emerald-300" : "text-red-300",
              )}>
                {scanResult.message}
              </p>
              {scanResult.pass && (
                <p className="text-xs mt-1 text-slate-400 font-mono">
                  {passTypeLabel(scanResult.pass.pass_type)} · Pass #{scanResult.pass.id}
                </p>
              )}
              {scanResult.rfid && (
                <p className="text-xs mt-1 text-slate-400 font-mono">
                  {scanResult.rfid.vehicle_model} · {scanResult.rfid.vehicle_number}
                </p>
              )}
            </div>
            <button
              onClick={() => setScanResult(null)}
              className="shrink-0 p-1 rounded opacity-40 hover:opacity-100 text-white transition-opacity"
              aria-label="Dismiss"
            >
              <XCircle className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* ── Panel tabs ── */}
        <div className="flex gap-1 bg-slate-900 rounded-lg p-1 border border-slate-800">
          {TABS.map(({ id, label, shortLabel, Icon }) => (
            <button
              key={id}
              onClick={() => setPanel(id)}
              className={cn(
                "flex items-center justify-center gap-2 flex-1 px-3 py-2 rounded-md text-sm font-medium transition-all",
                panel === id
                  ? "bg-slate-700 text-white shadow-sm"
                  : "text-slate-500 hover:text-slate-300 hover:bg-slate-800/50",
              )}
            >
              <Icon className="w-4 h-4 shrink-0" />
              <span className="hidden sm:inline">{label}</span>
              <span className="sm:hidden">{shortLabel}</span>
              {id === "active" && activePasses.length > 0 && (
                <span className="ml-0.5 bg-amber-500 text-black text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center shrink-0">
                  {activePasses.length}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* ── QR Scanner panel ── */}
        {panel === "qr" && (
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-5 animate-fade-in">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center shrink-0">
                <QrCode className="w-5 h-5 text-amber-400" />
              </div>
              <div>
                <h2 className="text-base font-display text-white">QR Code Validation</h2>
                <p className="text-xs text-slate-500">Single-use token · expires in 10 minutes after issue</p>
              </div>
            </div>
            <form onSubmit={handleQrScan} className="flex gap-3">
              <Input
                ref={qrInputRef}
                value={qrToken}
                onChange={(e) => setQrToken(e.target.value)}
                placeholder="Paste or type QR token here…"
                className="bg-slate-950 border-slate-700 text-white placeholder:text-slate-600 font-mono text-sm focus-visible:ring-amber-500 focus-visible:border-amber-500"
                required
              />
              <Button type="submit" variant="amber" disabled={scanning} className="shrink-0">
                {scanning ? <Loader2 className="w-4 h-4 animate-spin" /> : "Validate"}
              </Button>
            </form>
            <p className="text-xs text-slate-600 font-mono">
              TIP: Hardware QR scanners that emit token + ENTER will auto-submit this form.
            </p>
          </div>
        )}

        {/* ── RFID Scanner panel ── */}
        {panel === "rfid" && (
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-5 animate-fade-in">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center shrink-0">
                <Wifi className="w-5 h-5 text-amber-400" />
              </div>
              <div>
                <h2 className="text-base font-display text-white">RFID Tag Scan</h2>
                <p className="text-xs text-slate-500">Enter the tag number to verify vehicle access</p>
              </div>
            </div>
            <form onSubmit={handleRfidScan} className="flex gap-3">
              <Input
                value={rfidTag}
                onChange={(e) => setRfidTag(e.target.value)}
                placeholder="Enter RFID tag number…"
                className="bg-slate-950 border-slate-700 text-white placeholder:text-slate-600 font-mono text-sm focus-visible:ring-amber-500 focus-visible:border-amber-500"
                required
              />
              <Button type="submit" variant="amber" disabled={scanning} className="shrink-0">
                {scanning ? <Loader2 className="w-4 h-4 animate-spin" /> : "Scan"}
              </Button>
            </form>

            {/* RFID success detail card */}
            {scanResult?.rfid && (
              <div className="rounded-lg bg-emerald-950 border border-emerald-800 p-4 space-y-3 animate-fade-in">
                <div className="flex items-center gap-2">
                  <Car className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span className="font-semibold text-emerald-300 text-sm">Vehicle Authorized</span>
                </div>
                <div className="grid grid-cols-2 gap-y-1.5 gap-x-6 text-sm font-mono">
                  <Row label="Model"  value={scanResult.rfid.vehicle_model}  />
                  <Row label="Number" value={scanResult.rfid.vehicle_number} />
                  <Row label="Owner"  value={scanResult.rfid.faculty_name}   />
                  <Row label="Phone"  value={scanResult.rfid.faculty_phone}  />
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Active Passes panel ── */}
        {panel === "active" && (
          <div className="space-y-4 animate-fade-in">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-display text-white">Active Passes · Today</h2>
              <button
                onClick={loadActivePasses}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-slate-800 border border-slate-700 text-xs text-slate-300 hover:bg-slate-700 transition-colors"
              >
                <RefreshCw className={cn("w-3.5 h-3.5", loading && "animate-spin")} />
                Refresh
              </button>
            </div>

            {activePasses.length === 0 ? (
              <div className="bg-slate-900 border border-slate-800 rounded-xl py-12 text-center">
                <AlertTriangle className="w-8 h-8 text-slate-700 mx-auto mb-3" />
                <p className="text-sm text-slate-500">No active passes at this time.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {activePasses.map((pass) => (
                  <div
                    key={pass.id}
                    className="bg-slate-900 border border-slate-800 rounded-lg px-4 py-3 flex items-center justify-between gap-4"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-white leading-tight">
                        {pass.visitor_name ?? pass.applicant?.full_name}
                      </p>
                      <p className="text-[11px] text-slate-500 font-mono mt-0.5">
                        {passTypeLabel(pass.pass_type)} · #{pass.id}
                      </p>
                      {pass.entry_time && (
                        <p className="text-[11px] text-slate-600 font-mono mt-0.5">
                          {formatTime(pass.entry_time)} – {formatTime(pass.exit_time)}
                        </p>
                      )}
                    </div>
                    <span className="shrink-0 inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full border text-[10px] font-mono font-semibold uppercase tracking-wide bg-emerald-950 text-emerald-400 border-emerald-800">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                      Active
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Today's Log panel ── */}
        {panel === "log" && (
          <div className="space-y-4 animate-fade-in">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-display text-white">Today's Entry Log</h2>
              <button
                onClick={loadTodayLog}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-slate-800 border border-slate-700 text-xs text-slate-300 hover:bg-slate-700 transition-colors"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Refresh
              </button>
            </div>

            {todayLog.length === 0 ? (
              <div className="bg-slate-900 border border-slate-800 rounded-xl py-12 text-center">
                <ClipboardList className="w-8 h-8 text-slate-700 mx-auto mb-3" />
                <p className="text-sm text-slate-500">No entries recorded today.</p>
              </div>
            ) : (
              <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
                {todayLog.map((entry, i) => (
                  <div
                    key={entry.id}
                    className={cn(
                      "flex items-center gap-4 px-4 py-3",
                      i !== todayLog.length - 1 && "border-b border-slate-800",
                    )}
                  >
                    {/* Sequence number */}
                    <span className="text-[11px] font-mono text-slate-700 w-6 text-right shrink-0">
                      {todayLog.length - i}
                    </span>
                    {/* Action */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-slate-300 font-mono truncate">{entry.action}</p>
                      {entry.metadata && (
                        <p className="text-[11px] text-slate-600 font-mono truncate mt-0.5">
                          {typeof entry.metadata === "string"
                            ? entry.metadata
                            : JSON.stringify(entry.metadata)}
                        </p>
                      )}
                    </div>
                    {/* Timestamp */}
                    <span className="text-[11px] text-slate-600 font-mono shrink-0">
                      {formatDateTime(entry.timestamp)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}

// ─── RFID detail row ───────────────────────────────────────────────────────────

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline gap-2 min-w-0">
      <span className="text-slate-600 text-[11px] shrink-0">{label}:</span>
      <span className="text-emerald-300 text-sm truncate">{value}</span>
    </div>
  );
}
