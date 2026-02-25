require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const axios = require('axios');
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const session = require('express-session');
const rateLimit = require('express-rate-limit');
const { 
  getUserByEmail, 
  getUserByCode,
  createUser, 
  updateUser,
  getFavorites,
  addFavorite,
  removeFavorite,
  getTeams,
  addTeam,
  updateTeam,
  deleteTeam,
  getFriends,
  addFriend,
  // Batallas
  createBattleChallenge,
  getPendingChallenges,
  acceptBattleChallenge,
  rejectBattleChallenge,
  getBattleById,
  updateBattleState,
  updateBattleStatus,
  submitBattleAction,
  getBattleActions,
  finalizeBattle,
  executeBattle,
  getUserBattleHistory
} = require('./lib/db');

const { setupBattleSocket, notifyUser } = require('./lib/battle-socket');

// Push Notifications
const {
  saveSubscription,
  removeSubscription,
  getUserSubscriptions,
  sendFriendRequestNotification,
  sendBattleChallengeNotification,
  sendBattleAcceptedNotification,
  getSubscriptionStats,
  getVapidPublicKey
} = require('./lib/push-notifications');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: ['http://localhost:3000', 'http://localhost:3001', 'http://localhost:5173', 'http://localhost:5174'],
    credentials: true
  }
});

// CORS configuration for OAuth
const corsOptions = {
  origin: ['http://localhost:3000', 'http://localhost:3001', 'http://localhost:5173', 'http://localhost:5174', process.env.FRONTEND_URL].filter(Boolean),
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
};

app.use(cors(corsOptions));
app.options('*', cors(corsOptions));

app.use(express.json());

// Session configuration
app.use(session({
  secret: process.env.SESSION_SECRET || 'session_secret_key',
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false } // Set to true in production with HTTPS
}));

app.use(passport.initialize());
app.use(passport.session());

const PORT = process.env.PORT || 4000;
const JWT_SECRET = process.env.JWT_SECRET || 'dev_secret';
const POKEAPI = process.env.POKEAPI_BASE || 'https://pokeapi.co/api/v2';

// Rate limiting configuration
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // 100 requests per windowMs
  message: 'Demasiadas solicitudes, por favor intenta más tarde',
  standardHeaders: true, // Return rate limit info in `RateLimit-*` headers
  legacyHeaders: false, // Disable `X-RateLimit-*` headers
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // 10auth attempts per windowMs
  message: 'Demasiados intentos de autenticación, por favor intenta más tarde',
  skipSuccessfulRequests: true, // Don't count successful requests
});

const apiFriendsLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 5, // 5 friend requests per minute
  message: 'Estás añadiendo amigos demasiado rápido, espera un poco',
  skipSuccessfulRequests: false,
});

// Google OAuth Strategy
passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID || 'YOUR_CLIENT_ID',
    clientSecret: process.env.GOOGLE_CLIENT_SECRET || 'YOUR_CLIENT_SECRET',
    callbackURL: process.env.GOOGLE_CALLBACK_URL || 'http://localhost:4000/auth/google/callback'
  },
  async function(accessToken, refreshToken, profile, cb) {
    try {
      const email = profile.emails[0].value;
      let user = await getUserByEmail(email);
      
      if (!user) {
        // Create new user from Google profile
        user = {
          email: email,
          name: profile.displayName || profile.emails[0].value.split('@')[0],
          password: '', // No password for OAuth users
          code: Math.random().toString(36).slice(2, 9)
        };
        user = await createUser(user);
      }
      
      return cb(null, user);
    } catch (error) {
      return cb(error, null);
    }
  }
));

passport.serializeUser((user, done) => {
  done(null, user.email);
});

passport.deserializeUser(async (email, done) => {
  try {
    const user = await getUserByEmail(email);
    done(null, user);
  } catch (error) {
    done(error, null);
  }
});

function generateToken(payload){
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' });
}

function authMiddleware(req,res,next){
  const auth = req.headers.authorization;
  if(!auth) return res.status(401).json({ error: 'No token' });
  const token = auth.replace('Bearer ', '');
  try{
    const data = jwt.verify(token, JWT_SECRET);
    req.user = data;
    next();
  }catch(e){
    return res.status(401).json({ error: 'Invalid token' });
  }
}

// Health
app.get('/', (req,res)=> res.json({ ok: true, name: 'Pokedex BFF' }));

// Auth
app.post('/auth/register', authLimiter, async (req,res)=>{
  try{
    const { email, password, name } = req.body;
    if(!email || !password) return res.status(400).json({ error: 'Email and password required' });
    const existing = await getUserByEmail(email);
    if(existing) return res.status(400).json({ error: 'User exists' });
    const hash = await bcrypt.hash(password, 10);
    const user = {
      email,
      name: name || '',
      password: hash,
      code: Math.random().toString(36).slice(2,9)
    };
    const created = await createUser(user);
    const token = generateToken({ email, id: created.id });
    res.json({ token, user: { id: created.id, email, name: created.name, code: created.code } });
  }catch(e){
    console.error('Register error:', e);
    res.status(500).json({ error: 'Database error' });
  }
});

app.post('/auth/login', authLimiter, async (req,res)=>{
  try{
    const { email, password } = req.body;
    if(!email || !password) return res.status(400).json({ error: 'Email and password required' });
    const user = await getUserByEmail(email);
    if(!user) return res.status(400).json({ error: 'Invalid credentials' });
    if(!user.password) return res.status(400).json({ error: 'Please use Google Sign-In for this account' });
    const ok = await bcrypt.compare(password, user.password);
    if(!ok) return res.status(400).json({ error: 'Invalid credentials' });
    const token = generateToken({ email: user.email, id: user.id });
    res.json({ token, user: { id: user.id, email: user.email, name: user.name, code: user.code } });
  }catch(e){
    console.error('Login error:', e);
    res.status(500).json({ error: 'Database error' });
  }
});

// Google OAuth Routes
app.get('/auth/google',
  passport.authenticate('google', { scope: ['profile', 'email'] })
);

app.get('/auth/google/callback',
  passport.authenticate('google', { failureRedirect: '/login' }),
  (req, res) => {
    // Successful authentication
    const token = generateToken({ email: req.user.email, id: req.user.id });
    const user = { id: req.user.id, email: req.user.email, name: req.user.name, code: req.user.code };
    
    // Redirect to frontend with token
    res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:5173'}/auth/callback?token=${token}&user=${encodeURIComponent(JSON.stringify(user))}`);
  }
);

app.get('/auth/logout', (req, res) => {
  req.logout((err) => {
    if (err) return res.status(500).json({ error: 'Logout failed' });
    res.json({ message: 'Logged out successfully' });
  });
});

// Proxy to PokeAPI: search and details
app.get('/api/pokemon/:id', async (req,res)=>{
  const { id } = req.params;
  try{
    const r = await axios.get(`${POKEAPI}/pokemon/${encodeURIComponent(id)}`);
    res.json(r.data);
  }catch(e){
    res.status(500).json({ error: 'PokeAPI error' });
  }
});

// List / search (simple proxy to pokeapi paginated list)
app.get('/api/pokemon', async (req,res)=>{
  const { limit = 20, offset = 0, name } = req.query;
  try{
    if(name){
      // search by name exact: try fetch by name
      const r = await axios.get(`${POKEAPI}/pokemon/${encodeURIComponent(name.toLowerCase())}`);
      return res.json({ results: [r.data], count: 1 });
    }
    const r = await axios.get(`${POKEAPI}/pokemon?limit=${limit}&offset=${offset}`);
    res.json(r.data);
  }catch(e){
    res.status(500).json({ error: 'PokeAPI error' });
  }
});

app.get('/api/pokemon-species/:id', async (req,res)=>{
  const { id } = req.params;
  try{
    const r = await axios.get(`${POKEAPI}/pokemon-species/${encodeURIComponent(id)}`);
    res.json(r.data);
  }catch(e){
    res.status(500).json({ error: 'PokeAPI error' });
  }
});

app.get('/api/pokemon-evolution/:id', async (req,res)=>{
  const { id } = req.params;
  try{
    const r = await axios.get(`${POKEAPI}/evolution-chain/${encodeURIComponent(id)}`);
    res.json(r.data);
  }catch(e){
    res.status(500).json({ error: 'PokeAPI error' });
  }
});

// Analytics endpoint (para capturar eventos del frontend)
app.post('/api/analytics', async (req, res) => {
  try {
    const { events } = req.body;
    
    // Por ahora solo loggeamos los eventos
    // En producción podrías guardarlos en base de datos o enviarlos a un servicio de analytics
    if (events && events.length > 0) {
      console.log(`[Analytics] Recibidos ${events.length} eventos`);
      // events.forEach(event => {
      //   console.log(`  - ${event.category}/${event.action}: ${event.label || ''}`);
      // });
    }
    
    res.json({ success: true, received: events?.length || 0 });
  } catch (err) {
    console.error('[Analytics] Error:', err);
    res.status(500).json({ error: 'Analytics error' });
  }
});

// ============================================
// PUSH NOTIFICATIONS
// ============================================

// Obtener la public key de VAPID (necesaria para el frontend)
app.get('/api/push/vapid-public-key', (req, res) => {
  const publicKey = getVapidPublicKey();
  if (!publicKey) {
    return res.status(500).json({ error: 'VAPID keys not configured' });
  }
  res.json({ publicKey });
});

// Suscribirse a push notifications
app.post('/api/push/subscribe', authMiddleware, async (req, res) => {
  try {
    const { subscription } = req.body;
    
    if (!subscription || !subscription.endpoint) {
      return res.status(400).json({ error: 'Subscription data required' });
    }
    
    const user = await getUserByEmail(req.user.email);
    saveSubscription(user.id, subscription);
    
    console.log(`📱 Usuario ${user.name} suscrito a push notifications`);
    
    res.json({ 
      success: true, 
      message: 'Subscribed to push notifications successfully' 
    });
  } catch (err) {
    console.error('[Push] Subscription error:', err);
    res.status(500).json({ error: 'Subscription error' });
  }
});

// Desuscribirse de push notifications
app.post('/api/push/unsubscribe', authMiddleware, async (req, res) => {
  try {
    const { endpoint } = req.body;
    
    if (!endpoint) {
      return res.status(400).json({ error: 'Endpoint required' });
    }
    
    const user = await getUserByEmail(req.user.email);
    const removed = removeSubscription(user.id, endpoint);
    
    if (removed) {
      console.log(`📱 Usuario ${user.name} desuscrito de push notifications`);
      res.json({ success: true, message: 'Unsubscribed successfully' });
    } else {
      res.status(404).json({ error: 'Subscription not found' });
    }
  } catch (err) {
    console.error('[Push] Unsubscription error:', err);
    res.status(500).json({ error: 'Unsubscription error' });
  }
});

// Obtener estadísticas de suscripciones (endpoint de admin/debug)
app.get('/api/push/stats', authMiddleware, (req, res) => {
  try {
    const stats = getSubscriptionStats();
    res.json(stats);
  } catch (err) {
    console.error('[Push] Stats error:', err);
    res.status(500).json({ error: 'Stats error' });
  }
});

// Endpoint de prueba para enviar notificación push
app.post('/api/push/test', authMiddleware, async (req, res) => {
  try {
    const user = await getUserByEmail(req.user.email);
    
    const testPayload = {
      title: '🧪 Notificación de Prueba',
      body: '¡Las push notifications funcionan correctamente!',
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-72.png',
      tag: 'test-notification',
      data: {
        type: 'test',
        url: '/',
        timestamp: Date.now()
      }
    };
    
    console.log(`🧪 Enviando notificación de prueba a usuario ${user.name} (ID: ${user.id})`);
    
    const { sendPushNotification } = require('./lib/push-notifications');
    const result = await sendPushNotification(user.id, testPayload);
    
    if (result.success) {
      console.log('✅ Notificación de prueba enviada exitosamente');
      res.json({ 
        success: true, 
        message: 'Test notification sent successfully',
        results: result.results
      });
    } else {
      console.log('⚠️  No se pudo enviar la notificación de prueba');
      res.status(400).json({ 
        success: false, 
        message: 'No active subscriptions found',
        results: result.results
      });
    }
  } catch (err) {
    console.error('[Push] Test notification error:', err);
    res.status(500).json({ error: 'Test notification error', details: err.message });
  }
});

// Favorites
app.get('/api/favorites', authMiddleware, async (req,res)=>{
  try{
    const user = await getUserByEmail(req.user.email);
    const favorites = await getFavorites(user.id);
    res.json({ favorites });
  }catch(e){
    console.error(e);
    res.status(500).json({ error: 'Database error' });
  }
});

app.post('/api/favorites', authMiddleware, async (req,res)=>{
  try{
    const { pokemon } = req.body;
    if(!pokemon) return res.status(400).json({ error: 'pokemon required' });
    const user = await getUserByEmail(req.user.email);
    await addFavorite(user.id, pokemon);
    const favorites = await getFavorites(user.id);
    res.json({ favorites });
  }catch(e){
    console.error(e);
    res.status(500).json({ error: 'Database error' });
  }
});

// Teams (simple CRUD)
app.get('/api/teams', authMiddleware, async (req,res)=>{
  try{
    const user = await getUserByEmail(req.user.email);
    const teams = await getTeams(user.id);
    res.json({ teams });
  }catch(e){
    console.error(e);
    res.status(500).json({ error: 'Database error' });
  }
});

app.post('/api/teams', authMiddleware, async (req,res)=>{
  try{
    const { team } = req.body;
    const user = await getUserByEmail(req.user.email);
    await addTeam(user.id, team);
    const teams = await getTeams(user.id);
    res.json({ teams });
  }catch(e){
    console.error(e);
    res.status(500).json({ error: 'Database error' });
  }
});

app.put('/api/teams/:idx', authMiddleware, async (req,res)=>{
  try{
    const idx = Number(req.params.idx);
    const { team } = req.body;
    const user = await getUserByEmail(req.user.email);
    await updateTeam(user.id, idx, team);
    const teams = await getTeams(user.id);
    res.json({ teams });
  }catch(e){
    console.error(e);
    res.status(500).json({ error: 'Database error' });
  }
});

app.delete('/api/teams/:idx', authMiddleware, async (req,res)=>{
  try{
    const idx = Number(req.params.idx);
    const user = await getUserByEmail(req.user.email);
    await deleteTeam(user.id, idx);
    const teams = await getTeams(user.id);
    res.json({ teams });
  }catch(e){
    console.error(e);
    res.status(500).json({ error: 'Database error' });
  }
});

// Friends: add by code
app.get('/api/friends', authMiddleware, async (req,res)=>{
  try{
    const user = await getUserByEmail(req.user.email);
    const friends = await getFriends(user.id);
    res.json({ friends });
  }catch(e){
    console.error(e);
    res.status(500).json({ error: 'Database error' });
  }
});

app.post('/api/friends/add', authMiddleware, apiFriendsLimiter, async (req,res)=>{
  try{
    const { code } = req.body;
    console.log('🔍 Intentando agregar amigo con código:', code);
    
    if(!code) return res.status(400).json({ error: 'code required' });
    
    const user = await getUserByEmail(req.user.email);
    console.log('👤 Usuario actual:', user.email, '| Código:', user.code);
    
    const friend = await getUserByCode(code);
    console.log('👥 Amigo encontrado:', friend ? friend.email : 'NO ENCONTRADO');
    
    if(!friend) return res.status(404).json({ error: 'No user with that code' });
    if(friend.id === user.id) return res.status(400).json({ error: 'Cannot add yourself' });
    
    console.log('✅ Agregando amigo:', user.email, '->', friend.email);
    await addFriend(user.id, friend.id);
    
    // Enviar push notification al amigo
    console.log('📤 Enviando push notification de amistad...');
    sendFriendRequestNotification(friend.id, user.name)
      .then(result => {
        if (result.success) {
          console.log('✅ Push notification enviada correctamente');
        } else {
          console.log('⚠️  Push notification no enviada (usuario sin suscripción)');
        }
      })
      .catch(err => console.error('❌ Error enviando push:', err));
    
    const friends = await getFriends(user.id);
    console.log('👥 Total amigos:', friends.length);
    res.json({ friends });
  }catch(e){
    console.error(e);
    res.status(500).json({ error: 'Database error' });
  }
});

// Simple battle simulation between two users' Pokémon
app.post('/api/battle/simulate', authMiddleware, async (req,res)=>{
  const { attacker, defender } = req.body; // each: { pokemon, stats }
  if(!attacker || !defender) return res.status(400).json({ error: 'attacker and defender required' });
  // Very simple: roll using base stats and type advantage multiplier
  function power(p){
    const stats = p.stats || {};
    return (stats.hp||50) + (stats.attack||50)*1.2 + (stats.defense||50)*0.8;
  }
  const aPower = power(attacker);
  const dPower = power(defender);
  const rnd = Math.random();
  const aScore = aPower * (0.8 + Math.random()*0.8);
  const dScore = dPower * (0.8 + Math.random()*0.8);
  const winner = aScore > dScore ? attacker.pokemon : defender.pokemon;
  res.json({ winner, aScore, dScore });
});

// ============================================
// BATALLAS EN LÍNEA
// ============================================

// Crear desafío de batalla
app.post('/api/battles/challenge', authMiddleware, async (req, res) => {
  try {
    const { opponentCode, teamIndex } = req.body;
    if (opponentCode === undefined || teamIndex === undefined) {
      return res.status(400).json({ error: 'opponentCode and teamIndex required' });
    }
    
    console.log('⚔️ Creando desafío:');
    console.log('  - Retador email:', req.user.email);
    console.log('  - Oponente código:', opponentCode);
    console.log('  - Team index:', teamIndex);
    
    const user = await getUserByEmail(req.user.email);
    console.log('  - Retador encontrado:', user?.email, '| ID:', user?.id);
    
    const opponent = await getUserByCode(opponentCode);
    console.log('  - Oponente encontrado:', opponent?.email, '| ID:', opponent?.id);
    
    if (!opponent) {
      return res.status(404).json({ error: 'Opponent not found' });
    }
    
    if (opponent.id === user.id) {
      return res.status(400).json({ error: 'Cannot challenge yourself' });
    }
    
    const battle = await createBattleChallenge(user.id, opponent.id, teamIndex);
    console.log('  - Desafío creado con ID:', battle?.id);
    
    // Notificar al oponente en tiempo real
    notifyUser(io, opponent.id, 'new-challenge', {
      battleId: battle.id,
      challengerName: user.name,
      challengerEmail: user.email,
      message: `${user.name} te ha desafiado a una batalla!`
    });
    
    // Enviar push notification al oponente
    console.log('📤 Enviando push notification de batalla...');
    sendBattleChallengeNotification(opponent.id, user.name, battle.id)
      .then(result => {
        if (result.success) {
          console.log('✅ Push notification de batalla enviada correctamente');
        } else {
          console.log('⚠️  Push notification no enviada (usuario sin suscripción)');
        }
      })
      .catch(err => console.error('❌ Error enviando push:', err));
    
    res.json({ battle, message: 'Challenge sent!' });
  } catch (e) {
    console.error('Challenge error:', e);
    res.status(500).json({ error: 'Database error' });
  }
});

// Obtener desafíos pendientes
app.get('/api/battles/challenges', authMiddleware, async (req, res) => {
  try {
    const user = await getUserByEmail(req.user.email);
    console.log('🔍 Usuario obteniendo desafíos:', user?.email, '| ID:', user?.id);
    
    const challenges = await getPendingChallenges(user.id);
    console.log('📋 Desafíos encontrados:', challenges.length);
    
    // Debug: mostrar desafíos pendientes para este usuario
    const pendingForUser = challenges.filter(c => c.status === 'pending' && c.opponent_email === user.email);
    console.log('📨 Desafíos pendientes para este usuario:', pendingForUser.length);
    
    res.json({ challenges });
  } catch (e) {
    console.error('Get challenges error:', e);
    res.status(500).json({ error: 'Database error' });
  }
});

// Aceptar desafío
app.post('/api/battles/:battleId/accept', authMiddleware, async (req, res) => {
  try {
    const { battleId } = req.params;
    const { teamIndex } = req.body;
    
    if (teamIndex === undefined || teamIndex === null) {
      return res.status(400).json({ error: 'Debes seleccionar un equipo para aceptar el desafío' });
    }
    
    const user = await getUserByEmail(req.user.email);
    console.log(`✅ Usuario aceptando desafío:`, user.name, '| ID:', user.id);
    
    const battle = await getBattleById(battleId);
    console.log(`🎮 Batalla a aceptar:`, battle.id, '| Retador:', battle.challenger_name, '| Oponente:', battle.opponent_name);
    
    if (!battle || battle.opponent_id !== user.id) {
      return res.status(403).json({ error: 'No autorizado - solo el oponente puede aceptar' });
    }
    
    console.log(`🎮 Aceptando con equipo index:`, teamIndex);
    await acceptBattleChallenge(battleId, teamIndex);
    
    // Notificar al retador que su desafío fue aceptado
    notifyUser(io, battle.challenger_id, 'challenge-accepted', {
      battleId: battle.id,
      opponentName: user.name,
      opponentEmail: user.email,
      message: `${user.name} ha aceptado tu desafío!`
    });
    
    // Enviar push notification al retador
    console.log('📤 Enviando push notification de batalla aceptada...');
    sendBattleAcceptedNotification(battle.challenger_id, user.name, battle.id)
      .then(result => {
        if (result.success) {
          console.log('✅ Push notification de batalla aceptada enviada correctamente');
        } else {
          console.log('⚠️  Push notification no enviada (usuario sin suscripción)');
        }
      })
      .catch(err => console.error('❌ Error enviando push:', err));
    
    res.json({ message: 'Challenge accepted! Battle starting...' });
  } catch (e) {
    console.error('Accept challenge error:', e);
    res.status(500).json({ error: 'Database error' });
  }
});

// Rechazar desafío
app.post('/api/battles/:battleId/reject', authMiddleware, async (req, res) => {
  try {
    const { battleId } = req.params;
    const user = await getUserByEmail(req.user.email);
    const battle = await getBattleById(battleId);
    
    if (!battle || battle.opponent_id !== user.id) {
      return res.status(403).json({ error: 'Not authorized' });
    }
    
    await rejectBattleChallenge(battleId);
    
    // Notificar al retador que su desafío fue rechazado
    notifyUser(io, battle.challenger_id, 'challenge-rejected', {
      battleId: battle.id,
      opponentName: user.name,
      opponentEmail: user.email,
      message: `${user.name} ha rechazado tu desafío`
    });
    
    res.json({ message: 'Challenge rejected' });
  } catch (e) {
    console.error('Reject challenge error:', e);
    res.status(500).json({ error: 'Database error' });
  }
});

// Cancelar desafio (solo el retador)
app.post('/api/battles/:battleId/cancel', authMiddleware, async (req, res) => {
  try {
    const { battleId } = req.params;
    const user = await getUserByEmail(req.user.email);
    const battle = await getBattleById(battleId);
    
    if (!battle || battle.challenger_id !== user.id) {
      return res.status(403).json({ error: 'Not authorized' });
    }
    
    if (battle.status !== 'pending') {
      return res.status(400).json({ error: 'Only pending challenges can be canceled' });
    }
    
    await updateBattleStatus(battleId, 'rejected');
    res.json({ message: 'Challenge canceled' });
  } catch (e) {
    console.error('Cancel challenge error:', e);
    res.status(500).json({ error: 'Database error' });
  }
});

// Obtener estado de batalla
app.get('/api/battles/:battleId', authMiddleware, async (req, res) => {
  try {
    const { battleId } = req.params;
    const user = await getUserByEmail(req.user.email);
    const battle = await getBattleById(battleId);
    
    if (!battle) {
      return res.status(404).json({ error: 'Battle not found' });
    }
    
    if (battle.challenger_id !== user.id && battle.opponent_id !== user.id) {
      return res.status(403).json({ error: 'Not authorized' });
    }
    
    // Obtener equipos de ambos jugadores
    const challengerTeams = await getTeams(battle.challenger_id);
    const opponentTeams = await getTeams(battle.opponent_id);
    
    res.json({
      battle,
      challengerTeam: challengerTeams[battle.challenger_team_index],
      opponentTeam: battle.opponent_team_index !== null ? opponentTeams[battle.opponent_team_index] : null,
      isChallenger: battle.challenger_id === user.id
    });
  } catch (e) {
    console.error('Get battle error:', e);
    res.status(500).json({ error: 'Database error' });
  }
});

// Ejecutar batalla automáticamente
app.post('/api/battles/:battleId/execute', authMiddleware, async (req, res) => {
  try {
    const { battleId } = req.params;
    const user = await getUserByEmail(req.user.email);
    const battle = await getBattleById(battleId);
    
    if (!battle) {
      return res.status(404).json({ error: 'Battle not found' });
    }
    
    // Verificar que el usuario es parte de la batalla
    if (battle.challenger_user_id !== user.id && battle.opponent_user_id !== user.id) {
      return res.status(403).json({ error: 'Not authorized' });
    }
    
    // Si la batalla ya está completada o en progreso, retornar el resultado existente
    if (battle.status === 'completed' || battle.status === 'in_progress') {
      let battleResult = battle.battle_result || {};
      // Asegurar que battle_result esté parseado correctamente
      if (typeof battleResult === 'string') {
        battleResult = JSON.parse(battleResult);
      }
      return res.json({ 
        battle_result: battleResult,
        winner_id: battle.winner_id,
        status: battle.status,
        message: battle.status === 'completed' ? 'Battle already completed' : 'Battle in progress'
      });
    }
    
    if (battle.status !== 'accepted') {
      return res.status(400).json({ error: 'Battle not ready', status: battle.status });
    }
    
    // Marcar batalla como en progreso con lock condicional para evitar ejecuciones múltiples
    const lockResult = await updateBattleStatus(battleId, 'in_progress', 'accepted');
    
    if (!lockResult) {
      // Otro proceso ya tomó la batalla, intentar obtener resultado
      const updatedBattle = await getBattleById(battleId);
      return res.json({ 
        battle_result: updatedBattle.battle_result || {},
        winner_id: updatedBattle.winner_id,
        status: updatedBattle.status,
        message: 'Battle being executed by another process'
      });
    }
    
    // Ejecutar la batalla usando la función de db.js
    const result = await executeBattle(battleId);
    
    res.json({ 
      ...result,
      message: `${result.battle_result.winner_name} wins!`
    });
  } catch (e) {
    console.error('Execute battle error:', e);
    res.status(500).json({ error: 'Database error', details: e.message });
  }
});

// Obtener resultado de batalla (para sincronización)
app.get('/api/battles/:battleId/result', authMiddleware, async (req, res) => {
  try {
    const { battleId } = req.params;
    const user = await getUserByEmail(req.user.email);
    const battle = await getBattleById(battleId);
    
    if (!battle) {
      return res.status(404).json({ error: 'Battle not found' });
    }
    
    // Verificar que el usuario es parte de la batalla
    if (battle.challenger_user_id !== user.id && battle.opponent_user_id !== user.id) {
      return res.status(403).json({ error: 'Not authorized' });
    }
    
    let battleResult = battle.battle_result || null;
    // Asegurar que battle_result esté parseado correctamente
    if (battleResult && typeof battleResult === 'string') {
      battleResult = JSON.parse(battleResult);
    }
    
    res.json({ 
      status: battle.status,
      battle_result: battleResult,
      winner_id: battle.winner_id,
      completed_at: battle.completed_at
    });
  } catch (e) {
    console.error('Get battle result error:', e);
    res.status(500).json({ error: 'Database error' });
  }
});

// Obtener historial de batallas
app.get('/api/battles/history', authMiddleware, async (req, res) => {
  try {
    const user = await getUserByEmail(req.user.email);
    const history = await getUserBattleHistory(user.id);
    res.json({ history });
  } catch (e) {
    console.error('Get history error:', e);
    res.status(500).json({ error: 'Database error' });
  }
});

// Configurar Socket.io para batallas en tiempo real
setupBattleSocket(io);

server.listen(PORT, ()=> console.log('🚀 BFF listening on', PORT));
