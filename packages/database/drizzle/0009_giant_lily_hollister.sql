WITH ranked_nurses AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY user_id
      ORDER BY updated_at DESC NULLS LAST, created_at DESC NULLS LAST, id DESC
    ) AS row_num
  FROM nurses
)
DELETE FROM nurses
WHERE id IN (
  SELECT id
  FROM ranked_nurses
  WHERE row_num > 1
);--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "nurses_user_id_uq" ON "nurses" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "admin_audit_logs_actor_user_id_idx" ON "admin_audit_logs" USING btree ("actor_user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "admin_audit_logs_action_idx" ON "admin_audit_logs" USING btree ("action");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "admin_audit_logs_target_entity_idx" ON "admin_audit_logs" USING btree ("target_entity_type","target_entity_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "admin_audit_logs_created_at_idx" ON "admin_audit_logs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "admin_audit_logs_created_at_actor_user_id_idx" ON "admin_audit_logs" USING btree ("created_at","actor_user_id");
