#!/usr/bin/env bash
set -euo pipefail

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "DATABASE_URL is required"
  exit 1
fi

DB_NAME="$(node -e "const u=new URL(process.env.DATABASE_URL); console.log((u.pathname||'').replace(/^\\//,''));")"

if [[ -z "$DB_NAME" ]]; then
  echo "Could not parse database name from DATABASE_URL"
  exit 1
fi

case "$DB_NAME" in
  *ci*|*test*|*gate*)
    ;;
  *)
    echo "Refusing to reset non-test database '$DB_NAME'."
    echo "Use a DATABASE_URL that includes one of: ci, test, gate."
    exit 1
    ;;
esac

echo "Resetting public schema on '$DB_NAME'..."
pnpm --filter web exec node -e "
const { Client } = require('pg');
(async () => {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  await client.query('DROP SCHEMA IF EXISTS public CASCADE;');
  await client.query('DROP SCHEMA IF EXISTS drizzle CASCADE;');
  await client.query('CREATE SCHEMA public;');
  await client.end();
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
"
echo "Schema reset complete."
