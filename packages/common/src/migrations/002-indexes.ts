import "dotenv/config";
import { mongo } from "../index.js";

export async function up() {
  await mongo.connect();
  const db = mongo.database();

  await db.collection("messages").createIndex({ chatId: 1, sequence_number: 1 });

  // Critical: partial unique to avoid null collisions
  await db.collection("messages").createIndex(
    { chatId: 1, clientId: 1, tempId: 1 },
    { unique: true, partialFilterExpression: { clientId: { $exists: true }, tempId: { $exists: true } } }
  );

  await db.collection("users").createIndex({ email: 1 }, { unique: true });
  await db.collection("chats").createIndex({ memberIds: 1 });
}
