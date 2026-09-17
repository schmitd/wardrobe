# Storage ownership cutover

Status: repair verified locally; no production inventory, ownership approvals, deployment, or customer-data changes have been performed. Treat inventory, manifests, and evidence as private operational records. Never commit them or include storage IDs in public issue comments.

## Invariant and compatibility

Only server-observed upload provenance or an explicit operator review can grant ownership. The authenticated `getUploadUrl` contract still returns a URL; the client POSTs raw bytes and receives `{ storageId }`. The new URL is a single-use, ten-minute capability. Uploads are limited to 20 MiB and clients report useful size/authorization errors.

Historical `uploads`, wardrobe references, fit crops, and storage metadata alone do not establish the uploader: these were writable claims. A row's existence, a sole claimant, or matching timestamps is not enough. Do not bulk approve them. Find independent trusted evidence, or leave the object inaccessible and ask its intended user to upload a replacement. No automated legacy deletion is part of this repair.

## Reviewable release sequence

1. Agree on a maintenance window and handling of inaccessible historical photos. Back up the current deployment/data under the existing operational process. Retain the repair branch and validation record. Do not publish the novel security details before the repair is deployed.
2. Verify the new backend on a dedicated deployment, including old-client upload shape, CORS, owner-only reads, revoked tickets, and account cleanup. Configure the Convex `GEMINI_API_KEY` for background style memory; Next.js credentials do not propagate there.
3. During maintenance, deploy the strict backend and matching web build. The internal inventory functions are part of that backend. Unknown historical objects immediately fail closed; older clients can continue the upload protocol but cannot adopt an old untrusted ID.
4. Export the metadata-only inventory privately. Review independently corroborated ownership and construct a manifest. Dry-run it against the exact deployment, then apply only reviewed entries. Hash, creation time, conflicting-owner, and deleted-account checks run again in the mutation. A partial apply is safe to retry for the same owner.
5. Verify a reviewed historical photo and a newly uploaded photo for the proper account; verify another account cannot read, attach, promote, or delete either. Verify a synthetic account-deletion run and its scheduled batches. Reopen traffic when agreed photo handling and operational checks pass.
6. Release native changes through the established EAS/TestFlight gates. Inspect authenticated provider work, background-memory updates, PostHog/Axiom ingestion, and persisted opt-out on both platforms. Keep native replay disabled.

Do not roll back to backend code that trusts caller-supplied ownership. Preserve the strict storage boundary and use a forward fix or keep maintenance active. The new tables are additive, but restoring the old authorization behavior is not a safe rollback.

## Operator commands

From `apps/web`, use `bun run scripts/storage-review.ts`. The CLI requires `CONVEX_URL` and `CONVEX_DEPLOY_KEY` for an intentional nonlocal target. Supply credentials through the approved secret mechanism, never as command-line literals or in committed files. `--local` reads only the ignored local Convex config and uses `http://127.0.0.1:3210`.

```sh
bun run scripts/storage-review.ts inventory --local --out ../../.private/storage-inventory.json
bun run scripts/storage-review.ts review --local --manifest ../../.private/storage-review.json
# Explicit mutation after reviewing the dry run:
bun run scripts/storage-review.ts review --local --manifest ../../.private/storage-review.json --apply
```

For an approved remote deployment, omit `--local` after configuring both required environment variables. Inventory is read-only and outputs no photo URLs or image content. Files are created with mode 0600; the CLI does not log credentials or object IDs. Review exports still contain private account identifiers.

Manifest shape (illustrative values, never auto-fill evidence from a claim):

```json
{
  "deploymentUrl": "http://127.0.0.1:3210",
  "reviewedBy": "operator identifier",
  "approvals": [{
    "storageId": "reviewed storage ID",
    "userId": "independently verified owner",
    "expectedSha256": "exact inventory hash",
    "expectedCreatedAt": 0,
    "evidence": "Reference to independent trusted uploader evidence"
  }]
}
```

At most 500 entries per manifest; inventory pages contain at most 50 blobs. Registered claims are bounded and explicitly marked if truncated. These limits do not turn a claim into provenance.

## Remaining limitations

A process crash between storing a blob and recording provenance may leave an unowned orphan. Normal finalization failures delete the stored blob; an orphan grants no access through the application and is never adopted automatically. Orphan/legacy retention and garbage collection need a separate reviewed policy. Account deletion is asynchronous after immediate revocation; inspect scheduler failures as part of operations. The inventory CLI supports review, not proof recovery: if trusted evidence does not exist, re-upload is required.
