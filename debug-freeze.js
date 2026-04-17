// Script de test pour diagnostiquer le problème du bouton "Geler snapshot"
// À exécuter dans la console du navigateur (F12)

async function testFreezePlanification() {
  console.log('=== TEST FREEZE PLANIFICATION ===')
  
  // 1. Récupérer le token
  const appToken = localStorage.getItem('APP_SESSION_TOKEN')
  const planningToken = localStorage.getItem('PLANNING_SESSION_TOKEN')
  
  console.log('📋 Tokens trouvés:')
  console.log('  - APP_SESSION_TOKEN:', appToken ? '✅ Présent' : '❌ Absent')
  console.log('  - PLANNING_SESSION_TOKEN:', planningToken ? '✅ Présent' : '❌ Absent')
  
  const token = appToken || planningToken
  if (!token) {
    console.error('❌ ERREUR: Aucun token trouvé. Vous n\'êtes pas authentifié.')
    return
  }
  
  // 2. Tester l'appel API
  const year = 2026
  const url = `http://localhost:5001/api/workflow/${year}/planification/freeze`
  
  console.log(`\n📡 Test appel API:`)
  console.log(`  URL: ${url}`)
  console.log(`  Méthode: POST`)
  console.log(`  Header: Bearer ${token.substring(0, 20)}...`)
  
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        allowHardConflicts: false
      })
    })
    
    console.log(`\n📊 Réponse API:`)
    console.log(`  Status: ${response.status} ${response.statusText}`)
    
    const data = await response.json()
    console.log(`  Body:`, data)
    
    if (response.ok) {
      console.log('\n✅ SUCCÈS: Le freeze a fonctionné!')
      console.log(`  Snapshot version: ${data.snapshot?.version}`)
    } else {
      console.log('\n❌ ERREUR API:', data.error || 'Unknown error')
      if (data.details) {
        console.log(`  Détails:`, data.details)
      }
    }
  } catch (error) {
    console.error('\n❌ ERREUR FETCH:', error.message)
    console.error('Stack:', error.stack)
  }
}

// Lancer le test
testFreezePlanification()
