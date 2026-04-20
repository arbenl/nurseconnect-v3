CREATE TYPE "public"."payment_authorization_status" AS ENUM('authorized', 'captured', 'voided', 'failed');--> statement-breakpoint
CREATE TYPE "public"."nurse_payout_status" AS ENUM('owed', 'paid', 'failed', 'canceled');--> statement-breakpoint
CREATE TABLE "payment_authorizations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"request_id" uuid NOT NULL,
	"patient_user_id" uuid NOT NULL,
	"status" "payment_authorization_status" DEFAULT 'authorized' NOT NULL,
	"amount_cents" integer NOT NULL,
	"currency" text NOT NULL,
	"provider" text,
	"provider_reference" text,
	"note" text,
	"failure_reason" text,
	"authorized_at" timestamp with time zone DEFAULT now() NOT NULL,
	"captured_at" timestamp with time zone,
	"voided_at" timestamp with time zone,
	"failed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "nurse_payouts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"request_id" uuid NOT NULL,
	"nurse_user_id" uuid NOT NULL,
	"status" "nurse_payout_status" DEFAULT 'owed' NOT NULL,
	"amount_cents" integer NOT NULL,
	"currency" text NOT NULL,
	"provider" text,
	"provider_reference" text,
	"note" text,
	"failure_reason" text,
	"owed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"paid_at" timestamp with time zone,
	"failed_at" timestamp with time zone,
	"canceled_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "payment_authorizations" ADD CONSTRAINT "payment_authorizations_request_id_service_requests_id_fk" FOREIGN KEY ("request_id") REFERENCES "public"."service_requests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_authorizations" ADD CONSTRAINT "payment_authorizations_patient_user_id_users_id_fk" FOREIGN KEY ("patient_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "nurse_payouts" ADD CONSTRAINT "nurse_payouts_request_id_service_requests_id_fk" FOREIGN KEY ("request_id") REFERENCES "public"."service_requests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "nurse_payouts" ADD CONSTRAINT "nurse_payouts_nurse_user_id_users_id_fk" FOREIGN KEY ("nurse_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "payment_authorizations_request_id_uidx" ON "payment_authorizations" USING btree ("request_id");--> statement-breakpoint
CREATE INDEX "payment_authorizations_patient_user_id_idx" ON "payment_authorizations" USING btree ("patient_user_id");--> statement-breakpoint
CREATE INDEX "payment_authorizations_status_idx" ON "payment_authorizations" USING btree ("status");--> statement-breakpoint
CREATE INDEX "payment_authorizations_created_at_idx" ON "payment_authorizations" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "nurse_payouts_request_id_uidx" ON "nurse_payouts" USING btree ("request_id");--> statement-breakpoint
CREATE INDEX "nurse_payouts_nurse_user_id_idx" ON "nurse_payouts" USING btree ("nurse_user_id");--> statement-breakpoint
CREATE INDEX "nurse_payouts_status_idx" ON "nurse_payouts" USING btree ("status");--> statement-breakpoint
CREATE INDEX "nurse_payouts_created_at_idx" ON "nurse_payouts" USING btree ("created_at");