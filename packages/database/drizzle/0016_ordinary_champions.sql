CREATE TYPE "public"."org_member_role" AS ENUM('owner', 'admin', 'coordinator', 'requester', 'viewer');--> statement-breakpoint
CREATE TYPE "public"."org_membership_source" AS ENUM('bootstrap', 'invitation', 'api', 'sso');--> statement-breakpoint
CREATE TYPE "public"."org_membership_status" AS ENUM('active', 'invited', 'disabled');--> statement-breakpoint
CREATE TYPE "public"."organization_status" AS ENUM('active', 'suspended', 'archived');--> statement-breakpoint
CREATE TABLE "org_memberships" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"role" "org_member_role" NOT NULL,
	"status" "org_membership_status" DEFAULT 'active' NOT NULL,
	"source" "org_membership_source" NOT NULL,
	"created_by_user_id" uuid,
	"updated_by_user_id" uuid,
	"activated_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "organizations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"status" "organization_status" DEFAULT 'active' NOT NULL,
	"created_by_user_id" uuid,
	"updated_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "organizations_slug_format_chk" CHECK ("organizations"."slug" ~ '^[a-z0-9-]{2,63}$')
);
--> statement-breakpoint
ALTER TABLE "org_memberships" ADD CONSTRAINT "org_memberships_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org_memberships" ADD CONSTRAINT "org_memberships_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org_memberships" ADD CONSTRAINT "org_memberships_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org_memberships" ADD CONSTRAINT "org_memberships_updated_by_user_id_users_id_fk" FOREIGN KEY ("updated_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organizations" ADD CONSTRAINT "organizations_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organizations" ADD CONSTRAINT "organizations_updated_by_user_id_users_id_fk" FOREIGN KEY ("updated_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "org_memberships_organization_user_idx" ON "org_memberships" USING btree ("organization_id","user_id");--> statement-breakpoint
CREATE INDEX "org_memberships_user_id_idx" ON "org_memberships" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "org_memberships_organization_id_idx" ON "org_memberships" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "org_memberships_org_status_idx" ON "org_memberships" USING btree ("organization_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "organizations_slug_idx" ON "organizations" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "organizations_status_idx" ON "organizations" USING btree ("status");--> statement-breakpoint
CREATE OR REPLACE FUNCTION set_current_timestamp_updated_at()
RETURNS trigger AS $$
BEGIN
	NEW.updated_at = now();
	RETURN NEW;
END;
$$ LANGUAGE plpgsql;--> statement-breakpoint
CREATE TRIGGER organizations_updated_at_trigger
BEFORE UPDATE ON "organizations"
FOR EACH ROW
EXECUTE FUNCTION set_current_timestamp_updated_at();--> statement-breakpoint
CREATE TRIGGER org_memberships_updated_at_trigger
BEFORE UPDATE ON "org_memberships"
FOR EACH ROW
EXECUTE FUNCTION set_current_timestamp_updated_at();--> statement-breakpoint
ALTER TABLE "org_memberships" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "org_memberships" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "org_memberships_tenant_context_select"
ON "org_memberships"
FOR SELECT
USING (
	"organization_id" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
);--> statement-breakpoint
CREATE POLICY "org_memberships_tenant_context_insert"
ON "org_memberships"
FOR INSERT
WITH CHECK (
	"organization_id" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
);--> statement-breakpoint
CREATE POLICY "org_memberships_tenant_context_update"
ON "org_memberships"
FOR UPDATE
USING (
	"organization_id" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
)
WITH CHECK (
	"organization_id" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
);--> statement-breakpoint
CREATE POLICY "org_memberships_tenant_context_delete"
ON "org_memberships"
FOR DELETE
USING (
	"organization_id" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
);
