export interface ChatMessage {
  id: number;
  timestamp: string;
  sender: string;
  text: string;
}

// Matches lines like: [15:17, 5/22/2026] Nicholas Declan: message text
const MESSAGE_HEADER = /^\[(\d{1,2}:\d{2},\s*\d{1,2}\/\d{1,2}\/\d{4})\]\s+(.+?):\s*(.*)/;

export function parseWhatsAppChat(raw: string): { messages: ChatMessage[]; participants: string[] } {
  const lines = raw.split("\n");
  const messages: ChatMessage[] = [];
  let current: ChatMessage | null = null;
  let id = 0;

  for (const line of lines) {
    const match = line.match(MESSAGE_HEADER);
    if (match) {
      if (current) messages.push(current);
      id++;
      current = {
        id,
        timestamp: match[1].trim(),
        sender: match[2].trim(),
        text: match[3],
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

  const participants = [...new Set(messages.map((m) => m.sender))];

  return { messages, participants };
}
