# Storage ownership cutover

Decision, 2026-09-18: David authorized preserving current photo owners and proceeding with release. For this one-time cutover, trust consistent account associations in a fixed pre-cutover production snapshot. This is an approved migration assumption, not a finding that exploitation has been ruled out. Treat snapshots, manifests, and evidence as private operational records. Never commit them or include storage IDs in public issue comments.

## Invariant and compatibility

After cutover, only server-observed upload provenance or an explicit operator review can grant ownership. The authenticated `getUploadUrl` contract still returns a URL; the client POSTs raw bytes and receives `{ storageId }`. The new URL is a single-use, ten-minute capability. Uploads are limited to 20 MiB and clients report useful size/authorization errors.

Historical `uploads`, wardrobe references, fit crops, and storage metadata do not independently prove the uploader: these were writable claims. The owner-approved migration explicitly accepts existing associations in the cutover snapshot. Reconcile `uploads.storageId`, `wardrobeItems.storageId`, `fitChecks.storageId`, `candidateItems.storageId`, and `garmentObservations.cropStorageId` against their rows' account IDs. Import an object only when every recorded association agrees on one account. Escalate conflicts; preserve unreferenced objects without inventing an owner. Record the snapshot hash and the authorization in `reviewEvidence`. This exception must not become a public handler or a continuing fallback that adopts newly supplied references. No legacy deletion is part of this repair.

## Reviewable release sequence

1. Back up production data and files privately. Retain the repair branch and validation record. Reconcile existing owners from that exact snapshot; verify object hashes/creation times and absence of conflicting or deleted owners. Do not publish the novel security details before the repair is deployed.
2. Verify the new backend on a dedicated deployment, including old-client upload shape, CORS, owner-only reads, revoked tickets, and account cleanup. Configure the Convex `GEMINI_API_KEY` for background style memory; Next.js credentials do not propagate there. Prepare the matching production web build without promoting its domains or deploying its backend.
3. Pre-seed `storageObjects` with the explicitly approved snapshot owners before deploying strict enforcement, so established photos retain access at cutover. Convex permits creating a table before adding it to the schema. Use an append-only import only when the target table is absent/empty; verify exactly one matching row per approved object afterward. Never blindly retry an uncertain import or replace an existing table. Existing trusted rows instead use the idempotent reviewed-approval mutation after conflict checks.
4. Reconcile any newly arrived references against a final pre-cutover snapshot. Deploy the strict backend, verify the imported ownership inventory, then promote the staged web build. Unknown objects fail closed, and older clients retain the upload protocol without being allowed to claim an old untrusted ID.
5. Verify a migrated historical photo and a newly uploaded synthetic photo for the proper account; verify another account cannot read, attach, promote, or delete either. Run synthetic account deletion and inspect scheduled batches. Preserve unreferenced legacy files and report the counts.
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

At most 500 entries per manifest; inventory pages contain at most 50 blobs. Registered claims are bounded and explicitly marked if truncated. The initial snapshot adoption follows the explicit decision above; later approvals require their own reviewed basis.

## Remaining limitations

A process crash between storing a blob and recording provenance may leave an unowned orphan. Normal finalization failures delete the stored blob; an orphan grants no access through the application and is never adopted automatically. Orphan/legacy retention and garbage collection need a separate reviewed policy. Account deletion is asynchronous after immediate revocation; inspect scheduler failures as part of operations. The inventory CLI supports explicit review, not proof recovery. The approved initial migration does not justify automatically adopting unknown files afterward.
