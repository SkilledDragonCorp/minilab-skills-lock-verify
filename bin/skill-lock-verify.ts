#!/usr/bin/env bun
import { resolve } from "node:path";
import {
  formatLine,
  verifySkills,
  writeSkillsLock,
} from "../src/verify.ts";

function parseArgs(argv: string[]) {
  let root = ".";
  let json = false;
  let write = false;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--root") {
      root = argv[++i] ?? ".";
    } else if (a === "--json") {
      json = true;
    } else if (a === "--write") {
      write = true;
    } else if (a === "--help" || a === "-h") {
      console.log(`Usage: skill-lock-verify [--root .] [--json] [--write]

Recompute hashes for skills listed in skills-lock.json under .claude/skills/.

Exit codes: 0 OK, 1 DRIFT, 2 MISSING (2 wins). --write regenerates the lock.`);
      process.exit(0);
    } else {
      console.error(`Unknown argument: ${a}`);
      process.exit(2);
    }
  }
  return { root: resolve(root), json, write };
}

const opts = parseArgs(process.argv.slice(2));

if (opts.write) {
  const lock = await writeSkillsLock(opts.root);
  if (opts.json) {
    console.log(JSON.stringify({ wrote: true, lock }, null, 2));
  } else {
    for (const name of Object.keys(lock.skills).sort()) {
      console.log(`WRITE ${name} ${lock.skills[name].computedHash}`);
    }
  }
  process.exit(0);
}

const report = await verifySkills(opts.root);
if (report.validationError && report.lines.length === 0) {
  if (opts.json) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    console.error(report.validationError);
  }
  process.exit(report.exitCode);
}

if (opts.json) {
  console.log(JSON.stringify(report, null, 2));
} else {
  for (const line of report.lines) {
    console.log(formatLine(line));
  }
  if (report.validationError) {
    console.error(report.validationError);
  }
}
process.exit(report.exitCode);
