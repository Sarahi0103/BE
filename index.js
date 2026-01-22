require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const axios = require('axios');
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const session = require('express-session');
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
  addFriend
} = require('./lib/db');

const app = express();

// CORS configuration for OAuth
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true
}));

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
        await createUser(user);
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
app.post('/auth/register', async (req,res)=>{
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
  await createUser(user);
  const token = generateToken({ email });
  res.json({ token, user: { email, name: user.name, code: user.code } });
});

app.post('/auth/login', async (req,res)=>{
  const { email, password } = req.body;
  if(!email || !password) return res.status(400).json({ error: 'Email and password required' });
  const user = await getUserByEmail(email);
  if(!user) return res.status(400).json({ error: 'Invalid credentials' });
  if(!user.password) return res.status(400).json({ error: 'Please use Google Sign-In for this account' });
  const ok = await bcrypt.compare(password, user.password);
  if(!ok) return res.status(400).json({ error: 'Invalid credentials' });
  const token = generateToken({ email });
  res.json({ token, user: { email: user.email, name: user.name, code: user.code } });
});

// Google OAuth Routes
app.get('/auth/google',
  passport.authenticate('google', { scope: ['profile', 'email'] })
);

app.get('/auth/google/callback',
  passport.authenticate('google', { failureRedirect: '/login' }),
  (req, res) => {
    // Successful authentication
    const token = generateToken({ email: req.user.email });
    const user = { email: req.user.email, name: req.user.name, code: req.user.code };
    
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

app.post('/api/friends/add', authMiddleware, async (req,res)=>{
  try{
    const { code } = req.body;
    if(!code) return res.status(400).json({ error: 'code required' });
    const user = await getUserByEmail(req.user.email);
    const friend = await getUserByCode(code);
    if(!friend) return res.status(404).json({ error: 'No user with that code' });
    if(friend.id === user.id) return res.status(400).json({ error: 'Cannot add yourself' });
    await addFriend(user.id, friend.id);
    const friends = await getFriends(user.id);
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

app.listen(PORT, ()=> console.log('BFF listening on', PORT));
