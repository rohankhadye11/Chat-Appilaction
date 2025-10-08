import express from "express";
import cors from "cors";
import morgan from "morgan";
import { z } from "zod";
import { jwt, redis } from "@app/common";
import "dotenv/config";

const app = express();

// Middlewares
app.use(cors({ methods: ["GET", "POST", "OPTIONS"], allowedHeaders: ["Content-Type", "Authorization"] }));
app.use(express.json({ limit: "1mb" }));
app.use(morgan("dev"));

const pub = redis.makePub();

const SendSchema = z.object({
  chatId: z.string().min(1).max(128),
  text: z.string().min(1).max(4000),
  clientId: z.string().max(64).optional(),
  tempId: z.string().max(64).optional()
});

function auth(req: any, res: any, next: any) {
  try {
    const h = req.headers.authorization || "";
    const token = h.startsWith("Bearer ") ? h.slice(7) : "";
    const payload = jwt.verify(token);
    (req as any).userId = payload.sub;
    next();
  } catch {
    res.status(401).json({ error: "Unauthorized" });
  }
}

// Health and version
app.get("/health", (_req, res) => res.json({ status: "ok" }));
app.get("/ready", (_req, res) => res.json({ status: "ready" }));
app.get("/version", (_req, res) => res.json({ name: "ingestion-service", version: process.env.npm_package_version || "0.0.0" }));

app.post("/messages/send", auth, async (req, res) => {
  try {
    const parsed = SendSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid payload" });
    }
    const body = parsed.data;

    const event = {
      chatId: body.chatId,
      text: body.text,
      senderId: (req as any).userId as string,
      clientId: body.clientId,
      tempId: body.tempId
    };

    console.info("ingestion publish", { chatId: event.chatId, senderId: event.senderId });

    await pub.publish(redis.CHANNELS.INGESTION, JSON.stringify(event));
    res.json({ ok: true });
  } catch (e: any) {
    console.error("ingestion error", { err: e?.message || String(e) });
    res.status(400).json({ error: e.message || "Bad Request" });
  }
});

const PORT = Number(process.env.INGESTION_SERVICE_PORT || 3002);
app.listen(PORT, () => console.log(`ingestion-service on ${PORT}`));
