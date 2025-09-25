'use client';

import { useEffect } from 'react';
import { useUser } from '@stackframe/stack';
import { useRouter } from 'next/navigation';

export function useOnboarding() {
  const user = useUser();
  const router = useRouter();

  useEffect(() => {
    if (user && !user.clientReadOnlyMetadata?.onboardingCompleted) {
      router.push('/onboarding');
    }
  }, [user, router]);
}

export function useRequireOnboarding() {
  const user = useUser();
  const router = useRouter();

  useEffect(() => {
    // If user is loaded but not onboarded, redirect to onboarding
    if (user && user.clientReadOnlyMetadata?.onboardingCompleted === false) {
      router.push('/onboarding');
    }
    // If user is not loaded yet, wait
    // If user doesn't exist, Stack Auth will handle redirect to sign-in
  }, [user, router]);

  return {
    isOnboarded: user?.clientReadOnlyMetadata?.onboardingCompleted || false,
    isLoading: !user,
  };
}