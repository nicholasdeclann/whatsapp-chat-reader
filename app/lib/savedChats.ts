import { ChatMessage } from "./parseChat";

export interface SavedChat {
  id: string;           // uuid-ish
  name: string;         // derived from file name or "Pasted chat"
  participants: string[];
  perspective: string;
  messages: ChatMessage[];
  savedAt: string;      // ISO timestamp
  lastMessage?: string; // preview text
  lastDate?: string;    // ISO date of last message
}

const STORAGE_KEY = "wacr_saved_chats";

export function loadSavedChats(): SavedChat[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as SavedChat[];
  } catch {
    return [];
  }
}

export function saveChat(chat: SavedChat): void {
  const chats = loadSavedChats();
  const idx = chats.findIndex((c) => c.id === chat.id);
  if (idx !== -1) {
    chats[idx] = chat;
  } else {
    chats.unshift(chat);
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(chats));
}

export function deleteChat(id: string): void {
  const chats = loadSavedChats().filter((c) => c.id !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(chats));
}

export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}
