import { describe, expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  EXPECTED_FIND_SKILLS_HASH,
  installFindSkills,
  linkVendorInto,
  makeTempProject,
} from "./helpers.ts";

describe("install find-skills from vendored upstream", () => {
  test("skills@1.7.2 add ./vendor/skills --skill find-skills -a claude-code", async () => {
    const { dir, home, cleanup } = makeTempProject();
    try {
      linkVendorInto(dir);
      const result = await installFindSkills(dir, home);
      expect(result.exitCode).toBe(0);

      const skillMd = join(dir, ".claude", "skills", "find-skills", "SKILL.md");
      expect(existsSync(skillMd)).toBe(true);

      const content = readFileSync(skillMd, "utf8");
      expect(content).toMatch(/^---\r?\n/);
      expect(content).toContain("name: find-skills");

      const lock = JSON.parse(
        readFileSync(join(dir, "skills-lock.json"), "utf8"),
      ) as {
        skills: Record<string, { computedHash: string; sourceType: string }>;
      };
      expect(lock.skills["find-skills"]?.computedHash).toBe(
        EXPECTED_FIND_SKILLS_HASH,
      );
      expect(lock.skills["find-skills"]?.sourceType).toBe("local");

      expect(existsSync(join(dir, ".agents"))).toBe(false);
    } finally {
      cleanup();
    }
  }, 120_000);
});
