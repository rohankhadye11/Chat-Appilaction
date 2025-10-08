import express from "express";
import cors from "cors";
import morgan from "morgan";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { jwt, mongo } from "@app/common";
import "dotenv/config";

const app = express();
app.use(cors());
app.use(express.json());
app.use(morgan("dev"));

const RegisterSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  displayName: z.string().min(1)
});

const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6)
});

app.get("/health", (_req, res) => res.json({ ok: true }));

app.post("/auth/register", async (req, res) => {
  try {
    const body = RegisterSchema.parse(req.body);
    const users = mongo.users();
    const existing = await users.findOne({ email: body.email });
    if (existing) return res.status(409).json({ error: "Email exists" });
    const passwordHash = await bcrypt.hash(body.password, 10);
    const doc = { _id: crypto.randomUUID(), email: body.email, passwordHash, displayName: body.displayName, createdAt: new Date() };
    await users.insertOne(doc);
    const token = jwt.sign(doc._id);
    res.json({ token, user: { id: doc._id, email: doc.email, displayName: doc.displayName } });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

app.post("/auth/login", async (req, res) => {
  try {
    const body = LoginSchema.parse(req.body);
    const users = mongo.users();
    const user = await users.findOne({ email: body.email });
    if (!user) return res.status(401).json({ error: "Invalid credentials" });
    const ok = await bcrypt.compare(body.password, user.passwordHash);
    if (!ok) return res.status(401).json({ error: "Invalid credentials" });
    const token = jwt.sign(user._id);
    res.json({ token, user: { id: user._id, email: user.email, displayName: user.displayName } });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

function authMiddleware(req: any, res: any, next: any) {
  try {
    const h = req.headers.authorization || "";
    const token = h.startsWith("Bearer ") ? h.slice(7) : "";
    if (!token) return res.status(401).json({ error: "No token" });
    const payload = jwt.verify(token);
    (req as any).userId = payload.sub;
    next();
  } catch {
    res.status(401).json({ error: "Invalid token" });
  }
}

app.get("/auth/me", authMiddleware, async (req, res) => {
  const users = mongo.users();
  const user = await users.findOne({ _id: (req as any).userId }, { projection: { passwordHash: 0 } });
  res.json({ user });
});

const PORT = Number(process.env.USER_SERVICE_PORT || 3001);

mongo.connect().then(() => {
  app.listen(PORT, () => console.log(`user-service on ${PORT}`));
});
