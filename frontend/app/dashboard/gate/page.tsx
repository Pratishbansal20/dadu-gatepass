"use client";
import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/lib/auth-store";
import { gateApi, type Pass, type RFIDScanResult, type AuditEntry, ApiError } from "@/lib/api";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/toaster";
import {
  QrCode, Wifi, AlertTriangle, ClipboardList, RefreshCw, CheckCircle2, XCircle, Car, Loader2,
} from "lucide-react";
import { formatDateTime, formatTime, passTypeLabel } from "@/lib/utils";

type Panel = "qr" | "rfid" | "active" | "log";

interface ScanResult {
  type: "success" | "error";
  message: string;
  pass?: Pass;
  rfid?: RFIDScanResult;
}

export default function GateDashboard() {
  const router = useRouter();
  const { user, accessToken, isLoggedIn } = useAuthStore();
  const { toast } = useToast();

  const [panel, setPanel] = useState<Panel>("qr");
  const [qrToken, setQrToken] = useState("");
  const [rfidTag, setRfidTag] = useState("");
  const [activePasses, setActivePasses] = useState<Pass[]>([]);
  const [todayLog, setTodayLog] = useState<AuditEntry[]>([]);
  const [scanning, setScanning] = useState(false);
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [loading, setLoading] = useState(false);
  const qrInputRef = useRef<HTMLInputElement>(null);

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
    // Auto-focus QR input when panel switches to QR
    if (panel === "qr") qrInputRef.current?.focus();
  }, [panel]);

  async function loadActivePasses() {
    if (!accessToken) return;
    setLoading(true);
    try {
      const passes = await gateApi.activePasses(accessToken);
      setActivePasses(passes);
    } catch {
      toast({ title: "Failed to load active passes", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  async function loadTodayLog() {
    if (!accessToken) return;
    try {
      const log = await gateApi.todayLog(accessToken);
      setTodayLog(log);
    } catch {}
  }

  async function handleQrScan(e: React.FormEvent) {
    e.preventDefault();
    if (!accessToken || !qrToken.trim()) return;
    setScanning(true);
    setScanResult(null);
    try {
      const pass = await gateApi.scanQr(accessToken, qrToken.trim());
      setScanResult({
        type: "success",
        message: `Entry granted — ${pass.visitor_name ?? pass.applicant?.full_name}`,
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
        message: `Vehicle authorized — ${result.faculty_name}`,
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

  return (
    <DashboardLayout
      title="Gate Security"
      subtitle="Operations panel — scan QR codes and RFID tags"
    >
      {/* Scan result banner */}
      {scanResult && (
        <div
          className={`mb-6 rounded-xl border p-4 flex items-center gap-3 animate-fade-in ${
            scanResult.type === "success"
              ? "bg-green-50 border-green-200 text-green-800"
              : "bg-red-50 border-red-200 text-red-800"
          }`}
        >
          {scanResult.type === "success" ? (
            <CheckCircle2 className="w-5 h-5 shrink-0" />
          ) : (
            <XCircle className="w-5 h-5 shrink-0" />
          )}
          <div className="flex-1">
            <p className="font-semibold text-sm">{scanResult.message}</p>
            {scanResult.pass && (
              <p className="text-xs mt-0.5 opacity-75">
                {passTypeLabel(scanResult.pass.pass_type)} · Pass #{scanResult.pass.id}
              </p>
            )}
            {scanResult.rfid && (
              <p className="text-xs mt-0.5 opacity-75">
                {scanResult.rfid.vehicle_model} · {scanResult.rfid.vehicle_number}
              </p>
            )}
          </div>
          <button onClick={() => setScanResult(null)} className="opacity-60 hover:opacity-100">
            <XCircle className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Panel tabs */}
      <div className="flex gap-1 bg-muted rounded-lg p-1 mb-6">
        {(
          [
            { id: "qr", label: "QR Scanner", Icon: QrCode },
            { id: "rfid", label: "RFID Scanner", Icon: Wifi },
            { id: "active", label: `Active (${activePasses.length})`, Icon: AlertTriangle },
            { id: "log", label: "Today's Log", Icon: ClipboardList },
          ] as { id: Panel; label: string; Icon: React.ElementType }[]
        ).map(({ id, label, Icon }) => (
          <button
            key={id}
            onClick={() => setPanel(id)}
            className={`flex items-center gap-2 flex-1 justify-center px-3 py-2 rounded-md text-sm font-medium transition-all ${
              panel === id
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Icon className="w-4 h-4" />
            <span className="hidden sm:inline">{label}</span>
          </button>
        ))}
      </div>

      {/* QR Scanner */}
      {panel === "qr" && (
        <div className="gate-panel space-y-4 animate-fade-in">
          <h2 className="text-lg font-display text-foreground">QR Code Validation</h2>
          <p className="text-sm text-muted-foreground">
            Paste or type the QR token from the visitor's device. Each token is single-use and expires in 10 minutes.
          </p>
          <form onSubmit={handleQrScan} className="flex gap-3">
            <Input
              ref={qrInputRef}
              value={qrToken}
              onChange={(e) => setQrToken(e.target.value)}
              placeholder="Paste QR token here…"
              className="font-mono text-sm"
              required
            />
            <Button type="submit" variant="amber" disabled={scanning} className="shrink-0">
              {scanning ? <Loader2 className="w-4 h-4 animate-spin" /> : "Validate"}
            </Button>
          </form>
        </div>
      )}

      {/* RFID Scanner */}
      {panel === "rfid" && (
        <div className="gate-panel space-y-4 animate-fade-in">
          <h2 className="text-lg font-display text-foreground">RFID Tag Scan</h2>
          <p className="text-sm text-muted-foreground">
            Enter the RFID tag number from the vehicle. System will verify the tag is active and return vehicle details.
          </p>
          <form onSubmit={handleRfidScan} className="flex gap-3">
            <Input
              value={rfidTag}
              onChange={(e) => setRfidTag(e.target.value)}
              placeholder="Enter RFID tag number…"
              className="font-mono text-sm"
              required
            />
            <Button type="submit" variant="amber" disabled={scanning} className="shrink-0">
              {scanning ? <Loader2 className="w-4 h-4 animate-spin" /> : "Scan"}
            </Button>
          </form>
          {scanResult?.rfid && (
            <div className="rounded-lg bg-green-50 border border-green-200 p-4 space-y-2 animate-fade-in">
              <div className="flex items-center gap-2">
                <Car className="w-4 h-4 text-green-700" />
                <span className="font-semibold text-green-800 text-sm">Vehicle Authorized</span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-sm text-green-800">
                <span>Model: <strong>{scanResult.rfid.vehicle_model}</strong></span>
                <span>Number: <strong>{scanResult.rfid.vehicle_number}</strong></span>
                <span>Owner: <strong>{scanResult.rfid.faculty_name}</strong></span>
                <span>Phone: <strong>{scanResult.rfid.faculty_phone}</strong></span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Active Passes */}
      {panel === "active" && (
        <div className="animate-fade-in space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-display">Active Passes — Today</h2>
            <Button size="sm" variant="outline" onClick={loadActivePasses}>
              <RefreshCw className={`w-4 h-4 mr-2 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          </div>
          {activePasses.length === 0 ? (
            <div className="gate-panel text-center py-8 text-muted-foreground text-sm">
              No active passes at this time.
            </div>
          ) : (
            <div className="space-y-3">
              {activePasses.map((pass) => (
                <div key={pass.id} className="gate-panel flex items-center justify-between gap-4">
                  <div>
                    <p className="font-medium text-sm text-foreground">
                      {pass.visitor_name ?? pass.applicant?.full_name}
                    </p>
                    <p className="text-xs text-muted-foreground font-mono mt-0.5">
                      {passTypeLabel(pass.pass_type)} · #{pass.id}
                    </p>
                    {pass.entry_time && (
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Window: {formatTime(pass.entry_time)} – {formatTime(pass.exit_time)}
                      </p>
                    )}
                  </div>
                  <Badge variant="approved">{pass.status}</Badge>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Today's Log */}
      {panel === "log" && (
        <div className="animate-fade-in space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-display">Today's Entry Log</h2>
            <Button size="sm" variant="outline" onClick={loadTodayLog}>
              <RefreshCw className="w-4 h-4 mr-2" />
              Refresh
            </Button>
          </div>
          {todayLog.length === 0 ? (
            <div className="gate-panel text-center py-8 text-muted-foreground text-sm">
              No entries recorded today.
            </div>
          ) : (
            <div className="space-y-2">
              {todayLog.map((entry, i) => (
                <div key={entry.id} className="gate-panel flex items-center gap-4 py-3">
                  <div className="text-xs font-mono text-muted-foreground w-6 text-center">
                    {todayLog.length - i}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-foreground font-mono">{entry.action}</p>
                    {entry.metadata && (
                      <p className="text-xs text-muted-foreground truncate mt-0.5">
                        {entry.metadata}
                      </p>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground shrink-0">
                    {formatDateTime(entry.timestamp)}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </DashboardLayout>
  );
}
