import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { parse as parseYaml } from "yaml";

export interface LayoutIssue {
  path: string;
  message: string;
}

export interface LayoutResult {
  ok: boolean;
  issues: LayoutIssue[];
  skills: string[];
}

function parseFrontmatter(content: string): Record<string, unknown> | null {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) return null;
  const parsed = parseYaml(match[1]);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
  return parsed as Record<string, unknown>;
}

/** Assert SKILL.md frontmatter + no forbidden skill mirrors. */
export function checkLayout(root: string): LayoutResult {
  const issues: LayoutIssue[] = [];
  const skills: string[] = [];

  for (const mirror of [".cursor/skills", ".agents/skills"]) {
    const mirrorPath = join(root, mirror);
    if (existsSync(mirrorPath)) {
      issues.push({
        path: mirrorPath,
        message: `forbidden skill mirror exists: ${mirror}`,
      });
    }
  }

  const skillsRoot = join(root, ".claude", "skills");
  if (!statSync(skillsRoot, { throwIfNoEntry: false })?.isDirectory()) {
    issues.push({ path: skillsRoot, message: "missing .claude/skills directory" });
    return { ok: false, issues, skills };
  }

  for (const folder of readdirSync(skillsRoot)) {
    const skillMd = join(skillsRoot, folder, "SKILL.md");
    if (!statSync(skillMd, { throwIfNoEntry: false })?.isFile()) {
      issues.push({ path: skillMd, message: "expected SKILL.md" });
      continue;
    }
    skills.push(folder);
    const content = readFileSync(skillMd, "utf8");
    const fm = parseFrontmatter(content);
    if (!fm) {
      issues.push({ path: skillMd, message: "missing YAML frontmatter" });
      continue;
    }
    if (typeof fm.name !== "string" || !fm.name.trim()) {
      issues.push({ path: skillMd, message: "frontmatter must include name" });
    }
    if (typeof fm.description !== "string" || !fm.description.trim()) {
      issues.push({
        path: skillMd,
        message: "frontmatter must include description",
      });
    }
  }

  return { ok: issues.length === 0, issues, skills };
}
