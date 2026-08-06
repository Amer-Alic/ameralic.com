// Tells Amer a job finished, in two places:
//
//   1. A GitHub issue per new draft on the private inbox repo — the container.
//      Readable and editable from the GitHub app on the phone.
//   2. An Apple Reminder in the "Writing" list — the alert. It syncs to the
//      phone over iCloud and, unlike a banner, stays put until it is ticked off.
//
//   node automation/notify.js <draft|essay|review> "<summary>"

import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const INBOX = join(ROOT, 'inbox');
const REPO = 'Amer-Alic/writing-inbox';
const LIST = 'Writing';

const [job, summary = ''] = process.argv.slice(2);
if (!job) {
  console.error('usage: node automation/notify.js <job> "<summary>"');
  process.exit(1);
}

const TITLES = {
  draft: 'Drafts are waiting',
  essay: 'Essay check',
  review: 'Writing week',
};

/* ---------- one issue per draft written in the last inbox commit ---------- */

const links = [];

if (job !== 'review') {
  let touched = [];
  try {
    touched = execFileSync('git', ['show', '--name-only', '--pretty=format:', 'HEAD'],
      { cwd: INBOX, encoding: 'utf8' })
      .split('\n').map((l) => l.trim())
      .filter((l) => l.startsWith('drafts/') && l.endsWith('.md'));
  } catch {
    // No commit yet, or no inbox repo — the reminder alone still gets through.
  }

  for (const file of touched) {
    const slug = basename(file).replace(/\.md$/, '');
    let body;
    try {
      body = readFileSync(join(INBOX, file), 'utf8');
    } catch {
      continue; // deleted in the same commit
    }

    // Body must never be exactly the capture marker, or fold-notes would
    // treat this issue as a new note and loop it back into the inbox.
    const issueBody = `Drafted from your inbox. Edit here or on the Mac — same file.\n\n---\n\n${body}`;

    try {
      const url = execFileSync('gh', [
        'issue', 'create', '--repo', REPO,
        '--title', `Draft ready: ${slug}`,
        '--body', issueBody,
      ], { encoding: 'utf8' }).trim();
      links.push(url);
    } catch (err) {
      console.error(`could not open an issue for ${slug}: ${String(err.message).split('\n')[0]}`);
    }
  }
}

/* ---------- the reminder ---------- */

// AppleScript string literals escape backslash and double quote, nothing else.
const as = (s) => String(s).replace(/\\/g, '\\\\').replace(/"/g, '\\"');

const note = [summary.trim(), ...links].filter(Boolean).join('\n\n');

const script = `
tell application "Reminders"
  if not (exists list "${as(LIST)}") then make new list with properties {name:"${as(LIST)}"}
  tell list "${as(LIST)}"
    make new reminder with properties {name:"${as(TITLES[job] ?? job)}", body:"${as(note)}", remind me date:(current date) + 30}
  end tell
end tell
`;

try {
  execFileSync('osascript', ['-'], { input: script, encoding: 'utf8' });
  console.log(`reminded${links.length ? ` · ${links.length} issue(s) opened` : ''}`);
} catch (err) {
  // Reminders scripting needs Automation permission; say so rather than fail quietly.
  console.error(`reminder failed — grant Automation access for Reminders: ${String(err.message).split('\n')[0]}`);
}
