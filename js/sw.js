/*!
 * QUELORA – Real-time interaction platform for websites
 * 
 * @author German Zelaya
 * @version 1.0.0
 * @since 2023
* @license Licensed under the GNU Affero General Public License v3.0
 * 
 * Copyright (C) 2025 German Zelaya
 * 
 * QUELORA is an open-source platform designed to add real-time comments,
 * posts, and reactions to websites. Its lightweight widget (~170KB uncompressed)
 * integrates easily into any page without the need for frameworks like React
 * or jQuery. It includes support for AI-powered automated moderation,
 * engagement analytics, and a multi-tenant dashboard to manage multiple sites
 * from a single interface.
 * 
 * This script is part of the QUELORA project, available at:
 * https://www.quelora.org/
 * 
 * This program is free software: you can redistribute it and/or modify it
 * under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 * 
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 * 
 * You should have received a copy of the GNU General Public License
 * along with this program. If not, see <https://www.gnu.org/licenses/>.
 */

const CACHE_NAME = 'quelora-notifications-v3';
const APP_URL = 'https://quelora.localhost.ar:444';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    Promise.all([
      self.clients.claim(),
      cleanOldCaches()
    ])
  );
});

self.addEventListener('push', (event) => {
  event.waitUntil(
    handlePushNotification(event)
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const link = event.notification.data?.link || APP_URL;

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(async (windowClients) => {
      const targetOrigin = new URL(APP_URL).origin;
      const linkHash = new URL(link).hash;

      for (const client of windowClients) {
        if (client.url.startsWith(targetOrigin)) {
          try {
            await client.navigate(link);
            return client.focus();
          } catch (e) {
            console.warn('Navigation failed, trying postMessage:', e);
            client.postMessage({ type: 'UPDATE_HASH', hash: linkHash });
            return client.focus();
          }
        }
      }

      return self.clients.openWindow(link);
    })
  );
});

async function handlePushNotification(event) {
  try {
    let data = {
      title: 'Quelora',
      body: 'Nueva notificación',
      type: 'generic',
      icon: null,
      entity: null,
      commentId: null,
      replyId: null,
      follow: null
    };

    if (event.data) {
      try {
        Object.assign(data, event.data.json());
      } catch (e) {
        console.warn('Invalid JSON, using text:', e);
        data.body = event.data.text() || 'Nueva notificación';
      }
    }

    const link = generateNotificationLink(data.type, {
      entity: data.entity,
      commentId: data.commentId,
      replyId: data.replyId,
      follow: data.follow
    });

    await sendMessageToClient({
      type: 'SHOW_TOAST',
      title: data.title,
      body: data.body,
      url: link,
      icon: await getNotificationIcon(data.icon)
    });

    return self.registration.showNotification(data.title, {
      body: data.body,
      icon: await getNotificationIcon(data.icon),
      data: { link }
    });
  } catch (err) {
    console.error('Error in handlePushNotification:', err);
    return processPushNotification(event);
  }
}

function generateNotificationLink(type, ids) {
  const { entity, commentId, replyId, follow } = ids;
  switch (type) {
    case 'follower':
      return follow ? `${APP_URL}#QUELORA-U-${follow}` : APP_URL;
    case 'reply':
      return (entity && commentId && replyId)
        ? `${APP_URL}#QUELORA-Q-${entity}-${commentId}-${replyId}`
        : APP_URL;
    case 'comment':
      return (entity && commentId)
        ? `${APP_URL}#QUELORA-Q-${entity}-${commentId}`
        : APP_URL;
    case 'like':
      return (entity && commentId)
        ? (replyId
            ? `${APP_URL}#QUELORA-L-${entity}-${commentId}-${replyId}`
            : `${APP_URL}#QUELORA-L-${entity}-${commentId}`)
        : APP_URL;
    default:
      return APP_URL;
  }
}

async function sendMessageToClient(message) {
  const allClients = await self.clients.matchAll({
    includeUncontrolled: true,
    type: 'window'
  });

  for (const client of allClients) {
    try {
      if (client.url.startsWith(new URL(APP_URL).origin)) {
        client.postMessage(message);
        break;
      }
    } catch (e) {
      console.error('Error sending message to client:', e);
    }
  }
}

async function getNotificationIcon(customIcon) {
  if (customIcon) return customIcon;
  try {
    const cache = await caches.open(CACHE_NAME);
    const response = await cache.match('/icon.png');
    return response?.url || `${APP_URL}/icon.png`;
  } catch (e) {
    console.error('Error fetching icon:', e);
    return `${APP_URL}/icon.png`;
  }
}

async function cleanOldCaches() {
  const keys = await caches.keys();
  return Promise.all(
    keys.filter(key => key !== CACHE_NAME)
      .map(key => caches.delete(key))
  );
}

function processPushNotification(event) {
  const data = event.data?.json() || {
    title: 'Quelora',
    body: event.data?.text() || 'Nueva notificación'
  };

  const link = generateNotificationLink(data.type, {
    entity: data.entity,
    commentId: data.commentId,
    replyId: data.replyId,
    follow: data.follow
  });

  return self.registration.showNotification(data.title || 'Quelora', {
    body: data.body || 'Nueva notificación',
    icon: data.icon || `${APP_URL}/icon.png`,
    data: { link }
  });
}
