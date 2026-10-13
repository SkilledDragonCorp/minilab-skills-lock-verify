import { describe, expect, test } from "bun:test";
import {
  appendFileSync,
  mkdirSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import {
  installFindSkills,
  linkVendorInto,
  makeTempProject,
  runVerifyCli,
  writeMinimalSkill,
} from "./helpers.ts";
import { writeSkillsLock } from "../src/verify.ts";

describe("skill-lock-verify CLI", () => {
  test("clean install → exit 0 OK find-skills", async () => {
    const { dir, home, cleanup } = makeTempProject();
    try {
      linkVendorInto(dir);
      expect((await installFindSkills(dir, home)).exitCode).toBe(0);
      const v = await runVerifyCli(["--root", dir], dir);
      expect(v.stdout).toContain("OK find-skills");
      expect(v.exitCode).toBe(0);
    } finally {
      cleanup();
    }
  }, 120_000);

  test("append one byte → exit 1 DRIFT", async () => {
    const { dir, home, cleanup } = makeTempProject();
    try {
      linkVendorInto(dir);
      expect((await installFindSkills(dir, home)).exitCode).toBe(0);
      appendFileSync(
        join(dir, ".claude", "skills", "find-skills", "SKILL.md"),
        "X",
      );
      const v = await runVerifyCli(["--root", dir], dir);
      expect(v.stdout).toContain("DRIFT find-skills");
      expect(v.exitCode).toBe(1);
    } finally {
      cleanup();
    }
  }, 120_000);

  test("rename file inside skill → exit 1 DRIFT (paths in hash)", async () => {
    const { dir, home, cleanup } = makeTempProject();
    try {
      linkVendorInto(dir);
      expect((await installFindSkills(dir, home)).exitCode).toBe(0);
      const skillDir = join(dir, ".claude", "skills", "find-skills");
      writeFileSync(join(skillDir, "extra.txt"), "hello\n");
      await writeSkillsLock(dir);
      // Re-read lock then rename so hash path changes
      renameSync(join(skillDir, "extra.txt"), join(skillDir, "renamed.txt"));
      const v = await runVerifyCli(["--root", dir], dir);
      expect(v.stdout).toContain("DRIFT find-skills");
      expect(v.exitCode).toBe(1);
    } finally {
      cleanup();
    }
  }, 120_000);

  test("delete skill folder → exit 2 MISSING", async () => {
    const { dir, home, cleanup } = makeTempProject();
    try {
      linkVendorInto(dir);
      expect((await installFindSkills(dir, home)).exitCode).toBe(0);
      rmSync(join(dir, ".claude", "skills", "find-skills"), {
        recursive: true,
        force: true,
      });
      const v = await runVerifyCli(["--root", dir], dir);
      expect(v.stdout).toContain("MISSING find-skills");
      expect(v.exitCode).toBe(2);
    } finally {
      cleanup();
    }
  }, 120_000);

  test("lockfile name ../evil rejected with exit 2", async () => {
    const { dir, cleanup } = makeTempProject();
    try {
      mkdirSync(join(dir, ".claude", "skills"), { recursive: true });
      writeFileSync(
        join(dir, "skills-lock.json"),
        JSON.stringify(
          {
            version: 1,
            skills: {
              "../evil": {
                source: "./x",
                sourceType: "local",
                computedHash: "0".repeat(64),
              },
            },
          },
          null,
          2,
        ),
      );
      const v = await runVerifyCli(["--root", dir], dir);
      expect(v.exitCode).toBe(2);
      const combined = `${v.stdout}\n${v.stderr}`;
      expect(combined.toLowerCase()).toMatch(/invalid|traversal|reject/);
    } finally {
      cleanup();
    }
  });

  test("--write regenerates lock for local skill", async () => {
    const { dir, cleanup } = makeTempProject();
    try {
      writeMinimalSkill(dir, "sample-skill");
      const w = await runVerifyCli(["--root", dir, "--write"], dir);
      expect(w.exitCode).toBe(0);
      const lock = JSON.parse(
        readFileSync(join(dir, "skills-lock.json"), "utf8"),
      ) as { skills: Record<string, { computedHash: string }> };
      expect(lock.skills["sample-skill"]?.computedHash).toMatch(/^[a-f0-9]{64}$/);
      const v = await runVerifyCli(["--root", dir], dir);
      expect(v.exitCode).toBe(0);
      expect(v.stdout).toContain("OK sample-skill");
    } finally {
      cleanup();
    }
  });
});
