# Forge — AI Agent Context

## Project Overview

- **Name:** Forge
- **Type:** Chrome Extension + Figma Plugin (Web-to-Design conversion, fully local)
- **Path:** `/Users/imikaszab/Repos/Forge`
- **GitHub:** `Fonszi/forge`
- **Stack:** TypeScript, Preact (popup + plugin UI), Chrome Extensions MV3 (content script + service worker), Figma Plugin API (sandbox), esbuild (build)
- **Purpose:** Convert any website (including localhost, Framer preview, authenticated pages) into fully editable Figma designs with Auto Layout, design tokens, component detection, and Framer-aware mode. **No backend — fully local.**

## Architecture

Two-part local system — no cloud backend:

1. **Chrome Extension** (Manifest V3)
   - Content script: injected into active tab, walks DOM, extracts computed styles + layout + images
   - Popup: extraction controls, viewport picker, status
   - Service worker: message relay, extraction storage
   - Output: BridgeNode JSON to clipboard or chrome.storage

2. **Figma Plugin** (TypeScript + Preact)
   - UI iframe: paste JSON, preview, settings, token panel, progress
   - Sandbox: Figma API node creation, style/variable/component creation
   - Input: BridgeNode JSON from clipboard or extension relay

Communication: Extension → clipboard/storage → Plugin UI → postMessage → Plugin Sandbox → Figma API.

## Key Directories

| Path | Purpose | Key files |
|------|---------|-----------|
| `extension/manifest.json` | Chrome Extension manifest (MV3) | permissions, content_scripts |
| `extension/src/content/` | Content scripts (injected into pages) | `extractor.ts`, `framer-detector.ts`, `layout-analyzer.ts`, `image-collector.ts`, `token-scanner.ts`, `component-hasher.ts` |
| `extension/src/popup/` | Extension popup UI (Preact) | `Popup.tsx`, `ExtractButton.tsx`, `ViewportPicker.tsx`, `StatusDisplay.tsx` |
| `extension/src/background/` | Service worker | `service-worker.ts` |
| `figma-plugin/manifest.json` | Figma plugin manifest | main, ui, networkAccess |
| `figma-plugin/src/main.ts` | Plugin sandbox entry point | message handling, settings, import orchestration |
| `figma-plugin/src/converter.ts` | Main BridgeNode → Figma pipeline | `convertToFigma()`, recursive node tree conversion |
| `figma-plugin/src/nodes/` | Figma node creators (one per type) | `frame.ts`, `text.ts`, `image.ts`, `vector.ts`, `styles.ts` |
| `figma-plugin/src/tokens/` | Design token → Figma style creation | `colors.ts` → PaintStyle, `typography.ts` → TextStyle, `effects.ts` → EffectStyle, `variables.ts` → Variable |
| `figma-plugin/src/components/` | Component detection → Figma components | `detector.ts` (pattern matching), `creator.ts` (ComponentNode/InstanceNode) |
| `figma-plugin/src/ui/` | Plugin UI (Preact) | `App.tsx`, `JsonInput.tsx`, `Preview.tsx`, `Settings.tsx`, `Progress.tsx`, `TokenPanel.tsx` |
| `shared/types.ts` | Bridge format types | `BridgeNode`, `ComputedStyles`, `LayoutInfo`, `DesignTokens`, `ExtractionResult`, `ImportSettings` |
| `shared/constants.ts` | Shared constants | `VIEWPORTS`, `COMPONENT_THRESHOLD`, `MAX_NODE_DEPTH`, `FREE_IMPORT_LIMIT` |
| `shared/messages.ts` | Plugin ↔ UI message types | `UiToSandboxMessage`, `SandboxToUiMessage`, `ImportPhase` |

## Bridge Format

Central data type `BridgeNode` in `shared/types.ts` — a serializable DOM tree with computed styles, layout info, bounds, and optional image/SVG data. Created by the Chrome Extension content script, consumed by the Figma Plugin sandbox.

## Key Patterns

- **Auto Layout mapping:** CSS `display: flex` → Figma Auto Layout. Logic in `extension/src/content/layout-analyzer.ts` (detection) and `figma-plugin/src/nodes/frame.ts` (creation)
- **Text handling:** Always create `TextNode`, never flatten to image. Must call `figma.loadFontAsync()` before setting characters. Logic in `figma-plugin/src/nodes/text.ts`
- **Design tokens:** Extract unique colors → `PaintStyle`, typography → `TextStyle`, shadows → `EffectStyle`, CSS vars → `Variable`. Scanning in `extension/src/content/token-scanner.ts`, creation in `figma-plugin/src/tokens/`
- **Component detection:** Hash DOM subtree structure + style signature. 3+ matches → `ComponentNode` + `InstanceNode`s. Hashing in `extension/src/content/component-hasher.ts`, creation in `figma-plugin/src/components/`
- **Framer-aware:** Detect `framerusercontent.com` assets / `data-framer-*` attrs → enhanced extraction. Detection + enhanced extraction in `extension/src/content/framer-detector.ts`
- **Image handling:** Small images (<100KB) → data URI in BridgeNode JSON. Large images → URL, fetched by plugin UI iframe → relayed to sandbox as Uint8Array

## Commands

```bash
npm install               # Install all workspace dependencies
npm run dev               # Watch mode (both extension + plugin)
npm run build:extension   # Production build: Chrome Extension → dist/extension/
npm run build:plugin      # Production build: Figma Plugin → dist/plugin/
npm run build             # Build both
npm test                  # Run tests (Vitest)
npm run lint              # ESLint
npm run typecheck         # TypeScript check
```

## DO NOT CHANGE

- Bridge format types in `shared/types.ts` — contract between extension and plugin. Update both sides when changing.
- Chrome Extension manifest `extension/manifest.json` permissions without reviewing Chrome Web Store policies.
- Figma plugin manifest `figma-plugin/manifest.json` API version without testing in Figma dev mode.
- `shared/constants.ts` thresholds without testing impact on extraction quality.

## Conventions

- Figma node creation: one file per node type in `figma-plugin/src/nodes/`
- Design token logic: one file per token type in `figma-plugin/src/tokens/`
- Extension content scripts: one file per extraction concern in `extension/src/content/`
- UI components: Preact functional components + hooks, CSS modules (both popup and plugin UI)
- Test files: `*.test.ts` co-located with source
- Error messages: user-friendly strings (shown in popup or plugin UI)
- All shared types in `shared/` — never duplicate between extension and plugin

## Cross-Project References

| What | Path |
|------|------|
| Hub agent spec | `/Users/imikaszab/Repos/compose-ai-agent-hub/agent/agent-spec.md` |
| Hub project registry | `/Users/imikaszab/Repos/compose-ai-agent-hub/agent/project-registry.md` |
| Hub project knowledge | `/Users/imikaszab/Repos/compose-ai-agent-hub/agent/project-knowledge.md` |
| Hub deep knowledge | `/Users/imikaszab/Repos/compose-ai-agent-hub/agent/project-knowledge-deep.md` |
| Figma plugin expert skill | `/Users/imikaszab/Repos/compose-ai-agent-hub/skills/figma-plugin-expert.md` |
| Web-to-design expert skill | `/Users/imikaszab/Repos/compose-ai-agent-hub/skills/web-to-design-expert.md` |
| Figma plugin dev template | `/Users/imikaszab/Repos/compose-ai-agent-hub/prompt-templates/figma-plugin-development.md` |
| Web-to-Figma conversion template | `/Users/imikaszab/Repos/compose-ai-agent-hub/prompt-templates/web-to-figma-conversion.md` |
| Skill router | `/Users/imikaszab/Repos/compose-ai-agent-hub/skills/skill-router.md` |
| Plugin assist template | `/Users/imikaszab/Repos/compose-ai-agent-hub/prompt-templates/plugin-assist.md` |
| Related: compose-to-figma | `/Users/imikaszab/Repos/compose-to-figma` (Compose ↔ Figma, different domain) |
| Related: compose-figma | `/Users/imikaszab/Repos/compose-figma` (Figma plugin + CMP app) |
| Cursor rules for this project | `/Users/imikaszab/Repos/Forge/.cursor/rules/forge.mdc` |
| Product plan | `/Users/imikaszab/Repos/Forge/PRODUCT_PLAN.md` |
