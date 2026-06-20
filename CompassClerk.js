/**
 * Compass Clerk - Compass Card receipt -> clean PDF automation (Google Apps Script)
 * ----------------------------------------------------------------------------
 * Runs in Gmail's cloud on a time trigger. For every new Compass Card order
 * receipt it finds, it parses the order details, renders a clean one-page PDF,
 * emails the PDF to EMAIL_TO (replacing your Gmail forward), and archives a
 * copy to a Drive folder.
 *
 * SETUP (one time):
 *   1. Go to https://script.google.com  ->  New project.
 *   2. Paste this whole file in, replacing the default Code.gs contents.
 *   3. Add a config.js file (copy config.example.js) and fill in your values.
 *   4. Run `setup` once (Run menu). Approve the permission prompts.
 *      This creates an hourly trigger.
 *   5. Done. Run `processReceipts` manually any time to test.
 *
 * Pair it with your existing Gmail filter: have the filter apply a label
 * (e.g. "Compass") and set GMAIL_LABEL below to match. The script only looks
 * at labeled, unprocessed threads.
 */

// ===================== CONFIG =====================
// All configuration lives in config.js (git-ignored, copied from
// config.example.js). That file defines the global `CONFIG` object used
// throughout this script. See README.
// ==================================================

/** Create the hourly trigger. Run once. */
function setup() {
  var missing = [];
  if (!CONFIG.NAME) missing.push("NAME");
  if (!CONFIG.ADDRESS_HTML) missing.push("ADDRESS_HTML");
  if (CONFIG.SEND_EMAIL && !CONFIG.EMAIL_TO) missing.push("EMAIL_TO");
  if (missing.length) {
    Logger.log("Set these in config.js before use: " +
               missing.join(", "));
  }
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === "processReceipts") ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger("processReceipts").timeBased().everyMinutes(CONFIG.POLL_MINUTES).create();
  Logger.log("Trigger installed. Running once now...");
  processReceipts();
}

/** Main entry point (called by the trigger). Handles only NEW receipts. */
function processReceipts() {
  var processed = getOrCreateLabel_(CONFIG.PROCESSED_LABEL);
  var folder = getOrCreateFolder_(CONFIG.DRIVE_FOLDER);

  var query = CONFIG.GMAIL_LABEL
    ? 'label:' + CONFIG.GMAIL_LABEL.replace(/ /g, "-") + ' -label:' + CONFIG.PROCESSED_LABEL.replace(/[ /]/g, "-")
    : 'from:' + CONFIG.SENDER + ' -label:' + CONFIG.PROCESSED_LABEL.replace(/[ /]/g, "-");

  var threads = GmailApp.search(query, 0, 50);
  if (!threads.length) { Logger.log("No new receipt threads."); return; }

  var seen = loadSeenOrders_();
  var made = 0;
  threads.forEach(function (thread) {
    made += handleThread_(thread, seen, folder, { ignoreSeen: false, replaceExisting: false });
    thread.addLabel(processed);
  });
  saveSeenOrders_(seen);
  Logger.log("Done. " + made + " new PDF(s) this run.");
}

/**
 * Re-run on emails you've ALREADY processed - use this after the receipt
 * email format changes and you've updated parseReceipts_/the template.
 *
 * It ignores both guards (the Processed label and the seen-orders list),
 * regenerates the PDF, replaces any Drive file of the same name, and re-emails.
 *
 * Pass a Gmail search query identifying the email(s), e.g.:
 *   reprocess('subject:"Compass Order Receipt" newer_than:60d')
 *   reprocess('rfc822msgid:CABc123...@mail.gmail.com')   // exact message
 *   reprocess('label:Compass')                            // everything labeled
 */
function reprocess(query) {
  if (!query) {
    Logger.log('Usage: reprocess(\'subject:"Compass Order Receipt" newer_than:60d\')');
    return;
  }
  var folder = getOrCreateFolder_(CONFIG.DRIVE_FOLDER);
  var seen = loadSeenOrders_();
  var threads = GmailApp.search(query, 0, 50);
  Logger.log("Reprocessing " + threads.length + " thread(s) matching: " + query);

  var made = 0;
  threads.forEach(function (thread) {
    made += handleThread_(thread, seen, folder, { ignoreSeen: true, replaceExisting: true });
  });
  saveSeenOrders_(seen);
  Logger.log("Reprocess done. " + made + " PDF(s) regenerated.");
}

/**
 * Parse-only preview - no PDFs, no Drive, no email. Run this first after a
 * format change to confirm parseReceipts_ still extracts every field. Logs
 * each parsed receipt; open View -> Logs to inspect. If it parses 0, fix the
 * regex in parseReceipts_ before running reprocess().
 *
 *   dryRun()                  // previews recent labeled receipts
 *   dryRun('<gmail query>')   // previews a specific email/range
 */
function dryRun(query) {
  query = query || (CONFIG.GMAIL_LABEL ? 'label:' + CONFIG.GMAIL_LABEL.replace(/ /g, "-")
                                       : 'from:' + CONFIG.SENDER);
  var threads = GmailApp.search(query, 0, 20);
  var n = 0;
  threads.forEach(function (thread) {
    thread.getMessages().forEach(function (msg) {
      parseReceipts_(htmlToText_(msg.getBody())).forEach(function (r) {
        n++;
        Logger.log(JSON.stringify(r));
      });
    });
  });
  Logger.log("dryRun parsed " + n + " receipt(s). If 0, fix parseReceipts_ regex.");
}

/** Shared per-thread worker used by both processReceipts and reprocess. */
function handleThread_(thread, seen, folder, opts) {
  var pdfs = [];
  thread.getMessages().forEach(function (msg) {
    var text = htmlToText_(msg.getBody());
    parseReceipts_(text).forEach(function (r) {
      if (!opts.ignoreSeen && seen[r.order]) return;   // skip already-done orders
      seen[r.order] = true;
      var blob = renderPdf_(r);
      if (opts.replaceExisting) {
        var dupes = folder.getFilesByName(blob.getName());
        while (dupes.hasNext()) dupes.next().setTrashed(true);
      }
      folder.createFile(blob);
      pdfs.push(blob);
      Logger.log("Saved " + blob.getName());
    });
  });
  if (pdfs.length && CONFIG.SEND_EMAIL) {
    GmailApp.sendEmail(CONFIG.EMAIL_TO,
      "Compass Card receipt(s) - " + pdfs.length + " attached",
      "Automated clean PDF receipt(s) for reimbursement. See attachments.",
      { attachments: pdfs });
  }
  return pdfs.length;
}

// ----------------------- parsing -----------------------

/** Strip HTML to whitespace-normalized text so the regexes are layout-proof. */
function htmlToText_(html) {
  return html
    .replace(/<\s*br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|tr|table|h[1-6])>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/[ \t]+/g, " ");
}

/** Find every order receipt block in a chunk of text. Returns array of objects. */
function parseReceipts_(text) {
  var re = new RegExp(
    "Order Number:\\s*(\\d+)\\s*" +
    "Authorization:\\s*(\\d+)\\s*" +
    "Order Date:\\s*(\\d{1,2}\\/\\d{1,2}\\/\\d{4})\\s*" +
    "Order Total:\\s*([\\d.]+)" +
    "[\\s\\S]*?Card:\\s*((?:\\d{4}\\s){4}\\d{4})" +
    "[\\s\\S]*?Total Paid with\\s*([\\s\\S]*?)\\s{1,}([\\d.]+)",
    "g");
  var out = [], m;
  while ((m = re.exec(text)) !== null) {
    out.push({
      order: m[1],
      auth: m[2],
      date: m[3],
      amount: parseFloat(m[4]),
      card: m[5].trim(),
      pay: m[6].replace(/\.{2,}/g, " ....").replace(/\s+/g, " ").trim()
    });
  }
  return out;
}

// ----------------------- rendering -----------------------

function renderPdf_(r) {
  var iso = toIso_(r.date);                 // 2026-05-12
  var disp = toDisplayDate_(r.date);        // May 12, 2026
  var card = CONFIG.MASK_CARD ? maskCard_(r.card) : r.card;
  var amt = r.amount.toFixed(2);

  var html = TEMPLATE_
    .replace(/{order}/g, esc_(r.order))
    .replace(/{auth}/g, esc_(r.auth))
    .replace(/{date}/g, esc_(disp))
    .replace(/{card}/g, esc_(card))
    .replace(/{pay}/g, esc_(r.pay))
    .replace(/{amount}/g, amt)
    .replace(/{name}/g, CONFIG.NAME)
    .replace(/{addr}/g, CONFIG.ADDRESS_HTML);

  var name = "Compass Receipt - " + iso + " - Order " + r.order + " - $" +
             Math.round(r.amount) + ".pdf";
  return Utilities.newBlob(html, "text/html", "tmp.html")
                  .getAs("application/pdf").setName(name);
}

var TEMPLATE_ =
'<!DOCTYPE html><html><head><meta charset="utf-8"><style>' +
'@page{size:A4;margin:36px 44px}*{box-sizing:border-box}' +
'body{font-family:Arial,Helvetica,sans-serif;color:#1a2b3c;font-size:13px;line-height:1.5}' +
'.brand{width:100%;border-bottom:3px solid #0061a1;padding-bottom:14px;margin-bottom:24px}' +
'.brand td{vertical-align:top}.logo{font-size:28px;font-weight:bold;color:#0061a1}' +
'.logo span{color:#6cace4}.sub{font-size:11px;color:#6b7a89}' +
'.doc{text-align:right}.doc .h1{font-size:21px;font-weight:bold}' +
'.doc .ord{font-size:12px;color:#6b7a89}' +
'.cols{width:100%;margin-bottom:22px}.cols td{vertical-align:top;width:50%}' +
'.lbl{font-size:11px;text-transform:uppercase;letter-spacing:1px;color:#0061a1;font-weight:bold;margin-bottom:6px}' +
'.summary{width:100%;background:#f4f8fb;border-radius:8px;margin-bottom:20px}' +
'.summary td{padding:12px 18px;width:50%}' +
'.skey{font-size:10px;text-transform:uppercase;letter-spacing:.8px;color:#6b7a89}' +
'.sval{font-size:14px;font-weight:bold}' +
'table.items{width:100%;border-collapse:collapse;margin-bottom:6px}' +
'table.items th{text-align:left;font-size:10px;text-transform:uppercase;color:#6b7a89;border-bottom:2px solid #e1e8ef;padding:8px}' +
'table.items th.n,table.items td.n{text-align:right}' +
'table.items td{padding:12px 8px;border-bottom:1px solid #eef2f6}' +
'.dmain{font-weight:bold}.dsub{color:#6b7a89;font-size:12px}' +
'table.tot{width:280px;margin-left:auto}.tot td{padding:6px 8px}.tot td.n{text-align:right}' +
'.tot tr.grand td{border-top:2px solid #0061a1;font-size:16px;font-weight:bold;color:#0061a1;padding-top:10px}' +
'.pay{width:100%;margin-top:28px;border-top:1px solid #e1e8ef;padding-top:14px}' +
'.pay td{padding:4px 0}.pay td.n{text-align:right}' +
'.foot{margin-top:34px;border-top:1px solid #e1e8ef;padding-top:14px;font-size:10.5px;color:#8a97a4}' +
'</style></head><body>' +
'<table class="brand"><tr><td><div class="logo">COMPASS<span>CARD</span></div>' +
'<div class="sub">TransLink &middot; Metro Vancouver</div></td>' +
'<td class="doc"><div class="h1">Order Receipt</div><div class="ord">Order #{order}</div></td></tr></table>' +
'<table class="cols"><tr><td><div class="lbl">Billing Information</div>{name}<br>{addr}</td>' +
'<td><div class="lbl">Shipping Information</div>{name}<br>{addr}</td></tr></table>' +
'<table class="summary"><tr><td><div class="skey">Order Number</div><div class="sval">{order}</div></td>' +
'<td><div class="skey">Authorization</div><div class="sval">{auth}</div></td></tr>' +
'<tr><td><div class="skey">Order Date</div><div class="sval">{date}</div></td>' +
'<td><div class="skey">Order Total</div><div class="sval">${amount} CAD</div></td></tr></table>' +
'<table class="items"><tr><th>Description</th><th class="n">Qty</th><th class="n">Deposit</th><th class="n">Price</th></tr>' +
'<tr><td><div class="dmain">Stored Value</div><div class="dsub">Card: {card}</div></td>' +
'<td class="n">1</td><td class="n">$0.00</td><td class="n">${amount}</td></tr></table>' +
'<table class="tot"><tr><td>Deposit</td><td class="n">$0.00</td></tr>' +
'<tr><td>Product</td><td class="n">${amount}</td></tr>' +
'<tr class="grand"><td>Total</td><td class="n">${amount} CAD</td></tr></table>' +
'<table class="pay"><tr><td colspan="2"><div class="lbl">Payment Details</div></td></tr>' +
'<tr><td>Paid with {pay}</td><td class="n">${amount}</td></tr>' +
'<tr><td><b>Total Paid</b></td><td class="n"><b>${amount} CAD</b></td></tr></table>' +
'<div class="foot"><b>Compass Customer Service</b> &nbsp; 604.398.2042 &nbsp;|&nbsp; 1.888.207.4055 ' +
'&nbsp;|&nbsp; customerservice@compasscard.ca<br>Stored value must be tapped to a Compass Card reader ' +
'or fare gate to be loaded onto the card. This receipt confirms payment for the order referenced above.</div>' +
'</body></html>';

// ----------------------- helpers -----------------------

function getOrCreateFolder_(name) {
  var it = DriveApp.getFoldersByName(name);
  return it.hasNext() ? it.next() : DriveApp.createFolder(name);
}

function getOrCreateLabel_(name) {
  return GmailApp.getUserLabelByName(name) || GmailApp.createLabel(name);
}

function loadSeenOrders_() {
  var raw = PropertiesService.getScriptProperties().getProperty("seenOrders");
  return raw ? JSON.parse(raw) : {};
}

function saveSeenOrders_(obj) {
  PropertiesService.getScriptProperties().setProperty("seenOrders", JSON.stringify(obj));
}

function toIso_(mdy) {
  var p = mdy.split("/");
  return p[2] + "-" + ("0" + p[0]).slice(-2) + "-" + ("0" + p[1]).slice(-2);
}

function toDisplayDate_(mdy) {
  var months = ["January","February","March","April","May","June","July",
                "August","September","October","November","December"];
  var p = mdy.split("/");
  return months[parseInt(p[0], 10) - 1] + " " + parseInt(p[1], 10) + ", " + p[2];
}

function maskCard_(card) {
  var last4 = card.replace(/\s/g, "").slice(-4);
  return "**** **** **** " + last4;
}

function esc_(s) {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
