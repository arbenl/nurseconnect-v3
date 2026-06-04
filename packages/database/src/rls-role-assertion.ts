import { sql, type SQL } from "drizzle-orm";

type QueryResult<Row extends Record<string, unknown>> = { rows?: Row[] } | Row[];

export type RlsRoleQueryExecutor = {
  execute(query: SQL): Promise<QueryResult<Record<string, unknown>>>;
};

export type RlsConnectionRoleAssertionOptions = {
  allowUnsafeLocalRole?: boolean;
};

type RoleRow = {
  rolname: string;
  rolsuper: boolean | string | number;
  rolbypassrls: boolean | string | number;
};

export class RlsConnectionRoleError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RlsConnectionRoleError";
  }
}

export async function assertRlsConnectionRoleReady(
  database: RlsRoleQueryExecutor,
  options: RlsConnectionRoleAssertionOptions = {},
): Promise<void> {
  let result: QueryResult<RoleRow>;

  try {
    result = (await database.execute(sql`
      SELECT rolname, rolsuper, rolbypassrls
      FROM pg_roles
      WHERE rolname = current_user
      LIMIT 1
    `)) as QueryResult<RoleRow>;
  } catch {
    throw new RlsConnectionRoleError("RLS connection role could not be verified");
  }

  const [role] = rowsFrom(result);

  if (role === undefined) {
    throw new RlsConnectionRoleError("RLS connection role could not be verified");
  }

  if (isTruthy(role.rolsuper) || isTruthy(role.rolbypassrls)) {
    if (options.allowUnsafeLocalRole === true) {
      console.warn("RLS connection role safety bypass allowed for local tooling");
      return;
    }

    throw new RlsConnectionRoleError("RLS connection role is not safe");
  }
}

function isTruthy(value: boolean | string | number): boolean {
  return value === true || value === 1 || value === "t" || value === "true";
}

function rowsFrom<Row extends Record<string, unknown>>(result: QueryResult<Row>): Row[] {
  return Array.isArray(result) ? result : result.rows ?? [];
}
