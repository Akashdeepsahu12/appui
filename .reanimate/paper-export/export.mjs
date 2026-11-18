// Renders every CoupleFit web state and writes Paper-ready editable HTML to ./out/<key>.html.
// usage: node export.mjs [key ...]   (no keys = all states)
import { createRequire } from 'node:module';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const require = createRequire('C:/Users/akash/.claude/skills/reanimate/scripts/');
const { chromium } = require('playwright');
const BASE = 'http://localhost:5173/couplefit/';
const rec = readFileSync(join(here, 'canvas-rec.js'), 'utf8');
const ser = readFileSync(join(here, 'dom2paper.js'), 'utf8');

const click = sel => async p => { await p.click(sel); await p.waitForTimeout(700); };
export const STATES = [
  // existing artboards (key = the PNG "Screen" frame they replace)
  { key: 'W-0', hash: 'today' },
  { key: '19-0', hash: 'challenges' },
  { key: '1F-0', hash: 'trends' },
  { key: '1L-0', hash: 'hub' },
  { key: '1R-0', hash: 'detail/heart' },
  { key: '1X-0', hash: 'today', view: true, scroll: 'bottom' },
  { key: '2M-0', hash: 'recharge' },
  { key: '2S-0', hash: 'recharge/home' },
  { key: '2Y-0', hash: 'recharge/coach' },
  { key: '34-0', hash: 'recharge/timeline' },
  { key: '3U-0', hash: 'breath' },
  { key: '40-0', hash: 'breath', view: true, act: async p => { await p.click('#bStart'); await p.waitForTimeout(10500); } },
  { key: '46-0', hash: 'breath', view: true, act: async p => { await p.click('#bStart'); await p.waitForTimeout(6000); await p.click('#bStop'); await p.waitForTimeout(900); } },
  { key: '4C-0', hash: 'breath', view: true, act: async p => { await p.click('#bCal'); await p.waitForTimeout(2600); } },
  { key: '4I-0', hash: 'breath', view: true },
  { key: '4O-0', hash: 'breath', view: true, scroll: 'bottom' },
  { key: '5G-0', hash: 'glucose' },
  { key: '5M-0', hash: 'glucose', act: click('#gTab [data-i="1"]') },
  { key: '5S-0', hash: 'glucose', act: click('#gTab [data-i="2"]') },
  { key: '5Y-0', hash: 'glucose', act: click('#gTab [data-i="3"]') },
  { key: '64-0', hash: 'glucose', view: true },
  { key: '6M-0', hash: 'hearing' },
  { key: '6S-0', hash: 'hearing', view: true },
  // new screens
  { key: 'E3', hash: 'hearing/lock', view: true },
  { key: 'F1', hash: 'verdict' },
  { key: 'F2', hash: 'verdict/session' },
  { key: 'F3', hash: 'verdict/body' },
  { key: 'G1', hash: 'physio' },
  { key: 'G2', hash: 'physio/session', act: async p => { await p.waitForTimeout(7300); } },
  { key: 'G3', hash: 'physio/feel', act: click('[data-pain="3"]') },
  { key: 'G4', hash: 'physio/milestone', view: true, act: async p => { await p.waitForTimeout(1500); } },
  { key: 'G5', hash: 'physio/week', act: click('[data-day="1"]') },
];

const want = process.argv.slice(2);
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 412, height: 892 }, deviceScaleFactor: 1, reducedMotion: 'reduce' });
await ctx.addInitScript(rec);
mkdirSync(join(here, 'out'), { recursive: true });
const manifest = [];
for (const s of STATES.filter(s => !want.length || want.includes(s.key))) {
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(BASE + '#/' + s.hash);
  await page.waitForTimeout(1400);
  if (s.act) await s.act(page);
  if (s.view) {
    if (s.scroll === 'bottom') await page.evaluate(() => { const sc = document.querySelector('.screen'); sc.scrollTop = sc.scrollHeight; });
  } else {
    const h = await page.evaluate(() => Math.max(892, Math.ceil(document.querySelector('.screen').scrollHeight)));
    await page.setViewportSize({ width: 412, height: h });
    await page.evaluate(h => { document.querySelector('#phone').style.height = h + 'px'; }, h);
  }
  await page.waitForTimeout(500);
  await page.addScriptTag({ content: ser });
  const res = await page.evaluate(k => window.__dom2paper({ name: 'Screen' }), s.key);
  writeFileSync(join(here, 'out', s.key + '.html'), res.html);
  manifest.push({ key: s.key, hash: s.hash, height: res.height, layers: res.count, kb: Math.round(res.html.length / 1024), errors });
  console.log(s.key, s.hash, `${res.height}px`, `${res.count} layers`, `${Math.round(res.html.length / 1024)} KB`, errors.length ? 'ERR ' + errors.join(' | ') : '');
  await page.setViewportSize({ width: 412, height: 892 });
  await page.close();
}
writeFileSync(join(here, 'out', 'manifest.json'), JSON.stringify(manifest, null, 1));
await browser.close();
