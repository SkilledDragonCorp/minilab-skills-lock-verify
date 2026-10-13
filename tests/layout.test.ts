import { describe, expect, test } from "bun:test";
import { checkLayout } from "../src/layout.ts";
import { LAB_ROOT } from "./helpers.ts";

describe("layout", () => {
  test("repo .claude/skills pass frontmatter; no mirrors", () => {
    const result = checkLayout(LAB_ROOT);
    expect(result.ok).toBe(true);
    expect(result.issues).toEqual([]);
    expect(result.skills.length).toBeGreaterThan(0);
    expect(result.skills).toContain("verify-rules-before-deciding");
  });
});
