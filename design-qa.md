# Unified Capture Design QA

**Source visual truth path**

`/Users/david/.codex/generated_images/019f4a4c-8fbc-74e1-b1a9-56c08ccd5254/call_R7CJjgklnZSErmnt08Lw4xEe.png`

**Implementation screenshot path**

`/Users/david/.codex/visualizations/2026/07/10/019f4a4c-8fbc-74e1-b1a9-56c08ccd5254/unified-capture-qa/mobile-intent-menu-final.png`

**Viewport**

390 × 844 CSS pixels in signed-in Chrome.

**State**

Empty Rack route with the centered capture button expanded to show the “My wardrobe” and “Just trying” intent selector.

**Full-view comparison evidence**

The source concept and browser-rendered implementation were opened together in the same comparison input. The implementation preserves the source's central interaction: a five-position mobile dock, an emphasized centered `+`, and a two-choice intent control directly above it. It intentionally adopts the shipped application's border, type, color, and shadow tokens instead of importing the concept's photographic rack content into the empty state.

**Focused region comparison evidence**

No separate crop was needed because the relevant dock and intent selector occupy the lower third of both full-height images and their labels, icons, borders, spacing, and selected state are legible at the captured resolution.

**Required fidelity surfaces**

- Fonts and typography: the existing display and UI typefaces, weights, wrapping, and compact mobile labels remain consistent with the current application. Both intent labels and supporting copy are legible without truncation.
- Spacing and layout rhythm: the dock remains fully visible; the 76 × 76 centered action button has clear separation from the 70-pixel intent selector; there is no horizontal overflow or overlap.
- Colors and visual tokens: the selected intent and active Rack destination use the existing chartreuse accent; borders, lavender background, and elevation match the current product.
- Image quality and asset fidelity: this interaction state requires no new imagery. Icons use the project's existing icon library; no placeholder, emoji, CSS drawing, or handcrafted SVG was introduced.
- Copy and content: “My wardrobe / I own or wore it” and “Just trying / Feedback, not owned” make ownership consequences explicit before the system picker opens.

**Findings**

- No actionable P0, P1, or P2 visual differences remain for the unified capture interaction.
- Accepted difference: the source is a populated aspirational Rack, while the implementation capture is the authenticated empty Rack. This does not affect the dock or intent interaction under review.
- P3 follow-up: native Expo can give the intent selector and camera controls platform-native motion and haptics; this is recorded in `docs/unified-capture-roadmap.md` and is intentionally outside the mobile-web milestone.

**Primary interactions tested**

- Open and dismiss the centered capture intent selector, including outside-click dismissal.
- Choose “My wardrobe,” upload a real full-body fixture through Chrome's system file chooser, and verify routing to a saved fit check.
- Verify the new fit appears in the daily fit calendar and recent-fit history with detected-piece correction affordances.
- Choose “Just trying,” upload the same fixture, and verify closet-compatibility feedback plus a Try on history entry.
- Verify “Just trying” does not add owned Rack items.
- Verify the mobile selector's menu/menuitem accessibility roles and desktop `Add` navigation state.

**Console errors checked**

No application errors were present. Chrome reported only Clerk's expected development-key warning on the preview deployment.

**Comparison history**

- Initial implementation QA found no actionable P0/P1/P2 visual mismatch in the dock/selector region. No visual fix iteration was required.
- Functional browser QA initially failed to automate file selection because Chrome file-URL access was disabled. After the user enabled it, both real upload paths completed successfully; this was an automation permission issue, not a design defect.

**Implementation checklist**

- [x] Match the source's centered capture stack within the existing design system.
- [x] Keep ownership intent explicit and lightweight.
- [x] Route real photos agent-first and preserve correction for uncertain garment matches.
- [x] Confirm mobile layout, accessibility roles, desktop state, persistence behavior, and browser console.

final result: passed
