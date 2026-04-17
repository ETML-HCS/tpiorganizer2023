/**
 * Script de test pour vérifier le parsing iCal
 */
const icalParser = require('./API/services/icalParserService')
const fs = require('fs')
const path = require('path')

// Lire un fichier de test
const testFile = './chat_blancs/Emploi_du_Temps_Carrel_Xavier.ics'
const content = fs.readFileSync(testFile, 'utf-8')

console.log('='.repeat(60))
console.log('Test du parsing iCal')
console.log('='.repeat(60))
console.log(`Fichier: ${testFile}`)
console.log('')

// Parser les événements
const events = icalParser.parseICalContent(content)
console.log(`Nombre total d'événements: ${events.length}`)

// Afficher quelques événements
console.log('\n--- Exemples d\'événements ---')
events.slice(0, 3).forEach((evt, i) => {
  console.log(`\nÉvénement ${i + 1}:`)
  console.log(`  Titre: ${evt.summary}`)
  console.log(`  Début: ${evt.dtstart}`)
  console.log(`  Fin: ${evt.dtend}`)
  console.log(`  Lieu: ${evt.location || 'N/A'}`)
})

// Test pour période septembre 2025 (pour tester le parsing)
console.log('\n' + '='.repeat(60))
console.log('Présences pour la semaine du 1-5 septembre 2025')
console.log('(Test car pas de cours en juin 2026 dans ce fichier)')
console.log('='.repeat(60))

const start = new Date('2025-09-01')
const end = new Date('2025-09-05')

const presences = icalParser.extractPresences(content, start, end)

console.log('\nPrésences détectées:')
const dates = Object.keys(presences).sort()

if (dates.length === 0) {
  console.log('  Aucune présence détectée dans cette période')
  console.log('  (Vérifiez que le fichier iCal contient des événements en juin 2026)')
} else {
  dates.forEach(date => {
    const p = presences[date]
    const matin = p.matin ? '✓ Présent' : '✗ Absent'
    const apm = p['apres-midi'] ? '✓ Présent' : '✗ Absent'
    const d = new Date(date)
    const jour = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'][d.getDay()]
    console.log(`  ${jour} ${date}: Matin: ${matin} | Après-midi: ${apm}`)
  })
}

// Statistiques
console.log('\n--- Statistiques ---')
let matinCount = 0
let apmCount = 0
dates.forEach(date => {
  if (presences[date].matin) matinCount++
  if (presences[date]['apres-midi']) apmCount++
})
console.log(`  Demi-journées avec présence: ${matinCount + apmCount}`)
console.log(`  Matins disponibles: ${matinCount}`)
console.log(`  Après-midis disponibles: ${apmCount}`)
