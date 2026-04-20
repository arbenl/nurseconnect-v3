import { describe, expect, it } from "vitest";

import { resolvePortalAccessPolicy } from "./portal-access-policy";

describe("resolvePortalAccessPolicy", () => {
  it("redirects unauthenticated actors to login with the current callback URL", () => {
    expect(
      resolvePortalAccessPolicy({
        currentPath: "/admin/requests",
        portal: "admin",
        resolved: null,
        canonicalRoute: null,
        profileComplete: false,
      }),
    ).toEqual({
      redirectTo: "/login?callbackUrl=%2Fadmin%2Frequests",
      canonicalRoute: null,
      profileComplete: false,
      session: null,
      user: null,
    });
  });

  it("redirects non-admin users away from the admin portal to their canonical route", () => {
    const now = new Date();

    expect(
      resolvePortalAccessPolicy({
        currentPath: "/admin",
        portal: "admin",
        canonicalRoute: "/dashboard",
        profileComplete: true,
        resolved: {
          session: {
            user: {
              id: "auth_patient_1",
              email: "patient@test.local",
            },
          },
          user: {
            id: "user_patient_1",
            authId: "auth_patient_1",
            email: "patient@test.local",
            role: "patient",
            name: "Patient User",
            firstName: "Pat",
            lastName: "Ient",
            phone: "123",
            city: "Berlin",
            address: null,
            profileCompletedAt: null,
            createdAt: now,
            updatedAt: now,
          },
        },
      }),
    ).toMatchObject({
      redirectTo: "/dashboard",
      canonicalRoute: null,
      profileComplete: false,
    });
  });

  it("redirects incomplete app users to onboarding when profile completion is required", () => {
    const now = new Date();

    expect(
      resolvePortalAccessPolicy({
        currentPath: "/dashboard",
        portal: "app",
        canonicalRoute: "/dashboard",
        profileComplete: false,
        requireProfileComplete: true,
        resolved: {
          session: {
            user: {
              id: "auth_patient_2",
              email: "patient2@test.local",
            },
          },
          user: {
            id: "user_patient_2",
            authId: "auth_patient_2",
            email: "patient2@test.local",
            role: "patient",
            name: "Patient User",
            firstName: null,
            lastName: null,
            phone: null,
            city: null,
            address: null,
            profileCompletedAt: null,
            createdAt: now,
            updatedAt: now,
          },
        },
      }),
    ).toMatchObject({
      redirectTo: "/onboarding",
      canonicalRoute: null,
      profileComplete: false,
    });
  });

  it("redirects referral partners away from the app portal to their canonical route", () => {
    const now = new Date();

    expect(
      resolvePortalAccessPolicy({
        currentPath: "/dashboard",
        portal: "app",
        canonicalRoute: "/partner",
        profileComplete: true,
        resolved: {
          session: {
            user: {
              id: "auth_partner_1",
              email: "partner@test.local",
            },
          },
          user: {
            id: "user_partner_1",
            authId: "auth_partner_1",
            email: "partner@test.local",
            role: "referral_partner",
            name: "Partner User",
            firstName: "Pat",
            lastName: "Ner",
            phone: "123",
            city: "Berlin",
            address: null,
            profileCompletedAt: null,
            createdAt: now,
            updatedAt: now,
          },
        },
      }),
    ).toMatchObject({
      redirectTo: "/partner",
      canonicalRoute: null,
      profileComplete: false,
    });
  });

  it("allows referral partners to use their app portal subtree", () => {
    const now = new Date();

    expect(
      resolvePortalAccessPolicy({
        currentPath: "/partner/requests/request_1",
        portal: "app",
        canonicalRoute: "/partner",
        profileComplete: true,
        resolved: {
          session: {
            user: {
              id: "auth_partner_2",
              email: "partner2@test.local",
            },
          },
          user: {
            id: "user_partner_2",
            authId: "auth_partner_2",
            email: "partner2@test.local",
            role: "referral_partner",
            name: "Partner User",
            firstName: "Pat",
            lastName: "Ner",
            phone: "123",
            city: "Berlin",
            address: null,
            profileCompletedAt: null,
            createdAt: now,
            updatedAt: now,
          },
        },
      }),
    ).toMatchObject({
      redirectTo: null,
      canonicalRoute: "/partner",
      profileComplete: true,
    });
  });
});
