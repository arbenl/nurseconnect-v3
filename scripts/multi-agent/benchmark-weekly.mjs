#!/usr/bin/env node
import { runBenchmarkSuite } from "./benchmark.mjs";

async function main() {
  const result = await runBenchmarkSuite({
    execute: false,
    weekly: true,
  });

  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

main().catch((error) => {
  process.stderr.write(`${error.stack || error.message}\n`);
  process.exit(1);
});
