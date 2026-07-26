import { supabase } from './supabase';
import type {
  Activity,
  Creator,
  Entry,
  EntryInput,
  User,
  VaultData,
} from './types';

export async function fetchAll(): Promise<VaultData> {
  const [creators, entries, activity] = await Promise.all([
    supabase.from('creators').select('*').order('name'),
    supabase.from('entries').select('*').order('service_name'),
    supabase
      .from('activity')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(200),
  ]);
  if (creators.error) throw creators.error;
  if (entries.error) throw entries.error;
  if (activity.error) throw activity.error;
  return {
    creators: creators.data as Creator[],
    entries: entries.data as Entry[],
    activity: activity.data as Activity[],
  };
}

async function logActivity(
  who: User,
  action: Activity['action'],
  entryLabel: string,
): Promise<void> {
  // Best-effort: never block the main mutation on the log write.
  await supabase
    .from('activity')
    .insert({ who, action, entry_label: entryLabel });
}

export async function createEntry(
  input: EntryInput,
  who: User,
  label: string,
): Promise<void> {
  const { error } = await supabase
    .from('entries')
    .insert({ ...input, updated_by: who });
  if (error) throw error;
  await logActivity(who, 'created', label);
}

export async function updateEntry(
  id: string,
  input: EntryInput,
  who: User,
  label: string,
): Promise<void> {
  const { error } = await supabase
    .from('entries')
    .update({ ...input, updated_by: who, updated_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw error;
  await logActivity(who, 'updated', label);
}

export async function deleteEntry(
  id: string,
  who: User,
  label: string,
): Promise<void> {
  const { error } = await supabase.from('entries').delete().eq('id', id);
  if (error) throw error;
  await logActivity(who, 'deleted', label);
}

export async function createCreator(
  name: string,
  color: string,
): Promise<Creator> {
  const { data, error } = await supabase
    .from('creators')
    .insert({ name, color })
    .select()
    .single();
  if (error) throw error;
  return data as Creator;
}

export async function deleteCreator(id: string): Promise<void> {
  const { error } = await supabase.from('creators').delete().eq('id', id);
  if (error) throw error;
}
