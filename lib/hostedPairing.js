const {
  default: makeWASocket,
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
  DisconnectReason,
  delay,
} = require('@whiskeysockets/baileys');
const { Boom } = require('@hapi/boom');
const pino = require('pino');
const fs = require('fs');
const path = require('path');
const QRCode = require('qrcode');

const { attachBot, OWNER_IMAGE_PATH } = require('./attachBot');
const botManager = require('./botManager');

const SESSIONS_ROOT = path.join(__dirname, '..', 'sessions');
fs.mkdirSync(SESSIONS_ROOT, { recursive: true });

function tempDirFor(id) {
  return path.join(SESSIONS_ROOT, `_pending-${id}`);
}
function permanentDirFor(ownerNumber) {
  return path.join(SESSIONS_ROOT, ownerNumber);
}

async function announceConnected(sock) {
  const caption = "✅ *JagX connected successfully!*\n\nYour bot is now running on the server — you don't need to keep any app open. Type .menu on WhatsApp to see everything I can do.";
  try {
    if (fs.existsSync(OWNER_IMAGE_PATH)) {
      await sock.sendMessage(sock.user.id, { image: fs.readFileSync(OWNER_IMAGE_PATH), caption });
    } else {
      await sock.sendMessage(sock.user.id, { text: caption });
    }
  } catch {
    // non-fatal
  }
}

// Runs a brand-new pairing flow (QR or pairing code). Once it succeeds, the
// bot keeps running on this server indefinitely — the caller's HTTP request
// only needs this promise to resolve, the live connection persists
// independently of that request afterward.
function startNewConnection({ phone, mode = 'qr' }, onEvent, timeoutMs = 100000) {
  return new Promise(async (resolve) => {
    const pendingId = Date.now() + '-' + Math.random().toString(36).slice(2);
    let settled = false;
    let attached = false;

    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      onEvent({ type: 'error', message: 'Timed out waiting to connect. Please refresh and try again.' });
      resolve();
    }, timeoutMs);

    async function connectOnce(currentDir) {
      // Defensive: guarantee the directory exists right before Baileys
      // writes into it, even on a reconnect using a directory we created
      // moments earlier. Costs nothing, guards against any race.
      fs.mkdirSync(currentDir, { recursive: true });

      let state, saveCreds;
      try {
        ({ state, saveCreds } = await useMultiFileAuthState(currentDir));
      } catch (e) {
        // One retry after a short delay — covers any transient filesystem
        // hiccup on the very first write (seen occasionally on some hosts).
        console.error('[HOSTED] auth state init failed, retrying once:', e.message);
        await delay(1000);
        fs.mkdirSync(currentDir, { recursive: true });
        ({ state, saveCreds } = await useMultiFileAuthState(currentDir));
      }

      const { version } = await fetchLatestBaileysVersion();
      const sock = makeWASocket({
        version,
        logger: pino({ level: 'silent' }),
        printQRInTerminal: false,
        auth: state,
        browser: ['JagX', 'Chrome', '1.0.0'],
      });

      sock.ev.on('creds.update', saveCreds);
      let migrating = false;
      let refreshTimer = null;
      function stopCodeRefresh() {
        if (refreshTimer) {
          clearInterval(refreshTimer);
          refreshTimer = null;
        }
      }

      sock.ev.on('connection.update', async (update) => {
        if (update.qr && mode === 'qr' && !settled) {
          try {
            const dataUrl = await QRCode.toDataURL(update.qr, { width: 320, margin: 1 });
            onEvent({ type: 'qr', dataUrl });
          } catch (e) {
            onEvent({ type: 'error', message: 'Could not render QR: ' + e.message });
          }
        }

        if (update.connection === 'open') {
          const ownerNumber = (sock.user.id.split(':')[0] || '').replace(/[^0-9]/g, '');
          const permDir = permanentDirFor(ownerNumber);

          if (currentDir !== permDir) {
            // This socket's saveCreds is bound to the temp directory. Rather
            // than deleting that directory out from under a still-live
            // credential-save closure (the actual cause of the ENOENT bug),
            // copy the files over, cleanly end this socket, and reconnect
            // fresh — bound directly to the permanent directory this time.
            migrating = true;
            stopCodeRefresh();
            try {
              fs.mkdirSync(permDir, { recursive: true });
              for (const f of fs.readdirSync(currentDir)) {
                fs.copyFileSync(path.join(currentDir, f), path.join(permDir, f));
              }
            } catch (e) {
              console.error('[HOSTED] could not migrate session dir:', e.message);
            }
            try {
              sock.end();
            } catch {
              // ignore
            }
            try {
              fs.rmSync(currentDir, { recursive: true, force: true });
            } catch {
              // ignore
            }
            setTimeout(() => connectOnce(permDir).catch((e) => console.error('[HOSTED] post-migration reconnect failed:', e)), 500);
            return;
          }

          // Already running from the permanent directory — this is the real, lasting connection.
          if (!attached) {
            attached = true;
            botManager.register(ownerNumber, sock, permDir);
            attachBot(sock, ownerNumber);
            await announceConnected(sock);

            if (!settled) {
              settled = true;
              clearTimeout(timer);
              onEvent({ type: 'connected', ownerNumber });
              resolve();
            }
          }
          return;
        }

        if (update.connection === 'close') {
          if (migrating) return; // this close was expected — we triggered it ourselves above
          stopCodeRefresh();

          const statusCode = update.lastDisconnect?.error instanceof Boom ? update.lastDisconnect.error.output?.statusCode : undefined;
          const loggedOut = statusCode === DisconnectReason.loggedOut;

          if (loggedOut) {
            if (attached) {
              const entry = [...botManager.activeBots.entries()].find(([, v]) => v.sock === sock);
              if (entry) botManager.unregister(entry[0]);
            } else if (!settled) {
              settled = true;
              clearTimeout(timer);
              onEvent({ type: 'error', message: 'Logged out during setup. Please refresh and try again.' });
              resolve();
            }
            return;
          }

          // Recoverable close — reconnect indefinitely using the same
          // directory (permanent if we've already attached, temp otherwise).
          const dirToUse = attached
            ? permanentDirFor((sock.user?.id || '').split(':')[0].replace(/[^0-9]/g, ''))
            : currentDir;
          setTimeout(() => connectOnce(dirToUse).catch((e) => console.error('[HOSTED] reconnect failed:', e)), 3000);
        }
      });

      if (mode === 'pairing' && !sock.authState.creds.registered) {
        await delay(2000);
        const CODE_LIFETIME_S = 55; // WhatsApp's own codes expire around 60s — refresh just under that

        const requestFreshCode = async () => {
          if (settled || attached || migrating) return;
          try {
            const code = await sock.requestPairingCode(phone);
            onEvent({ type: 'code', code, validForSeconds: CODE_LIFETIME_S });
          } catch (e) {
            stopCodeRefresh();
            if (!settled) {
              settled = true;
              clearTimeout(timer);
              onEvent({ type: 'error', message: e.message || 'Could not request a pairing code.' });
              resolve();
            }
          }
        };

        await requestFreshCode();
        refreshTimer = setInterval(requestFreshCode, CODE_LIFETIME_S * 1000);
      }
    }

    try {
      const dir = tempDirFor(pendingId);
      fs.mkdirSync(dir, { recursive: true });
      await connectOnce(dir);
    } catch (e) {
      if (!settled) {
        settled = true;
        clearTimeout(timer);
        onEvent({ type: 'error', message: e.message || 'Something went wrong starting the connection.' });
        resolve();
      }
    }
  });
}

// On server boot, resume any previously-connected accounts whose session
// files still exist on disk. Only useful if the disk actually persists
// across restarts (a paid Render disk, a VPS, etc.) — see README.
async function resumeAll() {
  if (!fs.existsSync(SESSIONS_ROOT)) return;
  const entries = fs.readdirSync(SESSIONS_ROOT).filter((f) => !f.startsWith('_pending-'));
  for (const ownerNumber of entries) {
    const dir = permanentDirFor(ownerNumber);
    if (!fs.existsSync(path.join(dir, 'creds.json'))) continue;
    console.log(`[HOSTED] resuming ${ownerNumber}...`);
    resumeOne(dir, ownerNumber).catch((e) => console.error(`[HOSTED] resume failed for ${ownerNumber}:`, e.message));
  }
}

async function resumeOne(dir, expectedOwnerNumber) {
  async function connectOnce(currentDir) {
    fs.mkdirSync(currentDir, { recursive: true });
    const { state, saveCreds } = await useMultiFileAuthState(currentDir);
    const { version } = await fetchLatestBaileysVersion();
    const sock = makeWASocket({
      version,
      logger: pino({ level: 'silent' }),
      printQRInTerminal: false,
      auth: state,
      browser: ['JagX', 'Chrome', '1.0.0'],
    });
    sock.ev.on('creds.update', saveCreds);
    let attached = false;

    sock.ev.on('connection.update', (update) => {
      if (update.connection === 'open' && !attached) {
        attached = true;
        const ownerNumber = (sock.user.id.split(':')[0] || '').replace(/[^0-9]/g, '');
        botManager.register(ownerNumber, sock, currentDir);
        attachBot(sock, ownerNumber);
        console.log(`[HOSTED] ✅ resumed ${ownerNumber}`);
      }
      if (update.connection === 'close') {
        const statusCode = update.lastDisconnect?.error instanceof Boom ? update.lastDisconnect.error.output?.statusCode : undefined;
        const loggedOut = statusCode === DisconnectReason.loggedOut;
        if (loggedOut) {
          botManager.unregister(expectedOwnerNumber);
          console.log(`[HOSTED] ${expectedOwnerNumber} logged out, won't retry.`);
          return;
        }
        setTimeout(() => connectOnce(currentDir).catch((e) => console.error('[HOSTED] resume reconnect failed:', e)), 3000);
      }
    });
  }
  await connectOnce(dir);
}

module.exports = { startNewConnection, resumeAll };
