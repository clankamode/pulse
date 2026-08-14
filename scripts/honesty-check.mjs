#!/usr/bin/env node
/**
 * Honesty regression checks for Combined Stats (second product-honesty pass).
 * Fails if the overlay reverts to unlabeled RNG "live" metrics.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const combinedPath = path.join(root, 'dist/overlays/combined/index.html');
const viewerPath = path.join(root, 'dist/overlays/viewer/index.html');
const followerPath = path.join(root, 'dist/overlays/follower/index.html');
const readmePath = path.join(root, 'README.md');

const failures = [];

function assert(condition, message) {
  if (!condition) {
    failures.push(message);
  }
}

function read(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

const combined = read(combinedPath);
const viewer = read(viewerPath);
const follower = read(followerPath);
const readme = read(readmePath);

// Combined must call real Pulse API routes (same worker as viewer/follower).
assert(
  combined.includes('/api/') && combined.includes("fetchMetric('viewers')"),
  'combined overlay must fetch /api/viewers'
);
assert(
  combined.includes("fetchMetric('followers')"),
  'combined overlay must fetch /api/followers'
);
assert(
  combined.includes('pulse-api.clankamode.workers.dev'),
  'combined overlay must use the Pulse API worker host'
);

// Must honor error/demo the same way count widgets do.
assert(
  /data\.error/.test(combined) && /data\.demo/.test(combined),
  'combined overlay must check data.error and data.demo'
);
assert(
  combined.includes('demo-mark'),
  'combined overlay must expose a Demo mark for worker demo payloads'
);
assert(
  combined.includes("'---'") || combined.includes('"---"'),
  'combined overlay must fail closed to --- when counts are unavailable'
);

// Must not invent unlabeled live counts via local PRNG.
assert(
  !combined.includes('createGenerator'),
  'combined overlay must not use createGenerator RNG for metrics'
);
assert(
  !combined.includes('refreshDemoMetrics'),
  'combined overlay must not drift fake demo metrics unlabeled'
);
assert(
  !/Math\.floor\(150 \+/.test(combined),
  'combined overlay must not seed unlabeled viewer RNG'
);

// FPS must never hardcode a fake live frame rate.
assert(
  !/buildMetric\('◆', '60'\)/.test(combined) && !combined.includes("buildMetric('◆', \"60\")"),
  'combined overlay must not hardcode FPS as 60'
);

// First-pass count widgets must remain honest (do not revert).
assert(
  viewer.includes('data.error') && viewer.includes('demo-mark'),
  'viewer overlay first-pass honesty (error/demo) must remain'
);
assert(
  follower.includes('/api/followers') && follower.includes('demo-mark'),
  'follower overlay first-pass honesty (API + demo) must remain'
);

// README should not oversell combined as a mysterious "all metrics" blob.
assert(
  /Combined Stats/.test(readme),
  'README must still document Combined Stats'
);
assert(
  !/Combined Stats.*All metrics in one compact HUD/.test(readme),
  'README must not claim Combined is an unlabeled "all metrics" HUD'
);

if (failures.length) {
  console.error('Honesty checks failed:');
  for (const failure of failures) {
    console.error(' - ' + failure);
  }
  process.exit(1);
}

console.log('Honesty checks passed (' + [
  'combined API wiring',
  'demo/error handling',
  'no unlabeled RNG',
  'first-pass overlays intact',
  'README copy'
].join(', ') + ').');
