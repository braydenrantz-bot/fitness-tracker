/* RepRank service worker: offline cache + background reminders */
const VERSION = 'reprank-v1';
const SHELL = ['./', 'index.html', 'styles.css', 'data.js', 'app.js', 'manifest.json', 'icon.svg', 'icon-192.png', 'icon-512.png', 'icon-180.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION && k !== 'reprank-state').map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Network first (so updates show up), fall back to cache when offline.
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  if (req.url.endsWith('/__state')) return;
  e.respondWith(
    fetch(req)
      .then((res) => {
        if (res.ok) { const copy = res.clone(); caches.open(VERSION).then((c) => c.put(req, copy)); }
        return res;
      })
      .catch(() => caches.match(req).then((r) => r || caches.match('index.html')))
  );
});

const stateUrl = () => new URL('./__state', self.registration.scope).href;
function dkey(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

async function checkReminder() {
  const c = await caches.open('reprank-state');
  const res = await c.match(stateUrl());
  if (!res) return;
  const st = await res.json();
  if (!st.notifications) return;
  const k = dkey();
  if ((st.notified || {})[k] || (st.trainedDays || []).includes(k)) return;
  const [h, m] = (st.reminderTime || '17:00').split(':').map(Number);
  const now = new Date();
  if (now.getHours() * 60 + now.getMinutes() < h * 60 + m) return;
  // Don't double-notify if the app is open (it handles reminders itself).
  const wins = await self.clients.matchAll({ type: 'window' });
  if (wins.some((w) => w.visibilityState === 'visible')) return;
  st.notified = { [k]: true };
  await c.put(stateUrl(), new Response(JSON.stringify(st), { headers: { 'Content-Type': 'application/json' } }));
  await self.registration.showNotification('Time to train 💪', {
    body: st.nextName ? `Today is ${st.nextName}. Open RepRank to start.` : 'Your workout is ready.',
    tag: 'daily', icon: 'icon-192.png', badge: 'icon-192.png',
  });
}

self.addEventListener('periodicsync', (e) => {
  if (e.tag === 'reprank-reminder') e.waitUntil(checkReminder());
});

self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  e.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((wins) => {
      for (const w of wins) if ('focus' in w) return w.focus();
      return self.clients.openWindow('./');
    })
  );
});
