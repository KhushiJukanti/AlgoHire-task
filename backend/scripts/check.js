const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');
const files = ['server.js', ...['src', 'scripts', 'tests'].flatMap(dir => fs.existsSync(path.join(root, dir)) ? fs.readdirSync(path.join(root, dir), { recursive: true }).filter(file => file.endsWith('.js')).map(file => path.join(dir, file)) : [])];
for (const file of files) {
  const result = spawnSync(process.execPath, ['--check', path.join(root, file)], { stdio: 'inherit' });
  if (result.status !== 0) process.exit(1);
}
console.log(`Syntax checked ${files.length} JavaScript files`);
