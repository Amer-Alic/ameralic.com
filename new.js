// Scaffolds a new post from the essay skeleton.
//
//   npm run new -- "The Work Isn't Done Until It's Legible"
//   npm run new -- "Quick thought about agents" --short

import { writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const short = args.includes('--short');
const title = args.filter((a) => !a.startsWith('--')).join(' ').trim();

if (!title) {
  console.error('usage: npm run new -- "Post title" [--short]');
  process.exit(1);
}

const slug = title
  .toLowerCase()
  .replace(/['’]/g, '')
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-|-$/g, '')
  .slice(0, 70);

const today = new Date().toISOString().slice(0, 10);
const dir = short ? join('inbox', 'drafts') : 'posts';
const file = `${today}-${slug}.md`;
const path = join(ROOT, dir, file);

if (!existsSync(join(ROOT, dir))) mkdirSync(join(ROOT, dir), { recursive: true });
if (existsSync(path)) {
  console.error(`${dir}/${file} already exists.`);
  process.exit(1);
}

// A short post never gets a page on the site, so there is nothing to link to.
// Only essays carry the URL.
const link = short ? '' : `\nhttps://ameralic.com/${slug}.html\n`;

const social = `<!--social
x:
[One claim, first line. No wind-up. Compress, don't summarise.]

[Optional second beat.]
${link}
---
linkedin:
[Open with the correction or the concrete detail — the first two lines are all
that shows before "see more".]

[Room to breathe here. Short paragraphs, single line breaks.]

[Close by compressing the idea, not by asking a question.]
${link}-->
`;

const essay = `---
title: ${title}
slug: ${slug}
date: ${today}
tag: TODO
summary: TODO — one sentence. Reused for the index, meta description, OG card, and RSS.
draft: true
---

<!--
The nine beats. Delete this comment as you fill them in; skip any that fight
the piece. Beats 3, 5, 8 and 9 are the ones that sound like you — keep those.

1. A flat observation about the world. No throat-clearing.
2. Why it matters now.
3. Reframe the obvious question into a better one. Bold it. This is the spine.
4. An analogy from ordinary life.
5. Kill your own prior model — "I used to think X. Reality is messier."
6. The distinction that carries the argument.
7. Numbered practical response. Each item starts with a verb.
8. An honest limitation. What your argument does not cover.
9. Compress it to one line in plain speech.
-->

[Beat 1 goes here.]

${social}`;

const shortPost = `---
title: ${title}
slug: ${slug}
date: ${today}
---

<!--
Pick ONE shape before writing. Delete the rest.

  CORRECTION  I believed X → what actually happened → what I do now.
  NUMBER      One real metric → what it changed → what it cost.
  DECISION    The fork → the option I rejected and why → what it cost me.
  MECHANISM   How one thing works, in enough detail that someone could copy it.
-->

${social}`;

writeFileSync(path, short ? shortPost : essay);
console.log(`created ${dir}/${file}`);
console.log(short
  ? `\nwrite it, then:  npm run publish -- ${today}-${slug}`
  : `\nwrite it, remove "draft: true", then:  npm run publish -- ${slug}`);
