#!/usr/bin/env node
// Quick pre-flight check before `forge deploy`.
import { execSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';

const checks = [];
function check(name, fn) {
  try {
    const detail = fn();
    checks.push({ name, ok: true, detail });
  } catch (err) {
    checks.push({ name, ok: false, detail: err.message });
  }
}

check('Node.js 22 or newer', () => {
  const major = Number(process.versions.node.split('.')[0]);
  if (major < 22) throw new Error(`found ${process.versions.node}; Forge runtime is nodejs22.x`);
  return process.versions.node;
});

check('Forge CLI installed', () => execSync('forge --version', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim());

check('App registered (manifest app.id set)', () => {
  const manifest = readFileSync('manifest.yml', 'utf8');
  if (manifest.includes('00000000-0000-0000-0000-000000000000')) throw new Error('run `npm run register` first');
  return 'yes';
});

check('Dependencies installed', () => {
  if (!existsSync('node_modules/@forge/api')) throw new Error('run `npm install`');
  return 'yes';
});

check('.env for the demo seed (optional)', () => {
  if (!existsSync('.env')) throw new Error('copy .env.example to .env before `npm run seed`');
  return 'present';
});

for (const c of checks) console.log(`${c.ok ? '✔' : '✖'} ${c.name}${c.detail ? ` — ${c.detail}` : ''}`);
const blocking = checks.filter((c) => !c.ok && !c.name.includes('optional'));
process.exit(blocking.length ? 1 : 0);
