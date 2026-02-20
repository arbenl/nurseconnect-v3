import { z } from "zod";

export const Role = z.enum(["admin", "nurse", "patient"]);
export const UserId = z.string().min(1, "uid required");

export const UserProfile = z.object({
  uid: UserId,
  email: z.string().email(),
  displayName: z.string().min(1),
  role: Role.default("patient"),
  createdAt: z.string(), // ISO date
  updatedAt: z.string().optional(),
});
export type UserProfile = z.infer<typeof UserProfile>;

// For signup/login forms
export const Credentials = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  displayName: z.string().min(1).optional(), // signup only
});
export type Credentials = z.infer<typeof Credentials>;
