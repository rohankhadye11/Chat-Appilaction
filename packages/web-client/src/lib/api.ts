const AUTH_BASE = "http://localhost:3001";
const INGEST_BASE = "http://localhost:3002";
const HISTORY_BASE = "http://localhost:3003";
const CHAT_BASE = "http://localhost:3004"; // Adjust if different

export type LoginResponse = { token: string };
export type RegisterRequest = { email: string; password: string; displayName: string };
export type LoginRequest = { email: string; password: string };

export type Message = {
  _id: string;
  chatId: string;
  senderId: string;
  text: string;
  sequence_number: number;
  createdAt: string;
};

export type Chat = { _id: string; type: "dm" | "group"; memberIds: string[]; name?: string };

export async function register(body: RegisterRequest) {
  const r = await fetch(`${AUTH_BASE}/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

export async function login(body: LoginRequest): Promise<LoginResponse> {
  const r = await fetch(`${AUTH_BASE}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

export async function sendMessage(token: string, chatId: string, text: string, clientId?: string, tempId?: string) {
  const r = await fetch(`${INGEST_BASE}/messages/send`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify({ chatId, text, clientId, tempId })
  });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

export async function getHistory(chatId: string, params?: { limit?: number; from?: number; to?: number }) {
  const q = new URLSearchParams();
  if (params?.limit) q.set("limit", String(params.limit));
  if (params?.from) q.set("from", String(params.from));
  if (params?.to) q.set("to", String(params.to));
  const r = await fetch(`${HISTORY_BASE}/history/${encodeURIComponent(chatId)}?${q.toString()}`);
  if (!r.ok) throw new Error(await r.text());
  return r.json() as Promise<Message[]>;
}

export function openSocket(token: string) {
  const u = new URL("ws://localhost:4000/ws");
  u.searchParams.set("token", token);
  return new WebSocket(u.toString());
}

// Chats API
export async function listChats(token: string) {
  const r = await fetch(`${CHAT_BASE}/chats`, { headers: { Authorization: `Bearer ${token}` } });
  if (!r.ok) throw new Error(await r.text());
  return r.json() as Promise<Chat[]>;
}

export async function createChat(token: string, body: { _id: string; type: "dm" | "group"; memberIds: string[]; name?: string }) {
  const r = await fetch(`${CHAT_BASE}/chats`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(body)
  });
  if (!r.ok) throw new Error(await r.text());
  return r.json() as Promise<Chat>;
}
