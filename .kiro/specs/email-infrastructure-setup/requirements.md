# Email Infrastructure Setup Tool Requirements

## 1. Introduction

This document specifies the requirements for the Email Infrastructure Setup Tool, a comprehensive automation system that streamlines the process of setting up professional email infrastructure for cold email campaigns. The tool handles domain connection (or optional purchase), DNS authentication configuration (SPF, DKIM, DMARC, MX records), email account creation via Google Workspace, and integration with Smartlead for cold email campaigns.

**Architecture Overview**: Next.js 15 App Router with server-side domain management, automated DNS configuration via Cloudflare API, Google Workspace Admin SDK integration for email account provisioning, real-time DNS propagation monitoring, and Smartlead API integration for seamless email campaign setup.

## 2. User Stories

### Cold Email Marketers
- **As a cold email marketer**, I want to connect my purchased domains quickly, so that I can start sending campaigns without manual DNS configuration
- **As a cold email professional**, I want automated SPF/DKIM/DMARC setup, so that I achieve maximum email deliverability from day one
- **As a campaign manager**, I want to create multiple Google Workspace email accounts at once, so that I can scale my sending infrastructure efficiently
- **As a cold email sender**, I want to automatically connect email accounts to Smartlead, so that I can start campaigns immediately after setup

### Agencies and Teams
- **As a digital agency**, I want to manage multiple client domains simultaneously, so that I can onboard clients faster
- **As a team lead**, I want to see real-time DNS propagation status, so that I know exactly when infrastructure is ready for campaigns
- **As an agency owner**, I want optional domain purchasing through the platform, so that clients can get everything in one place
- **As a technical manager**, I want to verify email authentication before going live, so that I prevent deliverability issues

### Business Owners
- **As a business owner**, I want a simple domain connection process, so that I can set up cold email infrastructure without technical knowledge
- **As an entrepreneur**, I want to purchase domains directly in the platform, so that I don't need to manage multiple services
- **As a startup founder**, I want automated compliance with Gmail/Yahoo/Outlook requirements, so that my emails reach inboxes in 2025
- **As a sales leader**, I want batch domain setup capabilities, so that I can quickly scale outbound operations

## 3. Acceptance Criteria

### Domain Management Requirements
- **WHEN** a user wants to connect an external domain, **THEN** the system **SHALL** provide step-by-step instructions for updating nameservers to Cloudflare
- **WHEN** a user chooses to purchase a domain, **THEN** the system **SHALL** integrate with GoDaddy API to check availability and complete purchase
- **WHEN** domain nameservers are updated, **THEN** the system **SHALL** automatically detect and verify Cloudflare nameserver propagation within 5 minutes
- **IF** a domain is already using Cloudflare, **THEN** the system **SHALL** detect this and skip nameserver migration steps
- **WHEN** multiple domains are added, **THEN** the system **SHALL** support batch operations for up to 50 domains simultaneously

### DNS Automation Requirements
- **WHEN** a domain is connected, **THEN** the system **SHALL** automatically configure SPF, DKIM, DMARC, and MX records via Cloudflare API within 30 seconds
- **WHEN** SPF records are created, **THEN** the system **SHALL** implement SPF flattening to avoid the 10 DNS lookup limit
- **WHEN** DKIM records are generated, **THEN** the system **SHALL** create 2048-bit keys and configure DNS TXT records for Google Workspace
- **WHEN** DMARC policies are set, **THEN** the system **SHALL** start with "none" policy and provide UI for gradual progression to "quarantine" or "reject"
- **WHEN** MX records are configured, **THEN** the system **SHALL** set up Google Workspace mail servers with correct priority values
- **IF** SPF record exceeds DNS lookup limits, **THEN** the system **SHALL** automatically flatten the record using IP address resolution

### DNS Status Monitoring Requirements
- **WHEN** DNS records are created, **THEN** the system **SHALL** poll DNS servers every 30 seconds to check propagation status
- **WHEN** DNS propagation completes, **THEN** the system **SHALL** display success confirmation with visual indicators for each record type
- **WHEN** DNS propagation is incomplete, **THEN** the system **SHALL** show real-time progress with estimated completion time
- **IF** DNS records fail validation, **THEN** the system **SHALL** provide detailed error messages and fix recommendations
- **WHEN** all DNS records are verified, **THEN** the system **SHALL** run authentication tests (SPF/DKIM/DMARC) and display pass/fail results

### Google Workspace Integration Requirements
- **WHEN** DNS is fully configured, **THEN** the system **SHALL** enable email account creation via Google Workspace Admin SDK
- **WHEN** users request email account creation, **THEN** the system **SHALL** support batch creation of up to 20 accounts per domain
- **WHEN** email accounts are created, **THEN** the system **SHALL** generate secure random passwords and store them encrypted
- **WHEN** Google Workspace accounts are provisioned, **THEN** the system **SHALL** automatically configure IMAP/SMTP settings for Smartlead integration
- **IF** Google Workspace API authentication fails, **THEN** the system **SHALL** provide clear instructions for service account setup and domain-wide delegation

### Smartlead Integration Requirements
- **WHEN** email accounts are created, **THEN** the system **SHALL** automatically add them to Smartlead via API with SMTP/IMAP credentials
- **WHEN** Smartlead connection is established, **THEN** the system **SHALL** configure custom tracking domains using CNAME records
- **WHEN** accounts are added to Smartlead, **THEN** the system **SHALL** enable warmup settings and set daily sending limits
- **IF** Smartlead API connection fails, **THEN** the system **SHALL** provide manual export of email credentials in CSV format
- **WHEN** custom tracking domain is set up, **THEN** the system **SHALL** create CNAME records pointing to Smartlead's tracking infrastructure

### Compliance and Validation Requirements
- **WHEN** DNS records are configured, **THEN** the system **SHALL** validate compliance with Gmail, Yahoo, and Outlook 2025 sender requirements
- **WHEN** SPF/DKIM/DMARC are set up, **THEN** the system **SHALL** test authentication by sending test emails and checking headers
- **WHEN** compliance check fails, **THEN** the system **SHALL** identify specific issues and provide step-by-step remediation guidance
- **IF** domain has existing DNS records, **THEN** the system **SHALL** detect conflicts and recommend safe migration strategies

### User Experience Requirements
- **WHEN** users access the setup wizard, **THEN** the system **SHALL** provide a guided step-by-step interface with progress indicators
- **WHEN** DNS propagation is in progress, **THEN** the system **SHALL** display real-time status updates without requiring page refresh
- **WHEN** errors occur, **THEN** the system **SHALL** provide contextual help and links to documentation
- **IF** users need help, **THEN** the system **SHALL** offer tooltips explaining SPF, DKIM, DMARC, and MX records in simple terms

### Performance Requirements
- **WHEN** domain connection is initiated, **THEN** the system **SHALL** complete DNS record creation within 30 seconds
- **WHEN** DNS status is checked, **THEN** the system **SHALL** return propagation status within 2 seconds
- **WHEN** batch operations are performed, **THEN** the system **SHALL** process domains in parallel with maximum 10 concurrent operations
- **WHEN** Google Workspace accounts are created, **THEN** the system **SHALL** provision each account within 5 seconds

### Security Requirements
- **WHEN** Google Workspace credentials are generated, **THEN** the system **SHALL** encrypt passwords using AES-256 before database storage
- **WHEN** API keys are configured, **THEN** the system **SHALL** store Cloudflare, GoDaddy, Google, and Smartlead API keys in secure environment variables
- **WHEN** users access email credentials, **THEN** the system **SHALL** require authentication and log all credential access attempts
- **IF** suspicious activity is detected, **THEN** the system **SHALL** temporarily lock account creation and notify administrators

## 4. Technical Architecture

### Frontend Architecture
- **Framework**: Next.js 15 App Router with React 19 for server-side rendering and progressive enhancement
- **State Management**: TanStack Query for real-time DNS status polling, email account creation, and API state management
- **UI Components**: shadcn/ui with custom wizard components, progress indicators, and DNS status dashboards
- **Styling**: Tailwind CSS with dark theme design system and responsive mobile-first layout

### Backend Architecture
- **Server**: Next.js 15 Server Actions for domain management, DNS automation, and email provisioning workflows
- **Database**: Neon PostgreSQL with schemas for domains, DNS records, email accounts, and setup status tracking
- **DNS Management**: Cloudflare API for automated DNS record creation, SPF flattening, and propagation monitoring
- **Email Provisioning**: Google Workspace Admin SDK Directory API for user creation and SMTP/IMAP configuration
- **Domain Purchase**: GoDaddy Domains API (optional) for domain availability search and registration

### Key Libraries & Dependencies
- **DNS & Domain APIs**: Cloudflare API client, GoDaddy SDK, DNS propagation checker, SPF record parser and flattener
- **Email Integration**: Google Workspace Admin SDK, Smartlead API client, SMTP/IMAP configuration validator
- **Authentication**: Google OAuth 2.0 service accounts with domain-wide delegation for Google Workspace access
- **Database**: Drizzle ORM with domain management schemas, encrypted credential storage, audit logging
- **Background Jobs**: Queue system for DNS propagation polling, batch domain processing, and async email account creation

## 5. Feature Specifications

### Core Features
1. **Domain Connection Wizard**: Step-by-step guided interface for connecting externally purchased domains with nameserver migration instructions
2. **Optional Domain Purchase**: GoDaddy API integration for domain availability search, pricing, and automated registration
3. **Automated DNS Configuration**: One-click SPF, DKIM, DMARC, and MX record setup via Cloudflare API with intelligent SPF flattening
4. **Real-Time DNS Monitoring**: Live DNS propagation status dashboard with 30-second polling and visual progress indicators
5. **Google Workspace Email Provisioning**: Batch email account creation with Admin SDK, secure credential generation, and SMTP/IMAP setup
6. **Smartlead Integration**: Automated email account connection to Smartlead with custom tracking domain CNAME configuration

### Advanced Features
1. **SPF Record Flattening**: Automatic IP address resolution to avoid 10 DNS lookup limit and prevent SPF failures
2. **DMARC Policy Management**: Progressive enforcement workflow from "none" → "quarantine" → "reject" with reporting setup
3. **Custom Tracking Domains**: CNAME record automation for Smartlead tracking to improve deliverability and branding
4. **Email Authentication Testing**: Send test emails and verify SPF/DKIM/DMARC pass status before launching campaigns
5. **Compliance Validation**: Automated checks for Gmail/Yahoo/Outlook 2025 sender requirements with detailed compliance reports
6. **Batch Domain Operations**: Parallel processing of multiple domains for agencies and teams scaling cold email infrastructure

### Platform-Specific Features
1. **Desktop**: Full-featured setup wizard with detailed DNS status monitoring, batch operations dashboard, and comprehensive compliance reports
2. **Mobile**: Responsive wizard interface with simplified DNS status view, quick domain connection, and mobile-optimized progress tracking
3. **API**: RESTful endpoints for domain connection, DNS automation, email provisioning, and webhook notifications for setup completion

## 6. Success Criteria

### User Experience
- **WHEN** users complete domain setup, **THEN** users **SHALL** achieve successful email authentication (SPF/DKIM/DMARC pass) in >95% of cases
- **WHEN** DNS configuration is automated, **THEN** users **SHALL** save 45+ minutes per domain compared to manual setup
- **WHEN** email accounts are created, **THEN** users **SHALL** successfully connect to Smartlead in >98% of cases without manual intervention

### Technical Performance
- **WHEN** DNS records are created via Cloudflare API, **THEN** the system **SHALL** achieve 100% record creation success rate
- **WHEN** DNS propagation monitoring runs, **THEN** the system **SHALL** detect full propagation within 5 minutes for >90% of domains
- **WHEN** batch operations process 50 domains, **THEN** the system **SHALL** complete all setups within 15 minutes

### Business Goals
- **WHEN** users set up email infrastructure, **THEN** users **SHALL** achieve >95% inbox placement rates in Smartlead warmup phase
- **WHEN** agencies onboard clients, **THEN** agencies **SHALL** reduce setup time by 80% compared to manual configuration
- **WHEN** compliance validation runs, **THEN** users **SHALL** meet 100% of Gmail/Yahoo/Outlook 2025 sender requirements before going live

## 7. Assumptions and Dependencies

### Technical Assumptions
- Users have access to domain registrar accounts to update nameservers (for external domain connection)
- Users have active Google Workspace accounts with admin privileges for email account creation
- Cloudflare API provides reliable DNS management and propagation is detectable within reasonable timeframes
- Smartlead API remains stable and supports email account integration via documented endpoints

### External Dependencies
- **Cloudflare API**: DNS record management, SPF flattening capabilities, and propagation status checking
- **Google Workspace Admin SDK**: Directory API for user creation, SMTP/IMAP configuration, and domain verification
- **Smartlead API**: Email account connection, custom tracking domain setup, and warmup configuration
- **GoDaddy API** (optional): Domain availability search, pricing information, and automated domain registration
- **DNS Propagation Services**: Third-party DNS checkers for global propagation verification

### Resource Assumptions
- Development team has experience with DNS management, email authentication protocols, and API integrations
- Implementation timeline of 4-6 weeks for full email infrastructure setup automation system
- Access to Google Cloud Platform for service account creation and API credentials management
- Budget for Cloudflare, GoDaddy, Google Workspace, and Smartlead API usage costs

## 8. Constraints and Limitations

### Technical Constraints
- DNS propagation timing is beyond system control (typically 5 minutes to 48 hours globally)
- Google Workspace Admin SDK requires domain ownership verification before email account creation
- SPF record character length limits (512 characters) may affect domains with many sending services
- Cloudflare API rate limits may affect batch operations processing speed (1200 requests per 5 minutes)

### Business Constraints
- GoDaddy API domain purchase requires Good as Gold account and pre-funded balance
- Domain purchase feature limited by GoDaddy's API restrictions on reseller activities
- Google Workspace requires active paid subscription for each domain before email account creation
- Smartlead API access requires active Smartlead subscription with API permissions enabled

### Regulatory Constraints
- GDPR compliance for storing email credentials and user information in encrypted format
- Email authentication requirements evolving (Gmail/Yahoo/Outlook 2025 policies must be monitored)
- Domain registrar policies regarding automated purchasing and nameserver modifications
- Google Workspace Terms of Service compliance for automated user provisioning

## 9. Risk Assessment

### Technical Risks
- **Risk**: DNS propagation delays preventing timely campaign launches
  - **Likelihood**: Medium
  - **Impact**: Medium
  - **Mitigation**: Implement aggressive polling every 30 seconds, provide estimated completion times, offer manual override for advanced users

- **Risk**: Google Workspace API authentication failures blocking email account creation
  - **Likelihood**: Medium
  - **Impact**: High
  - **Mitigation**: Comprehensive setup documentation, service account troubleshooting wizard, fallback manual credential entry

- **Risk**: SPF flattening breaking existing DNS configurations for domains with complex setups
  - **Likelihood**: Low
  - **Impact**: High
  - **Mitigation**: Backup existing DNS records before changes, provide rollback functionality, validate SPF syntax before publishing

### Business Risks
- **Risk**: GoDaddy API access restrictions limiting domain purchase feature availability
  - **Likelihood**: Medium
  - **Impact**: Medium
  - **Mitigation**: Focus on domain connection as primary feature, clearly communicate GoDaddy API limitations, offer alternative registrar guides

- **Risk**: Smartlead API changes breaking email account integration workflow
  - **Likelihood**: Low
  - **Impact**: High
  - **Mitigation**: Version API calls, implement graceful degradation, provide manual CSV export fallback, monitor Smartlead API changelog

### User Experience Risks
- **Risk**: Complex setup process overwhelming non-technical users despite automation
  - **Likelihood**: Medium
  - **Impact**: Medium
  - **Mitigation**: Multi-step wizard with progress saving, contextual help tooltips, video tutorials, live chat support integration

## 10. Non-Functional Requirements

### Scalability
- Support for 1000+ domains per user account with efficient database indexing and query optimization
- Concurrent DNS propagation monitoring for up to 100 domains with worker queue architecture
- Batch email account creation handling 500+ accounts per hour with rate limit management

### Availability
- 99.5% uptime for DNS automation services with graceful handling of third-party API outages
- Robust error handling for Cloudflare, Google, GoDaddy, and Smartlead API failures
- Background job retry logic with exponential backoff for DNS propagation checks and account creation

### Maintainability
- Modular API integration architecture with swappable providers (e.g., alternative to Cloudflare)
- Comprehensive logging for DNS operations, email provisioning, and API interactions
- Extensive test coverage for DNS record generation, SPF flattening, and authentication validation

### Usability
- Intuitive wizard interface requiring zero DNS or email authentication knowledge from users
- Visual DNS status indicators with color-coded propagation progress and clear next steps
- Mobile-responsive design supporting domain setup and monitoring from any device

## 11. Future Considerations

### Phase 2 Features
- **Multi-DNS Provider Support**: Add Route53, DigitalOcean DNS alongside Cloudflare for flexibility
- **Microsoft 365 Integration**: Email account creation for users preferring Microsoft over Google Workspace
- **Domain Health Monitoring**: Ongoing SPF/DKIM/DMARC monitoring with alerts for configuration drift
- **Deliverability Analytics**: Integration with email reputation services to track domain sender scores
- **AI-Powered DNS Optimization**: Machine learning recommendations for optimal DNS configuration based on campaign performance

### Integration Opportunities
- **Domain Reputation APIs**: Integration with Sender Score, Google Postmaster Tools for deliverability insights
- **Alternative Email Providers**: Support for Zoho Mail, ProtonMail, custom SMTP servers beyond Google Workspace
- **CRM Integrations**: Sync domain and email account data with HubSpot, Salesforce for unified campaign management
- **Slack/Discord Notifications**: Real-time alerts for DNS propagation completion and setup milestones
- **Zapier/Make.com**: No-code automation workflows for advanced users to trigger setup processes

### Technical Debt
- Implement caching layer for DNS propagation status to reduce API calls and improve performance
- Refactor SPF flattening algorithm to support more complex DNS configurations and edge cases
- Add comprehensive error recovery for partial setup failures (e.g., DNS succeeds but email creation fails)
- Build admin dashboard for monitoring API usage, costs, and system-wide setup success rates

---

**Document Status**: Draft

**Last Updated**: 2025-09-30

**Stakeholders**: Product Owner, Development Team, DevOps Team, Cold Email Specialists, Digital Agencies

**Related Documents**: Domain Management System Requirements, User Authentication Requirements, Email Account Pool Management

**Version**: 1.0
