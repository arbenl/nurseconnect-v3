CREATE TYPE "public"."service_request_event_type" AS ENUM('request_created', 'request_assigned', 'request_accepted', 'request_rejected', 'request_enroute', 'request_completed', 'request_canceled');--> statement-breakpoint
CREATE TABLE "service_request_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"request_id" uuid NOT NULL,
	"type" "service_request_event_type" NOT NULL,
	"actor_user_id" uuid,
	"from_status" "service_request_status",
	"to_status" "service_request_status",
	"meta" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "service_request_events" ADD CONSTRAINT "service_request_events_request_id_service_requests_id_fk" FOREIGN KEY ("request_id") REFERENCES "public"."service_requests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_request_events" ADD CONSTRAINT "service_request_events_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "service_request_events_request_id_id_idx" ON "service_request_events" USING btree ("request_id","id");