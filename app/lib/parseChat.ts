export interface ReplyTo {
  sender: string;
  text: string;
}

export interface ChatMessage {
  id: number;
  timestamp: string; // time only, e.g. "15:49"
  date: string;      // ISO date string, e.g. "2026-05-22"
  sender: string;
  text: string;
  replyTo?: ReplyTo;
}

// Matches web format:    [00:46, 5/22/2026] Name: message
const WEB_FORMAT = /^\[(\d{1,2}:\d{2}(?::\d{2})?(?:\s*[AP]M)?),\s*(\d{1,2}\/\d{1,2}\/\d{2,4})\]\s+(.+?):\s*(.*)/;
// Matches mobile format: [5/22, 15:49] Name: message
const MOBILE_FORMAT = /^\[(\d{1,2}\/\d{1,2}),\s*(\d{1,2}:\d{2}(?::\d{2})?(?:\s*[AP]M)?)\]\s+(.+?):\s*(.*)/;

/** Normalise time string to HH:MM (24h), stripping seconds and AM/PM. */
function normalizeTime(raw: string): string {
  const trimmed = raw.trim();
  // Handle 12h format e.g. "8:05 AM" / "11:49 PM"
  const ampm = trimmed.match(/^(\d{1,2}):(\d{2})(?::\d{2})?\s*(AM|PM)$/i);
  if (ampm) {
    let h = parseInt(ampm[1], 10);
    const m = ampm[2];
    const meridiem = ampm[3].toUpperCase();
    if (meridiem === "AM" && h === 12) h = 0;
    if (meridiem === "PM" && h !== 12) h += 12;
    return `${String(h).padStart(2, "0")}:${m}`;
  }
  // 24h – just strip seconds
  const h24 = trimmed.match(/^(\d{1,2}:\d{2})(?::\d{2})?$/);
  if (h24) return h24[1];
  return trimmed;
}

/** Return ISO date string "YYYY-MM-DD". */
function parseDate(raw: string, format: "web" | "mobile"): string {
  const parts = raw.trim().split("/");
  const currentYear = new Date().getFullYear();
  if (format === "web") {
    // M/D/YYYY or M/D/YY
    const month = parseInt(parts[0], 10);
    const day = parseInt(parts[1], 10);
    let year = parseInt(parts[2], 10);
    if (year < 100) year += 2000;
    return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  } else {
    // M/D (no year)
    const month = parseInt(parts[0], 10);
    const day = parseInt(parts[1], 10);
    return `${currentYear}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  }
}

export function parseWhatsAppChat(raw: string): { messages: ChatMessage[]; participants: string[] } {
  const lines = raw.split("\n");
  const messages: ChatMessage[] = [];
  let current: ChatMessage | null = null;
  let id = 0;

  for (const line of lines) {
    const webMatch = line.match(WEB_FORMAT);
    const mobileMatch = line.match(MOBILE_FORMAT);

    if (webMatch) {
      if (current) messages.push(current);
      id++;
      // webMatch[1] = time, webMatch[2] = date like "5/22/2026"
      const parsedDate = parseDate(webMatch[2], "web");
      current = {
        id,
        timestamp: normalizeTime(webMatch[1]),
        date: parsedDate,
        sender: webMatch[3].trim(),
        text: webMatch[4],
      };
    } else if (mobileMatch) {
      if (current) messages.push(current);
      id++;
      // mobileMatch[1] = date like "5/22", mobileMatch[2] = time
      const parsedDate = parseDate(mobileMatch[1], "mobile");
      current = {
        id,
        timestamp: normalizeTime(mobileMatch[2]),
        date: parsedDate,
        sender: mobileMatch[3].trim(),
        text: mobileMatch[4],
      };
    } else if (current) {
      // Continuation line (multi-line message)
      current.text += "\n" + line;
    }
  }

  if (current) messages.push(current);

  // Trim trailing whitespace from each message
  for (const msg of messages) {
    msg.text = msg.text.trim();
  }

  // Detect replies: if the first line of a message matches a previous message's text,
  // treat it as a quoted reply.
  const textToMessage = new Map<string, ChatMessage>();
  for (const msg of messages) {
    textToMessage.set(msg.text, msg);
  }

  for (const msg of messages) {
    const newlineIndex = msg.text.indexOf("\n");
    const firstLine = newlineIndex !== -1 ? msg.text.slice(0, newlineIndex).trim() : null;
    if (firstLine) {
      const quoted = textToMessage.get(firstLine);
      if (quoted && quoted.id !== msg.id) {
        msg.replyTo = { sender: quoted.sender, text: quoted.text };
        msg.text = msg.text.slice(newlineIndex + 1).trim();
      }
    }
  }

  const participants = [...new Set(messages.map((m) => m.sender))];

  return { messages, participants };
}
