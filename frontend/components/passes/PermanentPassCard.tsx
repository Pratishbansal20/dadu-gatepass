"use client";
import { PermanentPass } from "@/lib/api";
import { formatDate, roleLabel } from "@/lib/utils";
import { ShieldCheck, Calendar } from "lucide-react";

interface PermanentPassCardProps {
  pass: PermanentPass;
}

export function PermanentPassCard({ pass }: PermanentPassCardProps) {
  return (
    <div className="relative rounded-2xl overflow-hidden border border-white/10 shadow-2xl max-w-sm w-full select-none">
      {/* ── Card header (dark, gradient) ─────────────────────────────────── */}
      <div className="relative bg-gradient-to-br from-slate-800 to-slate-900 px-6 pt-6 pb-5 overflow-hidden">
        {/* Subtle radial highlight — gives the "embossed" feel */}
        <div
          aria-hidden
          className="pointer-events-none absolute -top-16 -right-16 w-48 h-48 rounded-full bg-amber-400/10 blur-2xl"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-amber-400/30 to-transparent"
        />

        {/* Issuer line */}
        <div className="flex items-center gap-2 mb-5">
          <ShieldCheck className="w-4 h-4 text-amber-400 shrink-0" />
          <span className="text-[10px] font-mono tracking-[0.18em] text-amber-400 uppercase">
            BITS Pilani — Campus Pass
          </span>
        </div>

        {/* Holder */}
        <h2 className="text-2xl font-display text-white leading-tight">{pass.holder_name}</h2>
        <p className="text-sm text-slate-400 mt-1 font-medium">{roleLabel(pass.role)}</p>

        {/* Campus ID chip */}
        {pass.campus_id && (
          <div className="inline-flex items-center mt-3 px-2.5 py-1 rounded-md bg-white/5 border border-white/10">
            <span className="text-[11px] font-mono tracking-widest text-slate-300">
              {pass.campus_id}
            </span>
          </div>
        )}
      </div>

      {/* ── QR section ───────────────────────────────────────────────────── */}
      <div className="bg-white px-6 py-6 flex flex-col items-center gap-4">
        {/* QR frame */}
        <div className="relative p-3 rounded-xl border-2 border-slate-200 shadow-inner bg-white">
          {/* Corner accents — physical ID card detail */}
          <span aria-hidden className="absolute top-1 left-1 w-2.5 h-2.5 border-t-2 border-l-2 border-amber-400 rounded-tl" />
          <span aria-hidden className="absolute top-1 right-1 w-2.5 h-2.5 border-t-2 border-r-2 border-amber-400 rounded-tr" />
          <span aria-hidden className="absolute bottom-1 left-1 w-2.5 h-2.5 border-b-2 border-l-2 border-amber-400 rounded-bl" />
          <span aria-hidden className="absolute bottom-1 right-1 w-2.5 h-2.5 border-b-2 border-r-2 border-amber-400 rounded-br" />

          <img
            src={`data:image/png;base64,${pass.qr_image_base64}`}
            alt="Permanent pass QR code — present at gate for scanning"
            className="w-40 h-40 block"
            draggable={false}
          />
        </div>

        {/* Validity */}
        <div className="flex items-center gap-2 text-muted-foreground">
          <Calendar className="w-3.5 h-3.5 shrink-0" />
          <p className="text-[11px] font-mono tracking-wide">
            VALID UNTIL {formatDate(pass.valid_until).toUpperCase()}
          </p>
        </div>

        {/* Pass type label */}
        <p className="text-[9px] font-mono tracking-[0.22em] text-slate-400 uppercase">
          Permanent Resident Pass
        </p>
      </div>

      {/* ── Bottom accent strip ───────────────────────────────────────────── */}
      <div className="h-1.5 bg-gradient-to-r from-amber-400 via-amber-300 to-amber-500" />
    </div>
  );
}
