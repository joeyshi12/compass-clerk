# Compass Clerk (Google Apps Script)

A little clerk that turns your Compass Card order-receipt emails (in Gmail)
into clean, single-page PDF receipts for reimbursement. On a time trigger it
finds newly labeled receipts, parses the order details, renders a clean PDF,
emails it to a configured address, and archives a copy to Drive.

## Files
- `CompassClerk.js` - the Apps Script source (deployed as `CompassClerk.gs`).
- `config.js` - all configuration (git-ignored, copied from `config.example.js`).
- `config.example.js` - template config; copy to `config.js` and fill in.
- `appsscript.json` - Apps Script manifest (timezone, runtime).
- `.clasp.json` - links this folder to the cloud Apps Script project (set `scriptId`).

## Run targets (functions you run from the editor)
- `setup()` - run once: installs the time trigger, authorizes, does a first pass.
- `processReceipts()` - the trigger target; safe to run manually.
- `reprocess(query)` - regenerate + re-email for already-processed emails
  (use after the receipt email format changes).
- `dryRun(query)` - parse-only preview, no PDFs/email; for debugging.

Everything else (suffixed with `_`) is an internal helper - do not run directly.

## Configuration
All configuration lives in a single `config.js`, kept out of the repo:

- `cp config.example.js config.js`, fill it in, `clasp push`.
  It's git-ignored but pushed by clasp.
- `config.js` defines the global `CONFIG` object the script reads; edit any
  value there.

`setup()` logs a reminder if a required value is missing.

## Version-control workflow (clasp + git)
One-time setup:
```bash
npm install -g @google/clasp
clasp login                          # browser OAuth (one time)
# set your Script ID in .clasp.json (editor -> Project Settings -> IDs)
cp .clasp.example.json .clasp.json           # then set your Script ID
cp config.example.js config.js               # fill in your values
clasp push -f                        # deploy code + config.js
```

Daily loop:
```bash
# edit CompassClerk.js locally
git add -A && git commit -m "..."
clasp push                           # deploy to Apps Script
git push                             # publish to GitHub
```

Pull changes made in the web editor back down:
```bash
clasp pull
```

## Notes
- `clasp` stores OAuth credentials in `~/.clasprc.json` (your home dir, not this
  repo). It is git-ignored here as a safeguard - never commit it.
- `.claspignore` limits `clasp push` to `CompassClerk.js`, `appsscript.json`,
  and `config.js`.
