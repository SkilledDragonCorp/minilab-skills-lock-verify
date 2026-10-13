/**
 * Port of vercel-labs/skills `src/local-lock.ts` at pin
 * 13e4063a1cf913f5606d57d42ab83a86f5001e04.
 *
 * Upstream doc comment: L149–153. Implementation: L154–193
 * (`computeSkillFolderHash` + `collectFiles`). Imports `createHash` from
 * `crypto` at L3.
 *
 * Match behavior byte-for-byte: recursively collect files (skip `.git` and
 * `node_modules`), sort by relative path (forward slashes), update SHA-256
 * with relativePath then file bytes, return lowercase hex.
 */
import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import { join, relative } from "node:path";

export async function computeSkillFolderHash(skillDir: string): Promise<string> {
  const files: Array<{ relativePath: string; content: Buffer }> = [];
  await collectFiles(skillDir, skillDir, files);

  // Sort by relative path for deterministic hashing
  files.sort((a, b) => a.relativePath.localeCompare(b.relativePath));

  const hash = createHash("sha256");
  for (const file of files) {
    // Include the path in the hash so renames are detected
    hash.update(file.relativePath);
    hash.update(file.content);
  }

  return hash.digest("hex");
}

async function collectFiles(
  baseDir: string,
  currentDir: string,
  results: Array<{ relativePath: string; content: Buffer }>,
): Promise<void> {
  const entries = await readdir(currentDir, { withFileTypes: true });

  await Promise.all(
    entries.map(async (entry) => {
      const fullPath = join(currentDir, entry.name);

      if (entry.isDirectory()) {
        // Skip .git and node_modules within skill dirs
        if (entry.name === ".git" || entry.name === "node_modules") return;
        await collectFiles(baseDir, fullPath, results);
      } else if (entry.isFile()) {
        const content = await readFile(fullPath);
        const relativePath = relative(baseDir, fullPath).split("\\").join("/");
        results.push({ relativePath, content });
      }
    }),
  );
}
