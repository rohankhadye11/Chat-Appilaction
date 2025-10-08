import { MongoClient, Db, Collection } from "mongodb";
import "dotenv/config";

let client: MongoClient | null = null;
let db: Db | null = null;

type User = {
  _id: string;
  email: string;
  passwordHash: string;
  displayName: string;
  createdAt: Date;
};
type Chat = {
  _id: string;
  type: "dm" | "group";
  memberIds: string[];
  counters?: { seq: number };
};
type Message = {
  _id: string;
  chatId: string;
  senderId: string;
  text: string;
  sequence_number: number;
  createdAt: Date;
  clientId?: string;
  tempId?: string;
};

function getDbName(): string {
  // Prefer explicit env, otherwise let URI decide (db in connection string)
  return process.env.MONGO_DB || process.env.MONGODB_DB || "";
}

export async function connect(): Promise<Db> {
  const uri = process.env.ATLAS_URI || process.env.MONGODB_URI;
  if (!uri) throw new Error("ATLAS_URI or MONGODB_URI not set");

  if (!client) {
    client = new MongoClient(uri);
  }
  // Driver v5 connects lazily; an explicit connect ensures readiness
  // @ts-ignore topology is internal; connect is safe to call multiple times
  if (!(client as any).topology || !(client as any).topology?.isConnected?.()) {
    await client.connect();
  }

  if (!db) {
    const name = getDbName();
    db = name ? client.db(name) : client.db(); // default from URI if no override
  }

  return db;
}

export function database(): Db {
  if (!db) throw new Error("Mongo not connected. Call connect() first.");
  return db;
}

export function mongoClient(): MongoClient {
  if (!client) throw new Error("Mongo not connected. Call connect() first.");
  return client;
}

export function users(): Collection<User> {
  return database().collection<User>("users");
}

export function chats(): Collection<Chat> {
  return database().collection<Chat>("chats");
}

export function messages(): Collection<Message> {
  return database().collection<Message>("messages");
}
