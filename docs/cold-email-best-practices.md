# Cold Email Infrastructure Best Practices

This document outlines industry-standard best practices for cold email infrastructure, email account naming, and deliverability optimization. These practices align with our email account provisioning system.

---

## Table of Contents
1. [Domain Strategy](#domain-strategy)
2. [Email Account Setup](#email-account-setup)
3. [Email Account Naming Conventions](#email-account-naming-conventions)
4. [Volume & Sending Limits](#volume--sending-limits)
5. [Warmup Strategy](#warmup-strategy)
6. [Performance Monitoring](#performance-monitoring)

---

## Domain Strategy

### Primary Domain Protection
**Never send cold emails from your primary domain.** Use dedicated secondary domains for cold outreach to protect your main domain's reputation.

### Secondary Domain Setup
- **TLD:** Always use `.com` for secondary domains (most trusted by email providers)
- **Naming:** Domains should be closely related to your main domain (e.g., if main is `company.com`, use `trycompany.com`, `getcompany.com`, `hellocompany.com`)
- **Avoid symbols:** Domain names with symbols (hyphens, numbers) appear spammy
- **Forwarding:** Forward secondary domains to your primary domain so prospects land on your main website
- **DNS Authentication:** Configure SPF, DKIM, and DMARC for all secondary domains (non-negotiable in 2025)

### Example Domain Variations
```
Main domain: acmecorp.com

Secondary domains:
✅ tryacmecorp.com
✅ getacmecorp.com
✅ helloacmecorp.com
✅ acmecorpmail.com

❌ acme-corp.com (hyphen)
❌ acmecorp2024.com (number)
❌ acmecorp.info (wrong TLD)
```

---

## Email Account Setup

### Accounts Per Domain
**Industry Standard:** 3-5 email accounts per domain
- **Conservative (safest):** 1 account per domain
- **Standard:** 3 accounts per domain
- **Maximum:** 5 accounts per domain

**Why minimize accounts per domain?**
- Reduces spam risk
- Prevents spam contamination (one bad account affects others on same domain)
- Maintains deliverability
- Easier to track and manage

### Our System Recommendation
Based on batch creation capabilities and industry standards:
- **Default batch size:** 3-5 accounts per domain
- **Maximum batch size:** 5 accounts per domain (enforced in UI)
- **Multiple domains:** Use domain rotation for higher volume (10 domains × 3 accounts = 30 total accounts)

---

## Email Account Naming Conventions

### Individual + Company Format (Recommended for Sales)
Best for B2B cold email because it builds personal relationships.

**Format:** `firstname` or `firstname.lastname`

**Examples:**
```
john@tryacmecorp.com
sarah@tryacmecorp.com
alex.chen@tryacmecorp.com
maria.garcia@tryacmecorp.com
```

**Display Name Format:**
- `"John from Acme"` or `"John at Acme"`
- `"Sarah | Acme Corp"`
- `"Alex Chen - Acme Sales"`

### Generic Team Names (Use Sparingly)
Acceptable for support/marketing emails but less personal for cold outreach.

**Examples:**
```
sales@tryacmecorp.com
outreach@tryacmecorp.com
team@tryacmecorp.com
hello@tryacmecorp.com
```

### Naming Anti-Patterns (Avoid)
```
❌ noreply@domain.com (spam filter magnet)
❌ donotreply@domain.com (hostile and spammy)
❌ info@domain.com (generic, low open rates)
❌ sender1@domain.com (robotic, suspicious)
❌ coldemail@domain.com (obvious automation)
```

### Batch Naming Strategies

When creating multiple accounts, use human-like naming:

**Option 1: Team Member Names**
```
john@domain.com       → "John Smith from Acme"
sarah@domain.com      → "Sarah Jones from Acme"
alex@domain.com       → "Alex Chen from Acme"
maria@domain.com      → "Maria Garcia from Acme"
david@domain.com      → "David Kim from Acme"
```

**Option 2: First Name + Department**
```
john.sales@domain.com    → "John | Acme Sales"
sarah.outreach@domain.com → "Sarah | Acme Outreach"
alex.growth@domain.com    → "Alex | Acme Growth"
```

**Option 3: Role + First Name**
```
sales.john@domain.com     → "John from Acme Sales"
outreach.sarah@domain.com → "Sarah from Acme Outreach"
growth.alex@domain.com    → "Alex from Acme Growth"
```

### Character Limit Considerations
Most email clients display only **30 characters** of the sender name on mobile/desktop. Keep display names concise.

**Examples:**
```
✅ "John at Acme" (12 chars)
✅ "Sarah | Acme Corp" (17 chars)
✅ "Alex - Acme Sales" (17 chars)
❌ "John Smith from Acme Corporation Sales Team" (47 chars - truncated)
```

---

## Volume & Sending Limits

### Daily Sending Limits Per Account
- **Industry Recommendation:** 50 emails/account/day
- **Conservative Start:** 25 emails/account/day
- **Maximum Safe:** 100 emails/account/day (only after warmup)

### Gradual Volume Increase
Do not start at max volume. Gradually increase over 1-2 weeks:

**Warmup Schedule Example:**
```
Week 1:
  Day 1-3:  10 emails/day
  Day 4-7:  20 emails/day

Week 2:
  Day 8-10:  30 emails/day
  Day 11-14: 50 emails/day

Week 3+:
  Maintain 50 emails/day or increase to 75-100 if metrics are good
```

### Inbox Rotation Strategy
**Use multiple mailboxes per campaign** to distribute sending load horizontally.

**Example:**
- Campaign needs to send 300 emails/day
- Use 6 accounts × 50 emails/day = 300 total
- Rotate sending across accounts (don't send all from one account)

---

## Warmup Strategy

### Why Warmup Matters
New email accounts have zero sender reputation. ESPs (Email Service Providers) flag sudden high-volume sending as spam.

### Warmup Timeline
**Minimum:** 2 weeks
**Recommended:** 3-4 weeks
**Best:** 6 weeks (for critical campaigns)

### Warmup Activities
1. **Gradual volume increase** (see schedule above)
2. **Send to engaged users first** (internal team, warm leads)
3. **Maintain consistent sending patterns** (same time of day, same days of week)
4. **Use humanized sending intervals** (don't send all 50 emails in 5 minutes)
5. **Generate positive engagement** (replies, opens, clicks)

### Warmup Tools
- **Smartlead Warmup:** Automated warmup with real interactions
- **Manual Warmup:** Send to team members and ask for replies
- **Hybrid Approach:** Combine automated warmup with manual sends to warm leads

### Our System Integration
The email account creation system tracks:
- `warmupStatus`: 'not_started', 'in_progress', 'completed', 'paused'
- `warmupDayCount`: Days into warmup process
- `dailyEmailLimit`: Current daily sending limit (increases over time)
- `dailyEmailsSent`: Emails sent today (enforces limit)

---

## Performance Monitoring

### Key Metrics to Track

| Metric           | Healthy Range | Warning Zone | Critical   |
|------------------|---------------|--------------|------------|
| Open Rate        | > 20%         | 10-20%       | < 10%      |
| Click Rate       | 2-5%          | 1-2%         | < 1%       |
| Reply Rate       | > 10%         | 5-10%        | < 5%       |
| Bounce Rate      | < 2%          | 2-5%         | > 5%       |
| Spam Complaint   | < 0.1%        | 0.1-0.5%     | > 0.5%     |

### Action Items by Metric

**If Bounce Rate > 5%:**
- Verify email list quality
- Remove invalid emails
- Check DNS configuration (SPF, DKIM, DMARC)
- Pause account and investigate

**If Spam Complaint > 0.5%:**
- Review email content for spam triggers
- Check unsubscribe link is visible
- Verify sending to opted-in contacts only
- Pause account immediately

**If Open Rate < 10%:**
- Review subject lines
- Check sender name/email format
- Verify domain reputation
- Slow down sending volume

**If Reply Rate < 5%:**
- Review email copy and CTA
- Improve personalization
- Check targeting (ICP match)
- Test different messaging angles

### Remove Low-Performing Accounts
**After launching a campaign**, identify and remove consistently low-performing email accounts. Signs:
- Bounce rate > 5% for 3+ days
- Open rate < 10% for 1 week
- Multiple spam complaints
- Blacklisted by email providers

### Domain Blacklist Monitoring
**Check domains regularly** using:
- MXToolbox (mxtoolbox.com/blacklists.aspx)
- MultiRBL (multirbl.valli.org)
- Talos Intelligence (talosintelligence.com)

**If blacklisted:**
1. Stop all sending from that domain immediately
2. Investigate root cause (content, volume, engagement)
3. Request delisting (if possible)
4. Consider retiring the domain if delisting fails

---

## Do Not Contact (DNC) List Management

### Why DNC Lists Matter
**Maintain a DNC list** for better email sender reputation. Exclude:
- Users who have unsubscribed
- Contacts who marked email as spam
- Bounced email addresses
- Previous leads who declined

### Our System Implementation
Track DNC status in:
- `emailActivityLog`: Records spam reports, unsubscribes, bounces
- Campaign-level exclusions: Don't send to previously contacted leads who didn't respond
- Domain-level exclusions: Block entire domains if requested

---

## Best Practices Checklist

### Before Sending Cold Emails
- [ ] Secondary domains purchased and configured (not primary domain)
- [ ] DNS authentication configured (SPF, DKIM, DMARC)
- [ ] 3-5 email accounts created per domain
- [ ] Email accounts use human-like names (not "sender1", "noreply")
- [ ] Display names are concise (<30 characters)
- [ ] Warmup plan scheduled (2-4 weeks minimum)
- [ ] Daily sending limits configured (start at 10-25/day)
- [ ] Monitoring dashboard set up for key metrics
- [ ] DNC list initialized and integrated

### During Campaigns
- [ ] Sending volume increased gradually (not sudden jumps)
- [ ] Inbox rotation enabled (multiple accounts per campaign)
- [ ] Metrics monitored daily (open, click, bounce, spam)
- [ ] Low-performing accounts identified and paused
- [ ] Blacklist monitoring running weekly
- [ ] DNC list updated with unsubscribes/spam reports
- [ ] Engagement patterns humanized (time spacing, send times)

### After Issues Detected
- [ ] Pause sending from affected accounts immediately
- [ ] Investigate root cause (content, volume, list quality)
- [ ] Check blacklist status for all domains
- [ ] Review recent campaign content for spam triggers
- [ ] Verify DNS configuration is correct
- [ ] Consider retiring account/domain if reputation damaged
- [ ] Document learnings to prevent future issues

---

## Integration with MailEye System

### Email Account Creation Modal
When creating email accounts in MailEye, follow these conventions:

**Single Account:**
- Use real first names: `john`, `sarah`, `alex`
- Display name format: `"John from [YourCompany]"`

**Batch Creation (3-5 accounts):**
- **Option 1:** Provide custom names for each account
- **Option 2:** Use name suggestion generator (implements best practices)
- **Validation:** System prevents spam-trigger names (noreply, sender1, etc.)

**System enforces:**
- Max 5 accounts per batch (aligns with 3-5 per domain guideline)
- Human-like naming patterns required
- Display name character limit (30 chars)
- Unique username validation

### Database Tracking
MailEye tracks warmup and performance metrics per account:
- **Warmup tracking:** Progressive daily limit increases
- **Health metrics:** Deliverability score, bounce rate, spam complaint rate
- **Activity log:** All sending activity recorded for analysis
- **Reputation score:** Overall account health (excellent, good, fair, poor)

---

## Resources & Further Reading

### Industry Guidelines
- [Smartlead: Cold Email Best Practices](https://www.smartlead.ai/blog/cold-email-best-practices)
- [Instantly: Cold Email Strategy](https://help.instantly.ai/en/articles/5975326-instantly-cold-email-strategy)
- [MailReach: Cold Email Deliverability Guide](https://www.mailreach.co/blog/cold-email-deliverability-sending-strategy)

### Email Authentication
- [SPF Record Syntax](https://tools.ietf.org/html/rfc7208)
- [DKIM Implementation](https://tools.ietf.org/html/rfc6376)
- [DMARC Policy Guide](https://dmarc.org/overview/)

### Monitoring Tools
- [MXToolbox](https://mxtoolbox.com/) - DNS and blacklist checking
- [Mail-Tester](https://www.mail-tester.com/) - Email spam score testing
- [Google Postmaster Tools](https://postmaster.google.com/) - Gmail deliverability monitoring

---

## Version History

- **v1.0** (2025-01-16): Initial documentation based on 2025 industry standards
