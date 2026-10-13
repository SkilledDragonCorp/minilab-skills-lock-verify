# minilab-skills-lock-verify agent rules

Inherits SkilledDragonCorp ship gate: local green before push, GitHub org **SkilledDragonCorp**, SECURITY contact **hello@skilleddragon.com**, no AI `Co-authored-by`, skills only under `.claude/skills/`.

## This lab

- Featured upstream: `vercel-labs/skills` @ `13e4063a1cf913f5606d57d42ab83a86f5001e04` (`skills@1.7.2`).
- Vendor with `bash scripts/vendor-upstream.sh` (`vendor/` is gitignored).
- Install featured skill only with:
  `DISABLE_TELEMETRY=1 bun --bun x skills@1.7.2 add ./vendor/skills --skill find-skills -a claude-code -y --copy`
- Do **not** use `skills experimental_install` — it restores into `.agents/skills/` and breaks the layout rule.
- Before acting on installed skills: `bun run verify` (exit 0 OK / 1 DRIFT / 2 MISSING).
- Lab skill: `.claude/skills/verify-rules-before-deciding/SKILL.md`.
