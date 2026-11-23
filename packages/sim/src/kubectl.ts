export type OutputFormat = "table" | "wide" | "yaml";

export type ParsedCommand =
  | {
      verb: "get";
      resource: string;
      name?: string;
      namespace: string;
      allNamespaces: boolean;
      selector: Record<string, string>;
      showLabels: boolean;
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

function parseLabels(raw: string): Record<string, string> | undefined {
  const labels: Record<string, string> = {};

  for (const pair of raw.split(",")) {
    const parts = pair.split("=");
    if (parts.length !== 2) {
      return undefined;
    }

    const [key, value] = parts;
    if (key === undefined || key.length === 0 || value === undefined) {
      return undefined;
    }

    labels[key] = value;
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

function unknownFlag(token: string): ParseError {
  return { error: `unknown flag: ${token.split("=")[0]}` };
}

function parseGet(tokens: string[]): ParsedCommand | ParseError {
  let namespace = "default";
  let allNamespaces = false;
  let output: OutputFormat = "table";
  let selector: Record<string, string> = {};
  let showLabels = false;
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

    if (token.startsWith("-n=") || token.startsWith("--namespace=")) {
      namespace = token.slice(token.indexOf("=") + 1);
      continue;
    }

    if (token === "-l" || token === "--selector") {
      const value = tokens[index + 1];
      if (value === undefined) {
        return { error: `flag needs an argument: ${token}` };
      }
      const labels = parseLabels(value);
      if (labels === undefined) {
        return { error: `invalid label selector: "${value}"` };
      }
      selector = { ...selector, ...labels };
      index += 1;
      continue;
    }

    if (token.startsWith("--selector=")) {
      const value = token.slice("--selector=".length);
      const labels = parseLabels(value);
      if (labels === undefined) {
        return { error: `invalid label selector: "${value}"` };
      }
      selector = { ...selector, ...labels };
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

    if (token === "--show-labels") {
      showLabels = true;
      continue;
    }

    if (token.startsWith("-")) {
      return unknownFlag(token);
    }

    positional.push(token);
  }

  const resource = positional[0];
  if (resource === undefined) {
    return { error: "you must specify the type of resource to get" };
  }

  if (positional.length > 2) {
    return { error: "accepts at most 2 arguments: resource and name" };
  }

  const name = positional[1];
  return {
    verb: "get",
    resource: normalizeResource(resource),
    ...(name === undefined ? {} : { name }),
    namespace,
    allNamespaces,
    selector,
    showLabels,
    output,
  };
}

function parseRun(tokens: string[]): ParsedCommand | ParseError {
  let namespace = "default";
  let name: string | undefined;
  let image: string | undefined;
  const labels: Record<string, string> = {};

  for (let index = 2; index < tokens.length; index += 1) {
    const token = tokens[index];
    if (token === undefined) {
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

    if (token.startsWith("-n=") || token.startsWith("--namespace=")) {
      namespace = token.slice(token.indexOf("=") + 1);
      continue;
    }

    if (token === "--image") {
      const value = tokens[index + 1];
      if (value === undefined) {
        return { error: `flag needs an argument: ${token}` };
      }
      image = value;
      index += 1;
      continue;
    }

    if (token.startsWith("--image=")) {
      image = token.slice("--image=".length);
      continue;
    }

    if (token === "--labels" || token === "-l") {
      const value = tokens[index + 1];
      if (value === undefined) {
        return { error: `flag needs an argument: ${token}` };
      }
      const parsed = parseLabels(value);
      if (parsed === undefined) {
        return { error: `invalid labels: "${value}"` };
      }
      Object.assign(labels, parsed);
      index += 1;
      continue;
    }

    if (token.startsWith("--labels=")) {
      const value = token.slice("--labels=".length);
      const parsed = parseLabels(value);
      if (parsed === undefined) {
        return { error: `invalid labels: "${value}"` };
      }
      Object.assign(labels, parsed);
      continue;
    }

    if (token.startsWith("-")) {
      return unknownFlag(token);
    }

    if (name !== undefined) {
      return { error: `unexpected argument: ${token}` };
    }
    name = token;
  }

  if (name === undefined) {
    return { error: "run requires a name: kubectl run <name> --image=<image>" };
  }

  if (image === undefined || image.length === 0) {
    return { error: "run requires --image=<image>" };
  }

  return { verb: "run", name, image, labels, namespace };
}

function parseTarget(tokens: string[], verb: "delete" | "describe"): ParsedCommand | ParseError {
  let namespace = "default";
  const positional: string[] = [];

  for (let index = 2; index < tokens.length; index += 1) {
    const token = tokens[index];
    if (token === undefined) {
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

    if (token.startsWith("-n=") || token.startsWith("--namespace=")) {
      namespace = token.slice(token.indexOf("=") + 1);
      continue;
    }

    if (token.startsWith("-")) {
      return unknownFlag(token);
    }

    positional.push(token);
  }

  const resource = positional[0];
  const name = positional[1];
  if (resource === undefined || name === undefined) {
    return { error: `${verb} requires a resource and name: kubectl ${verb} pod <name>` };
  }

  if (positional.length > 2) {
    return { error: "accepts exactly 2 arguments: resource and name" };
  }

  return verb === "delete"
    ? { verb: "delete", resource: normalizeResource(resource), name, namespace }
    : { verb: "describe", resource: normalizeResource(resource), name, namespace };
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
  if (verb === undefined || verb === "help" || verb === "--help" || verb === "-h") {
    return { verb: "help" };
  }

  switch (verb) {
    case "get":
      return parseGet(tokens);
    case "run":
      return parseRun(tokens);
    case "delete":
    case "describe":
      return parseTarget(tokens, verb);
    default:
      return { error: `unknown command "${verb}" for "kubectl" — try "kubectl help"` };
  }
}
