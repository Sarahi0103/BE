const db = require('./lib/db');

async function checkBattles() {
  try {
    const result = await db.pool.query(`
      SELECT bc.*, 
             u1.email as challenger_email, u1.name as challenger_name,
             u2.email as opponent_email, u2.name as opponent_name
      FROM battle_challenges bc
      JOIN users u1 ON bc.challenger_id = u1.id
      JOIN users u2 ON bc.opponent_id = u2.id
      WHERE bc.status = 'pending'
      ORDER BY bc.created_at DESC
      LIMIT 10
    `);
    
    console.log('\n📊 DESAFÍOS PENDIENTES EN LA BD:\n');
    console.log(`Total: ${result.rows.length}\n`);
    
    result.rows.forEach((row, i) => {
      console.log(`${i + 1}. ID: ${row.id}`);
      console.log(`   De: ${row.challenger_name} (${row.challenger_email})`);
      console.log(`   Para: ${row.opponent_name} (${row.opponent_email})`);
      console.log(`   Equipo retador: ${row.challenger_team_index}`);
      console.log(`   Creado: ${row.created_at}`);
      console.log(`   Status: ${row.status}\n`);
    });
    
    // También verificar todos los usuarios
    const users = await db.pool.query('SELECT id, email, name, code FROM users');
    console.log('👥 USUARIOS EN LA BD:\n');
    users.rows.forEach(u => {
      console.log(`   ${u.name} - ${u.email} - Código: ${u.code} - ID: ${u.id}`);
    });
    
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

checkBattles();
