function targetJid(m) {
  if (m.mentioned[0]) return m.mentioned[0];
  const quotedParticipant = m.raw.message?.extendedTextMessage?.contextInfo?.participant;
  if (quotedParticipant) return quotedParticipant;
  return null;
}

module.exports = [
  {
    name: 'warn',
    category: 'moderation',
    desc: 'Warn a member (admin only, group)',
    run: async (sock, m, args, ctx) => {
      if (!m.isGroup) return m.reply('Group only.');
      if (!ctx.isSenderAdmin) return m.reply('❌ Admins only.');
      const target = targetJid(m);
      if (!target) return m.reply('Tag or reply to the user to warn.');
      const group = ctx.db.getGroup(m.from);
      group.warns[target] = (group.warns[target] || 0) + 1;
      ctx.db.save();
      await m.reply(`⚠️ Warned. Total warnings: ${group.warns[target]}/3`);
      if (group.warns[target] >= 3) {
        await sock.groupParticipantsUpdate(m.from, [target], 'remove').catch(() => {});
        group.warns[target] = 0;
        ctx.db.save();
        await m.reply('🚫 User reached 3 warnings and was removed.');
      }
    },
  },
  {
    name: 'delwarn',
    category: 'moderation',
    desc: 'Clear warnings for a member (admin only, group)',
    run: async (sock, m, args, ctx) => {
      if (!m.isGroup) return m.reply('Group only.');
      if (!ctx.isSenderAdmin) return m.reply('❌ Admins only.');
      const target = targetJid(m);
      if (!target) return m.reply('Tag or reply to the user.');
      const group = ctx.db.getGroup(m.from);
      group.warns[target] = 0;
      ctx.db.save();
      await m.reply('✅ Warnings cleared.');
    },
  },
  {
    name: 'warnings',
    category: 'moderation',
    desc: 'Check warning count for a member',
    run: async (sock, m, args, ctx) => {
      if (!m.isGroup) return m.reply('Group only.');
      const target = targetJid(m) || m.sender;
      const group = ctx.db.getGroup(m.from);
      await m.reply(`Warnings: ${group.warns[target] || 0}/3`);
    },
  },
  {
    name: 'banuser',
    alias: ['ban'],
    category: 'moderation',
    desc: 'Block a user from using the bot (owner only)',
    run: async (sock, m, args, ctx) => {
      if (!ctx.isOwner) return m.reply('❌ Owner only.');
      const target = targetJid(m);
      if (!target) return m.reply('Tag or reply to the user.');
      const user = ctx.db.getUser(target);
      user.banned = true;
      ctx.db.save();
      await m.reply('🚫 User banned from using the bot.');
    },
  },
  {
    name: 'unbanuser',
    alias: ['unban'],
    category: 'moderation',
    desc: 'Unblock a user (owner only)',
    run: async (sock, m, args, ctx) => {
      if (!ctx.isOwner) return m.reply('❌ Owner only.');
      const target = targetJid(m);
      if (!target) return m.reply('Tag or reply to the user.');
      const user = ctx.db.getUser(target);
      user.banned = false;
      ctx.db.save();
      await m.reply('✅ User unbanned.');
    },
  },
];
