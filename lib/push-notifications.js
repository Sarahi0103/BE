// Push Notifications Manager
const webpush = require('web-push');

// Configurar VAPID keys
const vapidPublicKey = process.env.VAPID_PUBLIC_KEY;
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;
const vapidSubject = process.env.VAPID_SUBJECT || 'mailto:pokedex@example.com';

if (vapidPublicKey && vapidPrivateKey) {
  webpush.setVapidDetails(
    vapidSubject,
    vapidPublicKey,
    vapidPrivateKey
  );
  console.log('✅ Push Notifications configuradas correctamente');
} else {
  console.warn('⚠️  VAPID keys no encontradas. Push notifications deshabilitadas.');
  console.warn('   Genera las keys con: node generate-vapid-keys.js');
}

// Almacenamiento en memoria de suscripciones (en producción usar DB)
// Estructura: { userId: [subscription1, subscription2, ...] }
const subscriptions = new Map();

/**
 * Guardar una suscripción de usuario
 */
function saveSubscription(userId, subscription) {
  if (!subscriptions.has(userId)) {
    subscriptions.set(userId, []);
  }
  
  const userSubs = subscriptions.get(userId);
  
  // Verificar si ya existe esta suscripción
  const exists = userSubs.some(sub => 
    sub.endpoint === subscription.endpoint
  );
  
  if (!exists) {
    userSubs.push(subscription);
    console.log(`📱 Nueva suscripción guardada para usuario ${userId}`);
  }
  
  return true;
}

/**
 * Eliminar una suscripción
 */
function removeSubscription(userId, endpoint) {
  if (!subscriptions.has(userId)) {
    return false;
  }
  
  const userSubs = subscriptions.get(userId);
  const index = userSubs.findIndex(sub => sub.endpoint === endpoint);
  
  if (index !== -1) {
    userSubs.splice(index, 1);
    console.log(`📱 Suscripción eliminada para usuario ${userId}`);
    
    // Si no quedan suscripciones, eliminar el usuario del Map
    if (userSubs.length === 0) {
      subscriptions.delete(userId);
    }
    
    return true;
  }
  
  return false;
}

/**
 * Obtener todas las suscripciones de un usuario
 */
function getUserSubscriptions(userId) {
  return subscriptions.get(userId) || [];
}

/**
 * Enviar push notification a un usuario
 */
async function sendPushNotification(userId, payload) {
  const userSubs = getUserSubscriptions(userId);
  
  if (userSubs.length === 0) {
    console.log(`📱 Sin suscripciones para usuario ${userId}`);
    return { success: false, message: 'No subscriptions found' };
  }
  
  const payloadString = JSON.stringify(payload);
  const results = [];
  
  for (const subscription of userSubs) {
    try {
      await webpush.sendNotification(subscription, payloadString);
      results.push({ success: true, endpoint: subscription.endpoint });
      console.log(`📤 Push enviado a usuario ${userId}`);
    } catch (error) {
      console.error(`❌ Error enviando push:`, error.message);
      
      // Si la suscripción expiró o es inválida (410, 404), eliminarla
      if (error.statusCode === 410 || error.statusCode === 404) {
        removeSubscription(userId, subscription.endpoint);
      }
      
      results.push({ 
        success: false, 
        endpoint: subscription.endpoint, 
        error: error.message 
      });
    }
  }
  
  return { 
    success: results.some(r => r.success), 
    results 
  };
}

/**
 * Enviar notificación de invitación de amistad
 */
async function sendFriendRequestNotification(userId, friendName) {
  const payload = {
    title: '👥 Nueva solicitud de amistad',
    body: `${friendName} quiere ser tu amigo en Pokedex!`,
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-72.png',
    tag: 'friend-request',
    data: {
      type: 'friend-request',
      url: '/friends'
    }
  };
  
  return await sendPushNotification(userId, payload);
}

/**
 * Enviar notificación de reto de batalla
 */
async function sendBattleChallengeNotification(userId, challengerName, battleId) {
  const payload = {
    title: '⚔️ Nuevo reto de batalla',
    body: `${challengerName} te ha retado a una batalla!`,
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-72.png',
    tag: 'battle-challenge',
    data: {
      type: 'battle-challenge',
      battleId: battleId,
      url: `/battle?id=${battleId}`
    },
    actions: [
      {
        action: 'accept',
        title: 'Aceptar'
      },
      {
        action: 'view',
        title: 'Ver detalles'
      }
    ]
  };
  
  return await sendPushNotification(userId, payload);
}

/**
 * Enviar notificación de batalla aceptada
 */
async function sendBattleAcceptedNotification(userId, opponentName, battleId) {
  const payload = {
    title: '⚔️ Batalla aceptada',
    body: `${opponentName} ha aceptado tu desafío!`,
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-72.png',
    tag: 'battle-accepted',
    data: {
      type: 'battle-accepted',
      battleId: battleId,
      url: `/battle?id=${battleId}`
    }
  };
  
  return await sendPushNotification(userId, payload);
}

/**
 * Obtener estadísticas de suscripciones
 */
function getSubscriptionStats() {
  let totalSubs = 0;
  subscriptions.forEach(subs => {
    totalSubs += subs.length;
  });
  
  return {
    totalUsers: subscriptions.size,
    totalSubscriptions: totalSubs
  };
}

module.exports = {
  saveSubscription,
  removeSubscription,
  getUserSubscriptions,
  sendPushNotification,
  sendFriendRequestNotification,
  sendBattleChallengeNotification,
  sendBattleAcceptedNotification,
  getSubscriptionStats,
  getVapidPublicKey: () => vapidPublicKey
};
