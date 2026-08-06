#!/usr/bin/env node
// The only command. Shows what is waiting, and does the next thing.
//
//   w

import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { execFileSync, spawnSync } from 'node:child_process';
import { join, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createInterface } from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';

const ROOT = dirname(fileURLToPath(import.meta.url));
const DRAFTS = join(ROOT, 'inbox', 'drafts');
const POSTS = join(ROOT, 'posts');

const rl = createInterface({ input, output });
const ask = (q) => rl.question(q);

const bold = (s) => `\x1b[1m${s}\x1b[0m`;
const dim = (s) => `\x1b[2m${s}\x1b[0m`;
const green = (s) => `\x1b[32m${s}\x1b[0m`;
const yellow = (s) => `\x1b[33m${s}\x1b[0m`;

const list = (dir, filter = () => true) => {
  try {
    return readdirSync(dir)
      .filter((f) => f.endsWith('.md') && f.toLowerCase() !== 'readme.md')
      .filter(filter);
  } catch {
    return [];
  }
};

const daysOld = (path) =>
  Math.floor((Date.now() - statSync(path).mtimeMs) / 86400000);

function describe(path) {
  const raw = readFileSync(path, 'utf8');
  const gaps = (raw.match(/\[\?\?\?/g) ?? []).length;
  const isEssay = /^tag:/m.test(raw);
  const blocked = /^draft:\s*true\s*$/im.test(raw);
  const slug = (raw.match(/^slug:\s*(.+)$/m) ?? [])[1]?.trim()
    ?? basename(path).replace(/\.md$/, '');
  const title = (raw.match(/^title:\s*(.+)$/m) ?? [])[1]?.trim() ?? slug;
  return { path, slug, title, gaps, isEssay, blocked, age: daysOld(path) };
}

/* ---------- gather ---------- */

const items = [
  ...list(DRAFTS).map((f) => describe(join(DRAFTS, f))),
  ...list(POSTS).map((f) => describe(join(POSTS, f))).filter((i) => i.blocked),
].sort((a, b) => b.age - a.age);

let unusedNotes = 0;
try {
  unusedNotes = readFileSync(join(ROOT, 'inbox', 'inbox.md'), 'utf8')
    .split('\n').filter((l) => l.startsWith('- ') && !l.includes('[used]')).length;
} catch { /* no inbox yet */ }

/* ---------- show ---------- */

console.log();
if (!items.length) {
  console.log(dim('  Nothing waiting.'));
} else {
  console.log(bold('  Waiting'));
  items.forEach((it, n) => {
    const kind = it.isEssay ? 'essay' : 'short';
    const state = it.gaps
      ? yellow(`${it.gaps} gap${it.gaps > 1 ? 's' : ''} to fill`)
      : it.blocked ? yellow('unfinished')
      : green('ready to publish');
    const age = it.age === 0 ? 'today' : `${it.age}d old`;
    console.log(`  ${bold(String(n + 1))}. ${it.title}`);
    console.log(`     ${dim(`${kind} · ${age} · `)}${state}`);
  });
}
console.log();
console.log(dim(`  inbox: ${unusedNotes} note${unusedNotes === 1 ? '' : 's'} not yet drafted`));
console.log();
console.log(`  ${bold('n')}  write something new`);
console.log(`  ${bold('q')}  quit`);
console.log();

/* ---------- act ---------- */

const choice = (await ask('  > ')).trim().toLowerCase();

const run = (cmd, args) =>
  spawnSync(cmd, args, { cwd: ROOT, stdio: 'inherit' });

const openInEditor = (path) => {
  const editor = process.env.EDITOR;
  if (editor) return run(editor, [path]);
  for (const app of ['cursor', 'code', 'subl']) {
    try {
      execFileSync('which', [app], { stdio: 'ignore' });
      return run(app, [path]);
    } catch { /* not installed */ }
  }
  return run('open', ['-t', path]);
};

if (choice === 'q' || choice === '') {
  rl.close();
} else if (choice === 'n') {
  const title = (await ask('  Title: ')).trim();
  if (!title) { rl.close(); process.exit(0); }
  const kind = (await ask('  Essay or short? [s/e] ')).trim().toLowerCase();
  rl.close();

  const args = ['new.js', title];
  if (kind !== 'e') args.push('--short');
  const made = spawnSync(process.execPath, args, { cwd: ROOT, encoding: 'utf8' });
  process.stdout.write(made.stdout ?? '');

  const created = (made.stdout ?? '').match(/created (.+)/)?.[1]?.trim();
  if (created) openInEditor(join(ROOT, created));
} else if (items[Number(choice) - 1]) {
  const it = items[Number(choice) - 1];

  if (it.gaps) {
    console.log(`\n  ${yellow(`${it.gaps} gap${it.gaps > 1 ? 's' : ''}`)} still to fill. Opening it.`);
    rl.close();
    openInEditor(it.path);
    process.exit(0);
  }

  if (it.blocked) {
    console.log(`\n  Still marked ${yellow('draft: true')}. Remove that line first. Opening it.`);
    rl.close();
    openInEditor(it.path);
    process.exit(0);
  }

  const go = (await ask(`\n  Publish "${it.title}"? [y/N] `)).trim().toLowerCase();
  if (go !== 'y') { rl.close(); process.exit(0); }

  rl.close();
  run(process.execPath, ['publish.js', it.slug]);

  const again = createInterface({ input, output });
  await again.question('\n  X version is on your clipboard. Post it, then press enter… ');
  again.close();
  run(process.execPath, ['publish.js', it.slug, '--linkedin']);
  console.log('\n  LinkedIn version copied. Post it and you are done.\n');
} else {
  console.log(dim('\n  Nothing to do.\n'));
  rl.close();
}
