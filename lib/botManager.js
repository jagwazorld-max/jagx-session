// Tracks every WhatsApp account currently connected and running through this
// server. One entry per tenant — each holds their own live socket.
const activeBots = new Map(); // ownerNumber (digits) -> { sock, dir, connectedAt }

function register(ownerNumber, sock, dir) {
  activeBots.set(ownerNumber, { sock, dir, connectedAt: Date.now() });
}

function unregister(ownerNumber) {
  activeBots.delete(ownerNumber);
}

async function logout(ownerNumber) {
  const entry = activeBots.get(ownerNumber);
  if (!entry) return false;
  try {
    await entry.sock.logout();
  } catch {
    // ignore — we're removing it regardless
  }
  activeBots.delete(ownerNumber);
  return true;
}

function isRunning(ownerNumber) {
  return activeBots.has(ownerNumber);
}

function get(ownerNumber) {
  return activeBots.get(ownerNumber);
}

function list() {
  return [...activeBots.entries()].map(([ownerNumber, v]) => ({ ownerNumber, connectedAt: v.connectedAt }));
}

module.exports = { activeBots, register, unregister, logout, isRunning, get, list };
