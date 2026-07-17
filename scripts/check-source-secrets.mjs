import { spawnSync } from "node:child_process";
import { lstat, readFile } from "node:fs/promises";

const rules = [
  { name: "Supabase secret key", pattern: /\bsb_secret_[A-Za-z0-9_-]{20,}\b/g },
  {
    name: "JWT-like service credential",
    pattern:
      /\beyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\b/g,
  },
  { name: "Resend live key", pattern: /\bre_[A-Za-z0-9_-]{20,}\b/g },
  { name: "Twilio live key", pattern: /\bSK[0-9a-fA-F]{32}\b/g },
  {
    name: "Private key",
    pattern: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/g,
  },
];

const listed = spawnSync("git", ["ls-files", "-z"], {
  encoding: "utf8",
  shell: false,
});
if (listed.status !== 0) {
  throw new Error("Could not list tracked files for the secret scan.");
}

const findings = [];
const files = listed.stdout.split("\0").filter(Boolean);
for (const file of files) {
  let metadata;
  try {
    metadata = await lstat(file);
  } catch {
    throw new Error(`Could not inspect tracked path: ${JSON.stringify(file)}.`);
  }
  if (!metadata.isFile()) {
    throw new Error(
      `Tracked path is not a regular file: ${JSON.stringify(file)}.`,
    );
  }

  let buffer;
  try {
    buffer = await readFile(file);
  } catch {
    throw new Error(`Could not read tracked file: ${JSON.stringify(file)}.`);
  }

  // Every byte maps to one character, so ASCII credentials and byte-accurate
  // line offsets remain detectable even in binary or invalid UTF-8 content.
  const text = buffer.toString("latin1");
  for (const rule of rules) {
    const pattern = new RegExp(rule.pattern.source, rule.pattern.flags);
    for (const match of text.matchAll(pattern)) {
      const line = text.slice(0, match.index).split("\n").length;
      findings.push({ file, line, rule: rule.name });
    }
  }
}

if (findings.length > 0) {
  for (const finding of findings) {
    console.error(`${finding.file}:${finding.line}: ${finding.rule}`);
  }
  process.exitCode = 1;
} else {
  console.info("Tracked-source secret scan passed.");
}
