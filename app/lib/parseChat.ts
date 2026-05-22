export interface ReplyTo {
  sender: string;
  text: string;
}

export interface ChatMessage {
  id: number;
  timestamp: string;
  sender: string;
  text: string;
  replyTo?: ReplyTo;
}

// Matches web format:    [00:46, 5/22/2026] Name: message
const WEB_FORMAT = /^\[(\d{1,2}:\d{2}(?::\d{2})?(?:\s*[AP]M)?),\s*(\d{1,2}\/\d{1,2}\/\d{2,4})\]\s+(.+?):\s*(.*)/;
// Matches mobile format: [5/22, 15:49] Name: message
const MOBILE_FORMAT = /^\[(\d{1,2}\/\d{1,2}),\s*(\d{1,2}:\d{2}(?::\d{2})?(?:\s*[AP]M)?)\]\s+(.+?):\s*(.*)/;

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
      current = {
        id,
        timestamp: `${webMatch[1]}, ${webMatch[2]}`,
        sender: webMatch[3].trim(),
        text: webMatch[4],
      };
    } else if (mobileMatch) {
      if (current) messages.push(current);
      id++;
      current = {
        id,
        timestamp: `${mobileMatch[1]}, ${mobileMatch[2]}`,
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
