"use client";
import { Pass } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { cn, formatDate, formatTime, passTypeLabel } from "@/lib/utils";
import { Calendar, Clock, User, Phone, Building2 } from "lucide-react";

type StatusVariant = "pending" | "approved" | "rejected" | "used" | "expired" | "active" | "default";

function statusVariant(status: string): StatusVariant {
  const map: Record<string, StatusVariant> = {
    PENDING: "pending",
    APPROVED: "approved",
    REJECTED: "rejected",
    USED: "used",
    EXPIRED: "expired",
    ACTIVE: "active",
  };
  return map[status] ?? "default";
}

interface PassCardProps {
  pass: Pass;
  actions?: React.ReactNode;
}

export function PassCard({ pass, actions }: PassCardProps) {
  return (
    <div className="pass-card p-5 space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-mono text-muted-foreground uppercase tracking-widest">
            #{pass.id} · {passTypeLabel(pass.pass_type)}
          </p>
          <h3 className="text-lg font-display mt-0.5 text-foreground">
            {pass.visitor_name ?? pass.applicant?.full_name ?? "—"}
          </h3>
        </div>
        <Badge variant={statusVariant(pass.status)} className="shrink-0 mt-1">
          {pass.status}
        </Badge>
      </div>

      {/* Details grid */}
      <div className="grid grid-cols-2 gap-3 text-sm">
        {pass.visitor_phone && (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Phone className="w-3.5 h-3.5 shrink-0" />
            <span className="font-mono">{pass.visitor_phone}</span>
          </div>
        )}
        {pass.conference_name && (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Building2 className="w-3.5 h-3.5 shrink-0" />
            <span>{pass.conference_name}</span>
          </div>
        )}
        {pass.visit_date && (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Calendar className="w-3.5 h-3.5 shrink-0" />
            <span>{formatDate(pass.visit_date)}</span>
          </div>
        )}
        {(pass.valid_from || pass.valid_until) && (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Calendar className="w-3.5 h-3.5 shrink-0" />
            <span>
              {formatDate(pass.valid_from)} – {formatDate(pass.valid_until)}
            </span>
          </div>
        )}
        {pass.entry_time && (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Clock className="w-3.5 h-3.5 shrink-0" />
            <span>
              {formatTime(pass.entry_time)} – {formatTime(pass.exit_time)}
            </span>
          </div>
        )}
        {pass.applicant && (
          <div className="flex items-center gap-2 text-muted-foreground">
            <User className="w-3.5 h-3.5 shrink-0" />
            <span>{pass.applicant.full_name}</span>
          </div>
        )}
      </div>

      {pass.purpose && (
        <p className="text-sm text-muted-foreground border-t border-border pt-3">
          {pass.purpose}
        </p>
      )}

      {pass.rejection_reason && (
        <div className="rounded-md bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
          Rejected: {pass.rejection_reason}
        </div>
      )}

      {actions && <div className="border-t border-border pt-3">{actions}</div>}
    </div>
  );
}
