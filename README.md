# minilab-skills-lock-verify

**Built by SkilledDragon LLC — architecture-led software engineering · [skilleddragon.com](https://skilleddragon.com)**

Bun/TypeScript minilab: install a real skill with [vercel-labs/skills](https://github.com/vercel-labs/skills) (`skills@1.7.2`), recompute the lockfile hash, and fail on drift so the rules behind each agent yes/no stay the ones you approved.

Featured upstream: [vercel-labs/skills](https://github.com/vercel-labs/skills) @ `13e4063a1cf913f5606d57d42ab83a86f5001e04` (MIT) · npm [`skills@1.7.2`](https://www.npmjs.com/package/skills)

## What we built

| Piece | Purpose |
| --- | --- |
| `scripts/vendor-upstream.sh` | Clone + pin `vendor/skills` (gitignored) to the SHA above |
| `src/hash.ts` | Port of upstream `src/local-lock.ts` `computeSkillFolderHash` |
| `bin/skill-lock-verify.ts` | CLI: `OK` / `DRIFT` / `MISSING` → exits `0` / `1` / `2`; `--write` |
| `src/layout.ts` | Frontmatter + no `.cursor/skills` / `.agents/skills` mirrors |
| `.claude/skills/verify-rules-before-deciding/` | Lab skill: run `bun run verify` before acting on skills |
| CI | `lab` + `upstream` (Node 24 pnpm suite) + `security` (gitleaks 8.30.1) |

### Observed find-skills hash

```text
913b9d37d0d54047dd65222bb8c67b2bf04e3cb87dcad1729068d7a8b2c8c396
```

Produced by:

```bash
DISABLE_TELEMETRY=1 bun --bun x skills@1.7.2 add ./vendor/skills \
  --skill find-skills -a claude-code -y --copy
```

### Warning: do not use `experimental_install`

`skills@1.7.2 experimental_install` restores into `.agents/skills/` and ignores `-a claude-code`. That breaks this org’s layout rule (skills only under `.claude/skills/`). Restore by re-running the `add` command above. See `tests/experimental-install.test.ts`.

## What we tested (real commands)

Pin:

```text
13e4063a1cf913f5606d57d42ab83a86f5001e04
```

Local minilab (keyless; requires vendored clone):

```bash
bash scripts/vendor-upstream.sh
bun install
bun run typecheck
bun run test
bun audit
test ! -e .cursor/skills && test ! -e .agents/skills
bun run verify
```

| Suite | Result (local ship gate, 2026-10-13) |
| --- | --- |
| `bun test ./tests` (install / hash / verify / experimental-install / layout) | **10 pass / 0 fail** |
| `bun run typecheck` | exit 0 |
| `bun run verify` (committed `verify-rules-before-deciding`) | `OK verify-rules-before-deciding` (exit 0) |
| `bun audit` | No vulnerabilities (13 packages) |
| Upstream `pnpm test` at pin | Needs modern Git (≥2.31 for `GIT_CONFIG_GLOBAL`). With Homebrew `git` 2.39, `git-lfs-clone` + `git-transport-allowlist` pass. Full 964-test suite is expected green on CI (ubuntu-latest × Node 24); local full runs can time out under high machine load. |

Upstream gate (network; Node ≥ 22.20, pnpm 10.17.1; prefer Git ≥ 2.31 on `PATH`):

```bash
export PATH="/usr/local/opt/git/bin:$PATH"   # if system git is older than 2.31
bash scripts/upstream-skills.sh
```

`scripts/upstream-skills.sh` prefers Homebrew git when present, then runs the upstream CI commands for the ubuntu × Node 24 leg verbatim.

## Setup

- **Node** `>=24` (see `.nvmrc`)
- **Bun** `>=1.2.0` (CI uses `1.4.3`)

```bash
nvm use
cp .env.example .env   # telemetry flags only; no API keys
bun install
bash scripts/vendor-upstream.sh
bun run hooks:install  # optional: gitleaks pre-commit
```

## Tutorial

1. **Vendor** the pinned upstream:

   ```bash
   bash scripts/vendor-upstream.sh
   ```

2. **Install** `find-skills` into this project (or a throwaway dir):

   ```bash
   DISABLE_TELEMETRY=1 DO_NOT_TRACK=1 bun --bun x skills@1.7.2 add ./vendor/skills \
     --skill find-skills -a claude-code -y --copy
   ```

3. **Verify** the lock:

   ```bash
   bun run verify
   # OK find-skills
   ```

4. **Tamper** and watch drift:

   ```bash
   echo x >> .claude/skills/find-skills/SKILL.md
   bun run verify
   # DRIFT find-skills expected=… actual=…  (exit 1)
   ```

5. Regenerate the lock only after intentional review:

   ```bash
   bun run verify --write
   ```

## Using these skills in Claude Code and Cursor

- Both Claude Code and Cursor read `.claude/skills/<name>/SKILL.md`.
- In Claude Code the skill is auto-discovered when this repo is the project root.
- In Cursor, open the repo; skills appear under Rules/Skills from the same path.
- Do **not** mirror into `.cursor/skills` or `.agents/skills`. CI fails if those exist.
- Lab skill `verify-rules-before-deciding` tells the agent to run `bun run verify` before following any installed skill.

## API keys

| Variable | Required for | Notes |
| --- | --- | --- |
| *(none)* | CI / local tests | Installs from a local vendored clone |
| `GITHUB_TOKEN` | Optional | Rate limits if installing from GitHub sources; unused by this lab’s tests |
| `DISABLE_TELEMETRY` / `DO_NOT_TRACK` | All skills CLI runs | Must be `1` (tests refuse to spawn without both) |

## License

MIT — see [LICENSE](LICENSE). Upstream vercel-labs/skills is MIT.
