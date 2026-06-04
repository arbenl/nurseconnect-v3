import { describe, expect, it } from "vitest";

import { findCurrentUserBoundaryViolations } from "../current-user-boundary.mjs";

describe("current user boundary guard", () => {
  it("flags direct users.authId usage outside approved identity internals", () => {
    const violations = findCurrentUserBoundaryViolations(
      "apps/web/src/app/api/me/profile/route.ts",
      "const { users } = schema;\nconst result = eq(users.authId, session.user.id);",
    );

    expect(violations).toEqual([
      expect.objectContaining({
        line: 2,
        label: "direct users.authId lookup outside identity projection",
      }),
    ]);
  });

  it("flags destructured schema aliases", () => {
    const violations = findCurrentUserBoundaryViolations(
      "apps/web/src/server/example.ts",
      "const { users: u } = schema;\nconst result = eq(u.authId, session.user.id);",
    );

    expect(violations).toEqual([
      expect.objectContaining({
        line: 2,
        label: "direct u.authId lookup outside identity projection",
      }),
    ]);
  });

  it("flags variable aliases assigned from schema.users", () => {
    const violations = findCurrentUserBoundaryViolations(
      "apps/web/src/server/example.ts",
      "const u = schema.users;\nconst result = eq(u.authId, session.user.id);",
    );

    expect(violations).toEqual([
      expect.objectContaining({
        line: 2,
        label: "direct u.authId lookup outside identity projection",
      }),
    ]);
  });

  it("flags variable aliases assigned from existing users aliases", () => {
    const violations = findCurrentUserBoundaryViolations(
      "apps/web/src/server/example.ts",
      "const { users } = schema;\nconst u = users;\nconst result = eq(u.authId, session.user.id);",
    );

    expect(violations).toEqual([
      expect.objectContaining({
        line: 3,
        label: "direct u.authId lookup outside identity projection",
      }),
    ]);
  });

  it("flags import aliases and bracket access", () => {
    const violations = findCurrentUserBoundaryViolations(
      "apps/web/src/server/example.ts",
      'import { users as dbUsers } from "@nurseconnect/database/schema";\nconst result = eq(dbUsers["authId"], session.user.id);',
    );

    expect(violations).toEqual([
      expect.objectContaining({
        line: 2,
        label: 'direct dbUsers["authId"] lookup outside identity projection',
      }),
    ]);
  });

  it("flags schema.users bracket access", () => {
    const violations = findCurrentUserBoundaryViolations(
      "apps/web/src/server/example.ts",
      'const result = eq(schema.users["authId"], session.user.id);',
    );

    expect(violations).toEqual([
      expect.objectContaining({
        line: 1,
        label: 'direct schema.users["authId"] lookup outside identity projection',
      }),
    ]);
  });

  it("flags schema.users.authId access", () => {
    const violations = findCurrentUserBoundaryViolations(
      "apps/web/src/server/example.ts",
      "const result = eq(schema.users.authId, session.user.id);",
    );

    expect(violations).toEqual([
      expect.objectContaining({
        line: 1,
        label: "direct schema.users.authId lookup outside identity projection",
      }),
    ]);
  });

  it("allows the domain identity projection owner", () => {
    const violations = findCurrentUserBoundaryViolations(
      "packages/domain-identity/src/domain-user.ts",
      "const result = eq(users.authId, data.id);",
    );

    expect(violations).toEqual([]);
  });

  it("allows tests to assert persisted auth links", () => {
    const violations = findCurrentUserBoundaryViolations(
      "apps/web/src/server/auth/require-role.db.test.ts",
      "const result = eq(users.authId, 'auth_admin_1');",
    );

    expect(violations).toEqual([]);
  });
});
