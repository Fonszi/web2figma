# Forge — Figma Community Listing

## Plugin Details

### Name
Forge — Website to Figma

### Tagline
Convert any website into editable Figma designs with Auto Layout, design tokens, and components.

### Description

Forge imports live websites into Figma with proper Auto Layout, editable text, extracted design tokens, and automatic component detection.

**How it works:**
1. Install the Forge Chrome Extension (available on Chrome Web Store)
2. Browse to any website and click "Extract" in the extension popup
3. Open this Figma plugin and paste the extracted JSON (or use the automatic local relay)
4. Your editable Figma design appears on canvas

**What makes Forge different:**

Unlike existing website-to-Figma tools that flatten layouts into absolute-positioned rectangles, Forge preserves the actual structure:

- **Real Auto Layout** — CSS flexbox and grid layouts become proper Figma Auto Layout with correct direction, gap, padding, and alignment
- **Editable text** — All text becomes real Figma TextNodes with correct font, size, weight, color, and line height
- **Design tokens** — Colors, typography, and effects are extracted and created as Figma styles. CSS custom properties become Figma variables.
- **Component detection** — Repeated UI patterns (cards, buttons, list items) are automatically detected and created as reusable Figma components
- **Multi-viewport** — Extract at multiple breakpoints (desktop, tablet, mobile) in one step
- **Framer-aware mode** — Enhanced fidelity when extracting Framer sites, using Framer's known structure for better component boundaries and naming
- **Smart re-import** — Re-extract a page and only update the nodes that changed, preserving your manual edits

**Fully local. No backend.**
The Chrome Extension reads the DOM directly from your browser tab. No data is sent to any server. Works with localhost, Framer preview, pages behind login, and corporate VPN pages.

**Requires:** Forge Chrome Extension (companion browser extension for page extraction)

### Category
Design tools

### Tags
- website-to-figma
- auto-layout
- design-tokens
- import
- web-design
- conversion

## Assets Required (Manual)

### Community Icon
- 128x128 PNG (square, rounded corners applied by Figma)

### Cover Art
- 1920x960 PNG
- Should show: Forge logo + a before/after (website screenshot on left, Figma design on right)

### Demo Media (optional but recommended)
- Short GIF or video (30-60 seconds) showing:
  1. Opening a website in Chrome
  2. Clicking "Extract" in the Forge extension
  3. Pasting into the Figma plugin
  4. Seeing the editable design appear on canvas

## Links

- **Support:** https://github.com/Fonszi/forge/issues
- **Documentation:** https://github.com/Fonszi/forge
- **Privacy policy:** https://fonszi.com/privacy
- **Website:** https://fonszi.com

## Publishing Checklist

- [ ] Icon uploaded (128x128 PNG)
- [ ] Cover art uploaded (1920x960 PNG)
- [ ] Description filled in
- [ ] Support link added
- [ ] Tags selected
- [ ] Plugin manifest has correct `id` field (replace "forge-plugin" with Figma-assigned ID after first publish)
- [ ] Plugin tested in development mode
- [ ] Published to Figma Community
