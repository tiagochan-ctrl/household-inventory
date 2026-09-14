# Household Inventory

This is your full-featured shared pantry + shopping list app, wired up to your
existing Firebase project (`household-inventory-6f8b5`) so it syncs live
between you and your wife on any device — no accounts, no paid plans.

I've already tested this: it installs and builds with **zero errors**.

## What's already done for you

- Your real Firebase config is already in `src/App.jsx` — you don't need to
  touch it.
- All dependencies are declared in `package.json`.
- The whole thing is already verified to compile cleanly.

## Deploy it (recommended: GitHub → Vercel)

This is the most reliable path — it avoids the file-corruption issues that
come from copy-pasting code through chat windows or text editors.

1. Go to [github.com](https://github.com), create a free account if you don't
   have one, and create a new repository named `household-inventory`.
2. Upload this **entire folder** to that repository (GitHub's web UI lets you
   drag-and-drop a folder of files directly — use "Add file > Upload files").
3. Go to [vercel.com](https://vercel.com), sign in with your GitHub account.
4. Click **Add New > Project**, select your `household-inventory` repo, and
   click **Deploy**. Vercel will auto-detect this as a Vite project — you
   don't need to change any settings.
5. In a minute or two you'll get a live URL like
   `https://household-inventory-xyz.vercel.app`. Send that to your wife —
   she can open it on any phone or browser, no login required.

## One thing to check in Firebase

Go to [console.firebase.google.com](https://console.firebase.google.com) →
your project → Build → Realtime Database → **Rules** tab, and make sure it
says:

```json
{
  "rules": {
    ".read": true,
    ".write": true
  }
}
```

If it doesn't, paste that in and click Publish. This is what lets both of you
read and write the shared list without logging in. (Anyone with your app's
URL could technically also read/write this data — fine for a household
grocery list, but worth knowing.)

## Running it locally first (optional, but a good sanity check)

If you want to see it working on your own computer before deploying:

```
npm install
npm run dev
```

Then open the local address it prints (usually `http://localhost:5173`).
