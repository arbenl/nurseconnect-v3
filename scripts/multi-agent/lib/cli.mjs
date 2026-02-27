function normalizeKey(rawKey) {
  return String(rawKey || "").replace(/^-+/, "");
}

export function parseArgv(argv) {
  const parsed = { _: [] };

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];

    if (token === "--") {
      continue;
    }

    if (!token.startsWith("-")) {
      parsed._.push(token);
      continue;
    }

    if (token.startsWith("--")) {
      const [rawKey, inlineValue] = token.split("=");
      const key = normalizeKey(rawKey);

      if (inlineValue !== undefined) {
        parsed[key] = inlineValue;
        continue;
      }

      const next = argv[index + 1];
      if (next && !next.startsWith("-")) {
        parsed[key] = next;
        index += 1;
      } else {
        parsed[key] = true;
      }
      continue;
    }

    const key = normalizeKey(token);
    const next = argv[index + 1];
    if (next && !next.startsWith("-")) {
      parsed[key] = next;
      index += 1;
    } else {
      parsed[key] = true;
    }
  }

  return parsed;
}

export function asString(value, fallback = "") {
  if (value === undefined || value === null || value === "") {
    return fallback;
  }
  return String(value);
}

export function asNumber(value, fallback = 0) {
  if (value === undefined || value === null || value === "") {
    return fallback;
  }
  const parsed = Number(value);
  if (Number.isFinite(parsed)) {
    return parsed;
  }
  return fallback;
}

export function asBoolean(value, fallback = false) {
  if (value === undefined || value === null || value === "") {
    return fallback;
  }
  if (typeof value === "boolean") {
    return value;
  }
  const normalized = String(value).toLowerCase().trim();
  if (["1", "true", "yes", "y", "on"].includes(normalized)) {
    return true;
  }
  if (["0", "false", "no", "n", "off"].includes(normalized)) {
    return false;
  }
  return fallback;
}

export function printHelpAndExit(helpText, exitCode = 0) {
  process.stdout.write(`${helpText.trim()}\n`);
  process.exit(exitCode);
}

export function printJson(value) {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}
