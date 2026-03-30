export type AuthUser = {
  id: number;
  username?: string;
  full_name?: string;
  email?: string;
  role: "admin" | "lawyer" | "assistant" | "client" | "pending";
  is_approved: boolean;
  client_id?: number | null;
};

export type AuthResponse = {
  token: string;
  user: AuthUser;
};

export type ClientEntry = {
  id: number;
  full_name: string;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  zip_code?: string | null;
  city?: string | null;
  state?: string | null;
};

export type CaseEntry = {
  id: number;
  name: string;
  client_id: number;
  owner_id: number | null;
  status: string;
  deadline: string | null;
  short_description: string | null;
  client_name?: string;
  owner_username?: string;
  owner_full_name?: string;
  is_owner?: boolean;
  is_assigned?: boolean;
  can_edit?: boolean;
};

export type CaseDocument = {
  id?: number;
  case_id?: number;
  original_name: string;
  s3_key: string;
  mime_type?: string | null;
  encryption_iv?: string | null;
  encryption_tag?: string | null;
  uploaded_at?: string | null;
};

export type PlaceholderFile = {
  original_name: string;
  s3_key: string;
  mime_type?: string | null;
  encryption_iv?: string | null;
  encryption_tag?: string | null;
};

export type CasePlaceholder = {
  id: number;
  case_id?: number;
  name: string;
  status: string;
  attached_files: PlaceholderFile[];
};

export type AdminUser = AuthUser;

export type CaseAssignmentUser = AuthUser & {
  assigned_at?: string;
};

export type RemoteTimelineEvent = {
  case_id: number;
  case_name: string;
  title: string;
  description: string;
  occurred_at: string;
  kind: string;
};
