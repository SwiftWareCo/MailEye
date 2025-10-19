import 'server-only';

import { stackServerApp } from '../../stack/server';

// Stack Auth metadata type definitions
export type StackAuthUserMetadata = {
  clientMetadata: Record<string, boolean | string | number | null>;
  serverMetadata: Record<string, boolean | string | number | null>;
  clientReadOnlyMetadata: Record<string, boolean | string | number | null>;
};

// Extended user type with metadata
export type UserWithMetadata = {
  id: string;
  displayName: string | null;
  primaryEmail: string | null;
  primaryEmailVerified: boolean;
  profileImageUrl: string | null;
  signedUpAt: Date | null;
  clientMetadata: Record<string, boolean | string | number | null>;
  serverMetadata: Record<string, boolean | string | number | null>;
  clientReadOnlyMetadata: Record<string, boolean | string | number | null>;
};

// Core Stack Auth user data access
export async function getStackAuthUser() {
  try {
    const user = await stackServerApp.getUser();
    return user;
  } catch (error) {
    console.error('Error getting Stack Auth user:', error);
    return null;
  }
}

// Get user with full metadata
export async function getUserWithMetadata(): Promise<UserWithMetadata | null> {
  try {
    const user = await stackServerApp.getUser();

    if (!user) {
      return null;
    }

    return {
      id: user.id,
      displayName: user.displayName,
      primaryEmail: user.primaryEmail,
      primaryEmailVerified: user.primaryEmailVerified,
      profileImageUrl: user.profileImageUrl,
      signedUpAt: user.signedUpAt,
      clientMetadata: user.clientMetadata || {},
      serverMetadata: user.serverMetadata || {},
      clientReadOnlyMetadata: user.clientReadOnlyMetadata || {},
    };
  } catch (error) {
    console.error('Error getting user with metadata:', error);
    return null;
  }
}

// Helper function to check if user is authenticated
export async function requireAuth(): Promise<UserWithMetadata> {
  const user = await getUserWithMetadata();

  if (!user) {
    throw new Error('Authentication required');
  }

  return user;
}

// Helper function to get user preferences from clientMetadata
export async function getUserPreferences() {
  try {
    const user = await getUserWithMetadata();

    if (!user) {
      return null;
    }

    // Extract language and timezone preferences from clientMetadata
    const preferences = {
      language: user.clientMetadata.language || 'en',
      timezone: user.clientMetadata.timezone || 'UTC',
    };

    return preferences;
  } catch (error) {
    console.error('Error getting user preferences:', error);
    return null;
  }
}

// Helper function to get user subscription/billing info from clientReadOnlyMetadata
export async function getUserSubscriptionInfo() {
  try {
    const user = await getUserWithMetadata();

    if (!user) {
      return null;
    }

    // Extract subscription info from clientReadOnlyMetadata (server-writable, client-readable)
    const subscription = {
      plan: user.clientReadOnlyMetadata.subscriptionPlan || 'free',
      status: user.clientReadOnlyMetadata.subscriptionStatus || 'inactive',
      expiresAt: user.clientReadOnlyMetadata.subscriptionExpiresAt,
      features: user.clientReadOnlyMetadata.subscriptionFeatures || [],
      ...user.clientReadOnlyMetadata.subscription as unknown as Record<string, boolean | string | number | null>, // allow additional subscription data
    };

    return subscription;
  } catch (error) {
    console.error('Error getting user subscription info:', error);
    return null;
  }
}

// Server-side function to check if user needs onboarding
export async function requireOnboarding(): Promise<{ needsOnboarding: boolean; user: UserWithMetadata | null }> {
  try {
    const user = await getUserWithMetadata();

    if (!user) {
      return { needsOnboarding: false, user: null };
    }

    const onboardingCompleted = user.clientReadOnlyMetadata?.onboardingCompleted;

    return {
      needsOnboarding: !onboardingCompleted,
      user
    };
  } catch (error) {
    console.error('Error checking onboarding status:', error);
    return { needsOnboarding: false, user: null };
  }
}

// Optimized function for settings page - combines user auth, onboarding check, and preferences in one call
export async function getSettingsPageData(): Promise<{
  needsOnboarding: boolean;
  user: UserWithMetadata | null;
  preferences: { language: string; timezone: string } | null;
}> {
  try {
    const user = await getUserWithMetadata();

    if (!user) {
      return { needsOnboarding: false, user: null, preferences: null };
    }

    const onboardingCompleted = user.clientReadOnlyMetadata?.onboardingCompleted;
    const needsOnboarding = !onboardingCompleted;

    // Extract preferences from the same user object to avoid another API call
    const preferences = {
      language: user.clientMetadata.language || 'en',
      timezone: user.clientMetadata.timezone || 'UTC',
    };

    return {
      needsOnboarding,
      user,
      preferences: preferences as { language: string; timezone: string }
    };
  } catch (error) {
    console.error('Error getting settings page data:', error);
    return { needsOnboarding: false, user: null, preferences: null };
  }
}