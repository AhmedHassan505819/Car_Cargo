'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

interface GeolocationState {
  position: { lat: number; lng: number } | null;
  accuracy: number | null;
  heading: number | null;
  speed: number | null;
  error: string | null;
  isWatching: boolean;
}

interface UseGeolocationOptions {
  enableHighAccuracy?: boolean;
  maxAge?: number;          // milliseconds
  timeout?: number;         // milliseconds
  watch?: boolean;          // continuous tracking
}

/**
 * Hook for browser geolocation with configurable accuracy and watch mode.
 */
export function useGeolocation(options: UseGeolocationOptions = {}) {
  const {
    enableHighAccuracy = false,
    maxAge = 30000,
    timeout = 10000,
    watch = false,
  } = options;

  const [state, setState] = useState<GeolocationState>({
    position: null,
    accuracy: null,
    heading: null,
    speed: null,
    error: null,
    isWatching: false,
  });

  const watchIdRef = useRef<number | null>(null);

  const handleSuccess = useCallback((pos: GeolocationPosition) => {
    setState({
      position: {
        lat: pos.coords.latitude,
        lng: pos.coords.longitude,
      },
      accuracy: pos.coords.accuracy,
      heading: pos.coords.heading,
      speed: pos.coords.speed,
      error: null,
      isWatching: watch,
    });
  }, [watch]);

  const handleError = useCallback((err: GeolocationPositionError) => {
    let message = 'Location unavailable';
    switch (err.code) {
      case err.PERMISSION_DENIED:
        message = 'Location permission denied. Please enable it in your browser settings.';
        break;
      case err.POSITION_UNAVAILABLE:
        message = 'Location unavailable. Please check your GPS.';
        break;
      case err.TIMEOUT:
        message = 'Location request timed out. Please try again.';
        break;
    }
    setState((prev) => ({ ...prev, error: message, isWatching: false }));
  }, []);

  const startWatching = useCallback(() => {
    if (!navigator.geolocation) {
      setState((prev) => ({ ...prev, error: 'Geolocation not supported' }));
      return;
    }

    const geoOptions: PositionOptions = {
      enableHighAccuracy,
      maximumAge: maxAge,
      timeout,
    };

    if (watch) {
      watchIdRef.current = navigator.geolocation.watchPosition(
        handleSuccess,
        handleError,
        geoOptions
      );
      setState((prev) => ({ ...prev, isWatching: true }));
    } else {
      navigator.geolocation.getCurrentPosition(
        handleSuccess,
        handleError,
        geoOptions
      );
    }
  }, [enableHighAccuracy, maxAge, timeout, watch, handleSuccess, handleError]);

  const stopWatching = useCallback(() => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    setState((prev) => ({ ...prev, isWatching: false }));
  }, []);

  const getCurrentPosition = useCallback(() => {
    if (!navigator.geolocation) {
      setState((prev) => ({ ...prev, error: 'Geolocation not supported' }));
      return;
    }
    navigator.geolocation.getCurrentPosition(handleSuccess, handleError, {
      enableHighAccuracy: true,
      maximumAge: 0,
      timeout: 15000,
    });
  }, [handleSuccess, handleError]);

  useEffect(() => {
    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
    };
  }, []);

  return {
    ...state,
    startWatching,
    stopWatching,
    getCurrentPosition,
  };
}
