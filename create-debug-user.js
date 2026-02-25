const bcrypt = require('bcryptjs');
const { createUser } = require('./lib/db');

async function createTestUser() {
  const email = 'debug@test.com';
  const password = 'Debug1234';
  const name = 'Debug User';

  console.log('🔧 Creando usuario de prueba...\n');
  console.log(`📧 Email: ${email}`);
  console.log(`🔑 Password: ${password}`);
  console.log(`👤 Nombre: ${name}\n`);

  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    
    // Generar código único
    const code = Math.random().toString(36).substring(2, 9);
    
    const user = await createUser({
      email,
      password: hashedPassword,
      name,
      code
    });
    
    console.log('✅ Usuario creado exitosamente:');
    console.log(`   ID: ${user.id}`);
    console.log(`   Email: ${user.email}`);
    console.log(`   Nombre: ${user.name}`);
    console.log(`   Código: ${user.code}`);
    console.log('\n🎯 Ahora puedes hacer login con:');
    console.log(`   Email: ${email}`);
    console.log(`   Password: ${password}`);
  } catch (err) {
    if (err.message.includes('already exists') || err.message.includes('duplicate key')) {
      console.log('⚠️  El usuario ya existe. Puedes hacer login con:');
      console.log(`   Email: ${email}`);
      console.log(`   Password: ${password}`);
    } else {
      console.error('❌ Error:', err.message);
    }
  }

  process.exit(0);
}

createTestUser();
