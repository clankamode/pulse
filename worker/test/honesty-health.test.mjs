import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '../..');
const health = readFileSync(join(root, 'dist/health/index.html'), 'utf8');
const architecture = readFileSync(join(root, 'docs/architecture.md'), 'utf8');
const landing = readFileSync(join(root, 'dist/index.html'), 'utf8');
const readme = readFileSync(join(root, 'README.md'), 'utf8');

test('health page does not invent a healthy control room', () => {
  assert.doesNotMatch(health, /All systems operational/);
  assert.doesNotMatch(health, /All overlays healthy/);
  assert.doesNotMatch(health, /scheduleIncident/);
  assert.doesNotMatch(health, /owner: 'xqc'/);
  assert.doesNotMatch(health, /owner: 'mizkif'/);
  assert.doesNotMatch(health, /owner: 'ludwig'/);
  assert.doesNotMatch(health, /owner: 'hasanabi'/);
  assert.doesNotMatch(health, /owner: 'valkyrae'/);
  assert.match(health, /No live overlay reports/);
  assert.match(health, /Not scanning/);
  assert.match(health, /do not send heartbeats to this page/);
});

test('health docs do not advertise an unimplemented /health API', () => {
  assert.doesNotMatch(architecture, /The `\/health` endpoint provides/);
  assert.doesNotMatch(architecture, /data available to the combined overlay HUD/);
  assert.match(architecture, /There is no `\/health` API/);
  assert.doesNotMatch(landing, /Each one reports its own health/);
  assert.match(landing, /do not report here yet/);
  assert.match(readme, /Overlays do not report here yet/);
});

test('README does not advertise unimplemented overlay params', () => {
  assert.doesNotMatch(readme, /`hours`, `minutes`, `seconds`, `label`/);
  assert.doesNotMatch(readme, /`format` \(compact\/full\)/);
  assert.doesNotMatch(readme, /`show_bar` \(1\/0\)/);
  assert.doesNotMatch(readme, /`fade` \(seconds\), `badges` \(1\/0\)/);
  assert.match(readme, /`date`, `time`, `labels` \(1\/0\)/);
  assert.match(readme, /`fade` \(1\/0\), `demo` \(1\/0\)/);
});
