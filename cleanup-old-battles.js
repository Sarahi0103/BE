const { pool } = require('./lib/db');

async function cleanupOldBattles() {
  try {
    console.log('🧹 Limpiando batallas antiguas (completed e in_progress)...\n');
    
    // Eliminar batallas completed e in_progress
    const result = await pool.query(`
      DELETE FROM battle_challenges
      WHERE status IN ('completed', 'in_progress', 'rejected', 'cancelled')
      RETURNING id, status, challenger_id, opponent_id, created_at
    `);
    
    console.log(`✅ ${result.rows.length} batallas eliminadas:\n`);
    result.rows.forEach(row => {
      console.log(`  - ID ${row.id}: User ${row.challenger_id} vs User ${row.opponent_id} (${row.status})`);
    });
    
    // Mostrar batallas restantes
    const remaining = await pool.query(`
      SELECT bc.id, bc.status, u1.email as challenger_email, u2.email as opponent_email, bc.created_at
      FROM battle_challenges bc
      LEFT JOIN users u1 ON bc.challenger_id = u1.id
      LEFT JOIN users u2 ON bc.opponent_id = u2.id
      ORDER BY bc.created_at DESC
    `);
    
    console.log(`\n📋 Batallas restantes: ${remaining.rows.length}`);
    remaining.rows.forEach(row => {
      console.log(`  - ID ${row.id}: ${row.challenger_email} vs ${row.opponent_email} (${row.status}) - ${new Date(row.created_at).toLocaleString()}`);
    });
    
  } catch (err) {
    console.error('❌ Error:', err);
  } finally {
    await pool.end();
  }
}

cleanupOldBattles();
