// Script para verificar una batalla completada
require('dotenv').config();
const { getBattleById } = require('./lib/db');

async function testCompletedBattle() {
  try {
    // Revisar batalla 7 que está completada
    const battleId = 7;
    
    console.log(`🔍 Obteniendo batalla ${battleId}...\n`);
    
    const battle = await getBattleById(battleId);
    
    if (!battle) {
      console.log('❌ Batalla no encontrada');
      process.exit(1);
    }
    
    console.log('✅ Batalla encontrada:');
    console.log('  ID:', battle.id);
    console.log('  Retador:', battle.challenger_name);
    console.log('  Oponente:', battle.opponent_name);
    console.log('  Estado:', battle.status);
    console.log('  Winner ID:', battle.winner_id);
    
    if (battle.battle_result) {
      console.log('\n📊 Battle Result:');
      console.log('  Type:', typeof battle.battle_result);
      
      // Si es string, parsear
      const result = typeof battle.battle_result === 'string' 
        ? JSON.parse(battle.battle_result) 
        : battle.battle_result;
      
      console.log('  Winner Name:', result.winner_name);
      console.log('  Turnos:', result.turns);
      console.log('  Battle Log Length:', result.battle_log?.length || 0);
      
      if (result.battle_log && result.battle_log.length > 0) {
        console.log('\n📜 Primeros 3 logs:');
        result.battle_log.slice(0, 3).forEach((log, i) => {
          console.log(`\n  Log ${i}:`);
          console.log('    Type:', log.type);
          console.log('    Message:', log.message);
          
          if (log.attacker) {
            console.log('    Attacker existe:', typeof log.attacker);
            console.log('      - name:', log.attacker.name);
            console.log('      - id:', log.attacker.id);
            console.log('      - currentHP:', log.attacker.currentHP);
            console.log('      - sprite:', log.attacker.sprite || 'NO SPRITE');
          } else {
            console.log('    Attacker: NO');
          }
          
          if (log.defender) {
            console.log('    Defender existe:', typeof log.defender);
            console.log('      - name:', log.defender.name);
            console.log('      - id:', log.defender.id);
            console.log('      - currentHP:', log.defender.currentHP);
            console.log('      - sprite:', log.defender.sprite || 'NO SPRITE');
          } else {
            console.log('    Defender: NO');
          }
        });
      }
    } else {
      console.log('\n❌ No hay battle_result');
    }
    
    console.log('\n✅ Revisión completada');
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error);
  } finally {
    process.exit(0);
  }
}

testCompletedBattle();
