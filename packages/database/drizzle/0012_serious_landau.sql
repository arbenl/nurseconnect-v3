CREATE TYPE "public"."referral_partner_status" AS ENUM('active', 'inactive');--> statement-breakpoint
ALTER TYPE "public"."user_role" ADD VALUE 'referral_partner';--> statement-breakpoint
CREATE TABLE "referral_partners" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"organization_name" text NOT NULL,
	"status" "referral_partner_status" DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "referral_partners" ADD CONSTRAINT "referral_partners_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "referral_partners_user_id_uq" ON "referral_partners" USING btree ("user_id");