# Auto-approval

Auto-approval is disabled by default and must stay visibly revocable.

## Safety rules

- Deny patterns override allow patterns.
- Commands must match an allow pattern.
- Destructive commands (`sudo`, broad `rm -rf`, credential/keychain reads, `curl | sh`, disk formatting, exfiltration patterns) are denied by default.
- Filesystem mutation commands must stay inside the active workspace when `requireWorkspacePath` is enabled.
- Timeout is clamped to 5–600 seconds.

## User experience

Eligible requests should show a countdown with:

- approve now,
- reject,
- disable auto-approve.

After timeout the responder should send a one-time approval unless the future policy explicitly supports an exact-pattern always approval.
