#!/usr/bin/env bash

resolve_repo_root() {
  git rev-parse --show-toplevel 2>/dev/null || pwd
}

load_local_env_defaults() {
  if [[ -n "${DATABASE_URL:-}" ]]; then
    return 0
  fi

  if [[ -f "apps/web/.env.local" ]]; then
    # shellcheck disable=SC1091
    set -a
    source "apps/web/.env.local"
    set +a
  elif [[ -f ".env.local" ]]; then
    # shellcheck disable=SC1091
    set -a
    source ".env.local"
    set +a
  fi
}

enforce_test_database_url() {
  if [[ -z "${DATABASE_URL:-}" ]]; then
    printf '[test-db-env] DATABASE_URL is required. Set it in the shell or .env.local.\n' >&2
    return 1
  fi

  local db_name
  db_name="$(node -e "const u=new URL(process.env.DATABASE_URL); console.log((u.pathname||'').replace(/^\\//,''));")"

  if [[ -z "$db_name" ]]; then
    printf '[test-db-env] Could not parse database name from DATABASE_URL.\n' >&2
    return 1
  fi

  case "$db_name" in
    *ci*|*test*|*gate*)
      printf '[test-db-env] Using test-safe database %s.\n' "$db_name"
      ;;
    *)
      DATABASE_URL="$(node -e "const u=new URL(process.env.DATABASE_URL); const name=(u.pathname||'/').replace(/^\\//,'')||'nurseconnect'; u.pathname='/' + name + '_test'; process.stdout.write(u.toString());")"
      export DATABASE_URL
      printf '[test-db-env] DATABASE_URL pointed to %s; using %s_test for clean DB lanes.\n' "$db_name" "$db_name"
      ;;
  esac
}
