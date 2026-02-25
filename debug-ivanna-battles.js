const { pool, getUserByEmail } = require('./lib/db');

async function debugUserAndBattles() {
  try {
    console.log('🔍 Debug de batallas para ivanna@gmail.com\n');
    
    // 1. Obtener usuario
    const user = await getUserByEmail('ivanna@gmail.com');
    console.log('👤 Usuario:');
    console.log('   ID:', user?.id);
    console.log('   Email:', user?.email);
    console.log('   Nombre:', user?.name);
    console.log('');
    
    // 2. Obtener batallas donde es participante
    const battles = await pool.query(`
      SELECT bc.*, 
             u1.id as challenger_user_id, u1.name as challenger_name, u1.email as challenger_email,
             u2.id as opponent_user_id, u2.name as opponent_name, u2.email as opponent_email
      FROM battle_challenges bc
      JOIN users u1 ON bc.challenger_id = u1.id
      JOIN users u2 ON bc.opponent_id = u2.id
      WHERE bc.challenger_id = $1 OR bc.opponent_id = $1
      ORDER BY bc.created_at DESC
    `, [user.id]);
    
    console.log('📋 Batallas encontradas:', battles.rows.length);
    console.log('');
    
    battles.rows.forEach(b => {
      console.log(`  ID ${b.id}: ${b.challenger_name} (ID:${b.challenger_user_id}) -> ${b.opponent_name} (ID:${b.opponent_user_id})`);
      console.log(`    Status: ${b.status}`);
      console.log(`    Challenger team: ${b.challenger_team_index}`);
      console.log(`    Opponent team: ${b.opponent_team_index}`);
      
      // Verificar si ivanna es challenger o opponent
      if (b.challenger_user_id === user.id) {
        console.log(`    ✅ Ivanna es CHALLENGER (enviada)`);
      }
      if (b.opponent_user_id === user.id) {
        console.log(`    ✅ Ivanna es OPPONENT (recibida) - DEBE APARECER EN "Desafíos Recibidos"`);
      }
      console.log('');
    });
    
  } catch (err) {
    console.error('❌ Error:', err);
  } finally {
    await pool.end();
  }
}

debugUserAndBattles();
