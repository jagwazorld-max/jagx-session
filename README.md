```
     ██╗ █████╗  ██████╗ ██╗  ██╗
     ██║██╔══██╗██╔════╝ ╚██╗██╔╝    hosted
     ██║███████║██║  ███╗ ╚███╔╝     bot
██   ██║██╔══██║██║   ██║ ██╔██╗
╚█████╔╝██║  ██║╚██████╔╝██╔╝ ██╗
 ╚════╝ ╚═╝  ╚═╝ ╚═════╝ ╚═╝  ╚═╝
```

<div align="center">

**Scan once. The bot runs on the server, forever — no phone, no Termux, no app to keep open.**

Built by **JRI** · [License](#-license)

</div>

---

## 📖 Contents

1. [What changed, and why](#-what-changed-and-why)
2. [⚠️ Security — please read this one](#️-security--please-read-this-one)
3. [How it works](#-how-it-works)
4. [Deploy to Render.com](#-deploy-to-rendercom)
5. [Keeping it running for real — the persistence caveat](#-keeping-it-running-for-real--the-persistence-caveat)
6. [Using the site](#-using-the-site)
7. [Managing connected accounts](#-managing-connected-accounts)
8. [Pushing updates from Termux / Command Prompt / Terminal](#-pushing-updates-from-termux--command-prompt--terminal)
9. [Local testing](#-local-testing)
10. [Files](#-files)
11. [License](#-license)

---

## 🔄 What changed, and why

The original design generated a portable session string you'd paste into a bot running on *your own* device (Termux, a VPS, wherever). That kept failing in practice because Termux gets killed in the background by Android, closing the app stops the bot, and every reconnect meant babysitting a terminal.

**This version fixes that by moving the whole bot onto this server.** You scan a QR (or use a pairing code) right here on the site, and from that moment the full JagX bot — all 115+ commands — runs directly on whatever machine this project is deployed to. Nothing on your phone needs to stay open. Ever.

---

## ⚠️ Security — please read this one

This is a bigger deal than the old design, so it's worth being direct about it:

**Whoever controls the server this is deployed on now has live access to every WhatsApp account that connects through it.** Previously the session string left the server immediately and you controlled where it lived. Now the server *is* where it lives, permanently, for as long as that account stays connected.

- **For your own numbers, on a deployment only you control:** this is fine — functionally identical to running the bot yourself, just on a server instead of your phone.
- **If you ever share this site's URL with other people:** you are asking them to hand your server the same level of access as their WhatsApp password. Only do that with people who'd trust you with that regardless (the same way you'd trust someone with a shared email account), and ideally say so explicitly rather than letting people assume it's just "a QR code generator."
- **Keep the deployment private** (don't publish the URL somewhere public) unless you've deliberately decided to run this as a multi-user service and have thought through what that means for you as the operator.

---

## 🔗 How it works

1. Open the site, tap **Generate QR code** (or use the pairing-code tab).
2. Scan it: WhatsApp → Settings → Linked Devices → Link a Device.
3. The moment it connects, the server:
   - saves your session permanently under `sessions/<your-number>/`
   - attaches the full command system (everything jagx-bot has — economy, moderation, downloader, the works)
   - sends you a WhatsApp message confirming it's live, with a photo
4. That's it. Go to WhatsApp, send `.menu` to yourself, and start using it. The bot keeps running on the server independently of your browser tab, your phone, anything.

---

## 🚀 Deploy to Render.com

This project no longer supports Vercel — a persistently-running bot needs a persistent process, which serverless platforms don't provide. Render, Railway, or a VPS are the right fit; the instructions below use Render.

1. Push this folder to a GitHub repo (see the git section below if you're not sure how).
2. render.com → **New +** → **Web Service** → connect that repo.
3. Settings:
   - **Environment:** Node
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
4. Deploy. You'll get a URL like `jagx-session.onrender.com`.

---

## 💾 Keeping it running for real — the persistence caveat

This matters, so please actually read it:

**Render's free tier has an *ephemeral* filesystem.** Every time the service restarts — whether from a deploy, a crash, or simply spinning back up after 15 minutes idle — any files written to disk (including `sessions/`, where your live login lives) are wiped. On the free tier, that means every restart requires scanning the QR again.

**Two ways to get genuine, permanent 24/7 operation:**

1. **Upgrade to Render's Starter plan** ($7/month) and **add a persistent disk** (a small additional monthly cost, a few GB is plenty). This removes both problems: the service never sleeps, and `sessions/` survives restarts. Mount the disk at the project's `sessions/` path in Render's dashboard.
2. **Run it on a VPS instead** (a $5/month DigitalOcean/Linode droplet, for example) with `pm2` for process management — a VPS's disk is yours permanently, no special configuration needed. Same `npm install && npm start` as above, just managed with pm2 so it restarts automatically on crash or reboot.

If you're just trying this out or only need it running for a while, the free tier is genuinely fine — you'll just need to re-scan if it happens to restart while you're using it.

---

## 🖱️ Using the site

- **QR CODE tab** (default): tap **Generate QR code**, scan with WhatsApp, done.
- **PAIRING CODE tab**: have WhatsApp already open to "Link with phone number" *before* tapping Connect — the code expires quickly.
- Once connected, the page confirms it and tells you to go test `.menu` on WhatsApp. There's nothing further to copy or configure.

---

## 👥 Managing connected accounts

Check what's currently running:
```
GET /api/status
```
Returns a JSON list of every connected number and when it connected.

To fully disconnect an account, either:
- On that WhatsApp account: Settings → Linked Devices → tap the device → **Log Out**, or
- On the server: stop the process, delete that number's folder under `sessions/<number>/`, then restart.

---

## 📲 Pushing updates from Termux / Command Prompt / Terminal

Identical across all three:

```bash
cd jagx-session          # make sure ls/dir shows server.js, package.json, and the core/lib/public folders directly here
git init
git add .
git commit -m "update"
git branch -M main
git remote add origin https://github.com/yourname/jagx-session.git
git push -f origin main
```

If GitHub rejects a password: generate a **Personal Access Token** (GitHub.com → Settings → Developer settings → Personal access tokens) and use that instead.

Then redeploy: Render → your service → **Manual Deploy** → **Deploy latest commit**.

---

## 🧪 Local testing

```bash
npm install
node server.js
```
Open `http://localhost:3000`.

---

## 📁 Files

| Path | Purpose |
|---|---|
| `public/index.html` | The page — QR/pairing tabs, live status log, connected confirmation |
| `server.js` | Express entry point — pairing endpoint, status endpoint, auto-resume on boot |
| `lib/hostedPairing.js` | Handles a new connection start-to-finish, then keeps it running indefinitely |
| `lib/attachBot.js` | Wires the full command system (all 115+ commands) onto a live connection |
| `lib/botManager.js` | Registry of every currently-running connected account |
| `core/plugins/`, `core/lib/` | The same command/plugin code that powers standalone jagx-bot |
| `sessions/` | Per-account persistent login data (gitignored — never commit this) |

---

## 📄 License

Released under the **JRI License** — see [`LICENSE`](./LICENSE). Free to use, modify, and self-host, with credit to **JagX** and **JRI** kept intact.

<div align="center">

**JagX Hosted Bot** · built by **JRI**

</div>
