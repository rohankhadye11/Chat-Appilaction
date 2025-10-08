import React, { useState } from "react";

type Props = {
  open: boolean;
  onClose: () => void;
  onCreate: (payload: { id: string; type: "dm" | "group"; membersCsv: string; name?: string }) => Promise<void> | void;
};

export default function NewChatModal({ open, onClose, onCreate }: Props) {
  const [id, setId] = useState("");
  const [name, setName] = useState("");
  const [type, setType] = useState<"dm" | "group">("dm");
  const [membersCsv, setMembersCsv] = useState("");

  if (!open) return null;

  const submit = async () => {
    if (!id.trim()) return;
    await onCreate({ id: id.trim(), type, membersCsv: membersCsv.trim(), name: name.trim() || undefined });
    setId(""); setName(""); setMembersCsv("");
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center">
      <div className="bg-white w-[420px] rounded shadow-lg p-4 space-y-3">
        <div className="text-lg font-semibold">Create chat</div>
        <input className="border rounded px-3 py-2 w-full text-sm" placeholder="Chat ID (e.g., dm-alice-bob)" value={id} onChange={(e) => setId(e.target.value)} />
        <input className="border rounded px-3 py-2 w-full text-sm" placeholder="Display name (optional)" value={name} onChange={(e) => setName(e.target.value)} />
        <div className="flex items-center gap-3">
          <label className="text-sm">Type:</label>
          <select className="border rounded px-2 py-1 text-sm" value={type} onChange={(e) => setType(e.target.value as "dm" | "group")}>
            <option value="dm">dm</option>
            <option value="group">group</option>
          </select>
        </div>
        <textarea
          className="border rounded px-3 py-2 w-full text-sm h-16"
          placeholder="Member userIds, comma-separated (include self)"
          value={membersCsv}
          onChange={(e) => setMembersCsv(e.target.value)}
        />
        <div className="flex justify-end gap-2 pt-2">
          <button className="px-3 py-2 text-sm rounded border" onClick={onClose}>Cancel</button>
          <button className="px-3 py-2 text-sm rounded bg-black text-white" onClick={submit}>Create</button>
        </div>
      </div>
    </div>
  );
}
