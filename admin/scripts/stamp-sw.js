const fs = require('fs');
const path = require('path');

const swPath = path.join(__dirname, '../public/sw.js');
const version = Date.now().toString();

let content = fs.readFileSync(swPath, 'utf8');
content = content.replace(/const CACHE_VERSION = '[^']*'/, `const CACHE_VERSION = '${version}'`);
fs.writeFileSync(swPath, content, 'utf8');

console.log(`[stamp-sw] CACHE_VERSION set to ${version}`);
