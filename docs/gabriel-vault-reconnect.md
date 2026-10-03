# Reconnecting your Vault — for Gabriel

Written 3 Oct 2026. Replaces the earlier "Vault check" page, which was only for working
out what had gone wrong.

## What happened

Your Vault and Tyler's were connected to two different databases, and had been since
early August. That's why nothing either of you added ever showed up for the other —
you each thought the other wasn't using it.

**Everything you had has been copied across.** Tyler merged both sides into one database
on 3 October. It now holds 94 accounts, 76 of them Instagram, including all of yours.
Nothing was overwritten and nothing was deleted.

One step is left: pointing your Vault at that database. Until you do, you're still
writing to the old one and Tyler still won't see your changes.

## Before you start

Export a backup, so there's a copy outside both databases:

**Settings → Backup → export the JSON**, and keep the file.

You almost certainly won't need it. Do it anyway.

## Reconnecting

1. Open the Vault.
2. Go to **Settings**.
3. Click **"Disconnect this PC from the vault"**.
4. When it asks for the connection, enter the url and key Tyler sends you separately.
5. The Vault reloads and you should see **94 accounts**, not your old 40-odd.

That's it.

> Do this **in the app**. Editing `settings.json` by hand doesn't work — the Vault
> rewrites that file when it closes and your change is silently thrown away.

## Checking it worked

- You should see roughly **94 accounts**, including Tyler's as well as your own.
- Add a test entry, call it anything. Tell Tyler. It should appear on his screen within
  a few seconds. Delete it afterwards.

If the count still looks like your old number, stop and tell Tyler rather than
re-entering anything by hand.

## If something looks missing

Tell Tyler before you fix it yourself. Your old database still exists, untouched, and
is being kept as a fallback for a week — anything that didn't make it can be copied
across. Retyping things by hand creates duplicates that are tedious to unpick.

Two known gaps, both expected:

- **Canvases** aren't in the JSON backup format, so they weren't part of the merge. If
  you'd built any, say so and Tyler will sort them out separately.
- **Proxy'easy and Zoho** aren't there. Those were deliberately deleted on 18 September
  and were not restored.

## One thing to know

The Vault has no login — the connection key *is* the key to everything in it. Don't put
it in Telegram, WhatsApp, email or a screenshot, and don't paste it into a chat with an
assistant. If it ever does end up somewhere public, tell Tyler and it gets rotated.
