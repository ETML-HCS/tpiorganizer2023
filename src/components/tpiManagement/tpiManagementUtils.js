import { getPlanningClassDisplayInfo } from '../tpiPlanning/planningClassUtils.js'
import {
  formatSoutenanceDateLabel,
  getSoutenanceDateBadgeLabel,
  normalizeSoutenanceDateEntries
} from '../tpiSchedule/soutenanceDateUtils.js'

const toDateObject = (value) => {
  if (!value) {
    return null
  }

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value
  }

  if (typeof value === 'object' && value.$date) {
    const nestedDate = new Date(value.$date)
    return Number.isNaN(nestedDate.getTime()) ? null : nestedDate
  }

  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

const PLACEHOLDER_EMPTY_VALUES = new Set(['null', 'undefined'])

const normalizeOptionalText = (value) => {
  if (value === null || value === undefined) {
    return ''
  }

  const normalizedValue = String(value).trim()

  return PLACEHOLDER_EMPTY_VALUES.has(normalizedValue.toLowerCase())
    ? ''
    : normalizedValue
}

const TAG_SPLIT_REGEX = /[;,|/]+|\n+/g

const TECH_LABELS = new Map([
  ['php', 'PHP'],
  ['mysql', 'MySQL'],
  ['css', 'CSS'],
  ['css3', 'CSS3'],
  ['html', 'HTML'],
  ['html5', 'HTML5'],
  ['js', 'JS'],
  ['javascript', 'JavaScript'],
  ['typescript', 'TypeScript'],
  ['node js', 'Node.js'],
  ['nodejs', 'Node.js'],
  ['node api', 'Node API'],
  ['react', 'React'],
  ['react js', 'React JS'],
  ['react native', 'React Native'],
  ['vue', 'Vue'],
  ['vue js', 'Vue.js'],
  ['vuejs', 'Vue.js'],
  ['next js', 'Next.js'],
  ['next.js', 'Next.js'],
  ['angular', 'Angular'],
  ['bootstrap', 'Bootstrap'],
  ['tailwind', 'Tailwind'],
  ['jquery', 'jQuery'],
  ['laravel', 'Laravel'],
  ['codeigniter', 'CodeIgniter'],
  ['cake php', 'CakePHP'],
  ['cakephp', 'CakePHP'],
  ['django', 'Django'],
  ['symfony', 'Symfony'],
  ['wordpress', 'WordPress'],
  ['blazor server', 'Blazor Server'],
  ['blazor', 'Blazor'],
  ['asp.net', 'ASP.NET'],
  ['asp net', 'ASP.NET'],
  ['asp.net core', 'ASP.NET Core'],
  ['c#', 'C#'],
  ['.net', '.NET'],
  ['winforms', 'WinForms'],
  ['winform', 'WinForms'],
  ['prtg', 'PRTG'],
  ['mecm', 'MECM'],
  ['sccm', 'SCCM'],
  ['mdt', 'MDT'],
  ['wds', 'WDS'],
  ['wsus', 'WSUS'],
  ['vcenter', 'vCenter'],
  ['vmware', 'VMware'],
  ['vsphere', 'vSphere'],
  ['hyper-v', 'Hyper-V'],
  ['hyperv', 'Hyper-V'],
  ['virtualbox', 'VirtualBox'],
  ['virtualisation', 'Virtualisation'],
  ['virtualization', 'Virtualisation'],
  ['powershell', 'PowerShell'],
  ['automation', 'Automation'],
  ['automatisation', 'Automation'],
  ['scripting', 'Scripting'],
  ['scripts', 'Scripts'],
  ['devops', 'DevOps'],
  ['azure devops', 'Azure DevOps'],
  ['azuredevops', 'Azure DevOps'],
  ['github actions', 'GitHub Actions'],
  ['ansible', 'Ansible'],
  ['terraform', 'Terraform'],
  ['docker', 'Docker'],
  ['kubernetes', 'Kubernetes'],
  ['aws', 'AWS'],
  ['bitbucket', 'Bitbucket'],
  ['git', 'Git'],
  ['mariadb', 'MariaDB'],
  ['mongodb', 'MongoDB'],
  ['sql', 'SQL'],
  ['sqlite', 'SQLite'],
  ['restapi', 'REST API'],
  ['api', 'API'],
  ['python', 'Python'],
  ['pygame', 'PyGame'],
  ['raspberrypi', 'Raspberry Pi'],
  ['raspberypi', 'Raspberry Pi'],
  ['json', 'JSON'],
  ['rstapi', 'REST API'],
  ['rest api', 'REST API'],
  ['raspberry pi', 'Raspberry Pi'],
  ['camera', 'Camera'],
  ['cluster', 'Cluster'],
  ['msi', 'MSI'],
  ['dll', 'DLL'],
  ['qrcode', 'QR Code'],
  ['qr code', 'QR Code'],
  ['win srv 2022', 'Windows Server 2022'],
  ['windows server', 'Windows Server'],
  ['windows server 2022', 'Windows Server 2022'],
  ['windows 2022', 'Windows Server 2022'],
  ['wserver', 'Windows Server'],
  ['active directory', 'Active Directory'],
  ['ad', 'Active Directory'],
  ['azure ad', 'Azure AD'],
  ['entra', 'Entra ID'],
  ['entra id', 'Entra ID'],
  ['m365', 'Microsoft 365'],
  ['synology', 'Synology'],
  ['nas', 'NAS'],
  ['samba', 'Samba'],
  ['dns', 'DNS'],
  ['dhcp', 'DHCP'],
  ['openldap', 'OpenLDAP'],
  ['ldap', 'LDAP'],
  ['linux', 'Linux'],
  ['ubuntu', 'Ubuntu'],
  ['debian', 'Debian'],
  ['iptables', 'IPTables'],
  ['lan', 'LAN'],
  ['wan', 'WAN'],
  ['vlan', 'VLAN'],
  ['wlan', 'WLAN'],
  ['radius', 'RADIUS'],
  ['nps', 'NPS/RADIUS'],
  ['firewall', 'Firewall'],
  ['monitoring', 'Monitoring'],
  ['centeron', 'Centreon'],
  ['centreon', 'Centreon'],
  ['servicenow', 'ServiceNow'],
  ['service now', 'ServiceNow'],
  ['glpi', 'GLPI'],
  ['bookstack', 'BookStack'],
  ['wiki', 'Wiki'],
  ['atera', 'Atera'],
  ['nagios', 'Nagios'],
  ['solar winds', 'SolarWinds'],
  ['virtualisation', 'Virtualisation'],
  ['infrastructure', 'Infrastructure'],
  ['système', 'Système'],
  ['systeme', 'Système'],
  ['reseau', 'Réseau'],
  ['réseau', 'Réseau'],
  ['cloud', 'Cloud'],
  ['desktop', 'Desktop'],
  ['mobile', 'Mobile'],
  ['unity', 'Unity'],
  ['android', 'Android'],
  ['kotlin', 'Kotlin'],
  ['qrcode', 'QR Code'],
  ['qr code', 'QR Code'],
  ['http', 'HTTP'],
  ['https', 'HTTPS'],
  ['visual studio', 'Visual Studio'],
  ['entity framework', 'Entity Framework'],
  ['hangfire', 'Hangfire'],
  ['console', 'Console'],
  ['java', 'Java'],
  ['spring boot', 'Spring Boot'],
  ['hibernate', 'Hibernate'],
  ['angular', 'Angular'],
  ['flutter', 'Flutter']
])

const CATEGORY_RULES = [
  {
    key: 'mobile-game',
    label: 'Mobile / Game',
    patterns: [
      /android/i,
      /kotlin/i,
      /react native/i,
      /unity/i,
      /gaming/i,
      /\bgame\b/i,
      /\b2d\b/i,
      /flutter/i,
      /\bmobile\b/i
    ]
  },
  {
    key: 'web-app',
    label: 'Web / App',
    patterns: [
      /\bweb\b/i,
      /html/i,
      /css/i,
      /\bjs\b/i,
      /javascript/i,
      /typescript/i,
      /php/i,
      /laravel/i,
      /react/i,
      /vue/i,
      /node(?:\.| )?js/i,
      /express/i,
      /\bapi\b/i,
      /mysql/i,
      /mariadb/i,
      /django/i,
      /symfony/i,
      /wordpress/i,
      /asp\.net/i,
      /blazor/i,
      /mvc/i,
      /bootstrap/i,
      /tailwind/i,
      /codeigniter/i,
      /cake ?php/i,
      /http/i,
      /https/i,
      /angular/i,
      /firebase/i,
      /jquery/i,
      /next\.js/i,
      /socket api/i,
      /framework/i,
      /java/i,
      /spring boot/i,
      /hibernate/i
    ]
  },
  {
    key: 'infra-systeme',
    label: 'Infra / Système',
    patterns: [
      /windows/i,
      /server/i,
      /active directory/i,
      /\bad\b/i,
      /azure ad/i,
      /entra id/i,
      /m365/i,
      /exchange online/i,
      /linux/i,
      /ubuntu/i,
      /debian/i,
      /samba/i,
      /dns/i,
      /dhcp/i,
      /vmware/i,
      /virtualbox/i,
      /vcenter/i,
      /esxi/i,
      /hyper[- ]?v/i,
      /cluster/i,
      /sccm/i,
      /mecm/i,
      /mdt/i,
      /wds/i,
      /intune/i,
      /wsus/i,
      /powershell/i,
      /backup/i,
      /veeam/i,
      /restic/i,
      /monitoring/i,
      /prtg/i,
      /centreon/i,
      /glpi/i,
      /bookstack/i,
      /wiki/i,
      /servicenow/i,
      /service now/i,
      /atera/i,
      /nagios/i,
      /solar ?winds/i,
      /syst[èe]me/i,
      /infra/i,
      /réseau|reseau/i,
      /firewall/i,
      /vpn/i,
      /ssl ?vpn/i,
      /nps/i,
      /radius/i,
      /lan/i,
      /wan/i,
      /vlan/i,
      /wlan/i,
      /nas/i,
      /synology/i,
      /openldap/i,
      /ldap/i,
      /iptables/i,
      /failover/i,
      /\bha\b/i,
      /restoration/i,
      /plan de sauvegarde/i
    ]
  },
  {
    key: 'devops-cloud',
    label: 'DevOps / Cloud',
    patterns: [
      /docker/i,
      /kubernetes/i,
      /aws/i,
      /bitbucket/i,
      /git/i,
      /pipeline/i,
      /devops/i,
      /ci\/cd/i,
      /terraform/i,
      /cloud/i,
      /azure devops/i,
      /github actions/i,
      /ansible/i,
      /automation/i,
      /automatisation/i,
      /scripting/i,
      /scripts/i
    ]
  },
  {
    key: 'data-iot',
    label: 'Data / IoT',
    patterns: [
      /python/i,
      /raspberry/i,
      /camera/i,
      /json/i,
      /rest ?api/i,
      /mongodb/i,
      /\bsql\b/i,
      /iot/i,
      /data/i,
      /machine learning/i,
      /pygame/i,
      /qr code/i,
      /qrcode/i
    ]
  },
  {
    key: 'desktop-dotnet',
    label: 'Desktop / .NET',
    patterns: [
      /c#/i,
      /\.net/i,
      /winforms/i,
      /\bwpf\b/i,
      /msi/i,
      /dll/i,
      /desktop/i,
      /visual studio/i,
      /console/i,
      /entity framework/i,
      /hangfire/i
    ]
  }
]

const normalizeFold = (value) =>
  normalizeOptionalText(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()

const normalizePlanningLookupToken = (value) =>
  normalizeOptionalText(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '')
    .toUpperCase()

const matchesPlanningLookupToken = (value, candidate) => {
  const normalizedValue = normalizePlanningLookupToken(value)
  const normalizedCandidate = normalizePlanningLookupToken(candidate)

  if (!normalizedValue || !normalizedCandidate) {
    return false
  }

  if (normalizedValue === normalizedCandidate) {
    return true
  }

  if (
    normalizedValue.startsWith(normalizedCandidate) ||
    normalizedCandidate.startsWith(normalizedValue)
  ) {
    return true
  }

  if (normalizedValue.length >= 3 && normalizedCandidate.includes(normalizedValue)) {
    return true
  }

  if (normalizedCandidate.length >= 3 && normalizedValue.includes(normalizedCandidate)) {
    return true
  }

  return false
}

const dedupeSelectOptions = (options = []) => {
  const seen = new Set()

  return (Array.isArray(options) ? options : []).filter((option) => {
    const value = normalizeOptionalText(option?.value)
    const dedupeKey = normalizeFold(value)

    if (!value || seen.has(dedupeKey)) {
      return false
    }

    seen.add(dedupeKey)
    return true
  })
}

const appendCurrentPlanningOption = (options = [], value, buildLabel) => {
  const currentValue = normalizeOptionalText(value)

  if (!currentValue) {
    return dedupeSelectOptions(options)
  }

  const normalizedCurrent = normalizeFold(currentValue)
  const alreadyPresent = (Array.isArray(options) ? options : []).some(
    (option) => normalizeFold(option?.value) === normalizedCurrent
  )

  if (alreadyPresent) {
    return dedupeSelectOptions(options)
  }

  return dedupeSelectOptions([
    {
      value: currentValue,
      label: typeof buildLabel === 'function' ? buildLabel(currentValue) : currentValue
    },
    ...(Array.isArray(options) ? options : [])
  ])
}

const resolveCatalogSiteForForm = (siteValue, planningCatalogSites = []) => {
  const normalizedSite = normalizePlanningLookupToken(siteValue)

  if (!normalizedSite) {
    return null
  }

  return (Array.isArray(planningCatalogSites) ? planningCatalogSites : []).find((site) => {
    if (site?.active === false) {
      return false
    }

    const tokens = [
      site?.id,
      site?.code,
      site?.label,
      site?.name,
      ...(Array.isArray(site?.aliases) ? site.aliases : [])
    ].filter(Boolean)

    return tokens.some((candidate) => matchesPlanningLookupToken(normalizedSite, candidate))
  }) || null
}

const readSiteRoomEntries = (site) => {
  if (!site || typeof site !== 'object') {
    return []
  }

  const roomSource = Array.isArray(site.roomDetails)
    ? site.roomDetails
    : Array.isArray(site.rooms)
      ? site.rooms
      : []

  return roomSource
    .map((entry) => (
      entry && typeof entry === 'object' && !Array.isArray(entry)
        ? entry
        : { code: entry, label: entry }
    ))
    .filter((room) => room?.active !== false)
}

const resolveClassTypeSoutenanceDates = (classInfo, planningClassTypes = []) => {
  const classTokens = new Set(
    [
      classInfo?.code,
      classInfo?.prefix
    ]
      .map((value) => normalizePlanningLookupToken(value))
      .filter(Boolean)
  )

  if (classTokens.size === 0) {
    return []
  }

  const matchingClassType = (Array.isArray(planningClassTypes) ? planningClassTypes : []).find((classType) => {
    if (classType?.active === false) {
      return false
    }

    return [classType?.code, classType?.prefix].some((candidate) => {
      const normalizedCandidate = normalizePlanningLookupToken(candidate)
      return normalizedCandidate && classTokens.has(normalizedCandidate)
    })
  })

  return normalizeSoutenanceDateEntries(matchingClassType?.soutenanceDates || [])
}

const filterDateEntriesForClass = (entries = [], classInfo) => {
  const normalizedEntries = normalizeSoutenanceDateEntries(entries)
  const classTokens = new Set(
    [
      classInfo?.code,
      classInfo?.prefix
    ]
      .map((value) => normalizePlanningLookupToken(value))
      .filter(Boolean)
  )

  if (classTokens.size === 0) {
    return normalizedEntries
  }

  const filteredEntries = normalizedEntries.filter((entry) => {
    const allowedClasses = Array.isArray(entry?.classes) ? entry.classes : []

    if (allowedClasses.length === 0) {
      return true
    }

    return allowedClasses.some((candidate) => classTokens.has(normalizePlanningLookupToken(candidate)))
  })

  return filteredEntries.length > 0 ? filteredEntries : normalizedEntries
}

export const getTpiPlanningSelectOptions = (
  tpi = {},
  {
    planningCatalogSites = [],
    planningClassTypes = [],
    planningSoutenanceDates = []
  } = {}
) => {
  const siteValue = normalizeOptionalText(tpi?.lieu?.site ?? tpi?.site)
  const roomValue = normalizeOptionalText(tpi?.salle)
  const soutenanceDateValue = normalizeOptionalText(
    tpi?.dates?.soutenance ?? tpi?.dateSoutenance
  )
  const classValue = normalizeOptionalText(tpi?.classe)
  const classInfo = getPlanningClassDisplayInfo(
    classValue,
    planningClassTypes,
    planningCatalogSites,
    siteValue
  )
  const catalogSites = (Array.isArray(planningCatalogSites) ? planningCatalogSites : []).filter(
    (site) => site?.active !== false
  )
  const resolvedSite = resolveCatalogSiteForForm(siteValue, catalogSites)
  const roomSites = resolvedSite ? [resolvedSite] : catalogSites
  const showSiteInRoomLabel = !resolvedSite
  const roomOptions = appendCurrentPlanningOption(
    dedupeSelectOptions(
      roomSites.flatMap((site) =>
        readSiteRoomEntries(site).map((room) => {
          const roomLabel = normalizeOptionalText(room?.label || room?.code || room?.name)
          const siteLabel = normalizeOptionalText(site?.label || site?.code || siteValue)

          return {
            value: roomLabel,
            label: showSiteInRoomLabel && siteLabel
              ? `${roomLabel} · ${siteLabel}`
              : roomLabel
          }
        })
      )
    ),
    roomValue,
    (currentValue) => `${currentValue} (hors configuration)`
  )

  const mergedFallbackDates = normalizeSoutenanceDateEntries([
    ...(Array.isArray(planningSoutenanceDates) ? planningSoutenanceDates : []),
    ...(Array.isArray(planningClassTypes)
      ? planningClassTypes.flatMap((classType) => classType?.soutenanceDates || [])
      : [])
  ])
  const configuredDateEntries = resolveClassTypeSoutenanceDates(classInfo, planningClassTypes)
  const availableDateEntries =
    configuredDateEntries.length > 0
      ? configuredDateEntries
      : filterDateEntriesForClass(mergedFallbackDates, classInfo)
  const soutenanceDateOptions = appendCurrentPlanningOption(
    dedupeSelectOptions(
      availableDateEntries.map((entry) => {
        const badgeLabel = getSoutenanceDateBadgeLabel(entry)
        const baseLabel = formatSoutenanceDateLabel(entry?.date) || normalizeOptionalText(entry?.date)

        return {
          value: normalizeOptionalText(entry?.date),
          label: badgeLabel ? `${baseLabel} (${badgeLabel})` : baseLabel
        }
      })
    ),
    soutenanceDateValue,
    (currentValue) => {
      const formattedDate = formatSoutenanceDateLabel(currentValue) || currentValue
      return `${formattedDate} (hors configuration)`
    }
  )

  return {
    roomOptions,
    soutenanceDateOptions
  }
}

const cleanupTag = (value) =>
  normalizeOptionalText(value)
    .replace(/\bctpi\s*ref\b/gi, ' ')
    .replace(/[()\[\]]/g, ' ')
    .replace(/^[\s"'`]+/, '')
    .replace(/[\s"'`.,;:!?)+\]]+$/, '')
    .replace(/\s+/g, ' ')
    .trim()

const formatFreeText = (value) =>
  cleanupTag(value)

const titleCaseFallback = (value) =>
  String(value || '')
    .split(' ')
    .map((part) => {
      if (!part) return part
      if (/[#/.+\d]/.test(part)) return part
      if (part === part.toUpperCase() && /[A-Z]/.test(part)) return part
      return part.charAt(0).toUpperCase() + part.slice(1)
    })
    .join(' ')

const DISPLAY_NOISE_TAGS = new Set([
  'dev',
  'etc',
  'environnement',
  'extension',
  'procedure',
  'procedures'
])

export const shouldDisplayTag = (value) => {
  const normalized = normalizeFold(value)
  return Boolean(normalized) && !/^\d+$/.test(normalized) && !DISPLAY_NOISE_TAGS.has(normalized)
}

const classifyCategory = (value) => {
  const normalized = normalizeFold(value)

  for (const rule of CATEGORY_RULES) {
    if (rule.patterns.some((pattern) => pattern.test(normalized))) {
      return { key: rule.key, label: rule.label }
    }
  }

  return { key: 'other', label: 'Autre' }
}

const DOMAIN_RULES = [
  {
    label: 'Développement web',
    patterns: [
      /\bweb\b/i,
      /html/i,
      /css/i,
      /\bjs\b/i,
      /javascript/i,
      /typescript/i,
      /php/i,
      /laravel/i,
      /react/i,
      /vue/i,
      /node(?:\.| )?js/i,
      /express/i,
      /\bapi\b/i,
      /mysql/i,
      /mariadb/i,
      /django/i,
      /symfony/i,
      /wordpress/i,
      /asp\.net/i,
      /blazor/i,
      /mvc/i,
      /bootstrap/i,
      /tailwind/i,
      /codeigniter/i,
      /cake ?php/i,
      /http/i,
      /https/i,
      /angular/i,
      /firebase/i,
      /jquery/i,
      /next\.js/i,
      /framework/i,
      /java/i,
      /spring boot/i,
      /hibernate/i
    ]
  },
  {
    label: 'Développement mobile',
    patterns: [
      /développement mobile/i,
      /android/i,
      /kotlin/i,
      /react native/i,
      /flutter/i,
      /\bmobile\b/i
    ]
  },
  {
    label: 'Gaming',
    patterns: [/gaming/i, /\bgame\b/i, /unity/i, /\b2d\b/i]
  },
  {
    label: 'Développement desktop',
    patterns: [
      /développement desktop/i,
      /c#/i,
      /\.net/i,
      /winforms/i,
      /\bwpf\b/i,
      /console/i,
      /visual studio/i,
      /entity framework/i,
      /hangfire/i,
      /dll/i,
      /msi/i
    ]
  },
  {
    label: 'Virtualisation',
    patterns: [
      /virtualisation/i,
      /vmware/i,
      /vcenter/i,
      /vsphere/i,
      /esxi/i,
      /hyper[- ]?v/i,
      /virtualbox/i,
      /kvm/i,
      /cluster/i,
      /failover/i,
      /\bha\b/i
    ]
  },
  {
    label: 'DevOps / Cloud',
    patterns: [
      /devops/i,
      /docker/i,
      /kubernetes/i,
      /aws/i,
      /bitbucket/i,
      /git/i,
      /pipeline/i,
      /ci\/cd/i,
      /terraform/i,
      /cloud/i,
      /azure devops/i,
      /github actions/i,
      /ansible/i
    ]
  },
  {
    label: 'Data / IoT',
    patterns: [
      /data/i,
      /iot/i,
      /python/i,
      /raspberry/i,
      /camera/i,
      /json/i,
      /rest ?api/i,
      /mongodb/i,
      /\bsql\b/i,
      /pygame/i,
      /qr code/i,
      /qrcode/i
    ]
  },
  {
    label: 'Infrastructure',
    patterns: [
      /infrastructure/i,
      /\binfra\b/i,
      /lan/i,
      /wan/i,
      /vlan/i,
      /wlan/i,
      /radius/i,
      /nps/i,
      /cisco/i,
      /thousandeyes/i,
      /iaas/i,
      /network/i,
      /réseau|reseau/i
    ]
  },
  {
    label: 'Système',
    patterns: [
      /système/i,
      /systeme/i,
      /windows/i,
      /server/i,
      /active directory/i,
      /\bad\b/i,
      /azure ad/i,
      /entra id/i,
      /m365/i,
      /exchange online/i,
      /linux/i,
      /ubuntu/i,
      /debian/i,
      /samba/i,
      /dns/i,
      /dhcp/i,
      /powershell/i,
      /sccm/i,
      /mecm/i,
      /mdt/i,
      /wds/i,
      /intune/i,
      /wsus/i,
      /backup/i,
      /veeam/i,
      /restic/i,
      /monitoring/i,
      /prtg/i,
      /centreon/i,
      /glpi/i,
      /bookstack/i,
      /wiki/i,
      /servicenow/i,
      /service now/i,
      /atera/i,
      /nagios/i,
      /solar ?winds/i,
      /openldap/i,
      /ldap/i,
      /iptables/i,
      /restoration/i,
      /plan de sauvegarde/i
    ]
  }
]

const inferDomainLabel = (value) => {
  const normalized = normalizeFold(value)

  if (!normalized) {
    return ''
  }

  for (const rule of DOMAIN_RULES) {
    if (rule.patterns.some((pattern) => pattern.test(normalized))) {
      return rule.label
    }
  }

  return ''
}

const formatTagLabel = (value) => {
  const cleaned = formatFreeText(value)

  if (!cleaned) {
    return ''
  }

  const alias = TECH_LABELS.get(normalizeFold(cleaned))
  if (alias) {
    return alias
  }

  return titleCaseFallback(cleaned)
}

export const splitTags = (value) => {
  const source = Array.isArray(value) ? value : [value]
  const tags = []
  const seen = new Set()

  for (const entry of source) {
    if (entry == null) {
      continue
    }

    const chunks = String(entry).split(TAG_SPLIT_REGEX)

    for (const chunk of chunks) {
      const cleaned = cleanupTag(chunk)
      if (!cleaned) {
        continue
      }

      if (PLACEHOLDER_EMPTY_VALUES.has(cleaned.toLowerCase())) {
        continue
      }

      if (/^\d+$/.test(normalizeFold(cleaned))) {
        continue
      }

      const key = normalizeFold(cleaned)
      if (seen.has(key)) {
        continue
      }

      seen.add(key)
      tags.push(cleaned)
    }
  }

  return tags
}

export const formatInputDate = (value) => {
  const date = toDateObject(value)

  if (!date) {
    return ''
  }

  return date.toISOString().slice(0, 10)
}

export const formatDisplayDate = (value) => {
  const date = toDateObject(value)

  if (!date) {
    return 'Non planifiee'
  }

  return date.toLocaleDateString('fr-CH', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  })
}

export const buildTpiTagProfile = (tpi) => {
  const rawTags = splitTags(tpi?.tags)
  const displayTags = rawTags.filter(shouldDisplayTag)
  const contextText = [
    tpi?.domaine,
    tpi?.description,
    tpi?.sujet,
    ...rawTags
  ]
    .filter(Boolean)
    .join(' ')
  const domainLabel = inferDomainLabel(contextText)
  const grouped = new Map()

  const allEntries = displayTags.map((tag) => {
    const label = formatTagLabel(tag)
    const category = classifyCategory(`${tag} ${contextText}`)

    return {
      raw: tag,
      label,
      category
    }
  })

  const domainCategory = domainLabel ? classifyCategory(domainLabel) : null

  for (const entry of allEntries) {
    const current = grouped.get(entry.category.key)

    if (!current) {
      grouped.set(entry.category.key, {
        ...entry.category,
        tags: [entry],
        count: 1
      })
      continue
    }

    current.tags.push(entry)
    current.count += 1
  }

  const orderedGroups = Array.from(grouped.values()).sort((left, right) => {
    if (right.count !== left.count) {
      return right.count - left.count
    }

    return left.label.localeCompare(right.label, 'fr')
  })

  const matchedDomainGroup = domainCategory
    ? orderedGroups.find((group) => group.key === domainCategory.key)
    : null

  const primaryCategory =
    matchedDomainGroup ||
    orderedGroups[0] ||
    (domainCategory && domainCategory.key !== 'other'
      ? domainCategory
      : { key: 'other', label: 'Autre' })

  const primaryGroup = grouped.get(primaryCategory.key) || orderedGroups[0] || null
  const previewTags = []

  if (primaryGroup) {
    previewTags.push(...primaryGroup.tags.slice(0, 2).map((entry) => entry.label))
  }

  if (previewTags.length < 2) {
    for (const group of orderedGroups) {
      for (const entry of group.tags) {
        if (!previewTags.includes(entry.label)) {
          previewTags.push(entry.label)
        }

        if (previewTags.length >= 2) {
          break
        }
      }

      if (previewTags.length >= 2) {
        break
      }
    }
  }

  const categoryLabels = orderedGroups.map((group) => group.label)
  const categoryKeys = Array.from(
    new Set([
      ...orderedGroups.map((group) => group.key),
      ...(domainCategory && domainCategory.key !== 'other'
        ? [domainCategory.key]
        : [])
    ])
  )
  const searchText = [
    tpi?.refTpi,
    tpi?.candidat,
    tpi?.classe,
    tpi?.sujet,
    tpi?.description,
    tpi?.domaine,
    domainLabel,
    tpi?.boss,
    tpi?.lieu?.entreprise,
    tpi?.lieu?.site,
    tpi?.salle,
    ...rawTags,
    ...displayTags,
    ...categoryLabels
  ]
    .filter(Boolean)
    .join(' ')

  return {
    rawTags,
    displayTags,
    domainLabel,
    groupedTags: orderedGroups,
    primaryCategory: primaryCategory.label,
    primaryCategoryKey: primaryCategory.key,
    categoryKeys,
    previewTags,
    categoryLabels,
    totalTags: displayTags.length,
    searchText
  }
}

export const normalizeTpiForForm = (tpiToLoad) => {
  const toFormValue = (value) => normalizeOptionalText(value)

  if (!tpiToLoad) {
    return {
      refTpi: '',
      candidat: '',
      candidatPersonId: '',
      classe: '',
      expert1: '',
      expert1PersonId: '',
      expert2: '',
      expert2PersonId: '',
      boss: '',
      bossPersonId: '',
      sujet: '',
      description: '',
      tags: '',
      lieuEntreprise: '',
      lieuSite: '',
      salle: '',
      dateSoutenance: '',
      dateDepart: '',
      dateFin: '',
      date1ereVisite: '',
      date2emeVisite: '',
      dateRenduFinal: '',
      lienDepot: '',
      noteEvaluation: '',
      lienEvaluation: ''
    }
  }

  return {
    refTpi: toFormValue(tpiToLoad.refTpi ?? tpiToLoad.tpiRef),
    candidat: toFormValue(tpiToLoad.candidat),
    candidatPersonId: toFormValue(tpiToLoad.candidatPersonId),
    classe: toFormValue(tpiToLoad.classe),
    expert1: toFormValue(tpiToLoad.experts?.['1'] ?? tpiToLoad.experts?.[1] ?? tpiToLoad.expert1),
    expert1PersonId: toFormValue(tpiToLoad.expert1PersonId),
    expert2: toFormValue(tpiToLoad.experts?.['2'] ?? tpiToLoad.experts?.[2] ?? tpiToLoad.expert2),
    expert2PersonId: toFormValue(tpiToLoad.expert2PersonId),
    boss: toFormValue(tpiToLoad.boss),
    bossPersonId: toFormValue(tpiToLoad.bossPersonId),
    sujet: toFormValue(tpiToLoad.sujet),
    description: toFormValue(tpiToLoad.description ?? tpiToLoad.domaine),
    tags: splitTags(tpiToLoad.tags).join(', '),
    lieuEntreprise:
      toFormValue(
        tpiToLoad.lieu?.entreprise ??
        tpiToLoad['lieu-entreprise']
      ),
    lieuSite:
      toFormValue(
        tpiToLoad.lieu?.site ??
        tpiToLoad['lieu-site']
      ),
    salle: toFormValue(tpiToLoad.salle),
    dateSoutenance: formatInputDate(
      tpiToLoad.dates?.soutenance ?? tpiToLoad.dateSoutenance
    ),
    dateDepart: formatInputDate(tpiToLoad.dates?.depart ?? tpiToLoad.dateDepart),
    dateFin: formatInputDate(tpiToLoad.dates?.fin ?? tpiToLoad.dateFin),
    date1ereVisite: formatInputDate(
      tpiToLoad.dates?.premiereVisite ?? tpiToLoad.date1ereVisite
    ),
    date2emeVisite: formatInputDate(
      tpiToLoad.dates?.deuxiemeVisite ?? tpiToLoad.date2emeVisite
    ),
    dateRenduFinal: formatInputDate(
      tpiToLoad.dates?.renduFinal ?? tpiToLoad.dateRenduFinal
    ),
    lienDepot: toFormValue(tpiToLoad.lienDepot),
    noteEvaluation:
      tpiToLoad.evaluation?.note ??
      tpiToLoad.noteEvaluation ??
      '',
    lienEvaluation:
      toFormValue(
        tpiToLoad.evaluation?.lien ??
        tpiToLoad.lienEvaluation
      )
  }
}

const STAKEHOLDER_LINK_FIELDS = [
  {
    label: 'candidat',
    name: 'candidat',
    idName: 'candidatPersonId'
  },
  {
    label: 'expert 1',
    name: ['experts', '1'],
    idName: 'expert1PersonId'
  },
  {
    label: 'expert 2',
    name: ['experts', '2'],
    idName: 'expert2PersonId'
  },
  {
    label: 'chef de projet',
    name: 'boss',
    idName: 'bossPersonId'
  }
]

const formatStakeholderRoleLabel = (value) => {
  const normalizedRole = normalizeFold(value)

  switch (normalizedRole) {
    case 'candidat':
      return 'candidat'
    case 'expert1':
    case 'expert_1':
    case 'expert 1':
      return 'expert 1'
    case 'expert2':
    case 'expert_2':
    case 'expert 2':
      return 'expert 2'
    case 'chef_projet':
    case 'chef projet':
    case 'chef de projet':
    case 'boss':
      return 'chef de projet'
    default:
      return normalizeOptionalText(value)
  }
}

const readStakeholderStateLabels = (tpi, key) => {
  const roles = tpi?.stakeholderState?.[key]

  if (!Array.isArray(roles)) {
    return null
  }

  return Array.from(
    new Set(
      roles
        .map((role) => formatStakeholderRoleLabel(role))
        .filter(Boolean)
    )
  )
}

const readStakeholderPersonId = (tpi, idName) =>
  normalizeOptionalText(tpi?.[idName])

const readStakeholderValue = (tpi, fieldPath) => {
  if (!tpi || !fieldPath) {
    return ''
  }

  if (Array.isArray(fieldPath)) {
    return normalizeOptionalText(fieldPath.reduce((current, key) => current?.[key], tpi))
  }

  return normalizeOptionalText(tpi[fieldPath])
}

export const getMissingStakeholderLinks = (tpi = {}) => {
  const derivedMissingLinks = readStakeholderStateLabels(tpi, 'unresolvedRoles')

  if (derivedMissingLinks) {
    return derivedMissingLinks
  }

  return STAKEHOLDER_LINK_FIELDS.filter((field) => {
    const value = String(readStakeholderValue(tpi, field.name) || '').trim()
    const personId = String(readStakeholderPersonId(tpi, field.idName) || '').trim()

    return Boolean(value) && !personId
  }).map((field) => field.label)
}

export const getMissingStakeholders = (tpi = {}) => {
  const derivedMissingStakeholders = readStakeholderStateLabels(tpi, 'missingRoles')

  if (derivedMissingStakeholders) {
    return derivedMissingStakeholders
  }

  return STAKEHOLDER_LINK_FIELDS.filter((field) => {
    const value = String(readStakeholderValue(tpi, field.name) || '').trim()
    const personId = String(readStakeholderPersonId(tpi, field.idName) || '').trim()

    return !value && !personId
  }).map((field) => field.label)
}

export const hasMissingStakeholders = (tpi = {}) =>
  getMissingStakeholders(tpi).length > 0

export const getStakeholderIssues = (tpi = {}) => {
  const missingStakeholders = getMissingStakeholders(tpi)
  const missingLinks = getMissingStakeholderLinks(tpi)
  const details = []

  if (missingStakeholders.length > 0) {
    details.push(`Manquants: ${missingStakeholders.join(', ')}`)
  }

  if (missingLinks.length > 0) {
    details.push(`Liaisons: ${missingLinks.join(', ')}`)
  }

  return {
    missingStakeholders,
    missingLinks,
    hasIssues: missingStakeholders.length > 0 || missingLinks.length > 0,
    summary: details.join(' | ') || 'Completes'
  }
}

export const hasStakeholderIssues = (tpi = {}) =>
  getStakeholderIssues(tpi).hasIssues

export const hasIncompleteStakeholderLinks = (tpi = {}) =>
  getMissingStakeholderLinks(tpi).length > 0

export const normalizeTpiForSave = (formData) => {
  const toSaveValue = (value) => {
    const trimmed = normalizeOptionalText(value)
    return trimmed || null
  }

  const noteValue =
    normalizeOptionalText(formData.noteEvaluation) === ''
      ? null
      : Number(formData.noteEvaluation)

  return {
    refTpi: normalizeOptionalText(formData.refTpi),
    candidat: normalizeOptionalText(formData.candidat),
    candidatPersonId: toSaveValue(formData.candidatPersonId),
    classe: normalizeOptionalText(formData.classe),
    experts: {
      1: normalizeOptionalText(formData.expert1),
      2: normalizeOptionalText(formData.expert2)
    },
    expert1PersonId: toSaveValue(formData.expert1PersonId),
    expert2PersonId: toSaveValue(formData.expert2PersonId),
    boss: normalizeOptionalText(formData.boss),
    bossPersonId: toSaveValue(formData.bossPersonId),
    lieu: {
      entreprise: normalizeOptionalText(formData.lieuEntreprise),
      site: normalizeOptionalText(formData.lieuSite)
    },
    sujet: normalizeOptionalText(formData.sujet),
    description: normalizeOptionalText(formData.description),
    tags: splitTags(formData.tags),
    dates: {
      soutenance: toSaveValue(formData.dateSoutenance),
      depart: toSaveValue(formData.dateDepart),
      fin: toSaveValue(formData.dateFin),
      premiereVisite: toSaveValue(formData.date1ereVisite),
      deuxiemeVisite: toSaveValue(formData.date2emeVisite),
      renduFinal: toSaveValue(formData.dateRenduFinal)
    },
    lienDepot: normalizeOptionalText(formData.lienDepot),
    evaluation: {
      note: Number.isFinite(noteValue) ? noteValue : null,
      lien: normalizeOptionalText(formData.lienEvaluation)
    },
    salle: normalizeOptionalText(formData.salle)
  }
}

export const getTpiLocationLabel = (tpi) => {
  const entreprise = tpi?.lieu?.entreprise
  const site = tpi?.lieu?.site
  const salle = tpi?.salle

  return [entreprise, site, salle].filter(Boolean).join(' - ') || 'Lieu non renseigné'
}

export const getTpiTimelineLabel = (tpi) => {
  const soutenanceDate = tpi?.dates?.soutenance
  const startDate = tpi?.dates?.depart
  const endDate = tpi?.dates?.fin

  if (soutenanceDate) {
    return `Soutenance ${formatDisplayDate(soutenanceDate)}`
  }

  if (startDate && endDate) {
    return `${formatDisplayDate(startDate)} -> ${formatDisplayDate(endDate)}`
  }

  if (startDate) {
    return `Debut ${formatDisplayDate(startDate)}`
  }

  if (endDate) {
    return `Fin ${formatDisplayDate(endDate)}`
  }

  return 'Dates non renseignées'
}

export const matchesSearch = (tpi, query, profile = null) => {
  const normalizedQuery = String(query || '').trim().toLowerCase()

  if (!normalizedQuery) {
    return true
  }

  const haystack = profile?.searchText || [
    tpi?.refTpi,
    tpi?.candidat,
    tpi?.classe,
    tpi?.sujet,
    tpi?.description,
    tpi?.domaine,
    tpi?.boss,
    tpi?.experts?.['1'],
    tpi?.experts?.['2'],
    tpi?.lieu?.entreprise,
    tpi?.lieu?.site,
    tpi?.salle,
    ...(splitTags(tpi?.tags) || [])
  ]
    .filter(Boolean)
    .join(' ')

  return normalizeFold(haystack).includes(normalizeFold(normalizedQuery))
}

export const getCategoryChipClass = (categoryKey) => {
  return `tpi-category-chip category-${normalizeFold(categoryKey).replace(/[^a-z0-9]+/g, '-')}`
}

export const getCategoryLabelFromKey = (categoryKey) => {
  const match = CATEGORY_RULES.find((rule) => rule.key === categoryKey)
  return match?.label || 'Autre'
}
