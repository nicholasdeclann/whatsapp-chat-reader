"use client";

import { useRef, useState, useCallback } from "react";
import { parseWhatsAppChat, ChatMessage } from "./lib/parseChat";

type InputMode = "upload" | "paste";

export default function Home() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [participants, setParticipants] = useState<string[]>([]);
  const [perspective, setPerspective] = useState<string>("");
  const [dragging, setDragging] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [inputMode, setInputMode] = useState<InputMode>("upload");
  const [pasteText, setPasteText] = useState("");
  const [pasteError, setPasteError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const handleRawText = (text: string, name?: string) => {
    const { messages, participants } = parseWhatsAppChat(text);
    if (messages.length === 0) {
      setPasteError("No messages found. Make sure the format is correct.");
      return;
    }
    setPasteError("");
    setMessages(messages);
    setParticipants(participants);
    setPerspective(participants[0] ?? "");
    setFileName(name ?? "Pasted chat");
  };

  const handleFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      handleRawText(e.target?.result as string, file.name);
    };
    reader.readAsText(file);
  };

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  };

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  }, []);

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(true);
  };

  const onDragLeave = () => setDragging(false);

  const reset = () => {
    setMessages([]);
    setParticipants([]);
    setPerspective("");
    setFileName(null);
    setPasteText("");
    setPasteError("");
    if (inputRef.current) inputRef.current.value = "";
  };

  return (
    <main className="min-h-screen bg-[#111b21] flex flex-col items-center py-10 px-4">
      <h1 className="text-white text-2xl font-semibold mb-2 tracking-tight">
        WhatsApp Chat Viewer
      </h1>
      <p className="text-[#8696a0] text-sm mb-6">
        Upload or paste an exported WhatsApp chat to view it as bubbles.
      </p>

      {messages.length === 0 ? (
        <div className="w-full max-w-md flex flex-col gap-4">
          {/* Tab switcher */}
          <div className="flex bg-[#1f2c34] rounded-xl p-1 gap-1">
            <button
              onClick={() => setInputMode("upload")}
              className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
                inputMode === "upload"
                  ? "bg-[#00a884] text-white"
                  : "text-[#8696a0] hover:text-white"
              }`}
            >
              Upload File
            </button>
            <button
              onClick={() => setInputMode("paste")}
              className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
                inputMode === "paste"
                  ? "bg-[#00a884] text-white"
                  : "text-[#8696a0] hover:text-white"
              }`}
            >
              Paste Text
            </button>
          </div>

          {inputMode === "upload" ? (
            <div
              className={`border-2 border-dashed rounded-2xl p-10 flex flex-col items-center gap-4 cursor-pointer transition-colors ${
                dragging
                  ? "border-[#00a884] bg-[#00a8841a]"
                  : "border-[#2a3942] bg-[#1f2c34]"
              }`}
              onClick={() => inputRef.current?.click()}
              onDrop={onDrop}
              onDragOver={onDragOver}
              onDragLeave={onDragLeave}
            >
              <svg
                className="w-12 h-12 text-[#00a884]"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5"
                />
              </svg>
              <p className="text-[#8696a0] text-sm text-center">
                Drag & drop your{" "}
                <span className="text-white font-medium">.txt</span> file here,
                or{" "}
                <span className="text-[#00a884] font-medium">
                  click to browse
                </span>
              </p>
              <input
                ref={inputRef}
                type="file"
                accept=".txt"
                className="hidden"
                onChange={onFileChange}
              />
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              <textarea
                className="w-full h-64 bg-[#1f2c34] text-white text-sm rounded-2xl p-4 border border-[#2a3942] outline-none resize-none placeholder-[#8696a0] focus:border-[#00a884] transition-colors"
                placeholder={`Paste your WhatsApp chat here...\n\nExpected format:\n[17:23, 5/21/2026] Name: message`}
                value={pasteText}
                onChange={(e) => {
                  setPasteText(e.target.value);
                  setPasteError("");
                }}
              />
              {pasteError && (
                <p className="text-red-400 text-xs">{pasteError}</p>
              )}
              <button
                onClick={() => handleRawText(pasteText)}
                disabled={!pasteText.trim()}
                className="w-full py-3 bg-[#00a884] hover:bg-[#02b698] disabled:opacity-40 disabled:cursor-not-allowed text-white font-medium rounded-xl text-sm transition-colors"
              >
                View Chat
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="w-full max-w-xl flex flex-col gap-4">
          {/* Top bar */}
          <div className="flex items-center justify-between bg-[#1f2c34] rounded-xl px-4 py-3">
            <div className="flex flex-col">
              <span className="text-white text-sm font-medium truncate max-w-[200px]">
                {fileName}
              </span>
              <span className="text-[#8696a0] text-xs">
                {messages.length} messages · {participants.length} participants
              </span>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex flex-col items-end">
                <label className="text-[#8696a0] text-xs mb-1">
                  Your perspective
                </label>
                <select
                  className="bg-[#2a3942] text-white text-sm rounded-lg px-2 py-1 border border-[#3b4a54] outline-none"
                  value={perspective}
                  onChange={(e) => setPerspective(e.target.value)}
                >
                  {participants.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
              </div>
              <button
                onClick={reset}
                className="text-[#8696a0] hover:text-white transition-colors text-xs underline"
              >
                Clear
              </button>
            </div>
          </div>

          {/* Chat window */}
          <div className="bg-[#0b141a] rounded-2xl flex flex-col gap-1 p-4 overflow-y-auto max-h-[70vh]">
            {messages.map((msg) => {
              const isMe = msg.sender === perspective;
              return (
                <div
                  key={msg.id}
                  className={`flex ${isMe ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`relative max-w-[75%] px-3 py-2 rounded-2xl text-sm shadow-md ${
                      isMe
                        ? "bg-[#005c4b] text-white rounded-br-sm"
                        : "bg-[#1f2c34] text-white rounded-bl-sm"
                    }`}
                  >
                    {!isMe && (
                      <p className="text-[#00a884] font-semibold text-xs mb-1">
                        {msg.sender}
                      </p>
                    )}
                    {msg.replyTo && (
                      <div className={`mb-2 px-2 py-1.5 rounded-lg border-l-4 text-xs ${
                        isMe
                          ? "bg-[#004036] border-[#00a884]"
                          : "bg-[#16232b] border-[#00a884]"
                      }`}>
                        <p className="text-[#00a884] font-semibold mb-0.5">{msg.replyTo.sender}</p>
                        <p className="text-[#8696a0] line-clamp-2 whitespace-pre-wrap">{msg.replyTo.text}</p>
                      </div>
                    )}
                    <p className="whitespace-pre-wrap leading-relaxed">
                      {msg.text}
                    </p>
                    <p className="text-[#8696a0] text-[10px] text-right mt-1 -mb-0.5">
                      {msg.timestamp}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </main>
  );
}
