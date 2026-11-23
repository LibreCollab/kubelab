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
  | {
      verb: "create";
      resource: "deployments";
      name: string;
      image: string;
      replicas: number;
      namespace: string;
    }
  | {
      verb: "expose";
      resource: "deployments" | "pods";
      name: string;
      serviceName: string;
      port: number;
      targetPort: number;
      serviceType: "ClusterIP" | "NodePort" | "LoadBalancer";
      namespace: string;
    }
  | { verb: "scale"; resource: "deployments"; name: string; replicas: number; namespace: string }
  | {
      verb: "set";
      resource: "deployments";
      name: string;
      container: string;
      image: string;
      namespace: string;
    }
  | {
      verb: "rollout";
      action: "status" | "undo";
      resource: "deployments";
      name: string;
      namespace: string;
    }
  | { verb: "delete"; resource: string; name: string; namespace: string }
  | { verb: "describe"; resource: string; name: string; namespace: string }
  | { verb: "help" };

export interface ParseError {
  error: string;
}

const OUTPUT_FORMATS = ["table", "wide", "yaml"] as const;
export const MAX_REPLICAS = 100;

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
  const base = resource.split(".")[0] ?? resource;

  switch (base) {
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
    case "rs":
    case "replicaset":
      return "replicasets";
    case "ep":
    case "endpoint":
      return "endpoints";
    default:
      return base;
  }
}

function unknownFlag(token: string): ParseError {
  return { error: `unknown flag: ${token.split("=")[0]}` };
}

function flagArgument(tokens: string[], index: number): string | undefined {
  const value = tokens[index + 1];
  return value === undefined || value.startsWith("-") ? undefined : value;
}

function parseNonNegativeInteger(value: string | undefined): number | undefined {
  if (value === undefined || !/^\d+$/.test(value)) {
    return undefined;
  }

  const parsed = Number(value);
  return Number.isSafeInteger(parsed) ? parsed : undefined;
}

function parsePositiveInteger(value: string | undefined): number | undefined {
  const parsed = parseNonNegativeInteger(value);
  return parsed !== undefined && parsed > 0 ? parsed : undefined;
}

function parseReplicaCount(value: string | undefined): number | undefined {
  const parsed = parseNonNegativeInteger(value);
  return parsed !== undefined && parsed <= MAX_REPLICAS ? parsed : undefined;
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

  const resourceToken = positional[0];
  if (resourceToken === undefined) {
    return { error: "you must specify the type of resource to get" };
  }

  let resource = resourceToken;
  let name = positional[1];

  if (resourceToken.includes("/")) {
    if (positional.length > 1) {
      return { error: "accepts at most a resource/name target" };
    }
    const parts = resourceToken.split("/");
    if (parts.length !== 2) {
      return { error: "invalid resource/name target" };
    }
    resource = parts[0] ?? "";
    name = parts[1] ?? "";
  } else if (positional.length > 2) {
    return { error: "accepts at most 2 arguments: resource and name" };
  }

  if (resource.length === 0 || name === "") {
    return { error: "invalid resource/name target" };
  }

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

  const targetArguments = positional[0]?.includes("/") ? 1 : 2;
  if (positional.length > targetArguments) {
    return { error: `${verb} accepts a resource and name` };
  }
  const target = splitTarget(positional);
  if ("error" in target) {
    return target;
  }

  return verb === "delete"
    ? { verb: "delete", resource: normalizeResource(target.resource), name: target.name, namespace }
    : {
        verb: "describe",
        resource: normalizeResource(target.resource),
        name: target.name,
        namespace,
      };
}

function splitTarget(positional: string[]): { resource: string; name: string } | ParseError {
  const first = positional[0];
  if (first === undefined) {
    return { error: "requires a resource and name" };
  }

  if (first.includes("/")) {
    const parts = first.split("/");
    if (parts.length !== 2) {
      return { error: "invalid resource/name target" };
    }
    const [resource, name] = parts;
    if (resource === undefined || name === undefined || name.length === 0) {
      return { error: "invalid resource/name target" };
    }
    return { resource, name };
  }

  const name = positional[1];
  if (name === undefined) {
    return { error: "requires a resource and name" };
  }
  return { resource: first, name };
}

function parseCreate(tokens: string[]): ParsedCommand | ParseError {
  let namespace = "default";
  let image: string | undefined;
  let replicas = 1;
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

    if (token === "--image" || token.startsWith("--image=")) {
      const value =
        token === "--image" ? flagArgument(tokens, index) : token.slice("--image=".length);
      if (value === undefined) {
        return { error: "flag needs an argument: --image" };
      }
      image = value;
      if (token === "--image") {
        index += 1;
      }
      continue;
    }

    if (token === "--replicas" || token.startsWith("--replicas=")) {
      const value =
        token === "--replicas" ? flagArgument(tokens, index) : token.slice("--replicas=".length);
      const parsed = parseReplicaCount(value);
      if (parsed === undefined) {
        return { error: `invalid --replicas value (max ${MAX_REPLICAS})` };
      }
      replicas = parsed;
      if (token === "--replicas") {
        index += 1;
      }
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
    return {
      error: "create deployment requires <name>: kubectl create deployment <name> --image=<image>",
    };
  }
  if (positional.length > 2) {
    return { error: "create deployment accepts exactly a Deployment name" };
  }
  if (normalizeResource(resource) !== "deployments") {
    return { error: `creating ${resource} is not simulated yet` };
  }
  if (image === undefined || image.length === 0) {
    return { error: "create deployment requires --image=<image>" };
  }

  return { verb: "create", resource: "deployments", name, image, replicas, namespace };
}

function parseExpose(tokens: string[]): ParsedCommand | ParseError {
  let namespace = "default";
  let port = 80;
  let targetPort: number | undefined;
  let serviceType: "ClusterIP" | "NodePort" | "LoadBalancer" = "ClusterIP";
  let serviceName: string | undefined;
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

    const flagValue = (name: string): string | undefined => {
      if (token === name) {
        return flagArgument(tokens, index);
      }
      if (token.startsWith(`${name}=`)) {
        return token.slice(name.length + 1);
      }
      return undefined;
    };

    if (token === "--port" || token.startsWith("--port=")) {
      const parsed = parsePositiveInteger(flagValue("--port"));
      if (parsed === undefined) {
        return { error: "invalid --port value" };
      }
      port = parsed;
      if (token === "--port") {
        index += 1;
      }
      continue;
    }

    if (token === "--target-port" || token.startsWith("--target-port=")) {
      const parsed = parsePositiveInteger(flagValue("--target-port"));
      if (parsed === undefined) {
        return { error: "invalid --target-port value" };
      }
      targetPort = parsed;
      if (token === "--target-port") {
        index += 1;
      }
      continue;
    }

    if (token === "--type" || token.startsWith("--type=")) {
      const value = flagValue("--type");
      if (value !== "ClusterIP" && value !== "NodePort" && value !== "LoadBalancer") {
        return { error: "invalid --type value" };
      }
      serviceType = value;
      if (token === "--type") {
        index += 1;
      }
      continue;
    }

    if (token === "--name" || token.startsWith("--name=")) {
      const value = flagValue("--name");
      if (value === undefined || value.length === 0) {
        return { error: "flag needs an argument: --name" };
      }
      serviceName = value;
      if (token === "--name") {
        index += 1;
      }
      continue;
    }

    if (token.startsWith("-")) {
      return unknownFlag(token);
    }

    positional.push(token);
  }

  const targetArguments = positional[0]?.includes("/") ? 1 : 2;
  if (positional.length > targetArguments) {
    return { error: "expose accepts a resource and name" };
  }
  const target = splitTarget(positional);
  if ("error" in target) {
    return target;
  }
  const normalized = normalizeResource(target.resource);
  if (normalized !== "deployments" && normalized !== "pods") {
    return { error: `exposing ${target.resource} is not simulated yet` };
  }

  return {
    verb: "expose",
    resource: normalized as "deployments" | "pods",
    name: target.name,
    serviceName: serviceName ?? target.name,
    port,
    targetPort: targetPort ?? port,
    serviceType,
    namespace,
  };
}

function parseScale(tokens: string[]): ParsedCommand | ParseError {
  let namespace = "default";
  let replicas: number | undefined;
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

    if (token === "--replicas" || token.startsWith("--replicas=")) {
      const value =
        token === "--replicas" ? flagArgument(tokens, index) : token.slice("--replicas=".length);
      const parsed = parseReplicaCount(value);
      if (parsed === undefined) {
        return { error: `invalid --replicas value (max ${MAX_REPLICAS})` };
      }
      replicas = parsed;
      if (token === "--replicas") {
        index += 1;
      }
      continue;
    }

    if (token.startsWith("-")) {
      return unknownFlag(token);
    }

    positional.push(token);
  }

  const targetArguments = positional[0]?.includes("/") ? 1 : 2;
  if (positional.length > targetArguments) {
    return { error: "scale accepts a Deployment and optional name" };
  }
  const target = splitTarget(positional);
  if ("error" in target) {
    return target;
  }
  if (normalizeResource(target.resource) !== "deployments") {
    return { error: `scaling ${target.resource} is not simulated yet` };
  }
  if (replicas === undefined) {
    return { error: "scale requires --replicas=<n>" };
  }

  return { verb: "scale", resource: "deployments", name: target.name, replicas, namespace };
}

function parseSet(tokens: string[]): ParsedCommand | ParseError {
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

  if (positional[0] !== "image") {
    return { error: "only `kubectl set image` is simulated" };
  }

  const rest = positional.slice(1);
  const target = splitTarget(rest);
  if ("error" in target) {
    return target;
  }
  if (normalizeResource(target.resource) !== "deployments") {
    return { error: "only Deployment image updates are simulated" };
  }

  const slashTarget = rest[0]?.includes("/") ?? false;
  if (rest.length > (slashTarget ? 2 : 3)) {
    return { error: "set image accepts one <container>=<image> assignment" };
  }
  const assignment = slashTarget ? rest[1] : rest[2];
  if (assignment === undefined) {
    return { error: "set image requires <container>=<image>" };
  }
  const equals = assignment.indexOf("=");
  if (equals <= 0 || equals === assignment.length - 1) {
    return { error: "set image requires <container>=<image>" };
  }
  const container = assignment.slice(0, equals);
  const image = assignment.slice(equals + 1);

  return {
    verb: "set",
    resource: "deployments",
    name: target.name,
    container,
    image,
    namespace,
  };
}

function parseRollout(tokens: string[]): ParsedCommand | ParseError {
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

  const action = positional[0];
  if (action !== "status" && action !== "undo") {
    return { error: "rollout supports: status, undo" };
  }
  const targetPositional = positional.slice(1);
  const targetArguments = targetPositional[0]?.includes("/") ? 1 : 2;
  if (targetPositional.length > targetArguments) {
    return { error: "rollout accepts a Deployment and optional name" };
  }
  const target = splitTarget(targetPositional);
  if ("error" in target) {
    return target;
  }
  if (normalizeResource(target.resource) !== "deployments") {
    return { error: "only Deployment rollouts are simulated" };
  }

  return {
    verb: "rollout",
    action,
    resource: "deployments",
    name: target.name,
    namespace,
  };
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
    case "create":
      return parseCreate(tokens);
    case "expose":
      return parseExpose(tokens);
    case "scale":
      return parseScale(tokens);
    case "set":
      return parseSet(tokens);
    case "rollout":
      return parseRollout(tokens);
    case "delete":
    case "describe":
      return parseTarget(tokens, verb);
    default:
      return { error: `unknown command "${verb}" for "kubectl" — try "kubectl help"` };
  }
}
