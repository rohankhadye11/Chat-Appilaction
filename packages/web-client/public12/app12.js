const api = {
  base: "http://localhost:8080",
  auth: (p) => fetch(`${api.base}/api/auth${p}`, { headers: { "Content-Type": "application/json" } }),
  post: (url, body, token) => fetch(`${api.base}${url}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(body)
  }),
  get: (url, token) => fetch(`${api.base}${url}`, { headers: { Authorization: `Bearer ${token}` } })
};

let token = null;
let ws = null;
let state = { messages: [] };

function render() {
  const list = document.getElementById("messages");
  list.innerHTML = "";
  for (const m of state.messages.sort((a,b)=>a.sequence_number-b.sequence_number)) {
    const li = document.createElement("li");
    li.textContent = `#${m.sequence_number} ${m.senderId}: ${m.text}`;
    list.appendChild(li);
  }
}

document.getElementById("register").onclick = async () => {
  const email = document.getElementById("email").value;
  const password = document.getElementById("password").value;
  const displayName = document.getElementById("displayName").value || "User";
  const res = await api.auth("/register", {
    method: "POST",
    body: JSON.stringify({ email, password, displayName })
  });
  const data = await res.json();
  if (data.token) {
    token = data.token;
    document.getElementById("authStatus").textContent = "Registered & logged in";
  } else {
    document.getElementById("authStatus").textContent = data.error || "Error";
  }
};

document.getElementById("login").onclick = async () => {
  const email = document.getElementById("email").value;
  const password = document.getElementById("password").value;
  const res = await api.auth("/login", {
    method: "POST",
    body: JSON.stringify({ email, password })
  });
  const data = await res.json();
  if (data.token) {
    token = data.token;
    document.getElementById("authStatus").textContent = "Logged in";
  } else {
    document.getElementById("authStatus").textContent = data.error || "Error";
  }
};

document.getElementById("join").onclick = async () => {
  if (!token) { alert("Login first"); return; }
  const chatId = document.getElementById("chatId").value || "global";
  // Fetch last 50
  const res = await api.get(`/api/history/${encodeURIComponent(chatId)}?limit=50`, token);
  const data = await res.json();
  state.messages = data.messages || [];
  render();
  // Connect WS
  if (ws) ws.close();
  ws = new WebSocket(`ws://localhost:8080/ws?token=${encodeURIComponent(token)}`);
  ws.onmessage = (ev) => {
    const msg = JSON.parse(ev.data);
    if (msg.chatId !== chatId) return;
    // Insert by sequence_number; if gap, simple re-fetch
    state.messages.push(msg);
    const seqs = state.messages.map(m=>m.sequence_number);
    const missing = Math.max(...seqs) - state.messages.length + 1;
    if (missing > 0) {
      // naive reconciliation
      api.get(`/api/history/${encodeURIComponent(chatId)}?limit=50`, token).then(r=>r.json()).then(d=>{
        state.messages = d.messages || state.messages;
        render();
      });
    } else {
      render();
    }
  };
};

document.getElementById("send").onclick = async () => {
  if (!token) { alert("Login first"); return; }
  const chatId = document.getElementById("chatId").value || "global";
  const text = document.getElementById("text").value;
  if (!text) return;
  await api.post("/api/messages/send", { chatId, text, tempId: crypto.randomUUID() }, token);
  document.getElementById("text").value = "";
};
