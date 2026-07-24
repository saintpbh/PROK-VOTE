'use client';

import { useEffect } from 'react';

/**
 * ServiceWorkerCleaner component
 * Forcefully unregisters all registered service workers and clears caches
 * to prevent outdated JS files from being served to mobile devices.
 */
export default function ServiceWorkerCleaner() {
    useEffect(() => {
        if (typeof window === 'undefined') return;

        const cleanServiceWorkersAndCaches = async () => {
            let cleared = false;

            // 1. Unregister all service workers
            if ('serviceWorker' in navigator) {
                try {
                    const registrations = await navigator.serviceWorker.getRegistrations();
                    for (const registration of registrations) {
                        await registration.unregister();
                        console.log('[Cleaner] Service Worker unregistered:', registration.scope);
                        cleared = true;
                    }
                } catch (err) {
                    console.error('[Cleaner] Failed to unregister service worker:', err);
                }
            }

            // 2. Clear all cache storage
            if ('caches' in window) {
                try {
                    const cacheNames = await caches.keys();
                    for (const name of cacheNames) {
                        await caches.delete(name);
                        console.log('[Cleaner] Cache cleared:', name);
                        cleared = true;
                    }
                } catch (err) {
                    console.error('[Cleaner] Failed to clear caches:', err);
                }
            }

            // 3. Force reload if anything was cleared to ensure the latest assets are loaded
            if (cleared) {
                console.log('[Cleaner] Stale service workers/caches cleared — forcing hard reload');
                window.location.reload();
            }
        };

        cleanServiceWorkersAndCaches();
    }, []);

    return null;
}
