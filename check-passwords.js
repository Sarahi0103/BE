const { getUserByEmail } = require('./lib/db');

async function checkUsersPasswords() {
  const emails = [
    'karla@gmail.com',
    'test@pokedex.com',
    'sara@gmail.com',
    'esme@utzmg.edu.mx'
  ];

  console.log('🔐 VERIFICANDO CONTRASEÑAS DE USUARIOS\n');

  for (const email of emails) {
    try {
      const user = await getUserByEmail(email);
      if (!user) {
        console.log(`❌ ${email}: Usuario no encontrado`);
        continue;
      }

      console.log(`\n📧 ${email}`);
      console.log(`   👤 Nombre: ${user.name}`);
      console.log(`   🔑 Código: ${user.code}`);
      console.log(`   🔐 Tiene password: ${user.password ? 'SÍ (hash: ' + user.password.substring(0, 20) + '...)' : 'NO (cuenta de Google)'}`);
      console.log('─'.repeat(60));
    } catch (err) {
      console.error(`Error al verificar ${email}:`, err.message);
    }
  }

  process.exit(0);
}

checkUsersPasswords();
