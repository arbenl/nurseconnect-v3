CREATE TABLE "nurse_locations" (
	"nurse_user_id" uuid PRIMARY KEY NOT NULL,
	"lat" numeric(9, 6) NOT NULL,
	"lng" numeric(9, 6) NOT NULL,
	"last_updated" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "service_requests" DROP CONSTRAINT "service_requests_patient_id_patients_id_fk";
--> statement-breakpoint
DROP INDEX "service_requests_patient_id_idx";--> statement-breakpoint
ALTER TABLE "service_requests" ALTER COLUMN "status" SET DEFAULT 'open';--> statement-breakpoint
ALTER TABLE "service_requests" ALTER COLUMN "lat" SET DATA TYPE numeric(9, 6);--> statement-breakpoint
ALTER TABLE "service_requests" ALTER COLUMN "lng" SET DATA TYPE numeric(9, 6);--> statement-breakpoint
ALTER TABLE "service_requests" ADD COLUMN "patient_user_id" uuid NOT NULL;--> statement-breakpoint
ALTER TABLE "service_requests" ADD COLUMN "assigned_nurse_user_id" uuid;--> statement-breakpoint
ALTER TABLE "service_requests" ADD COLUMN "address" text NOT NULL;--> statement-breakpoint
ALTER TABLE "nurse_locations" ADD CONSTRAINT "nurse_locations_nurse_user_id_users_id_fk" FOREIGN KEY ("nurse_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_requests" ADD CONSTRAINT "service_requests_patient_user_id_users_id_fk" FOREIGN KEY ("patient_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_requests" ADD CONSTRAINT "service_requests_assigned_nurse_user_id_users_id_fk" FOREIGN KEY ("assigned_nurse_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "service_requests_patient_idx" ON "service_requests" USING btree ("patient_user_id");--> statement-breakpoint
CREATE INDEX "service_requests_nurse_idx" ON "service_requests" USING btree ("assigned_nurse_user_id");--> statement-breakpoint
ALTER TABLE "service_requests" DROP COLUMN "patient_id";--> statement-breakpoint
ALTER TABLE "service_requests" DROP COLUMN "service_type";--> statement-breakpoint
ALTER TABLE "service_requests" DROP COLUMN "notes";