const axios = require('axios');
const { getBattleById, getTeams } = require('./db');

// Estado de las batallas activas
const activeBattles = new Map();

// Mapa de usuarios conectados: userId -> socketId
const connectedUsers = new Map();

// Cache de datos de Pokémon de la PokéAPI
const pokemonCache = new Map();

// Obtener datos de Pokémon de la PokéAPI con cache
async function getPokemonData(pokemonId) {
  if (pokemonCache.has(pokemonId)) {
    return pokemonCache.get(pokemonId);
  }

  try {
    const response = await axios.get(`https://pokeapi.co/api/v2/pokemon/${pokemonId}`);
    const data = response.data;
    
    const pokemonData = {
      id: data.id,
      name: data.name,
      sprite: data.sprites.front_default,
      stats: {
        hp: data.stats.find(s => s.stat.name === 'hp')?.base_stat || 100,
        attack: data.stats.find(s => s.stat.name === 'attack')?.base_stat || 50,
        defense: data.stats.find(s => s.stat.name === 'defense')?.base_stat || 50,
        spAttack: data.stats.find(s => s.stat.name === 'special-attack')?.base_stat || 50,
        spDefense: data.stats.find(s => s.stat.name === 'special-defense')?.base_stat || 50,
        speed: data.stats.find(s => s.stat.name === 'speed')?.base_stat || 50
      },
      moves: data.moves.slice(0, 4).map(m => ({
        name: m.move.name,
        url: m.move.url
      })),
      types: data.types.map(t => t.type.name)
    };
    
    pokemonCache.set(pokemonId, pokemonData);
    return pokemonData;
  } catch (error) {
    console.error('Error fetching pokemon data:', error);
    return null;
  }
}

// Fórmula de cálculo de daño de Pokémon
function calculateDamage(attacker, defender, move) {
  const level = 50; // Nivel estándar para batallas
  const power = move?.power || 50; // Poder del movimiento
  const attack = attacker.stats.attack;
  const defense = defender.stats.defense;
  
  // Fórmula oficial de Pokémon
  const baseDamage = ((2 * level / 5 + 2) * power * (attack / defense) / 50 + 2);
  
  // Modificadores
  const stab = move && attacker.types.includes(move.type) ? 1.5 : 1; // Same Type Attack Bonus
  const typeEffectiveness = 1; // Simplificado, puedes implementar tabla de tipos
  const random = 0.85 + Math.random() * 0.15; // 0.85 - 1.0
  const critical = Math.random() < 0.0625 ? 2 : 1; // 6.25% chance
  
  const totalDamage = Math.floor(baseDamage * stab * typeEffectiveness * random * critical);
  
  return {
    damage: totalDamage,
    critical: critical === 2,
    effectiveness: typeEffectiveness
  };
}

// Inicializar batalla
function initializeBattle(battleId, team1Data, team2Data) {
  const battleState = {
    battleId,
    status: 'waiting', // waiting, selecting, calculating, animating
    turn: 0,
    team1: team1Data.map(p => ({
      ...p,
      currentHP: p.stats.hp,
      maxHP: p.stats.hp,
      fainted: false
    })),
    team2: team2Data.map(p => ({
      ...p,
      currentHP: p.stats.hp,
      maxHP: p.stats.hp,
      fainted: false
    })),
    currentPokemon1Index: 0,
    currentPokemon2Index: 0,
    player1Action: null,
    player2Action: null,
    log: []
  };
  
  activeBattles.set(battleId, battleState);
  return battleState;
}

// Procesar turno
function processTurn(battleState) {
  const p1 = battleState.team1[battleState.currentPokemon1Index];
  const p2 = battleState.team2[battleState.currentPokemon2Index];
  
  if (!p1 || !p2 || p1.fainted || p2.fainted) {
    return null;
  }
  
  const action1 = battleState.player1Action;
  const action2 = battleState.player2Action;
  
  // Determinar orden de ataque por velocidad
  const attacks = [];
  
  if (action1.type === 'attack' && !p1.fainted) {
    attacks.push({
      attacker: p1,
      defender: p2,
      move: action1.move,
      isPlayer1: true,
      speed: p1.stats.speed
    });
  }
  
  if (action2.type === 'attack' && !p2.fainted) {
    attacks.push({
      attacker: p2,
      defender: p1,
      move: action2.move,
      isPlayer1: false,
      speed: p2.stats.speed
    });
  }
  
  // Ordenar por velocidad
  attacks.sort((a, b) => b.speed - a.speed);
  
  const results = [];
  
  for (const attack of attacks) {
    if (attack.attacker.fainted || attack.defender.fainted) continue;
    
    const damageResult = calculateDamage(attack.attacker, attack.defender, attack.move);
    attack.defender.currentHP = Math.max(0, attack.defender.currentHP - damageResult.damage);
    
    results.push({
      attacker: attack.attacker.name,
      defender: attack.defender.name,
      move: attack.move.name,
      damage: damageResult.damage,
      critical: damageResult.critical,
      newHP: attack.defender.currentHP,
      maxHP: attack.defender.maxHP,
      isPlayer1: attack.isPlayer1
    });
    
    battleState.log.push({
      turn: battleState.turn,
      type: 'attack',
      ...results[results.length - 1],
      timestamp: Date.now()
    });
    
    // Verificar si el defensor se debilitó
    if (attack.defender.currentHP <= 0) {
      attack.defender.fainted = true;
      
      results.push({
        type: 'faint',
        pokemon: attack.defender.name,
        isPlayer1: !attack.isPlayer1
      });
      
      battleState.log.push({
        turn: battleState.turn,
        type: 'faint',
        pokemon: attack.defender.name,
        isPlayer1: !attack.isPlayer1,
        timestamp: Date.now()
      });
      
      // Avanzar al siguiente Pokémon
      if (attack.isPlayer1) {
        battleState.currentPokemon2Index++;
      } else {
        battleState.currentPokemon1Index++;
      }
    }
  }
  
  battleState.turn++;
  battleState.player1Action = null;
  battleState.player2Action = null;
  
  return results;
}

// Verificar si la batalla terminó
function checkBattleEnd(battleState) {
  const team1Alive = battleState.team1.some(p => !p.fainted);
  const team2Alive = battleState.team2.some(p => !p.fainted);
  
  if (!team1Alive) {
    return { ended: true, winner: 'player2' };
  }
  if (!team2Alive) {
    return { ended: true, winner: 'player1' };
  }
  
  return { ended: false };
}

// Configurar Socket.io para batallas
function setupBattleSocket(io) {
  io.on('connection', (socket) => {
    console.log('🔌 Cliente conectado:', socket.id);
    
    // Registrar usuario cuando se identifica
    socket.on('register-user', (data) => {
      const { userId, userEmail } = data;
      console.log(`👤 Usuario registrado: ${userEmail} (ID: ${userId}) -> Socket: ${socket.id}`);
      
      socket.userId = userId;
      socket.userEmail = userEmail;
      
      // Actualizar mapa de usuarios conectados
      connectedUsers.set(userId, socket.id);
      
      socket.emit('registered', { success: true });
    });
    
    // Unirse a una batalla
    socket.on('join-battle', async (data) => {
      const { battleId, userId } = data;
      console.log(`👤 Usuario ${userId} uniéndose a batalla ${battleId}`);
      
      socket.join(`battle-${battleId}`);
      socket.battleId = battleId;
      socket.userId = userId;
      
      // Verificar si la batalla ya está inicializada
      let battleState = activeBattles.get(battleId);
      
      if (!battleState) {
        // Cargar datos de batalla de la BD
        try {
          const battle = await getBattleById(battleId);
          if (!battle) {
            socket.emit('error', { message: 'Batalla no encontrada' });
            return;
          }
          
          // Cargar equipos
          const team1Data = await getTeams(battle.challenger_id);
          const team2Data = await getTeams(battle.opponent_id);
          
          const team1Pokemon = team1Data[battle.challenger_team_index].pokemons;
          const team2Pokemon = team2Data[battle.opponent_team_index].pokemons;
          
          // Obtener datos completos de la PokéAPI
          const team1Full = await Promise.all(
            team1Pokemon.map(p => getPokemonData(p.id || p.name))
          );
          const team2Full = await Promise.all(
            team2Pokemon.map(p => getPokemonData(p.id || p.name))
          );
          
          battleState = initializeBattle(battleId, team1Full, team2Full);
          
          battleState.player1Id = battle.challenger_id;
          battleState.player2Id = battle.opponent_id;
          battleState.player1Name = battle.challenger_name;
          battleState.player2Name = battle.opponent_name;
        } catch (error) {
          console.error('Error loading battle:', error);
          socket.emit('error', { message: 'Error al cargar batalla' });
          return;
        }
      }
      
      // Enviar estado inicial
      const isPlayer1 = battleState.player1Id === userId;
      socket.emit('battle-state', {
        ...battleState,
        isPlayer1,
        currentPokemon1: battleState.team1[battleState.currentPokemon1Index],
        currentPokemon2: battleState.team2[battleState.currentPokemon2Index]
      });
      
      // Notificar a la sala que un jugador se unió
      io.to(`battle-${battleId}`).emit('player-joined', {
        userId,
        playersReady: true
      });
    });
    
    // Recibir acción del jugador
    socket.on('player-action', (data) => {
      const { battleId, action } = data;
      const battleState = activeBattles.get(battleId);
      
      if (!battleState) {
        socket.emit('error', { message: 'Estado de batalla no encontrado' });
        return;
      }
      
      const isPlayer1 = battleState.player1Id === socket.userId;
      
      if (isPlayer1) {
        battleState.player1Action = action;
      } else {
        battleState.player2Action = action;
      }
      
      // Notificar que el jugador eligió su acción
      io.to(`battle-${battleId}`).emit('action-received', {
        player: isPlayer1 ? 1 : 2,
        ready: true
      });
      
      // Si ambos jugadores eligieron, procesar turno
      if (battleState.player1Action && battleState.player2Action) {
        battleState.status = 'calculating';
        
        setTimeout(() => {
          const results = processTurn(battleState);
          const endCheck = checkBattleEnd(battleState);
          
          // Enviar resultados a ambos jugadores
          io.to(`battle-${battleId}`).emit('turn-result', {
            results,
            turn: battleState.turn,
            currentPokemon1: battleState.team1[battleState.currentPokemon1Index],
            currentPokemon2: battleState.team2[battleState.currentPokemon2Index],
            ended: endCheck.ended,
            winner: endCheck.winner
          });
          
          if (endCheck.ended) {
            battleState.status = 'completed';
            io.to(`battle-${battleId}`).emit('battle-end', {
              winner: endCheck.winner,
              winnerName: endCheck.winner === 'player1' ? battleState.player1Name : battleState.player2Name
            });
            
            // Limpiar batalla después de 30 segundos
            setTimeout(() => {
              activeBattles.delete(battleId);
            }, 30000);
          } else {
            battleState.status = 'waiting';
          }
        }, 1000); // Delay para animaciones
      }
    });
    
    // Desconexión
    socket.on('disconnect', () => {
      console.log('❌ Cliente desconectado:', socket.id);
      
      // Limpiar del mapa de usuarios conectados
      if (socket.userId) {
        console.log(`👤 Usuario desconectado: ${socket.userEmail} (ID: ${socket.userId})`);
        connectedUsers.delete(socket.userId);
      }
      
      if (socket.battleId) {
        io.to(`battle-${socket.battleId}`).emit('player-disconnected', {
          userId: socket.userId
        });
      }
    });
  });
}

module.exports = {
  setupBattleSocket,
  activeBattles,
  getPokemonData,
  connectedUsers,
  
  // Función para enviar notificación a un usuario específico
  notifyUser: (io, userId, eventName, data) => {
    const socketId = connectedUsers.get(userId);
    if (socketId) {
      console.log(`📨 Enviando notificación '${eventName}' a usuario ${userId} (socket: ${socketId})`);
      io.to(socketId).emit(eventName, data);
      return true;
    } else {
      console.log(`⚠️ Usuario ${userId} no está conectado, no se puede enviar notificación`);
      return false;
    }
  }
};
