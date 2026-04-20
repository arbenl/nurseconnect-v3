CREATE TYPE "public"."service_area_status" AS ENUM('active', 'paused');--> statement-breakpoint
CREATE TABLE "service_areas" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"label" text NOT NULL,
	"center_lat" numeric(9, 6) NOT NULL,
	"center_lng" numeric(9, 6) NOT NULL,
	"radius_meters" integer NOT NULL,
	"status" "service_area_status" DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "service_requests" ADD COLUMN "service_area_id" uuid;--> statement-breakpoint
ALTER TABLE "nurse_locations" ADD COLUMN "service_area_id" uuid;--> statement-breakpoint
CREATE INDEX "service_areas_status_idx" ON "service_areas" USING btree ("status");--> statement-breakpoint
ALTER TABLE "service_requests" ADD CONSTRAINT "service_requests_service_area_id_service_areas_id_fk" FOREIGN KEY ("service_area_id") REFERENCES "public"."service_areas"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "nurse_locations" ADD CONSTRAINT "nurse_locations_service_area_id_service_areas_id_fk" FOREIGN KEY ("service_area_id") REFERENCES "public"."service_areas"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "service_requests_service_area_id_idx" ON "service_requests" USING btree ("service_area_id");--> statement-breakpoint
CREATE INDEX "nurse_locations_service_area_id_idx" ON "nurse_locations" USING btree ("service_area_id");