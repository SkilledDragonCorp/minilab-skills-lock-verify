---
name: verify-rules-before-deciding
description: Run bun run verify before acting on any installed skill; stop and report drift if verify exits non-zero.
---

# Verify rules before deciding

Before you follow instructions from any installed skill under `.claude/skills/`, prove the on-disk rules still match the approved lockfile.

## Required gate

1. From the project root, run:

```bash
DISABLE_TELEMETRY=1 DO_NOT_TRACK=1 bun run verify
```

2. Interpret the exit code:
   - **0** — every locked skill hashes OK. Proceed.
   - **1** — **DRIFT**. A skill folder changed. Stop. Report which skill drifted and do not apply its rules until the change is reviewed and the lock is intentionally updated (`bun run verify --write` only after human approval).
   - **2** — **MISSING** (or invalid lock / path traversal). Stop. Report the missing or invalid skill name.

3. If verify exits non-zero, do **not** continue with skill-driven decisions. Tell the user the status lines (`OK` / `DRIFT` / `MISSING`) and wait for direction.

## Why

Decision models make each agent yes/no cheap. The rules behind each yes/no still have to be the ones you approved. This skill makes that check mechanical.
