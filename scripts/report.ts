#!/usr/bin/env bun
/**
 * Keyless report: bun test counts + skills-lock verify + upstream pin SHA.
 * Writes reports/skills-lock.json (+ .md). Deterministic apart from timings / generated_at.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { EXPECTED_FIND_SKILLS_HASH } from "../tests/helpers.ts";

const ROOT = join(import.meta.dir, "..");
const REPORTS = join(ROOT, "reports");
const PIN_SHA = "13e4063a1cf913f5606d57d42ab83a86f5001e04";
const PIN_SHORT = PIN_SHA.slice(0, 8);

type Step = {
  id: string;
  command: string;
  ok: boolean;
  exit_code: number;
  elapsed_ms: number;
  output: string;
};

function run(id: string, cmd: string[]): Step {
  const t0 = performance.now();
  const r = Bun.spawnSync(cmd, {
    cwd: ROOT,
    stdout: "pipe",
    stderr: "pipe",
    env: {
      ...process.env,
      DISABLE_TELEMETRY: "1",
      DO_NOT_TRACK: "1",
    },
  });
  const output = `${r.stdout?.toString() ?? ""}${r.stderr?.toString() ?? ""}`;
  return {
    id,
    command: cmd.join(" "),
    ok: r.exitCode === 0,
    exit_code: r.exitCode ?? 1,
    elapsed_ms: Math.round(performance.now() - t0),
    output,
  };
}

function parseBunTest(out: string): { pass: number; fail: number; files: number } {
  // bun test summary: "N pass\nM fail\n" and often "X expect() calls"
  const pass = Number(out.match(/(\d+)\s+pass/i)?.[1] ?? 0);
  const fail = Number(out.match(/(\d+)\s+fail/i)?.[1] ?? 0);
  const files = (out.match(/^\s*\(pass\)/gm) || []).length || pass;
  return { pass, fail, files };
}

function readVendorPin(): string | null {
  const head = join(ROOT, "vendor", "skills", ".git", "HEAD");
  if (!existsSync(head)) return null;
  const ref = readFileSync(head, "utf8").trim();
  if (ref.startsWith("ref:")) {
    const refPath = join(ROOT, "vendor", "skills", ".git", ref.slice(5).trim());
    if (existsSync(refPath)) return readFileSync(refPath, "utf8").trim();
    return null;
  }
  return ref.length >= 7 ? ref : null;
}

const tAll = performance.now();
const testStep = run("bun:test", ["bun", "test", "./tests"]);
const verifyStep = run("verify", ["bun", "run", "verify"]);
const elapsed_ms = Math.round(performance.now() - tAll);

const counts = parseBunTest(testStep.output);
const vendorPin = readVendorPin();
const pin_sha = vendorPin && /^[0-9a-f]{7,40}$/i.test(vendorPin) ? vendorPin : PIN_SHA;

const verifyOkLine =
  verifyStep.output
    .split("\n")
    .map((l) => l.trim())
    .find((l) => /^(OK|DRIFT|MISSING)\s/.test(l)) ?? null;

const steps = [testStep, verifyStep];
const steps_passed = steps.filter((s) => s.ok).length;
const steps_failed = steps.length - steps_passed;
const ok = steps_failed === 0 && counts.fail === 0;

const payload = {
  generated_at: new Date().toISOString(),
  lab: "minilab-skills-lock-verify",
  keyless: true,
  ok,
  elapsed_ms,
  elapsed_s: Math.round(elapsed_ms / 100) / 10,
  bun: { version: Bun.version, pass: counts.pass, fail: counts.fail, files_approx: counts.files },
  verify: {
    ok: verifyStep.ok,
    exit_code: verifyStep.exit_code,
    line: verifyOkLine,
    elapsed_ms: verifyStep.elapsed_ms,
  },
  upstream: {
    repo: "vercel-labs/skills",
    pin_sha,
    pin_short: pin_sha.slice(0, 8),
    expected_pin: PIN_SHA,
    pin_match: pin_sha.startsWith(PIN_SHORT) || pin_sha === PIN_SHA,
    npm: "skills@1.7.2",
    find_skills_expected_hash: EXPECTED_FIND_SKILLS_HASH,
    vendor_present: existsSync(join(ROOT, "vendor", "skills")),
  },
  steps: steps.map(({ id, command, ok, exit_code, elapsed_ms }) => ({
    id,
    command,
    ok,
    exit_code,
    elapsed_ms,
  })),
  headline: {
    bun_pass: counts.pass,
    bun_fail: counts.fail,
    verify_ok: verifyStep.ok,
    pin_short: pin_sha.slice(0, 8),
    find_skills_hash_prefix: EXPECTED_FIND_SKILLS_HASH.slice(0, 12),
  },
};

mkdirSync(REPORTS, { recursive: true });
writeFileSync(join(REPORTS, "skills-lock.json"), `${JSON.stringify(payload, null, 2)}\n`);

const md = [
  "# Skills lock verify — keyless report",
  "",
  `- **Generated:** ${payload.generated_at}`,
  `- **Result:** ${ok ? "GREEN" : "RED"} — ${steps_passed}/${steps.length} steps, bun ${counts.pass} pass / ${counts.fail} fail`,
  `- **Verify:** ${verifyStep.ok ? "OK" : "FAIL"} (exit ${verifyStep.exit_code})${verifyOkLine ? ` — ${verifyOkLine}` : ""}`,
  `- **Upstream pin:** vercel-labs/skills @ \`${pin_sha.slice(0, 8)}\` (expected \`${PIN_SHORT}\`, match: ${payload.upstream.pin_match})`,
  `- **find-skills expected hash:** \`${EXPECTED_FIND_SKILLS_HASH}\``,
  `- **Elapsed:** ${elapsed_ms} ms (~${payload.elapsed_s} s)`,
  "",
  "## Steps",
  "",
  ...steps.map(
    (s) =>
      `- \`${s.id}\`: ${s.ok ? "PASS" : "FAIL"} (exit ${s.exit_code}, ${s.elapsed_ms} ms)`,
  ),
  "",
].join("\n");
writeFileSync(join(REPORTS, "skills-lock.md"), md);

console.log(
  JSON.stringify(
    {
      ok,
      bun_pass: counts.pass,
      bun_fail: counts.fail,
      verify_ok: verifyStep.ok,
      pin_sha: pin_sha.slice(0, 12),
      find_skills_hash: EXPECTED_FIND_SKILLS_HASH.slice(0, 16),
      elapsed_ms,
      generated_at: payload.generated_at,
    },
    null,
    2,
  ),
);
if (!ok) process.exit(1);
