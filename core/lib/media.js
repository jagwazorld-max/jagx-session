// Turns a quoted message (from contextInfo) into a full {key, message} object
// that Baileys' downloadMediaMessage() can accept.
function buildQuotedMessage(m) {
  if (!m.quoted) return null;
  const ctx = m.raw.message?.extendedTextMessage?.contextInfo;
  if (!ctx) return null;
  return {
    key: {
      remoteJid: m.from,
      id: ctx.stanzaId,
      participant: ctx.participant,
      fromMe: false,
    },
    message: m.quoted,
  };
}

// View-once messages come wrapped in viewOnceMessage / viewOnceMessageV2 /
// viewOnceMessageV2Extension. This unwraps to the real imageMessage/videoMessage.
function unwrapViewOnce(message) {
  return (
    message?.viewOnceMessage?.message ||
    message?.viewOnceMessageV2?.message ||
    message?.viewOnceMessageV2Extension?.message ||
    message
  );
}

module.exports = { buildQuotedMessage, unwrapViewOnce };
