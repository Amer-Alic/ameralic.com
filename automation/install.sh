#!/bin/zsh
# Installs (or removes) the three writing agents as launchd jobs.
#
#   ./automation/install.sh            install and load
#   ./automation/install.sh --remove   unload and delete
#
# launchd, not cron: it survives reboots and runs a job on wake if the Mac was
# asleep when it was due.

set -eu
REPO="/Users/amer/code/amer-alic-personal"
AGENTS="$HOME/Library/LaunchAgents"
RUN="$REPO/automation/run.sh"

# job | hour | minute | weekdays (0=Sun)
JOBS=(
  "draft|7|34|2 4"
  "essay|18|7|5"
  "review|20|12|0"
)

unload() {
  local label="$1"
  launchctl bootout "gui/$UID/$label" 2>/dev/null || launchctl unload "$AGENTS/$label.plist" 2>/dev/null || true
  rm -f "$AGENTS/$label.plist"
}

if [[ "${1:-}" == "--remove" ]]; then
  for entry in $JOBS; do
    unload "com.ameralic.writing.${entry%%|*}"
  done
  echo "removed."
  exit 0
fi

chmod +x "$RUN"
mkdir -p "$AGENTS"

for entry in $JOBS; do
  job="${entry%%|*}"; rest="${entry#*|}"
  hour="${rest%%|*}"; rest="${rest#*|}"
  minute="${rest%%|*}"; days="${rest#*|}"
  label="com.ameralic.writing.$job"

  intervals=""
  for d in ${=days}; do
    intervals+="      <dict>
        <key>Weekday</key><integer>$d</integer>
        <key>Hour</key><integer>$hour</integer>
        <key>Minute</key><integer>$minute</integer>
      </dict>
"
  done

  unload "$label"
  cat > "$AGENTS/$label.plist" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>$label</string>
  <key>ProgramArguments</key>
  <array>
    <string>/bin/zsh</string>
    <string>$RUN</string>
    <string>$job</string>
  </array>
  <key>StartCalendarInterval</key>
  <array>
$intervals  </array>
  <key>WorkingDirectory</key><string>$REPO</string>
  <key>StandardErrorPath</key><string>$REPO/automation/launchd-$job.err</string>
  <key>RunAtLoad</key><false/>
</dict>
</plist>
PLIST

  launchctl bootstrap "gui/$UID" "$AGENTS/$label.plist" 2>/dev/null \
    || launchctl load "$AGENTS/$label.plist"
  echo "loaded $label — $(printf '%02d:%02d' "$hour" "$minute") on weekday(s) $days"
done

echo "\nTest one now without waiting:  ./automation/run.sh review"
