const { downloadMediaMessage } = require('@whiskeysockets/baileys');
const { buildQuotedMessage, unwrapViewOnce } = require('../lib/media');

module.exports = [
  {
    name: 'antidelete',
    category: 'privacy',
    desc: 'Recover messages deleted-for-everyone in this chat: .antidelete on/off',
    run: async (sock, m, args, ctx) => {
      if (m.isGroup && !ctx.isSenderAdmin && !ctx.isOwner) return m.reply('❌ Group admins only.');
      const mode = (m.args[0] || '').toLowerCase();
      if (!['on', 'off'].includes(mode)) return m.reply('Usage: .antidelete on | .antidelete off');
      const chat = ctx.db.getChat(m.from);
      chat.antidelete = mode === 'on';
      ctx.db.save();
      await m.reply(`✅ Antidelete turned ${mode}.${mode === 'on' ? '\nWhen someone deletes a message here, I\'ll post it back automatically.' : ''}`);
    },
  },
  {
    name: 'antiviewonce',
    category: 'privacy',
    desc: 'Auto-capture view-once photos/videos in this chat: .antiviewonce on/off',
    run: async (sock, m, args, ctx) => {
      if (m.isGroup && !ctx.isSenderAdmin && !ctx.isOwner) return m.reply('❌ Group admins only.');
      const mode = (m.args[0] || '').toLowerCase();
      if (!['on', 'off'].includes(mode)) return m.reply('Usage: .antiviewonce on | .antiviewonce off');
      const chat = ctx.db.getChat(m.from);
      chat.antiviewonce = mode === 'on';
      ctx.db.save();
      await m.reply(`✅ Anti-view-once turned ${mode}.`);
    },
  },
  {
    name: 'vv',
    category: 'privacy',
    desc: 'Reply to a view-once photo/video with .vv to resend it normally',
    run: async (sock, m) => {
      if (!m.quoted) return m.reply('Reply to a view-once message with .vv');
      const inner = unwrapViewOnce(m.quoted);
      const mtype = inner.imageMessage ? 'image' : inner.videoMessage ? 'video' : null;
      if (!mtype) return m.reply('That reply is not a view-once photo or video.');
      try {
        const fakeMsg = buildQuotedMessage(m);
        fakeMsg.message = inner;
        const buffer = await downloadMediaMessage(fakeMsg, 'buffer', {});
        await sock.sendMessage(m.from, { [mtype]: buffer, caption: '🔓 Here it is.' }, { quoted: m.raw });
      } catch (e) {
        await m.reply('Could not recover that media: ' + e.message);
      }
    },
  },
  {
    name: 'save',
    category: 'privacy',
    desc: 'Reply to a photo/video/sticker with .save to have it DMed to you',
    run: async (sock, m) => {
      if (!m.quoted) return m.reply('Reply to a photo, video, or sticker with .save');
      const inner = unwrapViewOnce(m.quoted);
      const mtype = inner.imageMessage ? 'image' : inner.videoMessage ? 'video' : inner.stickerMessage ? 'sticker' : null;
      if (!mtype) return m.reply('That reply is not saveable media.');
      try {
        const fakeMsg = buildQuotedMessage(m);
        fakeMsg.message = inner;
        const buffer = await downloadMediaMessage(fakeMsg, 'buffer', {});
        await sock.sendMessage(m.sender, { [mtype]: buffer, caption: 'Saved for you.' });
        await m.reply('✅ Sent to your DM.');
      } catch (e) {
        await m.reply('Could not save that media: ' + e.message);
      }
    },
  },
];
