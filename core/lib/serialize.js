function getContentType(message) {
  if (!message) return null;
  const keys = Object.keys(message);
  return keys.find((k) => k.endsWith('Message') || k === 'conversation') || keys[0];
}

function extractText(msg) {
  if (!msg.message) return '';
  const m = msg.message;
  return (
    m.conversation ||
    m.extendedTextMessage?.text ||
    m.imageMessage?.caption ||
    m.videoMessage?.caption ||
    m.buttonsResponseMessage?.selectedButtonId ||
    m.listResponseMessage?.singleSelectReply?.selectedRowId ||
    ''
  );
}

function serialize(sock, msg, config) {
  const body = extractText(msg);
  const from = msg.key.remoteJid;
  const isGroup = from.endsWith('@g.us');
  // When the bot is linked to your own WhatsApp account (self-bot mode),
  // messages you send from your phone arrive with fromMe=true in every chat.
  // The real "sender" in that case is you (the bot's own jid), not the chat partner.
  const sender = msg.key.fromMe
    ? sock.user.id.split(':')[0] + '@s.whatsapp.net'
    : isGroup
    ? (msg.key.participant || msg.participant)
    : from;
  const prefix = config.PREFIX;
  const isCmd = body.startsWith(prefix);
  const withoutPrefix = isCmd ? body.slice(prefix.length).trim() : '';
  const [command, ...args] = withoutPrefix.split(/\s+/);

  const quoted = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
  const mentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];

  return {
    raw: msg,
    key: msg.key,
    from,
    isGroup,
    sender,
    body,
    isCmd,
    command: (command || '').toLowerCase(),
    args,
    text: args.join(' '),
    quoted,
    mentioned,
    isMedia: !!(msg.message?.imageMessage || msg.message?.videoMessage || msg.message?.stickerMessage || msg.message?.audioMessage),
    reply: (content) => sock.sendMessage(from, typeof content === 'string' ? { text: content } : content, { quoted: msg }),
  };
}

module.exports = { serialize, getContentType, extractText };
