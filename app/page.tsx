"use client";

import { useRef, useState, useCallback, useEffect } from "react";
import { parseWhatsAppChat, ChatMessage } from "./lib/parseChat";
import {
  SavedChat,
  loadSavedChats,
  saveChat,
  deleteChat,
  generateId,
} from "./lib/savedChats";

type InputMode = "upload" | "paste";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Parse WhatsApp formatting: *bold*, _italic_, ~strikethrough~, `monospace` */
function renderFormattedSegment(text: string, key: string): React.ReactNode {
  // Process formatting markers in order. We use a regex that captures the
  // outermost formatting token and recurse for nested formatting.
  const FORMATTING_RE = /(\*(.+?)\*|_(.+?)_|~(.+?)~|`(.+?)`)/ ;

  const parts: React.ReactNode[] = [];
  let remaining = text;
  let idx = 0;

  while (remaining) {
    const match = remaining.match(FORMATTING_RE);
    if (!match || match.index === undefined) {
      parts.push(remaining);
      break;
    }

    // Text before the match
    if (match.index > 0) {
      parts.push(remaining.slice(0, match.index));
    }

    const k = `${key}-${idx++}`;
    if (match[2] !== undefined) {
      // *bold*
      parts.push(<strong key={k} className="font-bold">{renderFormattedSegment(match[2], k)}</strong>);
    } else if (match[3] !== undefined) {
      // _italic_
      parts.push(<em key={k} className="italic">{renderFormattedSegment(match[3], k)}</em>);
    } else if (match[4] !== undefined) {
      // ~strikethrough~
      parts.push(<del key={k} className="line-through">{renderFormattedSegment(match[4], k)}</del>);
    } else if (match[5] !== undefined) {
      // `monospace`
      parts.push(<code key={k} className="bg-[#1a2b33] px-1 rounded text-[#e9e9e9] text-[13px] font-mono">{match[5]}</code>);
    }

    remaining = remaining.slice(match.index + match[0].length);
  }

  return parts.length === 1 ? parts[0] : <>{parts}</>;
}

function renderTextWithLinks(text: string, participants: string[]) {
  const escapedNames = participants
    .slice()
    .sort((a, b) => b.length - a.length)
    .map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  const splitPattern = escapedNames.length
    ? new RegExp(`(https?:\\/\\/[^\\s]+|@(?:${escapedNames.join("|")}))`, "g")
    : /(https?:\/\/[^\s]+)/g;

  const parts = text.split(splitPattern).filter(Boolean);
  return parts.map((part, i) => {
    if (/^https?:\/\//.test(part)) {
      return (
        <a
          key={i}
          href={part}
          target="_blank"
          rel="noopener noreferrer"
          className="underline text-[#53bdeb] break-all"
        >
          {part}
        </a>
      );
    }
    if (/^@/.test(part)) {
      return (
        <span key={i} className="text-[#53bdeb]">
          {part}
        </span>
      );
    }
    // Apply WhatsApp formatting to plain text segments
    return <span key={i}>{renderFormattedSegment(part, `seg-${i}`)}</span>;
  });
}

function formatDateLabel(isoDate: string): string {
  const today = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  const todayStr = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`;
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  const yesterdayStr = `${yesterday.getFullYear()}-${pad(yesterday.getMonth() + 1)}-${pad(yesterday.getDate())}`;

  if (isoDate === todayStr) return "Today";
  if (isoDate === yesterdayStr) return "Yesterday";

  const [y, m, d] = isoDate.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function shortDate(isoDate?: string): string {
  if (!isoDate) return "";
  const today = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  const todayStr = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`;
  if (isoDate === todayStr) return "Today";
  const [y, m, d] = isoDate.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
  });
}

// ---------------------------------------------------------------------------
// Sidebar
// ---------------------------------------------------------------------------

function ChatSidebar({
  chats,
  activeId,
  open,
  onClose,
  onSelect,
  onDelete,
  onNewChat,
}: {
  chats: SavedChat[];
  activeId: string | null;
  open: boolean;
  onClose: () => void;
  onSelect: (chat: SavedChat) => void;
  onDelete: (id: string) => void;
  onNewChat: () => void;
}) {
  const handleSelect = (chat: SavedChat) => {
    onSelect(chat);
    onClose(); // auto-close on mobile after selecting
  };

  return (
    <>
      {/* Mobile backdrop */}
      {open && (
        <div
          className="fixed inset-0 bg-black/50 z-20 md:hidden"
          onClick={onClose}
        />
      )}

      <aside
        className={`
          fixed top-0 left-0 h-full z-30 flex flex-col bg-[#111b21] border-r border-[#2a3942]
          w-4/5 max-w-xs
          transition-transform duration-300 ease-in-out
          ${open ? "translate-x-0" : "-translate-x-full"}
          md:relative md:translate-x-0 md:w-80 md:min-w-[260px] md:z-auto md:h-screen
        `}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 bg-[#1f2c34]">
          <span className="text-white font-semibold text-base">Chats</span>
          <div className="flex items-center gap-3">
            <button
              onClick={onNewChat}
              title="Import new chat"
              className="text-[#00a884] hover:text-[#02b698] transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
            </button>
            {/* Close button — mobile only */}
            <button
              onClick={onClose}
              className="text-[#8696a0] hover:text-white transition-colors md:hidden"
              title="Close"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Chat list */}
        <div className="flex-1 overflow-y-auto">
          {chats.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-2 px-6 text-center">
              <svg className="w-10 h-10 text-[#2a3942]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                  d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
              <p className="text-[#8696a0] text-xs">No saved chats yet.<br />Import a chat to get started.</p>
            </div>
          ) : (
            chats.map((chat) => (
              <div
                key={chat.id}
                onClick={() => handleSelect(chat)}
                className={`flex items-center gap-3 px-4 py-3 cursor-pointer border-b border-[#1f2c34] transition-colors group ${
                  activeId === chat.id ? "bg-[#2a3942]" : "hover:bg-[#1f2c34]"
                }`}
              >
                {/* Avatar */}
                <div className="w-10 h-10 rounded-full bg-[#00a884] flex items-center justify-center shrink-0 text-white font-semibold text-sm uppercase">
                  {chat.name.charAt(0)}
                </div>
                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="text-white text-sm font-medium truncate">{chat.name}</span>
                    <span className="text-[#8696a0] text-[11px] ml-2 shrink-0">{shortDate(chat.lastDate)}</span>
                  </div>
                  <p className="text-[#8696a0] text-xs truncate mt-0.5">
                    {chat.lastMessage ?? `${chat.messages.length} messages`}
                  </p>
                </div>
                {/* Delete button */}
                <button
                  onClick={(e) => { e.stopPropagation(); onDelete(chat.id); }}
                  title="Delete chat"
                  className="text-[#8696a0] hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100 md:opacity-0 shrink-0"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>
            ))
          )}
        </div>
      </aside>
    </>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function Home() {
  const [savedChats, setSavedChats] = useState<SavedChat[]>([]);
  const [activeChat, setActiveChat] = useState<SavedChat | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Import state
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [participants, setParticipants] = useState<string[]>([]);
  const [perspective, setPerspective] = useState<string>("");
  const [dragging, setDragging] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [chatTitle, setChatTitle] = useState<string>("");
  const [inputMode, setInputMode] = useState<InputMode>("upload");
  const [pasteText, setPasteText] = useState("");
  const [pasteError, setPasteError] = useState("");
  const [showImporter, setShowImporter] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);

  // Load saved chats from localStorage on mount
  useEffect(() => {
    setSavedChats(loadSavedChats());
  }, []);

  // Derive whether we're viewing an active chat or the importer
  const isViewing = activeChat !== null;
  const isImporting = showImporter && !isViewing;

  // -------------------------------------------------------------------------
  // Import handlers
  // -------------------------------------------------------------------------

  const handleRawText = (text: string, name?: string) => {
    const { messages: msgs, participants: parts } = parseWhatsAppChat(text);
    if (msgs.length === 0) {
      setPasteError("No messages found. Make sure the format is correct.");
      return;
    }
    setPasteError("");
    setMessages(msgs);
    setParticipants(parts);
    setPerspective(parts[0] ?? "");
    setFileName(name ?? "Pasted chat");
    // Auto-derive chat title
    if (parts.length === 2) {
      setChatTitle(`${parts[0]} / ${parts[1]}`);
    } else {
      setChatTitle("Group Chat");
    }
  };

  const handleFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => handleRawText(e.target?.result as string, file.name);
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

  // Save the currently imported chat
  const handleSaveChat = () => {
    if (messages.length === 0) return;
    const lastMsg = messages[messages.length - 1];
    const name = chatTitle.trim() || (participants.length === 2 ? `${participants[0]} / ${participants[1]}` : "Group Chat");
    const chat: SavedChat = {
      id: generateId(),
      name,
      participants,
      perspective,
      messages,
      savedAt: new Date().toISOString(),
      lastMessage: lastMsg.text.slice(0, 80),
      lastDate: lastMsg.date,
    };
    saveChat(chat);
    const updated = loadSavedChats();
    setSavedChats(updated);
    setActiveChat(chat);
    setShowImporter(false);
    resetImport();
  };

  const resetImport = () => {
    setMessages([]);
    setParticipants([]);
    setPerspective("");
    setFileName(null);
    setChatTitle("");
    setPasteText("");
    setPasteError("");
    if (inputRef.current) inputRef.current.value = "";
  };

  const handleDeleteChat = (id: string) => {
    deleteChat(id);
    const updated = loadSavedChats();
    setSavedChats(updated);
    if (activeChat?.id === id) setActiveChat(updated[0] ?? null);
  };

  const handleSelectChat = (chat: SavedChat) => {
    setActiveChat(chat);
    setShowImporter(false);
    resetImport();
    setSidebarOpen(false);
  };

  const handleNewChat = () => {
    setActiveChat(null);
    setShowImporter(true);
    resetImport();
    setSidebarOpen(false);
  };

  // The currently displayed messages/participants come either from an active
  // saved chat or from the in-progress import.
  const viewMessages = isViewing ? activeChat!.messages : messages;
  const viewParticipants = isViewing ? activeChat!.participants : participants;
  const viewPerspective = isViewing ? activeChat!.perspective : perspective;
  const viewFileName = isViewing ? activeChat!.name : fileName;

  const setPerspectiveForActive = (p: string) => {
    if (isViewing && activeChat) {
      const updated = { ...activeChat, perspective: p };
      saveChat(updated);
      setSavedChats(loadSavedChats());
      setActiveChat(updated);
    } else {
      setPerspective(p);
    }
  };

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  const hasSavedChats = savedChats.length > 0;

  return (
    <div className="flex h-screen bg-[#111b21] overflow-hidden">
      {/* Sidebar */}
      {(hasSavedChats || showImporter) && (
        <ChatSidebar
          chats={savedChats}
          activeId={activeChat?.id ?? null}
          open={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
          onSelect={handleSelectChat}
          onDelete={handleDeleteChat}
          onNewChat={handleNewChat}
        />
      )}

      {/* Main content area */}
      <main className="flex-1 flex flex-col items-center overflow-y-auto py-10 px-4">
        {/* Landing / no chats yet */}
        {!hasSavedChats && !showImporter && !isViewing && (
          <div className="flex flex-col items-center gap-6 mt-16 w-full max-w-md">
            <div className="text-center">
              <h1 className="text-white text-2xl font-semibold mb-2 tracking-tight">
                WhatsApp Chat Viewer
              </h1>
              <p className="text-[#8696a0] text-sm">
                Upload or paste an exported WhatsApp chat to view it as bubbles.
              </p>
            </div>
            <button
              onClick={handleNewChat}
              className="w-full py-3 bg-[#00a884] hover:bg-[#02b698] text-white font-medium rounded-xl text-sm transition-colors"
            >
              Import a Chat
            </button>
          </div>
        )}

        {/* Importer */}
        {isImporting && messages.length === 0 && (
          <div className="w-full max-w-md flex flex-col gap-4">
            <div className="flex items-center gap-3">
              {hasSavedChats && (
                <button
                  onClick={() => setSidebarOpen(true)}
                  className="text-[#8696a0] hover:text-white transition-colors md:hidden shrink-0"
                  title="Open chats"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                  </svg>
                </button>
              )}
              <h1 className="text-white text-xl font-semibold">Import Chat</h1>
            </div>

            {/* Tab switcher */}
            <div className="flex bg-[#1f2c34] rounded-xl p-1 gap-1">
              <button
                onClick={() => setInputMode("upload")}
                className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
                  inputMode === "upload" ? "bg-[#00a884] text-white" : "text-[#8696a0] hover:text-white"
                }`}
              >
                Upload File
              </button>
              <button
                onClick={() => setInputMode("paste")}
                className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
                  inputMode === "paste" ? "bg-[#00a884] text-white" : "text-[#8696a0] hover:text-white"
                }`}
              >
                Paste Text
              </button>
            </div>

            {inputMode === "upload" ? (
              <div
                className={`border-2 border-dashed rounded-2xl p-10 flex flex-col items-center gap-4 cursor-pointer transition-colors ${
                  dragging ? "border-[#00a884] bg-[#00a8841a]" : "border-[#2a3942] bg-[#1f2c34]"
                }`}
                onClick={() => inputRef.current?.click()}
                onDrop={onDrop}
                onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
                onDragLeave={() => setDragging(false)}
              >
                <svg className="w-12 h-12 text-[#00a884]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                    d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                </svg>
                <p className="text-[#8696a0] text-sm text-center">
                  Drag & drop your <span className="text-white font-medium">.txt</span> file here, or{" "}
                  <span className="text-[#00a884] font-medium">click to browse</span>
                </p>
                <input ref={inputRef} type="file" accept=".txt" className="hidden" onChange={onFileChange} />
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                <textarea
                  className="w-full h-64 bg-[#1f2c34] text-white text-sm rounded-2xl p-4 border border-[#2a3942] outline-none resize-none placeholder-[#8696a0] focus:border-[#00a884] transition-colors"
                  placeholder={`Paste your WhatsApp chat here...\n\nExpected format:\n[17:23, 5/21/2026] Name: message`}
                  value={pasteText}
                  onChange={(e) => { setPasteText(e.target.value); setPasteError(""); }}
                />
                {pasteError && <p className="text-red-400 text-xs">{pasteError}</p>}
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
        )}

        {/* Preview after parsing — before saving */}
        {isImporting && messages.length > 0 && (
          <div className="w-full max-w-xl flex flex-col gap-4">
            {/* Save banner */}
            <div className="flex flex-col gap-3 bg-[#1f2c34] rounded-xl px-4 py-3">
              <div className="flex items-center gap-3">
                {/* Hamburger — mobile only */}
                {hasSavedChats && (
                  <button
                    onClick={() => setSidebarOpen(true)}
                    className="text-[#8696a0] hover:text-white transition-colors md:hidden shrink-0"
                    title="Open chats"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                    </svg>
                  </button>
                )}
                <div className="flex-1 flex items-center justify-between">
                  <p className="text-[#8696a0] text-xs">{messages.length} messages · {participants.length} participant{participants.length !== 1 ? "s" : ""}</p>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={resetImport}
                      className="text-[#8696a0] hover:text-white transition-colors text-xs underline"
                    >
                      Discard
                    </button>
                    <button
                      onClick={handleSaveChat}
                      className="px-3 py-1.5 bg-[#00a884] hover:bg-[#02b698] text-white text-xs font-medium rounded-lg transition-colors"
                    >
                      Save Chat
                    </button>
                  </div>
                </div>
              </div>

              {/* Name row */}
              {participants.length === 2 ? (
                <div className="flex items-center gap-2">
                  <span className="text-[#8696a0] text-xs shrink-0">Chat name:</span>
                  <span className="text-white text-sm font-medium">{chatTitle}</span>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <label className="text-[#8696a0] text-xs shrink-0">Group name:</label>
                  <input
                    type="text"
                    value={chatTitle}
                    onChange={(e) => setChatTitle(e.target.value)}
                    placeholder="Group Chat"
                    className="flex-1 bg-[#2a3942] text-white text-sm rounded-lg px-3 py-1.5 border border-[#3b4a54] outline-none focus:border-[#00a884] transition-colors placeholder-[#8696a0]"
                  />
                </div>
              )}
            </div>

            <ChatViewer
              messages={messages}
              participants={participants}
              perspective={perspective}
              onPerspectiveChange={setPerspective}
            />
          </div>
        )}

        {/* Viewing a saved chat */}
        {isViewing && (
          <div className="w-full max-w-xl flex flex-col gap-4">
            {/* Top bar */}
            <div className="flex items-center gap-3 bg-[#1f2c34] rounded-xl px-4 py-3">
              {/* Hamburger — mobile only */}
              {hasSavedChats && (
                <button
                  onClick={() => setSidebarOpen(true)}
                  className="text-[#8696a0] hover:text-white transition-colors md:hidden shrink-0"
                  title="Open chats"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                  </svg>
                </button>
              )}
              <div className="flex-1 flex items-center justify-between">
                <div className="flex flex-col">
                  <span className="text-white text-sm font-medium truncate max-w-[160px]">{viewFileName}</span>
                  <span className="text-[#8696a0] text-xs">
                    {viewMessages.length} messages · {viewParticipants.length} participants
                  </span>
                </div>
                <div className="flex flex-col items-end">
                  <label className="text-[#8696a0] text-xs mb-1">Your perspective</label>
                  <select
                    className="bg-[#2a3942] text-white text-sm rounded-lg px-2 py-1 border border-[#3b4a54] outline-none"
                    value={viewPerspective}
                    onChange={(e) => setPerspectiveForActive(e.target.value)}
                  >
                    {viewParticipants.map((p) => (
                      <option key={p} value={p}>{p}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            <ChatViewer
              messages={viewMessages}
              participants={viewParticipants}
              perspective={viewPerspective}
              onPerspectiveChange={setPerspectiveForActive}
            />
          </div>
        )}
      </main>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Chat viewer (bubbles)
// ---------------------------------------------------------------------------

function ChatViewer({
  messages,
  participants,
  perspective,
}: {
  messages: ChatMessage[];
  participants: string[];
  perspective: string;
  onPerspectiveChange: (p: string) => void;
}) {
  return (
    <div className="bg-[#0b141a] rounded-2xl flex flex-col gap-1 p-4 overflow-y-auto max-h-[70vh]">
      {(() => {
        const items: React.ReactNode[] = [];
        let lastDate = "";
        for (const msg of messages) {
          if (msg.date !== lastDate) {
            lastDate = msg.date;
            items.push(
              <div key={`sep-${msg.date}`} className="flex justify-center my-2">
                <span className="bg-[#1f2c34] text-[#8696a0] text-xs px-3 py-1 rounded-full shadow">
                  {formatDateLabel(msg.date)}
                </span>
              </div>
            );
          }
          const isMe = msg.sender === perspective;
          items.push(
            <div key={msg.id} className={`flex ${isMe ? "justify-end" : "justify-start"}`}>
              <div
                className={`relative max-w-[75%] px-3 py-2 rounded-2xl text-sm shadow-md ${
                  isMe ? "bg-[#005c4b] text-white rounded-br-sm" : "bg-[#1f2c34] text-white rounded-bl-sm"
                }`}
              >
                {!isMe && (
                  <p className="text-[#00a884] font-semibold text-xs mb-1">{msg.sender}</p>
                )}
                {msg.replyTo && (
                  <div className={`mb-2 px-2 py-1.5 rounded-lg border-l-4 text-xs ${
                    isMe ? "bg-[#004036] border-[#00a884]" : "bg-[#16232b] border-[#00a884]"
                  }`}>
                    <p className="text-[#00a884] font-semibold mb-0.5">{msg.replyTo.sender}</p>
                    <p className="text-[#8696a0] line-clamp-2 whitespace-pre-wrap">{msg.replyTo.text}</p>
                  </div>
                )}
                <p className="whitespace-pre-wrap leading-relaxed">
                  {renderTextWithLinks(msg.text, participants)}
                </p>
                <p className="text-[#8696a0] text-[10px] text-right mt-1 -mb-0.5">
                  {msg.timestamp}
                </p>
              </div>
            </div>
          );
        }
        return items;
      })()}
    </div>
  );
}
