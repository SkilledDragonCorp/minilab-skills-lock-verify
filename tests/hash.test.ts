import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { computeSkillFolderHash } from "../src/hash.ts";
import {
  EXPECTED_FIND_SKILLS_HASH,
  installFindSkills,
  linkVendorInto,
  makeTempProject,
  VENDOR_SKILLS,
} from "./helpers.ts";

describe("computeSkillFolderHash", () => {
  test("matches lockfile hash for installed find-skills and vendor source", async () => {
    const { dir, home, cleanup } = makeTempProject();
    try {
      linkVendorInto(dir);
      const result = await installFindSkills(dir, home);
      expect(result.exitCode).toBe(0);

      const installedDir = join(dir, ".claude", "skills", "find-skills");
      const vendorDir = join(VENDOR_SKILLS, "skills", "find-skills");

      const installedHash = await computeSkillFolderHash(installedDir);
      const vendorHash = await computeSkillFolderHash(vendorDir);
      const lockHash = (
        JSON.parse(readFileSync(join(dir, "skills-lock.json"), "utf8")) as {
          skills: { "find-skills": { computedHash: string } };
        }
      ).skills["find-skills"].computedHash;

      expect(installedHash).toBe(EXPECTED_FIND_SKILLS_HASH);
      expect(vendorHash).toBe(EXPECTED_FIND_SKILLS_HASH);
      expect(lockHash).toBe(EXPECTED_FIND_SKILLS_HASH);
    } finally {
      cleanup();
    }
  }, 120_000);
});
