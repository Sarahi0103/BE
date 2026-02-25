const db = require('./lib/db');

async function testAPI() {
  try {
    // Simular getPendingChallenges para Alejandra (ID: 6)
    console.log('\n🔍 Probando getPendingChallenges para Alejandra (ID: 6):\n');
    const challenges = await db.getPendingChallenges(6);
    
    console.log(`Total desafíos devueltos: ${challenges.length}\n`);
    challenges.forEach((c, i) => {
      console.log(`${i + 1}. Desafío ID: ${c.id}`);
      console.log(`   Status: ${c.status}`);
      console.log(`   challenger_id: ${c.challenger_id} - ${c.challenger_name} (${c.challenger_email})`);
      console.log(`   opponent_id: ${c.opponent_id} - ${c.opponent_name} (${c.opponent_email})`);
      console.log(`   Creado: ${c.created_at}\n`);
    });
    
    // También probar para Ivanna (ID: 7)
    console.log('\n🔍 Probando getPendingChallenges para Ivanna (ID: 7):\n');
    const challenges2 = await db.getPendingChallenges(7);
    
    console.log(`Total desafíos devueltos: ${challenges2.length}\n`);
    challenges2.forEach((c, i) => {
      console.log(`${i + 1}. Desafío ID: ${c.id}`);
      console.log(`   Status: ${c.status}`);
      console.log(`   challenger_id: ${c.challenger_id} - ${c.challenger_name} (${c.challenger_email})`);
      console.log(`   opponent_id: ${c.opponent_id} - ${c.opponent_name} (${c.opponent_email})`);
      console.log(`   Creado: ${c.created_at}\n`);
    });
    
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

testAPI();
