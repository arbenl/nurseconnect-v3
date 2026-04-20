ALTER TYPE "public"."service_request_status" ADD VALUE 'needs_review';--> statement-breakpoint
ALTER TYPE "public"."service_request_status" ADD VALUE 'declined';--> statement-breakpoint
ALTER TYPE "public"."service_request_status" ADD VALUE 'unfulfilled';--> statement-breakpoint
ALTER TYPE "public"."service_request_event_type" ADD VALUE 'request_needs_review';--> statement-breakpoint
ALTER TYPE "public"."service_request_event_type" ADD VALUE 'request_declined';--> statement-breakpoint
ALTER TYPE "public"."service_request_event_type" ADD VALUE 'request_unfulfilled';--> statement-breakpoint
ALTER TYPE "public"."service_request_event_type" ADD VALUE 'request_reopened';--> statement-breakpoint
ALTER TABLE "service_requests" ADD COLUMN "needs_review_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "service_requests" ADD COLUMN "declined_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "service_requests" ADD COLUMN "unfulfilled_at" timestamp with time zone;