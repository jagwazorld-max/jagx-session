const axios = require('axios');

// These commands rely on free, unofficial third-party endpoints because
// YouTube/TikTok/Instagram/etc. don't provide public download APIs.
// Unofficial endpoints occasionally change or go down — if one stops
// working, swap the URL in this file for another provider.

module.exports = [
  {
    name: 'ytmp3',
    category: 'downloader',
    desc: 'Download YouTube audio: .ytmp3 <url>',
    run: async (sock, m) => {
      if (!m.text) return m.reply('Usage: .ytmp3 <youtube url>');
      try {
        const { data } = await axios.get('https://api.vevioz.com/api/button/mp3', { params: { url: m.text } });
        await m.reply('⬇️ Fetched info, but this endpoint returns an HTML widget, not a direct file.\nFor reliable YouTube downloads, install `yt-dlp` on your server and I can wire it up as a local converter — ask the bot owner to enable it.');
      } catch {
        await m.reply('Download failed. YouTube downloader APIs change often — see README for how to switch providers or use yt-dlp locally.');
      }
    },
  },
  {
    name: 'ytmp4',
    category: 'downloader',
    desc: 'Download YouTube video: .ytmp4 <url>',
    run: async (sock, m) => {
      if (!m.text) return m.reply('Usage: .ytmp4 <youtube url>');
      await m.reply('For reliable YouTube video downloads, install `yt-dlp` on the server this bot runs on (works great on VPS/Termux) — see README "Downloader setup".');
    },
  },
  {
    name: 'tiktok',
    alias: ['tt'],
    category: 'downloader',
    desc: 'Download a TikTok video without watermark: .tiktok <url>',
    run: async (sock, m) => {
      if (!m.text) return m.reply('Usage: .tiktok <tiktok url>');
      try {
        const { data } = await axios.get('https://www.tikwm.com/api/', { params: { url: m.text } });
        if (!data?.data?.play) throw new Error('no result');
        await sock.sendMessage(m.from, { video: { url: data.data.play }, caption: data.data.title || '' }, { quoted: m.raw });
      } catch {
        await m.reply('Could not fetch that TikTok video. Double check the link.');
      }
    },
  },
  {
    name: 'instagram',
    alias: ['ig'],
    category: 'downloader',
    desc: 'Download Instagram photo/video/reel: .instagram <url>',
    run: async (sock, m) => {
      if (!m.text) return m.reply('Usage: .instagram <instagram post/reel url>');
      await m.reply('Instagram downloading needs a configured scraper API (they block generic requests). See README "Downloader setup" to plug one in (e.g. RapidAPI Instagram downloader) with your own key in .env.');
    },
  },
  {
    name: 'facebook',
    alias: ['fb'],
    category: 'downloader',
    desc: 'Download a Facebook video: .facebook <url>',
    run: async (sock, m) => {
      if (!m.text) return m.reply('Usage: .facebook <video url>');
      await m.reply('Facebook downloading needs a configured scraper API. See README "Downloader setup" to plug in your provider.');
    },
  },
  {
    name: 'twitter',
    alias: ['x'],
    category: 'downloader',
    desc: 'Download a Twitter/X video: .twitter <url>',
    run: async (sock, m) => {
      if (!m.text) return m.reply('Usage: .twitter <tweet url>');
      try {
        const fx = m.text.replace('twitter.com', 'fxtwitter.com').replace('x.com', 'fxtwitter.com');
        await m.reply(`Here's a viewable version: ${fx}\n(For direct video files, configure a scraper API — see README.)`);
      } catch {
        await m.reply('Could not process that link.');
      }
    },
  },
  {
    name: 'pinterest',
    alias: ['pin'],
    category: 'downloader',
    desc: 'Search Pinterest images: .pinterest <query>',
    run: async (sock, m) => {
      if (!m.text) return m.reply('Usage: .pinterest <search term>');
      await m.reply('Pinterest search needs a configured scraper API. See README "Downloader setup" to plug in your provider.');
    },
  },
];
