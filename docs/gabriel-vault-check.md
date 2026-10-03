> **SUPERSEDED — do not send this to Gabriel.**
> This was the diagnostic guide, written before the merge. The merge has since happened
> and step 4 ("don't reconnect, don't switch") is now exactly wrong.
> Send `gabriel-vault-reconnect.md` instead. Kept only as a record of the diagnosis.

# Vault check — for Gabriel

Written 3 Oct 2026.

Tyler's Vault shows 6 Instagram accounts. Yours shows more than 40. That should be
impossible: the Vault is one shared database and everything syncs both ways within
seconds. So one of the two installs is almost certainly pointed at a different
database.

**Nothing is lost.** Whatever you can see in your Vault is safely stored in whichever
database you are connected to. This page is only about finding out which one.

**Please don't change the connection, and don't delete anything, until Tyler has your
answers.** Switching now would make your 40 accounts disappear from your screen — they
would still exist, but it looks alarming and people start retyping everything by hand.

---

## 1. Make a backup first (2 minutes)

Before anything else, so there is a copy outside the database:

1. Open the Vault.
2. Go to **Settings → Backup** and export the **JSON backup**.
3. Also export the **CSV** while you're there.
4. Save both somewhere you'll find them again, and don't delete them.

## 2. Find which database you're connected to

1. Press **Windows + R**.
2. Paste this and press Enter:

   ```
   %APPDATA%\T&G Vault
   ```

3. Open **settings.json** (Notepad is fine — right-click → Open with → Notepad).
4. Near the top there's a `"connection"` section with a `"url"` that looks like:

   ```
   https://something.supabase.co
   ```

5. **Send Tyler that url.** Just the url — not the key next to it.

Tyler's install uses `https://<tyler-project-ref>.supabase.co`. If yours is
different, that's the whole explanation and it's an easy fix.

## 3. Tell Tyler roughly what's in your Vault

So we know which way to merge. Rough numbers are fine:

- How many **entries** (accounts) in total?
- How many **creators**?
- Have you used any of these, and roughly how much is in them?
  - Secure notes
  - Creator dossiers / documents
  - Earnings
  - The board (cards)
  - Canvases
  - Daily figures

The reason: if your database holds most of the real work, it's less risky to move
Tyler's handful of entries into yours than the other way round. Whichever side has
more wins.

## 4. Then stop

That's everything for now. Don't reconnect, don't switch, don't tidy anything up.
Once Tyler has the url and the counts, he'll send you the exact next step — and your
data gets copied across **before** you change any setting, not after.

---

### If you'd rather just check quickly

If the url in step 2 already matches `<tyler-project-ref>`, say so straight away —
that rules out the simple explanation and we'll look at something else instead.
