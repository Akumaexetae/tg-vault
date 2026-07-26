export type User = 'Tyler' | 'Gabriel';

// --- Creators --------------------------------------------------------------
export type CreatorKind = 'creator' | 'agency';
export type CreatorStatus =
  | 'prospect'
  | 'onboarding'
  | 'active'
  | 'paused'
  | 'ended';
export type PayoutMethod = 'iban' | 'paypal' | 'wise' | 'crypto' | 'other';
export type ContractStatus = 'none' | 'sent' | 'signed';
export type PayoutSchedule = 'weekly' | 'monthly';

export interface SocialLink {
  label: string;
  url: string;
}

export interface Creator {
  id: string;
  name: string; // stage name
  color: string;
  kind: CreatorKind;
  status: CreatorStatus;
  // Identity
  legal_name: string | null;
  date_of_birth: string | null;
  nationality: string | null;
  /** A reference like "FR passport ••••4821" — never a scan (see spec §3). */
  id_reference: string | null;
  email: string | null;
  phone: string | null;
  telegram: string | null;
  timezone: string | null;
  // Commercial
  revenue_share: number | null; // the agency's cut, 0–100
  start_date: string | null;
  contract_status: ContractStatus;
  notice_period_days: number | null;
  minimum_guarantee: number | null;
  // Payout
  payout_method: PayoutMethod | null;
  payout_details: string | null;
  payout_currency: string | null;
  payout_schedule: PayoutSchedule | null;
  // Platform
  of_url: string | null;
  getmysocial_url: string | null;
  socials: SocialLink[];
  subscriber_count: number | null;
  subscriber_count_as_of: string | null;
  drive_folder_url: string | null;
  /** Path in the public `avatars` bucket; null falls back to the initial. */
  avatar_path: string | null;
  // Meta
  created_at: string;
  updated_at: string;
  updated_by: User;
}

export type CreatorInput = Omit<
  Creator,
  'id' | 'created_at' | 'updated_at' | 'updated_by'
>;

export interface CreatorDocument {
  id: string;
  creator_id: string;
  label: string;
  kind: 'contract' | 'id' | 'other';
  /** Exactly one of url / storage_path is set. */
  url: string | null;
  storage_path: string | null;
  size_bytes: number | null;
  created_at: string;
  updated_by: User;
}

export interface CreatorEarning {
  id: string;
  creator_id: string;
  month: string; // ISO date, first of the month
  gross: number;
  currency: string;
  notes: string | null;
  created_at: string;
  updated_by: User;
}

// --- Credentials -----------------------------------------------------------
export interface CustomField {
  key: string;
  value: string;
}

export interface PasswordChange {
  password: string;
  changed_at: string;
  changed_by: User;
}

export interface Entry {
  id: string;
  service_name: string;
  service_key: string; // catalog key, or 'custom'
  service_url: string;
  creator_id: string;
  username: string;
  password: string;
  totp_secret: string | null;
  recovery: string | null;
  custom_fields: CustomField[];
  notes: string | null;
  /** "host:port" or "user:pass@host:port" — routes this account's login window. */
  proxy: string | null;
  pinned: boolean;
  history: PasswordChange[];
  created_at: string;
  updated_at: string;
  updated_by: User;
}

/** Fields the add/edit form owns. Pin + history are managed separately. */
export type EntryInput = Omit<
  Entry,
  'id' | 'created_at' | 'updated_at' | 'updated_by' | 'pinned' | 'history'
>;

export interface SecureNote {
  id: string;
  title: string;
  body: string;
  creator_id: string | null;
  created_at: string;
  updated_at: string;
  updated_by: User;
}

export interface Activity {
  id: string;
  who: User;
  action: 'created' | 'updated' | 'deleted';
  entry_label: string;
  created_at: string;
}

export interface VaultData {
  creators: Creator[];
  entries: Entry[];
  notes: SecureNote[];
  documents: CreatorDocument[];
  earnings: CreatorEarning[];
  activity: Activity[];
}
