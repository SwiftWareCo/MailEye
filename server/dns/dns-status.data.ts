/**
 * DNS Status Data Layer (Task 4.5)
 *
 * Data fetching functions for DNS propagation status with caching
 * to reduce database load during frontend polling (30-second intervals).
 *
 * Caching Strategy:
 * - In-memory cache with 10-second TTL
 * - Frontend polls every 30 seconds, so cache hits on repeated queries
 * - Cache automatically clears stale entries
 */

import 'server-only';

import { eq, and } from 'drizzle-orm';
import { db } from '@/lib/db';
import { dnsPollingSession } from '@/lib/db/schema/dns-polling';
import { dnsRecords } from '@/lib/db/schema/dns-records';
import { domains } from '@/lib/db/schema/domains';
import type { PollingSession } from './polling-job';

/**
 * Cache entry with timestamp
 */
interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

/**
 * In-memory cache for polling session data
 * TTL: 10 seconds (frontend polls every 30 seconds)
 */
const sessionCache = new Map<string, CacheEntry<PollingSession | null>>();
const CACHE_TTL = 10000; // 10 seconds in milliseconds

/**
 * Clear expired cache entries
 */
function clearExpiredCache() {
  const now = Date.now();
  for (const [key, entry] of sessionCache.entries()) {
    if (now - entry.timestamp > CACHE_TTL) {
      sessionCache.delete(key);
    }
  }
}

/**
 * Get cached data or fetch from database
 */
function getCached<T>(
  key: string,
  cache: Map<string, CacheEntry<T>>
): T | null {
  const entry = cache.get(key);
  if (!entry) return null;

  const now = Date.now();
  if (now - entry.timestamp > CACHE_TTL) {
    cache.delete(key);
    return null;
  }

  return entry.data;
}

/**
 * Set cache data
 */
function setCache<T>(
  key: string,
  data: T,
  cache: Map<string, CacheEntry<T>>
): void {
  cache.set(key, {
    data,
    timestamp: Date.now(),
  });
}

/**
 * Get polling session with user authorization check
 *
 * @param sessionId - Polling session ID
 * @param userId - User ID for authorization
 * @returns Polling session or null if not found/unauthorized
 */
export async function getPollingSessionWithAuth(
  sessionId: string,
  userId: string
): Promise<PollingSession | null> {
  try {
    // Check cache first
    const cacheKey = `session:${sessionId}:${userId}`;
    const cached = getCached(cacheKey, sessionCache);
    if (cached !== null) {
      return cached;
    }

    // Fetch from database
    const [session] = await db
      .select()
      .from(dnsPollingSession)
      .where(
        and(
          eq(dnsPollingSession.id, sessionId),
          eq(dnsPollingSession.userId, userId)
        )
      )
      .limit(1);

    const result = session ? (session as PollingSession) : null;

    // Cache result
    setCache(cacheKey, result, sessionCache);
    clearExpiredCache();

    return result;
  } catch (error) {
    console.error('Error fetching polling session:', error);
    return null;
  }
}

/**
 * Get active polling session for a domain (with user authorization)
 *
 * @param domainId - Domain ID
 * @param userId - User ID for authorization
 * @returns Active polling session or null
 */
export async function getDomainActivePollingSession(
  domainId: string,
  userId: string
): Promise<PollingSession | null> {
  try {
    // Check cache first
    const cacheKey = `domain-session:${domainId}:${userId}`;
    const cached = getCached(cacheKey, sessionCache);
    if (cached !== null) {
      return cached;
    }

    // First verify user owns the domain
    const [domain] = await db
      .select()
      .from(domains)
      .where(and(eq(domains.id, domainId), eq(domains.userId, userId)))
      .limit(1);

    if (!domain) {
      return null; // Unauthorized or domain not found
    }

    // Fetch active polling session
    const [session] = await db
      .select()
      .from(dnsPollingSession)
      .where(
        and(
          eq(dnsPollingSession.domainId, domainId),
          eq(dnsPollingSession.userId, userId),
          eq(dnsPollingSession.status, 'polling')
        )
      )
      .limit(1);

    const result = session ? (session as PollingSession) : null;

    // Cache result
    setCache(cacheKey, result, sessionCache);
    clearExpiredCache();

    return result;
  } catch (error) {
    console.error('Error fetching active polling session:', error);
    return null;
  }
}

/**
 * DNS record status summary
 */
export interface DNSRecordStatus {
  id: string;
  type: string; // DNS record type (TXT, MX, CNAME, etc.)
  name: string | null;
  content: string | null; // DNS record value/content
  purpose: string | null;
  propagationStatus: string | null;
  propagationCoverage: number | null; // 0-100% coverage
  lastCheckedAt: Date | null;
}

/**
 * Get DNS record propagation statuses for a domain (with user authorization)
 *
 * @param domainId - Domain ID
 * @param userId - User ID for authorization
 * @returns Array of DNS record statuses
 */
export async function getDNSRecordStatuses(
  domainId: string,
  userId: string
): Promise<DNSRecordStatus[]> {
  try {
    // First verify user owns the domain
    const [domain] = await db
      .select()
      .from(domains)
      .where(and(eq(domains.id, domainId), eq(domains.userId, userId)))
      .limit(1);

    if (!domain) {
      return []; // Unauthorized or domain not found
    }

    // Fetch DNS records
    const records = await db
      .select({
        id: dnsRecords.id,
        type: dnsRecords.recordType,
        name: dnsRecords.name,
        content: dnsRecords.value,
        purpose: dnsRecords.purpose,
        propagationStatus: dnsRecords.propagationStatus,
        propagationCoverage: dnsRecords.propagationCoverage,
        lastCheckedAt: dnsRecords.lastCheckedAt,
      })
      .from(dnsRecords)
      .where(
        and(eq(dnsRecords.domainId, domainId), eq(dnsRecords.status, 'active'))
      );

    return records as DNSRecordStatus[];
  } catch (error) {
    console.error('Error fetching DNS record statuses:', error);
    return [];
  }
}

/**
 * Invalidate cache for a specific session
 * Called when session is updated to ensure fresh data
 *
 * @param sessionId - Session ID to invalidate
 * @param userId - User ID
 */
export function invalidateSessionCache(
  sessionId: string,
  userId: string
): void {
  const cacheKey = `session:${sessionId}:${userId}`;
  sessionCache.delete(cacheKey);
}

/**
 * Invalidate cache for a domain's active polling session
 * Called when polling session status changes
 *
 * @param domainId - Domain ID to invalidate
 * @param userId - User ID
 */
export function invalidateDomainSessionCache(
  domainId: string,
  userId: string
): void {
  const cacheKey = `domain-session:${domainId}:${userId}`;
  sessionCache.delete(cacheKey);
}

/**
 * Clear all cache entries (for testing or maintenance)
 */
export function clearAllCache(): void {
  sessionCache.clear();
}
