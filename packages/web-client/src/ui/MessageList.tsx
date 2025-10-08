import React, { useEffect, useRef } from "react";
import type { Message } from "../lib/api";

type Props = {
  items: Message[];
  selfId: string;
};

export default function MessageList({ items, selfId }: Props) {
  const ref = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (ref.current) ref.current.scrollTo({ top: ref.current.scrollHeight, behavior: "smooth" });
  }, [items.length]);

  return (
    <div ref={ref} className="flex-1 overflow-auto p-4 space-y-2 bg-slate-100">
      {items.map((m) => {
        const mine = m.senderId === selfId;
        return (
          <div key={m._id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
            <div
              className={`max-w-[72%] rounded-2xl px-3 py-2 shadow-sm border text-sm ${
                mine ? "bg-emerald-100 border-emerald-200" : "bg-white border-gray-200"
              }`}
            >
              <div className="whitespace-pre-wrap break-words">{m.text}</div>
              <div className="mt-1 text-[10px] text-gray-500 text-right">
                #{m.sequence_number} • {new Date(m.createdAt).toLocaleTimeString()}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
