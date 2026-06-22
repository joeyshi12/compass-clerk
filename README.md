# Compass Clerk (Google Apps Script)

An apps script that turns your Compass Card order-receipt emails (in Gmail)
into clean PDF receipts. On a time trigger it finds newly labeled receipts,
parses the order details, renders a clean PDF, emails it to a configured address,
and archives a copy to Drive.

## Run targets (functions you run from the editor)
- `setup()` - run once: installs the time trigger, authorizes, does a first pass.
- `processReceipts()` - the trigger target; safe to run manually.
- `reprocess(query)` - regenerate + re-email for already-processed emails
  (use after the receipt email format changes).
- `dryRun(query)` - parse-only preview, no PDFs/email; for debugging.

Everything else (suffixed with `_`) is an internal helper - do not run directly.

## Setup

The simplest way to run this is to copy the scripts into the Apps Script
web editor at <https://script.google.com>.

1. Go to <https://script.google.com> and click **New project**.
2. In the editor, recreate the files from this repo (use the **+** next to
   "Files" to add each one):
   - `compass-clerk.js` - paste in the contents of `compass-clerk.js`.
   - `config.js` - create it from `config.example.js`, then fill in your
     values (name, address, recipient email, etc.).
   - The manifest `appsscript.json` - enable **Project Settings ->
     "Show appsscript.json manifest file in editor"**, then replace its
     contents with `appsscript.json` from this repo.
3. Save the project.
4. Select `setup` from the function dropdown and click **Run**. Approve the
   authorization prompt when Google asks. This installs the time trigger and
   does a first pass.

`setup()` logs a reminder if a required value is missing.
