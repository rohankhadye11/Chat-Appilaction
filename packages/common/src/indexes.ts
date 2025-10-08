import { mongo } from "./index.js";

export async function ensureIndexes() {
  const db = mongo.database();

  // History query index
  await db.collection("messages").createIndex({ chatId: 1, sequence_number: 1 });

  // Idempotency index with partial filter (critical fix)
  await db.collection("messages").createIndex(
    { chatId: 1, clientId: 1, tempId: 1 },
    { unique: true, partialFilterExpression: { clientId: { $exists: true }, tempId: { $exists: true } } }
  );

  await db.collection("users").createIndex({ email: 1 }, { unique: true });
  await db.collection("chats").createIndex({ memberIds: 1 });
}
