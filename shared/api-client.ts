// ============================================================
// API Client — HTTP helpers for the Fonszi backend API.
//
// Follows the same pattern as relay-client.ts:
// fetchWithTimeout, AbortController, graceful null returns.
// All functions return T | null (null on any failure — offline-first).
//
// Used by: service worker (usage sync), plugin sandbox (activation, logging).
// ============================================================

import { API_BASE_URL, API_TIMEOUT_MS } from './constants';

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

function fetchWithTimeout(url: string, options: RequestInit = {}): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), API_TIMEOUT_MS);
  return fetch(url, { ...options, signal: controller.signal }).finally(() =>
    clearTimeout(timeoutId),
  );
}

function buildHeaders(licenseKey?: string): Record<string, string> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (licenseKey) {
    headers['X-License-Key'] = licenseKey;
  }
  return headers;
}

async function apiGet<T>(path: string, licenseKey?: string): Promise<T | null> {
  try {
    const response = await fetchWithTimeout(`${API_BASE_URL}${path}`, {
      headers: buildHeaders(licenseKey),
    });
    if (!response.ok) return null;
    const body = (await response.json()) as ApiResponse<T>;
    return body.success ? (body.data ?? null) : null;
  } catch {
    return null;
  }
}

async function apiPost<T>(path: string, data: unknown, licenseKey?: string): Promise<T | null> {
  try {
    const response = await fetchWithTimeout(`${API_BASE_URL}${path}`, {
      method: 'POST',
      headers: buildHeaders(licenseKey),
      body: JSON.stringify(data),
    });
    if (!response.ok) return null;
    const body = (await response.json()) as ApiResponse<T>;
    return body.success ? (body.data ?? null) : null;
  } catch {
    return null;
  }
}

// ---- License ----

export interface ActivateLicenseResult {
  id: string;
  tier: string;
  product: string;
  status: string;
  validUntil: string | null;
  activatedAt: string;
}

export async function activateLicense(
  key: string,
  product: string,
  platform: string,
): Promise<ActivateLicenseResult | null> {
  return apiPost('/v1/licenses/activate', { key, product, platform });
}

// ---- Usage ----

export interface TrackUsageResult {
  id: string;
  quotaUsed: number;
  quotaLimit: number;
}

export async function trackUsage(
  product: string,
  eventType: string,
  licenseKey?: string,
  metadata?: Record<string, string>,
): Promise<TrackUsageResult | null> {
  return apiPost('/v1/usage/track', { product, eventType, metadata: metadata ?? {} }, licenseKey);
}

export interface QuotaResult {
  product: string;
  monthKey: string;
  used: number;
  limit: number;
  remaining: number;
}

export async function getQuota(product: string, licenseKey?: string): Promise<QuotaResult | null> {
  return apiGet(`/v1/usage/quota?product=${encodeURIComponent(product)}`, licenseKey);
}

// ---- Conversions ----

export interface ConversionLogData {
  sourceUrl?: string;
  sourceType?: string;
  nodeCount?: number;
  tokenCount?: number;
  componentCount?: number;
  durationMs?: number;
  viewportCount?: number;
  errorMessage?: string;
}

export interface ConversionLogResult {
  id: string;
  sourceType: string | null;
  nodeCount: number;
  tokenCount: number;
  componentCount: number;
  durationMs: number;
  viewportCount: number;
  createdAt: string;
}

export async function logConversion(
  data: ConversionLogData,
  licenseKey?: string,
): Promise<ConversionLogResult | null> {
  return apiPost('/v1/conversions/log', data, licenseKey);
}
