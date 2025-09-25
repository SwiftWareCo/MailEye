'use server';

import { stackServerApp } from '../../stack/server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

// Type definitions for metadata updates
export type ClientMetadataUpdate = {
  theme?: 'dark' | 'light';
  emailNotifications?: boolean;
  pushNotifications?: boolean;
  language?: string;
  timezone?: string;
  preferences?: Record<string, boolean | string | number | null>;
};

export type ServerMetadataUpdate = {
  lastLoginAt?: Date;
  loginCount?: number;
  securitySettings?: Record<string, boolean | string | number | null>;
};

export type ClientReadOnlyMetadataUpdate = {
  subscriptionPlan?: 'free' | 'pro' | 'enterprise';
  subscriptionStatus?: 'active' | 'inactive' | 'cancelled';
  subscriptionExpiresAt?: Date;
  subscriptionFeatures?: string[];
  onboardingCompleted?: boolean;
  subscription?: Record<string, boolean | string | number | null>;
};

// Main metadata update action
export async function updateUserMetadata(
  clientMetadata?: ClientMetadataUpdate,
  serverMetadata?: ServerMetadataUpdate,
  clientReadOnlyMetadata?: ClientReadOnlyMetadataUpdate
) {
  try {
    const user = await stackServerApp.getUser();

    if (!user) {
      throw new Error('User not authenticated');
    }

    // Prepare update object
    const updateData: Record<string, boolean | string | number | null> = {};

    // Update client metadata (user preferences)
    if (clientMetadata) {
      updateData.clientMetadata = {
        ...user.clientMetadata,
        ...clientMetadata,
      };
    }

    // Update server metadata (server-only data)
    if (serverMetadata) {
      updateData.serverMetadata = {
        ...user.serverMetadata,
        ...serverMetadata,
      };
    }

    // Update client read-only metadata (subscription info, etc.)
    if (clientReadOnlyMetadata) {
      updateData.clientReadOnlyMetadata = {
        ...user.clientReadOnlyMetadata,
        ...clientReadOnlyMetadata,
      };
    }

    // Perform the update
    await user.update(updateData);

    // Revalidate relevant paths
    revalidatePath('/dashboard');
    revalidatePath('/dashboard/settings');

    return { success: true, message: 'Metadata updated successfully' };
  } catch (error) {
    console.error('Error updating user metadata:', error);
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Failed to update metadata'
    };
  }
}

// Simplified form action for settings form submission
export async function updateSettingsFormAction(formData: FormData) {
  try {
    const user = await stackServerApp.getUser();

    if (!user) {
      return { success: false, message: 'User not authenticated' };
    }

    const language = formData.get('language') as string;
    const timezone = formData.get('timezone') as string;

    // Direct update without unnecessary function layers
    await user.update({
      clientMetadata: {
        ...user.clientMetadata,
        language,
        timezone,
      }
    });

    revalidatePath('/dashboard/settings');
    return { success: true, message: 'Settings updated successfully!' };
  } catch (error) {
    console.error('Error updating settings:', error);
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Failed to update settings'
    };
  }
}

// Action for updating server-side tracking data
export async function updateUserTracking() {
  try {
    const user = await stackServerApp.getUser();

    if (!user) {
      throw new Error('User not authenticated');
    }

    const currentLoginCount = (user.serverMetadata?.loginCount as number) || 0;

    await user.update({
      serverMetadata: {
        ...user.serverMetadata,
        lastLoginAt: new Date(),
        loginCount: currentLoginCount + 1,
      }
    });

    return { success: true, message: 'User tracking updated' };
  } catch (error) {
    console.error('Error updating user tracking:', error);
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Failed to update tracking'
    };
  }
}

// Helper action to check if user needs onboarding
export async function checkOnboardingStatus() {
  try {
    const user = await stackServerApp.getUser();

    if (!user) {
      return { needsOnboarding: false, isAuthenticated: false };
    }

    const onboardingCompleted = user.clientReadOnlyMetadata?.onboardingCompleted;

    return {
      needsOnboarding: !onboardingCompleted,
      isAuthenticated: true
    };
  } catch (error) {
    console.error('Error checking onboarding status:', error);
    return { needsOnboarding: false, isAuthenticated: false };
  }
}

// Server action to complete onboarding with validation
export async function completeOnboardingWithData(onboardingData: {
  firstName: string;
  lastName: string;
  company?: string;
  role?: string;
  industry?: string;
  teamSize?: string;
  primaryGoal: string;
  experienceLevel: string;
}) {
  try {
    const user = await stackServerApp.getUser();

    if (!user) {
      return { success: false, message: 'User not authenticated' };
    }

    // Validate required fields
    if (!onboardingData.firstName || !onboardingData.lastName || !onboardingData.primaryGoal || !onboardingData.experienceLevel) {
      return { success: false, message: 'Missing required fields' };
    }

    // Store onboarding data in clientMetadata and set completion flag in clientReadOnlyMetadata
    await user.update({
      clientMetadata: {
        ...user.clientMetadata,
        onboardingData: {
          firstName: onboardingData.firstName,
          lastName: onboardingData.lastName,
          company: onboardingData.company || '',
          role: onboardingData.role || '',
          industry: onboardingData.industry || '',
          teamSize: onboardingData.teamSize || '',
          primaryGoal: onboardingData.primaryGoal,
          experienceLevel: onboardingData.experienceLevel,
          completedAt: new Date().toISOString(),
        }
      },
      clientReadOnlyMetadata: {
        ...user.clientReadOnlyMetadata,
        onboardingCompleted: true,
      }
    });

    revalidatePath('/dashboard');
    revalidatePath('/onboarding');

    return { success: true, message: 'Onboarding completed successfully!' };
  } catch (error) {
    console.error('Error completing onboarding:', error);
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Failed to complete onboarding'
    };
  }
}