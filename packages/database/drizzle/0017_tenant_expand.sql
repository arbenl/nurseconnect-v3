SET lock_timeout = '5s';--> statement-breakpoint
SET statement_timeout = '60s';--> statement-breakpoint
CREATE TYPE "public"."branch_status" AS ENUM('active', 'suspended', 'archived');--> statement-breakpoint
CREATE TABLE "branches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"status" "branch_status" DEFAULT 'active' NOT NULL,
	"jurisdiction_country" text NOT NULL,
	"jurisdiction_region" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "branches_slug_format_chk" CHECK ("branches"."slug" ~ '^[a-z0-9-]{2,63}$')
);
--> statement-breakpoint
CREATE TRIGGER branches_updated_at_trigger
BEFORE UPDATE ON "branches"
FOR EACH ROW
EXECUTE FUNCTION set_current_timestamp_updated_at();--> statement-breakpoint
INSERT INTO "organizations" ("id", "name", "slug", "status")
VALUES (
	'00000000-0000-4000-8000-000000000001',
	'NurseConnect Default Organization',
	'nurseconnect-default',
	'active'
)
ON CONFLICT ("id") DO NOTHING;--> statement-breakpoint
INSERT INTO "branches" (
	"id",
	"organization_id",
	"name",
	"slug",
	"status",
	"jurisdiction_country",
	"jurisdiction_region"
)
VALUES (
	'00000000-0000-4000-8000-000000000101',
	'00000000-0000-4000-8000-000000000001',
	'NurseConnect Default Branch',
	'nurseconnect-default-branch',
	'active',
	'US',
	'default-launch-region'
)
ON CONFLICT ("id") DO NOTHING;--> statement-breakpoint
ALTER TABLE "service_requests" ADD COLUMN "organization_id" uuid;--> statement-breakpoint
ALTER TABLE "service_requests" ADD COLUMN "branch_id" uuid;--> statement-breakpoint
ALTER TABLE "service_request_events" ADD COLUMN "organization_id" uuid;--> statement-breakpoint
ALTER TABLE "patients" ADD COLUMN "organization_id" uuid;--> statement-breakpoint
ALTER TABLE "assignments" ADD COLUMN "organization_id" uuid;--> statement-breakpoint
ALTER TABLE "visits" ADD COLUMN "organization_id" uuid;--> statement-breakpoint
ALTER TABLE "visits" ADD COLUMN "branch_id" uuid;--> statement-breakpoint
ALTER TABLE "payment_authorizations" ADD COLUMN "organization_id" uuid;--> statement-breakpoint
ALTER TABLE "nurse_payouts" ADD COLUMN "organization_id" uuid;--> statement-breakpoint
ALTER TABLE "branches" ADD CONSTRAINT "branches_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "branches_organization_slug_idx" ON "branches" USING btree ("organization_id","slug");--> statement-breakpoint
CREATE INDEX "branches_organization_id_idx" ON "branches" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "branches_status_idx" ON "branches" USING btree ("status");--> statement-breakpoint
ALTER TABLE "service_requests" ADD CONSTRAINT "service_requests_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_requests" ADD CONSTRAINT "service_requests_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_request_events" ADD CONSTRAINT "service_request_events_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "patients" ADD CONSTRAINT "patients_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assignments" ADD CONSTRAINT "assignments_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "visits" ADD CONSTRAINT "visits_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "visits" ADD CONSTRAINT "visits_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_authorizations" ADD CONSTRAINT "payment_authorizations_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "nurse_payouts" ADD CONSTRAINT "nurse_payouts_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "service_requests_organization_id_idx" ON "service_requests" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "service_requests_branch_id_idx" ON "service_requests" USING btree ("branch_id");--> statement-breakpoint
CREATE INDEX "service_request_events_organization_id_idx" ON "service_request_events" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "patients_organization_id_idx" ON "patients" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "assignments_organization_id_idx" ON "assignments" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "visits_organization_id_idx" ON "visits" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "visits_branch_id_idx" ON "visits" USING btree ("branch_id");--> statement-breakpoint
CREATE INDEX "payment_authorizations_organization_id_idx" ON "payment_authorizations" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "nurse_payouts_organization_id_idx" ON "nurse_payouts" USING btree ("organization_id");
