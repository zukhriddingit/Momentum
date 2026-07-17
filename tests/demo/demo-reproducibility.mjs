import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";

import { EXPECTED_DEMO_FIXTURE_SUMMARY } from "../../scripts/lib/demo-fixture.mjs";
import { provisionDemo } from "../../scripts/provision-demo.mjs";
import "./provision-demo-safety.mjs";

function resetLocalWithoutSeed() {
  const result = spawnSync(
    "pnpm",
    ["exec", "supabase", "db", "reset", "--local", "--no-seed"],
    { stdio: "inherit", shell: false },
  );
  assert.equal(result.status, 0, "local Supabase reset must succeed");
}

const summaries = [];
for (let attempt = 0; attempt < 2; attempt += 1) {
  resetLocalWithoutSeed();
  summaries.push(await provisionDemo({ allowLocal: true }));
}

assert.deepEqual(summaries[1], summaries[0]);
assert.deepEqual(summaries[0], EXPECTED_DEMO_FIXTURE_SUMMARY);
