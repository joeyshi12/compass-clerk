# Compass Clerk (Google Apps Script)

A little clerk that turns your Compass Card order-receipt emails (in Gmail)
into clean, single-page PDF receipts for reimbursement. On a time trigger it
finds newly labeled receipts, parses the order details, renders a clean PDF,
emails it to a configured address, and archives a copy to Drive.

## Files
- `CompassClerk.js` - the Apps Script source (deployed as `CompassClerk.gs`).
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
Edit the `CONFIG` block at the top of `CompassClerk.js` (Gmail label,
recipient address, identity, card masking, poll interval).

## Version-control workflow (clasp + git)
One-time setup:
```bash
npm install -g @google/clasp
clasp login                          # browser OAuth (one time)
# put your real Script ID in .clasp.json
#   (Apps Script editor -> Project Settings -> IDs)
clasp push -f                        # push this local code to the cloud project
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
- `clasp` only pushes script files (`.js`, `.html`) and `appsscript.json`;
  `README.md` and other files are ignored by `clasp push`.
