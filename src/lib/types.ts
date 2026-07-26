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
  created_at: string;
  updated_at: string;
  updated_by: User;
}

export type EntryInput = Omit<Entry, 'id' | 'created_at' | 'updated_at' | 'updated_by'>;

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
  activity: Activity[];
}
