function cloneCollections(source) {
  const clone = new Map();
  for (const [name, records] of source.entries()) {
    const recordClone = new Map();
    for (const [id, value] of records.entries()) recordClone.set(id, structuredClone(value));
    clone.set(name, recordClone);
  }
  return clone;
}

function createDatabaseMock() {
  const collections = new Map();
  let generatedId = 0;
  let failAtWrite = 0;
  let conflictOnce = false;
  let transactionQueue = Promise.resolve();

  function records(state, name) {
    if (!state.has(name)) state.set(name, new Map());
    return state.get(name);
  }

  function matches(item, criteria) {
    return Object.entries(criteria).every(([key, value]) => {
      if (value && typeof value === 'object' && value.__command === 'in') {
        return value.values.includes(item[key]);
      }
      return item[key] === value;
    });
  }

  function createApi(state, transactionState) {
    function writeGuard() {
      if (!transactionState) return;
      transactionState.writeCount += 1;
      if (failAtWrite && transactionState.writeCount === failAtWrite) {
        throw new Error('injected_transaction_failure');
      }
    }

    return {
      command: {
        in(values) {
          return { __command: 'in', values };
        },
      },
      collection(name) {
        const collectionRecords = records(state, name);
        return {
          doc(id) {
            return {
              async get() {
                if (!collectionRecords.has(id)) throw new Error('document_not_found');
                return { data: { _id: id, ...structuredClone(collectionRecords.get(id)) } };
              },
              async set({ data }) {
                writeGuard();
                collectionRecords.set(id, structuredClone(data));
                return { _id: id };
              },
              async update({ data }) {
                writeGuard();
                if (!collectionRecords.has(id)) throw new Error('document_not_found');
                collectionRecords.set(id, { ...collectionRecords.get(id), ...structuredClone(data) });
                return { updated: 1 };
              },
            };
          },
          where(criteria) {
            let queryLimit = Infinity;
            return {
              limit(value) {
                queryLimit = value;
                return this;
              },
              orderBy() {
                return this;
              },
              async get() {
                const data = Array.from(collectionRecords.entries())
                  .map(([id, value]) => ({ _id: id, ...structuredClone(value) }))
                  .filter((item) => matches(item, criteria))
                  .slice(0, queryLimit);
                return { data };
              },
            };
          },
          async add({ data }) {
            writeGuard();
            generatedId += 1;
            const id = `generated_${generatedId}`;
            collectionRecords.set(id, structuredClone(data));
            return { _id: id };
          },
        };
      },
    };
  }

  const database = createApi(collections, null);
  database.runTransaction = async (callback) => {
    const execute = async () => {
      const attempts = conflictOnce ? 2 : 1;
      conflictOnce = false;
      let callbackResult;
      for (let attempt = 0; attempt < attempts; attempt += 1) {
        const working = cloneCollections(collections);
        const transactionState = { writeCount: 0 };
        const transaction = createApi(working, transactionState);
        callbackResult = await callback(transaction);
        if (attempt < attempts - 1) continue;
        collections.clear();
        for (const [name, collectionRecords] of working.entries()) {
          collections.set(name, collectionRecords);
        }
      }
      return callbackResult;
    };
    const result = transactionQueue.then(execute, execute);
    transactionQueue = result.catch(() => undefined);
    return result;
  };
  database.seed = (name, id, data) => records(collections, name).set(id, structuredClone(data));
  database.get = (name, id) => records(collections, name).get(id);
  database.list = (name) =>
    Array.from(records(collections, name).entries()).map(([id, value]) => ({ _id: id, ...structuredClone(value) }));
  database.size = (name) => records(collections, name).size;
  database.failTransactionAtWrite = (writeNumber) => {
    failAtWrite = writeNumber;
  };
  database.clearFailure = () => {
    failAtWrite = 0;
  };
  database.conflictOnNextTransaction = () => {
    conflictOnce = true;
  };
  return database;
}

module.exports = { createDatabaseMock };
