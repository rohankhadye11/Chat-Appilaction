import { createServer, IncomingMessage } from "http";
import WS, { WebSocketServer } from "ws";
import { jwt, mongo, redis } from "@app/common";
import "dotenv/config";

const PORT = Number(process.env.CHAT_SERVICE_PORT || 4000);

// Active WS connections keyed by userId
type ConnSet = Set<WS>;
const connections = new Map<string, ConnSet>();

// Simple membership cache (replace with real DB lookup in production)
type MembersCache = { members: string[]; fetchedAt: number };
const membershipCache = new Map<string, MembersCache>();
const MEMBERSHIP_TTL_MS = 30_000;

async function recipientsForChat(chatId: string): Promise<string[]> {
  const now = Date.now();
  const cached = membershipCache.get(chatId);
  if (cached && now - cached.fetchedAt < MEMBERSHIP_TTL_MS) return cached.members;

  // Production: fetch from chats collection
  // const chat = await mongo.chats().findOne({ _id: chatId }, { projection: { memberIds: 1 } });
  // const members = chat?.memberIds || [];

  // MVP fallback: deliver to all connected users if no membership is persisted
  const members = Array.from(connections.keys());

  membershipCache.set(chatId, { members, fetchedAt: now });
  return members;
}

const server = createServer((req, res) => {
  if (req.url === "/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ status: "ok" }));
    return;
  }
  if (req.url === "/ready") {
    // Optionally test Redis/Mongo availability
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ status: "ready" }));
    return;
  }
  res.writeHead(404, { "Content-Type": "text/plain" });
  res.end("Not Found");
});

const wss = new WebSocketServer({ server, path: "/ws" });

wss.on("connection", (ws: WS, req: IncomingMessage) => {
  try {
    // Token via query ?token= or Sec-WebSocket-Protocol "Bearer <token>"
    const url = new URL(req.url || "", `http://${req.headers.host}`);
    let token = url.searchParams.get("token");
    if (!token) {
      const proto = req.headers["sec-websocket-protocol"];
      if (typeof proto === "string" && proto.startsWith("Bearer ")) {
        token = proto.slice(7);
      }
    }
    if (!token) {
      ws.close(4001, "No token");
      return;
    }
    const payload = jwt.verify(token);
    const userId = payload.sub as string;

    let set = connections.get(userId);
    if (!set) {
      set = new Set<WS>();
      connections.set(userId, set);
    }
    set.add(ws);

    console.info("ws connected", { userId });

    ws.on("close", (code, reason) => {
      const s = connections.get(userId);
      if (s) {
        s.delete(ws);
        if (s.size === 0) connections.delete(userId);
      }
      console.info("ws closed", { userId, code, reason: reason?.toString() });
    });

    ws.on("error", (err) => {
      console.error("ws error", { userId, err });
    });
  } catch (err) {
    console.error("ws auth error", { err });
    ws.close(4001, "Unauthorized");
  }
});

const sub = redis.makeSub();
sub.subscribe(redis.CHANNELS.DELIVERY);

sub.on("message", async (channel: string, message: string) => {
  if (channel !== redis.CHANNELS.DELIVERY) return;
  try {
    const msg = JSON.parse(message) as {
      chatId: string;
      sequence_number: number;
      senderId: string;
      text: string;
      _id: string;
      createdAt?: string;
    };

    const recipients = await recipientsForChat(msg.chatId);

    console.info("deliver", {
      chatId: msg.chatId,
      seq: msg.sequence_number,
      recipients: recipients.length
    });

    for (const userId of recipients) {
      const set = connections.get(userId);
      if (!set) continue;
      for (const socket of set) {
        try {
          socket.send(JSON.stringify(msg));
        } catch (err) {
          console.error("ws send error", { userId, err });
        }
      }
    }
  } catch (err) {
    console.error("delivery handler error", { err });
  }
});

server.listen(PORT, async () => {
  try {
    await mongo.connect(); // so future membership lookups can query chats
  } catch (err) {
    console.error("mongo connect failed (chat-service)", { err });
  }
  console.log(`chat-service on ${PORT}`);
});
