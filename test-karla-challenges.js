const { Pool } = require('pg');

const pool = new Pool({
  host: 'localhost',
  port: 5432,
  database: 'pokedex',
  user: 'postgres',
  password: '123'
});

async function testGetPendingChallenges() {
  try {
    console.log('🔍 Probando getPendingChallenges para Karla (ID: 8)...');
    
    // Simular la query actual de getPendingChallenges
    const result = await pool.query(`
      SELECT bc.*, 
              u1.id as challenger_user_id, u1.name as challenger_name, u1.code as challenger_code, u1.email as challenger_email,
              u2.id as opponent_user_id, u2.name as opponent_name, u2.code as opponent_code, u2.email as opponent_email
       FROM battle_challenges bc
       JOIN users u1 ON bc.challenger_id = u1.id
       JOIN users u2 ON bc.opponent_id = u2.id
       WHERE (bc.challenger_id = $1 OR bc.opponent_id = $1) 
       AND bc.status IN ('pending', 'accepted', 'in_progress', 'completed')
       ORDER BY bc.created_at DESC
       LIMIT 50
    `, [8]); // Karla ID = 8
    
    console.log(`📋 Total challenges encontrados: ${result.rows.length}`);
    
    result.rows.forEach(challenge => {
      console.log(`\nID: ${challenge.id}`);
      console.log(`  Challenger: ${challenge.challenger_name} (${challenge.challenger_email})`);
      console.log(`  Opponent: ${challenge.opponent_name} (${challenge.opponent_email})`);
      console.log(`  Status: ${challenge.status}`);
      console.log(`  Fecha: ${challenge.created_at}`);
    });
    
    // Filtrar los pendientes donde Karla es el oponente
    const pendingForKarla = result.rows.filter(c => 
      c.status === 'pending' && c.opponent_user_id === 8
    );
    
    console.log(`\n🎯 Desafíos pendientes PARA Karla: ${pendingForKarla.length}`);
    pendingForKarla.forEach(challenge => {
      console.log(`  - ${challenge.challenger_name} desafió a Karla`);
    });
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await pool.end();
  }
}

testGetPendingChallenges();