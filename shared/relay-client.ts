// ============================================================
// Relay Client — HTTP helpers for the local relay server.
//
// Used by both Chrome Extension popup and Figma Plugin UI.
// All functions use a 2-second timeout to avoid hanging
// when the relay server is not running.
// ============================================================

import { RELAY_BASE_URL, RELAY_HEALTH_ENDPOINT, RELAY_EXTRACTION_ENDPOINT } from './constants';
import type { ImportPayload } from './types';

export interface RelayHealth {
  status: 'ok';
  version: string;
  hasExtraction: boolean;
  timestamp: number;
}

const TIMEOUT_MS = 2000;

function fetchWithTimeout(url: string, options: RequestInit = {}): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);
  return fetch(url, { ...options, signal: controller.signal }).finally(() =>
    clearTimeout(timeoutId),
  );
}

/** Check if the relay server is running. Returns null if unreachable. */
export async function checkRelayHealth(): Promise<RelayHealth | null> {
  try {
    const response = await fetchWithTimeout(`${RELAY_BASE_URL}${RELAY_HEALTH_ENDPOINT}`);
    if (!response.ok) return null;
    return (await response.json()) as RelayHealth;
  } catch {
    return null;
  }
}

/** Post extraction data to the relay server. Returns true on success. */
export async function postExtraction(payload: ImportPayload): Promise<boolean> {
  try {
    const response = await fetchWithTimeout(`${RELAY_BASE_URL}${RELAY_EXTRACTION_ENDPOINT}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return response.ok;
  } catch {
    return false;
  }
}

/** Fetch the latest extraction from the relay server. Returns null if empty or unreachable. */
export async function fetchExtraction(): Promise<ImportPayload | null> {
  try {
    const response = await fetchWithTimeout(`${RELAY_BASE_URL}${RELAY_EXTRACTION_ENDPOINT}`);
    if (response.status === 204) return null;
    if (!response.ok) return null;
    return (await response.json()) as ImportPayload;
  } catch {
    return null;
  }
}
