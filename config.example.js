// Copy to config.js (git-ignored, but pushed by clasp) and fill it in.
// config.js is the single source of truth for all config.
var CONFIG = {
  NAME: "",
  ADDRESS_HTML: "",                     // use <br> for line breaks
  EMAIL_TO: "",
  GMAIL_LABEL: "Compass Orders",
  SENDER: "customerservice@compasscard.ca",
  DRIVE_FOLDER: "Compass Receipts",
  SEND_EMAIL: true,                     // false = archive to Drive only
  MASK_CARD: true,
  PROCESSED_LABEL: "Compass/Processed",
  POLL_MINUTES: 15                      // 1, 5, 10, 15, or 30
};
