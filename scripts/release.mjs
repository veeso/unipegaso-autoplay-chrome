#!/usr/bin/env node
import { readFile, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');

const BUMP_TYPES = ['patch', 'minor', 'major'];

function bump(version, type) {
  const [major, minor, patch] = version.split('.').map(Number);
  if (type === 'major') return `${major + 1}.0.0`;
  if (type === 'minor') return `${major}.${minor + 1}.0`;
  return `${major}.${minor}.${patch + 1}`;
}

function sh(cmd, args) {
  return execFileSync(cmd, args, { cwd: root, stdio: 'inherit' });
}

function shOut(cmd, args) {
  return execFileSync(cmd, args, { cwd: root, encoding: 'utf8' }).trim();
}

async function readJson(path) {
  return JSON.parse(await readFile(path, 'utf8'));
}

async function writeJson(path, data) {
  await writeFile(path, JSON.stringify(data, null, 2) + '\n');
}

async function main() {
  const type = process.argv[2];
  if (!BUMP_TYPES.includes(type)) {
    console.error(`Usage: npm run release -- <${BUMP_TYPES.join('|')}>`);
    process.exit(1);
  }

  const status = shOut('git', ['status', '--porcelain']);
  if (status) {
    console.error('Working tree not clean. Commit or stash changes first.');
    process.exit(1);
  }

  const branch = shOut('git', ['rev-parse', '--abbrev-ref', 'HEAD']);
  if (branch !== 'main') {
    console.error(`Must release from main (currently on ${branch}).`);
    process.exit(1);
  }

  const pkgPath = resolve(root, 'package.json');
  const manifestPath = resolve(root, 'src/manifest.json');

  const pkg = await readJson(pkgPath);
  const manifest = await readJson(manifestPath);

  if (pkg.version !== manifest.version) {
    console.error(
      `Version mismatch: package.json=${pkg.version} manifest=${manifest.version}. Fix before releasing.`,
    );
    process.exit(1);
  }

  const next = bump(pkg.version, type);
  const tag = `v${next}`;

  console.log(`Bumping ${pkg.version} → ${next}`);

  pkg.version = next;
  manifest.version = next;

  await writeJson(pkgPath, pkg);
  await writeJson(manifestPath, manifest);

  // JSON.stringify expands short arrays onto multiple lines, which clashes
  // with Prettier's default JSON formatting and trips CI format:check. Run
  // Prettier on the two files we touched so the bump commit stays clean.
  sh('npx', ['prettier', '--write', 'package.json', 'src/manifest.json']);

  sh('git', ['add', 'package.json', 'src/manifest.json']);
  sh('git', ['commit', '-m', `release: ${tag}`]);
  sh('git', ['tag', '-a', tag, '-m', tag]);

  console.log(`\nTagged ${tag}. To publish:\n  git push origin main --follow-tags`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
