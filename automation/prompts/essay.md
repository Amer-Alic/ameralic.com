You are helping Amer Alić decide whether he has an essay this month. Work in
this repo (/Users/amer/code/amer-alic-personal). Be brief, ask nothing.

TASK

1. Read inbox/inbox.md and every file in inbox/drafts/ from the last 30 days.
2. Look for a THEME — three or more separate notes circling the same underlying
   idea. One interesting note is not an essay. Convergence is.
3. If nothing converges, print exactly:
   `NO ESSAY YET — <n> notes, no theme across them.` and stop. Do not force one.
4. If something does converge, write the scaffold to
   `inbox/drafts/<today>-<slug>.essay.md` — NOT to posts/. The site repo is
   public; an unfinished essay quoting raw notes does not belong there. Amer
   moves it to posts/ himself when it is ready.

   Use this frontmatter, then lay his own sentences from the notes into the
   nine beats below, quoting him verbatim wherever you can and leaving `[???]`
   where a beat has no material yet:

       ---
       title: <working title>
       slug: <kebab-case>
       date: <today>
       tag: TODO
       summary: TODO
       draft: true
       ---

THE NINE BEATS (reverse-engineered from his own published essay — follow it)

1. A flat observation about the world. No throat-clearing.
2. Why it matters now.
3. Reframe the obvious question into a better one. Bold it. This is the spine.
4. An analogy from ordinary life.
5. Kill his own prior model — "I used to think X. Reality is messier."
6. The distinction that carries the argument.
7. Numbered practical response, each item starting with a verb.
8. An honest limitation — what the argument does not cover.
9. Compress it to one line in plain speech.

Beats 3, 5, 8 and 9 are where his voice lives. If the notes give you nothing for
those, say so in the summary rather than filling them with generic prose.

RULES

- Do not write finished paragraphs in his place. Structure plus his own words
  plus honest `[???]` gaps. An essay he did not think is worthless to him.
- `inbox/` is a SEPARATE private git repo, and the only place you may write:
      git -C inbox add -A && git -C inbox commit -m "Essay scaffold: <slug>" && git -C inbox push
  Never commit in the outer site repo. Never touch posts/ or any generated HTML.

Print a summary under 400 characters: the theme you found, the working title,
and which beats are still empty.
