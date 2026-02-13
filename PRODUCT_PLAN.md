# web2figma — Product Plan

## Vision

The definitive website-to-Figma conversion tool. Better than html.to.design in every measurable way, with a Framer-aware mode that no competitor offers. **Fully local — no backend, no cloud, no data leaving your machine.**

---

## Competitive Analysis

### html.to.design (by divRIOTS)
- **631k+ users** on Figma Community — massive market validation
- **Strengths:** Simple UX (paste URL, click import), Pro plan with unlimited imports
- **Weaknesses:**
  - Requires a backend server (sends your URLs to their cloud)
  - Flattens CSS flex/grid → absolute positioning (no Auto Layout)
  - Text sometimes rendered as images, not editable TextNodes
  - No design token extraction (colors, typography don't become Figma styles)
  - No component detection (everything is flat frames)
  - Multi-breakpoint imports are disconnected frames
  - SVGs often broken
  - Custom fonts don't always map correctly
  - Chrome extension exists but only for private/auth pages — core flow still uses backend
  - No incremental re-import / diffing

### Our Key Advantage: No Backend

html.to.design sends your URL to their server, which renders it with a headless browser. This means:
- They can't access localhost / dev servers
- They can't access pages behind corporate VPNs or auth
- Your design data passes through their cloud
- They pay for server infrastructure → higher prices

**web2figma uses a Chrome Extension.** The extension runs directly in your browser tab, extracting the DOM and computed styles from whatever page you're viewing. This means:
- **localhost:3000** works perfectly (React dev server, Next.js, Framer preview, anything)
- **Private/auth pages** work automatically (you're already logged in)
- **$0 infrastructure** — no server to run or pay for
- **Data stays local** — nothing leaves your browser except to Figma
- **Faster** — no network round-trip to a cloud backend

### Our Differentiators (summary)
1. **Fully local** — Chrome Extension, no backend, $0 infrastructure
2. **Auto Layout fidelity** — CSS flex/grid → proper Figma Auto Layout
3. **Always-editable text** — Real Figma TextNodes, never flattened to images
4. **Design token pipeline** — CSS variables + computed values → Figma styles + variables
5. **Component detection** — Repeated DOM patterns → Figma components + instances
6. **Framer-aware mode** — Detect Framer sites → enhanced extraction using Framer's known structure
7. **Localhost-first** — Works with any local dev server out of the box
8. **Privacy** — Design data never leaves your machine

---

## Architecture

### Two-Part System (No Backend)

```
Part 1: Chrome Extension (Manifest V3)
├── Content Script: injected into active tab
│   ├── extractor.ts          — recursive DOM walker, getComputedStyle()
│   ├── layout-analyzer.ts    — CSS flex/grid detection → LayoutInfo
│   ├── framer-detector.ts    — Framer site detection + enhanced extraction
│   ├── image-collector.ts    — collect image URLs, convert small images to data URIs
│   ├── token-scanner.ts      — CSS custom property scanning
│   └── component-hasher.ts   — DOM subtree structure+style hashing
├── Popup UI: extraction controls, viewport picker, status
├── Service Worker: message relay, extraction storage, state
└── Output: BridgeNode JSON (clipboard or chrome.storage)

Part 2: Figma Plugin (TypeScript + Preact)
├── Plugin UI: paste JSON, preview extraction, settings, token panel
├── Plugin Sandbox: Figma API node creation
│   ├── converter.ts          — main BridgeNode → Figma pipeline
│   ├── nodes/                — one file per Figma node type
│   ├── tokens/               — design token → Figma style/variable creation
│   └── components/           — detected pattern → ComponentNode + InstanceNode
└── Input: BridgeNode JSON from clipboard or extension relay
```

### Data Flow

```
User browses to website (any: localhost, Framer, production, auth'd)
    │
    ▼
Chrome Extension content script injected
    │ DOM.walk() + getComputedStyle() + getBoundingClientRect()
    ▼
BridgeNode JSON created locally in browser
    │ chrome.storage.local.set() or navigator.clipboard.writeText()
    ▼
User opens Figma → runs web2figma plugin
    │ Pastes JSON or plugin reads from extension relay
    ▼
Figma plugin sandbox converts BridgeNode → Figma nodes
    │ Creates frames, text, images, Auto Layout, styles, components
    ▼
Editable Figma design on canvas
```

### Extension ↔ Plugin Communication Options

1. **Clipboard** (simplest, v1): Extension copies BridgeNode JSON to clipboard → user pastes in Figma plugin UI
2. **Local relay** (v2): Extension posts to `localhost:PORT` → Figma plugin fetches from same port (tiny local relay server)
3. **Figma callback URL** (v3): Figma plugin registers a callback → extension triggers it with payload

---

## Milestones

### M1: Chrome Extension — Basic DOM Extraction (Weeks 1-3)
**Goal:** Extension extracts DOM tree with computed styles from any page.

**Files:** `extension/src/content/extractor.ts`, `extension/src/content/layout-analyzer.ts`, `extension/src/popup/Popup.tsx`, `extension/manifest.json`, `shared/types.ts`

- [ ] Chrome Extension scaffold (Manifest V3, content script, popup, service worker)
- [ ] Content script: recursive DOM walker from `<body>`
- [ ] Collect `getComputedStyle()` for every visible element
- [ ] Collect `getBoundingClientRect()` for bounds
- [ ] Map CSS `display: flex/grid` → `LayoutInfo` (direction, gap, padding, alignment, sizing)
- [ ] Collect text content from text nodes
- [ ] Collect image URLs from `<img>` tags and `background-image`
- [ ] Collect inline SVG markup
- [ ] Output as BridgeNode JSON to clipboard
- [ ] Popup UI: "Extract" button, viewport info, node count, status
- [ ] Test with 5 sample sites: a Tailwind site, a Framer site, a localhost React app, a WordPress site, a plain HTML page

### M2: Figma Plugin — Basic Node Creation (Weeks 4-6)
**Goal:** Figma plugin creates editable frames from BridgeNode JSON.

**Files:** `figma-plugin/src/main.ts`, `figma-plugin/src/converter.ts`, `figma-plugin/src/nodes/frame.ts`, `figma-plugin/src/nodes/text.ts`, `figma-plugin/src/nodes/image.ts`, `figma-plugin/src/ui/App.tsx`, `figma-plugin/manifest.json`

- [ ] Figma plugin scaffold (manifest, sandbox entry, Preact UI)
- [ ] UI: JSON paste input, "Import" button, progress bar
- [ ] Converter: recursive BridgeNode → Figma node creation
- [ ] FrameNode creation with correct size, position, background color, border, border-radius, opacity
- [ ] Auto Layout from LayoutInfo (direction, gap, padding, alignment, sizing modes)
- [ ] TextNode creation with font loading, size, weight, line-height, letter-spacing, alignment, color
- [ ] Image handling: fetch image from URL in UI iframe → relay bytes to sandbox → apply as fill
- [ ] SVG handling: parse SVG → VectorNode or flatten to image
- [ ] Nested Auto Layout (flex inside flex)
- [ ] Progress feedback for large pages
- [ ] Load in Figma dev mode, test with M1 extractions

### M3: Design Tokens & Styles (Weeks 7-9)
**Goal:** Extract design tokens from BridgeNode tree and create Figma styles + variables.

**Files:** `extension/src/content/token-scanner.ts`, `figma-plugin/src/tokens/colors.ts`, `figma-plugin/src/tokens/typography.ts`, `figma-plugin/src/tokens/effects.ts`, `figma-plugin/src/tokens/variables.ts`, `figma-plugin/src/ui/components/TokenPanel.tsx`

- [ ] Color extraction: all used colors → deduplicated list → Figma PaintStyles
- [ ] Typography extraction: font combos → Figma TextStyles
- [ ] Effect extraction: box-shadow → Figma EffectStyles (drop shadow, inner shadow)
- [ ] CSS custom property extraction → Figma Variables (color, number, string)
- [ ] Token naming heuristic (CSS variable name → Figma style name path, e.g. `--color-primary-500` → `color/primary/500`)
- [ ] Token panel in plugin UI: preview tokens before import, allow rename/skip
- [ ] Apply styles to nodes (link nodes to their style instead of raw values)
- [ ] Option to skip token creation (for re-imports into existing design systems)

### M4: Component Detection (Weeks 10-12)
**Goal:** Identify repeated UI patterns and create Figma components.

**Files:** `extension/src/content/component-hasher.ts`, `figma-plugin/src/components/detector.ts`, `figma-plugin/src/components/creator.ts`

- [ ] DOM subtree hashing in extension (structure + style signature, ignoring text content)
- [ ] Threshold-based grouping: 3+ matches → component candidate (threshold in `shared/constants.ts`)
- [ ] Component naming heuristic (class names, ARIA roles, tag semantics, `data-*` attributes)
- [ ] Plugin: create Figma ComponentNode from representative instance
- [ ] Plugin: replace other instances with InstanceNode
- [ ] Component panel in plugin UI: preview detected components, rename, skip
- [ ] Handle minor variations (different text/images OK, different structure = different component)

### M5: Framer-Aware Mode (Weeks 13-15)
**Goal:** When browsing a Framer site, use Framer's known structure for superior conversion.

**Files:** `extension/src/content/framer-detector.ts`, enhanced paths in `extension/src/content/extractor.ts`

- [ ] Framer detection: `framerusercontent.com` assets, `data-framer-*` attributes, Framer runtime scripts, `__framer_metadata` globals
- [ ] Framer component boundary detection (React component wrappers with `data-framer-component-type`)
- [ ] Framer stack → Figma Auto Layout (Framer stacks are flex, map directly)
- [ ] Framer text styles → Figma text styles (known typography system)
- [ ] Framer color variables → Figma color variables
- [ ] Framer breakpoint detection → multi-viewport extraction
- [ ] Framer interaction hints (hover states) → Figma component variants where possible
- [ ] Framer-specific naming (section names, component names from Framer metadata)
- [ ] Test with 10 published Framer sites + Framer preview mode on localhost

### M6: Multi-Breakpoint & Polish (Weeks 16-18)
**Goal:** Multi-viewport import, extension ↔ plugin relay, production polish.

**Files:** `extension/src/popup/ViewportPicker.tsx`, `figma-plugin/src/ui/components/Settings.tsx`

- [ ] Viewport picker in extension popup: desktop (1440), tablet (768), mobile (375), custom
- [ ] Multi-viewport extraction: resize browser → re-extract → store all viewports
- [ ] Plugin: import viewports as component variants (not disconnected frames)
- [ ] Extension ↔ plugin relay (local relay server or Figma callback URL)
- [ ] Re-import: diff current Figma tree vs new extraction, highlight changes
- [ ] Edge cases: iframes → placeholder, canvas/WebGL → screenshot fallback, lazy-loaded images → scroll trigger
- [ ] Performance: large pages (1000+ nodes), streaming creation with progress
- [ ] Publish to Chrome Web Store + Figma Community

### M7: Monetization & Launch (Weeks 19-21)
**Goal:** Pro features, payment, launch.

- [ ] Stripe integration for Pro/Team plans
- [ ] Usage tracking (local counter, validated on license check)
- [ ] Pro features: unlimited extractions, tokens, components, multi-viewport, Framer-aware
- [ ] Team features: shared presets, team style library sync
- [ ] Landing page (built in Framer — dog-fooding)
- [ ] Product Hunt launch
- [ ] Figma Community plugin page (description, artwork 1920x960, icon 128x128, demo video)
- [ ] Chrome Web Store listing optimization

---

## Tech Decisions

| Decision | Choice | Reason |
|----------|--------|--------|
| Extension manifest | Manifest V3 | Required for new Chrome extensions; service workers |
| Plugin UI framework | Preact | Tiny bundle, JSX, works in both extension popup and Figma iframe |
| Plugin build tool | esbuild | Fast, handles TS + JSX, can build both extension and plugin |
| Extension ↔ Plugin relay | Clipboard (v1), local relay (v2) | Clipboard is zero-config; relay is seamless UX |
| Image handling | Data URI for small (<100KB), URL for large | Avoids bloating the JSON payload |
| Font resolution | Match against `figma.listAvailableFontsAsync()` | Only use fonts Figma actually has |
| Auth & billing | Stripe + license key | Simple, no user database needed for v1 |
| Testing | Vitest (unit), Playwright (extension E2E) | Vitest for types/logic, Playwright for real browser extension testing |
| Monorepo | npm workspaces (`extension/`, `figma-plugin/`, `shared/`) | Clean separation, shared types |

---

## Revenue Projections

Based on html.to.design having 631k users with estimated 2-5% paid conversion:

| Scenario | Paid Users | MRR | ARR |
|----------|-----------|-----|-----|
| Conservative (1k users, 3% paid) | 30 | $360 | $4,320 |
| Moderate (10k users, 4% paid) | 400 | $4,800 | $57,600 |
| Optimistic (50k users, 5% paid) | 2,500 | $30,000 | $360,000 |

**Key advantage:** With $0 backend costs, even 30 paid users covers Stripe fees and domain. Pure profit from day 1.

---

## Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Chrome Extension review delays | Medium | Medium | Submit early; follow MV3 guidelines strictly |
| Figma API limitations for complex layouts | Medium | High | Test early; design absolute-position fallbacks |
| Framer changes DOM structure | Medium | Medium | Version detection; graceful fallback to generic mode |
| html.to.design copies our features | Low-Medium | Medium | Move fast; Framer-aware + local-first are hard to replicate |
| Chrome blocks content script injection | Low | High | Use `activeTab` permission; follow Chrome policies |
| Large pages (5000+ nodes) freeze Figma | Medium | Medium | Batch creation with `setTimeout`; depth/node limits |

---

## File References

- Project root: `/Users/imikaszab/Repos/web2figma/`
- Bridge format types: `shared/types.ts`
- Extension manifest: `extension/manifest.json`
- Extension extractor: `extension/src/content/extractor.ts`
- Extension Framer detector: `extension/src/content/framer-detector.ts`
- Extension popup: `extension/src/popup/Popup.tsx`
- Figma plugin manifest: `figma-plugin/manifest.json`
- Figma plugin entry: `figma-plugin/src/main.ts`
- Figma converter: `figma-plugin/src/converter.ts`
- Figma node creators: `figma-plugin/src/nodes/` (frame.ts, text.ts, image.ts, vector.ts, styles.ts)
- Figma token creators: `figma-plugin/src/tokens/` (colors.ts, typography.ts, effects.ts, variables.ts)
- Figma component creators: `figma-plugin/src/components/` (detector.ts, creator.ts)
- Plugin UI: `figma-plugin/src/ui/` (App.tsx, components/)
- Hub agent spec: `/Users/imikaszab/Repos/compose-ai-agent-hub/agent/agent-spec.md`
- Hub project registry: `/Users/imikaszab/Repos/compose-ai-agent-hub/agent/project-registry.md`
- Hub project knowledge: `/Users/imikaszab/Repos/compose-ai-agent-hub/agent/project-knowledge.md`
- Figma plugin expert skill: `/Users/imikaszab/Repos/compose-ai-agent-hub/skills/figma-plugin-expert.md`
- Web-to-design expert skill: `/Users/imikaszab/Repos/compose-ai-agent-hub/skills/web-to-design-expert.md`
- Web-to-Figma conversion template: `/Users/imikaszab/Repos/compose-ai-agent-hub/prompt-templates/web-to-figma-conversion.md`
- Figma plugin dev template: `/Users/imikaszab/Repos/compose-ai-agent-hub/prompt-templates/figma-plugin-development.md`
