import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'react-toastify'
import { useLocation, useNavigate } from 'react-router-dom'

import BinaryToggle from '../shared/BinaryToggle'
import {
  AlertIcon,
  BanIcon as DisableIcon,
  CandidateIcon as CandidateRoleIcon,
  CheckIcon,
  ChevronDownIcon,
  ClipboardIcon,
  ExpertIcon as ExpertRoleIcon,
  MailIcon,
  MailOffIcon as NoEmailIcon,
  PencilIcon as EditIcon,
  PlusIcon,
  ProjectLeadIcon as ChefProjetRoleIcon,
  RefreshIcon,
  SearchIcon,
  UploadIcon,
  UserIcon,
  UsersIcon
} from '../shared/InlineIcons'
import { personService, planningConfigService } from '../../services/planningService'
import { STORAGE_KEYS, YEARS_CONFIG } from '../../config/appConfig'
import { readJSONListValue, readStorageValue, writeJSONValue } from '../../utils/storage'
import {
  getStakeholderRoleLabel,
  splitStakeholderDraftName
} from '../tpiManagement/tpiStakeholderDraftUtils'
import { buildSyntheticStakeholderEmail } from './stakeholderDraftEmailUtils'
import {
  PREFERRED_SOUTENANCE_CHOICE_FIELDS,
  buildPreferredSoutenanceChoices,
  buildPreferredSoutenanceDates,
  formatPreferredSoutenanceChoicesForPreview as formatPreferredSoutenanceDatesForPreview,
  getPreferredSoutenanceChoiceInputValues as getPreferredSoutenanceDateInputValues,
  getPreferredSoutenanceChoicesForPerson
} from '../../utils/preferredSoutenanceUtils'

import '../../css/partiesPrenantes/partiesPrenantes.css'

const ROLE_OPTIONS = [
  { value: 'candidat', label: 'Candidat' },
  { value: 'expert', label: 'Expert' },
  { value: 'chef_projet', label: 'Chef de projet' },
  { value: 'admin', label: 'Admin' }
]

const SITE_OPTIONS = ['Vennes', 'Sébeillon', 'Autre']
const IMPORT_ROLE_OPTIONS = ROLE_OPTIONS.filter((role) => role.value === 'candidat' || role.value === 'expert' || role.value === 'chef_projet')
const WORKBENCH_TABS = [
  { value: 'create', label: 'Création' },
  { value: 'draft', label: 'Complétion' },
  { value: 'import', label: 'Import' }
]
const WORKBENCH_TAB_ICONS = {
  create: PlusIcon,
  draft: ClipboardIcon,
  import: UploadIcon
}
const DRAFT_STATUS_FILTER_OPTIONS = [
  { value: 'actionable', label: 'À traiter' },
  { value: 'enrich', label: 'À enrichir' },
  { value: 'create', label: 'À créer' },
  { value: 'resolved', label: 'Couverts' },
  { value: 'all', label: 'Tous' }
]
const IMPORT_DELIMITERS = ['\t', ';', ',']
const IMPORT_COLUMN_MAPPINGS = {
  expert: 'name',
  nom: 'name',
  nomcomplet: 'name',
  personne: 'name',
  expertmail: 'email',
  email: 'email',
  mail: 'email',
  adressemail: 'email',
  tel: 'phone',
  telephone: 'phone',
  phone: 'phone',
  mobile: 'phone',
  site: 'site',
  lieu: 'site'
}
const IMPORT_FIELD_LABELS = {
  name: 'Nom',
  email: 'Email',
  phone: 'Téléphone',
  site: 'Site'
}
const IMPORT_STATUS_LABELS = {
  created: 'Créée',
  updated: 'Mise à jour',
  duplicate: 'Doublon'
}

const normalizeWorkbenchTab = (value = '') => {
  const normalized = String(value || '').trim()
  return WORKBENCH_TABS.some((tab) => tab.value === normalized) ? normalized : 'create'
}

const normalizeDraftStatusFilter = (value = '') => {
  const normalized = String(value || '').trim()
  return DRAFT_STATUS_FILTER_OPTIONS.some((option) => option.value === normalized) ? normalized : 'actionable'
}

const normalizeImportHeader = (value = '') => normalizeFold(value).replace(/\s+/g, '')

const detectImportDelimiter = (content = '') => {
  const firstLine = String(content || '').split(/\r?\n/).find((line) => line.trim()) || ''

  let bestDelimiter = '\t'
  let maxCount = -1

  IMPORT_DELIMITERS.forEach((delimiter) => {
    const escapedDelimiter = delimiter.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const pattern = delimiter === '\t' ? /\t/g : new RegExp(escapedDelimiter, 'g')
    const count = (firstLine.match(pattern) || []).length

    if (count > maxCount) {
      maxCount = count
      bestDelimiter = delimiter
    }
  })

  return bestDelimiter
}

function parseImportDelimitedLine(line = '', delimiter = ';') {
  const result = []
  let current = ''
  let inQuotes = false

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index]

    if (char === '"') {
      if (inQuotes && line[index + 1] === '"') {
        current += '"'
        index += 1
      } else {
        inQuotes = !inQuotes
      }
      continue
    }

    if (char === delimiter && !inQuotes) {
      result.push(current.trim())
      current = ''
      continue
    }

    current += char
  }

  result.push(current.trim())
  return result
}

function getImportDelimiterLabel(delimiter) {
  switch (delimiter) {
    case '\t':
      return 'Tabulation'
    case ';':
      return 'Point-virgule'
    case ',':
      return 'Virgule'
    default:
      return 'Inconnu'
  }
}

function buildImportPreview(content = '') {
  const rawContent = String(content || '').replace(/\uFEFF/g, '').trim()

  if (!rawContent) {
    return {
      canImport: false,
      dataRowCount: 0,
      delimiter: '',
      delimiterLabel: 'Aucun',
      headers: [],
      isEmpty: true,
      lineCount: 0,
      missingRequiredFields: [],
      recognizedFields: [],
      sampleRows: []
    }
  }

  const lines = rawContent.split(/\r?\n/).filter((line) => line.trim())
  const delimiter = detectImportDelimiter(rawContent)
  const headers = parseImportDelimitedLine(lines[0] || '', delimiter)
  const mappedColumns = headers
    .map((header, index) => {
      const field = IMPORT_COLUMN_MAPPINGS[normalizeImportHeader(header)]
      return field ? { field, header, index } : null
    })
    .filter(Boolean)
  const recognizedFields = Array.from(new Set(mappedColumns.map((column) => column.field)))
  const missingRequiredFields = ['name', 'email'].filter((field) => !recognizedFields.includes(field))
  const sampleRows = lines
    .slice(1, 6)
    .map((line, index) => {
      const values = parseImportDelimitedLine(line, delimiter)
      const row = {
        email: '',
        lineNumber: index + 2,
        name: '',
        phone: '',
        site: ''
      }

      mappedColumns.forEach((column) => {
        row[column.field] = values[column.index] || ''
      })

      return row
    })
    .filter((row) => row.name || row.email || row.phone || row.site)

  return {
    canImport: lines.length > 1 && missingRequiredFields.length === 0,
    dataRowCount: Math.max(lines.length - 1, 0),
    delimiter,
    delimiterLabel: getImportDelimiterLabel(delimiter),
    headers,
    isEmpty: false,
    lineCount: lines.length,
    missingRequiredFields,
    recognizedFields,
    sampleRows
  }
}

const EXPERT_IMPORT_EXAMPLE = `Expert;email;tel;site
Alain Pittet;alain.pittet@info-domo.ch;;
Alexandre Graf;alg@web-services.com;;
Arnaud Sartoni;arnaud.sartoni@epfl.ch;;
Bernard Oberson;oberson.bernard@gmail.com;;
Borys Folomietow;borys@folomietow.ch;;
Carlos Perez;carlos.perez@epfl.ch;;
Claude-Albert Muller Theurillat;expertclaude65@gmail.com;;
Daniel Berney;daniel.berney@heig-vd.ch;;
Diego Criscenti;diego.criscenti@hepl.ch;;
Ernesto Montemayor;ernesto@bati-technologie.ch;+41 79 606 33 28;
Frédérique Andolfatto;frederique.andolfatto@eduvaud.ch;;
Gabriel Maret;gab.maret@gmail.com;;
Jason Crisante;jasoncrisantepro@outlook.com;;
Jean-Luc Roduit;dedecop2@gmail.com;;
Karim Bourahla;karim.bourahla@eduvaud.ch;;
Luc Venries;luc.venries@epfl.ch;;
Mathias Giroud;giroud@cinformatique.ch;;
Mathieu Meylan;m.meylan@gmail.com;;
Max Roy;max.roy@netzys.ch;;
Michael Wyssa;michael.wyssa@eduvaud.ch;+41 79 698 19 24;
Michel Ange Delgado;michel.delgado@bluewin.ch;;
Mikael Gonzalez;mikael.gonzalez7@gmail.com;;
Nicolas Borboën;nicolas.borboen@epfl.ch;;
Olivier Mellina;mellina.olivier@gmail.com;;
Pascal Benzonana;pascal.benzonana@eduvaud.ch;;
Raphaël Favre;raphael.favre@eduvaud.ch;;
Roger Malherbe;r.malherbe@rmsoft.ch;+41 79 230 72 37;
Serge Wenger;serge.wenger@matisa.ch;;
Sofia Roy;sofia.roy@netzys.ch;;
Suleyman Ceran;sueleyman.ceran@gmail.com;;
Volkan Sutcu;volkan.sutcu@hotmail.com;;`

const INITIAL_FORM = {
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  site: '',
  entreprise: '',
  preferredSoutenanceDate1: '',
  preferredSoutenanceSlot1: '',
  preferredSoutenanceDate2: '',
  preferredSoutenanceSlot2: '',
  preferredSoutenanceDate3: '',
  preferredSoutenanceSlot3: '',
  roles: ['expert'],
  isActive: true,
  sendEmails: true,
  candidateYears: []
}

const INITIAL_IMPORT_ROLES = ['expert']

function normalizeRoles(roles) {
  return new Set((Array.isArray(roles) ? roles : []).map((role) => String(role || '').trim().toLowerCase()).filter(Boolean))
}

const PLACEHOLDER_EMPTY_VALUES = new Set(['null', 'undefined'])

function normalizeWhitespace(value = '') {
  const normalizedValue = String(value ?? '').replace(/\s+/g, ' ').trim()
  return PLACEHOLDER_EMPTY_VALUES.has(normalizedValue.toLowerCase())
    ? ''
    : normalizedValue
}

function normalizeFold(value = '') {
  return normalizeWhitespace(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
}

function getPersonIdentityKey(person) {
  const firstName = normalizeFold(person?.firstName)
  const lastName = normalizeFold(person?.lastName)

  if (!firstName && !lastName) {
    return ''
  }

  return `${firstName}|${lastName}`
}

function getPersonDisplayName(person) {
  return normalizeWhitespace([person?.firstName, person?.lastName].filter(Boolean).join(' '))
}

function getPersonShortIdPrefix(person) {
  const roleSet = normalizeRoles(person?.roles)

  if (roleSet.size > 1) {
    return 'M'
  }

  if (roleSet.has('expert')) {
    return 'E'
  }

  if (roleSet.has('chef_projet')) {
    return 'P'
  }

  if (roleSet.has('candidat')) {
    return 'C'
  }

  if (roleSet.has('admin')) {
    return 'A'
  }

  return 'S'
}

function formatPersonShortIdNumber(person) {
  const parsedShortId = Number.parseInt(person?.shortId, 10)

  if (!Number.isInteger(parsedShortId) || parsedShortId <= 0) {
    return '---'
  }

  return String(parsedShortId).padStart(3, '0')
}

function sortPeopleByName(people = []) {
  return [...(Array.isArray(people) ? people : [])].sort((left, right) => {
    const lastNameComparison = normalizeWhitespace(left?.lastName).localeCompare(normalizeWhitespace(right?.lastName), 'fr', {
      sensitivity: 'base'
    })

    if (lastNameComparison !== 0) {
      return lastNameComparison
    }

    const firstNameComparison = normalizeWhitespace(left?.firstName).localeCompare(normalizeWhitespace(right?.firstName), 'fr', {
      sensitivity: 'base'
    })

    if (firstNameComparison !== 0) {
      return firstNameComparison
    }

    return formatPersonShortIdNumber(left).localeCompare(formatPersonShortIdNumber(right), 'fr', { numeric: true, sensitivity: 'base' })
  })
}

function formatPersonShortId(person) {
  const shortIdNumber = formatPersonShortIdNumber(person)

  if (shortIdNumber === '---') {
    return '---'
  }

  return `${getPersonShortIdPrefix(person)}-${shortIdNumber}`
}

function isSyntheticOrganizerEmail(value = '') {
  return /@tpi-?organizer\.ch$/i.test(normalizeWhitespace(value))
}

function mergePreviewRoles(existingRoles = [], incomingRoles = []) {
  const merged = []

  const pushUnique = (values = []) => {
    ;(Array.isArray(values) ? values : [values])
      .map((value) => String(value || '').trim())
      .filter(Boolean)
      .forEach((value) => {
        if (!merged.includes(value)) {
          merged.push(value)
        }
      })
  }

  pushUnique(existingRoles)
  pushUnique(incomingRoles)
  return merged
}

function mergePreviewCandidateYears(existingYears = [], incomingYears = []) {
  return Array.from(
    new Set(
      [
        ...(Array.isArray(existingYears) ? existingYears : [existingYears]),
        ...(Array.isArray(incomingYears) ? incomingYears : [incomingYears])
      ]
        .map((value) => Number.parseInt(value, 10))
        .filter((value) => Number.isInteger(value))
    )
  ).sort((left, right) => left - right)
}

function formatMergePreviewRoles(roles = []) {
  const roleValues = Array.isArray(roles) ? roles : [roles]
  const labels = roleValues
    .map((role) => getStakeholderRoleLabel(role))
    .filter(Boolean)

  return labels.length > 0 ? labels.join(', ') : 'Aucun rôle'
}

function formatMergePreviewYears(years = []) {
  const values = Array.isArray(years) ? years : [years]
  const normalized = values
    .map((year) => Number.parseInt(year, 10))
    .filter((year) => Number.isInteger(year))

  return normalized.length > 0 ? normalized.join(', ') : 'Aucune année'
}

function formatMergePreviewText(value) {
  const text = normalizeWhitespace(value)
  return text.length > 0 ? text : 'Non renseigné'
}

function formatMergePreviewBoolean(key, value) {
  if (key === 'isActive') {
    return value === false ? 'Inactive' : 'Active'
  }

  if (key === 'sendEmails') {
    return value === false ? "Ne reçoit pas d'emails" : 'Reçoit des emails'
  }

  return value === false ? 'Non' : 'Oui'
}

function getMergePreviewStatus(key, before, after) {
  const beforeText = Array.isArray(before) ? before.join('|') : String(before ?? '')
  const afterText = Array.isArray(after) ? after.join('|') : String(after ?? '')

  if (beforeText === afterText) {
    return 'Conservé'
  }

  const beforeEmpty = Array.isArray(before)
    ? before.length === 0
    : normalizeWhitespace(beforeText).length === 0
  const afterEmpty = Array.isArray(after)
    ? after.length === 0
    : normalizeWhitespace(afterText).length === 0

  if (beforeEmpty && !afterEmpty) {
    return 'Complété'
  }

  if (key === 'roles' || key === 'candidateYears' || key === 'preferredSoutenanceDates') {
    return 'Fusionné'
  }

  if (key === 'isActive' && before === false && after !== false) {
    return 'Réactivé'
  }

  if (key === 'sendEmails' && before !== false && after === false) {
    return 'Désactivé'
  }

  if (key === 'email') {
    return 'Remplacé'
  }

  return 'Mis à jour'
}

function simulatePersonMergePreview(targetPerson, sourcePeople = []) {
  const merged = {
    ...targetPerson,
    roles: Array.isArray(targetPerson?.roles) ? [...targetPerson.roles] : [],
    candidateYears: Array.isArray(targetPerson?.candidateYears) ? [...targetPerson.candidateYears] : [],
    preferredSoutenanceChoices: getPreferredSoutenanceChoicesForPerson(targetPerson),
    preferredSoutenanceDates: buildPreferredSoutenanceDates(
      targetPerson?.preferredSoutenanceChoices || [],
      targetPerson?.preferredSoutenanceDates || []
    )
  }

  sourcePeople.forEach((sourcePerson) => {
    ;['firstName', 'lastName', 'phone', 'site', 'entreprise'].forEach((field) => {
      const currentValue = normalizeWhitespace(merged?.[field])
      const incomingValue = normalizeWhitespace(sourcePerson?.[field])

      if (!currentValue && incomingValue) {
        merged[field] = incomingValue
      }
    })

    if (merged.isActive === false && sourcePerson?.isActive !== false) {
      merged.isActive = true
    }

    if (sourcePerson?.sendEmails === false) {
      merged.sendEmails = false
    }

    merged.roles = mergePreviewRoles(merged.roles, sourcePerson?.roles)
    merged.candidateYears = mergePreviewCandidateYears(merged.candidateYears, sourcePerson?.candidateYears)
    merged.preferredSoutenanceChoices = buildPreferredSoutenanceChoices(
      [
        ...merged.preferredSoutenanceChoices,
        ...getPreferredSoutenanceChoicesForPerson(sourcePerson)
      ]
    )
    merged.preferredSoutenanceDates = buildPreferredSoutenanceDates(merged.preferredSoutenanceChoices)

    const currentEmail = normalizeWhitespace(merged.email)
    const incomingEmail = normalizeWhitespace(sourcePerson?.email).toLowerCase()
    if (incomingEmail) {
      if (!currentEmail || (isSyntheticOrganizerEmail(currentEmail) && !isSyntheticOrganizerEmail(incomingEmail))) {
        merged.email = incomingEmail
      }
    }
  })

  return merged
}

function buildMergePreviewRows(targetPerson, mergedPerson) {
  const rows = [
    {
      key: 'firstName',
      label: 'Prénom',
      before: formatMergePreviewText(targetPerson?.firstName),
      after: formatMergePreviewText(mergedPerson?.firstName)
    },
    {
      key: 'lastName',
      label: 'Nom',
      before: formatMergePreviewText(targetPerson?.lastName),
      after: formatMergePreviewText(mergedPerson?.lastName)
    },
    {
      key: 'email',
      label: 'Email',
      before: formatMergePreviewText(targetPerson?.email),
      after: formatMergePreviewText(mergedPerson?.email)
    },
    {
      key: 'phone',
      label: 'Téléphone',
      before: formatMergePreviewText(targetPerson?.phone),
      after: formatMergePreviewText(mergedPerson?.phone)
    },
    {
      key: 'site',
      label: 'Site',
      before: formatMergePreviewText(targetPerson?.site),
      after: formatMergePreviewText(mergedPerson?.site)
    },
    {
      key: 'entreprise',
      label: 'Entreprise',
      before: formatMergePreviewText(targetPerson?.entreprise),
      after: formatMergePreviewText(mergedPerson?.entreprise)
    },
    {
      key: 'roles',
      label: 'Rôles',
      before: formatMergePreviewRoles(targetPerson?.roles),
      after: formatMergePreviewRoles(mergedPerson?.roles)
    },
    {
      key: 'candidateYears',
      label: 'Années candidat',
      before: formatMergePreviewYears(targetPerson?.candidateYears),
      after: formatMergePreviewYears(mergedPerson?.candidateYears)
    },
    {
      key: 'preferredSoutenanceDates',
      label: 'Dates idéales',
      before: formatPreferredSoutenanceDatesForPreview(
        targetPerson?.preferredSoutenanceChoices,
        targetPerson?.preferredSoutenanceDates
      ),
      after: formatPreferredSoutenanceDatesForPreview(
        mergedPerson?.preferredSoutenanceChoices,
        mergedPerson?.preferredSoutenanceDates
      )
    },
    {
      key: 'isActive',
      label: 'Statut',
      before: formatMergePreviewBoolean('isActive', targetPerson?.isActive),
      after: formatMergePreviewBoolean('isActive', mergedPerson?.isActive)
    },
    {
      key: 'sendEmails',
      label: 'Emails automatiques',
      before: formatMergePreviewBoolean('sendEmails', targetPerson?.sendEmails),
      after: formatMergePreviewBoolean('sendEmails', mergedPerson?.sendEmails)
    }
  ]

  return rows.map((row) => ({
    ...row,
    status: getMergePreviewStatus(row.key, row.before, row.after)
  }))
}

function buildMergePreviewData(primaryPerson, duplicateGroup = []) {
  if (!primaryPerson?._id) {
    return null
  }

  const groupPeople = Array.isArray(duplicateGroup) ? duplicateGroup : []
  const sourcePeople = groupPeople.filter((person) => String(person?._id) !== String(primaryPerson._id))

  if (sourcePeople.length === 0) {
    return null
  }

  const mergedPerson = simulatePersonMergePreview(primaryPerson, sourcePeople)
  const rows = buildMergePreviewRows(primaryPerson, mergedPerson)
  const changedCount = rows.filter((row) => row.before !== row.after).length
  const primaryIdentityKey = getPersonIdentityKey(primaryPerson)
  const identityMismatchCount = sourcePeople.filter((person) => getPersonIdentityKey(person) !== primaryIdentityKey).length

  return {
    primaryPerson,
    sourcePeople,
    mergedPerson,
    rows,
    changedCount,
    sourceCount: sourcePeople.length,
    identityMismatchCount
  }
}

function getDraftCandidateYears(draft) {
  return Array.from(
    new Set(
      [
        ...(Array.isArray(draft?.candidateYears) ? draft.candidateYears : []),
        draft?.year
      ]
        .map((value) => Number.parseInt(value, 10))
        .filter((value) => Number.isInteger(value))
    )
  ).sort((left, right) => right - left)
}

function getPersonCandidateYears(person) {
  return Array.from(
    new Set(
      (Array.isArray(person?.candidateYears) ? person.candidateYears : [])
        .map((value) => Number.parseInt(value, 10))
        .filter((value) => Number.isInteger(value))
    )
  ).sort((left, right) => right - left)
}

function getDraftRoles(role) {
  switch (String(role || '').trim()) {
    case 'candidat':
      return ['candidat']
    case 'chef_projet':
      return ['chef_projet']
    case 'expert':
    default:
      return ['expert']
  }
}

function findPersonByDraftName(people, draft) {
  const draftNameKey = normalizeFold(draft?.name)

  if (!draftNameKey) {
    return null
  }

  return people.find((person) => normalizeFold(getPersonDisplayName(person)) === draftNameKey) || null
}

function findPersonByRouteTarget(people, target = {}) {
  const personId = normalizeWhitespace(target?.personId)
  const personName = normalizeFold(target?.name)
  const role = normalizeWhitespace(target?.role)

  const roleMatches = (person) => {
    if (!role) {
      return true
    }

    return normalizeRoles(person?.roles).has(role)
  }

  if (personId) {
    return (Array.isArray(people) ? people : []).find(
      (person) => String(person?._id) === personId && roleMatches(person)
    ) || null
  }

  if (!personName) {
    return null
  }

  const matches = (Array.isArray(people) ? people : []).filter((person) => {
    if (!roleMatches(person)) {
      return false
    }

    const displayName = normalizeFold(getPersonDisplayName(person))
    const email = normalizeFold(person?.email)

    return displayName === personName || email === personName
  })

  return matches.length === 1 ? matches[0] : null
}

function normalizeLocalReturnPath(value = '') {
  const normalizedValue = normalizeWhitespace(value)
  return normalizedValue.startsWith('/') ? normalizedValue : ''
}

function normalizeSiteLookup(value = '') {
  return normalizeFold(value).replace(/\s+/g, '')
}

const AFTERNOON_START_MINUTES = 12 * 60 + 30
const DEFAULT_PREFERRED_SLOT_SCHEDULE = {
  breaklineMinutes: 10,
  tpiTimeMinutes: 60,
  firstTpiStartTime: '08:00'
}

function parseTimeToMinutes(value = '', fallbackMinutes = 8 * 60) {
  const normalizedValue = normalizeWhitespace(value)

  if (/^\d{1,2}:\d{2}$/.test(normalizedValue)) {
    const [hoursText, minutesText] = normalizedValue.split(':')
    const hours = Number.parseInt(hoursText, 10)
    const minutes = Number.parseInt(minutesText, 10)

    if (Number.isInteger(hours) && Number.isInteger(minutes) && hours >= 0 && minutes >= 0 && minutes < 60) {
      return hours * 60 + minutes
    }
  }

  return fallbackMinutes
}

function formatMinutesAsClockTime(value) {
  if (!Number.isFinite(Number(value))) {
    return ''
  }

  const safeMinutes = Math.max(0, Math.round(Number(value)))
  const hours = Math.floor(safeMinutes / 60)
  const minutes = safeMinutes % 60

  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`
}

function buildPreferredSoutenanceSlotSchedule(siteConfig = {}, fallbackSlotCount = 8) {
  return {
    breaklineMinutes: Number.isFinite(Number(siteConfig?.breaklineMinutes)) && Number(siteConfig.breaklineMinutes) >= 0
      ? Number(siteConfig.breaklineMinutes)
      : DEFAULT_PREFERRED_SLOT_SCHEDULE.breaklineMinutes,
    tpiTimeMinutes: Number.isFinite(Number(siteConfig?.tpiTimeMinutes)) && Number(siteConfig.tpiTimeMinutes) > 0
      ? Number(siteConfig.tpiTimeMinutes)
      : DEFAULT_PREFERRED_SLOT_SCHEDULE.tpiTimeMinutes,
    firstTpiStartTime: normalizeWhitespace(siteConfig?.firstTpiStartTime) || DEFAULT_PREFERRED_SLOT_SCHEDULE.firstTpiStartTime,
    numSlots: Number.isInteger(Number(siteConfig?.numSlots)) && Number(siteConfig.numSlots) > 0
      ? Number(siteConfig.numSlots)
      : fallbackSlotCount
  }
}

function resolvePreferredSoutenanceSlotTiming(period, schedule = DEFAULT_PREFERRED_SLOT_SCHEDULE) {
  const normalizedPeriod = Number.parseInt(period, 10)

  if (!Number.isInteger(normalizedPeriod) || normalizedPeriod <= 0) {
    return null
  }

  const firstTpiStartMinutes = parseTimeToMinutes(schedule?.firstTpiStartTime, 8 * 60)
  const tpiTimeMinutes = Number.isFinite(Number(schedule?.tpiTimeMinutes)) && Number(schedule.tpiTimeMinutes) > 0
    ? Number(schedule.tpiTimeMinutes)
    : DEFAULT_PREFERRED_SLOT_SCHEDULE.tpiTimeMinutes
  const breaklineMinutes = Number.isFinite(Number(schedule?.breaklineMinutes)) && Number(schedule.breaklineMinutes) >= 0
    ? Number(schedule.breaklineMinutes)
    : DEFAULT_PREFERRED_SLOT_SCHEDULE.breaklineMinutes
  const startMinutes = firstTpiStartMinutes + (normalizedPeriod - 1) * (tpiTimeMinutes + breaklineMinutes)
  const endMinutes = startMinutes + tpiTimeMinutes

  return {
    normalizedPeriod,
    halfDayLabel: startMinutes >= AFTERNOON_START_MINUTES ? 'PM' : 'AM',
    startTime: formatMinutesAsClockTime(startMinutes),
    endTime: formatMinutesAsClockTime(endMinutes)
  }
}

function resolvePreferredSoutenanceSlotHalfDay(period, schedule = DEFAULT_PREFERRED_SLOT_SCHEDULE) {
  return resolvePreferredSoutenanceSlotTiming(period, schedule)?.halfDayLabel || ''
}

function formatPreferredSoutenanceSlotOptionLabel(period, schedule = DEFAULT_PREFERRED_SLOT_SCHEDULE) {
  const timing = resolvePreferredSoutenanceSlotTiming(period, schedule)

  if (!timing) {
    return String(period || '')
  }

  return timing.halfDayLabel
    ? `${timing.normalizedPeriod} · ${timing.halfDayLabel}`
    : String(timing.normalizedPeriod)
}

function formatPreferredSoutenanceSlotHoverLabel(period, schedule = DEFAULT_PREFERRED_SLOT_SCHEDULE) {
  const timing = resolvePreferredSoutenanceSlotTiming(period, schedule)

  if (!timing) {
    return ''
  }

  return [
    `Créneau ${timing.normalizedPeriod}`,
    timing.halfDayLabel,
    timing.startTime && timing.endTime ? `${timing.startTime}-${timing.endTime}` : ''
  ]
    .filter(Boolean)
    .join(' · ')
}

function buildPreferredSoutenanceSlotOptions(slotCount, schedule = DEFAULT_PREFERRED_SLOT_SCHEDULE) {
  const normalizedSlotCount = Number.isInteger(Number(slotCount)) && Number(slotCount) > 0 ? Number(slotCount) : 0

  return Array.from({ length: normalizedSlotCount }, (_, index) => {
    const slotValue = String(index + 1)
    const halfDayLabel = resolvePreferredSoutenanceSlotHalfDay(index + 1, schedule)

    return {
      value: slotValue,
      halfDayLabel,
      label: formatPreferredSoutenanceSlotOptionLabel(slotValue, schedule)
    }
  })
}

function formatPreferredSoutenanceSlotRange(values = []) {
  const normalizedValues = Array.from(
    new Set(
      (Array.isArray(values) ? values : [values])
        .map((value) => Number.parseInt(value, 10))
        .filter((value) => Number.isInteger(value) && value > 0)
        .sort((left, right) => left - right)
    )
  )

  if (normalizedValues.length === 0) {
    return ''
  }

  const ranges = []
  let rangeStart = normalizedValues[0]
  let previousValue = normalizedValues[0]

  for (let index = 1; index < normalizedValues.length; index += 1) {
    const currentValue = normalizedValues[index]

    if (currentValue === previousValue + 1) {
      previousValue = currentValue
      continue
    }

    ranges.push(rangeStart === previousValue ? String(rangeStart) : `${rangeStart}-${previousValue}`)
    rangeStart = currentValue
    previousValue = currentValue
  }

  ranges.push(rangeStart === previousValue ? String(rangeStart) : `${rangeStart}-${previousValue}`)
  return ranges.join(', ')
}

function formatPreferredSoutenanceSlotSummary(slotOptions = []) {
  const morningSlots = slotOptions
    .filter((slot) => slot?.halfDayLabel === 'AM')
    .map((slot) => slot.value)
  const afternoonSlots = slotOptions
    .filter((slot) => slot?.halfDayLabel === 'PM')
    .map((slot) => slot.value)

  return [
    morningSlots.length > 0 ? `AM: ${formatPreferredSoutenanceSlotRange(morningSlots)}` : '',
    afternoonSlots.length > 0 ? `PM: ${formatPreferredSoutenanceSlotRange(afternoonSlots)}` : ''
  ]
    .filter(Boolean)
    .join(' · ')
}

function resolvePreferredSoutenanceSlotContext(planningConfig, siteValue = '') {
  const siteConfigs = Array.isArray(planningConfig?.siteConfigs)
    ? planningConfig.siteConfigs.filter((siteConfig) => siteConfig?.active !== false)
    : []
  const fallbackSlotCount = siteConfigs.reduce((maxValue, siteConfig) => {
    const slotCount = Number.isInteger(Number(siteConfig?.numSlots)) && Number(siteConfig.numSlots) > 0
      ? Number(siteConfig.numSlots)
      : 0
    return Math.max(maxValue, slotCount)
  }, 8)
  const normalizedSiteValue = normalizeSiteLookup(siteValue)

  if (!normalizedSiteValue) {
    const fallbackSchedule = buildPreferredSoutenanceSlotSchedule({}, fallbackSlotCount)
    const fallbackSlotOptions = buildPreferredSoutenanceSlotOptions(fallbackSlotCount, fallbackSchedule)

    return {
      slotCount: fallbackSlotCount,
      label: '',
      slotSummary: formatPreferredSoutenanceSlotSummary(fallbackSlotOptions),
      getSlotLabel: (slotValue) => formatPreferredSoutenanceSlotOptionLabel(slotValue, fallbackSchedule),
      getSlotTitle: (slotValue) => formatPreferredSoutenanceSlotHoverLabel(slotValue, fallbackSchedule)
    }
  }

  const resolvedSiteConfig = siteConfigs.find((siteConfig) => {
    const candidates = [
      siteConfig?.label,
      siteConfig?.siteCode,
      siteConfig?.siteId
    ]
      .map((candidate) => normalizeSiteLookup(candidate))
      .filter(Boolean)

    return candidates.some((candidate) =>
      candidate === normalizedSiteValue ||
      candidate.includes(normalizedSiteValue) ||
      normalizedSiteValue.includes(candidate)
    )
  })

  const resolvedSlotCount = Number.isInteger(Number(resolvedSiteConfig?.numSlots)) && Number(resolvedSiteConfig.numSlots) > 0
    ? Number(resolvedSiteConfig.numSlots)
    : fallbackSlotCount
  const resolvedSchedule = buildPreferredSoutenanceSlotSchedule(resolvedSiteConfig, resolvedSlotCount)
  const resolvedSlotOptions = buildPreferredSoutenanceSlotOptions(resolvedSlotCount, resolvedSchedule)

  return {
    slotCount: resolvedSlotCount,
    label: normalizeWhitespace(resolvedSiteConfig?.label || siteValue),
    slotSummary: formatPreferredSoutenanceSlotSummary(resolvedSlotOptions),
    getSlotLabel: (slotValue) => formatPreferredSoutenanceSlotOptionLabel(slotValue, resolvedSchedule),
    getSlotTitle: (slotValue) => formatPreferredSoutenanceSlotHoverLabel(slotValue, resolvedSchedule)
  }
}

function buildRouteTargetForm(target = {}) {
  const { firstName, lastName } = splitStakeholderDraftName(target?.name)
  const roles = getDraftRoles(target?.role)
  const requestedYear = Number.parseInt(target?.year, 10)

  return {
    ...INITIAL_FORM,
    firstName,
    lastName,
    roles,
    candidateYears: roles.includes('candidat') && Number.isInteger(requestedYear)
      ? [requestedYear]
      : []
  }
}

function doesPersonCoverDraft(person, draft) {
  if (!person || person.isActive === false) {
    return false
  }

  if (normalizeFold(getPersonDisplayName(person)) !== normalizeFold(draft?.name)) {
    return false
  }

  const roleSet = normalizeRoles(person.roles)

  if (!roleSet.has(String(draft?.role || '').trim())) {
    return false
  }

  if (!normalizeWhitespace(person?.email)) {
    return false
  }

  if (draft?.role !== 'candidat') {
    return true
  }

  const draftYears = getDraftCandidateYears(draft)

  if (draftYears.length === 0) {
    return true
  }

  const personYears = getPersonCandidateYears(person)
  return draftYears.every((year) => personYears.includes(year))
}

function getDraftStatusType({ existingPerson, isResolved }) {
  if (isResolved) {
    return 'resolved'
  }

  if (existingPerson) {
    return 'enrich'
  }

  return 'create'
}

function getDraftStatusLabel(statusType) {
  switch (statusType) {
    case 'resolved':
      return 'Couvert'
    case 'enrich':
      return 'A enrichir'
    case 'create':
    default:
      return 'A créer'
  }
}

function getDraftStatusRank(statusType) {
  switch (statusType) {
    case 'enrich':
      return 0
    case 'create':
      return 1
    case 'resolved':
    default:
      return 2
  }
}

function matchesDraftStatusFilter(statusType, filter) {
  switch (filter) {
    case 'actionable':
      return statusType === 'enrich' || statusType === 'create'
    case 'enrich':
    case 'create':
    case 'resolved':
      return statusType === filter
    case 'all':
    default:
      return true
  }
}

function getDraftCompletionNeeds(draft, existingPerson) {
  if (!existingPerson) {
    return ['Créer la fiche', 'Email']
  }

  if (doesPersonCoverDraft(existingPerson, draft)) {
    return []
  }

  const needs = []
  const currentEmail = normalizeWhitespace(existingPerson?.email)

  if (!currentEmail) {
    needs.push('Email')
  } else if (isSyntheticOrganizerEmail(currentEmail)) {
    needs.push('Email réel')
  }

  const draftRole = normalizeWhitespace(draft?.role).toLowerCase()
  if (draftRole && !normalizeRoles(existingPerson?.roles).has(draftRole)) {
    needs.push('Rôle')
  }

  if (draftRole === 'candidat') {
    const personYears = getPersonCandidateYears(existingPerson)
    const missingYears = getDraftCandidateYears(draft).filter((year) => !personYears.includes(year))

    if (missingYears.length > 0) {
      needs.push(`Année${missingYears.length > 1 ? 's' : ''} ${missingYears.join(', ')}`)
    }
  }

  if (normalizeWhitespace(draft?.site) && !normalizeWhitespace(existingPerson?.site)) {
    needs.push('Site')
  }

  if (normalizeWhitespace(draft?.entreprise) && !normalizeWhitespace(existingPerson?.entreprise)) {
    needs.push('Entreprise')
  }

  return needs
}

function getDraftPrimaryActionLabel(statusType) {
  switch (statusType) {
    case 'enrich':
      return 'Compléter la fiche'
    case 'resolved':
      return 'Ouvrir la fiche'
    case 'create':
    default:
      return 'Créer la fiche'
  }
}

function canUseSyntheticCandidateEmailForDraft(draft, existingPerson) {
  return normalizeWhitespace(draft?.role).toLowerCase() === 'candidat' &&
    !normalizeWhitespace(existingPerson?.email)
}

function buildSyntheticCandidateDraftTargets(draftWorkflowItems = []) {
  const groupedTargets = new Map()

  for (const item of Array.isArray(draftWorkflowItems) ? draftWorkflowItems : []) {
    const draft = item?.draft
    const existingPerson = item?.existingPerson

    if (!canUseSyntheticCandidateEmailForDraft(draft, existingPerson)) {
      continue
    }

    const { firstName, lastName } = splitStakeholderDraftName(draft?.name)
    const targetKey = existingPerson?._id
      ? `person:${String(existingPerson._id)}`
      : `draft:${normalizeFold(draft?.name)}`
    const currentTarget = groupedTargets.get(targetKey)
    const currentCandidateYears = currentTarget?.candidateYears || []
    const nextCandidateYears = Array.from(
      new Set([...currentCandidateYears, ...getDraftCandidateYears(draft)])
    ).sort((left, right) => right - left)
    const nextRoles = Array.from(
      new Set([
        ...(Array.isArray(existingPerson?.roles) ? existingPerson.roles : []),
        ...(Array.isArray(currentTarget?.roles) ? currentTarget.roles : []),
        ...getDraftRoles(draft?.role)
      ].filter(Boolean))
    )

    groupedTargets.set(targetKey, {
      key: targetKey,
      draftIds: Array.from(new Set([...(currentTarget?.draftIds || []), draft.id])),
      drafts: [...(currentTarget?.drafts || []), draft],
      displayName: normalizeWhitespace(draft?.name),
      firstName: normalizeWhitespace(existingPerson?.firstName || currentTarget?.firstName || firstName),
      lastName: normalizeWhitespace(existingPerson?.lastName || currentTarget?.lastName || lastName),
      site: normalizeWhitespace(existingPerson?.site || currentTarget?.site || draft?.site),
      entreprise: normalizeWhitespace(existingPerson?.entreprise || currentTarget?.entreprise || draft?.entreprise),
      existingPerson: currentTarget?.existingPerson || existingPerson || null,
      candidateYears: nextCandidateYears,
      roles: nextRoles
    })
  }

  return Array.from(groupedTargets.values()).sort((left, right) =>
    String(left.displayName || '').localeCompare(String(right.displayName || ''), 'fr', {
      sensitivity: 'base'
    })
  )
}

function getRoleVisual(roles) {
  const roleSet = normalizeRoles(roles)

  if (roleSet.has('expert') && roleSet.has('chef_projet')) {
    return { key: 'both', label: 'Expert + CP', icon: ExpertRoleIcon }
  }

  if (roleSet.has('expert')) {
    return { key: 'expert', label: 'Expert', icon: ExpertRoleIcon }
  }

  if (roleSet.has('chef_projet')) {
    return { key: 'chef_projet', label: 'Chef de projet', icon: ChefProjetRoleIcon }
  }

  if (roleSet.has('candidat')) {
    return { key: 'candidat', label: 'Candidat', icon: CandidateRoleIcon }
  }

  if (roleSet.has('admin')) {
    return { key: 'admin', label: 'Admin', icon: UserIcon }
  }

  return { key: 'unknown', label: 'Sans rôle', icon: UserIcon }
}

function CollapseChevronIcon({ expanded }) {
  return (
    <ChevronDownIcon
      className={`stakeholders-collapse-icon${expanded ? ' is-open' : ''}`}
      aria-hidden='true'
      focusable='false'
    />
  )
}

function toForm(person) {
  if (!person) {
    return INITIAL_FORM
  }

  return {
    firstName: normalizeWhitespace(person.firstName),
    lastName: normalizeWhitespace(person.lastName),
    email: normalizeWhitespace(person.email),
    phone: normalizeWhitespace(person.phone),
    site: normalizeWhitespace(person.site),
    entreprise: normalizeWhitespace(person.entreprise),
    ...getPreferredSoutenanceDateInputValues(
      person.preferredSoutenanceChoices,
      person.preferredSoutenanceDates
    ),
    roles: Array.isArray(person.roles) && person.roles.length > 0 ? person.roles : ['expert'],
    isActive: person.isActive !== false,
    sendEmails: person.sendEmails !== false,
    candidateYears: Array.isArray(person.candidateYears) ? person.candidateYears : []
  }
}

function StakeholderEditorPanel({
  availablePreferredSlotCount,
  form,
  handleChange,
  handlePreferredChoiceDateChange,
  handleAssignCandidateDraftEmail,
  handleReset,
  handleRolePresetChange,
  preferredSlotContextLabel,
  preferredSlotLabelResolver,
  preferredSlotSummary,
  preferredSlotTitleResolver,
  handleSubmit,
  selectedPerson
}) {
  return (
    <form
      id='stakeholders-panel-create'
      className='stakeholders-editor'
      role='tabpanel'
      aria-labelledby='stakeholders-tab-create'
      onSubmit={handleSubmit}
    >
      <div className='stakeholders-editor-head'>
        <div className='stakeholders-editor-copy'>
          <span className='stakeholders-eyebrow'>
            {selectedPerson ? 'Modification' : 'Création'}
          </span>
          <h2>{selectedPerson ? 'Modifier la personne' : 'Créer une personne'}</h2>
          {selectedPerson ? (
            <span className='stakeholders-editor-id' title={selectedPerson._id}>
              N°: <code>{formatPersonShortId(selectedPerson)}</code>
            </span>
          ) : null}
        </div>
        <button type='button' className='secondary' onClick={handleReset}>
          Réinitialiser
        </button>
      </div>

      <div className='stakeholders-form-sections'>
        <section className='stakeholders-form-section'>
          <div className='stakeholders-form-section-head'>
            <h3>Identité</h3>
          </div>
          <div className='stakeholders-grid'>
            <label>
              Prénom
              <input value={form.firstName} onChange={(event) => handleChange('firstName', event.target.value)} />
            </label>
            <label>
              Nom
              <input value={form.lastName} onChange={(event) => handleChange('lastName', event.target.value)} />
            </label>
            <label className='full'>
              Email
              <div className='stakeholders-email-field'>
                <input
                  type='email'
                  value={form.email}
                  onChange={(event) => handleChange('email', event.target.value)}
                  placeholder='prenom.nom@domaine.ch'
                  autoComplete='email'
                />
                {form.roles.includes('candidat') ? (
                  <button
                    type='button'
                    className='secondary subtle stakeholders-email-draft-button'
                    onClick={handleAssignCandidateDraftEmail}
                  >
                    Email brouillon @tpiorganizer.ch
                  </button>
                ) : null}
              </div>
              {form.roles.includes('candidat') ? (
                <small className='stakeholders-email-draft-hint'>
                  Génère une adresse technique pour avancer dans le workflow et désactive les emails automatiques.
                </small>
              ) : null}
            </label>
            <label>
              Téléphone
              <input value={form.phone} onChange={(event) => handleChange('phone', event.target.value)} />
            </label>
          </div>
          <div className='stakeholders-toggle-row stakeholders-toggle-row--vertical'>
            <label className='stakeholders-active-toggle'>
              <span className='stakeholders-active-label'>Personne active</span>
              <BinaryToggle
                value={Boolean(form.isActive)}
                onChange={(nextValue) => handleChange('isActive', nextValue)}
                name='stakeholder-is-active'
                className='stakeholders-binary-toggle'
                ariaLabel='Personne active'
                iconOnly
                trueLabel='Active'
                falseLabel='Inactive'
                trueIcon={CheckIcon}
                falseIcon={DisableIcon}
              />
            </label>

            <label className='stakeholders-email-toggle'>
              <span className='stakeholders-email-label'>Reçoit les emails</span>
              <BinaryToggle
                value={Boolean(form.sendEmails)}
                onChange={(nextValue) => handleChange('sendEmails', nextValue)}
                name='stakeholder-send-emails'
                className='stakeholders-binary-toggle'
                ariaLabel='Reçoit les emails automatiques'
                iconOnly
                trueLabel='Emails activés'
                falseLabel='Emails désactivés'
                trueIcon={MailIcon}
                falseIcon={NoEmailIcon}
              />
            </label>
          </div>
          </section>

        <section className='stakeholders-form-section'>
          <div className='stakeholders-form-section-head'>
            <h3>Contexte</h3>
          </div>
          <div className='stakeholders-grid compact'>
            <label>
              Site
              <input value={form.site} onChange={(event) => handleChange('site', event.target.value)} />
            </label>
            <label className='full'>
              Entreprise
              <input value={form.entreprise} onChange={(event) => handleChange('entreprise', event.target.value)} />
            </label>
            <div className='stakeholders-preferred-dates full'>
              <div className='stakeholders-preferred-dates-head'>
                <span>Dates idéales de défense</span>
                <small>
                  Ajouter si nécessaire 3 préférences créneau optionnel
                </small>
              </div>
              <div className='stakeholders-preferred-dates-grid'>
                {PREFERRED_SOUTENANCE_CHOICE_FIELDS.map(({ dateField, slotField }) => {
                  const selectedSlotTitle = preferredSlotTitleResolver(form[slotField])
                  const slotSelectTitle = form[slotField] && selectedSlotTitle
                    ? selectedSlotTitle
                    : preferredSlotSummary
                      ? `Repère: ${preferredSlotSummary}`
                      : 'Sélectionnez un créneau.'

                  return (
                    <div key={dateField} className='stakeholders-preferred-date-choice'>
                      <label>
                        Date
                        <input
                          type='date'
                          value={form[dateField]}
                          onChange={(event) => handlePreferredChoiceDateChange(dateField, slotField, event.target.value)}
                        />
                      </label>
                      <label>
                        Créneau
                        <select
                          value={form[slotField]}
                          onChange={(event) => handleChange(slotField, event.target.value)}
                          disabled={!form[dateField]}
                          title={slotSelectTitle}
                        >
                          <option value=''>Non précisé</option>
                          {Array.from({
                            length: Math.max(availablePreferredSlotCount, Number.parseInt(form[slotField], 10) || 0)
                          }, (_, index) => {
                            const slotValue = String(index + 1)
                            return (
                              <option
                                key={slotValue}
                                value={slotValue}
                                title={preferredSlotTitleResolver(slotValue)}
                              >
                                {preferredSlotLabelResolver(slotValue)}
                              </option>
                            )
                          })}
                        </select>
                      </label>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
          </section>

          <section className='stakeholders-form-section'>
            <div className='stakeholders-form-section-head full'>
              <h3>Rôles</h3>
              <span className='stakeholders-role-hint'>Sélectionnez un ou plusieurs rôles</span>
            </div>
            <div className='stakeholders-role-chips full'>
              {[
                { value: 'candidat', label: 'Candidat', Icon: CandidateRoleIcon, cls: 'candidat' },
                { value: 'expert', label: 'Expert', Icon: ExpertRoleIcon, cls: 'expert' },
                { value: 'chef_projet', label: 'Chef de projet', Icon: ChefProjetRoleIcon, cls: 'chef' }
              ].map((role) => {
                const isActive = form.roles.includes(role.value)
                const isCandidatSelected = form.roles.includes('candidat')
                const isOtherRoleSelected = role.value !== 'candidat' && isCandidatSelected

                return (
                  <button
                    key={role.value}
                    type='button'
                    className={`stakeholders-role-chip ${role.cls}${isActive ? ' is-active' : ''}${isOtherRoleSelected ? ' is-blocked' : ''}`}
                    onClick={() => {
                      if (role.value === 'candidat') {
                        handleRolePresetChange(['candidat'])
                      } else if (isCandidatSelected) {
                        handleRolePresetChange([role.value])
                      } else {
                        const newRoles = isActive
                          ? form.roles.filter((r) => r !== role.value)
                          : [...form.roles, role.value]

                        if (newRoles.length > 0) {
                          handleRolePresetChange(newRoles)
                        }
                      }
                    }}
                  >
                    <role.Icon className='stakeholders-role-chip-icon' />
                    <span className='stakeholders-role-chip-label'>{role.label}</span>
                    {isActive ? <CheckIcon className='stakeholders-role-chip-check' /> : null}
                  </button>
                )
              })}
            </div>
          </section>

        {/* Années candidat - visible uniquement si le rôle candidat est sélectionné */}
        {form.roles.includes('candidat') && (
          <div className='stakeholders-candidate-years'>
            <span className='stakeholders-candidate-years-label'>Années de candidature</span>
            <p className='stakeholders-candidate-years-hint'>
              Un candidat est lié à une année précise. En cas de redoublement, ajoutez manuellement l'année.
            </p>
            <div className='stakeholders-candidate-years-chips'>
              {YEARS_CONFIG.getAvailableYears()
                .slice()
                .sort((a, b) => b - a)
                .map((y) => {
                  const isSelected = form.candidateYears.includes(y)
                  return (
                    <button
                      key={y}
                      type='button'
                      className={`stakeholders-candidate-year-chip${isSelected ? ' is-active' : ''}`}
                      onClick={() => {
                        const newYears = isSelected
                          ? form.candidateYears.filter((cy) => cy !== y)
                          : [...form.candidateYears, y]
                        handleChange('candidateYears', newYears)
                      }}
                    >
                      {y}
                      {isSelected ? <CheckIcon className='stakeholders-candidate-year-icon' /> : null}
                    </button>
                  )
                })}
            </div>
          </div>
        )}
      </div>

      <div className='stakeholders-actions'>
        <button type='submit'>
          {selectedPerson ? 'Enregistrer' : 'Créer'}
        </button>
      </div>
    </form>
  )
}

function StakeholderDraftPanel({
  candidateSyntheticDraftCount,
  draftStatusCounts,
  draftStatusFilter,
  handleBulkAssignCandidateDraftEmails,
  handleClearResolvedDrafts,
  handleDismissDraft,
  handleUseNextDraft,
  handleUseDraft,
  handleUseDraftWithSyntheticEmail,
  isAssigningDraftEmails,
  loadPendingDrafts,
  onDraftStatusFilterChange,
  visibleStakeholderDraftStatuses
}) {
  const totalDraftCount = draftStatusCounts.all || 0
  const visibleDraftCount = visibleStakeholderDraftStatuses.length

  return (
    <section
      id='stakeholders-panel-draft'
      className='stakeholders-draft-panel'
      role='tabpanel'
      aria-labelledby='stakeholders-tab-draft'
    >
      <div className='stakeholders-panel-head stakeholders-draft-panel-head'>
        <div className='stakeholders-draft-panel-copy'>
          <h2>Complétion depuis Gestion TPI</h2>
          <p>
            Finalisez emails, rôles et années manquants.
          </p>
        </div>
        <div className='stakeholders-draft-actions-top'>
          {candidateSyntheticDraftCount > 0 ? (
            <button
              type='button'
              className='secondary subtle'
              onClick={handleBulkAssignCandidateDraftEmails}
              disabled={isAssigningDraftEmails}
              title='Créer ou compléter toutes les fiches candidat sans email avec une adresse brouillon @tpiorganizer.ch'
            >
              {isAssigningDraftEmails
                ? 'Création des emails brouillons…'
                : `Email brouillon (${candidateSyntheticDraftCount})`}
            </button>
          ) : null}
          {draftStatusCounts.actionable > 0 ? (
            <button type='button' className='secondary' onClick={handleUseNextDraft}>
              Traiter le prochain
            </button>
          ) : null}
          {draftStatusCounts.resolved > 0 ? (
            <button type='button' className='secondary subtle' onClick={handleClearResolvedDrafts}>
              Retirer les couverts ({draftStatusCounts.resolved})
            </button>
          ) : null}
          <button type='button' className='secondary subtle' onClick={loadPendingDrafts}>
            Recharger
          </button>
        </div>
      </div>

      {totalDraftCount === 0 ? (
        <div className='stakeholders-empty'>
          Aucun brouillon importé depuis Gestion TPI.
        </div>
      ) : (
        <>
          <div className='stakeholders-draft-toolbar'>
            <div className='stakeholders-draft-filters' role='group' aria-label='Filtrer les brouillons de complétion'>
              {DRAFT_STATUS_FILTER_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type='button'
                  className={`stakeholders-draft-filter${draftStatusFilter === option.value ? ' is-active' : ''}`}
                  onClick={() => onDraftStatusFilterChange(option.value)}
                >
                  <span>{option.label}</span>
                  <strong>{draftStatusCounts[option.value] || 0}</strong>
                </button>
              ))}
            </div>

            <span className='stakeholders-draft-caption'>
              {visibleDraftCount === totalDraftCount
                ? `${totalDraftCount} brouillon${totalDraftCount > 1 ? 's' : ''}`
                : `${visibleDraftCount} sur ${totalDraftCount} brouillons affichés`}
            </span>
          </div>

          {visibleDraftCount === 0 ? (
            <div className='stakeholders-empty'>
              Aucun brouillon ne correspond au filtre sélectionné.
            </div>
          ) : (
            <div className='stakeholders-draft-list'>
              {visibleStakeholderDraftStatuses.map(({ draft, existingPerson, matchedPerson, completionNeeds, statusLabel, statusType }) => {
                const draftYears = getDraftCandidateYears(draft)

                return (
                  <article
                    key={draft.id}
                    className={`stakeholders-draft-card${statusType === 'resolved' ? ' is-resolved' : statusType === 'enrich' ? ' is-existing' : ''}`}
                  >
                    <div className='stakeholders-draft-card-head'>
                      <div className='stakeholders-draft-card-copy'>
                        <span className='stakeholders-draft-role'>{getStakeholderRoleLabel(draft.role)}</span>
                        <strong>{draft.name}</strong>
                      </div>
                      <span className={`stakeholders-draft-status${statusType === 'resolved' ? ' is-resolved' : statusType === 'enrich' ? ' is-existing' : ''}`}>
                        {statusLabel}
                      </span>
                    </div>

                    <div className='stakeholders-draft-meta'>
                      {draft.site ? <span>{draft.site}</span> : null}
                      {draft.entreprise ? <span>{draft.entreprise}</span> : null}
                      {draftYears.length > 0 ? (
                        <span>Année{draftYears.length > 1 ? 's' : ''}: {draftYears.join(', ')}</span>
                      ) : null}
                      {Array.isArray(draft.refs) && draft.refs.length > 0 ? (
                        <span>TPI: {draft.refs.join(', ')}</span>
                      ) : null}
                      {matchedPerson ? (
                        <span>Fiche: {getPersonDisplayName(matchedPerson)}</span>
                      ) : existingPerson ? (
                        <span>Fiche: {getPersonDisplayName(existingPerson)}</span>
                      ) : (
                        <span>Aucune fiche liée</span>
                      )}
                    </div>

                    <div className='stakeholders-draft-needs'>
                      {completionNeeds.length > 0 ? (
                        completionNeeds.map((need) => (
                          <span key={`${draft.id}-${need}`} className='stakeholders-draft-need'>
                            {need}
                          </span>
                        ))
                      ) : (
                        <span className='stakeholders-draft-need is-resolved'>Aucune action</span>
                      )}
                    </div>

                    <div className='stakeholders-draft-actions'>
                      <button type='button' className='secondary' onClick={() => handleUseDraft(draft)}>
                        {getDraftPrimaryActionLabel(statusType)}
                      </button>
                      {canUseSyntheticCandidateEmailForDraft(draft, existingPerson) ? (
                        <button
                          type='button'
                          className='secondary subtle'
                          onClick={() => handleUseDraftWithSyntheticEmail(draft)}
                          title='Préremplir un email brouillon candidat @tpiorganizer.ch et couper les emails automatiques'
                        >
                          Email brouillon
                        </button>
                      ) : null}
                      <button type='button' className='secondary subtle' onClick={() => handleDismissDraft(draft.id)}>
                        Retirer
                      </button>
                    </div>
                  </article>
                )
              })}
            </div>
          )}
        </>
      )}
    </section>
  )
}

function StakeholderImportPanel({
  fileInputRef,
  handleImportDefaultSiteChange,
  handleImportFileChange,
  handleImportPeople,
  handleImportTextChange,
  handleImportTextReset,
  handleLoadExample,
  handlePickImportFile,
  handleImportRoleToggle,
  importDefaultSite,
  importPreview,
  importReport,
  importRoles,
  importSourceLabel,
  importText,
  isImporting,
  selectedImportRolesLabel
}) {
  const recentImportedRows = Array.isArray(importReport?.imported) ? importReport.imported.slice(0, 6) : []
  const hiddenErrorCount = Math.max((importReport?.errors?.length || 0) - 5, 0)

  return (
    <section
      id='stakeholders-panel-import'
      className='stakeholders-import-panel'
      role='tabpanel'
      aria-labelledby='stakeholders-tab-import'
    >
      <div className='stakeholders-panel-head'>
        <div className='stakeholders-import-head-copy'>
          <h2>Import utilisateurs</h2>
          <p>
            Chargez un CSV/TSV, puis appliquez rôles et site.
          </p>
        </div>
        <div className='stakeholders-import-actions-top'>
          <button type='button' className='secondary subtle' onClick={handlePickImportFile}>
            Charger CSV
          </button>
        </div>
      </div>

      <input
        ref={fileInputRef}
        type='file'
        accept='.csv,.tsv,.txt'
        onChange={handleImportFileChange}
        className='stakeholders-import-file'
      />

      <div className='stakeholders-import-overview'>
        <article className='stakeholders-import-overview-card'>
          <span>Source</span>
          <strong>{importSourceLabel || (importText.trim() ? 'Saisie manuelle' : 'Aucune source')}</strong>
        </article>
        <article className='stakeholders-import-overview-card'>
          <span>Lignes détectées</span>
          <strong>{importPreview.dataRowCount}</strong>
        </article>
        <article className='stakeholders-import-overview-card'>
          <span>Séparateur</span>
          <strong>{importPreview.delimiterLabel}</strong>
        </article>
        <article className='stakeholders-import-overview-card'>
          <span>Rôles appliqués</span>
          <strong>{selectedImportRolesLabel}</strong>
        </article>
      </div>

      <div className='stakeholders-import-config'>
        <label className='stakeholders-import-config-field'>
          <span>Site par défaut</span>
          <select value={importDefaultSite} onChange={handleImportDefaultSiteChange}>
            <option value=''>Ne pas forcer</option>
            {SITE_OPTIONS.map((site) => (
              <option key={site} value={site}>{site}</option>
            ))}
          </select>
          <small>Utilisé seulement si la colonne `site` est vide.</small>
        </label>

        <div className='stakeholders-import-config-field'>
          <span>Rôles à ajouter</span>
          <div className='stakeholders-import-role-row'>
            {IMPORT_ROLE_OPTIONS.map((role) => (
              <button
                key={role.value}
                type='button'
                className={`stakeholders-import-role-pill${importRoles.includes(role.value) ? ' is-active' : ''}`}
                onClick={() => handleImportRoleToggle(role.value)}
                aria-pressed={importRoles.includes(role.value)}
              >
                <span>{role.label}</span>
              </button>
            ))}
          </div>
          <small>Les rôles sélectionnés sont fusionnés avec ceux déjà présents sur la fiche.</small>
        </div>
      </div>

      <div className='stakeholders-import-format-note'>
        <strong>Colonnes reconnues</strong>
        <span>
          Nom: Expert, Nom, Nom complet, Personne · Email: Expert mail, email, mail ·
          Téléphone: tel, téléphone, phone, mobile · Site: site, lieu
        </span>
      </div>

      <label className='stakeholders-import-text-shell'>
        <span>Contenu à importer</span>
        <textarea
          className='stakeholders-import-text'
          value={importText}
          onChange={handleImportTextChange}
          rows={14}
          spellCheck='false'
          aria-label='Liste à importer'
        />
      </label>

      {!importPreview.isEmpty ? (
        <div className={`stakeholders-import-preview${importPreview.canImport ? '' : ' is-warning'}`}>
          <div className='stakeholders-import-preview-head'>
            <strong>Aperçu avant import</strong>
            <span>
              {importPreview.lineCount} ligne{importPreview.lineCount > 1 ? 's' : ''} lue{importPreview.lineCount > 1 ? 's' : ''} ·{' '}
              {importPreview.recognizedFields.length > 0
                ? importPreview.recognizedFields.map((field) => IMPORT_FIELD_LABELS[field]).join(', ')
                : 'aucune colonne reconnue'}
            </span>
          </div>

          {importPreview.missingRequiredFields.length > 0 ? (
            <div className='stakeholders-import-warning' role='status'>
              Colonnes obligatoires manquantes: {importPreview.missingRequiredFields.map((field) => IMPORT_FIELD_LABELS[field]).join(', ')}.
            </div>
          ) : null}

          {importPreview.sampleRows.length > 0 ? (
            <div className='stakeholders-import-preview-table-shell'>
              <table className='stakeholders-import-preview-table'>
                <thead>
                  <tr>
                    <th>Ligne</th>
                    <th>Nom</th>
                    <th>Email</th>
                    <th>Téléphone</th>
                    <th>Site</th>
                  </tr>
                </thead>
                <tbody>
                  {importPreview.sampleRows.map((row) => (
                    <tr key={`import-preview-${row.lineNumber}`}>
                      <td>{row.lineNumber}</td>
                      <td>{row.name || '—'}</td>
                      <td>{row.email || '—'}</td>
                      <td>{row.phone || '—'}</td>
                      <td>{row.site || importDefaultSite || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </div>
      ) : null}

      <div className='stakeholders-import-actions'>
        <button type='button' className='secondary subtle' onClick={handleImportTextReset}>
          Vider le champ
        </button>
        <button type='button' className='secondary subtle' onClick={handleLoadExample}>
          Charger l'exemple
        </button>
        <button type='button' className='subtle-primary' onClick={handleImportPeople} disabled={isImporting || !importPreview.canImport}>
          {isImporting ? 'Import en cours…' : 'Importer la liste'}
        </button>
      </div>

      {importReport && (
        <div className='stakeholders-import-result' aria-live='polite'>
          <div className='stakeholders-import-result-head'>
            <strong>Import terminé</strong>
            <span>{importReport.rowsProcessed || 0} ligne{(importReport.rowsProcessed || 0) > 1 ? 's' : ''} traitée{(importReport.rowsProcessed || 0) > 1 ? 's' : ''}</span>
          </div>

          <div className='stakeholders-import-metrics'>
            <article className='stakeholders-import-metric is-created'>
              <span>Créées</span>
              <strong>{importReport.created || 0}</strong>
            </article>
            <article className='stakeholders-import-metric is-updated'>
              <span>Mises à jour</span>
              <strong>{importReport.updated || 0}</strong>
            </article>
            <article className='stakeholders-import-metric is-duplicate'>
              <span>Doublons</span>
              <strong>{importReport.duplicates || 0}</strong>
            </article>
            <article className='stakeholders-import-metric is-skipped'>
              <span>Ignorées</span>
              <strong>{importReport.skipped || 0}</strong>
            </article>
          </div>

          {recentImportedRows.length > 0 ? (
            <div className='stakeholders-import-activity'>
              <strong>Dernières lignes traitées</strong>
              <ul className='stakeholders-import-activity-list'>
                {recentImportedRows.map((entry, index) => (
                  <li key={`${entry.line}-${entry.email}-${index}`}>
                    <span className={`stakeholders-import-status is-${entry.status || 'created'}`}>
                      {IMPORT_STATUS_LABELS[entry.status] || 'Traitée'}
                    </span>
                    <strong>{entry.name || 'Nom absent'}</strong>
                    <small>Ligne {entry.line} · {entry.email || 'sans email'}</small>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {Array.isArray(importReport.errors) && importReport.errors.length > 0 && (
            <div className='stakeholders-import-error-block'>
              <strong>Erreurs détectées</strong>
              <ul className='stakeholders-import-errors'>
                {importReport.errors.slice(0, 5).map((entry, index) => (
                  <li key={`${entry.line}-${index}`}>
                    <strong>Ligne {entry.line}</strong>
                    <span>{entry.error}</span>
                  </li>
                ))}
              </ul>
              {hiddenErrorCount > 0 ? (
                <span className='stakeholders-import-errors-caption'>
                  +{hiddenErrorCount} erreur{hiddenErrorCount > 1 ? 's' : ''} supplémentaire{hiddenErrorCount > 1 ? 's' : ''}
                </span>
              ) : null}
            </div>
          )}
        </div>
      )}
    </section>
  )
}

function MergePreviewModal({
  isSubmitting,
  onCancel,
  onConfirm,
  previewData
}) {
  if (!previewData) {
    return null
  }

  const {
    changedCount,
    identityMismatchCount,
    primaryPerson,
    rows,
    sourceCount,
    sourcePeople
  } = previewData
  const targetName = getPersonDisplayName(primaryPerson) || 'Fiche cible'
  const targetEmail = formatMergePreviewText(primaryPerson?.email)

  return (
    <div
      className='stakeholders-merge-preview-backdrop'
      role='presentation'
      onMouseDown={onCancel}
    >
      <div
        className='stakeholders-merge-preview-modal'
        role='dialog'
        aria-modal='true'
        aria-labelledby='stakeholders-merge-preview-title'
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className='stakeholders-merge-preview-head'>
          <div className='stakeholders-merge-preview-copy'>
            <span className='stakeholders-eyebrow'>Aperçu de fusion</span>
            <h2 id='stakeholders-merge-preview-title'>Conserver la fiche cible</h2>
            <p>
              Cette fiche reste la référence. Les autres fiches seront fusionnées,
              puis supprimés après transfert des liens.
            </p>
            {identityMismatchCount > 0 ? (
              <p className='stakeholders-merge-preview-warning'>
                Fusion manuelle: {identityMismatchCount} fiche{identityMismatchCount > 1 ? 's' : ''} sélectionnée{identityMismatchCount > 1 ? 's' : ''} n'ont pas exactement le même prénom et nom.
              </p>
            ) : null}
          </div>
          <button type='button' className='secondary subtle' onClick={onCancel}>
            Fermer
          </button>
        </div>

        <div className='stakeholders-merge-preview-summary'>
          <article>
            <span>Fiche conservée</span>
            <strong>{targetName}</strong>
            <small title={targetEmail}>{targetEmail}</small>
            <small title={primaryPerson?._id || ''}>
              N°: <code>{formatPersonShortId(primaryPerson)}</code>
            </small>
          </article>
          <article>
            <span>Doublons source</span>
            <strong>{sourceCount} fiche{sourceCount > 1 ? 's' : ''}</strong>
            <small>{changedCount} champ{changedCount > 1 ? 's' : ''} impacté{changedCount > 1 ? 's' : ''}</small>
            <small>Les liens TPI, slots et magic links seront reroutés.</small>
          </article>
        </div>

        <div className='stakeholders-merge-preview-sources'>
          <h3>Fiches sources</h3>
          <div className='stakeholders-merge-preview-source-list'>
            {sourcePeople.map((person) => {
              const name = getPersonDisplayName(person) || 'Sans nom'
              return (
                <article key={person._id} className='stakeholders-merge-preview-source-card'>
                  <strong>{name}</strong>
                  <span title={person.email || ''}>{formatMergePreviewText(person.email)}</span>
                  <small title={person._id}>
                    N°: <code>{formatPersonShortId(person)}</code>
                  </small>
                </article>
              )
            })}
          </div>
        </div>

        <div className='stakeholders-merge-preview-table-shell'>
          <table className='stakeholders-merge-preview-table'>
            <thead>
              <tr>
                <th>Champ</th>
                <th>Actuel</th>
                <th>Après fusion</th>
                <th>Statut</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.key}>
                  <td>{row.label}</td>
                  <td>{row.before}</td>
                  <td>{row.after}</td>
                  <td>
                    <span className='stakeholders-merge-preview-status'>
                      {row.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className='stakeholders-merge-preview-actions'>
          <button type='button' className='secondary' onClick={onCancel} disabled={isSubmitting}>
            Annuler
          </button>
          <button type='button' className='subtle-primary' onClick={onConfirm} disabled={isSubmitting}>
            {isSubmitting ? 'Fusion en cours…' : 'Fusionner maintenant'}
          </button>
        </div>
      </div>
    </div>
  )
}

const PartiesPrenantes = () => {
  const location = useLocation()
  const navigate = useNavigate()
  const fileInputRef = useRef(null)
  const lastRouteSelectionRef = useRef('')
  const [people, setPeople] = useState([])
  const [pendingDrafts, setPendingDrafts] = useState([])
  const [isLoading, setIsLoading] = useState(false)
  const [hasAttemptedPeopleLoad, setHasAttemptedPeopleLoad] = useState(false)
  const [error, setError] = useState(null)
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState('')
  const [siteFilter, setSiteFilter] = useState('')
  const [emailFilter, setEmailFilter] = useState('') // '' = tous, 'yes' = reçoit emails, 'no' = ne reçoit pas
  const [selectedPerson, setSelectedPerson] = useState(null)
  const [form, setForm] = useState(INITIAL_FORM)
  const [importText, setImportText] = useState('')
  const [isImporting, setIsImporting] = useState(false)
  const [importReport, setImportReport] = useState(null)
  const [importRoles, setImportRoles] = useState(INITIAL_IMPORT_ROLES)
  const [importDefaultSite, setImportDefaultSite] = useState('')
  const [importSourceLabel, setImportSourceLabel] = useState('')
  const [activeStakeholderTab, setActiveStakeholderTab] = useState(() => {
    const params = new URLSearchParams(location.search)
    return normalizeWorkbenchTab(params.get('tab'))
  })
  const [draftStatusFilter, setDraftStatusFilter] = useState(() => {
    const params = new URLSearchParams(location.search)
    return normalizeDraftStatusFilter(params.get('draftStatus'))
  })
  const [isPeopleOpen, setIsPeopleOpen] = useState(true)
  const [isWorkbenchOpen, setIsWorkbenchOpen] = useState(true)
  const [showOnlyDuplicates, setShowOnlyDuplicates] = useState(false)
  const [isMergeMode, setIsMergeMode] = useState(false)
  const [mergeSelectionIds, setMergeSelectionIds] = useState([])
  const [mergePrimaryId, setMergePrimaryId] = useState('')
  const [mergePreview, setMergePreview] = useState(null)
  const [isMergingPeople, setIsMergingPeople] = useState(false)
  const [isAssigningDraftEmails, setIsAssigningDraftEmails] = useState(false)
  const [preferredSoutenancePlanningConfig, setPreferredSoutenancePlanningConfig] = useState(null)
  const routeContext = useMemo(() => {
    const params = new URLSearchParams(location.search)

    return {
      personId: params.get('personId') || '',
      name: params.get('name') || '',
      role: params.get('role') || '',
      year: params.get('year') || '',
      returnTo: normalizeLocalReturnPath(params.get('returnTo') || '')
    }
  }, [location.search])
  const preferredSoutenancePlanningYear = useMemo(() => {
    const routeYear = Number.parseInt(routeContext.year, 10)
    if (Number.isInteger(routeYear)) {
      return routeYear
    }

    const storedYear = Number.parseInt(readStorageValue(STORAGE_KEYS.PLANNING_SELECTED_YEAR, ''), 10)
    if (Number.isInteger(storedYear)) {
      return storedYear
    }

    const candidateYears = Array.isArray(form.candidateYears)
      ? form.candidateYears.map((year) => Number.parseInt(year, 10)).filter((year) => Number.isInteger(year))
      : []
    if (candidateYears.length > 0) {
      return Math.max(...candidateYears)
    }

    return YEARS_CONFIG.getCurrentYear()
  }, [form.candidateYears, routeContext.year])
  const preferredSoutenanceSlotContext = useMemo(
    () => resolvePreferredSoutenanceSlotContext(preferredSoutenancePlanningConfig, form.site),
    [form.site, preferredSoutenancePlanningConfig]
  )

  const loadPendingDrafts = useCallback(() => {
    setPendingDrafts(readJSONListValue(STORAGE_KEYS.PENDING_STAKEHOLDER_IMPORT, []))
  }, [])

  useEffect(() => {
    let isCancelled = false

    planningConfigService.getByYear(preferredSoutenancePlanningYear)
      .then((config) => {
        if (!isCancelled) {
          setPreferredSoutenancePlanningConfig(config || null)
        }
      })
      .catch(() => {
        if (!isCancelled) {
          setPreferredSoutenancePlanningConfig(null)
        }
      })

    return () => {
      isCancelled = true
    }
  }, [preferredSoutenancePlanningYear])

  const stakeholderDraftStatuses = useMemo(() => {
    return pendingDrafts.map((draft) => {
      const existingPerson = findPersonByDraftName(people, draft)
      const matchedPerson = doesPersonCoverDraft(existingPerson, draft) ? existingPerson : null

      return {
        draft,
        existingPerson,
        matchedPerson,
        isResolved: Boolean(matchedPerson)
      }
    })
  }, [pendingDrafts, people])

  const draftWorkflowItems = useMemo(() => {
    return stakeholderDraftStatuses
      .map(({ draft, existingPerson, matchedPerson, isResolved }) => {
        const statusType = getDraftStatusType({ existingPerson, isResolved })

        return {
          draft,
          existingPerson,
          matchedPerson,
          isResolved,
          statusType,
          statusLabel: getDraftStatusLabel(statusType),
          completionNeeds: getDraftCompletionNeeds(draft, existingPerson)
        }
      })
      .sort((left, right) => {
        const rankDelta = getDraftStatusRank(left.statusType) - getDraftStatusRank(right.statusType)
        if (rankDelta !== 0) {
          return rankDelta
        }

        const roleDelta = getStakeholderRoleLabel(left.draft?.role).localeCompare(
          getStakeholderRoleLabel(right.draft?.role),
          'fr',
          { sensitivity: 'base' }
        )

        if (roleDelta !== 0) {
          return roleDelta
        }

        return String(left.draft?.name || '').localeCompare(String(right.draft?.name || ''), 'fr', {
          sensitivity: 'base'
        })
      })
  }, [stakeholderDraftStatuses])

  const draftStatusCounts = useMemo(() => {
    return draftWorkflowItems.reduce((counts, item) => {
      counts.all += 1

      if (item.statusType === 'enrich') {
        counts.enrich += 1
        counts.actionable += 1
      } else if (item.statusType === 'create') {
        counts.create += 1
        counts.actionable += 1
      } else if (item.statusType === 'resolved') {
        counts.resolved += 1
      }

      return counts
    }, {
      all: 0,
      actionable: 0,
      enrich: 0,
      create: 0,
      resolved: 0
    })
  }, [draftWorkflowItems])

  const visibleStakeholderDraftStatuses = useMemo(
    () => draftWorkflowItems.filter((item) => matchesDraftStatusFilter(item.statusType, draftStatusFilter)),
    [draftStatusFilter, draftWorkflowItems]
  )

  const nextActionableDraft = useMemo(
    () => draftWorkflowItems.find((item) => item.statusType !== 'resolved') || null,
    [draftWorkflowItems]
  )

  const candidateSyntheticDraftTargets = useMemo(
    () => buildSyntheticCandidateDraftTargets(draftWorkflowItems),
    [draftWorkflowItems]
  )

  const resolvedDraftIds = useMemo(
    () => new Set(draftWorkflowItems.filter((item) => item.statusType === 'resolved').map((item) => item.draft.id)),
    [draftWorkflowItems]
  )

  const duplicateGroups = useMemo(() => {
    const groups = new Map()

    people.forEach((person) => {
      const key = getPersonIdentityKey(person)

      if (!key) {
        return
      }

      const current = groups.get(key) || []
      current.push(person)
      groups.set(key, current)
    })

    return Array.from(groups.values()).filter((group) => group.length > 1)
  }, [people])

  const duplicateGroupMap = useMemo(() => {
    const map = new Map()

    duplicateGroups.forEach((group) => {
      group.forEach((person) => {
        map.set(person._id, group)
      })
    })

    return map
  }, [duplicateGroups])

  const duplicateIdentitySet = useMemo(
    () => new Set(duplicateGroups.map((group) => getPersonIdentityKey(group[0]))),
    [duplicateGroups]
  )

  const peopleById = useMemo(() => {
    return new Map((Array.isArray(people) ? people : []).map((person) => [String(person?._id), person]))
  }, [people])

  const importPreview = useMemo(() => buildImportPreview(importText), [importText])
  const selectedImportRolesLabel = useMemo(
    () => importRoles.map((role) => getStakeholderRoleLabel(role)).filter(Boolean).join(', ') || 'Aucun rôle',
    [importRoles]
  )

  const visiblePeople = useMemo(() => {
    if (!showOnlyDuplicates) {
      return sortPeopleByName(people)
    }

    return sortPeopleByName(
      people.filter((person) => duplicateIdentitySet.has(getPersonIdentityKey(person)))
    )
  }, [duplicateIdentitySet, people, showOnlyDuplicates])

  const stakeholderOverviewStats = useMemo(() => {
    const activePeopleCount = people.filter((person) => person?.isActive !== false).length
    const hasActiveFilters = Boolean(search.trim() || roleFilter || siteFilter || emailFilter || showOnlyDuplicates)

    return [
      {
        label: 'Fiches',
        value: people.length,
        detail: `${activePeopleCount} active${activePeopleCount === 1 ? '' : 's'}`,
        tone: 'primary',
        Icon: UsersIcon
      },
      {
        label: 'À compléter',
        value: draftStatusCounts.actionable,
        detail: `${draftStatusCounts.resolved} couverte${draftStatusCounts.resolved === 1 ? '' : 's'}`,
        tone: draftStatusCounts.actionable > 0 ? 'warning' : 'success',
        Icon: ClipboardIcon
      },
      {
        label: 'Doublons',
        value: duplicateGroups.length,
        detail: showOnlyDuplicates ? 'vue dédiée' : 'groupes détectés',
        tone: duplicateGroups.length > 0 ? 'duplicate' : 'neutral',
        Icon: AlertIcon
      },
      {
        label: 'Affichées',
        value: visiblePeople.length,
        detail: hasActiveFilters ? 'après filtres' : 'liste actuelle',
        tone: 'neutral',
        Icon: SearchIcon
      }
    ]
  }, [
    draftStatusCounts.actionable,
    draftStatusCounts.resolved,
    duplicateGroups.length,
    emailFilter,
    people,
    roleFilter,
    search,
    showOnlyDuplicates,
    siteFilter,
    visiblePeople.length
  ])

  const mergePreviewData = useMemo(() => {
    if (!mergePreview) {
      return null
    }

    return buildMergePreviewData(mergePreview.primaryPerson, mergePreview.duplicateGroup)
  }, [mergePreview])

  const mergeSelectionPeople = useMemo(
    () => mergeSelectionIds.map((personId) => peopleById.get(String(personId))).filter(Boolean),
    [mergeSelectionIds, peopleById]
  )

  const mergePrimaryPerson = useMemo(() => {
    const primaryPerson = peopleById.get(String(mergePrimaryId))
    return primaryPerson || mergeSelectionPeople[0] || null
  }, [mergePrimaryId, mergeSelectionPeople, peopleById])

  const canPreviewSelectionMerge = mergeSelectionPeople.length > 1 && Boolean(mergePrimaryPerson?._id)

  const loadPeople = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    try {
      const filters = {
        search: search.trim() || undefined,
        role: roleFilter || undefined,
        site: siteFilter || undefined,
        sendEmails: emailFilter === 'yes' ? true : emailFilter === 'no' ? false : undefined
      }

      const data = await personService.getAll(filters)
      setPeople(Array.isArray(data) ? data : [])
    } catch (err) {
      setError(err?.data?.error || err?.message || 'Impossible de charger les parties prenantes.')
      setPeople([])
    } finally {
      setIsLoading(false)
      setHasAttemptedPeopleLoad(true)
    }
  }, [emailFilter, roleFilter, search, siteFilter])

  useEffect(() => {
    void loadPeople()
  }, [loadPeople])

  useEffect(() => {
    loadPendingDrafts()
  }, [loadPendingDrafts])

  useEffect(() => {
    if (activeStakeholderTab === 'draft') {
      loadPendingDrafts()
    }
  }, [activeStakeholderTab, loadPendingDrafts])

  useEffect(() => {
    setMergeSelectionIds((previousIds) => previousIds.filter((personId) => peopleById.has(String(personId))))
  }, [peopleById])

  useEffect(() => {
    setMergePrimaryId((previousId) => (mergeSelectionIds.includes(previousId) ? previousId : mergeSelectionIds[0] || ''))
  }, [mergeSelectionIds])

  useEffect(() => {
    const params = new URLSearchParams(location.search)
    const requestedTab = params.get('tab')
    const requestedDraftStatus = params.get('draftStatus')

    if (requestedTab) {
      setActiveStakeholderTab(normalizeWorkbenchTab(requestedTab))
      setIsWorkbenchOpen(true)
    }

    if (requestedDraftStatus) {
      setDraftStatusFilter(normalizeDraftStatusFilter(requestedDraftStatus))
    }
  }, [location.search])

  const handleChange = useCallback((field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }))
  }, [])

  const handlePreferredChoiceDateChange = useCallback((dateField, slotField, value) => {
    setForm((previousForm) => ({
      ...previousForm,
      [dateField]: value,
      [slotField]: value ? previousForm[slotField] : ''
    }))
  }, [])

  const handleRolePresetChange = useCallback((roles) => {
    setForm((prev) => ({
      ...prev,
      roles: Array.isArray(roles) && roles.length > 0 ? roles : ['expert']
    }))
  }, [])

  const handleImportRoleToggle = useCallback((role) => {
    setImportRoles((prev) => {
      const nextRoles = prev.includes(role)
        ? prev.filter((currentRole) => currentRole !== role)
        : [...prev, role]

      return nextRoles.length > 0 ? nextRoles : INITIAL_IMPORT_ROLES
    })
    setImportReport(null)
  }, [])

  const handleImportDefaultSiteChange = useCallback((event) => {
    setImportDefaultSite(event.target.value)
    setImportReport(null)
  }, [])

  const handleImportTextChange = useCallback((event) => {
    const nextValue = event.target.value
    setImportText(nextValue)
    setImportReport(null)
    setImportSourceLabel((previousValue) => {
      if (!nextValue.trim()) {
        return ''
      }

      return previousValue || 'Saisie manuelle'
    })
  }, [])

  const handleSelect = useCallback((person) => {
    setSelectedPerson(person)
    setForm(toForm(person))
    setActiveStakeholderTab('create')
    setIsPeopleOpen(true)
    setIsWorkbenchOpen(true)
  }, [])

  const handleOpenRouteTarget = useCallback((target) => {
    setSelectedPerson(null)
    setForm(buildRouteTargetForm(target))
    setActiveStakeholderTab('create')
    setIsPeopleOpen(true)
    setIsWorkbenchOpen(true)
  }, [])

  const clearMergeSelection = useCallback(() => {
    setMergeSelectionIds([])
    setMergePrimaryId('')
  }, [])

  const handleToggleMergeMode = useCallback(() => {
    setIsMergeMode((currentValue) => {
      const nextValue = !currentValue

      if (nextValue) {
        setIsPeopleOpen(true)
        window.requestAnimationFrame(() => {
          document.getElementById('stakeholders-list-content')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
        })

        toast.info('Mode fusion activé. Coche les fiches à fusionner puis choisis la fiche à conserver.')
      } else {
        clearMergeSelection()
        toast.info('Mode fusion désactivé.')
      }

      return nextValue
    })
  }, [clearMergeSelection])

  const handleToggleMergeSelection = useCallback((person) => {
    const personId = String(person?._id || '')

    if (!personId) {
      return
    }

    setMergeSelectionIds((previousIds) => {
      const normalizedPreviousIds = previousIds.map((value) => String(value))
      const isSelected = normalizedPreviousIds.includes(personId)

      if (isSelected) {
        return normalizedPreviousIds.filter((value) => value !== personId)
      }

      return [...normalizedPreviousIds, personId]
    })

    setMergePrimaryId((currentPrimaryId) => currentPrimaryId || personId)
  }, [])

  const handleSetMergePrimary = useCallback((person) => {
    const personId = String(person?._id || '')

    if (!mergeSelectionIds.includes(personId)) {
      return
    }

    setMergePrimaryId(personId)
  }, [mergeSelectionIds])

  const handleOpenMergePreview = useCallback((primaryPerson, duplicateGroup = [], options = {}) => {
    const groupPeople = Array.isArray(duplicateGroup) ? duplicateGroup : []
    const sourcePeople = groupPeople.filter((person) => String(person?._id) !== String(primaryPerson?._id))

    if (!primaryPerson?._id || sourcePeople.length === 0) {
      toast.error('Aucune sélection à prévisualiser.')
      return
    }

    setMergePreview({
      primaryPerson,
      duplicateGroup: groupPeople,
      allowDifferentIdentity: options.allowDifferentIdentity === true
    })
  }, [])

  const handlePreviewSelectionMerge = useCallback(() => {
    if (!canPreviewSelectionMerge || !mergePrimaryPerson) {
      toast.info('Sélectionne au moins deux fiches pour lancer une fusion.')
      return
    }

    const primaryIdentityKey = getPersonIdentityKey(mergePrimaryPerson)
    const allowDifferentIdentity = mergeSelectionPeople.some((person) => getPersonIdentityKey(person) !== primaryIdentityKey)

    handleOpenMergePreview(mergePrimaryPerson, mergeSelectionPeople, {
      allowDifferentIdentity
    })
  }, [canPreviewSelectionMerge, handleOpenMergePreview, mergePrimaryPerson, mergeSelectionPeople])

  const handleCloseMergePreview = useCallback(() => {
    setMergePreview(null)
  }, [])

  const handleReset = useCallback(() => {
    setSelectedPerson(null)
    setForm(INITIAL_FORM)
    setActiveStakeholderTab('create')
  }, [])

  const handleExecuteMergeDuplicates = useCallback(async (primaryPerson, duplicateGroup = [], options = {}) => {
    const groupPeople = Array.isArray(duplicateGroup) ? duplicateGroup : []
    const sourceIds = groupPeople
      .filter((person) => String(person?._id) !== String(primaryPerson?._id))
      .map((person) => String(person?._id))
    const allowDifferentIdentity = options?.allowDifferentIdentity === true

    if (!primaryPerson?._id || sourceIds.length === 0) {
      toast.error('Aucune sélection à fusionner.')
      return false
    }

    setIsMergingPeople(true)

    try {
      const result = await personService.merge(String(primaryPerson._id), sourceIds, {
        allowDifferentIdentity
      })
      toast.success(
        `Fusion effectuée. ${result?.deletedCount || sourceIds.length} fiche${(result?.deletedCount || sourceIds.length) > 1 ? 's' : ''} supprimée${(result?.deletedCount || sourceIds.length) > 1 ? 's' : ''}.`
      )
      await loadPeople()
      handleReset()
      return true
    } catch (err) {
      toast.error(err?.data?.error || err?.message || 'Fusion impossible.')
      return false
    } finally {
      setIsMergingPeople(false)
    }
  }, [handleReset, loadPeople])

  const handleConfirmMergePreview = useCallback(async () => {
    if (!mergePreview) {
      return
    }

    const merged = await handleExecuteMergeDuplicates(mergePreview.primaryPerson, mergePreview.duplicateGroup, {
      allowDifferentIdentity: mergePreview.allowDifferentIdentity === true
    })
    if (merged) {
      clearMergeSelection()
      handleCloseMergePreview()
    }
  }, [clearMergeSelection, handleCloseMergePreview, handleExecuteMergeDuplicates, mergePreview])

  useEffect(() => {
    if (!hasAttemptedPeopleLoad) {
      return
    }

    if (!routeContext.personId && !routeContext.name) {
      lastRouteSelectionRef.current = ''
      return
    }

    const routeSelectionKey = `${routeContext.personId}|${routeContext.name}|${routeContext.role}|${routeContext.year}`
    const matchedPerson = findPersonByRouteTarget(people, routeContext)

    if (!matchedPerson && !routeContext.name) {
      return
    }

    if (!matchedPerson) {
      const prefillKey = `prefill:${routeSelectionKey}`

      if (lastRouteSelectionRef.current === prefillKey) {
        return
      }

      lastRouteSelectionRef.current = prefillKey
      handleOpenRouteTarget(routeContext)
      toast.info('Aucune fiche trouvée. Le formulaire a été prérempli pour créer la partie prenante.')
      return
    }

    const matchKey = `match:${routeSelectionKey}:${matchedPerson._id}`
    if (lastRouteSelectionRef.current === matchKey) {
      return
    }

    lastRouteSelectionRef.current = matchKey
    handleSelect(matchedPerson)

    window.requestAnimationFrame(() => {
      const row = document.querySelector(`[data-stakeholder-id="${matchedPerson._id}"]`)
      row?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    })
  }, [handleOpenRouteTarget, handleSelect, hasAttemptedPeopleLoad, people, routeContext])

  const removePendingDrafts = useCallback((predicate) => {
    setPendingDrafts((currentDrafts) => {
      const nextDrafts = currentDrafts.filter((draft) => !predicate(draft))
      writeJSONValue(STORAGE_KEYS.PENDING_STAKEHOLDER_IMPORT, nextDrafts)
      return nextDrafts
    })
  }, [])

  const handleOpenDraftWorkbench = useCallback((filter = 'actionable') => {
    setDraftStatusFilter(normalizeDraftStatusFilter(filter))
    setActiveStakeholderTab('draft')
    setIsWorkbenchOpen(true)
  }, [])

  const handleDraftStatusFilterChange = useCallback((filter) => {
    setDraftStatusFilter(normalizeDraftStatusFilter(filter))
  }, [])

  const handleClearResolvedDrafts = useCallback(() => {
    if (resolvedDraftIds.size === 0) {
      toast.info('Aucun brouillon couvert à retirer.')
      return
    }

    removePendingDrafts((draft) => resolvedDraftIds.has(draft.id))
    toast.success(
      `${resolvedDraftIds.size} brouillon${resolvedDraftIds.size > 1 ? 's' : ''} couvert${resolvedDraftIds.size > 1 ? 's' : ''} retiré${resolvedDraftIds.size > 1 ? 's' : ''}.`
    )
  }, [removePendingDrafts, resolvedDraftIds])

  const handleImportTextReset = useCallback(() => {
    setImportText('')
    setImportReport(null)
    setImportSourceLabel('')
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }, [])

  const handleLoadExample = useCallback(() => {
    setImportText(EXPERT_IMPORT_EXAMPLE)
    setImportReport(null)
    setImportSourceLabel('Exemple intégré')
    toast.info('Exemple chargé dans le champ.')
  }, [])

  const openDraftInEditor = useCallback((draft, options = {}) => {
    const existingPerson = findPersonByDraftName(people, draft)
    const { firstName, lastName } = splitStakeholderDraftName(draft?.name)
    const draftCandidateYears = getDraftCandidateYears(draft)
    const useSyntheticEmail = options.useSyntheticEmail === true &&
      normalizeWhitespace(draft?.role).toLowerCase() === 'candidat'
    const syntheticEmail = useSyntheticEmail
      ? buildSyntheticStakeholderEmail({
          firstName: existingPerson?.firstName || firstName,
          lastName: existingPerson?.lastName || lastName,
          role: 'candidat',
          year: draftCandidateYears[0] || draft?.year || new Date().getFullYear(),
          seed: `${draft?.id || ''}|${existingPerson?._id || ''}`
        })
      : ''

    setActiveStakeholderTab('create')
    setIsWorkbenchOpen(true)

    if (existingPerson) {
      const mergedRoles = Array.from(
        new Set([...(Array.isArray(existingPerson.roles) ? existingPerson.roles : []), draft.role].filter(Boolean))
      )
      const mergedCandidateYears = Array.from(
        new Set([...getPersonCandidateYears(existingPerson), ...draftCandidateYears])
      ).sort((left, right) => right - left)
      const existingEmail = normalizeWhitespace(existingPerson.email)

      setSelectedPerson(existingPerson)
      setForm({
        ...toForm(existingPerson),
        firstName: existingPerson.firstName || firstName,
        lastName: existingPerson.lastName || lastName,
        email: existingEmail || syntheticEmail,
        site: existingPerson.site || draft.site || '',
        entreprise: existingPerson.entreprise || draft.entreprise || '',
        roles: mergedRoles.length > 0 ? mergedRoles : getDraftRoles(draft.role),
        candidateYears: mergedCandidateYears,
        sendEmails: useSyntheticEmail ? false : existingPerson.sendEmails !== false
      })
      toast.info(
        useSyntheticEmail && !existingEmail
          ? 'Fiche existante chargée avec un email brouillon candidat et les emails automatiques désactivés.'
          : 'Fiche existante chargée pour complétion.'
      )
      return
    }

    setSelectedPerson(null)
    setForm({
      ...INITIAL_FORM,
      firstName,
      lastName,
      email: syntheticEmail,
      site: draft.site || '',
      entreprise: draft.entreprise || '',
      roles: getDraftRoles(draft.role),
      candidateYears: draftCandidateYears,
      sendEmails: useSyntheticEmail ? false : INITIAL_FORM.sendEmails
    })
    toast.info(
      useSyntheticEmail
        ? 'Brouillon chargé avec un email candidat @tpiorganizer.ch et les emails automatiques désactivés.'
        : 'Brouillon chargé dans le formulaire.'
    )
  }, [people])

  const handleUseDraft = useCallback((draft) => {
    openDraftInEditor(draft)
  }, [openDraftInEditor])

  const handleUseDraftWithSyntheticEmail = useCallback((draft) => {
    openDraftInEditor(draft, { useSyntheticEmail: true })
  }, [openDraftInEditor])

  const handleUseNextDraft = useCallback(() => {
    if (!nextActionableDraft) {
      toast.info('Aucun brouillon à traiter pour le moment.')
      return
    }

    handleUseDraft(nextActionableDraft.draft)
  }, [handleUseDraft, nextActionableDraft])

  const handleDismissDraft = useCallback((draftId) => {
    removePendingDrafts((draft) => draft.id === draftId)
    toast.info('Entrée retirée de la file de complétion.')
  }, [removePendingDrafts])

  const handleAssignCandidateDraftEmail = useCallback(() => {
    if (!form.roles.includes('candidat')) {
      toast.info("L'email brouillon est réservé aux candidats.")
      return
    }

    const currentEmail = normalizeWhitespace(form.email)
    if (currentEmail && !isSyntheticOrganizerEmail(currentEmail)) {
      const confirmed = window.confirm(
        "Remplacer l'email actuel par un email brouillon @tpiorganizer.ch ? Les emails automatiques seront désactivés."
      )

      if (!confirmed) {
        return
      }
    }

    const selectedYear = Array.isArray(form.candidateYears) && form.candidateYears.length > 0
      ? form.candidateYears[0]
      : new Date().getFullYear()
    const syntheticEmail = buildSyntheticStakeholderEmail({
      firstName: form.firstName,
      lastName: form.lastName,
      role: 'candidat',
      year: selectedYear,
      seed: `${selectedPerson?._id || ''}|${form.firstName}|${form.lastName}|${selectedYear}`
    })

    setForm((currentForm) => ({
      ...currentForm,
      email: syntheticEmail,
      sendEmails: false
    }))
    toast.success('Email brouillon candidat appliqué. Les emails automatiques sont désactivés.')
  }, [form, selectedPerson])

  const handleBulkAssignCandidateDraftEmails = useCallback(async () => {
    if (candidateSyntheticDraftTargets.length === 0) {
      toast.info('Aucun candidat sans email à compléter automatiquement.')
      return
    }

    const confirmed = window.confirm(
      `Créer ou compléter ${candidateSyntheticDraftTargets.length} fiche${candidateSyntheticDraftTargets.length > 1 ? 's' : ''} candidat avec un email brouillon @tpiorganizer.ch et désactiver les emails automatiques ?`
    )

    if (!confirmed) {
      return
    }

    setIsAssigningDraftEmails(true)

    const completedDraftIds = new Set()
    const failures = []

    try {
      for (const target of candidateSyntheticDraftTargets) {
        const selectedYear = target.candidateYears[0] || new Date().getFullYear()
        const syntheticEmail = buildSyntheticStakeholderEmail({
          firstName: target.firstName,
          lastName: target.lastName,
          role: 'candidat',
          year: selectedYear,
          seed: `${target.key}|${target.draftIds.join('|')}`
        })
        const payload = {
          firstName: target.firstName,
          lastName: target.lastName,
          email: syntheticEmail,
          phone: normalizeWhitespace(target.existingPerson?.phone),
          site: target.site,
          entreprise: target.entreprise,
          roles: Array.from(new Set([...(Array.isArray(target.roles) ? target.roles : []), 'candidat'])),
          isActive: target.existingPerson?.isActive !== false,
          sendEmails: false,
          candidateYears: target.candidateYears
        }

        try {
          if (target.existingPerson?._id) {
            await personService.update(String(target.existingPerson._id), payload)
          } else {
            await personService.create(payload)
          }

          target.draftIds.forEach((draftId) => completedDraftIds.add(draftId))
        } catch (error) {
          failures.push({
            name: target.displayName,
            message: error?.data?.error || error?.message || 'Erreur inconnue'
          })
        }
      }

      if (completedDraftIds.size > 0) {
        removePendingDrafts((draft) => completedDraftIds.has(draft.id))
      }

      await loadPeople()

      if (failures.length === 0) {
        toast.success(
          `${completedDraftIds.size} brouillon${completedDraftIds.size > 1 ? 's' : ''} candidat complété${completedDraftIds.size > 1 ? 's' : ''} avec un email brouillon.`
        )
        return
      }

      if (completedDraftIds.size > 0) {
        toast.warning(
          `${completedDraftIds.size} brouillon${completedDraftIds.size > 1 ? 's' : ''} candidat traité${completedDraftIds.size > 1 ? 's' : ''}, ${failures.length} erreur${failures.length > 1 ? 's' : ''}. Première erreur: ${failures[0].name} (${failures[0].message})`
        )
      } else {
        toast.error(`Aucun email brouillon créé. Première erreur: ${failures[0].name} (${failures[0].message})`)
      }
    } finally {
      setIsAssigningDraftEmails(false)
    }
  }, [candidateSyntheticDraftTargets, loadPeople, removePendingDrafts])

  const handleTabChange = useCallback((tab) => {
    setActiveStakeholderTab(tab)
    setIsWorkbenchOpen(true)
  }, [])

  const togglePeopleOpen = useCallback(() => {
    setIsPeopleOpen((value) => !value)
  }, [])

  const toggleWorkbenchOpen = useCallback(() => {
    setIsWorkbenchOpen((value) => !value)
  }, [])

  const toggleDuplicateView = useCallback(() => {
    setShowOnlyDuplicates((value) => !value)
  }, [])

  const clearDraftsCoveredByPerson = useCallback((personData) => {
    removePendingDrafts((draft) => doesPersonCoverDraft(personData, draft))
  }, [removePendingDrafts])

  const handlePickImportFile = useCallback(() => {
    fileInputRef.current?.click()
  }, [])

  const handleImportFileChange = useCallback((event) => {
    const file = event.target.files?.[0]

    if (!file) {
      return
    }

    const reader = new FileReader()
    reader.onload = () => {
      const content = typeof reader.result === 'string' ? reader.result : ''
      setImportText(content)
      setImportReport(null)
      setImportSourceLabel(file.name)
      toast.info(`Fichier chargé: ${file.name}`)
    }
    reader.onerror = () => {
      toast.error('Impossible de lire le fichier.')
    }
    reader.readAsText(file, 'utf-8')
    event.target.value = ''
  }, [])

  const handleImportPeople = useCallback(async () => {
    const content = importText.trim()

    if (!content) {
      toast.error('Le contenu à importer est vide.')
      return
    }

    setIsImporting(true)

    try {
      const result = await personService.importFromContent(content, {
        defaultSite: importDefaultSite,
        defaultRoles: importRoles
      })
      setImportReport(result)

      const duplicateCount = result?.duplicates || 0
      const createdCount = result?.created || 0
      const updatedCount = result?.updated || 0
      const skippedCount = result?.skipped || 0

      const createdLabel = createdCount > 0
        ? `${createdCount} personne${createdCount > 1 ? 's' : ''} créée${createdCount > 1 ? 's' : ''}`
        : ''
      const updatedLabel = updatedCount > 0
        ? `${updatedCount} personne${updatedCount > 1 ? 's' : ''} mise${updatedCount > 1 ? 's' : ''} à jour`
        : ''
      const baseMessage = [createdLabel, updatedLabel].filter(Boolean).join(' · ') || 'Aucune nouvelle personne importée'

      toast.success(
        `${baseMessage}` +
        (duplicateCount > 0 ? `, ${duplicateCount} doublon${duplicateCount > 1 ? 's' : ''} ignoré${duplicateCount > 1 ? 's' : ''}` : '') +
        (skippedCount > duplicateCount ? `, ${skippedCount - duplicateCount} ligne${skippedCount - duplicateCount > 1 ? 's' : ''} rejetée${skippedCount - duplicateCount > 1 ? 's' : ''}` : '')
      )
      await loadPeople()
    } catch (err) {
      toast.error(err?.data?.error || err?.message || 'Import impossible.')
    } finally {
      setIsImporting(false)
    }
  }, [importDefaultSite, importRoles, importText, loadPeople])

  const handleDelete = useCallback(async (person) => {
    if (!window.confirm(`Désactiver ${person.firstName} ${person.lastName} ?`)) {
      return
    }

    try {
      await personService.remove(person._id)
      toast.success('Partie prenante désactivée.')
      await loadPeople()
      if (selectedPerson?._id === person._id) {
        handleReset()
      }
    } catch (err) {
      toast.error(err?.data?.error || err?.message || 'Suppression impossible.')
    }
  }, [handleReset, loadPeople, selectedPerson])

  const handleSubmit = useCallback(async (event) => {
    event.preventDefault()

    const normalizedFirstName = normalizeWhitespace(form.firstName)
    const normalizedLastName = normalizeWhitespace(form.lastName)
    const normalizedEmail = normalizeWhitespace(form.email).toLowerCase()
    const normalizedPhone = normalizeWhitespace(form.phone)
    const normalizedSite = normalizeWhitespace(form.site)
    const normalizedEntreprise = normalizeWhitespace(form.entreprise)
    const preferredSoutenanceChoices = buildPreferredSoutenanceChoices(
      PREFERRED_SOUTENANCE_CHOICE_FIELDS.map(({ dateField, slotField }) => ({
        date: form[dateField],
        period: form[slotField]
      }))
    )
    const preferredSoutenanceDates = buildPreferredSoutenanceDates(preferredSoutenanceChoices)

    if (!normalizedFirstName || !normalizedLastName || !normalizedEmail) {
      toast.error('Prénom, nom et email sont requis.')
      return
    }

    const payload = {
      ...form,
      firstName: normalizedFirstName,
      lastName: normalizedLastName,
      email: normalizedEmail,
      phone: normalizedPhone,
      site: normalizedSite,
      entreprise: normalizedEntreprise,
      preferredSoutenanceChoices,
      preferredSoutenanceDates,
      roles: form.roles
    }

    try {
      if (selectedPerson?._id) {
        const result = await personService.update(selectedPerson._id, payload)
        toast.success(result?.merged ? 'Partie prenante fusionnée.' : 'Partie prenante mise à jour.')
      } else {
        const result = await personService.create(payload)
        if (result?.merged) {
          toast.success('Partie prenante existante mise à jour.')
        } else if (result?.unchanged) {
          toast.info('Partie prenante déjà présente.')
        } else {
          toast.success('Partie prenante créée.')
        }
      }

      clearDraftsCoveredByPerson(payload)
      await loadPeople()

      if (routeContext.returnTo) {
        navigate(routeContext.returnTo)
        return
      }

      handleReset()
    } catch (err) {
      toast.error(err?.data?.error || err?.message || 'Sauvegarde impossible.')
    }
  }, [clearDraftsCoveredByPerson, form, handleReset, loadPeople, navigate, routeContext.returnTo, selectedPerson])

  return (
    <div className='stakeholders-page'>
      <header className='stakeholders-page-header'>
        <div className='stakeholders-page-copy'>
          <span className='stakeholders-eyebrow'>Référentiel</span>
          <h1>Parties prenantes</h1>
          <p>
            Pilotez les contacts, rôles, brouillons Gestion TPI et doublons depuis un seul espace.
          </p>
        </div>
        <div className='stakeholders-page-stats' aria-label='Synthèse des parties prenantes'>
          {stakeholderOverviewStats.map((stat) => {
            const StatIcon = stat.Icon

            return (
              <article key={stat.label} className={`stakeholders-page-stat is-${stat.tone}`}>
                <span className='stakeholders-page-stat-icon-shell' aria-hidden='true'>
                  <StatIcon className='stakeholders-page-stat-icon' />
                </span>
                <span className='stakeholders-page-stat-copy'>
                  <span>{stat.label}</span>
                  <strong>{stat.value}</strong>
                  <small>{stat.detail}</small>
                </span>
              </article>
            )
          })}
        </div>
      </header>

      {draftStatusCounts.all > 0 ? (
        <div className={`stakeholder-alert stakeholders-draft-alert${draftStatusCounts.actionable === 0 ? ' is-cleanup' : ''}`}>
          <span>
            {draftStatusCounts.actionable > 0
              ? `${draftStatusCounts.actionable} brouillon${draftStatusCounts.actionable > 1 ? 's' : ''} Gestion TPI à traiter.`
              : `Tous les brouillons sont couverts. Vous pouvez nettoyer ${draftStatusCounts.resolved} entrée${draftStatusCounts.resolved > 1 ? 's' : ''}.`}
          </span>
          <div className='stakeholders-draft-alert-actions'>
            {draftStatusCounts.actionable > 0 ? (
              <button type='button' className='secondary' onClick={() => handleOpenDraftWorkbench('actionable')}>
                Ouvrir la complétion
              </button>
            ) : null}
            {draftStatusCounts.resolved > 0 ? (
              <button type='button' className='secondary subtle' onClick={handleClearResolvedDrafts}>
                Retirer les couverts
              </button>
            ) : null}
          </div>
        </div>
      ) : null}

      <section className={`stakeholders-workbench${isWorkbenchOpen ? '' : ' is-collapsed'}`}>
        <div className='stakeholders-workbench-tabs-bar'>
          <div className='stakeholders-workbench-tabs' role='tablist' aria-label='Création, complétion et import'>
            {WORKBENCH_TABS.map((tab) => {
              const isActive = activeStakeholderTab === tab.value
              const TabIcon = WORKBENCH_TAB_ICONS[tab.value] || UserIcon
              const tabCount = tab.value === 'draft'
                ? draftStatusCounts.actionable > 0
                  ? draftStatusCounts.actionable
                  : draftStatusCounts.all
                : 0

              return (
                <button
                  key={tab.value}
                  id={`stakeholders-tab-${tab.value}`}
                  type='button'
                  role='tab'
                  className={`stakeholders-workbench-tab${isActive ? ' active' : ''}`}
                  aria-selected={isActive}
                  aria-controls={`stakeholders-panel-${tab.value}`}
                  onClick={() => handleTabChange(tab.value)}
                >
                  <TabIcon className='stakeholders-workbench-tab-icon' />
                  <span>{tab.label}</span>
                  {tabCount > 0 ? (
                    <span className='stakeholders-workbench-tab-count'>{tabCount}</span>
                  ) : null}
                </button>
              )
            })}
          </div>

          <button
            type='button'
            className='secondary subtle stakeholders-collapse-toggle'
            onClick={toggleWorkbenchOpen}
            aria-expanded={isWorkbenchOpen}
            aria-controls='stakeholders-workbench-body'
            aria-label={isWorkbenchOpen ? 'Masquer le bloc de travail des parties prenantes' : 'Afficher le bloc de travail des parties prenantes'}
          >
            <CollapseChevronIcon expanded={isWorkbenchOpen} />
          </button>
        </div>

        <div id='stakeholders-workbench-body' className='stakeholders-workbench-body'>
          {isWorkbenchOpen ? (
            <div className='stakeholders-workbench-content'>
              {activeStakeholderTab === 'create' ? (
                <StakeholderEditorPanel
                  availablePreferredSlotCount={preferredSoutenanceSlotContext.slotCount}
                  form={form}
                  handleChange={handleChange}
                  handlePreferredChoiceDateChange={handlePreferredChoiceDateChange}
                  handleAssignCandidateDraftEmail={handleAssignCandidateDraftEmail}
                  handleReset={handleReset}
                  handleRolePresetChange={handleRolePresetChange}
                  preferredSlotContextLabel={preferredSoutenanceSlotContext.label}
                  preferredSlotLabelResolver={preferredSoutenanceSlotContext.getSlotLabel}
                  preferredSlotSummary={preferredSoutenanceSlotContext.slotSummary}
                  preferredSlotTitleResolver={preferredSoutenanceSlotContext.getSlotTitle}
                  handleSubmit={handleSubmit}
                  selectedPerson={selectedPerson}
                />
              ) : null}

              {activeStakeholderTab === 'draft' ? (
                <StakeholderDraftPanel
                  candidateSyntheticDraftCount={candidateSyntheticDraftTargets.length}
                  draftStatusCounts={draftStatusCounts}
                  draftStatusFilter={draftStatusFilter}
                  handleBulkAssignCandidateDraftEmails={handleBulkAssignCandidateDraftEmails}
                  handleClearResolvedDrafts={handleClearResolvedDrafts}
                  handleDismissDraft={handleDismissDraft}
                  handleUseNextDraft={handleUseNextDraft}
                  handleUseDraft={handleUseDraft}
                  handleUseDraftWithSyntheticEmail={handleUseDraftWithSyntheticEmail}
                  isAssigningDraftEmails={isAssigningDraftEmails}
                  loadPendingDrafts={loadPendingDrafts}
                  onDraftStatusFilterChange={handleDraftStatusFilterChange}
                  visibleStakeholderDraftStatuses={visibleStakeholderDraftStatuses}
                />
              ) : null}

              {activeStakeholderTab === 'import' ? (
                <StakeholderImportPanel
                  fileInputRef={fileInputRef}
                  handleImportDefaultSiteChange={handleImportDefaultSiteChange}
                  handleImportFileChange={handleImportFileChange}
                  handleImportPeople={handleImportPeople}
                  handleImportTextChange={handleImportTextChange}
                  handleImportTextReset={handleImportTextReset}
                  handleLoadExample={handleLoadExample}
                  handlePickImportFile={handlePickImportFile}
                  handleImportRoleToggle={handleImportRoleToggle}
                  importDefaultSite={importDefaultSite}
                  importPreview={importPreview}
                  importReport={importReport}
                  importRoles={importRoles}
                  importSourceLabel={importSourceLabel}
                  importText={importText}
                  isImporting={isImporting}
                  selectedImportRolesLabel={selectedImportRolesLabel}
                />
              ) : null}
            </div>
          ) : null}
        </div>
      </section>

      <section className='stakeholders-filters' aria-label='Filtres des parties prenantes'>
        <label className='stakeholders-filter-search'>
          <span className='sr-only'>Recherche</span>
          <SearchIcon className='stakeholders-filter-search-icon' />
          <input
            type='search'
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder='Nom, email, entreprise ou ID E-001'
          />
        </label>
        <label className='stakeholders-filter-field'>
          <span>Rôle</span>
          <select value={roleFilter} onChange={(event) => setRoleFilter(event.target.value)}>
            <option value=''>Tous les rôles</option>
            {ROLE_OPTIONS.map((role) => (
              <option key={role.value} value={role.value}>
                {role.label}
              </option>
            ))}
          </select>
        </label>
        <label className='stakeholders-filter-field'>
          <span>Site</span>
          <select value={siteFilter} onChange={(event) => setSiteFilter(event.target.value)}>
            <option value=''>Tous les sites</option>
            {SITE_OPTIONS.map((site) => (
              <option key={site} value={site}>
                {site}
              </option>
            ))}
          </select>
        </label>
        <label className='stakeholders-filter-field'>
          <span>Emails</span>
          <select value={emailFilter} onChange={(event) => setEmailFilter(event.target.value)}>
            <option value=''>Tous</option>
            <option value='yes'>Reçoit emails</option>
            <option value='no'>Sans emails</option>
          </select>
        </label>
        <div className='stakeholders-filter-actions'>
          <button
            type='button'
            className={`secondary${showOnlyDuplicates ? ' is-active' : ''} stakeholders-filter-icon-button`}
            onClick={toggleDuplicateView}
            disabled={isLoading && people.length === 0}
            title={showOnlyDuplicates ? `Voir toutes les parties prenantes${people.length > 0 ? ` (${people.length})` : ''}` : `Afficher les doublons${duplicateGroups.length > 0 ? ` (${duplicateGroups.length})` : ''}`}
            aria-label={showOnlyDuplicates ? `Voir toutes les parties prenantes${people.length > 0 ? ` (${people.length})` : ''}` : `Afficher les doublons${duplicateGroups.length > 0 ? ` (${duplicateGroups.length})` : ''}`}
          >
            <AlertIcon className='stakeholders-button-icon' />
            <span className='sr-only'>
              {showOnlyDuplicates
                ? `Tous${people.length > 0 ? ` (${people.length})` : ''}`
                : `Doublons${duplicateGroups.length > 0 ? ` (${duplicateGroups.length})` : ''}`}
            </span>
          </button>
          <button
            type='button'
            className={`secondary${isMergeMode ? ' is-active' : ''} stakeholders-filter-icon-button`}
            onClick={handleToggleMergeMode}
            title={isMergeMode ? 'Quitter le mode fusion' : 'Mode fusion'}
            aria-label={isMergeMode ? 'Quitter le mode fusion' : 'Mode fusion'}
          >
            <UsersIcon className='stakeholders-button-icon' />
            <span className='sr-only'>
              {isMergeMode ? 'Quitter fusion' : 'Mode fusion'}
            </span>
          </button>
          <button
            type='button'
            className='secondary stakeholders-filter-icon-button'
            onClick={() => void loadPeople()}
            title='Rechercher'
            aria-label='Rechercher'
          >
            <RefreshIcon className='stakeholders-button-icon' />
            <span className='sr-only'>Rechercher</span>
          </button>
        </div>
      </section>

      {error && (
        <div className='stakeholder-alert error'>
          <span>{error}</span>
          <button type='button' onClick={() => setError(null)}>×</button>
        </div>
      )}

      <section className='stakeholders-layout'>
        <div className={`stakeholders-list-panel${isPeopleOpen ? '' : ' is-collapsed'}`}>
          <div className='stakeholders-panel-head'>
            <h2>Personnes</h2>
            <div className='stakeholders-panel-head-actions'>
              <span>{visiblePeople.length} fiche{visiblePeople.length > 1 ? 's' : ''}</span>
              <button
                type='button'
                className='secondary subtle stakeholders-collapse-toggle'
                onClick={togglePeopleOpen}
                aria-expanded={isPeopleOpen}
                aria-controls='stakeholders-list-content'
                aria-label={isPeopleOpen ? 'Masquer la liste des personnes' : 'Afficher la liste des personnes'}
              >
                <CollapseChevronIcon expanded={isPeopleOpen} />
              </button>
            </div>
          </div>

          {isMergeMode ? (
            <div className='stakeholders-merge-toolbar'>
              <div className='stakeholders-merge-toolbar-copy'>
                <strong>Mode fusion actif</strong>
                <span>
                  {mergeSelectionPeople.length > 0
                    ? `${mergeSelectionPeople.length} fiche${mergeSelectionPeople.length > 1 ? 's' : ''} sélectionnée${mergeSelectionPeople.length > 1 ? 's' : ''} pour ${getPersonDisplayName(mergePrimaryPerson) || 'une fusion manuelle'}.`
                    : 'Coche les fiches, puis choisis celle à conserver.'}
                </span>
                {mergePrimaryPerson ? (
                  <span className='stakeholders-merge-toolbar-primary'>
                    Fiche conservée: {getPersonDisplayName(mergePrimaryPerson)} (N° {formatPersonShortId(mergePrimaryPerson)})
                  </span>
                ) : null}
              </div>
              <div className='stakeholders-merge-toolbar-actions'>
                <button type='button' className='secondary subtle' onClick={clearMergeSelection} disabled={mergeSelectionPeople.length === 0}>
                  Effacer la sélection
                </button>
                <button type='button' className='subtle-primary' onClick={handlePreviewSelectionMerge} disabled={!canPreviewSelectionMerge || isMergingPeople}>
                  {isMergingPeople ? 'Fusion en cours…' : 'Prévisualiser la fusion'}
                </button>
              </div>
            </div>
          ) : null}

          <div id='stakeholders-list-content' className='stakeholders-list-content'>
            {!isPeopleOpen ? (
              <div className='stakeholders-empty stakeholders-collapsed-note'>
                Liste des personnes repliée.
              </div>
            ) : isLoading ? (
              <div className='stakeholders-empty'>Chargement...</div>
            ) : visiblePeople.length === 0 ? (
              <div className='stakeholders-empty'>
                {showOnlyDuplicates
                  ? 'Aucun doublon détecté dans la liste chargée.'
                  : 'Aucune partie prenante trouvée.'}
              </div>
            ) : (
              <div className='stakeholders-list'>
                {visiblePeople.map((person) => {
                  const roleVisual = getRoleVisual(person.roles)
                  const isDuplicate = duplicateIdentitySet.has(getPersonIdentityKey(person))
                  const duplicateGroup = duplicateGroupMap.get(person._id) || []
                  const personId = String(person?._id || '')
                  const isMergeSelected = mergeSelectionIds.includes(personId)
                  const isMergePrimary = mergePrimaryPerson?._id && String(mergePrimaryPerson._id) === personId

                  return (
                    <article
                      key={person._id}
                      data-stakeholder-id={person._id}
                      className={`stakeholder-row role-${roleVisual.key} ${person.isActive === false ? 'is-inactive' : ''} ${selectedPerson?._id === person._id ? 'active' : ''} ${isMergeMode ? 'is-merge-mode' : ''} ${isMergeSelected ? 'is-merge-selected' : ''} ${isMergePrimary ? 'is-merge-primary' : ''}`}
                    >
                      {isMergeMode ? (
                        <div className='stakeholder-row-select' onClick={(event) => event.stopPropagation()}>
                          <input
                            type='checkbox'
                            className='stakeholder-merge-native-checkbox'
                            checked={isMergeSelected}
                            title={`Sélectionner ${person.firstName} ${person.lastName} pour la fusion`}
                            aria-label={`Sélectionner ${person.firstName} ${person.lastName} pour la fusion`}
                            onClick={(event) => event.stopPropagation()}
                            onChange={() => handleToggleMergeSelection(person)}
                          />
                        </div>
                      ) : null}
                      <button type='button' className='stakeholder-row-main' onClick={() => handleSelect(person)}>
                        <div className='stakeholder-row-heading'>
                          <strong>{person.firstName} {person.lastName}</strong>
                          {isDuplicate ? (
                            <span className='stakeholder-duplicate-chip' title='Même prénom et nom qu’une autre fiche'>
                              Doublon
                            </span>
                          ) : null}
                        </div>
                        <span>{person.email}</span>
                      </button>
                      <div className='stakeholder-row-meta'>
                        <div className='stakeholder-row-meta-top'>
                          <span className='stakeholder-role-chip' aria-label={roleVisual.label} title={roleVisual.label}>
                            <roleVisual.icon className='stakeholder-role-chip-icon' />
                            <span className='sr-only'>{roleVisual.label}</span>
                          </span>
                          <span>{person.site || 'Site non défini'}</span>
                          <span className='stakeholder-id-chip' title={person._id}>
                            N°: <code>{formatPersonShortId(person)}</code>
                          </span>
                          {person.sendEmails === false && (
                            <span className='stakeholder-email-indicator' title="Ne reçoit pas d'emails">
                              <NoEmailIcon className='stakeholder-email-icon' />
                            </span>
                          )}
                        </div>
                        <div className='stakeholder-row-meta-actions'>
                          {isMergeMode && isMergeSelected ? (
                            <button
                              type='button'
                              className={`secondary stakeholders-row-keep-button${isMergePrimary ? ' is-active' : ''}`}
                              onClick={() => handleSetMergePrimary(person)}
                              aria-label={`Conserver ${person.firstName} ${person.lastName} comme fiche cible`}
                            >
                              {isMergePrimary ? 'Conservée' : 'Conserver'}
                            </button>
                          ) : null}
                          {!isMergeMode && showOnlyDuplicates && duplicateGroup.length > 1 && (
                            <button
                              type='button'
                              className='secondary stakeholders-row-merge-button'
                              onClick={() => handleOpenMergePreview(person, duplicateGroup)}
                              disabled={isMergingPeople}
                              aria-label={`Prévisualiser la fusion pour ${person.firstName} ${person.lastName}`}
                            >
                              Prévisualiser
                            </button>
                          )}
                          <button
                            type='button'
                            className='secondary stakeholders-row-icon-button'
                            onClick={() => handleSelect(person)}
                            aria-label={`Modifier ${person.firstName} ${person.lastName}`}
                          >
                            <EditIcon className='stakeholders-row-icon' />
                          </button>
                          <button
                            type='button'
                            className='danger stakeholders-row-icon-button'
                            onClick={() => handleDelete(person)}
                            aria-label={`Désactiver ${person.firstName} ${person.lastName}`}
                          >
                            <DisableIcon className='stakeholders-row-icon' />
                          </button>
                        </div>
                      </div>
                    </article>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </section>

      <MergePreviewModal
        isSubmitting={isMergingPeople}
        onCancel={handleCloseMergePreview}
        onConfirm={() => void handleConfirmMergePreview()}
        previewData={mergePreviewData}
      />
    </div>
  )
}

export default PartiesPrenantes
