ALTER TABLE "nurses" ADD COLUMN IF NOT EXISTS "license_number" text;--> statement-breakpoint
ALTER TABLE "nurses" ADD COLUMN IF NOT EXISTS "specialization" text;--> statement-breakpoint
ALTER TABLE "nurses" ADD COLUMN IF NOT EXISTS "is_available" boolean DEFAULT false NOT NULL;