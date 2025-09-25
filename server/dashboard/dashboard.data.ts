import 'server-only';

// Activity type constants for future dashboard functionality
export const ACTIVITY_TYPES = {
  AUTH: 'auth',
  CAMPAIGN: 'campaign',
  SETTINGS: 'settings',
  PROFILE: 'profile',
  DASHBOARD: 'dashboard',
} as const;

export type ActivityType = typeof ACTIVITY_TYPES[keyof typeof ACTIVITY_TYPES];