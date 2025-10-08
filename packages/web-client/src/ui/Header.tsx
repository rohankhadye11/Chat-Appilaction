import React from "react";

type Props = {
  chatName: string;
  typing: boolean;
};

export default function Header({ chatName, typing }: Props) {
  return (
    <div className="h-14 border-b bg-white flex items-center justify-between px-4 sticky top-0 z-10">
      <div className="font-semibold">{chatName}</div>
      <div className="text-sm text-gray-500">{typing ? "Typing..." : ""}</div>
    </div>
  );
}

