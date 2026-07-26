import { changedFieldNames } from './creators/activity';
import { getClient } from './supabase';
import type {
  Activity,
  Creator,
  CreatorDocument,
  CreatorEarning,
  CreatorInput,
  Entry,
  EntryInput,
  PasswordChange,
  SecureNote,
  User,
  VaultData,
} from './types';

const HISTORY_LIMIT = 10;

export async function fetchAll(): Promise<VaultData> {
  const [creators, entries, notes, documents, earnings, activity] = await Promise.all([
    getClient().from('creators').select('*').order('name'),
    getClient().from('entries').select('*').order('service_name'),
    getClient().from('secure_notes').select('*').order('title'),
    getClient().from('creator_documents').select('*').order('created_at'),
    getClient().from('creator_earnings').select('*').order('month'),
    getClient()
      .from('activity')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(200),
  ]);
  if (creators.error) throw creators.error;
  if (entries.error) throw entries.error;
  if (notes.error) throw notes.error;
  if (documents.error) throw documents.error;
  if (earnings.error) throw earnings.error;
  if (activity.error) throw activity.error;
  return {
    creators: creators.data as Creator[],
    entries: entries.data as Entry[],
    notes: notes.data as SecureNote[],
    documents: documents.data as CreatorDocument[],
    earnings: earnings.data as CreatorEarning[],
    activity: activity.data as Activity[],
  };
}

async function logActivity(
  who: User,
  action: Activity['action'],
  entryLabel: string,
): Promise<void> {
  await getClient()
    .from('activity')
    .insert({ who, action, entry_label: entryLabel });
}

export async function createEntry(
  input: EntryInput,
  who: User,
  label: string,
): Promise<void> {
  const { error } = await getClient()
    .from('entries')
    .insert({ ...input, updated_by: who });
  if (error) throw error;
  await logActivity(who, 'created', label);
}

export async function updateEntry(
  previous: Entry,
  input: EntryInput,
  who: User,
  label: string,
): Promise<void> {
  // Keep the outgoing password so a failed rotation is recoverable.
  const changed = previous.password && previous.password !== input.password;
  const history: PasswordChange[] = changed
    ? [
        {
          password: previous.password,
          changed_at: new Date().toISOString(),
          changed_by: who,
        },
        ...(previous.history ?? []),
      ].slice(0, HISTORY_LIMIT)
    : (previous.history ?? []);

  const { error } = await getClient()
    .from('entries')
    .update({
      ...input,
      history,
      updated_by: who,
      updated_at: new Date().toISOString(),
    })
    .eq('id', previous.id);
  if (error) throw error;
  await logActivity(who, 'updated', label);
}

export async function setPinned(id: string, pinned: boolean): Promise<void> {
  const { error } = await getClient().from('entries').update({ pinned }).eq('id', id);
  if (error) throw error;
}

export async function deleteEntry(
  id: string,
  who: User,
  label: string,
): Promise<void> {
  const { error } = await getClient().from('entries').delete().eq('id', id);
  if (error) throw error;
  await logActivity(who, 'deleted', label);
}

export async function createCreator(
  name: string,
  color: string,
): Promise<Creator> {
  const { data, error } = await getClient()
    .from('creators')
    .insert({ name, color })
    .select()
    .single();
  if (error) throw error;
  return data as Creator;
}

// --- Creator dossiers ------------------------------------------------------
export async function createCreatorFull(
  input: CreatorInput,
  who: User,
): Promise<Creator> {
  const { data, error } = await getClient()
    .from('creators')
    .insert({ ...input, updated_by: who })
    .select()
    .single();
  if (error) throw error;
  await logActivity(who, 'created', `creator ${input.name}`);
  return data as Creator;
}

export async function updateCreator(
  before: Creator,
  input: CreatorInput,
  who: User,
): Promise<void> {
  const { error } = await getClient()
    .from('creators')
    .update({ ...input, updated_by: who, updated_at: new Date().toISOString() })
    .eq('id', before.id);
  if (error) throw error;
  const fields = changedFieldNames(before, input);
  if (fields.length > 0) {
    // Field NAMES only — values must never reach the activity feed.
    await logActivity(who, 'updated', `${input.name}'s ${fields.join(', ')}`);
  }
}

/** A reason this creator can't be deleted, or null if she can be. */
export function canDeleteCreator(id: string, data: VaultData): string | null {
  const logins = data.entries.filter((e) => e.creator_id === id).length;
  const docs = data.documents.filter((d) => d.creator_id === id).length;
  const months = data.earnings.filter((e) => e.creator_id === id).length;
  const held = [
    logins && `${logins} login${logins === 1 ? '' : 's'}`,
    docs && `${docs} document${docs === 1 ? '' : 's'}`,
    months && `${months} month${months === 1 ? '' : 's'} of earnings`,
  ].filter(Boolean);
  if (held.length === 0) return null;
  return `Still holds ${held.join(', ')}. Archive instead to keep the history.`;
}

export async function deleteCreator(
  id: string,
  who: User,
  name: string,
): Promise<void> {
  const { error } = await getClient().from('creators').delete().eq('id', id);
  if (error) throw error;
  await logActivity(who, 'deleted', `creator ${name}`);
}

/**
 * Supabase reports a missing bucket as a bare "Bucket not found", which tells
 * nobody what to do. Name the bucket and the fix instead.
 */
function storageError(error: { message: string }, bucket: string): Error {
  if (/bucket not found/i.test(error.message)) {
    return new Error(
      `The "${bucket}" storage bucket doesn't exist yet. In Supabase go to ` +
        `Storage → New bucket, name it "${bucket}"` +
        (bucket === 'avatars' ? ', make it public' : '') +
        ', then try again.',
    );
  }
  return new Error(error.message);
}

/** Uploads a resized avatar, overwriting any previous one for this creator. */
export async function uploadAvatar(
  creatorId: string,
  blob: Blob,
): Promise<string> {
  const path = `${creatorId}.jpg`;
  const { error } = await getClient()
    .storage.from('avatars')
    .upload(path, blob, { upsert: true, contentType: 'image/jpeg' });
  if (error) throw storageError(error, 'avatars');
  return path;
}

/** Public URL for an avatar, cache-busted so a replacement shows immediately. */
export function avatarUrl(path: string | null, updatedAt?: string): string | null {
  if (!path) return null;
  const { data } = getClient().storage.from('avatars').getPublicUrl(path);
  return updatedAt
    ? `${data.publicUrl}?v=${encodeURIComponent(updatedAt)}`
    : data.publicUrl;
}

export async function uploadDocumentFile(
  file: File,
  creatorId: string,
): Promise<string> {
  const path = `${creatorId}/${Date.now()}-${file.name}`;
  const { error } = await getClient().storage.from('documents').upload(path, file);
  if (error) throw storageError(error, 'documents');
  return path;
}

export async function documentUrl(doc: CreatorDocument): Promise<string | null> {
  if (doc.url) return doc.url;
  if (!doc.storage_path) return null;
  const { data, error } = await getClient()
    .storage.from('documents')
    .createSignedUrl(doc.storage_path, 60 * 5);
  if (error) throw error;
  return data.signedUrl;
}

export async function saveDocument(
  doc: {
    creator_id: string;
    label: string;
    kind: CreatorDocument['kind'];
    url: string | null;
    storage_path: string | null;
    size_bytes: number | null;
  },
  who: User,
): Promise<void> {
  const { error } = await getClient()
    .from('creator_documents')
    .insert({ ...doc, updated_by: who });
  if (error) throw error;
  await logActivity(who, 'created', `document “${doc.label}”`);
}

export async function deleteDocument(
  id: string,
  who: User,
  label: string,
): Promise<void> {
  const { error } = await getClient().from('creator_documents').delete().eq('id', id);
  if (error) throw error;
  await logActivity(who, 'deleted', `document “${label}”`);
}

export async function saveEarning(
  creatorId: string,
  month: string,
  gross: number,
  currency: string,
  who: User,
): Promise<void> {
  const { error } = await getClient()
    .from('creator_earnings')
    .upsert(
      { creator_id: creatorId, month, gross, currency, updated_by: who },
      { onConflict: 'creator_id,month' },
    );
  if (error) throw error;
  await logActivity(who, 'updated', `earnings for ${month.slice(0, 7)}`);
}

// --- Secure notes ----------------------------------------------------------
export async function saveNote(
  note: { id?: string; title: string; body: string; creator_id: string | null },
  who: User,
): Promise<void> {
  if (note.id) {
    const { error } = await getClient()
      .from('secure_notes')
      .update({
        title: note.title,
        body: note.body,
        creator_id: note.creator_id,
        updated_by: who,
        updated_at: new Date().toISOString(),
      })
      .eq('id', note.id);
    if (error) throw error;
    await logActivity(who, 'updated', `note “${note.title}”`);
  } else {
    const { error } = await getClient().from('secure_notes').insert({
      title: note.title,
      body: note.body,
      creator_id: note.creator_id,
      updated_by: who,
    });
    if (error) throw error;
    await logActivity(who, 'created', `note “${note.title}”`);
  }
}

export async function deleteNote(
  id: string,
  who: User,
  title: string,
): Promise<void> {
  const { error } = await getClient().from('secure_notes').delete().eq('id', id);
  if (error) throw error;
  await logActivity(who, 'deleted', `note “${title}”`);
}
