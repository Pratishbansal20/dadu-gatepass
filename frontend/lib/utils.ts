import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(iso: string | undefined): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function formatTime(t: string | undefined): string {
  if (!t) return "";
  const [h, m] = t.split(":");
  const hour = parseInt(h);
  const suffix = hour >= 12 ? "PM" : "AM";
  const displayHour = hour % 12 || 12;
  return `${displayHour}:${m} ${suffix}`;
}

export function formatDateTime(iso: string | undefined): string {
  if (!iso) return "";
  return new Date(iso).toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const STATUS_COLORS: Record<string, string> = {
  PENDING: "bg-yellow-100 text-yellow-800 border-yellow-200",
  APPROVED: "bg-green-100 text-green-800 border-green-200",
  REJECTED: "bg-red-100 text-red-800 border-red-200",
  ACTIVE: "bg-blue-100 text-blue-800 border-blue-200",
  USED: "bg-gray-100 text-gray-700 border-gray-200",
  EXPIRED: "bg-orange-100 text-orange-800 border-orange-200",
};

export function statusColor(status: string): string {
  return STATUS_COLORS[status] ?? "bg-gray-100 text-gray-600 border-gray-200";
}

const PASS_TYPE_LABELS: Record<string, string> = {
  PERMANENT_RESIDENT: "Permanent Resident",
  VISITOR_DAY: "Visitor Day Pass",
  CONFERENCE_PARTICIPANT: "Conference Pass",
  VEHICLE_RFID: "Vehicle RFID",
  HOSTEL_SUB: "Hostel Sub-pass",
};

export function passTypeLabel(type: string): string {
  return PASS_TYPE_LABELS[type] ?? type;
}

const ROLE_LABELS: Record<string, string> = {
  STUDENT: "Student",
  FACULTY: "Faculty",
  HOSTEL_SUPERINTENDENT: "Hostel Superintendent",
  CONFERENCE_SUPERVISOR: "Conference Supervisor",
  GATE_SECURITY: "Gate Security",
  SUPER_ADMIN: "Super Admin",
};

export function roleLabel(role: string): string {
  return ROLE_LABELS[role] ?? role;
}
