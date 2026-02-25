#!/usr/bin/env node

import { execFileSync } from "node:child_process";

function runGhJson(args, options = {}) {
  const output = execFileSync("gh", args, {
    encoding: "utf8",
    stdio: ["pipe", "pipe", "pipe"],
    ...options,
  });
  return JSON.parse(output);
}

function runGhText(args, options = {}) {
  return execFileSync("gh", args, {
    encoding: "utf8",
    stdio: ["pipe", "pipe", "pipe"],
    ...options,
  }).trim();
}

function runText(command, args, options = {}) {
  return execFileSync(command, args, {
    encoding: "utf8",
    stdio: ["pipe", "pipe", "pipe"],
    ...options,
  }).trim();
}

function isBotActor(login) {
  return /(copilot|sentry)/i.test(String(login || ""));
}

function resolvePrNumber() {
  if (process.env.PR_NUMBER) {
    return Number(process.env.PR_NUMBER);
  }

  const currentBranch = runText("git", ["rev-parse", "--abbrev-ref", "HEAD"]);
  if (!currentBranch || currentBranch === "HEAD") {
    return NaN;
  }
  const number = runGhText(["pr", "view", currentBranch, "--json", "number", "--jq", ".number"]);
  return Number(number);
}

function resolveRepo() {
  const owner = runGhText(["repo", "view", "--json", "owner", "--jq", ".owner.login"]);
  const name = runGhText(["repo", "view", "--json", "name", "--jq", ".name"]);
  return { owner, name };
}

function listUnresolvedBotThreads(owner, name, prNumber) {
  const query = `
    query($owner: String!, $name: String!, $pr: Int!) {
      repository(owner: $owner, name: $name) {
        pullRequest(number: $pr) {
          reviewThreads(first: 100) {
            nodes {
              isResolved
              path
              comments(first: 50) {
                nodes {
                  author { login }
                  url
                }
              }
            }
          }
        }
      }
    }
  `;

  const payload = JSON.stringify({
    query,
    variables: { owner, name, pr: prNumber },
  });

  const response = runGhJson(["api", "graphql", "--input", "-"], { input: payload });
  const threads =
    response?.data?.repository?.pullRequest?.reviewThreads?.nodes ?? [];

  return threads
    .filter((thread) => thread?.isResolved === false)
    .map((thread) => {
      const botComments = (thread?.comments?.nodes ?? []).filter((comment) =>
        isBotActor(comment?.author?.login),
      );
      return {
        path: thread?.path || "unknown",
        botComments,
      };
    })
    .filter((thread) => thread.botComments.length > 0);
}

function main() {
  try {
    runText("gh", ["--version"]);
  } catch {
    console.log("[pr-bot-comments] Skipping: gh CLI not found.");
    process.exit(0);
  }

  if (!process.env.GITHUB_TOKEN) {
    try {
      runGhText(["auth", "status"]);
    } catch {
      console.log("[pr-bot-comments] Skipping: gh auth unavailable.");
      process.exit(0);
    }
  }

  let prNumber;
  try {
    prNumber = resolvePrNumber();
  } catch {
    console.log("[pr-bot-comments] Skipping: no PR context.");
    process.exit(0);
  }

  if (!Number.isFinite(prNumber) || prNumber <= 0) {
    console.log("[pr-bot-comments] Skipping: invalid PR number.");
    process.exit(0);
  }

  const { owner, name } = resolveRepo();
  const unresolved = listUnresolvedBotThreads(owner, name, prNumber);

  if (unresolved.length === 0) {
    console.log(`[pr-bot-comments] No unresolved Copilot/Sentry review threads for PR #${prNumber}.`);
    process.exit(0);
  }

  console.error(`[pr-bot-comments] Unresolved Copilot/Sentry review threads for PR #${prNumber}:`);
  for (const thread of unresolved) {
    console.error(`- ${thread.path}`);
    for (const comment of thread.botComments) {
      const login = comment?.author?.login || "unknown";
      const url = comment?.url || "url-unavailable";
      console.error(`  ${login}: ${url}`);
    }
  }

  process.exit(1);
}

main();
