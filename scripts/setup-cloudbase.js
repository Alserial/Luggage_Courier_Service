const defaultEnvId = 'luggage-d1ghv33fy2cb9ef96';

const schema = {
  users: [
    index('users_openid', true, ['openid']),
    index('users_verification_status', false, ['verificationStatus']),
    index('users_risk_level', false, ['riskLevel']),
  ],
  item_requests: [
    index('requests_owner_created', false, ['requesterOpenid', '-createdAt']),
    index('requests_review_category', false, ['reviewStatus', 'category']),
    index('requests_review_created', false, ['reviewStatus', '-createdAt']),
    index('requests_route_deadline', false, [
      'pickupLocation.city',
      'deliveryLocation.city',
      'deadline',
    ]),
  ],
  trips: [
    index('trips_owner_created', false, ['travellerOpenid', '-createdAt']),
    index('trips_verification_created', false, ['verificationStatus', '-createdAt']),
    index('trips_status_departure', false, ['status', 'departureTime']),
    index('trips_route_arrival', false, ['fromCity', 'toCity', 'arrivalTime']),
    index('trips_categories', false, ['acceptableCategories']),
  ],
  offers: [
    index('offers_request_status', false, ['requestId', 'status']),
    index('offers_trip_status', false, ['tripId', 'status']),
    index('offers_traveller_created', false, ['travellerOpenid', '-createdAt']),
    index('offers_expiry', false, ['expiresAt']),
  ],
  orders: [
    index('orders_requester_status_updated', false, ['requesterOpenid', 'status', '-updatedAt']),
    index('orders_traveller_status_updated', false, ['travellerOpenid', 'status', '-updatedAt']),
    index('orders_request', false, ['requestId']),
    index('orders_trip', false, ['tripId']),
    index('orders_requester_updated', false, ['requesterOpenid', '-updatedAt']),
    index('orders_traveller_updated', false, ['travellerOpenid', '-updatedAt']),
    index('orders_offer', false, ['offerId']),
  ],
  payments: [
    index('payments_order', false, ['orderId']),
    index('payments_provider_reference', false, ['provider', 'providerPaymentId']),
    index('payments_state', false, ['paymentStatus', 'lockStatus', 'refundStatus']),
  ],
  evidence: [
    index('evidence_order_created', false, ['orderId', '-createdAt']),
    index('evidence_uploader_created', false, ['uploaderOpenid', '-createdAt']),
    index('evidence_type', false, ['evidenceType']),
  ],
  handover_records: [
    index('handover_order_created', false, ['orderId', '-createdAt']),
    index('handover_confirmer_created', false, ['confirmedByOpenid', '-createdAt']),
  ],
  disputes: [
    index('disputes_order_status', false, ['orderId', 'status']),
    index('disputes_opener_created', false, ['openedByOpenid', '-createdAt']),
    index('disputes_status_updated', false, ['status', '-updatedAt']),
  ],
  audit_logs: [
    index('audit_target_created', false, ['targetType', 'targetId', '-createdAt']),
    index('audit_actor_created', false, ['actorOpenid', '-createdAt']),
    index('audit_action_created', false, ['action', '-createdAt']),
    index('audit_operation', false, ['operationId']),
  ],
  conversations: [
    index('conversations_order_unique', true, ['orderId']),
    index('conversations_participants_last_message', false, ['participantOpenids', '-lastMessageAt']),
  ],
  messages: [
    index('messages_client_id_unique', true, ['conversationId', 'clientMessageId']),
    index('messages_conversation_created', false, ['conversationId', 'createdAt']),
    index('messages_order_created', false, ['orderId', 'createdAt']),
    index('messages_moderation_created', false, ['moderationStatus', 'createdAt']),
    index('messages_sender_created', false, ['conversationId', 'senderOpenid', 'createdAt']),
    index('messages_conversation_moderation_created', false, ['conversationId', 'moderationStatus', '-createdAt']),
  ],
  message_receipts: [
    index('receipts_reader_unique', true, ['conversationId', 'readerOpenid']),
  ],
  message_reports: [
    index('reports_status_created', false, ['status', 'createdAt']),
    index('reports_message_reporter_status', false, ['messageId', 'reporterOpenid', 'status']),
    index('reports_order_created', false, ['orderId', 'createdAt']),
  ],
};

function index(name, unique, fields) {
  return {
    name,
    unique,
    keys: fields.map((field) => ({
      name: field.startsWith('-') ? field.slice(1) : field,
      direction: field.startsWith('-') ? '-1' : '1',
    })),
  };
}

function managerIndex(definition) {
  return {
    IndexName: definition.name,
    MgoKeySchema: {
      MgoIsUnique: definition.unique,
      MgoIndexKeys: definition.keys.map((key) => ({
        Name: key.name,
        Direction: key.direction,
      })),
    },
  };
}

function normalizeRemoteIndex(remote) {
  return {
    name: remote.Name,
    unique:
      remote.Unique === true ||
      remote.Unique === 'true' ||
      remote.Unique === 1 ||
      remote.Unique === '1',
    keys: (remote.Keys || []).map((key) => ({
      name: key.Name,
      direction: String(key.Direction),
    })),
  };
}

function sameIndex(left, right) {
  return (
    left.unique === right.unique &&
    left.keys.length === right.keys.length &&
    left.keys.every(
      (key, position) =>
        key.name === right.keys[position].name &&
        key.direction === right.keys[position].direction,
    )
  );
}

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

function printPlan() {
  console.log(`CloudBase schema plan for ${process.env.CLOUDBASE_ENV_ID || defaultEnvId}`);
  for (const [collectionName, indexes] of Object.entries(schema)) {
    console.log(`- ${collectionName}: ${indexes.map((item) => item.name).join(', ')}`);
  }
  console.log('Storage prefixes are created by uploads; they do not require empty-folder initialization.');
  console.log('Collection security rules remain a deliberate manual verification step.');
}

function loadCloudBase() {
  try {
    return require('@cloudbase/manager-node');
  } catch (error) {
    throw new Error(
      'Missing @cloudbase/manager-node. Run "npm install --no-save @cloudbase/manager-node@5.6.4" before check/apply.',
    );
  }
}

async function inspect(database) {
  const missingCollections = [];
  const missingIndexes = [];
  const mismatchedIndexes = [];

  for (const [collectionName, expectedIndexes] of Object.entries(schema)) {
    const existence = await database.checkCollectionExists(collectionName);
    if (!existence.Exists) {
      missingCollections.push(collectionName);
      missingIndexes.push(...expectedIndexes.map((item) => ({ collectionName, definition: item })));
      continue;
    }

    const detail = await database.describeCollection(collectionName);
    const remoteIndexes = new Map(
      (detail.Indexes || []).map((item) => {
        const normalized = normalizeRemoteIndex(item);
        return [normalized.name, normalized];
      }),
    );
    for (const expected of expectedIndexes) {
      const remote = remoteIndexes.get(expected.name);
      if (!remote) {
        missingIndexes.push({ collectionName, definition: expected });
      } else if (!sameIndex(expected, remote)) {
        mismatchedIndexes.push({ collectionName, expected, remote });
      }
    }
  }

  return { missingCollections, missingIndexes, mismatchedIndexes };
}

function printInspection(result) {
  if (!result.missingCollections.length && !result.missingIndexes.length && !result.mismatchedIndexes.length) {
    console.log('CloudBase collections and indexes match the repository schema.');
    return;
  }
  for (const name of result.missingCollections) console.log(`MISSING collection: ${name}`);
  for (const item of result.missingIndexes) {
    console.log(`MISSING index: ${item.collectionName}.${item.definition.name}`);
  }
  for (const item of result.mismatchedIndexes) {
    console.log(`DRIFTED index: ${item.collectionName}.${item.expected.name}`);
  }
}

async function applyMissing(database, inspection) {
  if (inspection.mismatchedIndexes.length) {
    throw new Error(
      'Existing indexes with repository names have different definitions. Review them manually; this script will not drop or recreate indexes.',
    );
  }

  for (const collectionName of inspection.missingCollections) {
    console.log(`Creating collection ${collectionName}`);
    await database.createCollectionIfNotExists(collectionName);
  }

  const missingByCollection = new Map();
  for (const item of inspection.missingIndexes) {
    const definitions = missingByCollection.get(item.collectionName) || [];
    definitions.push(item.definition);
    missingByCollection.set(item.collectionName, definitions);
  }
  for (const [collectionName, definitions] of missingByCollection.entries()) {
    console.log(`Creating indexes for ${collectionName}: ${definitions.map((item) => item.name).join(', ')}`);
    await database.updateCollection(collectionName, {
      CreateIndexes: definitions.map(managerIndex),
    });
  }
}

async function main() {
  const mode = process.argv.includes('--apply')
    ? 'apply'
    : process.argv.includes('--plan')
      ? 'plan'
      : 'check';
  if (mode === 'plan') {
    printPlan();
    return;
  }

  const envId = process.env.CLOUDBASE_ENV_ID || defaultEnvId;
  const auth = credentials();
  if (!auth.secretId || !auth.secretKey) {
    throw new Error(
      'Missing Tencent Cloud credentials. Set TENCENTCLOUD_SECRET_ID and TENCENTCLOUD_SECRET_KEY; never commit them.',
    );
  }

  const CloudBase = loadCloudBase();
  const app = CloudBase.init({
    envId,
    secretId: auth.secretId,
    secretKey: auth.secretKey,
    ...(auth.token ? { token: auth.token } : {}),
  });
  const initial = await inspect(app.database);
  printInspection(initial);
  if (mode === 'check') {
    if (initial.missingCollections.length || initial.missingIndexes.length || initial.mismatchedIndexes.length) {
      process.exitCode = 1;
    }
    return;
  }

  await applyMissing(app.database, initial);
  const final = await inspect(app.database);
  printInspection(final);
  if (final.missingCollections.length || final.missingIndexes.length || final.mismatchedIndexes.length) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(`CloudBase setup failed: ${error.message}`);
  process.exit(1);
});
