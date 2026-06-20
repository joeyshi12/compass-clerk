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
Configuration is split so the code stays generic and open-sourceable:

- **Non-personal defaults** live in the `DEFAULTS` block at the top of
  `CompassClerk.js` (Gmail label, Drive folder, `SEND_EMAIL`, card masking,
  poll interval). Edit these in code as you like.
- **Personal values** are read from **Script Properties** at runtime and never
  belong in the repo:
  - `NAME` - name printed on the receipt
  - `ADDRESS_HTML` - billing/shipping address (HTML, use `<br>` for line breaks)
  - `EMAIL_TO` - recipient address when `SEND_EMAIL` is true

Set the personal values once in the Apps Script editor:
**Project Settings (gear icon) -> Script Properties -> Add script property**.
Any `DEFAULTS` key can also be overridden by adding a Script Property with the
same name (e.g. `POLL_MINUTES` = `5`, or `SEND_EMAIL` = `false`).

Because the private config lives in Script Properties (in the cloud project),
`clasp push` only ever deploys the generic code -- your personal values are
never overwritten and never committed. Running `setup()` logs a reminder if any
required property is missing.

## Version-control workflow (clasp + git)
One-time setup:
```bash
npm install -g @google/clasp
clasp login                          # browser OAuth (one time)
# put your real Script ID in .clasp.json
#   (Apps Script editor -> Project Settings -> IDs)
clasp push -f                        # push this local code to the cloud project
# then set NAME / ADDRESS_HTML / EMAIL_TO in Project Settings -> Script Properties
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
