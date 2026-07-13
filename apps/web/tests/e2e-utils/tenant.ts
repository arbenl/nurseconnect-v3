import {
  DEFAULT_BRANCH_ID,
  DEFAULT_BRANCH_NAME,
  DEFAULT_BRANCH_SLUG,
  DEFAULT_ORGANIZATION_ID,
  DEFAULT_ORGANIZATION_NAME,
  DEFAULT_ORGANIZATION_SLUG,
} from "@nurseconnect/domain-identity";
import type { Client } from "pg";

export { DEFAULT_BRANCH_ID, DEFAULT_ORGANIZATION_ID };

export async function seedDefaultTenant(client: Client) {
  await client.query(
    `INSERT INTO organizations (id, name, slug, status, created_at, updated_at)
     VALUES ($1, $2, $3, 'active', NOW(), NOW())
     ON CONFLICT (id) DO NOTHING`,
    [DEFAULT_ORGANIZATION_ID, DEFAULT_ORGANIZATION_NAME, DEFAULT_ORGANIZATION_SLUG],
  );
  await client.query(
    `INSERT INTO branches (id, organization_id, name, slug, status, jurisdiction_country, jurisdiction_region, created_at, updated_at)
     VALUES ($1, $2, $3, $4, 'active', 'XK', 'Pristina', NOW(), NOW())
     ON CONFLICT (id) DO NOTHING`,
    [DEFAULT_BRANCH_ID, DEFAULT_ORGANIZATION_ID, DEFAULT_BRANCH_NAME, DEFAULT_BRANCH_SLUG],
  );
}
