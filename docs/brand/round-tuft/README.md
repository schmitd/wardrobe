# Selected Round Tuft implementation

Prepared 2026-10-06 on local branch `codex/round-tuft-branding`, based on
`c0681fe26af0cd4c8b71450c06e784e8d5a651aa`. This branch is not pushed or
deployed. Integrate only after the parent coordinates the ongoing auth/native QA.

## Selected asset and fidelity

The user explicitly selected **Round Tuft**, Library
`libfile_3879755e40b481918caebcfb4c623851`, file `lint-round-tuft.png`.
The original 1536 × 1024 RGB study sheet is retained unchanged alongside this
document as `lint-round-tuft-source.png`.
SHA256: `054b7f33c7bb787057fdcff79737bcafe5fe6f264baec64f4a268bab494261f1`.
The producing executor downloaded, verified and visually inspected these bytes.

The assets reuse the primary Round Tuft and Lint lockup's actual pixels; they
are not generated alternatives or a new vector interpretation. Deterministic
cropping removes the sheet labels. Near-white paper texture becomes transparent;
the original silhouette and antialiased edges are retained and ink normalized
to the existing `#241426` token. The chartreuse icon background is the existing
`#DCE66E` token. The navbar keeps its existing `#D8C9DC` lavender shell.
No Soft Loop substitution, redraw, altered loops/tail, or aesthetic redesign.

Regenerate with the existing Sharp dependency:

```sh
bun run scripts/generate-round-tuft-assets.ts
```

## Assets and consumption

- `apps/web/public/brand/lint-round-tuft-lockup.png`: transparent 720 × 270
  lockup, displayed at 44 px height in the actual navbar with an accessible
  `Lint home` link. The home target remains at least 44 × 44 px.
- `apps/web/public/brand/lint-round-tuft-mark.png`: transparent primary tuft.
- `apps/mobile/assets/icon.png`: opaque 1024 × 1024 iOS/store icon, retaining
  the existing Expo icon path. Its mark leaves at least 14% edge padding.
- `apps/mobile/assets/adaptive-icon.png`: transparent 1024 × 1024 Android
  foreground, explicitly configured with chartreuse background.
- `apps/mobile/assets/monochrome-icon.png`: same shape/alpha for Android themed
  icons; Android owns its theme tint. Configuration is supported by the
  installed Expo config types.
- `apps/web/src/app/favicon.ico` and `apple-icon.png`: matching browser and
  Apple-touch icon assets; Next's existing metadata conventions consume them.
- The existing synthetic browser fixture serves only the two known public
  brand PNGs and consumes Next Image's `priority` prop without leaking it onto
  its mock `<img>`. No application auth bypass or production route was added.

Navigation, application features, identifiers, auth configuration and the native
scheme remain intact. This task does not rename the native application or
change its bundle identifier. Native icon/configuration changes require a new
native build and fingerprint compatibility review; JavaScript export or an OTA
does not install a new home-screen icon. Do not insert this patch into the
native build currently undergoing auth QA without parent coordination.

## Verification and limits

The actual Navbar was rendered through the repository's existing synthetic
React fixture with local Chromium/Playwright. Desktop 1440 px and mobile 390 px
screenshots were inspected alongside the selected artwork. Images loaded at
the expected dimensions, the home link navigated via keyboard, there was no
horizontal mobile overflow, and no browser console or uncaught errors occurred.
No signed-in production interaction or credential was used.

The master iOS icon is opaque and exactly 1024-square. Every Android foreground
pixel stays within radius 300.72 px of center, inside the conservative 313 px
safe circle; round and rounded masks preserve the tail. Inspected 64/48/32/24/16
px samples retain the selected silhouette; finer loop detail naturally reduces
at favicon size. Palette contrast is 12.96:1 on chartreuse and 11.06:1 on lavender.

- `bun run --bun test`: passed, 148 web and 27 mobile tests plus workspace gates.
- `bun run --bun typecheck`: passed all workspace gates, including the generator
  and the fixture changes.
- `bun run --bun lint`: passed, two existing web hook-dependency warnings.
- iOS and Android Expo exports: passed with the existing repository CI fixture
  public key and `https://lint.fit` API origin. No signed native binary was built.
- `bun run --bun build`: blocked by Turbopack rejecting dependency symlinks
  outside this isolated worktree. Dependencies were reused read-only from the
  prepared auth workspace; no dependency/package/lockfile changes were made.
- Secondary web build with `next build --webpack`: reached font processing
  but was blocked fetching Oswald and Space Grotesk from Google Fonts. No font
  mock or successful production-build claim is made.
- Real iOS/Android installation, themed-icon rendering and a credentialed clean
  production build remain integration checks after parent coordination.

Local evidence lives under `output/round-tuft`: navbar screenshots,
`icon-and-small-size-preview.png`, standalone `preview.html`,
`visual-checks.json`, command logs, and portable source/rollback artifacts.
The auth workspace remained clean at `c0681fe` throughout this task.
