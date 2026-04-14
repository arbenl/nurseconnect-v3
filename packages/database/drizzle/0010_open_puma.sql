CREATE TYPE "public"."nurse_status" AS ENUM('draft', 'submitted', 'under_review', 'verified', 'rejected', 'suspended', 'expired', 'renewal_pending');--> statement-breakpoint
UPDATE "nurses" SET "status" = 'submitted' WHERE "status" = 'pending';--> statement-breakpoint
ALTER TABLE "nurses" ALTER COLUMN "status" SET DATA TYPE nurse_status USING "status"::nurse_status;--> statement-breakpoint
ALTER TABLE "nurses" ALTER COLUMN "status" SET DEFAULT 'draft';--> statement-breakpoint
ALTER TABLE "nurses" ADD COLUMN "license_jurisdiction" text;--> statement-breakpoint
ALTER TABLE "nurses" ADD COLUMN "license_valid_until" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "nurses" ADD COLUMN "verified_by" uuid;--> statement-breakpoint
ALTER TABLE "nurses" ADD COLUMN "verified_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "nurses" ADD COLUMN "suspended_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "nurses" ADD COLUMN "suspension_reason" text;--> statement-breakpoint
ALTER TABLE "service_requests" ADD COLUMN "request_type" text DEFAULT 'same_day' NOT NULL;--> statement-breakpoint
ALTER TABLE "service_requests" ADD COLUMN "scheduled_for" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "service_requests" ADD COLUMN "referral_source" text DEFAULT 'consumer' NOT NULL;--> statement-breakpoint
ALTER TABLE "service_requests" ADD COLUMN "referral_partner_id" uuid;--> statement-breakpoint
ALTER TABLE "service_requests" ADD COLUMN "care_type" text;--> statement-breakpoint
ALTER TABLE "nurses" ADD CONSTRAINT "nurses_verified_by_users_id_fk" FOREIGN KEY ("verified_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_requests" ADD CONSTRAINT "service_requests_referral_partner_id_users_id_fk" FOREIGN KEY ("referral_partner_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
