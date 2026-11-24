export interface ServiceDnsTarget {
  name: string;
  namespace: string;
  canonical: string;
}

export function resolveServiceDns(
  query: string,
  fromNamespace: string,
): ServiceDnsTarget | undefined {
  const cleaned = query.trim().replace(/\.$/, "").toLowerCase();
  const parts = cleaned.split(".");

  if (parts.length === 1) {
    const name = parts[0];
    if (name === undefined || name.length === 0) {
      return undefined;
    }
    return target(name, fromNamespace);
  }

  if (parts.length === 2) {
    const [name, namespace] = parts;
    if (name === undefined || namespace === undefined) {
      return undefined;
    }
    return target(name, namespace);
  }

  if (parts.length === 3 && parts[2] === "svc") {
    const [name, namespace] = parts;
    if (name === undefined || namespace === undefined) {
      return undefined;
    }
    return target(name, namespace);
  }

  if (parts.length === 5 && parts[2] === "svc" && parts[3] === "cluster" && parts[4] === "local") {
    const [name, namespace] = parts;
    if (name === undefined || namespace === undefined) {
      return undefined;
    }
    return target(name, namespace);
  }

  return undefined;
}

function target(name: string, namespace: string): ServiceDnsTarget | undefined {
  if (name.length === 0 || namespace.length === 0) {
    return undefined;
  }

  return {
    name,
    namespace,
    canonical: `${name}.${namespace}.svc.cluster.local`,
  };
}
