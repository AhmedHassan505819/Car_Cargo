'use client';

import { useState, useEffect, useCallback } from 'react';

/**
 * Hook to keep the screen on using the Wake Lock API.
 * Critical for rider tracking — the app must stay visible on a bike mount.
 */
export function useWakeLock() {
  const [isSupported, setIsSupported] = useState(false);
  const [isActive, setIsActive] = useState(false);
  const [wakeLock, setWakeLock] = useState<WakeLockSentinel | null>(null);

  useEffect(() => {
    setIsSupported('wakeLock' in navigator);
  }, []);

  const request = useCallback(async () => {
    if (!('wakeLock' in navigator)) return;

    try {
      const sentinel = await navigator.wakeLock.request('screen');
      setWakeLock(sentinel);
      setIsActive(true);

      sentinel.addEventListener('release', () => {
        setIsActive(false);
        setWakeLock(null);
      });
    } catch (err) {
      console.warn('Wake Lock request failed:', err);
      setIsActive(false);
    }
  }, []);

  const release = useCallback(async () => {
    if (wakeLock) {
      await wakeLock.release();
      setWakeLock(null);
      setIsActive(false);
    }
  }, [wakeLock]);

  // Re-acquire wake lock when the page becomes visible again
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && isActive && !wakeLock) {
        request();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [isActive, wakeLock, request]);

  return { isSupported, isActive, request, release };
}
