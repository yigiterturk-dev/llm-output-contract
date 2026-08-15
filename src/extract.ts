import type { CandidateSource } from "./types.js";

export interface JsonCandidate {
  text: string;
  source: CandidateSource;
}

function balancedAt(text: string, start: number): string | undefined {
  const opening = text[start];
  if (opening !== "{" && opening !== "[") return undefined;
  const stack: string[] = [opening];
  let inString = false;
  let escaped = false;

  for (let index = start + 1; index < text.length; index += 1) {
    const character = text[index];
    if (inString) {
      if (escaped) escaped = false;
      else if (character === "\\") escaped = true;
      else if (character === '"') inString = false;
      continue;
    }

    if (character === '"') {
      inString = true;
      continue;
    }
    if (character === "{" || character === "[") stack.push(character);
    else if (character === "}" || character === "]") {
      const expected = character === "}" ? "{" : "[";
      if (stack.at(-1) !== expected) return undefined;
      stack.pop();
      if (stack.length === 0) return text.slice(start, index + 1);
    }
  }
  return undefined;
}

function addCandidate(output: JsonCandidate[], seen: Set<string>, text: string, source: CandidateSource): void {
  const normalized = text.trim();
  if (!normalized || seen.has(normalized)) return;
  seen.add(normalized);
  output.push({ text: normalized, source });
}

export function extractJsonCandidates(text: string, maxCandidates = 20): JsonCandidate[] {
  const output: JsonCandidate[] = [];
  const seen = new Set<string>();
  const trimmed = text.trim();

  if (trimmed.startsWith("{") || trimmed.startsWith("[")) addCandidate(output, seen, trimmed, "raw");

  const fence = /```(?:json)?\s*([\s\S]*?)```/gi;
  for (const match of text.matchAll(fence)) {
    if (match[1]) addCandidate(output, seen, match[1], "fence");
    if (output.length >= maxCandidates) return output;
  }

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (character !== "{" && character !== "[") continue;
    const candidate = balancedAt(text, index);
    if (candidate) addCandidate(output, seen, candidate, "balanced");
    if (output.length >= maxCandidates) break;
  }

  return output;
}
