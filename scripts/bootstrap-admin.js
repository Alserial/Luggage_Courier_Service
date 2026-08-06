// Bootstrap an admin/reviewer account in users.roleFlags for the MVP test build.
//
// The MVP review functions (item-request-review, trip-verify, dispute-decide,
// chat-admin-review, review-queue-list, chat-review-queue-list) gate on
// users.roleFlags containing 'admin' or 'reviewer'. This script sets those
// flags for a known operator openid so the review/audit backend is exercisable.
//
// Security:
// - Never commit Tencent Cloud credentials. Use short-lived credentials scoped
//   to the target environment only.
// - The operator openid must come from a real Mini Program login, not frontend code.
//
// Usage:
//   npm install --no-save @cloudbase/node-sdk
//   $env:TENCENTCLOUD_SECRET_ID='<temporary secret id>'
//   $env:TENCENTCLOUD_SECRET_KEY='<temporary secret key>'
//   $env:CLOUDBASE_ENV_ID='luggage-d1ghv33fy2cb9ef96'
//   node scripts/bootstrap-admin.js --openid=OPENID [--roles=admin,reviewer]

const defaultEnvId = 'luggage-d1ghv33fy2cb9ef96';
const defaultRoles = ['admin', 'reviewer'];

function credentials() {
  return {
    secretId:
      process.env.TENCENTCLOUD_SECRET_ID ||
      process.env.TENCENTCLOUD_SECRETID ||
      '',
    secretKey:
      process.env.TENCENTCLOUD_SECRET_KEY ||
      process.env.TENCENTCLOUD_SECRETKEY ||
      '',
    token:
      process.env.TENCENTCLOUD_SESSION_TOKEN ||
      process.env.TENCENTCLOUD_TOKEN ||
      '',
  };
}

function parseArgs(argv) {
  const args = { openid: '', roles: defaultRoles.slice() };
  for (const arg of argv) {
    if (arg.startsWith('--openid=')) args.openid = arg.slice('--openid='.length).trim();
    if (arg.startsWith('--roles=')) {
      args.roles = arg
        .slice('--roles='.length)
        .split(',')
        .map((role) => role.trim())
        .filter(Boolean);
    }
  }
  return args;
}

async function main() {
  const { openid, roles } = parseArgs(process.argv.slice(2));
  if (!openid) {
    throw new Error('Missing --openid. Usage: node scripts/bootstrap-admin.js --openid=OPENID [--roles=admin,reviewer]');
  }
  if (!roles.length) {
    throw new Error('No roles provided. Use --roles=admin,reviewer');
  }

  const auth = credentials();
  if (!auth.secretId || !auth.secretKey) {
    throw new Error(
      'Missing Tencent Cloud credentials. Set TENCENTCLOUD_SECRET_ID and TENCENTCLOUD_SECRET_KEY; never commit them.',
    );
  }

  const envId = process.env.CLOUDBASE_ENV_ID || defaultEnvId;
  let app;
  try {
    // eslint-disable-next-line global-require
    const { init } = require('@cloudbase/node-sdk');
    app = init({
      env: envId,
      secretId: auth.secretId,
      secretKey: auth.secretKey,
      ...(auth.token ? { sessionToken: auth.token } : {}),
    });
  } catch (error) {
    throw new Error(
      'Missing @cloudbase/node-sdk. Run "npm install --no-save @cloudbase/node-sdk" before bootstrap.',
    );
  }

  const db = app.database();
  const existing = await db.collection('users').where({ openid }).limit(1).get();
  if (!existing.data.length) {
    throw new Error(
      `No users record for openid ${openid}. Log in once from the Mini Program profile page so auth-login creates the record first.`,
    );
  }

  const current = existing.data[0];
  const merged = Array.from(new Set([...(current.roleFlags || []), ...roles]));
  await db
    .collection('users')
    .doc(current._id)
    .update({ data: { roleFlags: merged } });

  console.log(
    `Updated users ${current._id} (openid ${openid}) roleFlags -> ${JSON.stringify(merged)}`,
  );
}

main().catch((error) => {
  console.error(`Admin bootstrap failed: ${error.message}`);
  process.exit(1);
});
