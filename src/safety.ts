const UNSAFE_KEYS = new Set(["__proto__", "prototype", "constructor"]);

export interface SafetyIssue {
  code: "UNSAFE_KEY" | "MAX_DEPTH_EXCEEDED";
  path: string;
}

export function inspectStructure(value: unknown, maxDepth: number): SafetyIssue | undefined {
  const seen = new WeakSet<object>();

  function visit(current: unknown, path: string, depth: number): SafetyIssue | undefined {
    if (depth > maxDepth) return { code: "MAX_DEPTH_EXCEEDED", path };
    if (current === null || typeof current !== "object") return undefined;
    if (seen.has(current)) return undefined;
    seen.add(current);

    if (Array.isArray(current)) {
      for (let index = 0; index < current.length; index += 1) {
        const issue = visit(current[index], `${path}/${index}`, depth + 1);
        if (issue) return issue;
      }
      return undefined;
    }

    for (const key of Object.keys(current)) {
      const childPath = `${path}/${key.replaceAll("~", "~0").replaceAll("/", "~1")}`;
      if (UNSAFE_KEYS.has(key)) return { code: "UNSAFE_KEY", path: childPath };
      const issue = visit((current as Record<string, unknown>)[key], childPath, depth + 1);
      if (issue) return issue;
    }
    return undefined;
  }

  return visit(value, "", 0);
}
