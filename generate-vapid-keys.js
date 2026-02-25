// Script para generar VAPID keys para push notifications
const webpush = require('web-push');

console.log('🔐 Generando VAPID keys para Push Notifications...\n');

const vapidKeys = webpush.generateVAPIDKeys();

console.log('✅ VAPID keys generadas correctamente!\n');
console.log('📋 Agrega estas líneas a tu archivo .env:\n');
console.log('VAPID_PUBLIC_KEY=' + vapidKeys.publicKey);
console.log('VAPID_PRIVATE_KEY=' + vapidKeys.privateKey);
console.log('VAPID_SUBJECT=mailto:your-email@example.com');
console.log('\n⚠️  IMPORTANTE: Guarda estas claves de forma segura.');
console.log('⚠️  No las compartas ni las subas a repositorios públicos.\n');
