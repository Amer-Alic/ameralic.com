// A small local interface for managing writing. Browser UI, no framework,
// bound to localhost only.
//
//   npm run studio        then open http://127.0.0.1:4321
//
// It can edit and delete files, so every path from the browser is resolved and
// checked against the two directories below before anything touches disk.

import { createServer } from 'node:http';
import { readFileSync, writeFileSync, readdirSync, unlinkSync, existsSync, statSync, mkdirSync } from 'node:fs';
import { execFileSync, spawnSync } from 'node:child_process';
import { join, dirname, resolve, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { marked } from 'marked';

const ROOT = dirname(fileURLToPath(import.meta.url));
const PORT = 4321;
const AREAS = {
  posts: join(ROOT, 'posts'),
  drafts: join(ROOT, 'inbox', 'drafts'),
};

/* ---------- safety ---------- */

// Only ever touch a .md file that resolves inside one of the two areas.
function safePath(rel) {
  if (typeof rel !== 'string' || !rel.endsWith('.md')) return null;
  const full = resolve(ROOT, rel);
  const ok = Object.values(AREAS).some((dir) => full.startsWith(dir + '/'));
  return ok && !basename(full).startsWith('.') ? full : null;
}

/* ---------- reading ---------- */

const field = (raw, key) => (raw.match(new RegExp(`^${key}:\\s*(.+)$`, 'm')) ?? [])[1]?.trim() ?? '';

function describe(area, file) {
  const full = join(AREAS[area], file);
  const raw = readFileSync(full, 'utf8');
  const body = raw.replace(/^---[\s\S]*?---/, '').replace(/<!--[\s\S]*?-->/g, '');
  const words = body.split(/\s+/).filter(Boolean).length;
  return {
    rel: (area === 'posts' ? 'posts/' : 'inbox/drafts/') + file,
    file,
    area,
    title: field(raw, 'title') || file.replace(/\.md$/, ''),
    slug: field(raw, 'slug') || file.replace(/\.md$/, ''),
    tag: field(raw, 'tag'),
    date: field(raw, 'date'),
    summary: field(raw, 'summary'),
    draft: /^draft:\s*true\s*$/im.test(raw),
    gaps: (raw.match(/\[\?\?\?/g) ?? []).length,
    words,
    readTime: Math.max(1, Math.ceil(words / 200)),
    modified: statSync(full).mtimeMs,
    search: (raw + ' ' + file).toLowerCase(),
  };
}

function allItems() {
  const out = [];
  for (const area of Object.keys(AREAS)) {
    let files = [];
    try {
      files = readdirSync(AREAS[area])
        .filter((f) => f.endsWith('.md') && f.toLowerCase() !== 'readme.md');
    } catch { continue; }
    for (const f of files) out.push(describe(area, f));
  }
  return out.sort((a, b) => b.modified - a.modified);
}

function inboxNotes() {
  try {
    return readFileSync(join(ROOT, 'inbox', 'inbox.md'), 'utf8')
      .split('\n')
      .filter((l) => l.startsWith('- '))
      .map((l, i) => ({ i, text: l.replace(/^- /, '').replace(/ \[used\]$/, ''), used: l.includes('[used]') }))
      .reverse();
  } catch { return []; }
}

function streak() {
  try {
    const log = readFileSync(join(ROOT, 'inbox', 'published.log'), 'utf8')
      .split('\n').filter((l) => l.trim() && !l.startsWith('#'));
    return log.length;
  } catch { return 0; }
}

/* ---------- server ---------- */

const json = (res, code, data) => {
  res.writeHead(code, { 'content-type': 'application/json' });
  res.end(JSON.stringify(data));
};

const readBody = (req) => new Promise((ok) => {
  let b = '';
  req.on('data', (c) => { b += c; });
  req.on('end', () => { try { ok(JSON.parse(b || '{}')); } catch { ok({}); } });
});

const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);

  if (url.pathname === '/') {
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    return res.end(PAGE);
  }

  if (url.pathname === '/api/items') {
    return json(res, 200, { items: allItems(), notes: inboxNotes(), published: streak() });
  }

  if (url.pathname === '/api/file') {
    const full = safePath(url.searchParams.get('path'));
    if (!full || !existsSync(full)) return json(res, 404, { error: 'not found' });
    const raw = readFileSync(full, 'utf8');
    const body = raw.replace(/^---[\s\S]*?---\s*/, '').replace(/<!--\s*social[\s\S]*?-->/i, '');
    return json(res, 200, { raw, html: marked.parse(body) });
  }

  if (url.pathname === '/api/save' && req.method === 'POST') {
    const { path, content } = await readBody(req);
    const full = safePath(path);
    if (!full) return json(res, 400, { error: 'bad path' });
    writeFileSync(full, content);
    return json(res, 200, { ok: true });
  }

  if (url.pathname === '/api/delete' && req.method === 'POST') {
    const { path } = await readBody(req);
    const full = safePath(path);
    if (!full || !existsSync(full)) return json(res, 400, { error: 'bad path' });
    unlinkSync(full);
    return json(res, 200, { ok: true });
  }

  if (url.pathname === '/api/new' && req.method === 'POST') {
    const { title, kind } = await readBody(req);
    if (!title?.trim()) return json(res, 400, { error: 'title required' });
    const args = ['new.js', title.trim()];
    if (kind !== 'essay') args.push('--short');
    const r = spawnSync(process.execPath, args, { cwd: ROOT, encoding: 'utf8' });
    const created = (r.stdout ?? '').match(/created (.+)/)?.[1]?.trim();
    if (!created) return json(res, 500, { error: (r.stderr || r.stdout || 'failed').trim() });
    return json(res, 200, { path: created });
  }

  if (url.pathname === '/api/publish' && req.method === 'POST') {
    const { slug } = await readBody(req);
    if (!slug) return json(res, 400, { error: 'slug required' });
    const r = spawnSync(process.execPath, ['publish.js', slug], { cwd: ROOT, encoding: 'utf8' });
    return json(res, 200, { output: ((r.stdout ?? '') + (r.stderr ?? '')).trim() });
  }

  if (url.pathname === '/api/render' && req.method === 'POST') {
    const r = spawnSync(process.execPath, ['render.js'], { cwd: ROOT, encoding: 'utf8' });
    return json(res, 200, { output: ((r.stdout ?? '') + (r.stderr ?? '')).trim() });
  }

  res.writeHead(404);
  res.end('not found');
});

/* ---------- the page ---------- */

const PAGE = `<!DOCTYPE html>
<html lang="en"><head>
<meta charset="utf-8"><title>Writing</title>
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>
  :root { --line:#e6e4df; --dim:#6b6862; --bg:#fbfaf8; --accent:#1a5fb4; --warn:#a15c00; }
  * { box-sizing:border-box; }
  body { margin:0; font:15px/1.55 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;
         color:#1b1a18; background:var(--bg); display:grid; grid-template-columns:340px 1fr; height:100vh; }
  aside { border-right:1px solid var(--line); display:flex; flex-direction:column; min-height:0; }
  .top { padding:14px; border-bottom:1px solid var(--line); display:flex; gap:8px; }
  input[type=search] { flex:1; padding:8px 10px; border:1px solid var(--line); border-radius:7px;
                       font:inherit; background:#fff; }
  button { font:inherit; padding:8px 12px; border:1px solid var(--line); border-radius:7px;
           background:#fff; cursor:pointer; }
  button:hover { border-color:#c9c6c0; }
  button.primary { background:#1b1a18; color:#fff; border-color:#1b1a18; }
  button.danger:hover { color:#b3261e; border-color:#b3261e; }
  .list { overflow:auto; flex:1; }
  .group { padding:14px 14px 4px; font-size:11px; letter-spacing:.09em; text-transform:uppercase;
           color:var(--dim); }
  .item { padding:9px 14px; border-left:3px solid transparent; cursor:pointer; }
  .item:hover { background:#f2f0ec; }
  .item.on { background:#edeae4; border-left-color:#1b1a18; }
  .item h4 { margin:0 0 2px; font-size:14px; font-weight:600; }
  .meta { font-size:12px; color:var(--dim); }
  .pill { font-size:11px; padding:1px 6px; border-radius:20px; background:#eceae5; margin-left:6px; }
  .pill.warn { background:#fdf0dc; color:var(--warn); }
  .pill.ok { background:#e3f0e4; color:#2c6e31; }
  main { display:flex; flex-direction:column; min-width:0; min-height:0; }
  .bar { padding:12px 18px; border-bottom:1px solid var(--line); display:flex; gap:8px;
         align-items:center; flex-wrap:wrap; }
  .bar h2 { margin:0; font-size:16px; flex:1; min-width:200px; }
  .tools { display:flex; gap:4px; align-items:center; padding:7px 18px;
           border-bottom:1px solid var(--line); background:#fff; flex-wrap:wrap; }
  .tools button { padding:4px 9px; min-width:32px; font-size:13px; border-color:transparent; }
  .tools button:hover { background:#f2f0ec; border-color:var(--line); }
  .tools .sep { width:1px; height:18px; background:var(--line); margin:0 5px; }
  textarea { flex:1; width:100%; padding:24px 28px; border:0; resize:none; outline:none;
             font:14px/1.7 ui-monospace,SFMono-Regular,Menlo,monospace; background:var(--bg); }
  .preview { flex:1; overflow:auto; padding:24px 28px; max-width:46rem; }
  .preview h2 { font-size:19px; margin:1.6em 0 .5em; }
  .preview blockquote { border-left:3px solid var(--line); margin:1.2em 0; padding-left:1em; color:var(--dim); }
  .empty { margin:auto; color:var(--dim); }
  .status { padding:8px 18px; border-top:1px solid var(--line); font-size:12px; color:var(--dim);
            display:flex; gap:14px; }
  .notes { padding:6px 14px 18px; }
  .note { font-size:12.5px; color:var(--dim); padding:5px 0; border-bottom:1px solid var(--line); }
  .note.used { text-decoration:line-through; opacity:.5; }
  dialog { border:1px solid var(--line); border-radius:12px; padding:20px; min-width:340px; }
  dialog input, dialog select { width:100%; padding:8px; margin:6px 0 14px; border:1px solid var(--line);
                                border-radius:7px; font:inherit; }
  pre.out { white-space:pre-wrap; font:12px/1.5 ui-monospace,monospace; background:#f2f0ec;
            padding:12px; border-radius:8px; max-height:40vh; overflow:auto; }
</style></head><body>

<aside>
  <div class="top">
    <input type="search" id="q" placeholder="Search…" autofocus>
    <button id="new" title="New post">+</button>
  </div>
  <div class="list" id="list"></div>
</aside>

<main>
  <div class="bar">
    <h2 id="title">Nothing selected</h2>
    <button id="mode">Preview</button>
    <button id="save">Save</button>
    <button id="publish" class="primary">Publish</button>
    <button id="del" class="danger">Delete</button>
  </div>
  <div class="tools" id="tools">
    <button data-p="## " title="Heading (⌘2)">H2</button>
    <button data-p="### " title="Sub-heading (⌘3)">H3</button>
    <span class="sep"></span>
    <button data-w="**" title="Bold (⌘B)"><b>B</b></button>
    <button data-w="*" title="Italic (⌘I)"><i>I</i></button>
    <button data-w="&lt;u&gt;|&lt;/u&gt;" title="Underline (⌘U)"><u>U</u></button>
    <span class="sep"></span>
    <button data-link="1" title="Link (⌘K)">Link</button>
    <button data-p="> " title="Quote">&ldquo;</button>
    <button data-p="- " title="Bullet list">&bull;</button>
    <button data-p="1. " title="Numbered list">1.</button>
    <span class="sep"></span>
    <button data-ins="[??? ]" title="Mark a gap to fill later">[???]</button>
  </div>
  <textarea id="editor" spellcheck="true" placeholder="Pick something on the left, or press + to start."></textarea>
  <div class="preview" id="preview" hidden></div>
  <div class="status" id="status"></div>
</main>

<dialog id="newDlg">
  <form method="dialog">
    <label>Title<input id="newTitle" placeholder="What is it about?"></label>
    <label>Kind<select id="newKind">
      <option value="short">Short post</option>
      <option value="essay">Essay</option>
    </select></label>
    <menu style="display:flex;gap:8px;justify-content:flex-end">
      <button value="cancel">Cancel</button>
      <button value="ok" class="primary" id="newGo">Create</button>
    </menu>
  </form>
</dialog>

<dialog id="outDlg">
  <h3 style="margin-top:0">Published</h3>
  <pre class="out" id="outText"></pre>
  <form method="dialog" style="text-align:right"><button class="primary">Close</button></form>
</dialog>

<script>
let data = { items: [], notes: [], published: 0 };
let current = null, dirty = false, previewing = false;
const $ = (id) => document.getElementById(id);

async function load() {
  data = await (await fetch('/api/items')).json();
  draw();
}

function draw() {
  const q = $('q').value.trim().toLowerCase();
  const hit = (i) => !q || i.search.includes(q);
  const groups = [
    ['Ready to publish', data.items.filter((i) => hit(i) && !i.draft && !i.gaps)],
    ['Needs work', data.items.filter((i) => hit(i) && (i.draft || i.gaps))],
  ];
  let html = '';
  for (const [name, items] of groups) {
    if (!items.length) continue;
    html += '<div class="group">' + name + ' · ' + items.length + '</div>';
    for (const i of items) {
      const pills = (i.gaps ? '<span class="pill warn">' + i.gaps + ' gaps</span>' : '')
        + (i.draft ? '<span class="pill warn">draft</span>' : '')
        + (!i.draft && !i.gaps ? '<span class="pill ok">ready</span>' : '');
      html += '<div class="item' + (current === i.rel ? ' on' : '') + '" data-p="' + i.rel + '">'
        + '<h4>' + esc(i.title) + '</h4>'
        + '<div class="meta">' + (i.area === 'posts' ? 'essay' : 'short') + ' · '
        + i.words + ' words' + pills + '</div></div>';
    }
  }
  if (!q && data.notes.length) {
    html += '<div class="group">Inbox · ' + data.notes.filter((n) => !n.used).length + ' unused</div><div class="notes">';
    for (const n of data.notes.slice(0, 12)) {
      html += '<div class="note' + (n.used ? ' used' : '') + '">' + esc(n.text) + '</div>';
    }
    html += '</div>';
  }
  $('list').innerHTML = html || '<div class="group">No matches</div>';
  for (const el of document.querySelectorAll('.item')) {
    el.onclick = () => open(el.dataset.p);
  }
  $('status').textContent = data.items.length + ' pieces · ' + data.published + ' published';
}

const esc = (s) => s.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));

async function open(path) {
  if (dirty && !confirm('Unsaved changes. Discard them?')) return;
  const r = await (await fetch('/api/file?path=' + encodeURIComponent(path))).json();
  if (r.error) return alert(r.error);
  current = path; dirty = false; previewing = false;
  $('editor').value = r.raw;
  $('editor').hidden = false; $('preview').hidden = true; $('mode').textContent = 'Preview';
  const it = data.items.find((i) => i.rel === path);
  $('title').textContent = it ? it.title : path;
  draw();
}

$('q').oninput = draw;
$('editor').oninput = () => { dirty = true; };

/* ---- formatting ---- */

const ed = $('editor');
const touched = () => { dirty = true; ed.focus(); };

// Wrap the selection, or unwrap it if the marks are already there.
function wrap(mark) {
  const [open, close] = mark.includes('|') ? mark.split('|') : [mark, mark];
  const s = ed.selectionStart, e = ed.selectionEnd;
  const before = ed.value.slice(Math.max(0, s - open.length), s);
  const after = ed.value.slice(e, e + close.length);
  if (before === open && after === close) {
    const sel = ed.value.slice(s, e);
    ed.setRangeText(sel, s - open.length, e + close.length);
    ed.selectionStart = s - open.length; ed.selectionEnd = e - open.length;
  } else {
    ed.setRangeText(open + ed.value.slice(s, e) + close, s, e);
    ed.selectionStart = s + open.length; ed.selectionEnd = e + open.length;
  }
  touched();
}

// Add or remove a line prefix across every line the selection touches.
function prefix(mark) {
  const v = ed.value;
  const from = v.lastIndexOf('\\n', ed.selectionStart - 1) + 1;
  let to = v.indexOf('\\n', ed.selectionEnd);
  if (to === -1) to = v.length;
  const lines = v.slice(from, to).split('\\n');
  const strip = /^(#{1,6} |> |- |\\d+\\. )/;
  const has = lines.every((l) => l.startsWith(mark));
  const out = lines.map((l, i) => {
    const bare = l.replace(strip, '');
    if (has) return bare;
    return (mark === '1. ' ? (i + 1) + '. ' : mark) + bare;
  }).join('\\n');
  ed.setRangeText(out, from, to);
  ed.selectionStart = from; ed.selectionEnd = from + out.length;
  touched();
}

function insert(text) {
  const s = ed.selectionStart;
  ed.setRangeText(text, s, ed.selectionEnd);
  ed.selectionStart = ed.selectionEnd = s + text.length;
  touched();
}

function link() {
  const s = ed.selectionStart, e = ed.selectionEnd;
  const sel = ed.value.slice(s, e) || 'text';
  const url = prompt('Link to:', 'https://');
  if (!url) return;
  ed.setRangeText('[' + sel + '](' + url + ')', s, e);
  ed.selectionStart = s + 1; ed.selectionEnd = s + 1 + sel.length;
  touched();
}

for (const b of document.querySelectorAll('#tools button')) {
  b.onmousedown = (e) => e.preventDefault(); // keep the selection
  b.onclick = () => {
    if (b.dataset.w) return wrap(b.dataset.w);
    if (b.dataset.p) return prefix(b.dataset.p);
    if (b.dataset.link) return link();
    if (b.dataset.ins) return insert(b.dataset.ins);
  };
}

$('mode').onclick = async () => {
  if (!current) return;
  previewing = !previewing;
  if (previewing) {
    const r = await (await fetch('/api/file?path=' + encodeURIComponent(current))).json();
    $('preview').innerHTML = r.html;
  }
  $('preview').hidden = !previewing;
  $('editor').hidden = previewing;
  $('mode').textContent = previewing ? 'Edit' : 'Preview';
};

async function save() {
  if (!current) return;
  await fetch('/api/save', { method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ path: current, content: $('editor').value }) });
  dirty = false;
  await load();
}
$('save').onclick = save;

document.addEventListener('keydown', (e) => {
  if (!(e.metaKey || e.ctrlKey)) return;
  const inEditor = document.activeElement === ed;
  const hit = {
    s: () => save(),
    b: () => inEditor && wrap('**'),
    i: () => inEditor && wrap('*'),
    u: () => inEditor && wrap('<u>|</u>'),
    k: () => inEditor && link(),
    1: () => inEditor && prefix('# '),
    2: () => inEditor && prefix('## '),
    3: () => inEditor && prefix('### '),
  }[e.key.toLowerCase()];
  if (hit) { e.preventDefault(); hit(); }
});

$('del').onclick = async () => {
  if (!current) return;
  const it = data.items.find((i) => i.rel === current);
  if (!confirm('Delete "' + (it ? it.title : current) + '" permanently?')) return;
  await fetch('/api/delete', { method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ path: current }) });
  current = null; dirty = false;
  $('editor').value = ''; $('title').textContent = 'Nothing selected';
  await load();
};

$('publish').onclick = async () => {
  if (!current) return;
  const it = data.items.find((i) => i.rel === current);
  if (!it) return;
  if (it.gaps && !confirm(it.gaps + ' unfilled gaps. Publish anyway?')) return;
  if (dirty) await save();
  const r = await (await fetch('/api/publish', { method: 'POST',
    headers: { 'content-type': 'application/json' }, body: JSON.stringify({ slug: it.slug }) })).json();
  $('outText').textContent = r.output || r.error || 'no output';
  $('outDlg').showModal();
  await load();
};

$('new').onclick = () => { $('newTitle').value = ''; $('newDlg').showModal(); };
$('newDlg').addEventListener('close', async () => {
  if ($('newDlg').returnValue !== 'ok') return;
  const title = $('newTitle').value.trim();
  if (!title) return;
  const r = await (await fetch('/api/new', { method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ title, kind: $('newKind').value }) })).json();
  if (r.error) return alert(r.error);
  await load();
  await open(r.path);
});

load();
</script></body></html>`;

server.listen(PORT, '127.0.0.1', () => {
  console.log(`writing studio → http://127.0.0.1:${PORT}`);
  console.log('ctrl-c to stop');
});
