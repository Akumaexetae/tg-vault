# Merging the two Vault databases

Written 3 Oct 2026.

## What happened

Tyler's install and Gabriel's install are pointed at **two different Supabase
projects**:

- Tyler — `<tyler-project-ref>`
- Gabriel — `<gabriel-old-project-ref>`

They share a common ancestor (the same seed data, diverged around 3 Aug 2026),
so the July entries exist on both sides with **identical primary keys**. After
that they drifted: Gabriel added ~70 warmed Instagram accounts to his, Tyler
added the TEST accounts, Lola, Substy, Telegram, the secure notes and earnings
to his. Neither install was broken — they were simply writing to different
databases, so nothing ever appeared to sync.

**Tyler's project is the one being kept**, because it holds the creator Lola,
the earnings and the secure notes — the business layer, which is harder to
recreate than a list of logins.

| | Tyler (`yhhd…`) | Gabriel (`bwzr…`) |
|---|---|---|
| Creators | 5 (incl. Lola) | 4 |
| Entries | 24 | ~89 |
| Instagram | 6 | 72 |
| Secure notes | 4 | ? |
| Earnings | 4 | ? |

Because the creator ids match on both sides, entries can be inserted with no
remapping, and shared rows dedupe themselves on primary key.

---

## Before you start

**Gabriel stops adding accounts** until step 9 is done. His export is a snapshot;
anything added after it is not carried across.

---

## 1. Get both backups

1. **Gabriel**: Vault → Settings → Backup → export the **JSON**. Send Tyler the
   file itself (not pasted into a chat — it is a plaintext credential dump).
2. **Tyler**: save it as `C:\Users\Tyler\Desktop\gab-vault.json`.
3. **Tyler**: export your own JSON backup too, as a rollback point.

## 2. Add the new column (do this first)

In **Tyler's** Supabase SQL editor, run `supabase/migration-011.sql`. It adds
`entries.account_created_at`. Running it before the merge means the column
exists when Gabriel's rows land.

## 3. Generate the merge SQL

```
cd "C:\Users\Tyler\Desktop\TG Agency\Apps\TG Vault"
node scripts/build-merge-sql.js "C:\Users\Tyler\Desktop\gab-vault.json"
```

Writes `TGvault-Backups/merge-<date>.sql`. That folder is gitignored, so the
credentials inside never reach git.

## 4. Read it

Skim the generated file. Every statement is an insert, guarded twice:

- `on conflict (id) do nothing` — rows you both already have.
- `where not exists (service_key + username)` — the same account re-added by
  hand on the other side.

There are **no deletes and no updates**. Your existing rows cannot be
overwritten, and running the file twice changes nothing.

## 5. Run it

Paste the file into **Tyler's** Supabase SQL editor and run. It is wrapped in a
transaction, so it either all lands or none of it does.

## 6. Verify in SQL

```sql
select service_key, count(*) from entries group by 1 order by 2 desc;
select count(*) from creators;
```

Expect Instagram around **76** (6 + 70) and creators still **5**.

## 7. Verify in the app

Open the Vault. You should see Gabriel's accounts. If the list still looks
short, clear any search box or creator filter first.

## 8. Switch Gabriel across

1. Gabriel **closes** the Vault completely.
2. He opens `%APPDATA%\T&G Vault\settings.json` in Notepad.
3. He replaces the `url` and `key` inside `"connection"` with Tyler's.
   - Tyler's url: `https://<tyler-project-ref>.supabase.co`
   - Tyler's key: read it from Tyler's own `settings.json` and send it by
     something other than chat.
4. He saves and reopens the Vault.

## 9. Confirm the sync works

With both apps open, Tyler adds a throwaway entry. It should appear on
Gabriel's screen within a few seconds. Then Gabriel adds one and Tyler watches.
Delete both afterwards.

That test is the point of the whole exercise — until it passes, assume nothing.

---

## Afterwards

- **Keep Gabriel's old project for at least a week.** Do not delete it. It is the
  fallback if anything was missed.
- **Canvases are not in the JSON backup.** If Gabriel used the canvas feature,
  that data needs copying separately.
- **Rotate the credentials** that were pasted into chat on 3 Oct: Anthropic,
  Firecrawl, Hetzner, SMSPool, Webshare, and the CRM logins.

## If something looks wrong

Nothing is destructive, so the recovery is simple: Gabriel's database is
untouched and still holds everything he had. Re-export, re-run the generator,
run the SQL again — the guards make repeat runs harmless.
