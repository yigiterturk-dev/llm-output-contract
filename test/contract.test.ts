import assert from "node:assert/strict";
import test from "node:test";
import { createOutputContract } from "../src/contract.js";

interface Ticket {
  id: string;
  priority: "low" | "high";
}

const schema = {
  type: "object",
  properties: {
    id: { type: "string", minLength: 1 },
    priority: { type: "string", enum: ["low", "high"] }
  },
  required: ["id", "priority"],
  additionalProperties: false
} as const;

test("accepts raw JSON that satisfies the schema", () => {
  const result = createOutputContract<Ticket>(schema).parse('{"id":"T-1","priority":"high"}');
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.value.id, "T-1");
    assert.equal(result.meta.source, "raw");
  }
});

test("extracts fenced JSON from explanatory model text", () => {
  const result = createOutputContract<Ticket>(schema).parse('Result:\n```json\n{"id":"T-2","priority":"low"}\n```');
  assert.equal(result.ok, true);
  if (result.ok) assert.equal(result.meta.source, "fence");
});

test("extracts a balanced object without being confused by braces in strings", () => {
  const result = createOutputContract<Ticket>(schema).parse('Use this {"id":"brace-} still text","priority":"high"} thanks');
  assert.equal(result.ok, true);
  if (result.ok) assert.equal(result.value.id, "brace-} still text");
});

test("returns bounded schema errors without echoing rejected values", () => {
  const secretValue = "private-customer-value";
  const result = createOutputContract<Ticket>(schema).parse(JSON.stringify({ id: secretValue, priority: "urgent" }));
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.error.code, "SCHEMA_VALIDATION_FAILED");
    assert.ok(result.error.details.length > 0);
    assert.ok(!JSON.stringify(result).includes(secretValue));
  }
});

test("rejects prototype-pollution keys", () => {
  const result = createOutputContract<object>({ type: "object" }).parse('{"__proto__":{"admin":true}}');
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.error.code, "UNSAFE_KEY");
});

test("enforces input byte limits before extraction", () => {
  const result = createOutputContract<Ticket>(schema, { maxBytes: 10 }).parse('{"id":"T-3","priority":"low"}');
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.error.code, "INPUT_TOO_LARGE");
});

test("enforces maximum nesting depth", () => {
  const result = createOutputContract<object>({ type: "object" }, { maxDepth: 2 }).parse('{"a":{"b":{"c":1}}}');
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.error.code, "MAX_DEPTH_EXCEEDED");
});

test("distinguishes missing candidates from invalid JSON", () => {
  const contract = createOutputContract<Ticket>(schema);
  const missing = contract.parse("plain text only");
  const invalid = contract.parse("```json\n{not valid}\n```");
  assert.equal(missing.ok, false);
  assert.equal(invalid.ok, false);
  if (!missing.ok) assert.equal(missing.error.code, "NO_JSON_CANDIDATE");
  if (!invalid.ok) assert.equal(invalid.error.code, "INVALID_JSON");
});
