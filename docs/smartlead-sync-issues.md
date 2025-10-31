# SmartLead Sync Issues

**Date Identified**: 2025-10-30
**Status**: Known Issues - Not Yet Fixed

This document tracks synchronization issues between MailEye's local database and SmartLead's API data. These issues were discovered during production testing after implementing SmartLead's 2025 warmup best practices.

---

## Issue #1: Warmup Status Shows "Not Started"

### Problem
MailEye displays "Warmup not started - Set up Smartlead to begin" even when SmartLead dashboard shows the warmup is actively running.

### User Impact
- Users see confusing status information
- Cannot trust warmup status displayed in MailEye
- Must verify actual status in SmartLead dashboard separately

### Root Cause
The `warmupStartedAt` field in the local database is never populated when:
1. Email account connects to SmartLead via OAuth
2. Warmup settings are enabled/updated

**Location**: [server/smartlead/account-connector.ts:450-459](server/smartlead/account-connector.ts#L450-L459)

```typescript
// When warmup is enabled, status is set to 'warming' but warmupStartedAt is NOT set
await db
  .update(emailAccounts)
  .set({
    smartleadAccountId: String(smartleadResponse.emailAccountId),
    status: warmupEnabled ? 'warming' : 'inactive',
    warmupStatus: warmupEnabled ? 'in_progress' : 'not_started',
    // ❌ Missing: warmupStartedAt: new Date()
    updatedAt: new Date(),
  })
  .where(eq(emailAccounts.id, emailAccountId));
```

**UI Logic That Depends on This Field**:
[components/email-accounts/EmailAccountMetrics.tsx:161-165](components/email-accounts/EmailAccountMetrics.tsx#L161-L165)

```typescript
if (!account.warmupStartedAt) {
  return (
    <div className="text-center py-12">
      <p className="text-muted-foreground mb-4">
        Warmup not started - Set up Smartlead to begin
```

### Proposed Solution
1. Set `warmupStartedAt` when warmup is first enabled in `account-connector.ts`
2. Set `warmupStartedAt` when syncing from SmartLead if `warmup_enabled: true` and field is null
3. Consider fetching warmup status directly from SmartLead API instead of relying on local DB field

---

## Issue #2: Incorrect Bounce Calculation

### Problem
MailEye shows incorrect bounce counts that don't match SmartLead's data.

**Example**:
- MailEye displays: **2 bounces**
- SmartLead displays: **0 bounces**

### User Impact
- Deliverability metrics are inaccurate
- Users cannot trust warmup health indicators
- May make incorrect decisions based on false bounce data

### Root Cause
The bounce calculation uses an incorrect formula that misinterprets the meaning of `savedFromSpam`.

**Location**: [server/warmup/metrics.actions.ts:154](server/warmup/metrics.actions.ts#L154)

```typescript
bounced: sent - savedFromSpam, // ❌ WRONG FORMULA
```

**Why This Is Wrong**:
- `savedFromSpam` represents emails that were moved FROM the spam folder to inbox (a GOOD thing!)
- This is a positive deliverability metric, not a negative one
- Using `sent - savedFromSpam` incorrectly treats rescued emails as failures

### Actual SmartLead API Response
The SmartLead API returns correct bounce data at the top level:

```javascript
{
  id: 12790176,
  sent_count: '5',
  spam_count: '0',           // ✅ Actual bounces/spam
  inbox_count: '5',          // ✅ Successfully delivered
  warmup_email_received_count: '2',
  stats_by_date: [...]
}
```

**API Endpoint**: `GET /email-accounts/{id}/warmup-stats`
**Response logged at**: [server/warmup/metrics.actions.ts:140](server/warmup/metrics.actions.ts#L140)

### Proposed Solution
Use the correct fields from the SmartLead API response:

```typescript
// Option 1: Use spam_count directly
bounced: parseInt(smartleadData.spam_count || '0', 10)

// Option 2: Calculate from known values
bounced: sent - inbox_count

// Note: SmartLead provides spam_count directly, so Option 1 is preferred
```

---

## Issue #3: Local Database Status Fields Never Synced

### Problem
Warmup-related fields in the local `email_accounts` table are set once during initial connection but never updated thereafter, causing drift from SmartLead's actual state.

### User Impact
- Local database shows stale warmup information
- Status fields (warmup day count, daily limits) become inaccurate over time
- Forces reliance on real-time API calls for accurate data

### Affected Fields

**Schema Location**: [lib/db/schema/email-accounts.ts:32-39](lib/db/schema/email-accounts.ts#L32-L39)

```typescript
warmupStatus: varchar("warmup_status", { length: 20 }).default("not_started"),
warmupStartedAt: timestamp("warmup_started_at", { withTimezone: true }),
warmupCompletedAt: timestamp("warmup_completed_at", { withTimezone: true }),
warmupDayCount: integer("warmup_day_count").default(0),
deliverabilityScore: integer("deliverability_score"),
dailyEmailLimit: integer("daily_email_limit"),
```

### Current Behavior
1. **Initial Connection** ([account-connector.ts:450-459](server/smartlead/account-connector.ts#L450-L459)): Fields are set when account first connects to SmartLead
2. **Subsequent Updates**: No mechanism exists to sync these fields from SmartLead API
3. **Real-time Fetching**: Metrics ARE fetched fresh from SmartLead API (60s cache via React Query)

### Architecture Context
Currently, the app uses a hybrid approach:
- **Warmup metrics** (sent, bounced, inbox rate): Fetched fresh from SmartLead API ✅
- **Warmup settings** (daily limit, rampup): Fetched fresh from SmartLead API ✅
- **Warmup status fields** (started date, day count): Stored in local DB, never synced ❌

This creates an inconsistency where some data is always fresh and other data becomes stale.

### Proposed Solutions

**Option A: Sync on Every Metrics Fetch**
- Update local DB fields when fetching warmup data from SmartLead
- Location: [server/warmup/metrics.actions.ts:255-312](server/warmup/metrics.actions.ts#L255-L312)
- Pros: Keeps DB reasonably fresh
- Cons: Extra DB writes on every metrics fetch

**Option B: Scheduled Background Sync**
- Create a cron job or scheduled task to sync all accounts periodically
- Frequency: Every 5-15 minutes
- Pros: Decouples sync from user requests
- Cons: Requires background job infrastructure

**Option C: Remove Reliance on Local Status Fields**
- Calculate status fields dynamically from SmartLead API responses
- Store only the `smartleadAccountId` mapping in local DB
- Pros: Single source of truth (SmartLead API)
- Cons: Cannot query warmup status without API call

**Option D: Sync on Status Changes Only**
- Update fields only when user performs actions (enable warmup, change settings)
- Location: [server/warmup/settings.actions.ts:163-184](server/warmup/settings.actions.ts#L163-L184)
- Pros: Minimal DB writes
- Cons: Won't capture status changes made directly in SmartLead UI

### Recommended Approach
Combination of **Option A** (sync on metrics fetch) and **Option D** (sync on settings updates):
1. When fetching metrics, update `warmupDayCount`, `deliverabilityScore`, `dailyEmailLimit`
2. When updating settings or syncing accounts, update `warmupStartedAt` if newly enabled
3. Add a `lastSyncedAt` timestamp to track when fields were last updated
4. Consider `warmupCompletedAt` as a one-time field set when day 30 reached

---

## Additional Context

### SmartLead API Endpoints Used
1. **GET** `/email-accounts/{id}/warmup-stats` - Returns warmup metrics with `spam_count`, `inbox_count`, `sent_count`
2. **POST** `/email-accounts/{id}/warmup` - Updates warmup settings
3. **GET** `/email-accounts` - Lists all email accounts for user

### Files Involved
- **Database Schema**: [lib/db/schema/email-accounts.ts](lib/db/schema/email-accounts.ts)
- **SmartLead API Client**: [lib/clients/smartlead.ts](lib/clients/smartlead.ts)
- **Account Connector**: [server/smartlead/account-connector.ts](server/smartlead/account-connector.ts)
- **Sync Actions**: [server/smartlead/sync.actions.ts](server/smartlead/sync.actions.ts)
- **Metrics Actions**: [server/warmup/metrics.actions.ts](server/warmup/metrics.actions.ts)
- **Settings Actions**: [server/warmup/settings.actions.ts](server/warmup/settings.actions.ts)
- **UI Component**: [components/email-accounts/EmailAccountMetrics.tsx](components/email-accounts/EmailAccountMetrics.tsx)

### Related Documentation
- [SmartLead 2025 Warmup Best Practices](docs/cold-email-best-practices.md#smartlead-advanced-features)
- [SmartLead Type Definitions](lib/types/smartlead.ts)

---

## Testing Notes

### How to Reproduce Issue #1
1. Connect email account to SmartLead via OAuth
2. Enable warmup in SmartLead dashboard
3. View email account detail page in MailEye
4. Expected: Shows warmup is active
5. Actual: Shows "Warmup not started"

### How to Reproduce Issue #2
1. Have an active warmup account in SmartLead with known metrics
2. View warmup metrics in MailEye
3. Compare bounce count between MailEye and SmartLead dashboard
4. Expected: Bounce counts match
5. Actual: MailEye shows incorrect higher bounce count

### Verification After Fixes
- Compare all metrics between MailEye and SmartLead dashboard
- Verify warmup status displays correctly when enabled/disabled
- Check console logs for SmartLead API responses to confirm data structure
- Test with multiple accounts at different warmup stages (Day 1, Day 15, Day 30)

---

## Priority Assessment

| Issue | Severity | User Visibility | Fix Complexity |
|-------|----------|----------------|----------------|
| #1 - Warmup Status | **High** | High - Main dashboard display | Low - One-line addition |
| #2 - Bounce Calculation | **High** | High - Core deliverability metric | Low - Change formula |
| #3 - DB Sync | **Medium** | Low - Metrics fetched fresh anyway | Medium - Architecture decision |

**Recommended Fix Order**: #1 → #2 → #3

Issue #3 may not need fixing if we decide to rely entirely on fresh API data. The main downside is inability to query warmup status without hitting SmartLead API.
