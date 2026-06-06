"use client";
import { PermanentPass } from "@/lib/api";
import { formatDate, roleLabel } from "@/lib/utils";
import { ShieldCheck } from "lucide-react";

interface PermanentPassCardProps {
  pass: PermanentPass;
}

export function PermanentPassCard({ pass }: PermanentPassCardProps) {
  return (
    <div className="relative rounded-2xl overflow-hidden border border-border shadow-xl max-w-sm">
      {/* Navy header */}
      <div className="bg-[#1e293b] px-6 py-5 text-white">
        <div className="flex items-center gap-2 mb-4">
          <ShieldCheck className="w-5 h-5 text-amber-400" />
          <span className="text-xs font-mono tracking-widest text-amber-400 uppercase">
            BITS Pilani — Campus Pass
          </span>
        </div>
        <h2 className="text-2xl font-display">{pass.holder_name}</h2>
        <p className="text-sm text-slate-400 mt-1">{roleLabel(pass.role)}</p>
        {pass.campus_id && (
          <p className="text-xs font-mono text-slate-500 mt-0.5">{pass.campus_id}</p>
        )}
      </div>

      {/* QR section */}
      <div className="bg-white p-6 flex flex-col items-center gap-4">
        <img
          src={`data:image/png;base64,${pass.qr_image_base64}`}
          alt="Permanent pass QR code"
          className="w-40 h-40 rounded-lg shadow-md"
        />
        <div className="text-center">
          <p className="text-xs text-muted-foreground font-mono">PERMANENT RESIDENT PASS</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Valid until {formatDate(pass.valid_until)}
          </p>
        </div>
      </div>

      {/* Amber accent strip */}
      <div className="h-1.5 bg-gradient-to-r from-amber-400 to-amber-500" />
    </div>
  );
}
