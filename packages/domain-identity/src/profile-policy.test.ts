import { describe, expect, it } from "vitest";

import { ProfileValidationError } from "./errors";
import { buildProfileUpdatePatch } from "./profile-policy";

describe("buildProfileUpdatePatch", () => {
  it("marks the base profile complete when firstName, lastName, phone, and city are present", () => {
    const result = buildProfileUpdatePatch({
      firstName: "Pat",
      lastName: "Ient",
      phone: "+38344123456",
      city: "Pristina",
      address: "Main Street 1",
    });

    expect(result).toMatchObject({
      firstName: "Pat",
      lastName: "Ient",
      phone: "+38344123456",
      city: "Pristina",
      address: "Main Street 1",
    });
    expect(result.profileCompletedAt).toBeInstanceOf(Date);
  });

  it("normalizes optional address whitespace to null", () => {
    const result = buildProfileUpdatePatch({
      firstName: "Pat",
      lastName: "Ient",
      phone: "+38344123456",
      city: "Pristina",
      address: "   ",
    });

    expect(result.address).toBeNull();
  });

  it("leaves address undefined when the patch omits it", () => {
    const result = buildProfileUpdatePatch({
      firstName: "Pat",
      lastName: "Ient",
      phone: "+38344123456",
      city: "Pristina",
    });

    expect(result.address).toBeUndefined();
  });

  it("rejects empty required fields after trimming", () => {
    expect(() =>
      buildProfileUpdatePatch({
        firstName: "Pat",
        lastName: "Ient",
        phone: "   ",
        city: "Pristina",
      }),
    ).toThrow(ProfileValidationError);
  });
});
