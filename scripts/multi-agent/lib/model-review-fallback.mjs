import { runRoute, writeReceipt } from "./model-review-runner.mjs";

function isWinner(result) {
  return result.status === "complete" || result.status === "dry-run";
}

export async function runFallbackLadder({ selected, prompt, options, repoRoot, reviewDir }) {
  const results = [];
  for (const reviewer of selected) {
    const result = await runRoute(reviewer, prompt, options, repoRoot);
    results.push(result);
    writeReceipt(reviewDir, result);
    if (isWinner(result)) break;
  }
  const attempted = results.map((result) => result.reviewer);
  const winner = results.find(isWinner)?.reviewer || null;
  return {
    results,
    fallback: {
      enabled: true,
      order: selected,
      attempted,
      skipped: selected.filter((reviewer) => !attempted.includes(reviewer)),
      winner,
      exhausted: !winner,
    },
  };
}
