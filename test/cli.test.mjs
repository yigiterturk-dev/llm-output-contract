import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";

test("CLI validates a response file and emits structured JSON", () => {
  const root = mkdtempSync(join(tmpdir(), "llm-contract-cli-"));
  const schema = join(root, "schema.json");
  const input = join(root, "response.txt");
  writeFileSync(schema, JSON.stringify({ type: "object", properties: { ok: { type: "boolean" } }, required: ["ok"], additionalProperties: false }));
  writeFileSync(input, 'Model answer: {"ok":true}');
  const run = spawnSync(process.execPath, ["dist/cli.js", "--schema", schema, "--input", input], { encoding: "utf8" });
  assert.equal(run.status, 0, run.stderr);
  const result = JSON.parse(run.stdout);
  assert.equal(result.ok, true);
  assert.equal(result.value.ok, true);
});
