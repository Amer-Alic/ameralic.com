// Generates the "Capture Note" iOS Shortcut as a signable plist.
//
//   node automation/make-shortcut.js     writes and signs automation/build/
//
// Note: `shortcuts sign` refuses an input file named *.plist — the unsigned
// workflow has to carry a different extension, hence the .unsigned.shortcut.
//
// Two actions: dictate, then POST a GitHub issue. Deliberately not a
// read-modify-write against notes/inbox.md — two captures in quick succession
// would race on the file sha and one would be lost.

import { writeFileSync, mkdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'automation', 'build');

const REPO = 'Amer-Alic/writing-inbox';
// Read from the environment so the token never lands in a tracked file:
//   GITHUB_CAPTURE_TOKEN=github_pat_… node automation/make-shortcut.js
// Without it, the built shortcut carries a placeholder you edit in Shortcuts.
const TOKEN = process.env.GITHUB_CAPTURE_TOKEN || 'REPLACE_WITH_TOKEN';
const BODY_MARKER = 'capture'; // how the fold step recognises its own issues
const DICTATE_UUID = 'C4A7B1E0-0000-4000-8000-000000000001';

/* ---------- plist helpers ---------- */

const esc = (s) => String(s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const indent = (s, n) => s.split('\n').map((l) => (l ? ' '.repeat(n) + l : l)).join('\n');

// A plain string parameter.
const text = (s) => `<dict>
  <key>Value</key>
  <dict>
    <key>string</key><string>${esc(s)}</string>
  </dict>
  <key>WFSerializationType</key><string>WFTextTokenString</string>
</dict>`;

// A string parameter that is entirely the output of a previous action.
// U+FFFC (object replacement character) marks the attachment position.
const fromAction = (uuid) => `<dict>
  <key>Value</key>
  <dict>
    <key>attachmentsByRange</key>
    <dict>
      <key>{0, 1}</key>
      <dict>
        <key>OutputUUID</key><string>${uuid}</string>
        <key>Type</key><string>ActionOutput</string>
      </dict>
    </dict>
    <key>string</key><string>￼</string>
  </dict>
  <key>WFSerializationType</key><string>WFTextTokenString</string>
</dict>`;

// key/value pairs for WFHTTPHeaders and WFJSONValues.
const dictionary = (pairs) => `<dict>
  <key>Value</key>
  <dict>
    <key>WFDictionaryFieldValueItems</key>
    <array>
${pairs.map(([k, v]) => indent(`<dict>
  <key>WFItemType</key><integer>0</integer>
  <key>WFKey</key>
${indent(text(k), 2)}
  <key>WFValue</key>
${indent(v, 2)}
</dict>`, 6)).join('\n')}
    </array>
  </dict>
  <key>WFSerializationType</key><string>WFDictionaryFieldValue</string>
</dict>`;

const action = (identifier, params) => `<dict>
  <key>WFWorkflowActionIdentifier</key><string>${identifier}</string>
  <key>WFWorkflowActionParameters</key>
  <dict>
${params.map(([k, v]) => indent(`<key>${k}</key>\n${v}`, 4)).join('\n')}
  </dict>
</dict>`;

/* ---------- the two actions ---------- */

const dictate = action('is.workflow.actions.dictatetext', [
  ['UUID', `<string>${DICTATE_UUID}</string>`],
  ['WFSpeechLanguage', '<string>en-US</string>'],
  ['WFDictateTextStopListening', '<string>After Pause</string>'],
]);

const post = action('is.workflow.actions.downloadurl', [
  ['WFHTTPMethod', '<string>POST</string>'],
  ['WFURL', `<string>https://api.github.com/repos/${REPO}/issues</string>`],
  ['WFHTTPBodyType', '<string>JSON</string>'],
  ['ShowHeaders', '<true/>'],
  ['WFHTTPHeaders', dictionary([
    ['Authorization', text(`Bearer ${TOKEN}`)],
    ['Accept', text('application/vnd.github+json')],
  ])],
  ['WFJSONValues', dictionary([
    ['title', fromAction(DICTATE_UUID)],
    ['body', text(BODY_MARKER)],
  ])],
]);

/* ---------- the workflow ---------- */

const plist = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>WFWorkflowClientVersion</key><string>2607</string>
  <key>WFWorkflowMinimumClientVersion</key><integer>900</integer>
  <key>WFWorkflowMinimumClientVersionString</key><string>900</string>
  <key>WFWorkflowHasOutputFallback</key><false/>
  <key>WFWorkflowHasShortcutInputVariables</key><false/>
  <key>WFWorkflowIcon</key>
  <dict>
    <key>WFWorkflowIconGlyphNumber</key><integer>59511</integer>
    <key>WFWorkflowIconStartColor</key><integer>2071128575</integer>
  </dict>
  <key>WFWorkflowImportQuestions</key><array/>
  <key>WFWorkflowInputContentItemClasses</key>
  <array>
    <string>WFAppStoreAppContentItem</string>
    <string>WFStringContentItem</string>
    <string>WFURLContentItem</string>
  </array>
  <key>WFWorkflowTypes</key><array/>
  <key>WFWorkflowActions</key>
  <array>
${indent(dictate, 4)}
${indent(post, 4)}
  </array>
</dict>
</plist>
`;

mkdirSync(OUT, { recursive: true });
const unsigned = join(OUT, 'CaptureNote.unsigned.shortcut');
const signed = join(OUT, 'CaptureNote.shortcut');
writeFileSync(unsigned, plist);

execFileSync('plutil', ['-lint', unsigned], { stdio: 'ignore' });
execFileSync('shortcuts', ['sign', '-m', 'anyone', '-i', unsigned, '-o', signed]);

const rel = (p) => p.replace(ROOT + '/', '');
console.log(`signed ${rel(signed)}`);
console.log(`\nopen "${rel(signed)}"   then click Add Shortcut`);
