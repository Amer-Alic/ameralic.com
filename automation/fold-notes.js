// Folds captured notes from GitHub issues into notes/inbox.md, then closes them.
//
//   node automation/fold-notes.js          fold and close
//   node automation/fold-notes.js --dry    show what would be folded
//
// The Capture Note shortcut opens one issue per thought, with the body set to
// the marker below. Anything else in the issue tracker is left alone.

import { readFileSync, appendFileSync, existsSync, writeFileSync, mkdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const REPO = 'Amer-Alic/writing-inbox';
const MARKER = 'capture';
const INBOX = join(ROOT, 'inbox', 'inbox.md');
const DRY = process.argv.includes('--dry');

const gh = (...args) => execFileSync('gh', args, { encoding: 'utf8' });

let issues;
try {
  issues = JSON.parse(gh('api', `repos/${REPO}/issues?state=open&per_page=100`));
} catch (err) {
  console.error(`could not reach GitHub: ${err.message.split('\n')[0]}`);
  process.exit(1);
}

const notes = issues.filter((i) => !i.pull_request && (i.body ?? '').trim() === MARKER);

if (!notes.length) {
  console.log('no captured notes waiting.');
  process.exit(0);
}

// Oldest first, so the inbox reads chronologically.
notes.sort((a, b) => a.created_at.localeCompare(b.created_at));

const lines = notes.map((i) => `- ${i.created_at.slice(0, 10)} — ${i.title.trim()}`);

if (DRY) {
  console.log(`would fold ${notes.length} note(s):\n${lines.join('\n')}`);
  process.exit(0);
}

if (!existsSync(INBOX)) {
  console.error(`missing ${INBOX}`);
  process.exit(1);
}

const existing = readFileSync(INBOX, 'utf8');
appendFileSync(INBOX, (existing.endsWith('\n') ? '' : '\n') + lines.join('\n') + '\n');

// Every captured note becomes a stub draft straight away, so it shows up in the
// interface as something to write rather than a line you have to notice. The
// Tue/Thu agent shapes the ones with enough substance; the rest wait for you.
const DRAFTS = join(ROOT, 'inbox', 'drafts');
mkdirSync(DRAFTS, { recursive: true });

for (const issue of notes) {
  const text = issue.title.trim();
  const date = issue.created_at.slice(0, 10);
  const base = text.toLowerCase()
    .replace(/['’]/g, '').replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '').split('-').slice(0, 8).join('-') || 'note';

  let slug = base;
  for (let n = 2; existsSync(join(DRAFTS, `${date}-${slug}.md`)); n++) slug = `${base}-${n}`;

  const title = text.length > 70 ? text.slice(0, 67).trimEnd() + '…' : text;

  writeFileSync(join(DRAFTS, `${date}-${slug}.md`), `---
title: ${title.replace(/\n/g, ' ')}
slug: ${slug}
date: ${date}
---

<!-- raw: captured, not yet shaped. Pick one and delete the rest.
  CORRECTION  I believed X → what actually happened → what I do now.
  NUMBER      One real metric → what it changed → what it cost.
  DECISION    The fork → the option I rejected and why → what it cost me.
  MECHANISM   How one thing works, in enough detail that someone could copy it.
-->

${text}

<!--social
x:
[???]

---
linkedin:
[???]
-->
`);
}

const inboxRepo = join(ROOT, 'inbox');
try {
  execFileSync('git', ['add', 'inbox.md'], { cwd: inboxRepo });
  execFileSync('git', ['commit', '-qm', `Fold ${notes.length} note(s)`], { cwd: inboxRepo });
  execFileSync('git', ['push', '-q'], { cwd: inboxRepo });
} catch (err) {
  console.error(`folded locally, but could not push the inbox repo: ${String(err.message).split('\n')[0]}`);
}

// Close last: if anything above failed, the issues are still there to retry.
for (const issue of notes) {
  gh('api', '--method', 'PATCH', `repos/${REPO}/issues/${issue.number}`, '-f', 'state=closed');
}

console.log(`folded ${notes.length} note(s) into inbox/inbox.md and closed #${notes.map((i) => i.number).join(', #')}`);
