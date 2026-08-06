# How this site gets written

Capture is daily and takes seconds. Publishing is one command. The only step
that needs you thinking is approving a draft — that is deliberate.

```
  phone            GitHub issue        Mac, Tue/Thu           you
  ─────            ────────────        ────────────           ───
  Action Button ──▶ writing-inbox ──▶ inbox/inbox.md ──▶ inbox/drafts/*.md
   (dictate)         (private)         fold-notes.js       + notification
                                                                 │
                                                                 ▼
                                                        npm run publish
                                                                 │
                                              ┌──────────────────┴────────┐
                                              ▼                           ▼
                                       ameralic.com              X / LinkedIn
                                      (public repo)              (paste, manual)
```

## Two repos, on purpose

| | Repo | Holds |
|---|---|---|
| **Public** | `Amer-Alic/ameralic.com` | `posts/`, the generated site, the tooling |
| **Private** | `Amer-Alic/writing-inbox` | raw notes, unfinished drafts, publish log |

The private repo is checked out at `inbox/` inside this one and is gitignored
here. Half-formed thoughts about client work do not belong in a public
repository — only finished posts cross that line.

## Daily — capture

Press the Action Button, say the thought, done. The Shortcut opens an issue on
`writing-inbox` with the dictation as the title.

It files an issue rather than editing a file directly so two captures in quick
succession can't race each other and lose one.

Best slot: the walk or drive back from training. Mind clear, hands free, and
that time already exists in your day.

## Tue & Thu 07:34 — drafts arrive

`fold-notes.js` pulls open capture issues into `inbox/inbox.md` and closes them.
Then an agent picks the one or two notes with real substance and turns each into
a short-post draft in `inbox/drafts/`, commits, pushes, and notifies you.

It restructures **your** words. Where a note is too thin it leaves `[???]`
rather than inventing a claim you never made — and where a note is only an
intention rather than a formed thought, it writes nothing and says so. If you
ever see invented specifics, that is a bug — tighten `automation/prompts/draft.md`.

### How it reaches you

Three ways, because a banner alone is too easy to miss:

| | What | Where |
|---|---|---|
| **Alert** | A reminder in the **Writing** list, with the summary and issue links | Syncs to the phone, stays until you tick it off |
| **Content** | One GitHub issue per draft, `Draft ready: <slug>`, full text in the body | Readable and editable in the GitHub app |
| **Banner** | Notification Center, if you happen to be at the Mac | Disappears |

The reminder is the one that works, precisely because it nags. GitHub does not
push notifications for your own activity, so the issue is the container, not
the alert.

Reminders scripting needs Automation permission — granted already, but if a job
ever reports `reminder failed`, re-grant it under System Settings → Privacy &
Security → Automation.

## Fri 18:07 — essay check

Looks for three or more notes circling the same idea. Convergence is an essay;
one interesting note is not. If nothing converges it says so and writes nothing.
When something does, it scaffolds `inbox/drafts/<date>-<slug>.essay.md` against
the nine beats with your own sentences slotted in and `[???]` where a beat has
no material yet.

It writes to the private repo, not to `posts/` — an unfinished essay quoting raw
notes should not be public. When it is ready, move it across yourself:

```sh
mv inbox/drafts/<file>.essay.md posts/<file>.md   # then remove draft: true
```

## Sun 20:12 — the week

Streak, inbox depth, drafts waiting, and the single most useful next thing.
Deliberately never reports likes, followers, or reach — you would start writing
for them within a month.

## Publishing

```sh
npm run new -- "A Title"              # scaffold an essay in posts/
npm run new -- "A Thought" --short    # scaffold a short post in inbox/drafts/
npm run render                        # rebuild the site
npm run check                         # rebuild in memory, report differences only
npm run publish -- <slug>             # render, commit, push, hand you the social copy
npm run publish -- <slug> --dry       # everything except git
```

`publish` refuses while a post still has `draft: true`. It renders, pushes (live
in about a minute), copies the X version to your clipboard, prints the LinkedIn
version, saves both to `inbox/drafts/<slug>.social.txt`, and appends to
`inbox/published.log`.

Posting stays manual. X wants one compressed claim; LinkedIn wants the first two
lines to carry the rest. The same text in both places reads as cross-posting.

## Writing a post

`posts/*.md` — frontmatter, Markdown, then an optional `<!--social -->` block
holding the X and LinkedIn versions. One idea, one file.

```markdown
---
title: The Work Isn't Done Until It's Legible
slug: work-isnt-done-until-its-legible
date: 2026-08-29
tag: Craft
summary: One sentence. Reused for the index, meta description, OG card, and RSS.
---
```

`draft: true` keeps it off the site until you remove the line.

Read time is computed, the index and sitemap and RSS regenerate themselves, and
JSON-LD is written per post. Straight quotes become typographic ones — write
`"like this"` and the site renders it properly.

### The nine beats

Reverse-engineered from *What Makes Work Valuable in the Age of AI?* — already
your structure, written down so you can reuse it on purpose.

1. A flat observation about the world. No throat-clearing.
2. Why it matters now.
3. Reframe the obvious question into a better one. **Bold it.** This is the spine.
4. An analogy from ordinary life.
5. Kill your own prior model — *"I used to think X. Reality is messier."*
6. The distinction that carries the argument.
7. Numbered practical response, each item starting with a verb.
8. An honest limitation. What the argument does not cover.
9. Compress it to one line in plain speech.

Beats 3, 5, 8 and 9 are the ones that sound like you. Keep those; vary the rest.

### The four short shapes

Pick one *before* writing, never after.

| Shape | Structure |
|---|---|
| **Correction** | I believed X → what actually happened → what I do now |
| **Number** | One real metric → what it changed → what it cost |
| **Decision** | The fork → the option I rejected and why → what it cost me |
| **Mechanism** | How one thing works, in enough detail that someone could copy it |

First line is the claim. Last line compresses. Never end on a question.

## Installing the Shortcut

Built, signed, and carrying a working token — `automation/build/CaptureNote.shortcut`.

1. `open automation/build/CaptureNote.shortcut`, then click **Add Shortcut** in
   the dialog. Closing that window discards the import; the button is the step.
2. It syncs to the iPhone over iCloud within a minute.
3. On the iPhone: Settings → Action Button → Shortcut → Capture Note. Add it to
   Siri as "note idea" while you are there.

To rebuild it — after rotating the token, or changing the repo or request shape:

```sh
GITHUB_CAPTURE_TOKEN=github_pat_… node automation/make-shortcut.js
```

The token is read from the environment and only ever written into
`automation/build/`, which is gitignored. Omit the variable and the build falls
back to a `REPLACE_WITH_TOKEN` placeholder you edit inside Shortcuts instead.

The token needs exactly one permission: **Issues: read and write**, scoped to
`Amer-Alic/writing-inbox` and nothing else.

If the import ever misbehaves, the shortcut is only two actions and takes about
two minutes to rebuild by hand: **Dictate Text**, then **Get Contents of URL**
POSTing to `https://api.github.com/repos/Amer-Alic/writing-inbox/issues` with
headers `Authorization: Bearer <token>` and `Accept: application/vnd.github+json`,
and a JSON body of `title` = the dictated text, `body` = `capture`.

## The automation

```sh
./automation/install.sh           # load the three launchd agents
./automation/install.sh --remove  # unload and delete them
./automation/run.sh review        # run one now, without waiting
node automation/fold-notes.js --dry   # see what capture issues are waiting
```

Prompts live in `automation/prompts/`. The last run of each is in
`automation/last-<job>.log`. The agents run with a scoped tool allowlist — git,
node, and file edits — and only ever commit inside `inbox/`, except the essay
job which may add a scaffold to `posts/`. None of them publish; that stays your
call.

Jobs run on the Mac. If it is asleep when one is due, launchd runs it on wake.

## Later, if the habit sticks

- Scheduling X and LinkedIn through Buffer, so `publish` queues instead of
  copying to the clipboard. About 30 minutes.
- Generated OG images — shares currently render without artwork.
- Verify the domain in Google Search Console and submit `sitemap.xml`.
