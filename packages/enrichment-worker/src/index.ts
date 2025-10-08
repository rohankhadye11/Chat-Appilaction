import { indexes, mongo, redis } from "@app/common";
import type { WithId } from "mongodb";
import "dotenv/config";

const sub = redis.makeSub();
const pub = redis.makePub();

type ChatDoc = { _id: string; counters?: { seq: number } };

async function nextSeq(chatId: string): Promise<number> {
  const chats = mongo.chats(); // Collection<ChatDoc>

  // Try modern option first; fallback remains typed as any for compatibility
  const res = await chats.findOneAndUpdate(
    { _id: chatId },
    { $inc: { "counters.seq": 1 } },
    { upsert: true, returnDocument: "after" } as any
  );

  const val = (res as any)?.value as WithId<ChatDoc> | null;
  const seq = val?.counters?.seq ?? 1;
  return seq;
}

async function start() {
  await mongo.connect();
  // Ensure indexes exist for history queries and idempotency
  if (indexes && typeof indexes.ensureIndexes === "function") {
    try { await indexes.ensureIndexes(); } catch (e) { console.error("indexes ensure failed", e); }
  }

  await sub.subscribe(redis.CHANNELS.INGESTION);
  console.log("enrichment-worker subscribed");

  sub.on("message", async (channel: string, message: string) => {
    if (channel !== redis.CHANNELS.INGESTION) return;
    try {
      const raw = JSON.parse(message) as {
        chatId: string;
        text: string;
        senderId: string;
        clientId?: string;
        tempId?: string;
      };

      console.info("enrichment: received", { chatId: raw.chatId, senderId: raw.senderId });

      const seq = await nextSeq(raw.chatId);
      console.info("enrichment: seq", { chatId: raw.chatId, seq });

      const baseDoc = {
        _id: crypto.randomUUID(),
        chatId: raw.chatId,
        senderId: raw.senderId,
        text: raw.text,
        sequence_number: seq,
        createdAt: new Date()
      };

      // Idempotency: if clientId+tempId provided, upsert; else plain insert
      let saved: any;
      if (raw.clientId && raw.tempId) {
        const filter = { chatId: raw.chatId, clientId: raw.clientId, tempId: raw.tempId };
        const toInsert = { ...baseDoc, clientId: raw.clientId, tempId: raw.tempId };
        await mongo.messages().updateOne(filter, { $setOnInsert: toInsert }, { upsert: true });
        saved = await mongo.messages().findOne(filter);
      } else {
        saved = { ...baseDoc };
        await mongo.messages().insertOne(saved);
      }

      console.info("enrichment: persisted", { chatId: raw.chatId, id: saved?._id });

      await pub.publish(redis.CHANNELS.DELIVERY, JSON.stringify(saved));
    } catch (e: any) {
      console.error("enrichment error", { err: e?.message || String(e) });
    }
  });
}

start().catch((e) => {
  console.error("enrichment fatal", { err: e?.message || String(e) });
});