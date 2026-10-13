import { describe, expect, test } from "bun:test";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  installFindSkills,
  linkVendorInto,
  makeTempProject,
  spawnSkills,
} from "./helpers.ts";

describe("upstream 1.7.2 experimental_install restores into .agents (do not use)", () => {
  test("upstream 1.7.2 experimental_install restores into .agents (do not use)", async () => {
    const { dir, home, cleanup } = makeTempProject();
    try {
      linkVendorInto(dir);
      // Seed a lockfile via the supported add path, then remove the claude install
      // so experimental_install is the restore mechanism under test.
      expect((await installFindSkills(dir, home)).exitCode).toBe(0);
      const lock = JSON.parse(
        readFileSync(join(dir, "skills-lock.json"), "utf8"),
      ) as {
        skills: Record<
          string,
          { source: string; sourceType: string; computedHash: string }
        >;
      };

      // Point source at a local skill tree the restore can read (vendor find-skills).
      // experimental_install ignores -a claude-code and restores into .agents/skills/
      // (same invocation shape as upstream src/add.test.ts L506–507 at the pin).
      lock.skills["find-skills"] = {
        ...lock.skills["find-skills"],
        source: "./vendor/skills",
        sourceType: "local",
      };
      writeFileSync(
        join(dir, "skills-lock.json"),
        `${JSON.stringify(lock, null, 2)}\n`,
      );

      // Remove .claude install so restore is visible
      const { rmSync } = await import("node:fs");
      rmSync(join(dir, ".claude"), { recursive: true, force: true });

      const result = await spawnSkills(["experimental_install"], dir, home);
      expect(result.exitCode).toBe(0);
      expect(
        existsSync(join(dir, ".agents", "skills", "find-skills", "SKILL.md")),
      ).toBe(true);
    } finally {
      cleanup();
    }
  }, 120_000);
});
