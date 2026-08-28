import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '../..');
const alerts = readFileSync(join(root, 'dist/overlays/alerts/index.html'), 'utf8');
const dashboard = readFileSync(join(root, 'dist/dashboard/index.html'), 'utf8');
const landing = readFileSync(join(root, 'dist/index.html'), 'utf8');

test('alerts overlay labels simulated events as Demo', () => {
  assert.match(alerts, /class="demo-mark"/);
  assert.match(alerts, /id="demo-mark">Demo/);
  assert.match(alerts, /demo: true/);
  assert.match(alerts, /scheduleDemo\(\)/);
  // Corner mark must stay readable on transparent / light OBS scenes.
  assert.match(alerts, /background: rgba\(17, 17, 17, 0\.78\)/);
  assert.doesNotMatch(alerts, /\.demo-mark \{[^}]*color: rgba\(255, 255, 255, 0\.42\)/);
});

test('alerts overlay does not silently coerce YouTube to Twitch', () => {
  assert.match(alerts, /\['twitch', 'kick', 'youtube'\]\.includes\(params\.get\('platform'\)\)/);
  assert.doesNotMatch(alerts, /params\.get\('platform'\) === 'kick' \? 'kick' : 'twitch'/);
});

test('dashboard and landing do not advertise alerts as a live event source', () => {
  assert.match(dashboard, /no live event source yet/);
  assert.match(dashboard, /Demo \(needs OAuth\)/);
  assert.match(landing, /Demo notifications — no live event source/);
  assert.match(landing, /Demo count — needs OAuth for live subs/);
});
