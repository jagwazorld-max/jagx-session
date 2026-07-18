const fs = require('fs');
const path = require('path');

function loadPlugins() {
  const pluginsDir = path.join(__dirname, '..', 'plugins');
  const commands = new Map();
  let fileCount = 0;
  let cmdCount = 0;

  for (const file of fs.readdirSync(pluginsDir)) {
    if (!file.endsWith('.js')) continue;
    const full = path.join(pluginsDir, file);
    delete require.cache[require.resolve(full)];
    let exported;
    try {
      exported = require(full);
    } catch (e) {
      console.error(`[PLUGINS] failed to load ${file}:`, e.message);
      continue;
    }
    fileCount++;
    const list = Array.isArray(exported) ? exported : [exported];
    for (const cmd of list) {
      if (!cmd || !cmd.name || typeof cmd.run !== 'function') continue;
      commands.set(cmd.name, cmd);
      cmdCount++;
      if (Array.isArray(cmd.alias)) {
        for (const a of cmd.alias) commands.set(a, cmd);
      }
    }
  }

  console.log(`[PLUGINS] loaded ${cmdCount} commands from ${fileCount} files`);
  return commands;
}

module.exports = { loadPlugins };
