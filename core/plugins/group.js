function num(jid) {
  return jid.replace(/[^0-9]/g, '');
}

async function requireGroupAdmin(sock, m) {
  if (!m.isGroup) {
    await m.reply('This command only works in groups.');
    return null;
  }
  const meta = await sock.groupMetadata(m.from);
  const participant = meta.participants.find((p) => p.id === m.sender);
  const senderIsAdmin = !!participant && (participant.admin === 'admin' || participant.admin === 'superadmin');
  const botId = sock.user.id.split(':')[0] + '@s.whatsapp.net';
  const botP = meta.participants.find((p) => num(p.id) === num(botId));
  const botIsAdmin = !!botP && (botP.admin === 'admin' || botP.admin === 'superadmin');
  if (!senderIsAdmin) {
    await m.reply('❌ Only group admins can use this command.');
    return null;
  }
  if (!botIsAdmin) {
    await m.reply('❌ I need to be an admin to do that.');
    return null;
  }
  return meta;
}

function targetJid(m) {
  if (m.mentioned[0]) return m.mentioned[0];
  const quotedParticipant = m.raw.message?.extendedTextMessage?.contextInfo?.participant;
  if (quotedParticipant) return quotedParticipant;
  return null;
}

module.exports = [
  {
    name: 'kick',
    category: 'group',
    desc: 'Remove a member from the group (admin only)',
    run: async (sock, m) => {
      const meta = await requireGroupAdmin(sock, m);
      if (!meta) return;
      const target = targetJid(m);
      if (!target) return m.reply('Tag or reply to the user you want to kick.');
      await sock.groupParticipantsUpdate(m.from, [target], 'remove');
      await m.reply('✅ Removed.');
    },
  },
  {
    name: 'add',
    category: 'group',
    desc: 'Add a member by number (admin only)',
    run: async (sock, m) => {
      const meta = await requireGroupAdmin(sock, m);
      if (!meta) return;
      const number = (m.args[0] || '').replace(/[^0-9]/g, '');
      if (!number) return m.reply('Usage: .add 234xxxxxxxxxx');
      await sock.groupParticipantsUpdate(m.from, [`${number}@s.whatsapp.net`], 'add');
      await m.reply('✅ Add request sent.');
    },
  },
  {
    name: 'promote',
    category: 'group',
    desc: 'Make a member an admin',
    run: async (sock, m) => {
      const meta = await requireGroupAdmin(sock, m);
      if (!meta) return;
      const target = targetJid(m);
      if (!target) return m.reply('Tag or reply to the user to promote.');
      await sock.groupParticipantsUpdate(m.from, [target], 'promote');
      await m.reply('✅ Promoted to admin.');
    },
  },
  {
    name: 'demote',
    category: 'group',
    desc: 'Remove admin status from a member',
    run: async (sock, m) => {
      const meta = await requireGroupAdmin(sock, m);
      if (!meta) return;
      const target = targetJid(m);
      if (!target) return m.reply('Tag or reply to the user to demote.');
      await sock.groupParticipantsUpdate(m.from, [target], 'demote');
      await m.reply('✅ Demoted.');
    },
  },
  {
    name: 'groupinfo',
    alias: ['ginfo'],
    category: 'group',
    desc: 'Show info about the current group',
    run: async (sock, m) => {
      if (!m.isGroup) return m.reply('This only works in groups.');
      const meta = await sock.groupMetadata(m.from);
      await m.reply(
        `*${meta.subject}*\n${meta.desc || '(no description)'}\n\nMembers: ${meta.participants.length}\nCreated: ${new Date(meta.creation * 1000).toDateString()}\nID: ${meta.id}`
      );
    },
  },
  {
    name: 'tagall',
    category: 'group',
    desc: 'Mention all members (admin only)',
    run: async (sock, m) => {
      const meta = await requireGroupAdmin(sock, m);
      if (!meta) return;
      const mentions = meta.participants.map((p) => p.id);
      const text = `*Attention everyone!*\n${m.text || ''}\n\n` + mentions.map((j) => `@${num(j)}`).join(' ');
      await sock.sendMessage(m.from, { text, mentions });
    },
  },
  {
    name: 'hidetag',
    category: 'group',
    desc: 'Send a message that pings everyone silently (admin only)',
    run: async (sock, m) => {
      const meta = await requireGroupAdmin(sock, m);
      if (!meta) return;
      const mentions = meta.participants.map((p) => p.id);
      await sock.sendMessage(m.from, { text: m.text || '\u200b', mentions });
    },
  },
  {
    name: 'setgname',
    category: 'group',
    desc: 'Change the group name (admin only)',
    run: async (sock, m) => {
      const meta = await requireGroupAdmin(sock, m);
      if (!meta) return;
      if (!m.text) return m.reply('Usage: .setgname New Group Name');
      await sock.groupUpdateSubject(m.from, m.text);
      await m.reply('✅ Group name updated.');
    },
  },
  {
    name: 'setgdesc',
    category: 'group',
    desc: 'Change the group description (admin only)',
    run: async (sock, m) => {
      const meta = await requireGroupAdmin(sock, m);
      if (!meta) return;
      if (!m.text) return m.reply('Usage: .setgdesc New description');
      await sock.groupUpdateDescription(m.from, m.text);
      await m.reply('✅ Description updated.');
    },
  },
  {
    name: 'revoke',
    alias: ['revokelink'],
    category: 'group',
    desc: 'Reset the group invite link (admin only)',
    run: async (sock, m) => {
      const meta = await requireGroupAdmin(sock, m);
      if (!meta) return;
      await sock.groupRevokeInvite(m.from);
      await m.reply('✅ Invite link reset.');
    },
  },
  {
    name: 'mute',
    category: 'group',
    desc: 'Only admins can send messages (admin only)',
    run: async (sock, m) => {
      const meta = await requireGroupAdmin(sock, m);
      if (!meta) return;
      await sock.groupSettingUpdate(m.from, 'announcement');
      await m.reply('🔇 Group muted — only admins can send messages.');
    },
  },
  {
    name: 'unmute',
    category: 'group',
    desc: 'Allow everyone to send messages (admin only)',
    run: async (sock, m) => {
      const meta = await requireGroupAdmin(sock, m);
      if (!meta) return;
      await sock.groupSettingUpdate(m.from, 'not_announcement');
      await m.reply('🔊 Group unmuted — everyone can send messages.');
    },
  },
  {
    name: 'antilink',
    category: 'group',
    desc: 'Toggle auto-delete of group invite links: .antilink on/off',
    run: async (sock, m, args, ctx) => {
      const meta = await requireGroupAdmin(sock, m);
      if (!meta) return;
      const mode = (m.args[0] || '').toLowerCase();
      if (!['on', 'off'].includes(mode)) return m.reply('Usage: .antilink on | .antilink off');
      const group = ctx.db.getGroup(m.from);
      group.antilink = mode === 'on';
      ctx.db.save();
      await m.reply(`✅ Antilink turned ${mode}.`);
    },
  },
  {
    name: 'welcome',
    category: 'group',
    desc: 'Toggle welcome/goodbye messages: .welcome on/off',
    run: async (sock, m, args, ctx) => {
      const meta = await requireGroupAdmin(sock, m);
      if (!meta) return;
      const mode = (m.args[0] || '').toLowerCase();
      if (!['on', 'off'].includes(mode)) return m.reply('Usage: .welcome on | .welcome off');
      const group = ctx.db.getGroup(m.from);
      group.welcome = mode === 'on';
      ctx.db.save();
      await m.reply(`✅ Welcome messages turned ${mode}.`);
    },
  },
];
