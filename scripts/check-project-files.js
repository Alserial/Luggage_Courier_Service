const fs = require('fs');
const path = require('path');

const requiredPaths = [
  'project.config.json',
  'package.json',
  'miniprogram/app.json',
  'miniprogram/app.ts',
  'miniprogram/pages/home/index.wxml',
  'miniprogram/pages/trips/create.ts',
  'miniprogram/pages/requests/create.ts',
  'cloudfunctions/auth-login/index.js',
  'cloudfunctions/trip-create/index.js',
  'cloudfunctions/item-request-create/index.js',
  'cloudfunctions/order-transition/index.js',
  'cloudfunctions/payment-confirm-mock/index.js',
  'cloudfunctions/evidence-create/index.js',
  'cloudfunctions/handover-confirm-scan/index.js',
  'cloudfunctions/dispute-open/index.js',
  'miniprogram/pages/orders/detail.ts',
  'miniprogram/pages/trips/detail.ts',
  'miniprogram/pages/requests/detail.ts',
  'miniprogram/pages/matches/index.ts',
  'miniprogram/pages/offers/create.ts',
  'miniprogram/pages/payment/index.ts',
  'miniprogram/pages/handover/index.ts',
  'miniprogram/pages/evidence/upload.ts',
  'miniprogram/pages/disputes/detail.ts',
  'cloudfunctions/match-search/index.js',
  'cloudfunctions/offer-create/index.js',
  'cloudfunctions/offer-accept/index.js',
  'cloudfunctions/order-get/index.js',
  'miniprogram/pages/chat/index.ts',
  'miniprogram/pages/chat/index.wxml',
  'cloudfunctions/chat-conversation-get/index.js',
  'cloudfunctions/chat-message-list/index.js',
  'cloudfunctions/chat-message-send/index.js',
  'cloudfunctions/chat-mark-read/index.js',
  'cloudfunctions/chat-message-report/index.js',
  'cloudfunctions/chat-review-queue-list/index.js',
  'cloudfunctions/chat-admin-review/index.js',
  'cloudfunctions/chat-evidence-snapshot/index.js',
];

const missing = requiredPaths.filter((item) => !fs.existsSync(path.join(process.cwd(), item)));

if (missing.length) {
  console.error(`Missing required files:\n${missing.map((item) => `- ${item}`).join('\n')}`);
  process.exit(1);
}

console.log(`Project skeleton OK. Checked ${requiredPaths.length} files.`);
