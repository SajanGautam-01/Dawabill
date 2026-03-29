const CACHE_NAME = 'dawabill-v5-hydration-recovery';

// Core assets to cache immediately
const APP_SHELL = [
  '/',
  '/manifest.json',
  '/icon.svg'
];

self.addEventListener('install', (e) => {
  self.skipWaiting();
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return Promise.allSettled(
        APP_SHELL.map(url => cache.add(url).catch(err => console.log('SW Cache error:', url, err)))
      );
    })
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keyList) => {
      // FORCE WIPE ALL OLD CACHES
      return Promise.all(
        keyList.map((key) => {
          console.log('[SW] Clearing old cache:', key);
          return caches.delete(key);
        })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);

  // STEP 6 LOGIC FIX: Explicitly exclude Supabase Auth/API from Service Worker to prevent refresh loops
  if (url.pathname.includes('/auth/v1/') || url.pathname.includes('/api/')) {
    return; // Let the browser handle these directly
  }

  // Phase 3: Network Recovery - EXCLUDE Critical Routes
  const isAuth = url.pathname.includes('/auth/');
  const isApi = url.pathname.includes('/api/');
  const isSupabase = url.hostname.includes('supabase.co');

  if (isAuth || isApi || isSupabase || !e.request.url.startsWith('http') || e.request.method !== 'GET') {
    return; // Let browser handle naturally
  }

  // Strategy: Network First, falling back to cache
  e.respondWith(
    fetch(e.request)
      .then((networkResponse) => {
        // Only cache successful standard responses
        if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME)
            .then((cache) => {
              cache.put(e.request, responseToCache);
            })
            .catch(err => console.log("SW Cache Put Error", err));
        }
        return networkResponse;
      })
      .catch(async () => {
        // Network failed (offline). Return from cache.
        const cachedResponse = await caches.match(e.request);
        
        if (cachedResponse) {
          return cachedResponse;
        }

        // Phase 4: SAFE FALLBACK - Always return a valid Response object
        return new Response("Offline Content Unavailable", {
          status: 503,
          statusText: "Service Unavailable (Offline)",
          headers: new Headers({ 'Content-Type': 'text/plain' })
        });
      })
  );
});
