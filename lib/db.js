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
  console.log('🔍 Buscando usuario con código:', code);
  // Usar ILIKE para búsqueda case-insensitive
  const result = await pool.query('SELECT * FROM users WHERE code ILIKE $1', [code]);
  console.log('📊 Resultados encontrados:', result.rows.length);
  if (result.rows.length > 0) {
    console.log('✅ Usuario encontrado:', result.rows[0].email);
  }
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

// ============================================
// BATALLAS EN LÍNEA
// ============================================

async function createBattleChallenge(challengerId, opponentId, teamIndex) {
  // Evitar desafios duplicados pendientes entre los mismos usuarios
  const existing = await pool.query(
    `SELECT * FROM battle_challenges 
     WHERE challenger_id = $1 AND opponent_id = $2 AND status = 'pending'
     ORDER BY created_at DESC
     LIMIT 1`,
    [challengerId, opponentId]
  );

  if (existing.rows[0]) {
    return existing.rows[0];
  }

  const result = await pool.query(
    `INSERT INTO battle_challenges (challenger_id, opponent_id, challenger_team_index, status) 
     VALUES ($1, $2, $3, 'pending') RETURNING *`,
    [challengerId, opponentId, teamIndex]
  );
  return result.rows[0];
}

async function getPendingChallenges(userId) {
  const result = await pool.query(
    `SELECT bc.*, 
            u1.id as challenger_user_id, u1.name as challenger_name, u1.code as challenger_code, u1.email as challenger_email,
            u2.id as opponent_user_id, u2.name as opponent_name, u2.code as opponent_code, u2.email as opponent_email
     FROM battle_challenges bc
     JOIN users u1 ON bc.challenger_id = u1.id
     JOIN users u2 ON bc.opponent_id = u2.id
     WHERE (bc.challenger_id = $1 OR bc.opponent_id = $1) 
     AND bc.status IN ('pending', 'accepted', 'in_progress', 'completed')
     ORDER BY bc.created_at DESC
     LIMIT 50`,
    [userId]
  );
  
  // Parsear battle_result si existe
  return result.rows.map(row => {
    if (row.battle_result && typeof row.battle_result === 'string') {
      row.battle_result = JSON.parse(row.battle_result);
    }
    return row;
  });
}

async function acceptBattleChallenge(battleId, opponentTeamIndex) {
  console.log(`💾 Guardando en BD - Battle ID: ${battleId}, Opponent Team Index: ${opponentTeamIndex}`);
  
  const result = await pool.query(
    `UPDATE battle_challenges 
     SET status = 'accepted', opponent_team_index = $1, accepted_at = NOW()
     WHERE id = $2 RETURNING *`,
    [opponentTeamIndex, battleId]
  );
  
  const updated = result.rows[0];
  console.log(`✅ Batalla actualizada - Status: ${updated.status}, Opponent Team Index: ${updated.opponent_team_index}`);
  
  return updated;
}

async function rejectBattleChallenge(battleId) {
  const result = await pool.query(
    `UPDATE battle_challenges 
     SET status = 'rejected'
     WHERE id = $1 RETURNING *`,
    [battleId]
  );
  return result.rows[0];
}

async function getBattleById(battleId) {
  const result = await pool.query(
    `SELECT bc.*, 
            u1.name as challenger_name, u1.id as challenger_user_id,
            u2.name as opponent_name, u2.id as opponent_user_id
     FROM battle_challenges bc
     JOIN users u1 ON bc.challenger_id = u1.id
     JOIN users u2 ON bc.opponent_id = u2.id
     WHERE bc.id = $1`,
    [battleId]
  );
  
  const battle = result.rows[0];
  if (battle && battle.battle_result) {
    // Asegurar que battle_result esté parseado como objeto
    if (typeof battle.battle_result === 'string') {
      battle.battle_result = JSON.parse(battle.battle_result);
    }
  }
  return battle;
}

async function updateBattleState(battleId, stateData) {
  const { currentTurn, turnCount, logs, status } = stateData;
  const result = await pool.query(
    `UPDATE battle_challenges 
     SET current_turn = $1, turn_count = $2, battle_logs = $3, status = $4, updated_at = NOW()
     WHERE id = $5 RETURNING *`,
    [currentTurn, turnCount, JSON.stringify(logs), status, battleId]
  );
  return result.rows[0];
}

async function updateBattleStatus(battleId, status, requiredCurrentStatus = null) {
  let query = `UPDATE battle_challenges 
     SET status = $1, updated_at = NOW()
     WHERE id = $2`;
  let params = [status, battleId];
  
  if (requiredCurrentStatus) {
    query += ` AND status = $3`;
    params.push(requiredCurrentStatus);
  }
  
  query += ` RETURNING *`;
  
  const result = await pool.query(query, params);
  return result.rows[0]; // null si no se actualizó (lock falló)
}

async function submitBattleAction(battleId, userId, action) {
  const result = await pool.query(
    `INSERT INTO battle_actions (battle_id, user_id, action_type, action_data, turn_number)
     SELECT $1, $2, $3, $4, COALESCE(turn_count, 0) + 1
     FROM battle_challenges WHERE id = $1
     RETURNING *`,
    [battleId, userId, action.type, JSON.stringify(action.data)]
  );
  return result.rows[0];
}

async function getBattleActions(battleId, turnNumber) {
  const result = await pool.query(
    `SELECT ba.*, u.name as user_name
     FROM battle_actions ba
     JOIN users u ON ba.user_id = u.id
     WHERE ba.battle_id = $1 AND ba.turn_number = $2
     ORDER BY ba.created_at ASC`,
    [battleId, turnNumber]
  );
  return result.rows;
}

async function finalizeBattle(battleId, winnerId, battleResult) {
  const result = await pool.query(
    `UPDATE battle_challenges 
     SET status = 'completed', winner_id = $1, battle_result = $2, completed_at = NOW()
     WHERE id = $3 RETURNING *`,
    [winnerId, JSON.stringify(battleResult), battleId]
  );
  return result.rows[0];
}

async function getUserBattleHistory(userId) {
  const result = await pool.query(
    `SELECT bc.*, 
            u1.name as challenger_name,
            u2.name as opponent_name,
            uw.name as winner_name
     FROM battle_challenges bc
     JOIN users u1 ON bc.challenger_id = u1.id
     JOIN users u2 ON bc.opponent_id = u2.id
     LEFT JOIN users uw ON bc.winner_id = uw.id
     WHERE (bc.challenger_id = $1 OR bc.opponent_id = $1) 
     AND bc.status = 'completed'
     ORDER BY bc.completed_at DESC
     LIMIT 20`,
    [userId]
  );
  return result.rows;
}

// Ejecutar batalla automáticamente con sistema de turnos
async function executeBattle(battleId) {
  // Obtener la batalla
  const battle = await getBattleById(battleId);
  if (!battle) {
    throw new Error('Batalla no encontrada');
  }

  // Permitir ejecución si está en 'accepted' o 'in_progress'
  if (battle.status !== 'accepted' && battle.status !== 'in_progress') {
    throw new Error(`La batalla debe estar en estado "accepted" o "in_progress", estado actual: ${battle.status}`);
  }

  // Validar que ambos equipos estén seleccionados
  if (battle.challenger_team_index === null || battle.challenger_team_index === undefined) {
    throw new Error('El retador no ha seleccionado un equipo');
  }
  
  if (battle.opponent_team_index === null || battle.opponent_team_index === undefined) {
    throw new Error('El oponente no ha seleccionado un equipo');
  }

  // Obtener todos los equipos de ambos usuarios
  const challengerTeams = await getTeams(battle.challenger_id);
  const opponentTeams = await getTeams(battle.opponent_id);
  
  console.log(`⚔️ Ejecutando batalla ${battleId}:`);
  console.log(`  - Retador: ${battle.challenger_name} (ID: ${battle.challenger_id}, Team Index: ${battle.challenger_team_index})`);
  console.log(`  - Oponente: ${battle.opponent_name} (ID: ${battle.opponent_id}, Team Index: ${battle.opponent_team_index})`);
  console.log(`  - Equipos retador:`, challengerTeams.length);
  console.log(`  - Equipos oponente:`, opponentTeams.length);

  // Obtener el equipo específico por índice
  const team1 = challengerTeams[battle.challenger_team_index];
  const team2 = opponentTeams[battle.opponent_team_index];

  if (!team1) {
    throw new Error(`Equipo del retador no encontrado (índice: ${battle.challenger_team_index})`);
  }
  if (!team2) {
    throw new Error(`Equipo del oponente no encontrado (índice: ${battle.opponent_team_index})`);
  }
  
  console.log(`  - Equipo 1 (${team1.name}):`, team1.pokemons?.map(p => p.name).join(', '));
  console.log(`  - Equipo 2 (${team2.name}):`, team2.pokemons?.map(p => p.name).join(', '));

  // Los equipos ya vienen con el formato correcto { name, pokemons }
  const team1Pokemon = team1.pokemons;
  const team2Pokemon = team2.pokemons;

  // Validar que los equipos no estén vacíos
  if (!team1Pokemon || team1Pokemon.length === 0) {
    throw new Error(`El equipo del retador está vacío`);
  }
  if (!team2Pokemon || team2Pokemon.length === 0) {
    throw new Error(`El equipo del oponente está vacío`);
  }

  // Sistema de batalla por turnos
  const battleLog = [];
  const turns = [];
  
  battleLog.push({
    type: 'start',
    message: `⚔️ ¡Batalla entre ${battle.challenger_name} y ${battle.opponent_name}!`,
    timestamp: Date.now()
  });

  // Preparar Pokémon para batalla (clonar con HP actual)
  const preparePokemon = (pokemon, trainer) => {
    // Función helper para obtener stat de forma segura
    const getStat = (statName, defaultValue = 50) => {
      if (!pokemon.stats || !Array.isArray(pokemon.stats)) {
        return defaultValue;
      }
      const stat = pokemon.stats.find(s => s.stat?.name === statName);
      return stat?.base_stat || defaultValue;
    };

    return {
      ...pokemon,
      currentHP: getStat('hp', 100),
      maxHP: getStat('hp', 100),
      attack: getStat('attack', 50),
      defense: getStat('defense', 50),
      speed: getStat('speed', 50),
      spAttack: getStat('special-attack', 50),
      spDefense: getStat('special-defense', 50),
      trainer: trainer,
      fainted: false
    };
  };

  let pokemon1 = team1Pokemon.map(p => preparePokemon(p, battle.challenger_name));
  let pokemon2 = team2Pokemon.map(p => preparePokemon(p, battle.opponent_name));

  let currentPokemon1Index = 0;
  let currentPokemon2Index = 0;
  let turnNumber = 0;
  const MAX_TURNS = 100; // Límite de seguridad

  // Batalla por turnos
  while (currentPokemon1Index < pokemon1.length && 
         currentPokemon2Index < pokemon2.length && 
         turnNumber < MAX_TURNS) {
    
    turnNumber++;
    const attacker1 = pokemon1[currentPokemon1Index];
    const attacker2 = pokemon2[currentPokemon2Index];

    // Determinar quién ataca primero basado en velocidad
    const firstAttacker = attacker1.speed >= attacker2.speed ? 
      { pokemon: attacker1, opponent: attacker2, isTeam1: true } : 
      { pokemon: attacker2, opponent: attacker1, isTeam1: false };
    
    const secondAttacker = attacker1.speed >= attacker2.speed ? 
      { pokemon: attacker2, opponent: attacker1, isTeam1: false } : 
      { pokemon: attacker1, opponent: attacker2, isTeam1: true };

    // Turno del primer atacante
    if (!firstAttacker.pokemon.fainted && !firstAttacker.opponent.fainted) {
      const damage = calculateDamage(firstAttacker.pokemon, firstAttacker.opponent);
      firstAttacker.opponent.currentHP -= damage;
      
      turns.push({
        turn: turnNumber,
        attacker: firstAttacker.pokemon.name,
        defender: firstAttacker.opponent.name,
        damage: damage,
        remainingHP: Math.max(0, firstAttacker.opponent.currentHP)
      });

      battleLog.push({
        type: 'attack',
        turn: turnNumber,
        message: `${firstAttacker.pokemon.name} ataca a ${firstAttacker.opponent.name} causando ${damage} de daño!`,
        attacker: {
          name: firstAttacker.pokemon.name,
          id: firstAttacker.pokemon.id,
          sprite: firstAttacker.pokemon.sprite,
          currentHP: firstAttacker.pokemon.currentHP,
          maxHP: firstAttacker.pokemon.maxHP,
          attack: firstAttacker.pokemon.attack,
          defense: firstAttacker.pokemon.defense,
          speed: firstAttacker.pokemon.speed
        },
        defender: {
          name: firstAttacker.opponent.name,
          id: firstAttacker.opponent.id,
          sprite: firstAttacker.opponent.sprite,
          currentHP: Math.max(0, firstAttacker.opponent.currentHP),
          maxHP: firstAttacker.opponent.maxHP,
          attack: firstAttacker.opponent.attack,
          defense: firstAttacker.opponent.defense,
          speed: firstAttacker.opponent.speed
        },
        damage: damage,
        timestamp: Date.now()
      });

      if (firstAttacker.opponent.currentHP <= 0) {
        firstAttacker.opponent.fainted = true;
        firstAttacker.opponent.currentHP = 0;
        
        battleLog.push({
          type: 'faint',
          message: `¡${firstAttacker.opponent.name} ha sido debilitado!`,
          pokemon: firstAttacker.opponent.name,
          timestamp: Date.now()
        });

        // Siguiente Pokémon
        if (firstAttacker.isTeam1) {
          currentPokemon2Index++;
          if (currentPokemon2Index < pokemon2.length) {
            battleLog.push({
              type: 'switch',
              message: `${battle.opponent_name} envía a ${pokemon2[currentPokemon2Index].name}!`,
              pokemon: pokemon2[currentPokemon2Index].name,
              timestamp: Date.now()
            });
          }
        } else {
          currentPokemon1Index++;
          if (currentPokemon1Index < pokemon1.length) {
            battleLog.push({
              type: 'switch',
              message: `${battle.challenger_name} envía a ${pokemon1[currentPokemon1Index].name}!`,
              pokemon: pokemon1[currentPokemon1Index].name,
              timestamp: Date.now()
            });
          }
        }
        continue;
      }
    }

    // Turno del segundo atacante (si sigue vivo)
    if (!secondAttacker.pokemon.fainted && !secondAttacker.opponent.fainted) {
      const damage = calculateDamage(secondAttacker.pokemon, secondAttacker.opponent);
      secondAttacker.opponent.currentHP -= damage;
      
      turns.push({
        turn: turnNumber,
        attacker: secondAttacker.pokemon.name,
        defender: secondAttacker.opponent.name,
        damage: damage,
        remainingHP: Math.max(0, secondAttacker.opponent.currentHP)
      });

      battleLog.push({
        type: 'attack',
        turn: turnNumber,
        message: `${secondAttacker.pokemon.name} ataca a ${secondAttacker.opponent.name} causando ${damage} de daño!`,
        attacker: {
          name: secondAttacker.pokemon.name,
          id: secondAttacker.pokemon.id,
          sprite: secondAttacker.pokemon.sprite,
          currentHP: secondAttacker.pokemon.currentHP,
          maxHP: secondAttacker.pokemon.maxHP,
          attack: secondAttacker.pokemon.attack,
          defense: secondAttacker.pokemon.defense,
          speed: secondAttacker.pokemon.speed
        },
        defender: {
          name: secondAttacker.opponent.name,
          id: secondAttacker.opponent.id,
          sprite: secondAttacker.opponent.sprite,
          currentHP: Math.max(0, secondAttacker.opponent.currentHP),
          maxHP: secondAttacker.opponent.maxHP,
          attack: secondAttacker.opponent.attack,
          defense: secondAttacker.opponent.defense,
          speed: secondAttacker.opponent.speed
        },
        damage: damage,
        timestamp: Date.now()
      });

      if (secondAttacker.opponent.currentHP <= 0) {
        secondAttacker.opponent.fainted = true;
        secondAttacker.opponent.currentHP = 0;
        
        battleLog.push({
          type: 'faint',
          message: `¡${secondAttacker.opponent.name} ha sido debilitado!`,
          pokemon: secondAttacker.opponent.name,
          timestamp: Date.now()
        });

        // Siguiente Pokémon
        if (secondAttacker.isTeam1) {
          currentPokemon2Index++;
          if (currentPokemon2Index < pokemon2.length) {
            battleLog.push({
              type: 'switch',
              message: `${battle.opponent_name} envía a ${pokemon2[currentPokemon2Index].name}!`,
              pokemon: pokemon2[currentPokemon2Index].name,
              timestamp: Date.now()
            });
          }
        } else {
          currentPokemon1Index++;
          if (currentPokemon1Index < pokemon1.length) {
            battleLog.push({
              type: 'switch',
              message: `${battle.challenger_name} envía a ${pokemon1[currentPokemon1Index].name}!`,
              pokemon: pokemon1[currentPokemon1Index].name,
              timestamp: Date.now()
            });
          }
        }
      }
    }
  }

  // Determinar ganador
  const team1Alive = pokemon1.filter(p => !p.fainted).length;
  const team2Alive = pokemon2.filter(p => !p.fainted).length;
  
  const winnerId = team1Alive > team2Alive ? battle.challenger_id : battle.opponent_id;
  const winnerName = team1Alive > team2Alive ? battle.challenger_name : battle.opponent_name;

  battleLog.push({
    type: 'end',
    message: `🏆 ¡${winnerName} gana la batalla!`,
    winner: winnerName,
    timestamp: Date.now()
  });

  // Crear registro de batalla
  const battleResult = {
    winner_id: winnerId,
    winner_name: winnerName,
    turns: turnNumber,
    team1_pokemon: team1Pokemon.map(p => p.name),
    team2_pokemon: team2Pokemon.map(p => p.name),
    team1_remaining: team1Alive,
    team2_remaining: team2Alive,
    battle_log: battleLog,
    detailed_turns: turns
  };

  // Finalizar batalla
  const result = await finalizeBattle(battleId, winnerId, battleResult);

  return {
    ...result,
    battle_result: battleResult
  };
}

// Calcular daño basado en fórmula similar a Pokémon
function calculateDamage(attacker, defender) {
  // Fórmula simplificada de daño de Pokémon
  const level = 50;
  const power = 60 + Math.random() * 40; // Poder del movimiento (60-100)
  const attack = attacker.attack;
  const defense = defender.defense;
  
  // Modificador de tipo (simplificado, asumimos neutral)
  const typeEffectiveness = 1.0;
  
  // Crítico (6.25% de probabilidad)
  const critical = Math.random() < 0.0625 ? 1.5 : 1.0;
  
  // Variación aleatoria (0.85 - 1.0)
  const random = 0.85 + Math.random() * 0.15;
  
  // Fórmula de daño
  const damage = Math.floor(
    ((((2 * level / 5 + 2) * power * attack / defense) / 50) + 2) *
    typeEffectiveness * critical * random
  );
  
  return Math.max(1, damage);
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
};
