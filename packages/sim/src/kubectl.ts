import type { IngressRule } from "./types";

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
      verb: "create";
      resource: "ingresses";
      name: string;
      rule: IngressRule;
      ingressClassName?: string;
      namespace: string;
    }
  | {
      verb: "create";
      resource: "configmaps";
      name: string;
      data: Record<string, string>;
      namespace: string;
    }
  | {
      verb: "create";
      resource: "secrets";
      name: string;
      data: Record<string, string>;
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
      action: "image";
      resource: "deployments";
      name: string;
      container: string;
      image: string;
      namespace: string;
    }
  | {
      verb: "set";
      action: "env";
      resource: "deployments";
      name: string;
      fromKind: "ConfigMap" | "Secret";
      fromName: string;
      namespace: string;
    }
  | {
      verb: "rollout";
      action: "status" | "undo";
      resource: "deployments";
      name: string;
      namespace: string;
    }
  | {
      verb: "top";
      resource: "pods" | "nodes";
      name?: string;
      namespace: string;
      allNamespaces: boolean;
    }
  | {
      verb: "exec";
      name: string;
      command: string;
      args: string[];
      namespace: string;
    }
  | {
      verb: "logs";
      name: string;
      container?: string;
      namespace: string;
      follow: boolean;
    }
  | {
      verb: "auth";
      action: "can-i";
      subjectVerb: string;
      subjectResource: string;
      as?: string;
      namespace: string;
    }
  | {
      verb: "helm";
      action: "list" | "status" | "history" | "install" | "upgrade" | "rollback";
      name?: string;
      chart?: string;
      values?: Record<string, string>;
      revision?: number;
      namespace: string;
    }
  | {
      verb: "argocd";
      action: "list" | "get" | "sync";
      name?: string;
      namespace: string;
    }
  | { verb: "kustomize"; path: string }
  | {
      verb: "apply";
      file?: string;
      path?: string;
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
    case "ds":
    case "daemonset":
      return "daemonsets";
    case "sts":
    case "statefulset":
      return "statefulsets";
    case "job":
      return "jobs";
    case "cronjob":
    case "cj":
      return "cronjobs";
    case "ep":
    case "endpoint":
      return "endpoints";
    case "ing":
    case "ingress":
      return "ingresses";
    case "cm":
    case "configmap":
      return "configmaps";
    case "secret":
      return "secrets";
    case "pv":
    case "persistentvolume":
      return "persistentvolumes";
    case "pvc":
    case "persistentvolumeclaim":
      return "persistentvolumeclaims";
    case "sc":
    case "storageclass":
      return "storageclasses";
    case "netpol":
    case "networkpolicy":
      return "networkpolicies";
    case "resourcequota":
    case "quota":
      return "resourcequotas";
    case "limitrange":
    case "limits":
      return "limitranges";
    case "poddisruptionbudget":
    case "pdb":
      return "poddisruptionbudgets";
    case "sa":
    case "serviceaccount":
      return "serviceaccounts";
    case "role":
      return "roles";
    case "rolebinding":
      return "rolebindings";
    case "clusterrole":
      return "clusterroles";
    case "clusterrolebinding":
      return "clusterrolebindings";
    case "ns":
    case "namespace":
      return "namespaces";
    case "hpa":
    case "horizontalpodautoscaler":
      return "horizontalpodautoscalers";
    case "ev":
    case "event":
      return "events";
    case "widget":
      return "widgets";
    default:
      return base;
  }
}

function unknownFlag(token: string): ParseError {
  return { error: `unknown flag: ${token.split("=")[0]}` };
}

function parseLiteral(raw: string): { name: string; value: string } | ParseError {
  const equals = raw.indexOf("=");
  if (equals <= 0) {
    return { error: `invalid literal "${raw}": use KEY=VALUE` };
  }
  return {
    name: raw.slice(0, equals),
    value: raw.slice(equals + 1),
  };
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

function parseTop(tokens: string[]): ParsedCommand | ParseError {
  let namespace = "default";
  let allNamespaces = false;
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
      const value = flagArgument(tokens, index);
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

  const resource = normalizeResource(positional[0] ?? "");
  if (resource !== "pods" && resource !== "nodes") {
    return { error: "top supports pods and nodes" };
  }
  if (positional.length > 2) {
    return { error: "accepts at most a resource and optional name" };
  }

  return {
    verb: "top",
    resource,
    ...(positional[1] === undefined ? {} : { name: positional[1] }),
    namespace,
    allNamespaces,
  };
}

function parseExec(tokens: string[]): ParsedCommand | ParseError {
  let namespace = "default";
  let name: string | undefined;

  for (let index = 2; index < tokens.length; index += 1) {
    const token = tokens[index];
    if (token === undefined) {
      continue;
    }

    if (token === "-n" || token === "--namespace") {
      const value = flagArgument(tokens, index);
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

    if (token === "--") {
      const executable = tokens[index + 1];
      if (name === undefined) {
        return { error: "exec requires a Pod name: kubectl exec <pod> -- <command>" };
      }
      if (executable === undefined) {
        return { error: "exec requires a command after --" };
      }
      return {
        verb: "exec",
        name,
        command: executable,
        args: tokens.slice(index + 2),
        namespace,
      };
    }

    if (token.startsWith("-")) {
      return unknownFlag(token);
    }

    if (name !== undefined) {
      return { error: "exec accepts one Pod name" };
    }
    name = token;
  }

  if (name === undefined) {
    return { error: "exec requires a Pod name: kubectl exec <pod> -- <command>" };
  }

  return { error: "exec requires a command after --" };
}

function parseLogs(tokens: string[]): ParsedCommand | ParseError {
  let namespace = "default";
  let container: string | undefined;
  let follow = false;
  const positional: string[] = [];

  for (let index = 2; index < tokens.length; index += 1) {
    const token = tokens[index];
    if (token === undefined) {
      continue;
    }

    if (token === "-n" || token === "--namespace") {
      const value = flagArgument(tokens, index);
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

    if (token === "-c" || token === "--container") {
      const value = flagArgument(tokens, index);
      if (value === undefined) {
        return { error: `flag needs an argument: ${token}` };
      }
      container = value;
      index += 1;
      continue;
    }

    if (token.startsWith("--container=")) {
      container = token.slice("--container=".length);
      continue;
    }

    if (token === "-f" || token === "--follow") {
      follow = true;
      continue;
    }

    if (token.startsWith("-")) {
      return unknownFlag(token);
    }

    positional.push(token);
  }

  const name = positional[0];
  if (name === undefined || positional.length > 1) {
    return { error: "logs requires exactly one Pod name" };
  }

  return {
    verb: "logs",
    name,
    ...(container === undefined ? {} : { container }),
    namespace,
    follow,
  };
}

function parseAuth(tokens: string[]): ParsedCommand | ParseError {
  let namespace = "default";
  let as: string | undefined;
  const positional: string[] = [];

  for (let index = 2; index < tokens.length; index += 1) {
    const token = tokens[index];
    if (token === undefined) {
      continue;
    }

    if (token === "-n" || token === "--namespace") {
      const value = flagArgument(tokens, index);
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

    if (token === "--as" || token.startsWith("--as=")) {
      const value = token === "--as" ? flagArgument(tokens, index) : token.slice("--as=".length);
      if (value === undefined) {
        return { error: "flag needs an argument: --as" };
      }
      as = value;
      if (token === "--as") {
        index += 1;
      }
      continue;
    }

    if (token.startsWith("-")) {
      return unknownFlag(token);
    }

    positional.push(token);
  }

  if (positional[0] !== "can-i" || positional.length !== 3) {
    return { error: "only `kubectl auth can-i <verb> <resource>` is simulated" };
  }

  return {
    verb: "auth",
    action: "can-i",
    subjectVerb: positional[1] ?? "",
    subjectResource: normalizeResource(positional[2] ?? ""),
    ...(as === undefined ? {} : { as }),
    namespace,
  };
}

function parseHelm(tokens: string[]): ParsedCommand | ParseError {
  let namespace = "default";
  const values: Record<string, string> = {};
  const positional: string[] = [];

  for (let index = 1; index < tokens.length; index += 1) {
    const token = tokens[index];
    if (token === undefined) {
      continue;
    }
    if (token === "-n" || token === "--namespace") {
      const value = flagArgument(tokens, index);
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
    if (token === "--set" || token.startsWith("--set=")) {
      const value = token === "--set" ? flagArgument(tokens, index) : token.slice("--set=".length);
      if (value === undefined) {
        return { error: "flag needs an argument: --set" };
      }
      const literal = parseLiteral(value);
      if ("error" in literal) {
        return literal;
      }
      values[literal.name] = literal.value;
      if (token === "--set") {
        index += 1;
      }
      continue;
    }
    if (token.startsWith("-")) {
      return unknownFlag(token);
    }
    positional.push(token);
  }

  const action = positional[0];
  if (
    action !== "list" &&
    action !== "status" &&
    action !== "history" &&
    action !== "install" &&
    action !== "upgrade" &&
    action !== "rollback"
  ) {
    return { error: "helm supports: list, status, history, install, upgrade, rollback" };
  }
  if (action === "list") {
    if (positional.length > 1) {
      return { error: "helm list accepts no name" };
    }
    return { verb: "helm", action, namespace };
  }
  if (action === "status" || action === "history") {
    if (positional[1] === undefined) {
      return { error: `helm ${action} requires a release name` };
    }
    return { verb: "helm", action, name: positional[1], namespace };
  }
  if (action === "rollback") {
    const name = positional[1];
    const revision = parsePositiveInteger(positional[2]);
    if (name === undefined || revision === undefined) {
      return { error: "helm rollback requires <name> <revision>" };
    }
    return { verb: "helm", action, name, revision, namespace };
  }
  const name = positional[1];
  const chart = positional[2];
  if (name === undefined || chart === undefined) {
    return { error: `helm ${action} requires <name> <chart>` };
  }
  if (positional.length > 3) {
    return { error: `helm ${action} accepts one chart` };
  }
  return {
    verb: "helm",
    action,
    name,
    chart,
    ...(Object.keys(values).length === 0 ? {} : { values }),
    namespace,
  };
}

function parseArgocd(tokens: string[]): ParsedCommand | ParseError {
  let namespace = "default";
  const positional: string[] = [];

  for (let index = 1; index < tokens.length; index += 1) {
    const token = tokens[index];
    if (token === undefined) {
      continue;
    }
    if (token === "-n" || token === "--namespace") {
      const value = flagArgument(tokens, index);
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

  if (positional[0] !== "app") {
    return { error: "argocd supports: app list, app get <name>" };
  }
  const action = positional[1];
  if (action !== "list" && action !== "get" && action !== "sync") {
    return { error: "argocd app supports: list, get, sync" };
  }
  if (action === "list" && positional.length !== 2) {
    return { error: "argocd app list accepts no name" };
  }
  if ((action === "get" || action === "sync") && positional[2] === undefined) {
    return { error: `argocd app ${action} requires a name` };
  }

  return {
    verb: "argocd",
    action,
    ...(action === "list" ? {} : { name: positional[2] }),
    namespace,
  };
}

function parseKustomize(tokens: string[]): ParsedCommand | ParseError {
  const path = tokens[2];
  if (path === undefined || tokens.length > 3) {
    return { error: "kustomize requires exactly one directory" };
  }
  return { verb: "kustomize", path };
}

export function parseCommand(input: string): ParsedCommand | ParseError {
  const tokens = tokenize(input);
  if (tokens[0] === "helm") {
    return parseHelm(tokens);
  }
  if (tokens[0] === "argocd") {
    return parseArgocd(tokens);
  }
  return parseKubectl(input);
}

function parseApply(tokens: string[]): ParsedCommand | ParseError {
  let namespace = "default";
  let file: string | undefined;
  let path: string | undefined;

  for (let index = 2; index < tokens.length; index += 1) {
    const token = tokens[index];
    if (token === undefined) {
      continue;
    }
    if (token === "-n" || token === "--namespace") {
      const value = flagArgument(tokens, index);
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
    if (token === "-f" || token === "--filename") {
      const value = flagArgument(tokens, index);
      if (value === undefined) {
        return { error: `flag needs an argument: ${token}` };
      }
      file = value;
      index += 1;
      continue;
    }
    if (token.startsWith("--filename=")) {
      file = token.slice("--filename=".length);
      continue;
    }
    if (token === "-k" || token === "--kustomize") {
      const value = flagArgument(tokens, index);
      if (value === undefined) {
        return { error: `flag needs an argument: ${token}` };
      }
      path = value;
      index += 1;
      continue;
    }
    if (token.startsWith("--kustomize=")) {
      path = token.slice("--kustomize=".length);
      continue;
    }
    return unknownFlag(token);
  }

  if ((file === undefined) === (path === undefined)) {
    return { error: "apply requires exactly one of -f <file> or -k <dir>" };
  }

  return {
    verb: "apply",
    ...(file === undefined ? {} : { file }),
    ...(path === undefined ? {} : { path }),
    namespace,
  };
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

function parseCreateConfigMap(tokens: string[]): ParsedCommand | ParseError {
  let namespace = "default";
  const data: Record<string, string> = {};
  const positional: string[] = [];

  for (let index = 2; index < tokens.length; index += 1) {
    const token = tokens[index];
    if (token === undefined) {
      continue;
    }

    if (token === "-n" || token === "--namespace") {
      const value = flagArgument(tokens, index);
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

    if (token === "--from-literal" || token.startsWith("--from-literal=")) {
      const value =
        token === "--from-literal"
          ? flagArgument(tokens, index)
          : token.slice("--from-literal=".length);
      if (value === undefined) {
        return { error: "flag needs an argument: --from-literal" };
      }
      const literal = parseLiteral(value);
      if ("error" in literal) {
        return literal;
      }
      data[literal.name] = literal.value;
      if (token === "--from-literal") {
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
    return { error: "create configmap requires <name> --from-literal=KEY=VALUE" };
  }
  if (positional.length > 2) {
    return { error: "create configmap accepts exactly a ConfigMap name" };
  }
  if (Object.keys(data).length === 0) {
    return { error: "create configmap requires at least one --from-literal" };
  }

  return { verb: "create", resource: "configmaps", name, data, namespace };
}

function parseCreateSecret(tokens: string[]): ParsedCommand | ParseError {
  let namespace = "default";
  const data: Record<string, string> = {};
  const positional: string[] = [];

  for (let index = 2; index < tokens.length; index += 1) {
    const token = tokens[index];
    if (token === undefined) {
      continue;
    }

    if (token === "-n" || token === "--namespace") {
      const value = flagArgument(tokens, index);
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

    if (token === "--from-literal" || token.startsWith("--from-literal=")) {
      const value =
        token === "--from-literal"
          ? flagArgument(tokens, index)
          : token.slice("--from-literal=".length);
      if (value === undefined) {
        return { error: "flag needs an argument: --from-literal" };
      }
      const literal = parseLiteral(value);
      if ("error" in literal) {
        return literal;
      }
      data[literal.name] = literal.value;
      if (token === "--from-literal") {
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
  if (resource === undefined) {
    return { error: "create secret requires generic <name> --from-literal=KEY=VALUE" };
  }
  const generic = positional[1] === "generic";
  const name = generic ? positional[2] : undefined;
  if (!generic || name === undefined) {
    return { error: "create secret requires generic <name> --from-literal=KEY=VALUE" };
  }
  if (positional.length > 3) {
    return { error: "create secret accepts exactly a Secret name" };
  }
  if (Object.keys(data).length === 0) {
    return { error: "create secret requires at least one --from-literal" };
  }

  return { verb: "create", resource: "secrets", name, data, namespace };
}

function parseIngressRule(raw: string): IngressRule | ParseError {
  const equals = raw.lastIndexOf("=");
  if (equals <= 0 || equals === raw.length - 1) {
    return { error: "invalid --rule value: use host/path=service:port" };
  }

  const hostPath = raw.slice(0, equals);
  const backend = raw.slice(equals + 1);
  const slash = hostPath.indexOf("/");
  if (slash <= 0) {
    return { error: "invalid --rule value: use host/path=service:port" };
  }

  const host = hostPath.slice(0, slash);
  const path = hostPath.slice(slash) || "/";
  const colon = backend.lastIndexOf(":");
  if (colon <= 0 || colon === backend.length - 1) {
    return { error: "invalid --rule backend: use service:port" };
  }

  const serviceName = backend.slice(0, colon);
  const servicePort = parsePositiveInteger(backend.slice(colon + 1));
  if (
    host.length === 0 ||
    path.length === 0 ||
    serviceName.length === 0 ||
    servicePort === undefined
  ) {
    return { error: "invalid --rule value: use host/path=service:port" };
  }

  return { host, path, serviceName, servicePort };
}

function parseCreateIngress(tokens: string[]): ParsedCommand | ParseError {
  let namespace = "default";
  let ingressClassName: string | undefined;
  let rule: IngressRule | undefined;
  const positional: string[] = [];

  for (let index = 2; index < tokens.length; index += 1) {
    const token = tokens[index];
    if (token === undefined) {
      continue;
    }

    if (token === "-n" || token === "--namespace") {
      const value = flagArgument(tokens, index);
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

    const flagValue = (flag: string): string | undefined => {
      if (token === flag) {
        return flagArgument(tokens, index);
      }
      if (token.startsWith(`${flag}=`)) {
        return token.slice(flag.length + 1);
      }
      return undefined;
    };

    if (token === "--rule" || token.startsWith("--rule=")) {
      const value = flagValue("--rule");
      if (value === undefined) {
        return { error: "flag needs an argument: --rule" };
      }
      if (rule !== undefined) {
        return { error: "only one --rule is simulated" };
      }
      const parsed = parseIngressRule(value);
      if ("error" in parsed) {
        return parsed;
      }
      rule = parsed;
      if (token === "--rule") {
        index += 1;
      }
      continue;
    }

    if (token === "--class" || token.startsWith("--class=")) {
      const value = flagValue("--class");
      if (value === undefined || value.length === 0) {
        return { error: "flag needs an argument: --class" };
      }
      ingressClassName = value;
      if (token === "--class") {
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
    return { error: "create ingress requires <name> --rule=host/path=service:port" };
  }
  if (positional.length > 2) {
    return { error: "create ingress accepts exactly an Ingress name" };
  }
  if (rule === undefined) {
    return { error: "create ingress requires --rule=host/path=service:port" };
  }

  return {
    verb: "create",
    resource: "ingresses",
    name,
    rule,
    ...(ingressClassName === undefined ? {} : { ingressClassName }),
    namespace,
  };
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
  let from: string | undefined;
  const positional: string[] = [];

  for (let index = 2; index < tokens.length; index += 1) {
    const token = tokens[index];
    if (token === undefined) {
      continue;
    }

    if (token === "-n" || token === "--namespace") {
      const value = flagArgument(tokens, index);
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

    if (token === "--from" || token.startsWith("--from=")) {
      const value =
        token === "--from" ? flagArgument(tokens, index) : token.slice("--from=".length);
      if (value === undefined) {
        return { error: "flag needs an argument: --from" };
      }
      from = value;
      if (token === "--from") {
        index += 1;
      }
      continue;
    }

    if (token.startsWith("-")) {
      return unknownFlag(token);
    }

    positional.push(token);
  }

  const action = positional[0];
  if (action !== "image" && action !== "env") {
    return { error: "only `kubectl set image` and `kubectl set env` are simulated" };
  }

  const rest = positional.slice(1);
  const slashTarget = rest[0]?.includes("/") ?? false;
  const target = splitTarget(rest);
  if ("error" in target) {
    return target;
  }
  if (normalizeResource(target.resource) !== "deployments") {
    return { error: `only Deployment ${action} updates are simulated` };
  }

  if (action === "env") {
    if (rest.length > (slashTarget ? 1 : 2)) {
      return { error: "set env accepts a Deployment and no assignment" };
    }
    if (from === undefined) {
      return { error: "set env requires --from=configmap/<name> or --from=secret/<name>" };
    }
    const slash = from.indexOf("/");
    if (slash <= 0 || slash === from.length - 1) {
      return { error: "invalid --from value: use configmap/<name> or secret/<name>" };
    }
    const kind = from.slice(0, slash);
    const fromName = from.slice(slash + 1);
    if (kind !== "configmap" && kind !== "secret") {
      return { error: "invalid --from kind: use configmap or secret" };
    }
    if (rest.length !== (slashTarget ? 1 : 2)) {
      return { error: "set env accepts a Deployment and no assignment" };
    }
    return {
      verb: "set",
      action: "env",
      resource: "deployments",
      name: target.name,
      fromKind: kind === "configmap" ? "ConfigMap" : "Secret",
      fromName,
      namespace,
    };
  }

  if (from !== undefined) {
    return { error: "--from is only supported with kubectl set env" };
  }

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
    action: "image",
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
    return { error: `unknown command "${binary ?? ""}" - try "kubectl help"` };
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
    case "create": {
      const resource = tokens[2];
      if (resource !== undefined) {
        const normalized = normalizeResource(resource);
        if (normalized === "ingresses") {
          return parseCreateIngress(tokens);
        }
        if (normalized === "configmaps") {
          return parseCreateConfigMap(tokens);
        }
        if (normalized === "secrets") {
          return parseCreateSecret(tokens);
        }
      }
      return parseCreate(tokens);
    }
    case "top":
      return parseTop(tokens);
    case "exec":
      return parseExec(tokens);
    case "logs":
      return parseLogs(tokens);
    case "auth":
      return parseAuth(tokens);
    case "kustomize":
      return parseKustomize(tokens);
    case "apply":
      return parseApply(tokens);
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
      return { error: `unknown command "${verb}" for "kubectl" - try "kubectl help"` };
  }
}
