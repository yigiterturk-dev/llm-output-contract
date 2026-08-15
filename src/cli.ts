#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createOutputContract } from "./contract.js";

const HELP = `llm-output-contract — validate untrusted LLM text against JSON Schema

Usage:
  llm-output-contract --schema schema.json [--input response.txt] [--max-bytes number] [--compact]

If --input is omitted, input is read from stdin.

Options:
  --schema     JSON Schema file (required)
  --input      LLM response text file
  --max-bytes  Maximum accepted UTF-8 input size (default: 262144)
  --compact    Emit compact JSON
  --help       Show help
  --version    Show version
`;

interface CliOptions {
  schema: string;
  input?: string;
  maxBytes?: number;
  compact: boolean;
}

function nextValue(args: string[], index: number, flag: string): string {
  const value = args[index + 1];
  if (!value || value.startsWith("--")) throw new Error(`Missing value for ${flag}`);
  return value;
}

function parseArgs(args: string[]): CliOptions {
  let schema = "";
  let input: string | undefined;
  let maxBytes: number | undefined;
  let compact = false;
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--schema") {
      schema = nextValue(args, index, arg);
      index += 1;
    } else if (arg === "--input") {
      input = nextValue(args, index, arg);
      index += 1;
    } else if (arg === "--max-bytes") {
      maxBytes = Number(nextValue(args, index, arg));
      index += 1;
    } else if (arg === "--compact") compact = true;
    else throw new Error(`Unknown option: ${arg}`);
  }
  if (!schema) throw new Error("--schema is required.");
  if (maxBytes !== undefined && (!Number.isInteger(maxBytes) || maxBytes <= 0)) throw new Error("--max-bytes must be a positive integer.");
  const base = input ? { schema, input, compact } : { schema, compact };
  return maxBytes === undefined ? base : { ...base, maxBytes };
}

function main(): void {
  const args = process.argv.slice(2);
  if (args.includes("--help")) {
    process.stdout.write(HELP);
    return;
  }
  if (args.includes("--version")) {
    process.stdout.write("0.1.0\n");
    return;
  }

  try {
    const options = parseArgs(args);
    const schema = JSON.parse(readFileSync(resolve(options.schema), "utf8")) as object;
    const input = options.input ? readFileSync(resolve(options.input), "utf8") : readFileSync(0, "utf8");
    const contract = createOutputContract(schema, options.maxBytes === undefined ? {} : { maxBytes: options.maxBytes });
    const result = contract.parse(input);
    process.stdout.write(JSON.stringify(result, null, options.compact ? 0 : 2) + "\n");
    process.exitCode = result.ok ? 0 : 1;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`llm-output-contract: ${message}\n`);
    process.exitCode = 2;
  }
}

main();
