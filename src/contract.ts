import { type JSONSchemaType, type ValidateFunction } from "ajv";
import { Ajv2020 } from "ajv/dist/2020.js";
import { extractJsonCandidates } from "./extract.js";
import { inspectStructure } from "./safety.js";
import type { AjvErrors, ContractFailure, ContractOptions, ContractResult, OutputContract, SafeValidationError } from "./types.js";

const DEFAULT_MAX_BYTES = 256 * 1024;
const DEFAULT_MAX_DEPTH = 64;
const DEFAULT_MAX_CANDIDATES = 20;

function safeAjvErrors(errors: AjvErrors): SafeValidationError[] {
  return (errors ?? []).map((error) => ({
    instancePath: error.instancePath,
    schemaPath: error.schemaPath,
    keyword: error.keyword,
    message: error.message ?? "Schema validation failed."
  }));
}

function failure(code: ContractFailure["error"]["code"], message: string, details: SafeValidationError[] = []): ContractFailure {
  return { ok: false, error: { code, message, details } };
}

export function createOutputContract<T>(schema: JSONSchemaType<T> | object, options: ContractOptions = {}): OutputContract<T> {
  const maxBytes = options.maxBytes ?? DEFAULT_MAX_BYTES;
  const maxDepth = options.maxDepth ?? DEFAULT_MAX_DEPTH;
  const maxCandidates = options.maxCandidates ?? DEFAULT_MAX_CANDIDATES;
  if (!Number.isInteger(maxBytes) || maxBytes <= 0) throw new Error("maxBytes must be a positive integer.");
  if (!Number.isInteger(maxDepth) || maxDepth <= 0) throw new Error("maxDepth must be a positive integer.");
  if (!Number.isInteger(maxCandidates) || maxCandidates <= 0) throw new Error("maxCandidates must be a positive integer.");

  const ajv = new Ajv2020({ allErrors: true, strict: true });
  const validate = ajv.compile(schema) as ValidateFunction<T>;

  return {
    schema,
    parse(text: string): ContractResult<T> {
      const inputBytes = Buffer.byteLength(text, "utf8");
      if (inputBytes > maxBytes) {
        return failure("INPUT_TOO_LARGE", `Input exceeds the configured ${maxBytes}-byte limit.`);
      }

      const candidates = extractJsonCandidates(text, maxCandidates);
      if (candidates.length === 0) return failure("NO_JSON_CANDIDATE", "No complete JSON object or array was found.");

      let parsedAny = false;
      let lastValidationErrors: SafeValidationError[] = [];
      for (let index = 0; index < candidates.length; index += 1) {
        const candidate = candidates[index];
        if (!candidate) continue;
        let value: unknown;
        try {
          value = JSON.parse(candidate.text) as unknown;
          parsedAny = true;
        } catch {
          continue;
        }

        const safetyIssue = inspectStructure(value, maxDepth);
        if (safetyIssue?.code === "UNSAFE_KEY") {
          return failure("UNSAFE_KEY", `A forbidden object key was found at ${safetyIssue.path || "/"}.`);
        }
        if (safetyIssue?.code === "MAX_DEPTH_EXCEEDED") {
          return failure("MAX_DEPTH_EXCEEDED", `JSON nesting exceeds the configured depth at ${safetyIssue.path || "/"}.`);
        }

        if (validate(value)) {
          return { ok: true, value, meta: { source: candidate.source, inputBytes, candidateIndex: index } };
        }
        lastValidationErrors = safeAjvErrors(validate.errors);
      }

      if (!parsedAny) return failure("INVALID_JSON", "JSON candidates were found but none could be parsed.");
      return failure("SCHEMA_VALIDATION_FAILED", "Parsed JSON did not satisfy the configured schema.", lastValidationErrors);
    }
  };
}
