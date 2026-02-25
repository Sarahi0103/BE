const { pool } = require('./lib/db');

async function checkBattle5() {
  try {
    console.log('🔍 Verificando batalla ID 5...\n');
    
    const result = await pool.query(
      `SELECT bc.*, 
              u1.name as challenger_name, u1.email as challenger_email,
              u2.name as opponent_name, u2.email as opponent_email
       FROM battle_challenges bc
       LEFT JOIN users u1 ON bc.challenger_id = u1.id
       LEFT JOIN users u2 ON bc.opponent_id = u2.id
       WHERE bc.id = 5`
    );
    
    if (result.rows.length === 0) {
      console.log('❌ Batalla ID 5 no existe');
      process.exit(0);
    }
    
    const battle = result.rows[0];
    console.log('📊 Batalla ID 5:');
    console.log(`  Status: ${battle.status}`);
    console.log(`  Retador: ${battle.challenger_name} (${battle.challenger_email}) - ID: ${battle.challenger_id}`);
    console.log(`  Oponente: ${battle.opponent_name} (${battle.opponent_email}) - ID: ${battle.opponent_id}`);
    console.log(`  Creada: ${battle.created_at}`);
    console.log(`  Team indices: Challenger=${battle.challenger_team_index}, Opponent=${battle.opponent_team_index}`);
    
    // Ivanna tiene ID 7
    const ivannaId = 7;
    const isIvannaParticipant = battle.challenger_id === ivannaId || battle.opponent_id === ivannaId;
    
    console.log(`\n  ¿Ivanna (ID 7) es participante? ${isIvannaParticipant ? 'SÍ' : 'NO'}`);
    
    if (battle.status === 'in_progress') {
      console.log('\n⚠️ Esta batalla está en estado "in_progress" pero nunca se completó.');
      console.log('¿Deseas eliminarla? Se eliminará automáticamente en 3 segundos...');
      
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      const deleteResult = await pool.query(
        'DELETE FROM battle_challenges WHERE id = 5 RETURNING id'
      );
      
      console.log('\n✅ Batalla ID 5 eliminada');
    }
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

checkBattle5();
