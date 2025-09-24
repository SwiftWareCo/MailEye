import 'server-only';

import { stackServerApp } from '../../stack/server';
import { db } from '../../lib/db';
import { userActivities } from '../../lib/db/schema';
import { eq, desc } from 'drizzle-orm';

// Stack Auth metadata type definitions
export type StackAuthUserMetadata = {
  clientMetadata: Record<string, string>;
  serverMetadata: Record<string, string>;
  clientReadOnlyMetadata: Record<string, string>;
};

// Extended user type with metadata
export type UserWithMetadata = {
  id: string;
  displayName: string | null;
  primaryEmail: string | null;
  primaryEmailVerified: boolean;
  profileImageUrl: string | null;
  signedUpAt: Date | null;
  clientMetadata: Record<string, string>;
  serverMetadata: Record<string, string>;
  clientReadOnlyMetadata: Record<string, string>;
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

// Get user's recent activities from database
export async function getUserActivities(userId: string, limit: number = 10) {
  try {
    const activities = await db
      .select()
      .from(userActivities)
      .where(eq(userActivities.userId, userId))
      .orderBy(desc(userActivities.createdAt))
      .limit(limit);

    return activities;
  } catch (error) {
    console.error('Error getting user activities:', error);
    return [];
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

    // Extract common preferences from clientMetadata
    const preferences = {
      theme: user.clientMetadata.theme || 'dark',
      emailNotifications: user.clientMetadata.emailNotifications !== false, // default true
      pushNotifications: user.clientMetadata.pushNotifications !== false, // default true
      language: user.clientMetadata.language || 'en',
      timezone: user.clientMetadata.timezone || 'UTC',
      ...user.clientMetadata.preferences, // allow additional custom preferences
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
      ...user.clientReadOnlyMetadata.subscription, // allow additional subscription data
    };

    return subscription;
  } catch (error) {
    console.error('Error getting user subscription info:', error);
    return null;
  }
}