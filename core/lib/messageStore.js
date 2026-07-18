// Caches recent raw messages in memory so we can recover them if the sender
// deletes them ("delete for everyone"). Capped so long-running bots don't
// grow memory forever. Cache is lost on restart — that's an accepted
// trade-off for staying dependency-free and Termux-friendly.

const MAX_CACHE = 300;
const cache = new Map();

function set(id, msg) {
  if (!id) return;
  if (cache.size >= MAX_CACHE) {
    const oldestKey = cache.keys().next().value;
    cache.delete(oldestKey);
  }
  cache.set(id, msg);
}

function get(id) {
  return cache.get(id);
}

module.exports = { set, get };
