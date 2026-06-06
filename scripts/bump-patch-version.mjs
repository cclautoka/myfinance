#!/usr/bin/env node
/**
 * Bump patch version in package.json (and native versionName) at CI/Docker build time.
 * Does not commit — deployed stamp only.
 *
 * Usage:
 *   node scripts/bump-patch-version.mjs --ci
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const args = new Set(process.argv.slice(2));
const ci = args.has('--ci');

if (ci && !process.env.CI && !process.env.DOKPLOY_BUILD_NUMBER && !process.env.DOCKER_BUILD) {
  console.log('bump-patch-version: skip (not CI/Dokploy/Docker)');
  process.exit(0);
}

const root = join(import.meta.dirname, '..');
const pkgPath = join(root, 'package.json');
const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
const parts = String(pkg.version ?? '1.0.0')
  .trim()
  .split('.')
  .map((n) => parseInt(n, 10));
const [maj = 1, min = 0, pat = 0] = parts;
const next = `${maj}.${min}.${pat + 1}`;
pkg.version = next;
writeFileSync(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`);

const androidGradle = join(root, 'android/app/build.gradle');
try {
  let gradle = readFileSync(androidGradle, 'utf8');
  gradle = gradle.replace(/versionName\s+"[^"]+"/, `versionName "${next}"`);
  writeFileSync(androidGradle, gradle);
} catch {
  /* optional native tree */
}

const iosPbx = join(root, 'ios/App/App.xcodeproj/project.pbxproj');
try {
  let pbx = readFileSync(iosPbx, 'utf8');
  pbx = pbx.replace(/MARKETING_VERSION = [^;]+;/g, `MARKETING_VERSION = ${next};`);
  writeFileSync(iosPbx, pbx);
} catch {
  /* optional native tree */
}

console.log(`bump-patch-version: ${parts.join('.')} → ${next}`);
