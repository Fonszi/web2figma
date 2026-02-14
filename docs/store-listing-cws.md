# Forge — Chrome Web Store Listing

## Store Details

### Name
Forge — Website to Figma

### Short Description (132 chars max)
Convert any website into editable Figma designs with Auto Layout, design tokens, and components. Fully local — no backend needed.

### Detailed Description (max ~4000 chars for CWS)

Forge converts any website into fully editable Figma designs — with real Auto Layout, editable text, design tokens, and component detection.

**How it works:**
1. Browse to any website (production, localhost, Framer preview, or pages behind login)
2. Click the Forge extension icon and hit "Extract"
3. Open the Forge Figma plugin and paste the extraction (or use the automatic local relay)
4. Get an editable Figma design with proper structure

**Key features:**
- Auto Layout from CSS flex/grid — not flattened absolute positioning
- Always-editable text — real Figma TextNodes, never images
- Design token extraction — colors, typography, and effects become Figma styles
- CSS variables mapped to Figma variables
- Component detection — repeated UI patterns become reusable Figma components
- Framer-aware mode — enhanced fidelity for Framer sites
- Multi-viewport import — extract at desktop, tablet, and mobile breakpoints
- Smart re-import — diff against previous imports and update only what changed

**Fully local. No backend.**
Unlike tools that send your URLs to a cloud server, Forge runs entirely in your browser. Your data never leaves your machine. This also means:
- Works with localhost and dev servers
- Works behind corporate VPNs and authentication
- No network latency — extraction is instant
- Zero infrastructure cost

**Free tier:** 15 extractions per month with single viewport and basic conversion.
**Pro:** Unlimited extractions, multi-viewport, design tokens, components, Framer-aware mode.

Requires the Forge Figma plugin (available on Figma Community) for the import step.

### Category
Developer Tools

### Language
English

## Permissions Justification

These justifications are required for Chrome Web Store review. Each permission must be explained.

### activeTab
**Justification:** Forge needs to access the DOM of the currently active tab to extract the page's structure, computed CSS styles, and layout information. This data is used to create a structured representation (BridgeNode JSON) that the companion Figma plugin converts into editable Figma designs. The extension only accesses the tab when the user explicitly clicks "Extract" in the popup — it never runs automatically or in the background.

### scripting
**Justification:** Forge uses the `chrome.scripting.executeScript` API to inject its content script into the active tab. The content script walks the DOM tree using `getComputedStyle()` and `getBoundingClientRect()` to extract visual properties of every visible element. This injection is triggered only by explicit user action (clicking "Extract") and is required because the extraction logic needs access to the page's live DOM and computed styles.

### storage
**Justification:** Forge uses `chrome.storage.local` to temporarily store the extraction result (BridgeNode JSON) so it can be transferred from the content script to the popup UI via the background service worker. The stored data is overwritten on each new extraction and contains only structural/style information about the extracted page — no personal data, credentials, or browsing history.

### clipboardWrite
**Justification:** After extraction, Forge copies the BridgeNode JSON to the user's clipboard so they can paste it into the companion Figma plugin. This is the primary data transfer mechanism between the Chrome extension and the Figma plugin. The clipboard write only occurs when the user explicitly triggers an extraction.

### Host Permissions: <all_urls>
**Justification:** Forge is a general-purpose website-to-Figma conversion tool that must work on any website the user visits, including:
- Production websites (any domain)
- Localhost development servers (localhost:3000, etc.)
- Framer preview URLs (framerusercontent.com)
- Pages behind authentication or corporate VPNs

The `<all_urls>` host permission is required so the content script can be injected into any page the user wants to extract. The content script is only injected when the user explicitly clicks "Extract" — it does not run automatically on page load or perform any background activity.

## MV3 Compliance Checklist

- [x] `manifest_version: 3` — Uses Manifest V3
- [x] Service worker background — No persistent background page, uses service worker
- [x] `type: "module"` — Service worker uses ES modules
- [x] No remote code execution — All JavaScript is bundled at build time, no `eval()` or remote script loading
- [x] Content Security Policy — Default MV3 CSP (no inline scripts)
- [x] `activeTab` over broad host permissions — Uses `activeTab` for tab access; `<all_urls>` host permission is for content script injection (required for localhost/private page support)
- [x] No deprecated APIs — Does not use `chrome.browserAction`, `chrome.webRequest` blocking, or other MV2-only APIs
- [x] Minimal permissions — Only 4 permissions requested, each with clear justification
- [x] No background persistence — Service worker has no keep-alive or periodic alarms

## Assets Required (Manual)

These must be created manually (design work):

### Screenshots (1280x800 or 640x400, 1-5 required)
1. Extension popup showing extraction in progress on a sample website
2. Figma plugin showing imported design with Auto Layout structure
3. Design tokens panel showing extracted colors and typography
4. Before/after comparison: website screenshot vs Figma result
5. Multi-viewport extraction showing desktop + mobile side by side

### Promotional Images
- **Small tile:** 440x280 PNG
- **Marquee:** 1400x560 PNG (optional but recommended)

### Extension Icon
- 128x128 PNG (used as store listing icon)
- Already referenced in manifest as `icons/icon-128.png`

## Store Settings

- **Visibility:** Public
- **Distribution:** All regions
- **Mature content:** No
- **Privacy policy URL:** https://fonszi.com/privacy (links to docs/privacy-policy.md content)
- **Support URL:** https://github.com/Fonszi/forge/issues
- **Website:** https://fonszi.com
