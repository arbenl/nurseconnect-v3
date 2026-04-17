import { z } from "zod";

import { ProfileValidationError } from "./errors";

const profileSchema = z.object({
  firstName: z.string().trim().min(1, "First name is required"),
  lastName: z.string().trim().min(1, "Last name is required"),
  phone: z.string().trim().min(1, "Phone number is required"),
  city: z.string().trim().min(1, "City is required"),
  address: z
    .string()
    .optional()
    .transform((value) => {
      if (value === undefined) {
        return undefined;
      }

      const trimmed = value.trim();
      return trimmed.length > 0 ? trimmed : null;
    }),
});

export type ProfileUpdateInput = z.input<typeof profileSchema>;

export function buildProfileUpdatePatch(input: ProfileUpdateInput) {
  const result = profileSchema.safeParse(input);

  if (!result.success) {
    throw new ProfileValidationError("Validation failed", result.error.flatten());
  }

  const now = new Date();

  return {
    firstName: result.data.firstName,
    lastName: result.data.lastName,
    phone: result.data.phone,
    city: result.data.city,
    address: result.data.address,
    profileCompletedAt: now,
    updatedAt: now,
  };
}
