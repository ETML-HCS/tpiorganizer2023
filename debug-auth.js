// Script pour vérifier l'authentification
// À exécuter depuis Node.js en dev local

const axios = require('axios')

async function testAuth() {
  console.log('=== TEST AUTHENTIFICATION ===\n')
  
  const username = 'etmladmin'
  const password = 'aVennesNousAvonsTropdeVennes'
  
  try {
    // 1. Login
    console.log('🔐 Tentative de connexion...')
    const loginResponse = await axios.post('http://localhost:5001/api/auth/login', {
      username,
      password
    })
    
    const token = loginResponse.data.token
    console.log('✅ Connexion réussie!')
    console.log('Token:', token.substring(0, 30) + '...\n')
    
    // 2. Vérifier l'état du workflow
    console.log('📋 Vérification état workflow 2026...')
    const workflowResponse = await axios.get(
      'http://localhost:5001/api/workflow/2026/state',
      {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      }
    )
    
    console.log('État workflow:', workflowResponse.data)
    
    // 3. Tenter le freeze
    console.log('\n❄️  Tentative de gel du snapshot...')
    const freezeResponse = await axios.post(
      'http://localhost:5001/api/workflow/2026/planification/freeze',
      { allowHardConflicts: false },
      {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      }
    )
    
    console.log('✅ Freeze réussi!')
    console.log('Snapshot:', freezeResponse.data.snapshot)
    
  } catch (error) {
    console.error('❌ Erreur:', error.response?.data || error.message)
  }
}

testAuth()
