const fs = require('fs');
const path = require('path');

const requiredPaths = [
  'project.config.json',
  'package.json',
  'scripts/setup-cloudbase.js',
  'miniprogram/app.json',
  'miniprogram/app.ts',
  'miniprogram/pages/home/index.wxml',
  'miniprogram/pages/trips/create.ts',
  'miniprogram/pages/requests/create.ts',
  'cloudfunctions/auth-login/index.js',
  'cloudfunctions/trip-create/index.js',
  'cloudfunctions/trip-update/index.js',
  'cloudfunctions/trip-delete/index.js',
  'cloudfunctions/item-request-create/index.js',
  'cloudfunctions/item-request-update/index.js',
  'cloudfunctions/item-request-delete/index.js',
  'cloudfunctions/order-transition/index.js',
  'cloudfunctions/payment-confirm-mock/index.js',
  'cloudfunctions/evidence-create/index.js',
  'cloudfunctions/handover-confirm-scan/index.js',
  'cloudfunctions/dispute-open/index.js',
  'cloudfunctions/dispute-decide/index.js',
  'miniprogram/pages/orders/detail.ts',
  'miniprogram/pages/trips/detail.ts',
  'miniprogram/pages/requests/detail.ts',
  'miniprogram/pages/matches/index.ts',
  'miniprogram/pages/offers/create.ts',
  'miniprogram/pages/payment/index.ts',
  'miniprogram/pages/handover/index.ts',
  'miniprogram/pages/evidence/upload.ts',
  'miniprogram/pages/disputes/detail.ts',
  'miniprogram/utils/operation.ts',
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

const cloudFunctionRoot = path.join(process.cwd(), 'cloudfunctions');
const cloudFunctionNames = fs
  .readdirSync(cloudFunctionRoot, { withFileTypes: true })
  .filter((entry) => entry.isDirectory() && fs.existsSync(path.join(cloudFunctionRoot, entry.name, 'package.json')))
  .map((entry) => entry.name);
if (cloudFunctionNames.length !== 33) {
  console.error(`Expected 33 cloud functions, found ${cloudFunctionNames.length}.`);
  process.exit(1);
}

const invalidSdkPins = cloudFunctionNames.filter((name) => {
  const manifest = JSON.parse(fs.readFileSync(path.join(cloudFunctionRoot, name, 'package.json'), 'utf8'));
  return !manifest.dependencies || manifest.dependencies['wx-server-sdk'] !== '4.0.2';
});
if (invalidSdkPins.length) {
  console.error(`Cloud functions without wx-server-sdk 4.0.2: ${invalidSdkPins.join(', ')}`);
  process.exit(1);
}

console.log(`Project skeleton OK. Checked ${requiredPaths.length} files and 33 pinned cloud functions.`);
