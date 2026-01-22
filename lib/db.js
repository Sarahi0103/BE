const { Pool } = require('pg');

// Configuración de PostgreSQL
const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'pokedex',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || '123',
  max: 20, // Máximo de conexiones en el pool
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// Verificar conexión (solo una vez al inicio)
let connected = false;
pool.on('connect', () => {
  if (!connected) {
    console.log('✅ Conectado a PostgreSQL');
    connected = true;
  }
});

pool.on('error', (err) => {
  console.error('❌ Error en PostgreSQL:', err);
  process.exit(-1);
});

// ============================================
// USUARIOS
// ============================================

async function getUserByEmail(email) {
  const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
  return result.rows[0] || null;
}

async function getUserByCode(code) {
  const result = await pool.query('SELECT * FROM users WHERE code = $1', [code]);
  return result.rows[0] || null;
}

async function createUser(user) {
  const { email, password, name, code } = user;
  const result = await pool.query(
    'INSERT INTO users (email, password, name, code) VALUES ($1, $2, $3, $4) RETURNING *',
    [email, password, name, code]
  );
  return result.rows[0];
}

async function updateUser(email, patch) {
  const fields = Object.keys(patch);
  const values = Object.values(patch);
  const setClause = fields.map((f, i) => `${f} = $${i + 1}`).join(', ');
  
  const result = await pool.query(
    `UPDATE users SET ${setClause} WHERE email = $${fields.length + 1} RETURNING *`,
    [...values, email]
  );
  return result.rows[0] || null;
}

// ============================================
// FAVORITOS
// ============================================

async function getFavorites(userId) {
  const result = await pool.query(
    'SELECT * FROM favorites WHERE user_id = $1 ORDER BY created_at DESC',
    [userId]
  );
  
  return result.rows.map(row => ({
    id: row.pokemon_id,
    name: row.pokemon_name,
    sprite: row.pokemon_sprite,
    types: row.pokemon_types ? JSON.parse(row.pokemon_types) : []
  }));
}

async function addFavorite(userId, pokemon) {
  const { id, name, sprite, types } = pokemon;
  const typesJson = JSON.stringify(types || []);
  
  const result = await pool.query(
    'INSERT INTO favorites (user_id, pokemon_id, pokemon_name, pokemon_sprite, pokemon_types) VALUES ($1, $2, $3, $4, $5) ON CONFLICT (user_id, pokemon_id) DO NOTHING RETURNING *',
    [userId, id, name, sprite, typesJson]
  );
  return result.rows[0];
}

async function removeFavorite(userId, pokemonId) {
  await pool.query(
    'DELETE FROM favorites WHERE user_id = $1 AND pokemon_id = $2',
    [userId, pokemonId]
  );
  return true;
}

// ============================================
// EQUIPOS
// ============================================

async function getTeams(userId) {
  const result = await pool.query(
    'SELECT * FROM teams WHERE user_id = $1 ORDER BY created_at DESC',
    [userId]
  );
  
  return result.rows.map(row => ({
    name: row.team_name,
    pokemons: JSON.parse(row.pokemons)
  }));
}

async function addTeam(userId, teamData) {
  const { name, pokemons } = teamData;
  const pokemonsJson = JSON.stringify(pokemons || []);
  
  const result = await pool.query(
    'INSERT INTO teams (user_id, team_name, pokemons) VALUES ($1, $2, $3) RETURNING *',
    [userId, name, pokemonsJson]
  );
  return result.rows[0];
}

async function updateTeam(userId, teamIndex, teamData) {
  const { name, pokemons } = teamData;
  const pokemonsJson = JSON.stringify(pokemons || []);
  
  // Obtener el ID del equipo basado en el índice
  const teams = await pool.query(
    'SELECT id FROM teams WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1 OFFSET $2',
    [userId, teamIndex]
  );
  
  if (teams.rows.length === 0) return null;
  
  const result = await pool.query(
    'UPDATE teams SET team_name = $1, pokemons = $2 WHERE id = $3 RETURNING *',
    [name, pokemonsJson, teams.rows[0].id]
  );
  return result.rows[0];
}

async function deleteTeam(userId, teamIndex) {
  // Obtener el ID del equipo basado en el índice
  const teams = await pool.query(
    'SELECT id FROM teams WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1 OFFSET $2',
    [userId, teamIndex]
  );
  
  if (teams.rows.length === 0) return false;
  
  await pool.query('DELETE FROM teams WHERE id = $1', [teams.rows[0].id]);
  return true;
}

// ============================================
// AMIGOS
// ============================================

async function getFriends(userId) {
  const result = await pool.query(
    `SELECT u.id, u.name, u.email, u.code 
     FROM friends f 
     JOIN users u ON f.friend_id = u.id 
     WHERE f.user_id = $1 
     ORDER BY f.created_at DESC`,
    [userId]
  );
  
  return result.rows;
}

async function addFriend(userId, friendId) {
  // Agregar amistad bidireccional
  await pool.query(
    'INSERT INTO friends (user_id, friend_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
    [userId, friendId]
  );
  await pool.query(
    'INSERT INTO friends (user_id, friend_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
    [friendId, userId]
  );
  return true;
}

module.exports = {
  pool,
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
};
