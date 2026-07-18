const axios = require('axios');
const QRCode = require('qrcode');
const { downloadMediaMessage } = require('@whiskeysockets/baileys');

async function getQuotedOrDirectMedia(sock, m) {
  const msg = m.quoted
    ? { key: { ...m.key, id: m.raw.message.extendedTextMessage.contextInfo.stanzaId, participant: m.raw.message.extendedTextMessage.contextInfo.participant }, message: m.quoted }
    : m.raw;
  if (!msg.message?.imageMessage && !msg.message?.videoMessage && !msg.message?.stickerMessage) return null;
  return downloadMediaMessage(msg, 'buffer', {});
}

module.exports = [
  {
    name: 'sticker',
    alias: ['s'],
    category: 'tools',
    desc: 'Convert a replied/sent image or short video into a sticker',
    run: async (sock, m) => {
      let sharp, webpmux;
      try {
        sharp = require('sharp');
      } catch {
        return m.reply('Sticker conversion needs the optional "sharp" package. Run: npm install sharp');
      }
      const buffer = await getQuotedOrDirectMedia(sock, m);
      if (!buffer) return m.reply('Reply to an image (or send one with .sticker as caption).');
      try {
        const webp = await sharp(buffer).resize(512, 512, { fit: 'inside' }).webp().toBuffer();
        await sock.sendMessage(m.from, { sticker: webp }, { quoted: m.raw });
      } catch (e) {
        await m.reply('Could not convert that to a sticker: ' + e.message);
      }
    },
  },
  {
    name: 'toimg',
    category: 'tools',
    desc: 'Convert a sticker back into an image',
    run: async (sock, m) => {
      const buffer = await getQuotedOrDirectMedia(sock, m);
      if (!buffer) return m.reply('Reply to a sticker with .toimg');
      await sock.sendMessage(m.from, { image: buffer }, { quoted: m.raw });
    },
  },
  {
    name: 'take',
    category: 'tools',
    desc: 'Re-brand a sticker: .take <new pack name>',
    run: async (sock, m) => {
      let sharp;
      try {
        sharp = require('sharp');
      } catch {
        return m.reply('This needs the optional "sharp" package. Run: npm install sharp');
      }
      const buffer = await getQuotedOrDirectMedia(sock, m);
      if (!buffer) return m.reply('Reply to a sticker with .take <pack name>');
      const webp = await sharp(buffer).webp().toBuffer();
      await sock.sendMessage(m.from, { sticker: webp }, { quoted: m.raw });
    },
  },
  {
    name: 'qrcode',
    alias: ['qr'],
    category: 'tools',
    desc: 'Generate a QR code from text: .qrcode <text>',
    run: async (sock, m) => {
      if (!m.text) return m.reply('Usage: .qrcode <text or link>');
      const buffer = await QRCode.toBuffer(m.text, { width: 512 });
      await sock.sendMessage(m.from, { image: buffer, caption: 'Here you go.' }, { quoted: m.raw });
    },
  },
  {
    name: 'shortlink',
    alias: ['short'],
    category: 'tools',
    desc: 'Shorten a URL: .shortlink <url>',
    run: async (sock, m) => {
      if (!m.text) return m.reply('Usage: .shortlink <url>');
      try {
        const { data } = await axios.get(`https://tinyurl.com/api-create.php?url=${encodeURIComponent(m.text)}`);
        await m.reply(data);
      } catch {
        await m.reply('Could not shorten that link right now.');
      }
    },
  },
  {
    name: 'translate',
    alias: ['tr'],
    category: 'tools',
    desc: 'Translate text: .translate <lang-code> <text>',
    run: async (sock, m) => {
      const [lang, ...rest] = m.args;
      const text = rest.join(' ');
      if (!lang || !text) return m.reply('Usage: .translate en Bonjour tout le monde');
      try {
        const { data } = await axios.get('https://translate.googleapis.com/translate_a/single', {
          params: { client: 'gtx', sl: 'auto', tl: lang, dt: 't', q: text },
        });
        const out = data[0].map((chunk) => chunk[0]).join('');
        await m.reply(out);
      } catch {
        await m.reply('Translation failed, try again later.');
      }
    },
  },
  {
    name: 'tts',
    category: 'tools',
    desc: 'Text to speech: .tts <text>',
    run: async (sock, m) => {
      if (!m.text) return m.reply('Usage: .tts Hello there');
      const url = `https://translate.google.com/translate_tts?ie=UTF-8&client=tw-ob&tl=en&q=${encodeURIComponent(m.text)}`;
      try {
        const { data } = await axios.get(url, { responseType: 'arraybuffer', headers: { 'User-Agent': 'Mozilla/5.0' } });
        await sock.sendMessage(m.from, { audio: Buffer.from(data), mimetype: 'audio/mpeg', ptt: true }, { quoted: m.raw });
      } catch {
        await m.reply('TTS failed right now, try shorter text.');
      }
    },
  },
  {
    name: 'calculate',
    alias: ['calc'],
    category: 'tools',
    desc: 'Evaluate a math expression: .calc 12*(4+2)',
    run: async (sock, m) => {
      const expr = m.text;
      if (!expr) return m.reply('Usage: .calc 2+2*10');
      if (!/^[0-9+\-*/().\s%^]+$/.test(expr)) return m.reply('Only numbers and + - * / ( ) % are allowed.');
      try {
        // eslint-disable-next-line no-new-func
        const result = Function(`"use strict"; return (${expr.replace(/\^/g, '**')})`)();
        await m.reply(`= ${result}`);
      } catch {
        await m.reply('Invalid expression.');
      }
    },
  },
  {
    name: 'currency',
    alias: ['conv'],
    category: 'tools',
    desc: 'Convert currency: .currency 100 USD NGN',
    run: async (sock, m) => {
      const [amount, from, to] = m.args;
      if (!amount || !from || !to) return m.reply('Usage: .currency 100 USD NGN');
      try {
        const { data } = await axios.get(`https://api.exchangerate.host/convert`, {
          params: { from: from.toUpperCase(), to: to.toUpperCase(), amount },
        });
        await m.reply(`${amount} ${from.toUpperCase()} = ${data.result?.toFixed(2)} ${to.toUpperCase()}`);
      } catch {
        await m.reply('Conversion failed, check the currency codes and try again.');
      }
    },
  },
];
