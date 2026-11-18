// usage: node push.mjs <key> [targetNodeId] [mode]  — writes out/<key>.html into Paper
import { readFileSync } from 'node:fs';
import { paper } from './paper.mjs';
const FILE = '01M7P0Z20ME6NYF8N4KJ0EJ7JS';
const [key, target = key, mode = 'replace'] = process.argv.slice(2);
const c = await paper();
try {
  const html = readFileSync(`out/${key}.html`, 'utf8');
  const r = await c.call('write_html', { fileId: FILE, targetNodeId: target, mode, html });
  console.log(r.slice(0, 600));
} finally { c.close(); }
