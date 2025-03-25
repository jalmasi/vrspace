// copied from https://github.com/NajmAjmal-old/pwa-template/blob/main/service-worker.js
const CACHE_NAME = 'vrspace-cache-empty';

const cacheUrls = [
  // none yet
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(cacheUrls);
    })
  );
});

self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((response) => {
      return response || fetch(event.request);
    })
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      );
    })
  );
});

// web push notification received - show it
self.addEventListener("push", (event) => {
  if ( event.data ) {
    console.log("Push "+event.data.text());
    const payload = event.data.json();
    if ( payload.type == "WORLD_INVITE") {
      const title = "Join "+payload.message;
      const message = "Invitation from " + payload.sender + ": click here to enter "+payload.message;
      event.waitUntil(
        self.registration.showNotification(title, {
          data: payload,
          body: message,
          image: "/web/favicon-512.png",
          icon: "/web/favicon-128.png",
          badge: "/web/favicon-128.png", //96x96px
          //renotify: true, // may require tag
          requireInteraction: true
        })
      );
    } else if ( payload.type == "GROUP_INVITE") {
      const title = "Join "+payload.group;
      const message = "Invitation from " + payload.sender + ": join group "+payload.group;
      event.waitUntil(
        self.registration.showNotification(title, {
          data: payload,
          body: message,
          image: "/web/favicon-512.png",
          icon: "/web/favicon-128.png",
          badge: "/web/favicon-128.png", //96x96px
          //renotify: true, // may require tag
          requireInteraction: true
        })
      );
    } else if ( payload.type == "GROUP_MESSAGE") {
      const title = payload.group;
      const message = "["+payload.sender+"] " + payload.message;
      event.waitUntil(
        self.registration.showNotification(title, {
          data: payload,
          body: message,
          image: "/web/favicon-512.png",
          icon: "/web/favicon-128.png",
          badge: "/web/favicon-128.png", //96x96px
          //renotify: true, // may require tag
          requireInteraction: false
        })
      );
    }
  }
});

// web push notification clicked - close it, open link in new tab
self.addEventListener('notificationclick', (event) => {
  console.log("Click "+event.notification.data.url);
  const url = event.notification.data.url;
  event.notification.close();
  if ( url ) {
    clients.openWindow(url);
  }
});
