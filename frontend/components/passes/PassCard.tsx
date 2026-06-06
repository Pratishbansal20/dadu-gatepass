"use client";
import { Pass } from "@/lib/api";
import { cn, formatDate, formatTime, passTypeLabel } from "@/lib/utils";
import { Calendar, Clock, User, Phone, Building2, MapPin } from "lucide-react";

// ─── Status config ─────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<string, { dot: string; pill: string; label: string }> = {
  PENDING:  { dot: "bg-amber-400",  pill: "bg-amber-50  text-amber-700  border-amber-200",  label: "Pending"  },
  APPROVED: { dot: "bg-emerald-400",pill: "bg-emerald-50 text-emerald-700 border-emerald-200",label: "Approved" },
  REJECTED: { dot: "bg-red-400",    pill: "bg-red-50    text-red-700    border-red-200",    label: "Rejected" },
  USED:     { dot: "bg-slate-400",  pill: "bg-slate-50  text-slate-600  border-slate-200",  label: "Used"     },
  EXPIRED:  { dot: "bg-orange-400", pill: "bg-orange-50 text-orange-700 border-orange-200", label: "Expired"  },
  ACTIVE:   { dot: "bg-blue-400",   pill: "bg-blue-50   text-blue-700   border-blue-200",   label: "Active"   },
};

// Coloured left-border accent by pass type — gives each card a distinct identity at a glance
const TYPE_ACCENT: Record<string, string> = {
  VISITOR_DAY:            "border-l-amber-500",
  CONFERENCE_PARTICIPANT: "border-l-blue-500",
  PERMANENT_RESIDENT:     "border-l-emerald-500",
  HOSTEL_SUB:             "border-l-violet-500",
  VEHICLE_RFID:           "border-l-slate-400",
};

// ─── Component ─────────────────────────────────────────────────────────────────

interface PassCardProps {
  pass: Pass;
  actions?: React.ReactNode;
}

export function PassCard({ pass, actions }: PassCardProps) {
  const status = STATUS_CONFIG[pass.status] ?? STATUS_CONFIG.PENDING;
  const accent = TYPE_ACCENT[pass.pass_type] ?? "border-l-slate-300";
  const name = pass.visitor_name ?? pass.applicant?.full_name ?? "Unknown";

  return (
    <div
      className={cn(
        "group relative bg-card rounded-xl border border-border border-l-4 shadow-sm",
        "hover:shadow-md transition-all duration-200",
        accent,
      )}
    >
      {/* ── Header ── */}
      <div className="px-5 pt-5 pb-4">
        {/* Top row: pass ID + status pill */}
        <div className="flex items-center justify-between gap-3 mb-3">
          <span className="text-[10px] font-mono text-muted-foreground tracking-widest uppercase">
            Pass #{pass.id}
          </span>

          <span
            className={cn(
              "inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full border",
              "text-[10px] font-mono font-semibold uppercase tracking-wide",
              status.pill,
            )}
          >
            <span className={cn("w-1.5 h-1.5 rounded-full shrink-0", status.dot)} />
            {status.label}
          </span>
        </div>

        {/* Name */}
        <h3 className="text-xl font-display text-foreground leading-tight">{name}</h3>

        {/* Pass type */}
        <p className="text-xs font-medium text-muted-foreground mt-0.5">
          {passTypeLabel(pass.pass_type)}
        </p>
      </div>

      {/* ── Divider ── */}
      <div className="mx-5 border-t border-border" />

      {/* ── Details grid ── */}
      <div className="px-5 py-4 grid grid-cols-2 gap-x-4 gap-y-2.5">
        {pass.visitor_phone && (
          <Detail icon={<Phone />} value={pass.visitor_phone} mono />
        )}
        {pass.conference_name && (
          <Detail icon={<Building2 />} value={pass.conference_name} span />
        )}
        {pass.visit_date && (
          <Detail icon={<Calendar />} value={formatDate(pass.visit_date)} />
        )}
        {(pass.valid_from || pass.valid_until) && (
          <Detail
            icon={<Calendar />}
            value={`${formatDate(pass.valid_from)} – ${formatDate(pass.valid_until)}`}
            span
          />
        )}
        {pass.entry_time && (
          <Detail
            icon={<Clock />}
            value={`${formatTime(pass.entry_time)} – ${formatTime(pass.exit_time)}`}
          />
        )}
        {pass.applicant && (
          <Detail icon={<User />} value={pass.applicant.full_name} />
        )}
        {pass.purpose && !pass.conference_name && (
          <Detail icon={<MapPin />} value={pass.purpose} span />
        )}
      </div>

      {/* ── Rejection reason ── */}
      {pass.rejection_reason && (
        <div className="mx-5 mb-4 rounded-lg bg-red-50 border border-red-200 px-3 py-2.5">
          <p className="text-xs font-semibold text-red-700 mb-0.5">Reason for rejection</p>
          <p className="text-xs text-red-600">{pass.rejection_reason}</p>
        </div>
      )}

      {/* ── Actions ── */}
      {actions && (
        <>
          <div className="mx-5 border-t border-border" />
          <div className="px-5 py-4">{actions}</div>
        </>
      )}
    </div>
  );
}

// ─── Detail row sub-component ──────────────────────────────────────────────────

function Detail({
  icon,
  value,
  mono = false,
  span = false,
}: {
  icon: React.ReactNode;
  value: string;
  mono?: boolean;
  span?: boolean;
}) {
  return (
    <div className={cn("flex items-center gap-2 min-w-0", span && "col-span-2")}>
      <span className="text-muted-foreground/60 shrink-0 [&>svg]:w-3.5 [&>svg]:h-3.5">
        {icon}
      </span>
      <span
        className={cn(
          "text-sm text-muted-foreground truncate",
          mono && "font-mono tracking-wide",
        )}
      >
        {value}
      </span>
    </div>
  );
}
