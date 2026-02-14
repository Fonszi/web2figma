# Forge — Privacy Policy

**Last updated:** February 14, 2026
**Effective date:** February 14, 2026

## Overview

Forge is a Chrome Extension and Figma Plugin pair that converts websites into editable Figma designs. Forge is developed by **ubrZoft Team** (UBRZOFT, INC).

**Forge is fully local.** Your data never leaves your browser or your Figma workspace. There is no backend server, no cloud processing, and no telemetry.

## Data Collection

**Forge does not collect, transmit, or store any personal data.**

Specifically:
- No analytics or tracking scripts
- No cookies or fingerprinting
- No server-side processing
- No user accounts or login required (free tier)
- No usage telemetry or error reporting sent externally

## How Forge Works

1. **Chrome Extension** — The content script runs in your browser tab and reads the visible DOM structure and computed CSS styles of the current page. This data is converted into a structured JSON format (BridgeNode) and stored temporarily in your browser's local storage or clipboard.

2. **Local Relay** — An optional local HTTP server (`localhost:19876`) can relay extraction data between the extension and the Figma plugin. This server runs entirely on your machine and does not accept connections from external networks.

3. **Figma Plugin** — The plugin receives the BridgeNode JSON (via clipboard paste or local relay) and creates Figma nodes on your canvas. The plugin runs within Figma's sandboxed environment.

## Data Storage

- **Browser local storage** — Extraction results are temporarily stored in `chrome.storage.local` for transfer between the extension popup and background service worker. This data is cleared when a new extraction is performed.
- **Clipboard** — Extraction JSON may be copied to your clipboard for manual paste into the Figma plugin.
- **Figma pluginData** — During import, metadata (node paths and fingerprints) is stored in Figma's per-node `pluginData` to enable smart re-import diffing. This data is only accessible by the Forge plugin within your Figma file.

## Permissions

Forge requests the following Chrome permissions:

| Permission | Purpose |
|-----------|---------|
| `activeTab` | Access the current tab's DOM to extract page structure and styles |
| `scripting` | Inject the content script that walks the DOM tree |
| `storage` | Temporarily store extraction results in browser local storage |
| `clipboardWrite` | Copy extraction JSON to clipboard for transfer to Figma plugin |
| `<all_urls>` (host) | Allow extraction from any website, including localhost and private pages |

These permissions are the minimum required for Forge to function. No permission is used for data collection, tracking, or any purpose other than website-to-Figma conversion.

## Third-Party Services

Forge does not integrate with any third-party services, analytics platforms, or advertising networks. The only external network requests are:
- **Image fetching** (Figma plugin only) — When importing images, the Figma plugin UI iframe fetches image URLs referenced in the extracted page. These requests go directly from your browser to the image's original host.

## Children's Privacy

Forge does not knowingly collect information from children under 13 years of age. Forge does not collect information from anyone.

## Changes to This Policy

If we update this privacy policy, we will post the revised version at this URL and update the "Last updated" date above.

## Contact

For questions about this privacy policy:

- **Email:** hello@ubrzoft.com
- **GitHub:** https://github.com/Fonszi/forge/issues
- **Website:** https://fonszi.com
