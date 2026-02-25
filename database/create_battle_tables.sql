-- Script para crear las tablas de batallas en línea
-- Ejecutar esto en tu base de datos PostgreSQL

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

-- Verificar que se crearon las tablas
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name LIKE 'battle%';
