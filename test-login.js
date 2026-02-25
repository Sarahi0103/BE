const axios = require('axios');

async function testLogin() {
  const testCredentials = [
    { email: 'karla@gmail.com', password: 'Test1234' },
    { email: 'karla@gmail.com', password: 'Karla1234' },
    { email: 'test@pokedex.com', password: 'Test1234' },
  ];

  console.log('🧪 PROBANDO LOGIN CON DIFERENTES CREDENCIALES\n');

  for (const creds of testCredentials) {
    console.log(`\n📧 Testing: ${creds.email} | 🔑 Password: ${creds.password}`);
    console.log('─'.repeat(60));
    
    try {
      const response = await axios.post('http://localhost:4000/auth/login', creds, {
        headers: { 'Content-Type': 'application/json' }
      });
      
      console.log('✅ SUCCESS');
      console.log('Status:', response.status);
      console.log('Response:', JSON.stringify(response.data, null, 2));
      
      if (response.data.token) {
        console.log('🎫 Token recibido:', response.data.token.substring(0, 20) + '...');
      }
      if (response.data.user) {
        console.log('👤 Usuario:', response.data.user);
      }
    } catch (err) {
      console.log('❌ ERROR');
      if (err.response) {
        console.log('Status:', err.response.status);
        console.log('Response:', err.response.data);
      } else {
        console.log('Error:', err.message);
      }
    }
  }
}

testLogin().catch(console.error);
