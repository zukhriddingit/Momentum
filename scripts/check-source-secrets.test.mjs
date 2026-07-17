import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const scannerPath = join(
  dirname(fileURLToPath(import.meta.url)),
  "check-source-secrets.mjs",
);

function run(command, arguments_, cwd) {
  return spawnSync(command, arguments_, {
    cwd,
    encoding: "utf8",
    shell: false,
  });
}

test("detects a credential after binary bytes in a tracked file over 2 MiB", async (t) => {
  const repository = await mkdtemp(join(tmpdir(), "momentum-secret-scan-"));
  t.after(async () => rm(repository, { recursive: true, force: true }));

  const initialized = run("git", ["init", "--quiet"], repository);
  assert.equal(initialized.status, 0, initialized.stderr);

  const fakeSecret = "sb_" + "secret_" + "z".repeat(24);
  const fixture = Buffer.concat([
    Buffer.from([0x00, 0xff, 0x0a]),
    Buffer.alloc(2 * 1024 * 1024 + 1, 0x61),
    Buffer.from("\n", "ascii"),
    Buffer.from(fakeSecret, "ascii"),
  ]);
  await writeFile(join(repository, "fixture.bin"), fixture);

  const staged = run("git", ["add", "fixture.bin"], repository);
  assert.equal(staged.status, 0, staged.stderr);

  const scanned = run(process.execPath, [scannerPath], repository);
  assert.equal(scanned.status, 1);
  assert.equal(scanned.stderr.trim(), "fixture.bin:3: Supabase secret key");
  assert.equal(scanned.stderr.includes(fakeSecret), false);
  assert.equal(scanned.stdout.includes(fakeSecret), false);
});
