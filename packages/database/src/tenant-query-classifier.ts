export const TENANT_TABLES = [
  "branches",
  "org_memberships",
  "service_requests",
  "patients",
  "assignments",
  "visits",
  "service_request_events",
  "payment_authorizations",
  "nurse_payouts",
] as const;

export type TenantTable = (typeof TENANT_TABLES)[number];
export type QueryOperation = "delete" | "insert" | "select" | "update" | "unknown";

const tenantTables = new Set<string>(TENANT_TABLES);
const contexts = new Set(["from", "join", "update", "into"]);
const fromTerminators = new Set([
  "except", "fetch", "for", "group", "having", "intersect", "limit",
  "offset", "order", "returning", "union", "where", "window",
]);
const maxQueryLength = 262_144;

export type TenantQueryClassification = {
  operation: QueryOperation;
  oversize: boolean;
  tables: TenantTable[];
};

export function classifyTenantQuery(query: string): TenantQueryClassification {
  if (query.length > maxQueryLength) {
    return { operation: "unknown", oversize: true, tables: [] };
  }

  const tokens = tokenize(maskNonStructuralSql(query));
  const cte = collectCteInfo(tokens);
  const tables = new Set<TenantTable>();

  for (let index = 0; index < tokens.length; index += 1) {
    if (!contexts.has(tokens[index] ?? "")) continue;
    const starts = tokens[index] === "from" ? fromRelationStarts(tokens, index + 1) : [index + 1];
    for (const start of starts) {
      const relation = relationAfter(tokens, start);
      if (relation && tenantTables.has(relation.name) && !isCteReference(relation, cte.aliasEnds)) {
        tables.add(relation.name as TenantTable);
      }
    }
  }

  return { operation: operationFrom(tokens, cte.statementStart), oversize: false, tables: [...tables].sort() };
}

function operationFrom(tokens: string[], start: number): QueryOperation {
  const first = tokens.slice(start).find((token) => ["insert", "update", "delete", "select"].includes(token));
  if (first === "insert" || first === "update" || first === "delete" || first === "select") return first;
  return "unknown";
}

type Relation = { name: string; qualified: boolean; tokenIndex: number };

function relationAfter(tokens: string[], start: number): Relation | undefined {
  let index = start;
  if (tokens[index] === "only" || tokens[index] === "lateral") index += 1;
  const first = tokens[index];
  if (!first || first === "(") return undefined;
  if (tokens[index + 1] === "." && tokens[index + 2]) {
    return { name: tokens[index + 2]!, qualified: true, tokenIndex: index + 2 };
  }
  return { name: first, qualified: false, tokenIndex: index };
}

function fromRelationStarts(tokens: string[], start: number): number[] {
  const starts = [start];
  let depth = 0;
  for (let index = start; index < tokens.length; index += 1) {
    const token = tokens[index];
    if (token === "(") depth += 1;
    else if (token === ")") {
      if (depth === 0) break;
      depth -= 1;
    } else if (depth === 0 && fromTerminators.has(token ?? "")) break;
    else if (depth === 0 && token === ",") starts.push(index + 1);
  }
  return starts;
}

function tokenize(sql: string): string[] {
  return (sql.match(/[A-Za-z_][A-Za-z0-9_$]*|[().,;]/g) ?? []).map((token) => token.toLowerCase());
}

function collectCteInfo(tokens: string[]): { aliasEnds: Map<string, number>; statementStart: number } {
  const aliasEnds = new Map<string, number>();
  if (tokens[0] !== "with") return { aliasEnds, statementStart: 0 };
  let index = tokens[1] === "recursive" ? 2 : 1;
  while (index < tokens.length) {
    const alias = tokens[index];
    if (!alias || tokens[index + 1] !== "as" || tokens[index + 2] !== "(") break;
    index += 3;
    let depth = 1;
    while (index < tokens.length && depth > 0) {
      if (tokens[index] === "(") depth += 1;
      if (tokens[index] === ")") depth -= 1;
      index += 1;
    }
    aliasEnds.set(alias, index - 1);
    if (tokens[index] !== ",") break;
    index += 1;
  }
  return { aliasEnds, statementStart: index };
}

function isCteReference(relation: Relation, aliasEnds: Map<string, number>): boolean {
  const definitionEnd = aliasEnds.get(relation.name);
  return !relation.qualified && definitionEnd !== undefined && relation.tokenIndex > definitionEnd;
}

function maskNonStructuralSql(sql: string): string {
  let output = "";
  let state: "block" | "line" | "normal" | "single" = "normal";
  for (let index = 0; index < sql.length; index += 1) {
    const char = sql[index] ?? "";
    const next = sql[index + 1] ?? "";
    if (state === "normal" && char === "'") state = "single";
    else if (state === "normal" && char === "-" && next === "-") state = "line";
    else if (state === "normal" && char === "/" && next === "*") state = "block";
    else if (state === "single" && char === "'" && next === "'") {
      output += "  "; index += 1; continue;
    } else if (state === "single" && char === "'") state = "normal";
    else if (state === "line" && char === "\n") state = "normal";
    else if (state === "block" && char === "*" && next === "/") {
      output += "  "; index += 1; state = "normal"; continue;
    }
    output += state === "normal" && char !== '"' ? char : " ";
  }
  return output;
}
