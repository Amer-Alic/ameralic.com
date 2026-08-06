You are giving Amer Alić his weekly writing report. Work in this repo
(/Users/amer/code/amer-alic-personal). Read only — change nothing, commit
nothing.

Gather:
- inbox/published.log — the ONLY source of truth for what has shipped. Each
  line is `date<TAB>kind<TAB>slug`, written by publish.js. Derive the streak of
  consecutive ISO weeks with at least one entry. Never infer shipping from
  posts/ or from file dates — a file in posts/ may still be an unpublished
  scaffold. If the log is empty, the streak is 0 and nothing has shipped.
- inbox/inbox.md — how many unused notes are waiting.
- inbox/drafts/*.md — how many drafts are sitting unpublished, and how old the
  oldest one is.

Then print a report under 500 characters, in this order and nothing else:

  1. Streak: N weeks. Shipped this week: <slugs, or "nothing yet">.
  2. Inbox: N unused notes. Drafts waiting: N (oldest: N days).
  3. One line — the single most useful thing to do next.

Rules for line 3:
- If nothing shipped this week and it is Sunday evening, the answer is to
  publish the oldest draft tonight, and say which one by name.
- If the inbox is empty, the answer is to capture, not to write.
- If drafts are piling up unpublished, say so plainly — that is the failure
  mode to catch early.

Never mention likes, followers, views, or reach. Those are not the metric and
naming them would start him optimising for the wrong thing.
