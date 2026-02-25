// Script para crear una nueva batalla de prueba
require('dotenv').config();
const { createBattleChallenge, acceptBattleChallenge, executeBattle, getBattleById } = require('./lib/db');

async function createNewTestBattle() {
  try {
    console.log('🎮 Creando nueva batalla de prueba...\n');
    
    // Crear desafío (usuario 1 desafía a usuario 2)
    const challengerId = 1;  // Test User
    const opponentId = 2;  // Sarahi González ID
    const teamIndex = 0;
    
    console.log('📝 Creando desafío...');
    const challengeResult = await createBattleChallenge(challengerId, opponentId, teamIndex);
    console.log('  Challenge ID:', challengeResult.id);
    
    // Aceptar desafío
    const acceptTeamIndex = 0;
    console.log('\n✅ Aceptando desafío...');
    await acceptBattleChallenge(challengeResult.id, acceptTeamIndex);
    
    // Ejecutar batalla inmediatamente
    console.log('\n🎯 Ejecutando batalla...');
    const battleResult = await executeBattle(challengeResult.id);
    
    console.log('\n📦 Resultado de batalla:');
    console.log('  Winner ID:', battleResult.winner_id);
    console.log('  Battle Result exists:', !!battleResult.battle_result);
    
    if (battleResult.battle_result) {
      const br = battleResult.battle_result;
      console.log('\n📊 Battle Result en memoria:');
      console.log('  Winner Name:', br.winner_name);
      console.log('  Turnos:', br.turns);
      console.log('  Battle Log Length:', br.battle_log?.length || 0);
      
      if (br.battle_log && br.battle_log.length > 0) {
        // Buscar un log de attack
        const attackLog = br.battle_log.find(l => l.type === 'attack');
        if (attackLog) {
          console.log('\n🔍 Primer log de attack (en memoria):');
          console.log('  Message:', attackLog.message);
          console.log('  Attacker type:', typeof attackLog.attacker);
          console.log('  Attacker name:', attackLog.attacker?.name);
          console.log('  Defender type:', typeof attackLog.defender);
          console.log('  Defender name:', attackLog.defender?.name);
        }
      }
    }
    
    // Verificar cómo se ve después de guardado en BD
    console.log('\n🔄 Re-obteniendo batalla de BD...');
    const battleFromDB = await getBattleById(challengeResult.id);
    
    if (battleFromDB && battleFromDB.battle_result) {
      const resultFromDB = typeof battleFromDB.battle_result === 'string' 
        ? JSON.parse(battleFromDB.battle_result) 
        : battleFromDB.battle_result;
        
      console.log('\n📊 Battle Result desde BD:');
      console.log('  Battle Result type from DB:', typeof battleFromDB.battle_result);
      
      if (resultFromDB.battle_log) {
        const attackLogFromDB = resultFromDB.battle_log.find(l => l.type === 'attack');
        if (attackLogFromDB) {
          console.log('\n🔍 Primer log de attack (desde BD):');
          console.log('  Message:', attackLogFromDB.message);
          console.log('  Attacker type:', typeof attackLogFromDB.attacker);
          console.log('  Attacker content:', JSON.stringify(attackLogFromDB.attacker));
          console.log('  Defender type:', typeof attackLogFromDB.defender);
          console.log('  Defender content:', JSON.stringify(attackLogFromDB.defender));
        }
      }
    }
    
    console.log('\n✅ Prueba completada - Battle ID:', challengeResult.id);
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error);
  } finally {
    process.exit(0);
  }
}

createNewTestBattle();