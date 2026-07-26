export type User = 'Tyler' | 'Gabriel';

export interface Creator {
  id: string;
  name: string;
  color: string;
}

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
  activity: Activity[];
}
