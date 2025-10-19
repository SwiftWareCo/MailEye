### Application Routes

#### Current Route Structure:
```
app/
├── (auth)/              # Authentication pages (sign-in, sign-up, password reset)
├── (dashboard)/         # Protected dashboard routes
│   ├── /dashboard       # Main dashboard
│   ├── /domains         # Domains management and overview
│   ├── /domains/[domainId] # Domain detail view with tabbed interface
│   ├── /setup           # New domain setup wizard (full-page, steps 1-10)
│   └── /settings        # User settings
├── /onboarding          # Initial user onboarding
└── /                    # Landing/home page
```

**Key Routes:**
- **`/domains`** - Domains dashboard (view all domains, manage existing)
- **`/domains/[domainId]`** - Domain detail view with tabbed interface (Overview, DNS, Email Accounts, Warmup)
- **`/setup`** - Setup wizard for adding new domain (steps 1-10)

### Project Architecture Guidelines

#### Next.js 15 App Router Best Practices:
1. **Prefer Server Components over API Routes**: Use Server Components for internal data fetching and mutations within the application
2. **API Routes ONLY for external communication**: Reserve API routes (`route.tsx`) for when other applications need to communicate with this app
3. **No API routes for internal operations**: Use Server Actions and Server Components instead of creating internal API routes

#### Data Architecture Pattern:
- **Data Layer**: Create `*.data.ts` files in `server/` folder for data fetching (using Server Components)
- **Action Layer**: Create `*.actions.ts` files for mutations (using Server Actions)
- **Separation of Concerns**: Keep data fetching and mutations in separate files

#### State Management:
- **TanStack Query (React Query)**: Use for both client-side data fetching and mutations
- **Industry Standard**: TanStack Query provides loading states, caching, and optimistic updates
- **Server Components + TanStack Query**: Prefetch on server, hydrate on client for optimal performance

#### Project Structure:
```
app/
├── (auth)/ # Authentication pages
├── (dashboard)/ # Dashboard pages
├── components/ # Shared UI components (organized by feature)
│   ├── auth/
│   │   ├── Signout.tsx
│   │   └── AuthProvider.tsx
│   ├── settings/
│   │   ├── SettingsForm.tsx
│   │   └── SecurityActions.tsx
│   ├── dashboard/
│   │   ├── MetricsCard.tsx
│   │   └── ActivityFeed.tsx
│   └── ui/ # Basic UI primitives
├── handler/ # Stack Auth handlers
├── layout.tsx # Root layout
├── page.tsx # Home page
server/ # Data and action layers
├── auth/
│   ├── auth.data.ts
│   └── auth.actions.ts
├── dashboard/
│   ├── dashboard.data.ts
│   └── dashboard.actions.ts
lib/ # Utilities and database
├── db/
│   ├── schema.ts
│   └── index.ts
├── utils.ts
stack/ # Stack Auth configuration
├── client.tsx
└── server.tsx
```

#### Key Principles:
- **Feature-based organization**: Group by functionality, not by technical type
- **Client/Server Component clarity**: Explicitly choose based on needs
- **TypeScript everywhere**: Full type safety across data and action layers
- **Performance first**: Server Components for initial renders, TanStack Query for client interactions

#### TypeScript Types Organization (`lib/types/`)
Types should be organized by domain/feature for maintainability:

**File Structure:**
```
lib/types/
├── audit.ts          # Core audit interfaces and types
├── seo.ts            # SEO analysis types and rule definitions
├── performance.ts    # Performance metrics and analysis types
├── crawl.ts          # Web crawling and browser automation types
└── api.ts            # External API response and request types
```

**How to Reference Types:**
- **Domain-specific imports**: `import { AuditSession, AuditResult } from '@/lib/types/audit'`
- **Cross-domain types**: Use shared types from `lib/types/` for consistency
- **Component props**: Co-locate component-specific types with components when they're not reused

**Examples:**
```typescript
// Importing audit types
import { AuditSession, AuditResult, AuditProgress } from '@/lib/types/audit';

// Importing SEO rule types
import { SEORule, SEOIssue, IssueCategory } from '@/lib/types/seo';

// Using types in functions
export async function startAudit(config: AuditConfiguration): Promise<AuditSession> {
  // Implementation
}
```

#### Best Practices for Types:

1. **Type everything**: All functions, parameters, and return values should be typed
2. **Share types across layers**: Use the same types in server actions, components, and database layers
3. **Use Crawlee's built-in error handling**: Leverage Crawlee's logging and session management for errors
4. **Standard Error objects**: Use JavaScript's native Error class for custom error handling

#### Component Placement Rules:
1. **All reusable components go in `components/`**: Never create components directly in page directories
2. **Organize by feature**: Group related components in feature-specific folders (`auth/`, `settings/`, `dashboard/`)
3. **Client vs Server separation**:
   - Use `'use client'` directive for components with interactivity (onClick, useState, etc.)
   - Keep Server Components as default for data fetching and static content
   - Extract client-side functionality into separate components when needed

#### Component Structure:
```
components/
├── auth/           # Authentication-related components
├── settings/       # Settings and user preferences
├── dashboard/      # Dashboard-specific components
├── campaigns/      # Campaign management components
├── ui/            # Basic UI primitives (buttons, inputs, cards)
└── layout/        # Layout and navigation components
```

#### Client/Server Component Guidelines:
- **Server Component**: Default for pages and data-heavy components
- **Client Component**: Required for:
  - Event handlers (onClick, onSubmit, etc.)
  - State management (useState, useEffect)
  - Form handling with client-side validation
  - Interactive UI elements
- **Mixed Approach**: Pass server data to client components as props
- **Server-Only Functions**: Never call `server/` functions directly from client components - fetch data in parent server component and pass as props

#### Import/Export Patterns:
- Use absolute imports: `@/components/settings/SettingsForm`
- Export components as default exports
- Co-locate types and interfaces with components when component-specific

#### shadcn/ui Integration:
- **UI Library**: Project uses shadcn/ui with "new-york" style variant
- **Component Location**: All shadcn components are installed in `/components/ui/`
- **Installation**: Use `npx shadcn@latest add [component-name]` to add new components
- **Customization**: Components use CSS variables for theming and can be customized via `app/globals.css`
- **Icons**: Lucide React is the icon library (`import { IconName } from "lucide-react"`)
- **Aliases**: Components use `@/components/ui/[component]` import paths

#### Theme & Styling:
- **Dark Theme Primary**: Application uses a dark theme as the primary design approach
- **Color Palette**: Focus on dark backgrounds with accent colors for contrast and visual hierarchy
- **Stack Auth Integration**: Custom styling applied to Stack Auth components to match dark theme
- **Tailwind CSS**: Utilize dark mode variants and custom dark color schemes
- **shadcn Components**: Always prefer shadcn/ui components over custom implementations for consistency

#### Exact Color Scheme:
```javascript
theme = {
  dark: {
    background: 'hsl(222.2, 84%, 4.9%)',        // Deep dark blue
    foreground: 'hsl(210, 40%, 98%)',           // Near white text
    card: 'hsl(222.2, 84%, 4.9%)',             // Same as background
    cardForeground: 'hsl(210, 40%, 98%)',       // Near white on cards
    popover: 'hsl(222.2, 84%, 4.9%)',          // Same as background
    popoverForeground: 'hsl(210, 40%, 98%)',    // Near white on popovers
    primary: 'hsl(217.2, 91.2%, 59.8%)',       // Bright blue (#3b82f6)
    primaryForeground: 'hsl(222.2, 84%, 4.9%)', // Dark on primary
    secondary: 'hsl(217.2, 32.6%, 17.5%)',     // Dark gray-blue
    secondaryForeground: 'hsl(210, 40%, 98%)',  // Light on secondary
    muted: 'hsl(217.2, 32.6%, 17.5%)',         // Same as secondary
    mutedForeground: 'hsl(215, 20.2%, 65.1%)', // Medium gray
    accent: 'hsl(217.2, 32.6%, 17.5%)',        // Same as secondary
    accentForeground: 'hsl(210, 40%, 98%)',     // Light on accent
    destructive: 'hsl(0, 62.8%, 30.6%)',       // Dark red
    destructiveForeground: 'hsl(210, 40%, 98%)', // Light on destructive
    border: 'hsl(217.2, 32.6%, 17.5%)',        // Dark gray-blue borders
    input: 'hsl(217.2, 32.6%, 17.5%)',         // Same as border
    ring: 'hsl(224.3, 76.3%, 94.1%)',          // Light focus ring
  },
  radius: '8px'
}
```

### Authentication System

#### Stack Auth + Neon Integration:
- **Stack Auth**: Handles authentication flows (sign-in, sign-up, password reset)
- **Neon PostgreSQL**: Database with automatic user synchronization
- **User Sync Table**: Stack Auth syncs users to `neon_auth.users_sync` table automatically
- **Custom User Data**: Stack Auth provides three metadata types:
  - `clientMetadata`: Client readable/writable (non-sensitive data)
  - `serverMetadata`: Server-only access (sensitive data like API tokens)
  - `clientReadOnlyMetadata`: Client readable, server writable (subscription status, etc.)

#### Stack Auth Usage Pattern:
- **IMPORTANT**: `stackServerApp.getUser()` does NOT accept userId parameter - it gets the currently authenticated user from session
- **For updating metadata**: Use `stackServerApp.getUser()` which returns a Stack user object with `.update()` method
  ```typescript
  import { stackServerApp } from '@/stack/server';

  // Gets currently authenticated user from session (NO userId parameter!)
  const user = await stackServerApp.getUser();

  if (!user) {
    throw new Error('Not authenticated');
  }

  // Optional security check if you have userId from binding
  if (user.id !== userId) {
    throw new Error('Unauthorized');
  }

  await user.update({
    serverMetadata: {
      apiKey: "encrypted_value",
      accountId: "user_account"
    }
  });
  ```
- **For reading only**: Can use `getUserWithMetadata()` from `@/server/auth/auth.data` if you don't need to update
  ```typescript
  import { getUserWithMetadata } from '@/server/auth/auth.data';

  const user = await getUserWithMetadata();
  const apiKey = user?.serverMetadata?.apiKey;
  ```
- **Key difference**: `stackServerApp.getUser()` returns Stack SDK user object (has `.update()`), `getUserWithMetadata()` returns plain object (read-only)

#### User Data Strategy:
- **Primary**: Use Stack Auth metadata for user preferences and settings
- **Database Tables**: Reference `neon_auth.users_sync.id` directly in application tables
- **No user_profiles table**: Stack Auth handles user data, we store relational data only

#### Database Schema Guidelines:
- **Direct References**: All tables reference `neon_auth.users_sync(id)` directly
- **Foreign Key Strategy**:
  - Personal data (activities, preferences): `ON DELETE CASCADE`
  - Content data (posts, campaigns): `ON DELETE SET NULL` to preserve content
- **Sync Delays**: Use LEFT JOINs with users_sync table due to async sync (<1 second delay)
- **Soft Deletes**: Filter `WHERE users_sync.deleted_at IS NULL` in queries

#### Example Schema Patterns:
```sql
-- Personal data that should be removed with user
CREATE TABLE user_activities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL, -- References neon_auth.users_sync(id)
    activity_type VARCHAR(50) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Content that should persist after user deletion
CREATE TABLE campaigns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID, -- References neon_auth.users_sync(id)
    name VARCHAR(255) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);
```

#### Query Best Practices:
```sql
-- Use LEFT JOIN and filter deleted users
SELECT campaigns.*, users_sync.display_name
FROM campaigns
LEFT JOIN neon_auth.users_sync ON campaigns.user_id = users_sync.id
WHERE users_sync.deleted_at IS NULL;
```

### Credentials Management System

#### Centralized Credentials Architecture:
All service credentials (Cloudflare, Google Workspace, Smartlead) are stored in Stack Auth `serverMetadata` (automatically encrypted) and managed through a centralized system in `server/credentials/`.

**Core Files:**
- `lib/types/credentials.ts` - TypeScript type definitions for all service credentials
- `server/credentials/credentials.data.ts` - Centralized getters for retrieving credentials
- `server/credentials/credentials.actions.ts` - Actions for saving/removing credentials
- `server/cloudflare/cloudflare.actions.ts` - Cloudflare-specific credential setup
- `server/google-workspace/google-workspace.actions.ts` - Google Workspace credential setup
- `server/smartlead/credentials.actions.ts` - Smartlead credential setup

#### Getting User Credentials:

**✅ Correct way - Use centralized getters:**
```typescript
import {
  getCloudflareCredentials,
  getGoogleWorkspaceCredentials,
  getSmartleadCredentials,
  getUserCredentials,
  hasCloudflareCredentials,
  hasGoogleWorkspaceCredentials,
  hasSmartleadCredentials
} from '@/server/credentials/credentials.data';

// Get specific service credentials
const cfCreds = await getCloudflareCredentials();
// Returns: { apiToken: string, accountId: string, connectedAt: string } | null

const gwCreds = await getGoogleWorkspaceCredentials();
// Returns: { serviceAccountEmail, privateKey, adminEmail, customerId?, connectedAt } | null

const slCreds = await getSmartleadCredentials();
// Returns: { apiKey: string, connectedAt: string } | null

// Get all credentials at once
const allCreds = await getUserCredentials();
// Returns: { cloudflare?, googleWorkspace?, smartlead? } | null

// Check if credentials exist
const hasCF = await hasCloudflareCredentials(); // boolean
const hasGW = await hasGoogleWorkspaceCredentials(); // boolean
const hasSL = await hasSmartleadCredentials(); // boolean
```

**❌ Don't access serverMetadata directly:**
```typescript
// DON'T DO THIS:
const user = await stackServerApp.getUser();
const apiToken = user.serverMetadata?.cloudflare?.apiToken; // BAD - not type-safe, no centralization
```

#### Saving Credentials:

Each service has validation built-in before saving:

```typescript
// Cloudflare (validates token by testing API)
import { saveCloudflareCredentialsAction } from '@/server/cloudflare/cloudflare.actions';
const result = await saveCloudflareCredentialsAction(apiToken, accountId);
// Returns: { success: boolean, error?: string }

// Google Workspace (validates by testing Admin SDK)
import { saveGoogleWorkspaceCredentialsAction } from '@/server/google-workspace/google-workspace.actions';
const result = await saveGoogleWorkspaceCredentialsAction(
  serviceAccountEmail,
  privateKey,
  adminEmail,
  customerId // optional
);

// Smartlead (validates API key)
import { saveSmartleadCredentialsAction } from '@/server/smartlead/credentials.actions';
const result = await saveSmartleadCredentialsAction(apiKey);
```

#### Removing Credentials:

```typescript
import { removeServiceCredentials } from '@/server/credentials/credentials.actions';

// Remove specific service
await removeServiceCredentials('cloudflare');
await removeServiceCredentials('googleWorkspace');
await removeServiceCredentials('smartlead');

// Or use service-specific disconnect actions
import { disconnectCloudflareAction } from '@/server/cloudflare/cloudflare.actions';
import { disconnectGoogleWorkspaceAction } from '@/server/google-workspace/google-workspace.actions';
import { disconnectSmartleadAction } from '@/server/smartlead/credentials.actions';

await disconnectCloudflareAction();
await disconnectGoogleWorkspaceAction();
await disconnectSmartleadAction();
```


## Code Quality & Linting

### Running Linter
**IMPORTANT**: Always run `npm run lint:types and npm run lint:eslint` before marking tasks as complete.

```bash
npm run lint:types
```

```bash
npm run lint:estlint
```

**This command checks:**
- ESLint errors (code style and best practices)
- TypeScript type errors (strict mode enabled)

### Common Issues to Fix

#### TypeScript `any` Types in Tests
❌ **Don't:**
```typescript
let mockResolver: any;
mockResolver.resolveTxt.mockImplementation((domain: string, callback: any) => {
  callback(null, mockData);
});
```

✅ **Do:**
```typescript
interface MockResolver {
  setServers: ReturnType<typeof vi.fn>;
  resolveTxt: ReturnType<typeof vi.fn>;
}

type DnsCallback<T> = (err: Error | null, result: T) => void;

let mockResolver: MockResolver;
mockResolver.resolveTxt.mockImplementation((domain: string, callback: DnsCallback<string[][]>) => {
  callback(null, mockData);
});
```

### Lint Enforcement
- Project uses **strict TypeScript mode** (`"strict": true` in tsconfig.json)
- All code must pass lint before merge
- No explicit `any` types without proper justification