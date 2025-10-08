import React, { useEffect, useMemo, useRef, useState } from "react";
import { getHistory, login, openSocket, register, sendMessage, Message, listChats, createChat, type Chat } from "../lib/api";
import ConversationList from "./ConversationList";
import MessageList from "./MessageList";
import Composer from "./Composer";
import Header from "./Header";
import NewChatModal from "./NewChatModal";

const makeTempId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const CLIENT_ID_KEY = "chat_client_id";
const getClientId = () => {
  let v = localStorage.getItem(CLIENT_ID_KEY);
  if (!v) {
    v = crypto.randomUUID();
    localStorage.setItem(CLIENT_ID_KEY, v);
  }
  return v;
};

export default function App() {
  const [email, setEmail] = useState("a@a.com");
  const [password, setPassword] = useState("secret12");
  const [displayName, setDisplayName] = useState("Alice");
  const [token, setToken] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);

  const [chats, setChats] = useState<Chat[]>([{ _id: "global", type: "group" as const, memberIds: [], name: "Global" }]);
  const [active, setActive] = useState<string>("global");
  const [showCreate, setShowCreate] = useState(false);

  const [messages, setMessages] = useState<Record<string, Message[]>>({});
  const [typing, setTyping] = useState<Record<string, boolean>>({});
  const [connected, setConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const lastSeq = useRef<Map<string, number>>(new Map());

  const clientId = useMemo(getClientId, []);

  useEffect(() => {
    if (!token) return;
    const ws = openSocket(token);
    wsRef.current = ws;
    ws.onopen = () => setConnected(true);
    ws.onclose = () => setConnected(false);
    ws.onerror = () => setConnected(false);

    ws.onmessage = (e) => {
      try {
        const m = JSON.parse(e.data);
        if (!m?.chatId) return;
        if (m?.type === "typing") {
          setTyping((t) => ({ ...t, [m.chatId]: !!m.on }));
          return;
        }
        setMessages((prev) => {
          const list = prev[m.chatId] ? [...prev[m.chatId]] : [];
          const exists = list.find((x) => x._id === m._id);
          if (!exists) list.push(m);
          list.sort((a, b) => a.sequence_number - b.sequence_number);
          return { ...prev, [m.chatId]: list };
        });

        const prevSeq = lastSeq.current.get(m.chatId) || 0;
        if (m.sequence_number !== prevSeq + 1 && prevSeq !== 0) {
          void getHistory(m.chatId, { from: prevSeq + 1, to: m.sequence_number - 1 })
            .then((missing) => {
              if (missing.length) {
                setMessages((prev) => {
                  const list = prev[m.chatId] ? [...prev[m.chatId]] : [];
                  for (const mm of missing) {
                    if (!list.find((x) => x._id === mm._id)) list.push(mm);
                  }
                  list.sort((a, b) => a.sequence_number - b.sequence_number);
                  return { ...prev, [m.chatId]: list };
                });
              }
            })
            .catch(() => {});
        }
        lastSeq.current.set(m.chatId, m.sequence_number);
      } catch {
        // ignore
      }
    };

    return () => {
      try { ws.close(); } catch {}
      wsRef.current = null;
    };
  }, [token]);

  const doRegister = async () => {
    await register({ email, password, displayName });
  };

  const doLogin = async () => {
    const resp = await login({ email, password });
    setToken(resp.token);
    try {
      const [, payload] = resp.token.split(".");
      const obj = JSON.parse(atob(payload));
      setUserId(obj?.sub || null);
    } catch { setUserId(null); }

    listChats(resp.token)
      .then((serverChats) => {
        // Normalize and set; this will update member counts
        const normalized: Chat[] = serverChats.map((c) => ({
          _id: c._id,
          type: c.type === "dm" ? "dm" : "group",
          memberIds: Array.isArray(c.memberIds) ? c.memberIds : [],
          name: c.name
        }));
        setChats([{ _id: "global", type: "group" as const, memberIds: [], name: "Global" }, ...normalized]);
      })
      .catch(() => {});
  };

  const loadHistory = async (chatId: string) => {
    const data = await getHistory(chatId, { limit: 50 });
    setMessages((prev) => ({ ...prev, [chatId]: data }));
    const maxSeq = data.reduce((m, d) => Math.max(m, d.sequence_number || 0), 0);
    if (maxSeq) lastSeq.current.set(chatId, maxSeq);
  };

  useEffect(() => {
    void loadHistory(active);
  }, [active]);

  const sendTyping = (on: boolean) => {
    const ws = wsRef.current;
    if (!ws || !token) return;
    const payload = { type: "typing", chatId: active, userId, on };
    try { ws.send(JSON.stringify(payload)); } catch {}
  };

  const onSend = async (text: string) => {
    if (!token) return;
    const tempId = makeTempId();
    await sendMessage(token, active, text, clientId, tempId);
  };

  return (
    <div className="h-screen flex bg-gray-100 text-gray-900">
      <aside className="w-80 border-r bg-white flex flex-col">
        <div className="p-4 border-b">
          <div className="text-lg font-semibold">Chats</div>
        </div>

        <ConversationList
          chats={chats}
          active={active}
          onSelect={(id: string) => { setActive(id); void loadHistory(id); }}
          onCreateClick={() => setShowCreate(true)}
          onOpenManual={(id: string) => {
            if (!chats.find((c) => c._id === id)) {
              setChats((prev) => [...prev, { _id: id, type: "group" as const, memberIds: [], name: id }]);
            }
            setActive(id);
            void loadHistory(id);
          }}
        />

        <div className="mt-auto p-4 border-t space-y-2">
          {!token ? (
            <>
              <input className="border rounded px-3 py-2 w-full text-sm" placeholder="email" value={email} onChange={(e) => setEmail(e.target.value)} />
              <input className="border rounded px-3 py-2 w-full text-sm" placeholder="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
              <input className="border rounded px-3 py-2 w-full text-sm" placeholder="displayName" value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
              <div className="flex gap-2">
                <button className="px-3 py-2 bg-gray-200 hover:bg-gray-300 rounded text-sm" onClick={doRegister}>Register</button>
                <button className="px-3 py-2 bg-black hover:bg-gray-800 text-white rounded text-sm" onClick={doLogin}>Login</button>
              </div>
            </>
          ) : (
            <div className="text-xs text-gray-600">Connected: {connected ? "yes" : "no"}</div>
          )}
        </div>
      </aside>

      <main className="flex-1 flex flex-col">
        <Header chatName={chats.find((c) => c._id === active)?.name || active} typing={!!typing[active]} />
        <MessageList items={messages[active] || []} selfId={userId || ""} />
        <Composer onSend={onSend} onTyping={sendTyping} />
      </main>

      <NewChatModal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        onCreate={async ({ id, type, membersCsv, name }) => {
          if (!token) return;
          const memberIds = membersCsv.split(",").map((s) => s.trim()).filter(Boolean);
          try {
            const created = await createChat(token, { _id: id, type, memberIds, name });
            setChats((prev) => {
              const i = prev.findIndex((c) => c._id === created._id);
              if (i === -1) return [...prev, created];
              const copy = [...prev];
              copy[i] = created; // update memberIds and name from server
              return copy;
            });
            setActive(created._id);
            await loadHistory(created._id);
          } catch {
            // Local fallback: ensure memberIds are included so counts render
            const local: Chat = { _id: id, type, memberIds, name };
            setChats((prev) => {
              const i = prev.findIndex((c) => c._id === id);
              if (i === -1) return [...prev, local];
              const copy = [...prev];
              copy[i] = local;
              return copy;
            });
            setActive(id);
            await loadHistory(id);
          }
        }}
      />
    </div>
  );
}
