

-- =======================
-- TABLA: users
-- =======================
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    code VARCHAR(10) UNIQUE NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =======================
-- TABLA: favorites
-- =======================
CREATE TABLE IF NOT EXISTS favorites (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    pokemon_id INTEGER NOT NULL,
    pokemon_name VARCHAR(100),
    pokemon_sprite TEXT,
    pokemon_types TEXT, -- JSON array como texto: ["fire", "flying"]
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, pokemon_id)
);

-- =======================
-- TABLA: teams
-- =======================
CREATE TABLE IF NOT EXISTS teams (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    team_name VARCHAR(255) NOT NULL,
    pokemons TEXT NOT NULL, -- JSON array de pokémon: [{"id":1,"name":"bulbasaur",...}]
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =======================
-- TABLA: friends
-- =======================
CREATE TABLE IF NOT EXISTS friends (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    friend_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, friend_id),
    CHECK (user_id != friend_id)
);

-- =======================
-- ÍNDICES para mejorar performance
-- =======================
CREATE INDEX IF NOT EXISTS idx_favorites_user_id ON favorites(user_id);
CREATE INDEX IF NOT EXISTS idx_teams_user_id ON teams(user_id);
CREATE INDEX IF NOT EXISTS idx_friends_user_id ON friends(user_id);
CREATE INDEX IF NOT EXISTS idx_friends_friend_id ON friends(friend_id);
CREATE INDEX IF NOT EXISTS idx_users_code ON users(code);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- =======================
-- TABLAS DE BATALLAS EN LÍNEA
-- =======================

-- Tabla de batallas/desafíos
CREATE TABLE IF NOT EXISTS battle_challenges (
  id SERIAL PRIMARY KEY,
  challenger_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  opponent_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  challenger_team_index INTEGER NOT NULL,
  opponent_team_index INTEGER,
  status VARCHAR(20) DEFAULT 'pending', -- pending, accepted, rejected, in_progress, completed
  current_turn INTEGER DEFAULT 0,
  turn_count INTEGER DEFAULT 0,
  battle_logs TEXT,
  winner_id INTEGER REFERENCES users(id),
  battle_result TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  accepted_at TIMESTAMP,
  completed_at TIMESTAMP,
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Tabla de acciones de batalla (para batallas por turnos)
CREATE TABLE IF NOT EXISTS battle_actions (
  id SERIAL PRIMARY KEY,
  battle_id INTEGER NOT NULL REFERENCES battle_challenges(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  turn_number INTEGER NOT NULL,
  action_type VARCHAR(50) NOT NULL, -- attack, switch, item, etc.
  action_data TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Índices para batallas
CREATE INDEX IF NOT EXISTS idx_battle_status ON battle_challenges(status);
CREATE INDEX IF NOT EXISTS idx_battle_users ON battle_challenges(challenger_id, opponent_id);
CREATE INDEX IF NOT EXISTS idx_battle_actions_battle ON battle_actions(battle_id, turn_number);

-- =======================
-- DATOS DE PRUEBA (opcional)
-- =======================
-- Usuario de ejemplo (password: "123456" hasheado con bcrypt)
-- INSERT INTO users (email, password, name, code) 
-- VALUES ('test@pokedex.com', '$2a$10$XqKvVqZ9YJ8kGJ8QJ8QJ8e8QJ8QJ8QJ8QJ8QJ8QJ8QJ8QJ8QJ8', 'Test User', 'TEST123');

-- =======================
-- VERIFICACIÓN
-- =======================
-- Ver todas las tablas creadas:
-- SELECT table_name FROM information_schema.tables WHERE table_schema = 'public';

-- Contar registros:
-- SELECT COUNT(*) FROM users;
-- SELECT COUNT(*) FROM favorites;
-- SELECT COUNT(*) FROM teams;
-- SELECT COUNT(*) FROM friends;
