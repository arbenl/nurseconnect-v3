CREATE TYPE "public"."user_role" AS ENUM('admin', 'nurse', 'patient');--> statement-breakpoint
ALTER TABLE "users" DROP CONSTRAINT "users_role_check";--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "role" SET DATA TYPE user_role USING ("role"::user_role);--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "role" SET DEFAULT 'patient';