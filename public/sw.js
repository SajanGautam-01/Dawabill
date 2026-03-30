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

// --- PHASE 5: OFFLINE QUEUE BACKGROUND SYNC ---

// Simple native IDB wrapper for ServiceWorker Scope
function openOfflineDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('DawabillOfflineStore', 1);
    request.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains('cash_queue')) {
        db.createObjectStore('cash_queue', { keyPath: 'idempotency_key' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-offline-bills') {
    console.log('[SW Background Sync] Triggered IDB Cash Queue Recovery');
    event.waitUntil(processOfflineQueue());
  }
});

async function processOfflineQueue() {
  const db = await openOfflineDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('cash_queue', 'readonly');
    const store = tx.objectStore('cash_queue');
    const request = store.getAll();
    
    request.onsuccess = async () => {
      const bills = request.result;
      if (!bills || bills.length === 0) return resolve();
      
      let hasError = false;
      
      for (const bill of bills) {
        try {
          const res = await fetch('/api/sync-offline', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(bill)
          });
          
          if (!res.ok) {
            hasError = true;
            console.error('SW Sync Rejected Structurally:', await res.text());
            continue; // Move to next bill, let background sync retry this later 
          }
          
          // Delete from IndexedDB upon success locally avoiding duplicates
          const deleteTx = db.transaction('cash_queue', 'readwrite');
          deleteTx.objectStore('cash_queue').delete(bill.idempotency_key);
          console.log('[SW Background Sync] Successfully Synced:', bill.bill_number);
          
        } catch (err) {
          console.error('SW Sync Network Failed:', err);
          hasError = true;
        }
      }
      
      if (hasError) {
        // Rejecting causes the ServiceWorker Background Sync to exponential-backoff retry automatically later!
        reject(new Error('Partial or complete sync failure, queuing browser native retry.'));
      } else {
        resolve();
      }
    };
    
    request.onerror = () => reject(request.error);
  });
}
