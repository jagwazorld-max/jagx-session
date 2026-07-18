const { downloadMediaMessage } = require('@whiskeysockets/baileys');
const path = require('path');
const fs = require('fs');

const db = require('../core/lib/database');
const { serialize, extractText } = require('../core/lib/serialize');
const { loadPlugins } = require('../core/lib/loadPlugins');
const messageStore = require('../core/lib/messageStore');
const { unwrapViewOnce } = require('../core/lib/media');

const OWNER_IMAGE_PATH = path.join(__dirname, '..', 'core', 'assets', 'owner.jpg');
const BAD_WORDS = ['fuck', 'bitch', 'asshole', 'nigger', 'cunt'];
const spamTracker = new Map(); // "chatJid:senderJid" -> recent message timestamps

const loadedCommands = loadPlugins();

function baseConfig(ownerNumber) {
  return {
    BOT_NAME: 'JagX',
    PREFIX: '.',
    OWNER_NUMBER: ownerNumber,
    PUBLIC_MODE: true,
    AUTO_READ: false,
    DAILY_AMOUNT: 500,
    WORK_MIN: 100,
    WORK_MAX: 400,
    OWNER_IMAGE: 'assets/owner.jpg',
    OPENWEATHER_KEY: process.env.OPENWEATHER_KEY || '',
    ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY || '',
  };
}

function isOwnerNumber(jid, cfgOwner) {
  const digits = (jid || '').replace(/[^0-9]/g, '');
  return digits === (cfgOwner || '').replace(/[^0-9]/g, '');
}

// Call this once, right after a socket reaches connection.update === 'open'
// for the first time. It wires up every event the bot needs — from then on,
// the socket behaves exactly like the standalone jagx-bot.
function attachBot(sock, ownerNumber) {
  const config = baseConfig(ownerNumber);

  async function handleDeletedMessage(raw, protocolMsg) {
    try {
      const chatJid = raw.key.remoteJid;
      const chat = db.getChat(chatJid);
      if (!chat.antidelete) return;

      const originalKey = protocolMsg.key;
      const cached = messageStore.get(originalKey?.id);
      if (!cached) return;

      const originalSender = cached.key.participant || cached.key.remoteJid;
      const header = `🗑️ *Deleted message recovered*\nFrom: @${(originalSender || '').split('@')[0]}\n\n`;
      const mediaContainer = unwrapViewOnce(cached.message);

      if (mediaContainer.imageMessage || mediaContainer.videoMessage || mediaContainer.stickerMessage || mediaContainer.audioMessage || mediaContainer.documentMessage) {
        const buffer = await downloadMediaMessage({ key: cached.key, message: mediaContainer }, 'buffer', {});
        const mtype = mediaContainer.imageMessage ? 'image' : mediaContainer.videoMessage ? 'video' : mediaContainer.stickerMessage ? 'sticker' : mediaContainer.audioMessage ? 'audio' : 'document';
        const content = { [mtype]: buffer };
        if (mtype === 'audio') content.mimetype = 'audio/mpeg';
        else content.caption = header + (extractText(cached) || '');
        await sock.sendMessage(chatJid, content, { mentions: [originalSender] });
      } else {
        await sock.sendMessage(chatJid, { text: header + (extractText(cached) || '(empty message)'), mentions: [originalSender] });
      }
    } catch (e) {
      console.error(`[${ownerNumber}] [ANTIDELETE] failed:`, e.message);
    }
  }

  async function handleViewOnce(raw, m) {
    try {
      const chat = db.getChat(m.from);
      if (!chat.antiviewonce) return;

      let inner = null;
      const msg = raw.message;
      if (msg.viewOnceMessage || msg.viewOnceMessageV2 || msg.viewOnceMessageV2Extension) {
        inner = unwrapViewOnce(msg);
      } else if (msg.imageMessage?.viewOnce) {
        inner = { imageMessage: msg.imageMessage };
      } else if (msg.videoMessage?.viewOnce) {
        inner = { videoMessage: msg.videoMessage };
      }
      if (!inner) return;

      const mtype = inner.imageMessage ? 'image' : 'video';
      const buffer = await downloadMediaMessage({ key: raw.key, message: inner }, 'buffer', {});
      await sock.sendMessage(m.from, { [mtype]: buffer, caption: `🔓 View-once media captured from @${m.sender.split('@')[0]}`, mentions: [m.sender] });
    } catch (e) {
      console.error(`[${ownerNumber}] [ANTIVIEWONCE] failed:`, e.message);
    }
  }

  // ---- Anticall ----
  sock.ev.on('call', async (calls) => {
    if (!db.data.settings.anticall) return;
    for (const call of calls) {
      if (call.status !== 'offer') continue;
      try {
        await sock.rejectCall(call.id, call.from);
        await sock.updateBlockStatus(call.from, 'block');
      } catch (e) {
        console.error(`[${ownerNumber}] [ANTICALL] failed:`, e.message);
      }
    }
  });

  // ---- Welcome / goodbye ----
  sock.ev.on('group-participants.update', async (evt) => {
    try {
      const group = db.getGroup(evt.id);
      if (!group.welcome) return;
      const meta = await sock.groupMetadata(evt.id);
      for (const participant of evt.participants) {
        const name = `@${participant.split('@')[0]}`;
        if (evt.action === 'add') {
          const template = group.welcomeText || '👋 Welcome {user} to *{group}*!';
          const text = template.replace(/{user}/g, name).replace(/{group}/g, meta.subject);
          await sock.sendMessage(evt.id, { text, mentions: [participant] });
        } else if (evt.action === 'remove') {
          const template = group.goodbyeText || '👋 {user} left {group}.';
          const text = template.replace(/{user}/g, name).replace(/{group}/g, meta.subject);
          await sock.sendMessage(evt.id, { text, mentions: [participant] });
        }
      }
    } catch (e) {
      console.error(`[${ownerNumber}] [GROUP EVENT] error:`, e.message);
    }
  });

  // ---- Message handling ----
  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    if (type !== 'notify') return;
    for (const raw of messages) {
      try {
        if (!raw.message) continue;

        const protocolMsg = raw.message.protocolMessage;
        if (protocolMsg && (protocolMsg.type === 0 || protocolMsg.type === 'REVOKE')) {
          await handleDeletedMessage(raw, protocolMsg);
          continue;
        }

        const m = serialize(sock, raw, config);

        if (!raw.key.fromMe) {
          messageStore.set(raw.key.id, raw);
          await handleViewOnce(raw, m);
        }

        if (config.AUTO_READ) {
          sock.readMessages([raw.key]).catch(() => {});
        }

        if (m.isGroup && !raw.key.fromMe) {
          const group = db.getGroup(m.from);
          if (group.antilink && /chat\.whatsapp\.com\/[A-Za-z0-9]+/.test(m.body)) {
            const meta = await sock.groupMetadata(m.from);
            const participant = meta.participants.find((p) => p.id === m.sender);
            const senderIsAdmin = participant && (participant.admin === 'admin' || participant.admin === 'superadmin');
            if (!senderIsAdmin) {
              await sock.sendMessage(m.from, { delete: m.key }).catch(() => {});
              await m.reply('🔗 Group links are not allowed here.').catch(() => {});
              continue;
            }
          }
          if (group.antibadword && m.body && BAD_WORDS.some((w) => m.body.toLowerCase().includes(w))) {
            const meta = await sock.groupMetadata(m.from);
            const participant = meta.participants.find((p) => p.id === m.sender);
            const senderIsAdmin = participant && (participant.admin === 'admin' || participant.admin === 'superadmin');
            if (!senderIsAdmin) {
              await sock.sendMessage(m.from, { delete: m.key }).catch(() => {});
              await m.reply('🤬 Watch your language.').catch(() => {});
              continue;
            }
          }
          if (group.antispam) {
            const key = `${m.from}:${m.sender}`;
            const now = Date.now();
            const times = (spamTracker.get(key) || []).filter((t) => now - t < 10000);
            times.push(now);
            spamTracker.set(key, times);
            if (times.length > 5) {
              await sock.sendMessage(m.from, { delete: m.key }).catch(() => {});
              continue;
            }
          }
        }

        if (!m.isCmd && m.body) {
          const replies = db.data.settings.autoreplies || {};
          const hit = Object.keys(replies).find((k) => m.body.toLowerCase().includes(k));
          if (hit) {
            await sock.sendMessage(m.from, { text: replies[hit] }, { quoted: m.raw }).catch(() => {});
          }
        }

        if (!m.isCmd || !m.command) continue;

        const cmd = loadedCommands.get(m.command);
        if (!cmd) continue;

        const user = db.getUser(m.sender);
        if (user.banned) {
          await m.reply('🚫 You are banned from using this bot.');
          continue;
        }

        const isOwner = isOwnerNumber(m.sender, config.OWNER_NUMBER);
        if (!config.PUBLIC_MODE && !isOwner) {
          await m.reply('🔒 This bot is currently in owner-only mode.');
          continue;
        }

        let isSenderAdmin = false;
        if (m.isGroup) {
          const meta = await sock.groupMetadata(m.from).catch(() => null);
          if (meta) {
            const participant = meta.participants.find((p) => p.id === m.sender);
            isSenderAdmin = !!participant && (participant.admin === 'admin' || participant.admin === 'superadmin');
          }
        }

        const ctx = { config, db, isOwner, isSenderAdmin, ownerImagePath: OWNER_IMAGE_PATH };

        try {
          await cmd.run(sock, m, m.args, ctx);
        } catch (e) {
          console.error(`[${ownerNumber}] [CMD:${cmd.name}] error:`, e);
          await m.reply(`⚠️ Something went wrong running that command: ${e.message}`).catch(() => {});
        }
      } catch (outerErr) {
        console.error(`[${ownerNumber}] [MESSAGE HANDLER] error:`, outerErr);
      }
    }
  });
}

module.exports = { attachBot, OWNER_IMAGE_PATH };
