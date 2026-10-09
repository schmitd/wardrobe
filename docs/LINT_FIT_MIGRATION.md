# lint.fit Clerk migration readiness

Prepared 2026-10-05 in the saved Wardrobe cloud workspace. This is a staged
candidate, not a production deployment or permission to submit the Clerk domain
change. Coordinate the browser task and parent before production changes.

## Confirmed baseline and rollback references

- Repository: `schmitd/wardrobe`; clean initial HEAD and production source:
  `29f8634fc093c16d4c538fa791d7024674f6b753`.
- Vercel project: `prj_PujS5EMlGkisim5HzskAN9ZnLLbm`, team:
  `team_CmnbGPygQobEDXhV0O8OOSOY`.
- READY production deployment: `dpl_5dbeZi1SvEmFtPSZnLPqxrV69Ufh`, URL:
  `wardrobe-g3i59yrvq-david-schmitts-projects-4af5a2eb.vercel.app`.
- Existing application origin: `https://wardrobe.davidcschmitt.com`; existing
  issuer: `https://clerk.wardrobe.davidcschmitt.com`; audience: `convex`.
- Vercel confirms both application domains verified, with no redirects.
- Mobile bundle ID `com.davidcschmitt.wardrobe`, Android package
  `com.wardrobe.app`, scheme `wardrobe`, EAS project
  `9b4470c6-c65f-493d-9cfd-c309f304e63c`, production channel/environment.
- The old web and EAS public keys/origin overrides have **not** been captured:
  shell has no application environment files or deployment credentials; Vercel
  environment metadata listing is forbidden (403). The credentialed operator
  must preserve their current public configuration before cutover. Preserve
  existing private configuration in place; do not copy or print private keys.
- Local executable source and reverse patches are in
  `output/lint-fit-migration/source.patch` and `rollback.patch`.

## Candidate source

Only the production issuer changes in `apps/web/convex/auth.config.ts`.
`applicationID: "convex"` and the existing development issuer remain unchanged.
Native API and Calendar browser-link defaults, plus the mobile environment
example, change to `https://lint.fit`. Native OAuth scheme, identifiers, data
schema, and authorization/ownership code remain unchanged. Backend ownership
uses Clerk `identity.subject`, including deletion checks, so the existing
instance and existing user IDs must be preserved.

## Public configuration to apply together

Do not derive, fabricate, or prepopulate the replacement publishable key. After
the browser changes the existing instance's primary domain, copy the newly
generated **publishable** key from that instance's dashboard and verify its
encoded Frontend API host is `clerk.lint.fit` and its prefix is `pk_live_`.

| Configuration | Cutover target |
| --- | --- |
| Vercel production `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Actual regenerated dashboard key, pending |
| EAS production `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY` | Same actual regenerated dashboard key, pending |
| EAS production `EXPO_PUBLIC_WARDROBE_API_URL` | `https://lint.fit` |
| Clerk application/home origin | `https://lint.fit` |
| Clerk Account Portal sign-in | `https://accounts.lint.fit/sign-in` (browser must confirm dashboard path) |
| Clerk Account Portal sign-up | `https://accounts.lint.fit/sign-up` (browser must confirm dashboard path) |
| Vercel production `NEXT_PUBLIC_CLERK_SIGN_IN_URL` | Confirmed Account Portal sign-in URL above |
| Vercel production `NEXT_PUBLIC_CLERK_SIGN_UP_URL` | Confirmed Account Portal sign-up URL above |
| Vercel production `NEXT_PUBLIC_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL` | `https://lint.fit/` |
| Vercel production `NEXT_PUBLIC_CLERK_SIGN_UP_FALLBACK_REDIRECT_URL` | `https://lint.fit/` |
| Clerk post-login/post-sign-up fallback origin/path | `https://lint.fit/` |
| Google OAuth authorized application origin | `https://lint.fit` |
| Google OAuth redirect URI | `https://clerk.lint.fit/v1/oauth_callback` (browser must confirm Clerk's displayed value) |
| Native SSO redirect allowlist | Preserve the exact existing `wardrobe://continue` callback |
| Calendar connection start | `https://lint.fit/fits?view=plans&calendar=connect&returnTo=mobile` |
| Calendar web return | `https://lint.fit/fits?view=plans&calendar=connected` (native adds `&returnTo=mobile`) |
| Clerk webhook URL, if configured | `https://lint.fit/api/webhooks/clerk`; preserve existing signing configuration |
| Convex issuer/JWKS | `https://clerk.lint.fit`, `https://clerk.lint.fit/.well-known/jwks.json`, strict `convex` audience |

Production at `b0c7633` uses modal sign-in and hosted Account Portal fallback;
it has no local `/sign-in`, `/sign-up`, or `/sso-callback` routes. The recovered
QA candidate adds `/sign-in/[[...sign-in]]` for its visible guest and session-loading
Sign in links, with a return link to the same-tab guest wardrobe. Existing modal
entry and hosted environment/proxy fallback remain intact. Do not configure
links to nonexistent `/sign-up` or `/sso-callback` routes. A manual production
`/sign-in` 404 does not establish a broken modal/hosted sign-in flow.
Calendar return derives its origin from the browser.
Inspect and update any existing force-redirect overrides that still point at
the old host; do not override intentional protected-page return destinations.
Keep current Google OAuth scopes, grants, native registration, and disabled
passkeys. Do not introduce wildcard origins or redirect URLs.

## Deployment capabilities and hold

The migration branch `codex/lint-fit-clerk-readiness` has automatic Vercel Git
deployments disabled with an exact branch-specific `git.deploymentEnabled`
entry in its source `vercel.json`. This prevents publication from starting a
preview before coordinated Clerk/public-key cutover. Other branches remain at
their existing default. The pinned Convex CLI also rejects a production deploy
key in a Vercel preview environment; this guard is not disabled. A deliberate
existing-project production deployment of the candidate remains a parent action.

Read-only Vercel deployment/project/domain lookups succeed. Environment-variable
metadata lookup fails with 403. This shell exposes no `CONVEX_DEPLOY_KEY`,
`VERCEL_TOKEN`, or `EXPO_TOKEN`, and no application `.env` files. The only matching
credential name is `GH_TOKEN`; its value was not inspected. Convex deployment
selection/authentication and EAS production access are unverified. No anonymous
Convex provisioning or credential generation was attempted.

The repository's Vercel build command runs Confect generation, then
`convex deploy --cmd-url-env-var-name NEXT_PUBLIC_CONVEX_URL --cmd "bun run web-build"`.
It therefore needs the existing Convex deployment credential in Vercel. Do not
run it as a local build check or publish from the dirty Mac checkout. Before
submitting the domain change, the parent must confirm an operator can update
Vercel public configuration, deploy this exact candidate to the existing Convex
production deployment, and update EAS production public configuration. Preserve
the current Convex deployment selection/URL; this migration moves no data.

After the parent coordinates cutover: browser changes the existing instance,
validates DNS/certificates/Google callback, and supplies the actual public key;
the credentialed operator updates public configuration and deploys this source.
Record the new source SHA and Vercel/Convex deployment evidence. Rebuild/export
native with the same production public key and API origin. Run
`preflight:native-auth` against that real key and `preflight:testflight` inside
EAS production before release. A compile with the repository's CI fixture key
does not establish production auth readiness.

## Validation evidence

Logs are in `output/lint-fit-migration/`. Bun 1.3.8 was installed under `/tmp`.
The frozen dependency install failed because the network proxy blocks the
GitHub API archive for `react-native-volume-manager`. For local checks only,
its exact pinned commit `db5674c1efec5d271a303a32f68d41f4cdb08fb1` was fetched
from GitHub codeload and its declarations generated; no manifest or lockfile
changes were made. This is not a successful clean frozen install.

- `bun run --bun test`: passed all workspace tasks; 148 web and 27 mobile tests.
- `bun run --bun typecheck`: passed all workspace tasks, including both web and
  Convex TypeScript projects.
- `bun run --bun lint`: passed; two existing web hook-dependency warnings.
- `bun run --bun confect codegen`: passed; generated files up to date.
- Imported issuer configuration: exactly the new production issuer and the
  unchanged development issuer, both with `applicationID: "convex"`.
- `git diff --check`: passed.
- `bun run --bun expo export --platform ios --platform android`: passed using
  the repository's existing CI fixture key and `https://lint.fit` API origin;
  bundles at `/tmp/wardrobe-lint-fit-native-export`. Expo home was directed to
  `/tmp` and telemetry disabled for this local check. No signed binary or real
  production authentication was verified.
- `bun run --bun build` with the repository's existing CI fixture public key:
  five workspace builds passed; web build failed fetching Oswald and Space
  Grotesk from Google Fonts (network proxy 403). No mock-font pass is claimed.
- Actual production key validation, authenticated computer-use QA, physical
  native QA, and a Convex production push remain blocked/pending the coordinated
  credentialed handoff.

Browser-owner update: the Google OAuth client was matched to the existing
Clerk client and its new `https://lint.fit` origin and
`https://clerk.lint.fit/v1/oauth_callback` were saved while retaining old entries
and localhost; no scopes or credentials changed. Browser still holds Clerk
primary-domain submission. This update is supplied by the browser owner, not
independently verified from this shell.

## Dual issuer assessment and rollback

No temporary old+new production issuer acceptance is staged. It requires proof
from the approved existing Clerk instance that both endpoints remain valid and
serve its signing keys; equal keys alone do not establish same-instance identity.
Even with a strict `convex` audience, retaining the old issuer extends trust in
old sessions and depends on old DNS/JWKS lifecycle. Shared subject IDs mean a
different instance must never be accepted as a bridge. A primary-domain change
can invalidate sessions, so a bridge is not a zero-downtime guarantee. The
credentialed parent must evaluate any exception before deployment.

Rollback must be coordinated across Clerk domain/DNS/social callbacks, public
keys, Convex issuer, and native public configuration. Restoring only the old
Vercel deployment after Clerk changes its domain will not restore auth. If
rolling the domain back, obtain the dashboard-generated key for the restored
domain and verify whether it matches the preserved old public key before reuse.
Use the reverse source patch or the exact baseline source, restore the existing
Convex deployment's old issuer, and restore confirmed public origin settings.
Promote the recorded old Vercel deployment only when compatible with restored
Clerk configuration. Existing installed native builds need a compatible public
configuration/update; an OTA must respect fingerprint runtime compatibility.
Expect users to sign in again. Do not roll back ownership repairs or data.

## QA and delivery hold

Do not redirect the old application host until browser and native auth QA pass.
Computer-use QA must cover Google sign-in, sign-out and returning users, existing
closet/data ownership, fits and plans, uploads/capture, profile/account behavior,
Calendar reconnect/return, and the same native configuration on devices.
Verify protected routes require auth and new tokens reach Convex with the exact
new issuer and `convex` audience. Confirm any webhook still delivers to the
existing backend. No invites, tester messages, TestFlight release, redirect,
DNS mutation, Clerk mutation, push, or production deployment was performed here.

References: [Clerk changing domains](https://clerk.com/docs/guides/development/deployment/changing-domains),
[Clerk production and native redirects](https://clerk.com/docs/guides/development/deployment/production),
[Convex Clerk integration](https://docs.convex.dev/auth/clerk).
