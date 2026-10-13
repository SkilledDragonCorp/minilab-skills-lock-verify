import {
  mkdirSync,
  mkdtempSync,
  rmSync,
  writeFileSync,
  cpSync,
  symlinkSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

export const LAB_ROOT = resolve(import.meta.dir, "..");
export const VENDOR_SKILLS = join(LAB_ROOT, "vendor", "skills");
export const EXPECTED_FIND_SKILLS_HASH =
  "913b9d37d0d54047dd65222bb8c67b2bf04e3cb87dcad1729068d7a8b2c8c396";

export function requireTelemetryOff(env: Record<string, string | undefined>): void {
  if (env.DISABLE_TELEMETRY !== "1" || env.DO_NOT_TRACK !== "1") {
    throw new Error(
      "refusing to spawn skills CLI without DISABLE_TELEMETRY=1 and DO_NOT_TRACK=1",
    );
  }
}

export function makeTempProject(): { dir: string; home: string; cleanup: () => void } {
  const dir = mkdtempSync(join(tmpdir(), "skill-lock-proj-"));
  const home = mkdtempSync(join(tmpdir(), "skill-lock-home-"));
  return {
    dir,
    home,
    cleanup: () => {
      rmSync(dir, { recursive: true, force: true });
      rmSync(home, { recursive: true, force: true });
    },
  };
}

export async function spawnSkills(
  args: string[],
  cwd: string,
  home: string,
): Promise<{ exitCode: number; stdout: string; stderr: string }> {
  const env = {
    ...process.env,
    HOME: home,
    DISABLE_TELEMETRY: "1",
    DO_NOT_TRACK: "1",
  };
  requireTelemetryOff(env);

  const proc = Bun.spawn(
    ["bun", "--bun", "x", "skills@1.7.2", ...args],
    {
      cwd,
      env,
      stdout: "pipe",
      stderr: "pipe",
    },
  );
  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ]);
  return { exitCode, stdout, stderr };
}

export async function installFindSkills(
  cwd: string,
  home: string,
): Promise<{ exitCode: number; stdout: string; stderr: string }> {
  if (!Bun.file(join(VENDOR_SKILLS, "package.json")).size) {
    throw new Error("vendor/skills missing; run bash scripts/vendor-upstream.sh");
  }
  return spawnSkills(
    [
      "add",
      "./vendor/skills",
      "--skill",
      "find-skills",
      "-a",
      "claude-code",
      "-y",
      "--copy",
    ],
    cwd,
    home,
  );
}

/** Prepare a temp project that can see the lab's vendor/skills via relative path. */
export function linkVendorInto(projectDir: string): void {
  mkdirSync(join(projectDir, "vendor"), { recursive: true });
  // Symlink so `./vendor/skills` resolves like the lab install command.
  const target = VENDOR_SKILLS;
  const link = join(projectDir, "vendor", "skills");
  try {
    symlinkSync(target, link, "dir");
  } catch {
    cpSync(target, link, { recursive: true });
  }
}

export async function runVerifyCli(
  args: string[],
  cwd: string,
): Promise<{ exitCode: number; stdout: string; stderr: string }> {
  const proc = Bun.spawn(["bun", join(LAB_ROOT, "bin/skill-lock-verify.ts"), ...args], {
    cwd,
    env: {
      ...process.env,
      DISABLE_TELEMETRY: "1",
      DO_NOT_TRACK: "1",
    },
    stdout: "pipe",
    stderr: "pipe",
  });
  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ]);
  return { exitCode, stdout, stderr };
}

export function writeMinimalSkill(
  root: string,
  name: string,
  body = `# ${name}\n`,
): void {
  const dir = join(root, ".claude", "skills", name);
  mkdirSync(dir, { recursive: true });
  writeFileSync(
    join(dir, "SKILL.md"),
    `---\nname: ${name}\ndescription: Test skill ${name}\n---\n\n${body}`,
  );
}
