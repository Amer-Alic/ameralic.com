// One command to ship. Renders the site, commits, pushes, then hands you the
// social copy — X first, LinkedIn on request. Posting stays manual on purpose:
// the two platforms want different writing, and the approval step is where the
// judgment lives.
//
//   npm run publish -- work-that-matters-in-the-age-of-ai
//   npm run publish -- 2026-08-09-agents-drop-requirements   (short post, no essay)
//   npm run publish -- <slug> --dry                          (render + show, no git)

import { readFileSync, writeFileSync, existsSync, appendFileSync, readdirSync, mkdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(fileURLToPath(import.meta.url));
const SITE = 'https://ameralic.com';
const args = process.argv.slice(2);
const DRY = args.includes('--dry');
const name = args.find((a) => !a.startsWith('--'));

if (!name) {
  console.error('usage: npm run publish -- <slug> [--dry]');
  process.exit(1);
}

const git = (...a) => execFileSync('git', a, { cwd: ROOT, encoding: 'utf8' }).trim();
const copy = (text) => {
  try {
    execFileSync('pbcopy', { input: text });
    return true;
  } catch {
    return false;
  }
};

/* ---------- locate the source ---------- */

const readdirSafe = (dir) => {
  try {
    return readdirSync(join(ROOT, dir)).filter((f) => f.endsWith('.md'));
  } catch {
    return [];
  }
};

const matches = (f) => f === `${name}.md` || f.endsWith(`-${name}.md`);
const essayByDate = readdirSafe('posts').find(matches);
const shortByName = readdirSafe('inbox/drafts').find(matches);

const source = essayByDate
  ? { kind: 'essay', path: join('posts', essayByDate) }
  : shortByName
    ? { kind: 'short', path: join('inbox', 'drafts', shortByName) }
    : null;

if (!source) {
  console.error(`No post found. Looked for posts/${name}.md and inbox/drafts/${name}.md`);
  process.exit(1);
}

const raw = readFileSync(join(ROOT, source.path), 'utf8');

if (/^draft:\s*true\s*$/im.test(raw)) {
  console.error(`${source.path} is still marked "draft: true". Remove that line when it is ready.`);
  process.exit(1);
}

/* ---------- render ---------- */

if (source.kind === 'essay') {
  console.log('rendering…');
  execFileSync(process.execPath, ['render.js'], { cwd: ROOT, stdio: 'inherit' });
}

/* ---------- ship ---------- */

const slug = (raw.match(/^slug:\s*(.+)$/m) || [])[1]?.trim() ?? name;
const title = (raw.match(/^title:\s*(.+)$/m) || [])[1]?.trim() ?? slug;
const liveUrl = `${SITE}/${slug}.html`;

if (source.kind === 'essay' && !DRY) {
  const files = ['posts', 'Blog.html', 'sitemap.xml', 'feed.xml', `${slug}.html`]
    .filter((f) => existsSync(join(ROOT, f)));
  git('add', '--', ...files);

  const staged = git('diff', '--cached', '--name-only');
  if (staged) {
    git('commit', '-m', `Publish: ${title}`);
    git('push');
    console.log(`\npushed. live in ~60s at ${liveUrl}`);
  } else {
    console.log('\nnothing to commit — site already up to date.');
  }
} else if (source.kind === 'essay') {
  console.log(`\n[dry] would commit and push. would be live at ${liveUrl}`);
}

/* ---------- social copy ---------- */

const block = (raw.match(/<!--\s*social\b([\s\S]*?)-->/i) || [])[1] ?? '';
const parts = Object.fromEntries(
  block.split(/^\s*---\s*$/m).map((chunk) => {
    const m = chunk.match(/^\s*(x|linkedin)\s*:\s*\n?([\s\S]*)$/i);
    return m ? [m[1].toLowerCase(), m[2].trim()] : [null, null];
  }).filter(([k]) => k),
);

if (parts.x || parts.linkedin) {
  mkdirSync(join(ROOT, 'inbox', 'drafts'), { recursive: true });
  const outPath = join(ROOT, 'inbox', 'drafts', `${slug}.social.txt`);
  writeFileSync(outPath, `X\n${'-'.repeat(60)}\n${parts.x ?? '(none)'}\n\n\nLINKEDIN\n${'-'.repeat(60)}\n${parts.linkedin ?? '(none)'}\n`);

  if (parts.x) {
    // 280 is the limit without X Premium; a link counts as 23 regardless of length.
    const weighted = parts.x.replace(/https?:\/\/\S+/g, 'x'.repeat(23)).length;
    const over = weighted > 280 ? `  ⚠ ${weighted - 280} over the 280 limit (fine on Premium)` : '';
    console.log(`\n${'='.repeat(64)}\nX  (${weighted} chars — copied to clipboard)${over}\n${'='.repeat(64)}\n${parts.x}`);
    copy(parts.x);
  }
  if (parts.linkedin) {
    console.log(`\n${'='.repeat(64)}\nLINKEDIN  (${parts.linkedin.length} chars)\n${'='.repeat(64)}\n${parts.linkedin}`);
  }
  console.log(`\nboth saved to inbox/drafts/${slug}.social.txt`);
  console.log('post the X one now (already on your clipboard), then run:');
  console.log(`  npm run publish -- ${name} --linkedin   to copy the LinkedIn version`);
}

if (args.includes('--linkedin') && parts.linkedin) copy(parts.linkedin);

/* ---------- streak ---------- */

if (!DRY) {
  const logPath = join(ROOT, 'inbox', 'published.log');
  const today = new Date().toISOString().slice(0, 10);
  appendFileSync(logPath, `${today}\t${source.kind}\t${slug}\n`);

  const entries = readFileSync(logPath, 'utf8').trim().split('\n')
    .filter((l) => l.trim() && !l.startsWith('#'));
  const weeks = new Set(entries.map((l) => isoWeek(l.split('\t')[0])));
  let streak = 0;
  for (let w = isoWeek(today); weeks.has(w); w = previousWeek(w)) streak++;

  console.log(`\n${entries.length} published · ${streak} week streak`);
}

function isoWeek(iso) {
  const d = new Date(iso + 'T00:00:00Z');
  const day = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - day + 3);
  const firstThursday = new Date(Date.UTC(d.getUTCFullYear(), 0, 4));
  const fday = (firstThursday.getUTCDay() + 6) % 7;
  firstThursday.setUTCDate(firstThursday.getUTCDate() - fday + 3);
  const week = 1 + Math.round((d - firstThursday) / (7 * 86400000));
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

function previousWeek(w) {
  const [y, n] = w.split('-W').map(Number);
  const d = new Date(Date.UTC(y, 0, 4));
  d.setUTCDate(d.getUTCDate() + (n - 1) * 7 - 7);
  return isoWeek(d.toISOString().slice(0, 10));
}
