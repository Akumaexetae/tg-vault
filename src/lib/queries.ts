import { getClient } from './supabase';
import type {
  Activity,
  Creator,
  Entry,
  EntryInput,
  PasswordChange,
  SecureNote,
  User,
  VaultData,
} from './types';

const HISTORY_LIMIT = 10;

export async function fetchAll(): Promise<VaultData> {
  const [creators, entries, notes, activity] = await Promise.all([
    getClient().from('creators').select('*').order('name'),
    getClient().from('entries').select('*').order('service_name'),
    getClient().from('secure_notes').select('*').order('title'),
    getClient()
      .from('activity')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(200),
  ]);
  if (creators.error) throw creators.error;
  if (entries.error) throw entries.error;
  if (notes.error) throw notes.error;
  if (activity.error) throw activity.error;
  return {
    creators: creators.data as Creator[],
    entries: entries.data as Entry[],
    notes: notes.data as SecureNote[],
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
