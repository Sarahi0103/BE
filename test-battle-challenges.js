const { Pool } = require('pg');

const pool = new Pool({
  host: 'localhost',
  port: 5432,
  database: 'pokedex',
  user: 'postgres',
  password: '123'
});

async function testBattleChallenges() {
  try {
    console.log('📊 Verificando tabla battle_challenges...');
    
    // Ver si la tabla existe
    const tableCheck = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'battle_challenges'
      );
    `);
    
    console.log('Tabla existe:', tableCheck.rows[0].exists);
    
    if (tableCheck.rows[0].exists) {
      // Obtener todos los challenges
      const challenges = await pool.query('SELECT * FROM battle_challenges ORDER BY created_at DESC');
      console.log(`\n⚔️ Total challenges: ${challenges.rows.length}`);
      
      challenges.rows.forEach(challenge => {
        console.log(`- ID: ${challenge.id} | De: ${challenge.challenger_id} -> Para: ${challenge.opponent_id} | Estado: ${challenge.status}`);
      });
      
      // Buscar challenge específico de Carolina (ID 9) hacia Karla (ID 8)
      console.log('\n🔍 Buscando challenges de Carolina hacia Karla...');
      const specificChallenge = await pool.query(`
        SELECT bc.*, u1.name as challenger_name, u2.name as opponent_name
        FROM battle_challenges bc
        JOIN users u1 ON bc.challenger_id = u1.id
        JOIN users u2 ON bc.opponent_id = u2.id
        WHERE bc.challenger_id = 9 AND bc.opponent_id = 8
        ORDER BY created_at DESC
      `);
      
      console.log('Challenges encontrados:', specificChallenge.rows.length);
      specificChallenge.rows.forEach(challenge => {
        console.log(`- ${challenge.challenger_name} -> ${challenge.opponent_name} | Estado: ${challenge.status} | Fecha: ${challenge.created_at}`);
      });
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await pool.end();
  }
}

testBattleChallenges();