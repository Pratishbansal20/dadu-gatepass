"use client";
import { useState } from "react";
import { authApi, ApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ShieldCheck, Loader2, CheckCircle2, XCircle } from "lucide-react";

interface PageProps {
  params: { token: string };
}

interface QRResult {
  qr_image_base64: string;
  token: string;
  expires_in_seconds: number;
}

export default function VerifyPage({ params }: PageProps) {
  const passId = parseInt(params.token, 10);
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<QRResult | null>(null);
  const [error, setError] = useState("");

  const isValidPassId = !isNaN(passId);

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const data = await authApi.verifyOtp("", passId, phone, otp);
      setResult(data);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError("Verification failed. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#0f172a] flex items-center justify-center p-4 grain-texture">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/20 mb-4">
            <ShieldCheck className="w-8 h-8 text-amber-400" />
          </div>
          <h1 className="text-2xl font-display text-white">Visitor Entry Verification</h1>
          <p className="text-slate-400 text-sm mt-2">BITS Pilani Campus — Gate Access</p>
        </div>

        <div className="bg-[#1e293b] rounded-2xl border border-white/10 p-8 shadow-2xl">
          {!result ? (
            <>
              {!isValidPassId ? (
                <div className="text-center py-6">
                  <XCircle className="w-12 h-12 text-red-400 mx-auto mb-3" />
                  <p className="text-red-400 font-medium">Invalid pass link</p>
                  <p className="text-slate-500 text-sm mt-1">This verification link is malformed.</p>
                </div>
              ) : (
                <form onSubmit={handleVerify} className="space-y-5">
                  <div>
                    <p className="text-slate-300 text-sm mb-4">
                      Enter the phone number associated with your visit and the OTP you received.
                    </p>
                    <p className="text-xs font-mono text-slate-500">Pass ID: #{passId}</p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="phone" className="text-slate-300">Phone Number</Label>
                    <Input
                      id="phone"
                      type="tel"
                      pattern="[0-9]{10}"
                      maxLength={10}
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="10-digit mobile number"
                      required
                      className="bg-[#0f172a] border-white/10 text-white placeholder:text-slate-600 focus-visible:ring-amber-500"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="otp" className="text-slate-300">OTP</Label>
                    <Input
                      id="otp"
                      type="text"
                      value={otp}
                      onChange={(e) => setOtp(e.target.value)}
                      placeholder="6-digit OTP"
                      maxLength={6}
                      required
                      className="bg-[#0f172a] border-white/10 text-white placeholder:text-slate-600 focus-visible:ring-amber-500 font-mono text-lg tracking-widest"
                    />
                  </div>

                  {error && (
                    <div className="rounded-md bg-red-900/30 border border-red-700/50 px-4 py-3 text-sm text-red-400 flex items-center gap-2">
                      <XCircle className="w-4 h-4 shrink-0" />
                      {error}
                    </div>
                  )}

                  <Button type="submit" variant="amber" className="w-full" disabled={loading}>
                    {loading ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Verifying…
                      </>
                    ) : (
                      "Get QR Code"
                    )}
                  </Button>
                </form>
              )}
            </>
          ) : (
            /* QR Code display */
            <div className="text-center space-y-5">
              <div className="flex items-center justify-center gap-2 text-green-400">
                <CheckCircle2 className="w-5 h-5" />
                <span className="font-semibold">OTP Verified — Show this QR to gate security</span>
              </div>

              <div className="bg-white rounded-xl p-4 inline-block shadow-lg">
                <img
                  src={`data:image/png;base64,${result.qr_image_base64}`}
                  alt="Gate entry QR code"
                  className="w-56 h-56"
                />
              </div>

              <div className="space-y-1">
                <p className="text-xs text-slate-400 font-mono">
                  This QR is single-use and expires in {result.expires_in_seconds / 60} minutes
                </p>
                <p className="text-xs text-amber-400 font-medium animate-pulse">
                  Do not share this QR with anyone
                </p>
              </div>

              <div className="rounded-lg bg-[#0f172a] border border-white/10 p-3">
                <p className="text-xs text-slate-500 font-mono break-all">{result.token}</p>
              </div>
            </div>
          )}
        </div>

        <p className="text-center text-xs text-slate-600 mt-6">
          BITS Pilani Campus Security · Powered by Gatepass System
        </p>
      </div>
    </div>
  );
}
