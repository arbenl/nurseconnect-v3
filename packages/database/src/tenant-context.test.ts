import type { SQL } from "drizzle-orm";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  assertRlsConnectionRoleReady,
  RlsConnectionRoleError,
  type RlsRoleQueryExecutor,
} from "./rls-role-assertion";
import { assertTenantContext, TenantContextError, toOrganizationId, type TenantQueryExecutor } from "./tenant-context";

type FakeExecutor = TenantQueryExecutor & RlsRoleQueryExecutor & {
  queries: SQL[];
};

function fakeExecutor(rows: Record<string, unknown>[] | Error): FakeExecutor {
  const queries: SQL[] = [];

  return {
    queries,
    async execute(_query: SQL) {
      queries.push(_query);

      if (rows instanceof Error) {
        throw rows;
      }

      return { rows };
    },
  };
}

const uuidPattern = /[0-9a-f]{8}-[0-9a-f]{4}/i;

afterEach(() => {
  vi.restoreAllMocks();
});

describe("tenant context assertions", () => {
  it("validates organization IDs before creating tenant context", () => {
    expect(toOrganizationId("11111111-1111-4111-8111-111111111111")).toBe(
      "11111111-1111-4111-8111-111111111111",
    );
    expect(() => toOrganizationId("not-a-uuid")).toThrow(TenantContextError);
  });

  it("fails closed when tenant context is missing", async () => {
    await expect(assertTenantContext(fakeExecutor([{ tenant_context_ready: false }]))).rejects.toThrow(
      "Tenant context is not set",
    );
  });

  it("uses sanitized mismatch errors without exposing tenant IDs", async () => {
    const expected = "11111111-1111-4111-8111-111111111111";
    const executor = fakeExecutor([{ tenant_context_ready: false }]);

    await expect(assertTenantContext(executor, expected)).rejects.toThrow("Tenant context mismatch");

    try {
      await assertTenantContext(executor, expected);
    } catch (error) {
      expect(error).toBeInstanceOf(TenantContextError);
      expect((error as Error).message).not.toMatch(uuidPattern);
    }
  });

  it("checks expected tenant context in one SQL round trip", async () => {
    const executor = fakeExecutor([{ tenant_context_ready: true }]);

    await assertTenantContext(executor, "11111111-1111-4111-8111-111111111111");

    expect(executor.queries).toHaveLength(1);
  });
});

describe("RLS connection role assertion", () => {
  it("rejects unsafe role rows by default", async () => {
    await expect(
      assertRlsConnectionRoleReady(fakeExecutor([{ rolname: "postgres", rolsuper: true, rolbypassrls: false }])),
    ).rejects.toThrow(RlsConnectionRoleError);
  });

  it("rejects bypass-RLS role rows by default", async () => {
    await expect(
      assertRlsConnectionRoleReady(fakeExecutor([{ rolname: "app", rolsuper: false, rolbypassrls: "t" }])),
    ).rejects.toThrow("RLS connection role is not safe");
  });

  it("accepts normal role rows and explicit local unsafe-role allowance", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    await expect(
      assertRlsConnectionRoleReady(fakeExecutor([{ rolname: "app", rolsuper: false, rolbypassrls: false }])),
    ).resolves.toBeUndefined();

    await expect(
      assertRlsConnectionRoleReady(fakeExecutor([{ rolname: "postgres", rolsuper: true, rolbypassrls: false }]), {
        allowUnsafeLocalRole: true,
      }),
    ).resolves.toBeUndefined();

    expect(warn).toHaveBeenCalledWith("RLS connection role safety bypass allowed for local tooling");
  });

  it("fails closed when the role cannot be verified", async () => {
    await expect(assertRlsConnectionRoleReady(fakeExecutor(new Error("permission denied")))).rejects.toThrow(
      "RLS connection role could not be verified",
    );
  });
});
