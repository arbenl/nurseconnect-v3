import { chmodSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";

import { libpqTransportEnvironment } from "../lib/tenant-backfill-connection.mjs";

describe("tenant backfill connection", () => {
it("preserves PostgreSQL transport and authentication URI parameters", () => {
  const url = new URL(
    "postgresql://user:password@database.example/nurseconnect"
      + "?sslmode=verify-full&sslrootcert=%2Fcerts%2Froot.pem"
      + "&sslcert=%2Fcerts%2Fclient.pem&sslkey=%2Fcerts%2Fclient.key"
      + "&channel_binding=require&require_auth=scram-sha-256",
  );

  expect(libpqTransportEnvironment(url)).toEqual({
    PGCHANNELBINDING: "require",
    PGREQUIREAUTH: "scram-sha-256",
    PGSSLCERT: "/certs/client.pem",
    PGSSLKEY: "/certs/client.key",
    PGSSLMODE: "verify-full",
    PGSSLROOTCERT: "/certs/root.pem",
  });
  });
it("does not override libpq settings when the URI omits them", () => {
  expect(
    libpqTransportEnvironment(new URL("postgresql://user:password@localhost/nurseconnect")),
  ).toEqual({});
});

it("passes protected connection settings through the real backfill runner", () => {
  const directory = mkdtempSync(join(tmpdir(), "nc-tb-01-connection-"));
  const captureFile = join(directory, "calls.jsonl");
  const psql = join(directory, "psql.mjs");
  writeFileSync(psql, `#!/usr/bin/env node
import { appendFileSync } from "node:fs";
appendFileSync(process.env.CAPTURE_FILE, JSON.stringify({
  sslmode: process.env.PGSSLMODE,
  channelBinding: process.env.PGCHANNELBINDING,
  rootCertificate: process.env.PGSSLROOTCERT,
}) + "\\n");
process.stdout.write("0\\n");
`);
  chmodSync(psql, 0o700);

  const result = spawnSync(
    process.execPath,
    ["scripts/backfill-tenant-ownership.mjs", "--check-only"],
    {
      cwd: new URL("../..", import.meta.url),
      encoding: "utf8",
      env: {
        ...process.env,
        CAPTURE_FILE: captureFile,
        PSQL_BIN: psql,
        DATABASE_URL: "postgresql://user:password@database.example/nurseconnect"
          + "?sslmode=verify-full&sslrootcert=%2Fcerts%2Froot.pem&channel_binding=require",
      },
    },
  );

  expect(result.status, result.stderr).toBe(0);
  const calls = readFileSync(captureFile, "utf8").trim().split("\n").map(JSON.parse);
  expect(calls.length).toBeGreaterThan(0);
  expect(calls.every((call) => call.sslmode === "verify-full")).toBe(true);
  expect(calls.every((call) => call.channelBinding === "require")).toBe(true);
  expect(calls.every((call) => call.rootCertificate === "/certs/root.pem")).toBe(true);
});
});
