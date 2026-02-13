# web2figma

Convert any website into fully editable Figma designs — with intelligence.

**web2figma** is a **Chrome Extension + Figma Plugin** pair that imports live websites into Figma with proper Auto Layout, editable text, extracted design tokens, and component detection. Works with **localhost**, **Framer preview**, private/authenticated pages — any page your browser can see.

Special **Framer-aware mode** delivers higher-fidelity conversion for Framer sites.

## Why web2figma?

Existing tools flatten layouts, lose text editability, and ignore design tokens. web2figma does it differently:

| Feature | html.to.design | **web2figma** |
|---------|---------------|---------------|
| Auto Layout from CSS flex/grid | Partial | Full |
| Editable text (not images) | Sometimes | Always |
| Design token extraction | No | Yes (colors, typography, effects → Figma styles) |
| Component detection | No | Yes (repeated patterns → Figma components) |
| Framer-aware mode | No | Yes (higher fidelity for Framer sites) |
| Multi-breakpoint import | Separate frames | Linked variants |
| CSS variable → Figma variable mapping | No | Yes |
| Works with localhost | Chrome ext only | Yes (core feature) |
| Works behind auth/login | Chrome ext only | Yes (core feature) |
| Needs backend server | Yes | **No** (fully local) |
| Free tier | 10/month | 15/month |

## Architecture

**Zero backend. Fully local.** The Chrome Extension extracts the DOM directly from whatever page you're viewing. No cloud service, no CORS, no headless browser.

```
┌───────────────────────────────────────┐
│     Chrome Extension (Content Script) │  Injected into any page
│  Walks DOM tree, getComputedStyle(),  │  Works with localhost,
│  extracts BridgeNode JSON             │  Framer preview, private sites
└──────────────────┬────────────────────┘
                   │ chrome.runtime.sendMessage (BridgeNode JSON)
┌──────────────────▼────────────────────┐
│   Chrome Extension (Background/Popup) │  Stores extraction, manages state
│   Copy to clipboard / relay to Figma  │
└──────────────────┬────────────────────┘
                   │ clipboard paste OR Figma plugin callback URL
┌──────────────────▼────────────────────┐
│        Figma Plugin (UI iframe)       │  Preact UI
│  Paste JSON / receive from extension  │  Preview, settings, token panel
└──────────────────┬────────────────────┘
                   │ postMessage
┌──────────────────▼────────────────────┐
│     Figma Plugin (Sandbox)            │  TypeScript
│  BridgeNode → Figma nodes            │  Auto Layout, styles, components
│  Design tokens → Figma styles/vars   │
└───────────────────────────────────────┘
```

### Why Chrome Extension instead of a Backend?

| Aspect | Backend (Playwright) | Chrome Extension |
|--------|---------------------|-----------------|
| Infrastructure cost | $10-50+/mo | **$0** |
| Works with localhost | No | **Yes** |
| Works behind auth/login | No | **Yes** |
| Framer preview mode | No | **Yes** |
| CORS issues | Yes | **None** |
| Network latency | Yes (round trip) | **None** (local) |
| Maintenance burden | Server, scaling, uptime | **None** |
| User trust | Data sent to server | **Data stays local** |

## Quick Start

### Development

```bash
# Install dependencies
npm install

# Build everything (watch mode)
npm run dev

# Build Chrome extension
npm run build:extension

# Build Figma plugin
npm run build:plugin

# Run tests
npm test
```

### Load Chrome Extension

1. Go to `chrome://extensions/`
2. Enable "Developer mode"
3. Click "Load unpacked" → select `dist/extension/`
4. Navigate to any website → click the web2figma extension icon → "Extract"

### Load Figma Plugin

1. Open Figma → Plugins → Development → Import plugin from manifest
2. Select `figma-plugin/manifest.json` from this repo
3. Run the plugin → paste the extracted JSON or use the extension relay

## Project Structure

```
web2figma/
├── extension/                    # Chrome Extension
│   ├── manifest.json             # Chrome extension manifest (MV3)
│   ├── src/
│   │   ├── content/              # Content script (injected into pages)
│   │   │   ├── extractor.ts      # DOM tree walker + computed style extraction
│   │   │   ├── framer-detector.ts# Framer site detection + enhanced extraction
│   │   │   ├── layout-analyzer.ts# CSS flex/grid → LayoutInfo mapping
│   │   │   ├── image-collector.ts# Image URL collection + inline data URIs
│   │   │   ├── token-scanner.ts  # CSS variable + design token scanning
│   │   │   └── component-hasher.ts# DOM subtree hashing for component detection
│   │   ├── popup/                # Extension popup UI
│   │   │   ├── Popup.tsx         # Main popup (Preact)
│   │   │   ├── ExtractButton.tsx
│   │   │   ├── ViewportPicker.tsx
│   │   │   └── StatusDisplay.tsx
│   │   ├── background/           # Service worker
│   │   │   └── service-worker.ts # Message relay, storage, state management
│   │   └── shared/               # Shared between content/popup/background
│   │       └── messages.ts       # Chrome extension message types
│   └── icons/                    # Extension icons (16, 48, 128)
├── figma-plugin/                 # Figma Plugin
│   ├── manifest.json             # Figma plugin manifest
│   ├── src/
│   │   ├── main.ts               # Plugin sandbox entry point
│   │   ├── converter.ts          # Main BridgeNode → Figma pipeline
│   │   ├── nodes/                # Figma node creation (one per type)
│   │   │   ├── frame.ts          # FrameNode + Auto Layout creation
│   │   │   ├── text.ts           # TextNode creation + font loading
│   │   │   ├── image.ts          # Image fill handling
│   │   │   ├── vector.ts         # SVG/vector handling
│   │   │   └── styles.ts         # Style application (fills, strokes, effects)
│   │   ├── tokens/               # Design token → Figma style creation
│   │   │   ├── colors.ts         # → PaintStyle
│   │   │   ├── typography.ts     # → TextStyle
│   │   │   ├── effects.ts        # → EffectStyle
│   │   │   └── variables.ts      # → Figma Variable
│   │   ├── components/           # Component detection → Figma components
│   │   │   ├── detector.ts       # Pattern matching from hashes
│   │   │   └── creator.ts        # ComponentNode + InstanceNode creation
│   │   └── ui/                   # Plugin UI (Preact, runs in iframe)
│   │       ├── App.tsx
│   │       ├── components/
│   │       │   ├── JsonInput.tsx  # Paste extracted JSON
│   │       │   ├── Preview.tsx    # Preview of extraction
│   │       │   ├── Settings.tsx   # Import settings
│   │       │   ├── Progress.tsx   # Import progress bar
│   │       │   └── TokenPanel.tsx # Design token preview
│   │       └── styles/
│   └── tsconfig.json
├── shared/                       # Shared types between extension + plugin
│   ├── types.ts                  # BridgeNode, ComputedStyles, LayoutInfo, DesignTokens
│   ├── constants.ts              # Viewports, thresholds, limits
│   └── messages.ts               # Plugin ↔ UI message types
├── package.json
├── tsconfig.json
├── esbuild.config.mjs
├── PRODUCT_PLAN.md
├── CLAUDE.md
└── .cursor/
    └── rules/
        └── web2figma.mdc
```

## Bridge Format

The intermediate JSON format that flows from Chrome Extension to Figma Plugin. Full types in `shared/types.ts`.

```typescript
interface BridgeNode {
  tag: string;
  type: 'frame' | 'text' | 'image' | 'svg' | 'input';
  children: BridgeNode[];
  text?: string;
  styles: ComputedStyles;     // Every computed CSS property we care about
  layout: LayoutInfo;          // Flex/grid → Auto Layout mapping
  bounds: BoundingBox;         // getBoundingClientRect()
  imageUrl?: string;           // <img> src or background-image
  svgData?: string;            // Inline SVG markup
  componentHash?: string;      // For component detection
  dataAttributes?: Record<string, string>;  // data-framer-* etc.
}
```

## Revenue Model

- **Free:** 15 extractions/month, single viewport, basic conversion
- **Pro ($12/mo):** Unlimited extractions, multi-viewport, design tokens, component detection, Framer-aware mode
- **Team ($9/seat/mo):** Pro + shared presets, team styles, priority support

## Tech Stack

- **Chrome Extension:** TypeScript, Preact (popup UI), Chrome Extensions Manifest V3
- **Figma Plugin:** TypeScript, Preact (plugin UI), Figma Plugin API
- **Shared:** TypeScript types (BridgeNode, DesignTokens)
- **Build:** esbuild (both extension and plugin)
- **Testing:** Vitest (unit), Playwright (E2E for extension)

## Links

- [Product Plan](./PRODUCT_PLAN.md) — full milestones, competitive analysis, revenue projections
- [CLAUDE.md](./CLAUDE.md) — AI agent context
- [Figma Plugin API Docs](https://www.figma.com/plugin-docs/)
- [Chrome Extensions MV3 Docs](https://developer.chrome.com/docs/extensions/mv3/)
- [Framer Developer Docs](https://www.framer.com/developers/)
- Hub agent: `/Users/imikaszab/Repos/compose-ai-agent-hub/agent/`
- Skills: `compose-ai-agent-hub/skills/figma-plugin-expert.md`, `compose-ai-agent-hub/skills/web-to-design-expert.md`
