export type OutputFormat = "table" | "wide" | "yaml";

export type ParsedCommand =
  | {
      verb: "get";
      resource: string;
      name?: string;
      namespace: string;
      allNamespaces: boolean;
      selector: Record<string, string>;
      output: OutputFormat;
    }
  | {
      verb: "run";
      name: string;
      image: string;
      labels: Record<string, string>;
      namespace: string;
    }
  | { verb: "delete"; resource: string; name: string; namespace: string }
  | { verb: "describe"; resource: string; name: string; namespace: string }
  | { verb: "help" };

export interface ParseError {
  error: string;
}

const OUTPUT_FORMATS = ["table", "wide", "yaml"] as const;

function parseOutput(value: string): OutputFormat | undefined {
  return (OUTPUT_FORMATS as readonly string[]).includes(value)
    ? (value as OutputFormat)
    : undefined;
}

function tokenize(input: string): string[] {
  const tokens: string[] = [];
  let current = "";
  let quote: string | null = null;
  let hasToken = false;

  for (const char of input.trim()) {
    if (quote !== null) {
      if (char === quote) {
        quote = null;
      } else {
        current += char;
      }
      hasToken = true;
      continue;
    }

    if (char === '"' || char === "'") {
      quote = char;
      hasToken = true;
      continue;
    }

    if (/\s/.test(char)) {
      if (hasToken) {
        tokens.push(current);
        current = "";
        hasToken = false;
      }
      continue;
    }

    current += char;
    hasToken = true;
  }

  if (hasToken) {
    tokens.push(current);
  }

  return tokens;
}

function parseLabels(raw: string): Record<string, string> {
  const labels: Record<string, string> = {};

  for (const pair of raw.split(",")) {
    const [key, value] = pair.split("=");
    if (key !== undefined && value !== undefined && key.length > 0) {
      labels[key] = value;
    }
  }

  return labels;
}

function normalizeResource(resource: string): string {
  switch (resource) {
    case "po":
    case "pod":
      return "pods";
    case "no":
    case "node":
      return "nodes";
    case "svc":
    case "service":
      return "services";
    case "deploy":
    case "deployment":
      return "deployments";
    default:
      return resource;
  }
}

export function parseKubectl(input: string): ParsedCommand | ParseError {
  const tokens = tokenize(input);

  if (tokens.length === 0) {
    return { verb: "help" };
  }

  const binary = tokens[0];
  if (binary !== "kubectl" && binary !== "k") {
    return { error: `unknown command "${binary ?? ""}" — try "kubectl help"` };
  }

  const verb = tokens[1];
  if (verb === undefined || verb === "help") {
    return { verb: "help" };
  }

  let namespace = "default";
  let allNamespaces = false;
  let output: OutputFormat = "table";
  let selector: Record<string, string> = {};
  const positional: string[] = [];

  for (let index = 2; index < tokens.length; index += 1) {
    const token = tokens[index];
    if (token === undefined) {
      continue;
    }

    if (token === "-A" || token === "--all-namespaces") {
      allNamespaces = true;
      continue;
    }

    if (token === "-n" || token === "--namespace") {
      const value = tokens[index + 1];
      if (value === undefined) {
        return { error: `flag needs an argument: ${token}` };
      }
      namespace = value;
      index += 1;
      continue;
    }

    if (token.startsWith("--namespace=")) {
      namespace = token.slice("--namespace=".length);
      continue;
    }

    if (verb === "get" && (token === "-l" || token === "--selector")) {
      const value = tokens[index + 1];
      if (value === undefined) {
        return { error: `flag needs an argument: ${token}` };
      }
      selector = { ...selector, ...parseLabels(value) };
      index += 1;
      continue;
    }

    if (token.startsWith("--selector=")) {
      selector = { ...selector, ...parseLabels(token.slice("--selector=".length)) };
      continue;
    }

    if (token === "-o" || token === "--output") {
      const value = tokens[index + 1];
      if (value === undefined) {
        return { error: `flag needs an argument: ${token}` };
      }
      const format = parseOutput(value);
      if (format === undefined) {
        return { error: `unsupported output format "${value}" (use table, wide, or yaml)` };
      }
      output = format;
      index += 1;
      continue;
    }

    if (token.startsWith("--output=") || token.startsWith("-o=")) {
      const value = token.slice(token.indexOf("=") + 1);
      const format = parseOutput(value);
      if (format === undefined) {
        return { error: `unsupported output format "${value}" (use table, wide, or yaml)` };
      }
      output = format;
      continue;
    }

    if (token.startsWith("-")) {
      continue;
    }

    positional.push(token);
  }

  if (verb === "get") {
    const resource = positional[0];
    if (resource === undefined) {
      return { error: "you must specify the type of resource to get" };
    }

    const name = positional[1];
    return {
      verb: "get",
      resource: normalizeResource(resource),
      ...(name === undefined ? {} : { name }),
      namespace,
      allNamespaces,
      selector,
      output,
    };
  }

  if (verb === "run") {
    const name = positional[0];
    if (name === undefined) {
      return { error: "run requires a name: kubectl run <name> --image=<image>" };
    }

    let image: string | undefined;
    const labels: Record<string, string> = {};

    for (let index = 3; index < tokens.length; index += 1) {
      const token = tokens[index];
      if (token === undefined) {
        continue;
      }

      if (token.startsWith("--image=")) {
        image = token.slice("--image=".length);
        continue;
      }

      if (token === "--image") {
        image = tokens[index + 1];
        index += 1;
        continue;
      }

      if (token.startsWith("--labels=")) {
        Object.assign(labels, parseLabels(token.slice("--labels=".length)));
        continue;
      }

      if (token === "--labels" || token === "-l") {
        const value = tokens[index + 1];
        if (value !== undefined) {
          Object.assign(labels, parseLabels(value));
        }
        index += 1;
      }
    }

    if (image === undefined || image.length === 0) {
      return { error: "run requires --image=<image>" };
    }

    return { verb: "run", name, image, labels, namespace };
  }

  if (verb === "delete") {
    const resource = positional[0];
    const name = positional[1];
    if (resource === undefined || name === undefined) {
      return { error: "delete requires a resource and name: kubectl delete pod <name>" };
    }
    return { verb: "delete", resource: normalizeResource(resource), name, namespace };
  }

  if (verb === "describe") {
    const resource = positional[0];
    const name = positional[1];
    if (resource === undefined || name === undefined) {
      return { error: "describe requires a resource and name: kubectl describe pod <name>" };
    }
    return { verb: "describe", resource: normalizeResource(resource), name, namespace };
  }

  return { error: `unknown command "${verb}" for "kubectl" — try "kubectl help"` };
}
