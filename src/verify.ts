import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { computeSkillFolderHash } from "./hash.ts";

const SKILL_NAME_RE = /^[a-z0-9][a-z0-9-]*$/;

export interface LockEntry {
  source: string;
  sourceType: string;
  skillPath?: string;
  computedHash: string;
  [key: string]: unknown;
}

export interface SkillsLockFile {
  version: number;
  skills: Record<string, LockEntry>;
}

export type VerifyStatus = "OK" | "DRIFT" | "MISSING";

export interface VerifyLine {
  status: VerifyStatus;
  name: string;
  expected?: string;
  actual?: string;
  message?: string;
}

export interface VerifyReport {
  lines: VerifyLine[];
  exitCode: 0 | 1 | 2;
  validationError?: string;
}

function skillsDir(root: string, name: string): string {
  return join(root, ".claude", "skills", name);
}

export function validateSkillName(name: string): string | null {
  if (!SKILL_NAME_RE.test(name)) {
    return `invalid skill name "${name}" (must match ${SKILL_NAME_RE})`;
  }
  if (name.includes("..") || name.includes("/") || name.includes("\\")) {
    return `path traversal rejected for skill name "${name}"`;
  }
  return null;
}

export function readLockFile(root: string): SkillsLockFile | { error: string } {
  const lockPath = join(root, "skills-lock.json");
  if (!existsSync(lockPath)) {
    return { error: `missing skills-lock.json at ${lockPath}` };
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(lockPath, "utf8"));
  } catch {
    return { error: "skills-lock.json is not valid JSON" };
  }
  if (
    !parsed ||
    typeof parsed !== "object" ||
    !("skills" in parsed) ||
    typeof (parsed as SkillsLockFile).skills !== "object" ||
    (parsed as SkillsLockFile).skills === null ||
    Array.isArray((parsed as SkillsLockFile).skills)
  ) {
    return { error: "skills-lock.json must be JSON with a skills object" };
  }
  return parsed as SkillsLockFile;
}

export async function verifySkills(root: string): Promise<VerifyReport> {
  const absRoot = resolve(root);
  const lock = readLockFile(absRoot);
  if ("error" in lock) {
    return {
      lines: [],
      exitCode: 2,
      validationError: lock.error,
    };
  }

  const lines: VerifyLine[] = [];
  let hasDrift = false;
  let hasMissing = false;

  for (const name of Object.keys(lock.skills).sort()) {
    const nameErr = validateSkillName(name);
    if (nameErr) {
      return {
        lines: [{ status: "MISSING", name, message: nameErr }],
        exitCode: 2,
        validationError: nameErr,
      };
    }

    const entry = lock.skills[name];
    const dir = skillsDir(absRoot, name);
    const skillMd = join(dir, "SKILL.md");

    if (!existsSync(dir) || !existsSync(skillMd)) {
      hasMissing = true;
      lines.push({ status: "MISSING", name });
      continue;
    }

    const actual = await computeSkillFolderHash(dir);
    const expected = entry.computedHash;
    if (actual !== expected) {
      hasDrift = true;
      lines.push({ status: "DRIFT", name, expected, actual });
    } else {
      lines.push({ status: "OK", name });
    }
  }

  let exitCode: 0 | 1 | 2 = 0;
  if (hasMissing) exitCode = 2;
  else if (hasDrift) exitCode = 1;

  return { lines, exitCode };
}

/** Recompute hashes for every skill under .claude/skills and write skills-lock.json. */
export async function writeSkillsLock(root: string): Promise<SkillsLockFile> {
  const absRoot = resolve(root);
  const skillsRoot = join(absRoot, ".claude", "skills");
  const existing = readLockFile(absRoot);
  const prev =
    "error" in existing
      ? { version: 1, skills: {} as Record<string, LockEntry> }
      : existing;

  const { readdirSync, statSync } = await import("node:fs");
  const skills: Record<string, LockEntry> = {};

  if (statSync(skillsRoot, { throwIfNoEntry: false })?.isDirectory()) {
    for (const name of readdirSync(skillsRoot).sort()) {
      const nameErr = validateSkillName(name);
      if (nameErr) throw new Error(nameErr);
      const dir = skillsDir(absRoot, name);
      if (!statSync(join(dir, "SKILL.md"), { throwIfNoEntry: false })?.isFile()) {
        continue;
      }
      const computedHash = await computeSkillFolderHash(dir);
      const prior = prev.skills[name];
      skills[name] = {
        source: prior?.source ?? `./.claude/skills/${name}`,
        sourceType: prior?.sourceType ?? "local",
        ...(prior?.skillPath ? { skillPath: prior.skillPath } : {}),
        computedHash,
      };
    }
  }

  const lock: SkillsLockFile = { version: prev.version || 1, skills };
  writeFileSync(
    join(absRoot, "skills-lock.json"),
    `${JSON.stringify(lock, null, 2)}\n`,
    "utf8",
  );
  return lock;
}

export function formatLine(line: VerifyLine): string {
  if (line.status === "OK") return `OK ${line.name}`;
  if (line.status === "MISSING") {
    return line.message
      ? `MISSING ${line.name} ${line.message}`
      : `MISSING ${line.name}`;
  }
  return `DRIFT ${line.name} expected=${line.expected} actual=${line.actual}`;
}
