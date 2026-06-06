const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

type RequestOptions = {
  method?: string;
  body?: unknown;
  token?: string;
  apiKey?: string;
};

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}

async function request<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  const { method = "GET", body, token, apiKey } = opts;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  if (apiKey) headers["X-API-Key"] = apiKey;

  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    const detail = err?.detail ?? {};
    throw new ApiError(
      res.status,
      detail?.code ?? "UNKNOWN_ERROR",
      detail?.error ?? `HTTP ${res.status}`,
    );
  }

  if (res.status === 204) return undefined as T;
  return res.json();
}

// Auth
export const authApi = {
  login: (email: string, password: string) =>
    request<{ access_token: string; refresh_token: string; token_type: string }>(
      "/api/v1/auth/login",
      { method: "POST", body: { email, password } },
    ),

  refresh: (refresh_token: string) =>
    request<{ access_token: string; refresh_token: string; token_type: string }>(
      "/api/v1/auth/refresh",
      { method: "POST", body: { refresh_token } },
    ),

  me: (token: string) =>
    request<{
      id: number;
      email: string;
      full_name: string;
      role: string;
      phone: string;
      campus_id: string | null;
    }>("/api/v1/auth/me", { token }),

  verifyOtp: (token: string, pass_id: number, phone: string, otp: string) =>
    request<{ qr_image_base64: string; token: string; expires_in_seconds: number }>(
      "/api/v1/auth/verify-otp",
      { method: "POST", body: { pass_id, phone, otp }, token },
    ),

  devOtp: (phone: string) =>
    request<{ phone: string; otp: string }>(`/api/v1/auth/dev/otp/${phone}`),
};

// Passes
export const passesApi = {
  myPasses: (token: string) =>
    request<Pass[]>("/api/v1/passes/my", { token }),

  permanentPass: (token: string) =>
    request<PermanentPass>("/api/v1/passes/permanent", { token }),

  applyVisitor: (token: string, data: VisitorPassData) =>
    request<Pass>("/api/v1/passes/visitor", { method: "POST", body: data, token }),

  applyConference: (token: string, data: ConferencePassData) =>
    request<Pass>("/api/v1/passes/conference", { method: "POST", body: data, token }),

  pendingVisitor: (token: string) =>
    request<Pass[]>("/api/v1/passes/pending/visitor", { token }),

  pendingConference: (token: string) =>
    request<Pass[]>("/api/v1/passes/pending/conference", { token }),

  approve: (token: string, passId: number, approved: boolean, rejection_reason?: string) =>
    request<Pass>(`/api/v1/passes/${passId}/approve`, {
      method: "PATCH",
      body: { approved, rejection_reason },
      token,
    }),

  getPass: (token: string, passId: number) =>
    request<Pass>(`/api/v1/passes/${passId}`, { token }),
};

// Gate
export const gateApi = {
  scanQr: (token: string, qrToken: string) =>
    request<Pass>(`/api/v1/gate/scan/qr?token=${encodeURIComponent(qrToken)}`, {
      method: "POST",
      token,
    }),

  scanRfid: (token: string, tag_number: string) =>
    request<RFIDScanResult>("/api/v1/gate/scan/rfid", {
      method: "POST",
      body: { tag_number },
      token,
    }),

  activePasses: (token: string) =>
    request<Pass[]>("/api/v1/gate/active-passes", { token }),

  todayLog: (token: string) =>
    request<AuditEntry[]>("/api/v1/gate/today-log", { token }),
};

// Vehicles (RFID)
export const vehiclesApi = {
  submitRfid: (token: string, data: { tag_number: string; vehicle_number: string; vehicle_model: string }) =>
    request<RFIDTag>("/api/v1/vehicles/rfid", { method: "POST", body: data, token }),

  myTags: (token: string) =>
    request<RFIDTag[]>("/api/v1/vehicles/rfid/my", { token }),

  allTags: (token: string) =>
    request<RFIDTag[]>("/api/v1/vehicles/rfid", { token }),

  approveTag: (token: string, tagId: number) =>
    request<RFIDTag>(`/api/v1/vehicles/rfid/${tagId}/approve`, { method: "PATCH", token }),

  revokeTag: (token: string, tagId: number) =>
    request<RFIDTag>(`/api/v1/vehicles/rfid/${tagId}/revoke`, { method: "PATCH", token }),
};

// Admin
export const adminApi = {
  users: (token: string, params?: { role?: string; limit?: number; offset?: number }) => {
    const qs = new URLSearchParams();
    if (params?.role) qs.set("role", params.role);
    if (params?.limit) qs.set("limit", String(params.limit));
    if (params?.offset) qs.set("offset", String(params.offset));
    return request<User[]>(`/api/v1/admin/users?${qs}`, { token });
  },

  createUser: (token: string, data: CreateUserData) =>
    request<User>("/api/v1/admin/users", { method: "POST", body: data, token }),

  auditLogs: (token: string, params?: { action?: string; entity_type?: string; limit?: number }) => {
    const qs = new URLSearchParams();
    if (params?.action) qs.set("action", params.action);
    if (params?.entity_type) qs.set("entity_type", params.entity_type);
    if (params?.limit) qs.set("limit", String(params.limit));
    return request<AuditLog[]>(`/api/v1/admin/audit-logs?${qs}`, { token });
  },
};

// Types
export interface Pass {
  id: number;
  pass_type: string;
  status: string;
  applicant_id: number;
  applicant?: { id: number; full_name: string; email: string; role: string; campus_id?: string };
  visitor_name?: string;
  visitor_phone?: string;
  visitor_email?: string;
  purpose?: string;
  conference_name?: string;
  visit_date?: string;
  valid_from?: string;
  valid_until?: string;
  entry_time?: string;
  exit_time?: string;
  rejection_reason?: string;
  parent_pass_id?: number;
  created_at: string;
  approved_at?: string;
  used_at?: string;
}

export interface PermanentPass {
  pass_id: number;
  qr_image_base64: string;
  holder_name: string;
  role: string;
  campus_id?: string;
  valid_until: string;
}

export interface RFIDTag {
  id: number;
  tag_number: string;
  vehicle_number: string;
  vehicle_model: string;
  faculty_id: number;
  status: string;
  activated_at?: string;
  created_at: string;
}

export interface RFIDScanResult {
  tag_number: string;
  vehicle_number: string;
  vehicle_model: string;
  faculty_name: string;
  faculty_email: string;
  faculty_phone: string;
  status: string;
}

export interface User {
  id: number;
  email: string;
  full_name: string;
  role: string;
  phone: string;
  campus_id?: string;
  is_active: boolean;
  created_at: string;
}

export interface AuditLog {
  id: number;
  actor_id?: number;
  action: string;
  entity_type: string;
  entity_id?: number;
  metadata_json?: string;
  timestamp: string;
}

export interface AuditEntry {
  id: number;
  action: string;
  entity_id?: number;
  metadata?: string;
  timestamp: string;
}

export interface VisitorPassData {
  visitor_name: string;
  visitor_phone: string;
  purpose: string;
  visit_date: string;
  entry_time: string;
  exit_time: string;
}

export interface ConferencePassData {
  participant_name: string;
  participant_email: string;
  participant_phone: string;
  conference_name: string;
  valid_from: string;
  valid_until: string;
}

export interface CreateUserData {
  email: string;
  password: string;
  role: string;
  full_name: string;
  phone: string;
  campus_id?: string;
}
