import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '../..');
const combinedPath = join(root, 'dist/overlays/combined/index.html');
const source = readFileSync(combinedPath, 'utf8');

test('combined overlay polls Pulse viewers and followers APIs', () => {
  assert.match(source, /\/api\/\$\{route\}/);
  assert.match(source, /fetchMetric\('viewers'\)/);
  assert.match(source, /fetchMetric\('followers'\)/);
  assert.match(source, /pulse-api\.clankamode\.workers\.dev/);
});

test('combined overlay rejects API error payloads instead of treating count as live', () => {
  assert.match(source, /data\.error/);
  assert.match(source, /typeof data\.count !== 'number'/);
  assert.match(source, /Boolean\(data\.demo\)/);
  assert.match(source, /class="demo-mark/);
});

test('combined overlay does not invent unlabeled live metrics', () => {
  assert.doesNotMatch(source, /refreshDemoMetrics/);
  assert.doesNotMatch(source, /createGenerator/);
  assert.doesNotMatch(source, /hashString/);
  assert.doesNotMatch(source, /buildMetric\('◆', '60'\)/);
  // Uptime/FPS slots must stay empty placeholders, not page-load age / fake FPS.
  assert.match(source, /buildMetric\('⏱', '---'\)/);
  assert.match(source, /buildMetric\('◆', '---'\)/);
});

test('combined overlay accepts youtube (not silently coerced to twitch-only)', () => {
  assert.match(source, /value === 'kick' \|\| value === 'youtube'/);
});
