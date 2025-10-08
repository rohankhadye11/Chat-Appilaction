import React, { useEffect, useRef, useState } from "react";

type Props = {
  onSend: (text: string) => void | Promise<void>;
  onTyping?: (on: boolean) => void;
};

export default function Composer({ onSend, onTyping }: Props) {
  const [text, setText] = useState("");
  const typingTimer = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (typingTimer.current) window.clearTimeout(typingTimer.current);
    };
  }, []);

  const handleChange = (v: string) => {
    setText(v);
    if (onTyping) {
      onTyping(true);
      if (typingTimer.current) window.clearTimeout(typingTimer.current);
      typingTimer.current = window.setTimeout(() => onTyping(false), 1200);
    }
  };

  const submit = async () => {
    const t = text.trim();
    if (!t) return;
    await onSend(t);
    setText("");
    if (onTyping) onTyping(false);
  };

  const onKey = async (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      await submit();
    }
  };

  return (
  <div className="p-3 border-t bg-white">
    <div className="flex gap-2">
      <textarea
        className="flex-1 border rounded px-3 py-2 h-12 resize-none focus:outline-none focus:ring-2 focus:ring-gray-300"
        placeholder="Type a message"
        value={text}
        onChange={(e) => handleChange(e.target.value)}
        onKeyDown={onKey}
      />
      <button className="px-4 py-2 bg-black text-white rounded hover:bg-gray-800" onClick={submit}>
        Send
      </button>
    </div>
  </div>
);

}
