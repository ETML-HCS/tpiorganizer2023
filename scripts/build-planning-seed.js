const fs = require('fs')
const path = require('path')

// Helpers
const readJSON = (p) => JSON.parse(fs.readFileSync(p, 'utf8'))
const readCSV = (p, delimiter = ';') => {
  const raw = fs.readFileSync(p, 'utf8')
  const lines = raw.split(/\r?\n/).filter(Boolean)
  if (lines.length < 2) return []
  const headers = lines[0].split(delimiter).map((h) => h.trim())
  return lines.slice(1).map((line) => {
    const cols = line.split(delimiter)
    const row = {}
    headers.forEach((h, i) => {
      row[h] = (cols[i] || '').trim()
    })
    return row
  })
}

const clean = (v) => (v || '').toString().trim()

const baseDir = path.join(__dirname, '..', 'src', 'config', 'Autres')

function load2023() {
  const file = path.join(baseDir, '2023', 'dbOrganizer.tpiList_2023.json')
  const arr = readJSON(file)
  return arr.map((item) => ({
    reference: clean(item.refTpi),
    candidat: clean(item.candidat),
    expert1: clean(item.expert1),
    expert2: clean(item.expert2),
    chefProjet: clean(item.boss),
    sujet: clean(item.sujet || item.description),
    entreprise: clean(item.lieu),
    site: clean(item.lieu) || 'Vennes',
    anneeSource: '2023'
  }))
}

function load2024() {
  const file = path.join(baseDir, '2024', 'tpiList_2024.json')
  const arr = readJSON(file)
  return arr.map((item) => ({
    reference: clean(item.tpiRef),
    candidat: clean(item.candidat),
    expert1: clean(item.expert1),
    expert2: clean(item.expert2),
    chefProjet: clean(item.boss),
    sujet: clean(item.sujet),
    entreprise: clean(item['lieu-entreprise']),
    site: clean(item['lieu-site']) || 'Vennes',
    anneeSource: '2024'
  }))
}

function load2025() {
  const file = path.join(baseDir, '2025', 'tpiList_2025.csv')
  const rows = readCSV(file, ';')
  return rows.map((item) => ({
    reference: clean(item.tpiRef),
    candidat: clean(item.candidat),
    expert1: clean(item['expert 1']),
    expert2: clean(item['expert 2']),
    chefProjet: clean(item.boss),
    sujet: clean(item.Sujet),
    entreprise: clean(item['lieu-entreprise']),
    site: clean(item['lieu-site']) || 'Vennes',
    anneeSource: '2025'
  }))
}

function buildCombined() {
  const combined = [...load2023(), ...load2024(), ...load2025()]

  const header = [
    'Reference',
    'Candidat',
    'Expert1',
    'Expert2',
    'ChefProjet',
    'Sujet',
    'Entreprise',
    'Site',
    'AnneeSource'
  ]

  const lines = [header.join(';')]

  combined.forEach((tpi) => {
    const row = [
      tpi.reference,
      tpi.candidat,
      tpi.expert1,
      tpi.expert2,
      tpi.chefProjet,
      tpi.sujet,
      tpi.entreprise,
      tpi.site,
      tpi.anneeSource
    ]
      .map((v) => v.replace(/;/g, ','))
      .join(';')
    lines.push(row)
  })

  const outDir = path.join(baseDir, 'db')
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true })
  }
  const outPath = path.join(outDir, 'planning_votes_seed_2026.csv')
  fs.writeFileSync(outPath, lines.join('\n'), 'utf8')
  console.log(`✅ Fichier généré: ${outPath} (${combined.length} lignes)`) 
}

buildCombined()
