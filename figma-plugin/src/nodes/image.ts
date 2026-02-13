/**
 * Image node creator — creates Figma RectangleNode with image fill from BridgeNode.
 *
 * Image data flow:
 * 1. BridgeNode has `imageDataUri` (small images inlined by extension) → decode base64
 * 2. BridgeNode has `imageUrl` → UI iframe fetches it → relays bytes to sandbox
 * 3. Fallback: create placeholder rectangle with "Image" text
 *
 * The UI iframe handles fetching because the plugin sandbox cannot make network requests.
 * Communication: sandbox sends FETCH_IMAGE → UI fetches → UI sends IMAGE_DATA back.
 */

import type { BridgeNode } from '../../../shared/types';

/** Pending image requests: nodeId → resolve callback. */
const pendingImageRequests = new Map<string, (data: Uint8Array | null) => void>();

/**
 * Register a handler for image data received from the UI iframe.
 * Call this once during plugin initialization.
 */
export function handleImageDataFromUi(nodeId: string, data: Uint8Array | null): void {
  const resolve = pendingImageRequests.get(nodeId);
  if (resolve) {
    resolve(data);
    pendingImageRequests.delete(nodeId);
  }
}

/**
 * Request image data from the UI iframe.
 * Returns a promise that resolves when the UI sends the data back.
 */
function requestImageFromUi(nodeId: string, url: string): Promise<Uint8Array | null> {
  return new Promise((resolve) => {
    pendingImageRequests.set(nodeId, resolve);
    figma.ui.postMessage({ type: 'FETCH_IMAGE', nodeId, url });

    // Timeout after 10 seconds
    setTimeout(() => {
      if (pendingImageRequests.has(nodeId)) {
        pendingImageRequests.delete(nodeId);
        resolve(null);
      }
    }, 10_000);
  });
}

/**
 * Decode a data URI to Uint8Array.
 */
function decodeDataUri(dataUri: string): Uint8Array | null {
  try {
    const base64Match = dataUri.match(/^data:[^;]+;base64,(.+)$/);
    if (!base64Match) return null;

    const binaryString = atob(base64Match[1]!);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes;
  } catch {
    return null;
  }
}

export async function createImageNode(
  node: BridgeNode,
  nodeId: string,
): Promise<RectangleNode> {
  const rect = figma.createRectangle();
  rect.name = node.tag === 'img' ? (node.text ?? 'Image') : node.tag;
  rect.resize(
    Math.max(1, Math.round(node.bounds.width)),
    Math.max(1, Math.round(node.bounds.height)),
  );

  let imageData: Uint8Array | null = null;

  // Try data URI first (small images inlined by extension)
  if (node.imageDataUri) {
    imageData = decodeDataUri(node.imageDataUri);
  }

  // Try fetching from URL via UI iframe
  if (!imageData && node.imageUrl && !node.imageUrl.startsWith('data:')) {
    imageData = await requestImageFromUi(nodeId, node.imageUrl);
  }

  // Apply image fill or placeholder
  if (imageData) {
    try {
      const image = figma.createImage(imageData);
      rect.fills = [
        {
          type: 'IMAGE',
          imageHash: image.hash,
          scaleMode: 'FILL',
        },
      ];
    } catch {
      applyPlaceholder(rect);
    }
  } else {
    applyPlaceholder(rect);
  }

  return rect;
}

function applyPlaceholder(rect: RectangleNode): void {
  rect.fills = [
    {
      type: 'SOLID',
      color: { r: 0.9, g: 0.9, b: 0.9 },
      opacity: 1,
    },
  ];
  // Add a subtle border to indicate placeholder
  rect.strokes = [
    {
      type: 'SOLID',
      color: { r: 0.7, g: 0.7, b: 0.7 },
      opacity: 1,
    },
  ];
  rect.strokeWeight = 1;
  rect.dashPattern = [4, 4];
}
