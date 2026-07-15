import { randomUUID } from "node:crypto";

const posthogToken = process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN;
const posthogHost = (process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://us.i.posthog.com").replace(/\/$/, "");
const axiomToken = process.env.AXIOM_TOKEN;
const axiomDataset = process.env.AXIOM_DATASET;

if (!posthogToken || !axiomToken || !axiomDataset) {
  throw new Error(
    "Missing NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN, AXIOM_TOKEN, or AXIOM_DATASET. Pull the intended Vercel environment first."
  );
}

const smokeId = randomUUID();
const deploymentUrl = process.env.SMOKE_DEPLOYMENT_URL ?? "local";
const gitSha = process.env.VERCEL_GIT_COMMIT_SHA ?? process.env.GITHUB_SHA ?? "local";
const timestamp = new Date().toISOString();

const [posthogResponse, axiomResponse] = await Promise.all([
  fetch(`${posthogHost}/capture/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      api_key: posthogToken,
      event: "observability_smoke_test",
      properties: {
        distinct_id: `deployment-smoke:${smokeId}`,
        smoke_id: smokeId,
        deployment_url: deploymentUrl,
        git_sha: gitSha,
        source: "deployment_verification",
      },
      timestamp,
    }),
  }),
  fetch(`https://api.axiom.co/v1/datasets/${encodeURIComponent(axiomDataset)}/ingest`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${axiomToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify([
      {
        _time: timestamp,
        event: "observability.smoke",
        service: "wardrobe-web",
        smoke_id: smokeId,
        deployment_url: deploymentUrl,
        git_sha: gitSha,
        source: "deployment_verification",
      },
    ]),
  }),
]);

if (!posthogResponse.ok || !axiomResponse.ok) {
  throw new Error(
    `Observability smoke failed (PostHog ${posthogResponse.status}, Axiom ${axiomResponse.status}).`
  );
}

console.log(`Observability smoke accepted by PostHog and Axiom. smoke_id=${smokeId}`);
