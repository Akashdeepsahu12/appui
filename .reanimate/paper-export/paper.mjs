// Minimal stdio MCP client for Paper Desktop (`paper.exe mcp`), used to push large editable
// screens that are too big to hand-write. usage: node paper.mjs <tool> <args.json | ->
import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';

export async function paper() {
  const p = spawn('C:/Users/akash/.paper/bin/paper.exe', ['mcp'], { stdio: ['pipe', 'pipe', 'pipe'] });
  let buf = '', id = 0;
  const pending = new Map();
  p.stderr.on('data', () => {});
  p.stdout.on('data', d => {
    buf += d;
    let i;
    while ((i = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, i).trim(); buf = buf.slice(i + 1);
      if (!line) continue;
      let msg; try { msg = JSON.parse(line); } catch { continue; }
      if (msg.id && pending.has(msg.id)) { pending.get(msg.id)(msg); pending.delete(msg.id); }
    }
  });
  const rpc = (method, params) => new Promise((res, rej) => {
    const i = ++id; pending.set(i, res);
    p.stdin.write(JSON.stringify({ jsonrpc: '2.0', id: i, method, params }) + '\n');
    setTimeout(() => pending.has(i) && (pending.delete(i), rej(new Error(`${method} timed out`))), 120000);
  });
  const init = await rpc('initialize', { protocolVersion: '2025-03-26', capabilities: {}, clientInfo: { name: 'couplefit-export', version: '1.0.0' } });
  p.stdin.write(JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }) + '\n');
  const call = async (name, args) => {
    const r = await rpc('tools/call', { name, arguments: args });
    if (r.error) throw new Error(`${name}: ${JSON.stringify(r.error)}`);
    const text = (r.result?.content || []).filter(c => c.type === 'text').map(c => c.text).join('\n');
    if (r.result?.isError) throw new Error(`${name}: ${text}`);
    return text;
  };
  return { call, init, close: () => p.kill(), list: () => rpc('tools/list', {}) };
}

if (process.argv[1] && process.argv[1].endsWith('paper.mjs')) {
  const [tool, argFile] = process.argv.slice(2);
  const c = await paper();
  try {
    if (tool === '--list') console.log(JSON.stringify((await c.list()).result.tools.map(t => t.name)));
    else console.log(await c.call(tool, JSON.parse(readFileSync(argFile === '-' ? 0 : argFile, 'utf8'))));
  } finally { c.close(); }
}
