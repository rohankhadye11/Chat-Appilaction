import React from "react";
import type { Chat } from "../lib/api";

type Props = {
  chats: Chat[];
  active: string;
  onSelect: (id: string) => void;
  onCreateClick: () => void;
  onOpenManual: (id: string) => void;
};

export default function ConversationList({ chats, active, onSelect, onCreateClick, onOpenManual }: Props) {
  const [manualId, setManualId] = React.useState("");

  return (
    <div className="flex-1 flex flex-col">
      <ul className="flex-1 overflow-auto">
        {chats.map((c) => (
          <li
            key={c._id}
            className={`px-4 py-3 cursor-pointer border-b hover:bg-gray-50 ${active === c._id ? "bg-gray-100" : ""}`}
            onClick={() => onSelect(c._id)}
          >
            <div className="font-medium">{c.name || c._id}</div>
            {/* <div className="text-xs text-gray-500">{c.type} </div> */}
          </li>
        ))}
      </ul>

      <div className="p-3 border-t space-y-2">
        <button className="w-full text-sm px-3 py-2 bg-black text-white rounded hover:bg-gray-800" onClick={onCreateClick}>
          New chat
        </button>
        <div className="flex gap-2">
          <input
            className="border rounded px-2 py-1 text-sm flex-1"
            placeholder="Enter chatId..."
            value={manualId}
            onChange={(e) => setManualId(e.target.value)}
          />
          <button className="text-sm px-3 py-1 border rounded" onClick={() => manualId.trim() && onOpenManual(manualId.trim())}>
            Open
          </button>
        </div>
      </div>
    </div>
  );
}
