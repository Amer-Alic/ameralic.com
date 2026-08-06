#!/bin/zsh
# Runs one writing-automation prompt through Claude and notifies the result.
# Invoked by the launchd agents in this folder. Usage: run.sh draft|essay|review

set -u
REPO="/Users/amer/code/amer-alic-personal"
JOB="${1:?usage: run.sh draft|essay|review}"
PROMPT="$REPO/automation/prompts/$JOB.md"
LOG="$REPO/automation/last-$JOB.log"

export PATH="$HOME/.local/bin:/opt/homebrew/bin:/usr/local/bin:$PATH"

[[ -f "$PROMPT" ]] || { echo "no prompt at $PROMPT"; exit 1; }

cd "$REPO" || exit 1

# Pull first so the agent never drafts against a stale inbox.
git pull --quiet --rebase 2>/dev/null
[[ -d inbox/.git ]] && git -C inbox pull --quiet --rebase 2>/dev/null

# Captured notes arrive as issues on the private inbox repo. Fold them in
# before drafting so the agent sees everything said since the last run.
if [[ "$JOB" != "review" ]]; then
  node automation/fold-notes.js 2>&1 | tail -2
fi

# Scoped rather than bypassed: these jobs run unattended, so they get exactly
# the tools they need and nothing that could touch the published site.
OUT=$(claude -p "$(cat "$PROMPT")" \
  --permission-mode acceptEdits \
  --allowedTools 'Bash(git:*),Bash(node:*),Read,Edit,Write,Glob,Grep' 2>&1)
STATUS=$?

print -r -- "$(date '+%Y-%m-%d %H:%M') [$JOB] exit=$STATUS" > "$LOG"
print -r -- "$OUT" >> "$LOG"

# Last few lines are the agent's summary; that is what goes to the phone.
SUMMARY=$(print -r -- "$OUT" | tail -c 400 | tr '\n' ' ' | sed 's/"/\\"/g')
[[ -z "${SUMMARY// }" ]] && SUMMARY="finished with no output (exit $STATUS)"

# A banner if you happen to be at the Mac, plus a Reminder and a GitHub issue,
# which are the ones that survive not being at the Mac.
osascript -e "display notification \"$SUMMARY\" with title \"Writing: $JOB\" sound name \"Ping\"" 2>/dev/null
node automation/notify.js "$JOB" "$SUMMARY" 2>&1 | tail -2

exit $STATUS
