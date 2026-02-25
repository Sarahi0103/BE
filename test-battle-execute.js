// Script para probar la ejecución de batalla y ver la estructura de datos
require('dotenv').config();
const { getBattleById, executeBattle, getPendingChallenges } = require('./lib/db');

async function testBattleExecution() {
  try {
    console.log('🔍 Buscando batallas aceptadas...\n');
    
    // Obtener desafíos pendientes para encontrar una batalla aceptada
    const challenges = await getPendingChallenges();
    console.log(`Encontrados ${challenges.length} desafíos en total`);
    
    const acceptedBattle = challenges.find(c => c.status === 'accepted');
    
    if (!acceptedBattle) {
      console.log('❌ No hay batallas en estado "accepted" para ejecutar');
      console.log('Por favor, acepta un desafío primero en la aplicación');
      process.exit(0);
    }
    
    console.log('\n✅ Batalla encontrada:');
    console.log('  ID:', acceptedBattle.id);
    console.log('  Retador:', acceptedBattle.challenger_name);
    console.log('  Oponente:', acceptedBattle.opponent_name);
    console.log('  Estado:', acceptedBattle.status);
    
    console.log('\n🎮 Ejecutando batalla...\n');
    
    const result = await executeBattle(acceptedBattle.id);
    
    console.log('📦 Resultado de la ejecución:');
    console.log('  Winner ID:', result.winner_id);
    console.log('  Status:', result.status);
    console.log('  Battle Result existe:', !!result.battle_result);
    
    if (result.battle_result) {
      const br = result.battle_result;
      console.log('\n📊 Battle Result:');
      console.log('  Winner Name:', br.winner_name);
      console.log('  Turnos:', br.turns);
      console.log('  Battle Log Length:', br.battle_log?.length || 0);
      
      if (br.battle_log && br.battle_log.length > 0) {
        console.log('\n📜 Primeros 5 logs:');
        br.battle_log.slice(0, 5).forEach((log, i) => {
          console.log(`\n  Log ${i}:`);
          console.log('    Type:', log.type);
          console.log('    Message:', log.message);
          
          if (log.attacker) {
            console.log('    Attacker:');
            console.log('      - name:', log.attacker.name);
            console.log('      - id:', log.attacker.id);
            console.log('      - currentHP:', log.attacker.currentHP);
            console.log('      - maxHP:', log.attacker.maxHP);
            console.log('      - sprite:', log.attacker.sprite ? 'SÍ' : 'NO');
          }
          
          if (log.defender) {
            console.log('    Defender:');
            console.log('      - name:', log.defender.name);
            console.log('      - id:', log.defender.id);
            console.log('      - currentHP:', log.defender.currentHP);
            console.log('      - maxHP:', log.defender.maxHP);
            console.log('      - sprite:', log.defender.sprite ? 'SÍ' : 'NO');
          }
        });
        
        console.log('\n🏁 Log final (end):');
        const endLog = br.battle_log.find(l => l.type === 'end');
        if (endLog) {
          console.log('  Message:', endLog.message);
          console.log('  Winner:', endLog.winner);
        }
      }
    }
    
    console.log('\n✅ Prueba completada exitosamente');
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error);
  } finally {
    process.exit(0);
  }
}

testBattleExecution();
