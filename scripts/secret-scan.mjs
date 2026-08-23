#!/usr/bin/env node
// Zero-dependency secret scan over git-tracked files. Not a substitute for a
// dedicated scanner, but catches the obvious cases (committed .env, raw API
// keys, private key blocks) before they land in the repo.

import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const PATTERNS = [
  [/-----BEGIN [A-Z ]*PRIVATE KEY-----/, "private key block"],
  [/sk-ant-[a-zA-Z0-9_-]{10,}/, "Anthropic API key"],
  [/sk-[a-zA-Z0-9]{20,}/, "OpenAI-style API key"],
  [/AKIA[0-9A-Z]{16}/, "AWS access key ID"],
  [/xox[baprs]-[0-9a-zA-Z-]{10,}/, "Slack token"],
  [/gh[ps]_[a-zA-Z0-9]{30,}/, "GitHub token"],
];

const FORBIDDEN_NAMES = [/^\.env$/, /^\.env\.[^.]+$/];

const files = execFileSync("git", ["ls-files"], { encoding: "utf8" })
  .split("\n")
  .filter(Boolean);

let findings = [];

for (const file of files) {
  const base = file.split("/").pop() ?? file;
  if (FORBIDDEN_NAMES.some((re) => re.test(base)) && base !== ".env.example") {
    findings.push(`${file}: forbidden filename (looks like a real .env file)`);
    continue;
  }

  let content;
  try {
    content = readFileSync(file, "utf8");
  } catch {
    continue; // binary or unreadable; skip
  }

  for (const [pattern, label] of PATTERNS) {
    if (pattern.test(content)) {
      findings.push(`${file}: matched pattern for ${label}`);
    }
  }
}

if (findings.length > 0) {
  console.error("Secret scan FAILED:");
  for (const f of findings) console.error(`  - ${f}`);
  process.exit(1);
}

console.log(`Secret scan passed (${files.length} tracked files checked).`);
