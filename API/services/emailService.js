/**
 * Service d'envoi d'emails
 * Gère les notifications par email (magic links, rappels de vote, confirmations)
 */

const crypto = require('crypto')
const nodemailer = require('nodemailer')
const { normalizeEmailSettings } = require('./coordinationCatalogService')
const {
  formatTpiStakeholderRoleLabel
} = require('../modules/stakeholders/stakeholderDefinitions')

function normalizeSmtpPort(value) {
  const parsed = Number.parseInt(String(value || ''), 10)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 587
}

function normalizePositiveInteger(value, fallback) {
  const parsed = Number.parseInt(String(value || ''), 10)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback
}

function normalizeDomain(value) {
  const domain = sanitizeHeaderText(value)
    .replace(/^@+/, '')
    .replace(/\.+$/, '')
    .toLowerCase()

  return /^[a-z0-9.-]+\.[a-z]{2,}$/.test(domain) ? domain : ''
}

function normalizeDkimPrivateKey(value) {
  const privateKey = String(value || '').replace(/\\n/g, '\n').trim()
  return privateKey || ''
}

function getDkimConfig(env = process.env) {
  const domainName = normalizeDomain(env.SMTP_DKIM_DOMAIN || getEmailDomain(env.SMTP_FROM))
  const keySelector = sanitizeHeaderText(env.SMTP_DKIM_SELECTOR)
  const privateKey = normalizeDkimPrivateKey(env.SMTP_DKIM_PRIVATE_KEY)

  if (!domainName || !keySelector || !privateKey) {
    return null
  }

  return {
    domainName,
    keySelector,
    privateKey
  }
}

function getSmtpTransportConfig(env = process.env) {
  const port = normalizeSmtpPort(env.SMTP_PORT || (env.NODE_ENV === 'production' ? 465 : 587))
  const dkim = getDkimConfig(env)

  const config = {
    host: sanitizeHeaderText(env.SMTP_HOST),
    port,
    secure: port === 465,
    user: sanitizeHeaderText(env.SMTP_USER),
    pass: String(env.SMTP_PASS || ''),
    connectionTimeout: normalizePositiveInteger(env.SMTP_CONNECTION_TIMEOUT_MS, 10000),
    greetingTimeout: normalizePositiveInteger(env.SMTP_GREETING_TIMEOUT_MS, 10000),
    socketTimeout: normalizePositiveInteger(env.SMTP_SOCKET_TIMEOUT_MS, 30000)
  }

  if (dkim) {
    config.dkim = dkim
  }

  return config
}

// Configuration du transporteur (à adapter selon l'environnement)
const createTransporter = () => {
  const config = getSmtpTransportConfig()
  const missing = []

  if (!config.host) missing.push('SMTP_HOST')
  if (!config.user) missing.push('SMTP_USER')
  if (!config.pass) missing.push('SMTP_PASS')

  if (missing.length > 0) {
    const error = new Error(`Configuration SMTP incomplète: ${missing.join(', ')}.`)
    error.code = 'SMTP_CONFIG_MISSING'
    throw error
  }

  const transportOptions = {
    host: config.host,
    port: config.port,
    secure: config.secure,
    connectionTimeout: config.connectionTimeout,
    greetingTimeout: config.greetingTimeout,
    socketTimeout: config.socketTimeout,
    auth: {
      user: config.user,
      pass: config.pass
    }
  }

  if (config.dkim) {
    transportOptions.dkim = config.dkim
  }

  return nodemailer.createTransport(transportOptions)
}

function sanitizeHeaderText(value) {
  if (value === null || value === undefined) {
    return ''
  }

  return String(value).replace(/[\r\n]+/g, ' ').trim()
}

function sanitizeEmailAddress(value) {
  const email = sanitizeHeaderText(value).replace(/,/g, '').toLowerCase()

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return ''
  }

  return email
}

function quoteDisplayName(value) {
  const displayName = sanitizeHeaderText(value) || 'TPI Organizer'
  return `"${displayName.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`
}

function unquoteDisplayName(value) {
  const displayName = sanitizeHeaderText(value)
  const quotedMatch = displayName.match(/^"(.+)"$/)
  return quotedMatch ? quotedMatch[1] : displayName
}

function buildSenderHeader(displayName, email) {
  const senderEmail = sanitizeEmailAddress(email)

  if (!senderEmail) {
    return ''
  }

  return `${quoteDisplayName(displayName)} <${senderEmail}>`
}

function parseSenderHeader(value) {
  const header = sanitizeHeaderText(value)

  if (!header) {
    return null
  }

  const formattedMatch = header.match(/^(.*?)<([^<>]+)>$/)
  const rawDisplayName = formattedMatch ? formattedMatch[1] : ''
  const rawEmail = formattedMatch ? formattedMatch[2] : header
  const email = sanitizeEmailAddress(rawEmail)

  if (!email) {
    return null
  }

  const displayName = unquoteDisplayName(rawDisplayName) || 'TPI Organizer'

  return {
    displayName,
    email,
    header: buildSenderHeader(displayName, email)
  }
}

function extractEmailAddress(value) {
  const parsed = parseSenderHeader(value)
  return parsed?.email || sanitizeEmailAddress(value)
}

function getEmailDomain(value) {
  const email = extractEmailAddress(value)
  const atIndex = email.lastIndexOf('@')

  return atIndex > 0 ? normalizeDomain(email.slice(atIndex + 1)) : ''
}

function getAllowedSenderDomains(env = process.env) {
  const domains = new Set()
  const explicitDomains = [
    env.SMTP_ALLOWED_FROM_DOMAINS,
    env.SMTP_FROM_ALLOWED_DOMAINS
  ]
    .filter(Boolean)
    .join(',')
    .split(/[,\s;]+/)
    .map(normalizeDomain)
    .filter(Boolean)

  for (const domain of explicitDomains) {
    domains.add(domain)
  }

  const fromDomain = getEmailDomain(env.SMTP_FROM)
  const smtpUserDomain = getEmailDomain(env.SMTP_USER)

  if (fromDomain) {
    domains.add(fromDomain)
  } else if (smtpUserDomain) {
    domains.add(smtpUserDomain)
  }

  for (const source of [env.SMTP_ENVELOPE_FROM, env.SMTP_DKIM_DOMAIN]) {
    const domain = getEmailDomain(source) || normalizeDomain(source)
    if (domain) {
      domains.add(domain)
    }
  }

  return domains
}

function isSenderDomainAllowed(email, env = process.env) {
  const senderDomain = getEmailDomain(email)
  const allowedDomains = getAllowedSenderDomains(env)

  return Boolean(senderDomain) && (allowedDomains.size === 0 || allowedDomains.has(senderDomain))
}

function getDefaultSender(env = process.env, fallbackName = 'TPI Organizer') {
  const fromSender = parseSenderHeader(env.SMTP_FROM)

  if (fromSender) {
    return fromSender
  }

  const smtpUserEmail = sanitizeEmailAddress(env.SMTP_USER)

  if (smtpUserEmail) {
    return {
      displayName: fallbackName,
      email: smtpUserEmail,
      header: buildSenderHeader(fallbackName, smtpUserEmail)
    }
  }

  return {
    displayName: fallbackName,
    email: 'noreply@tpi-organizer.ch',
    header: buildSenderHeader(fallbackName, 'noreply@tpi-organizer.ch')
  }
}

function resolveMailSender(emailSettings = {}, options = {}) {
  const settings = normalizeEmailSettings(emailSettings)
  const env = options.env || process.env
  const fromArbitrage = options.fromArbitrage === true
  const requestedEmail = fromArbitrage
    ? sanitizeEmailAddress(env.SMTP_FROM_ARBITRAGE || settings.senderArbitrageEmail)
    : sanitizeEmailAddress(settings.senderEmail)
  const requestedName = fromArbitrage
    ? sanitizeHeaderText(
        env.SMTP_FROM_NAME_ARBITRAGE ||
        settings.senderArbitrageName ||
        settings.senderName
      ) || 'TPI Organizer'
    : sanitizeHeaderText(settings.senderName) || 'TPI Organizer'

  if (requestedEmail && isSenderDomainAllowed(requestedEmail, env)) {
    return {
      displayName: requestedName,
      email: requestedEmail,
      header: buildSenderHeader(requestedName, requestedEmail),
      requestedEmail,
      fallbackUsed: false
    }
  }

  const defaultSender = getDefaultSender(env, requestedName)

  return {
    ...defaultSender,
    requestedEmail,
    fallbackUsed: Boolean(requestedEmail && requestedEmail !== defaultSender.email)
  }
}

function buildConfiguredSender(emailSettings = {}, env = process.env) {
  return resolveMailSender(emailSettings, { env }).header
}

function buildArbitrageSender(emailSettings = {}, env = process.env) {
  return resolveMailSender(emailSettings, { env, fromArbitrage: true }).header
}

function buildMessageId(senderEmail, env = process.env) {
  const messageIdDomain = normalizeDomain(env.SMTP_MESSAGE_ID_DOMAIN) || getEmailDomain(senderEmail)

  if (!messageIdDomain) {
    return ''
  }

  return `<tpi-${Date.now()}-${crypto.randomUUID()}@${messageIdDomain}>`
}

function buildEnvelope(fromEmail, to, env = process.env) {
  const envelopeFrom = sanitizeEmailAddress(env.SMTP_ENVELOPE_FROM) || sanitizeEmailAddress(fromEmail)

  if (!envelopeFrom) {
    return null
  }

  return {
    from: envelopeFrom,
    to
  }
}

function normalizeListUnsubscribeUrl(value) {
  const rawUrl = sanitizeHeaderText(value)

  if (!rawUrl) {
    return ''
  }

  try {
    const url = new URL(rawUrl)
    return ['http:', 'https:', 'mailto:'].includes(url.protocol) ? url.toString() : ''
  } catch (error) {
    return ''
  }
}

function buildListUnsubscribeHeader({ env = process.env, replyToEmail = '', senderEmail = '' } = {}) {
  const entries = []
  const unsubscribeUrl = normalizeListUnsubscribeUrl(env.SMTP_LIST_UNSUBSCRIBE_URL)
  const unsubscribeEmail = sanitizeEmailAddress(env.SMTP_LIST_UNSUBSCRIBE_EMAIL) ||
    sanitizeEmailAddress(replyToEmail) ||
    sanitizeEmailAddress(senderEmail)

  if (unsubscribeUrl) {
    entries.push(`<${unsubscribeUrl}>`)
  }

  if (unsubscribeEmail) {
    entries.push(`<mailto:${unsubscribeEmail}?subject=unsubscribe>`)
  }

  return entries.join(', ')
}

function buildDeliverabilityHeaders(messageType = '', options = {}) {
  const headers = {
    'Auto-Submitted': 'auto-generated',
    'X-Auto-Response-Suppress': 'All'
  }

  const normalizedType = sanitizeHeaderText(messageType)
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')

  if (normalizedType) {
    headers['X-TPI-Organizer-Template'] = normalizedType
  }

  const listUnsubscribe = buildListUnsubscribeHeader(options)
  if (listUnsubscribe) {
    headers['List-Unsubscribe'] = listUnsubscribe
  }

  return headers
}

function buildMailOptions({
  to,
  emailContent,
  emailSettings = {},
  fromArbitrage = false,
  env = process.env,
  messageType = '',
  attachments = []
}) {
  const settings = normalizeEmailSettings(emailSettings)
  const replyToEmail = sanitizeEmailAddress(settings.replyToEmail)
  const sender = resolveMailSender(settings, { env, fromArbitrage })
  const fallbackReplyTo = sender.fallbackUsed ? sanitizeEmailAddress(sender.requestedEmail) : ''
  const effectiveReplyTo = replyToEmail || fallbackReplyTo
  const envelope = buildEnvelope(sender.email, to, env)
  const messageId = buildMessageId(sender.email, env)
  const mailOptions = {
    from: sender.header,
    to,
    subject: emailContent.subject,
    text: emailContent.text,
    html: emailContent.html,
    headers: buildDeliverabilityHeaders(messageType, {
      env,
      replyToEmail: effectiveReplyTo,
      senderEmail: sender.email
    })
  }

  if (effectiveReplyTo) {
    mailOptions.replyTo = effectiveReplyTo
  }

  if (envelope) {
    mailOptions.envelope = envelope
  }

  if (messageId) {
    mailOptions.messageId = messageId
  }

  if (Array.isArray(attachments) && attachments.length > 0) {
    mailOptions.attachments = attachments
  }

  return mailOptions
}

function getConfiguredBrandName(emailSettings = {}) {
  const settings = normalizeEmailSettings(emailSettings)
  return sanitizeHeaderText(settings.senderName) || 'TPI Organizer'
}

function getConfiguredContactEmail(emailSettings = {}) {
  const settings = normalizeEmailSettings(emailSettings)
  return sanitizeEmailAddress(settings.replyToEmail || settings.senderEmail)
}

function formatLinkValidityLabel(hours) {
  const parsed = Number.parseInt(String(hours), 10)

  if (!Number.isInteger(parsed) || parsed <= 0) {
    return '24 heures'
  }

  if (parsed % 24 === 0) {
    const days = parsed / 24
    return `${days} jour${days > 1 ? 's' : ''}`
  }

  return `${parsed} heure${parsed > 1 ? 's' : ''}`
}

function escapeHtml(value) {
  if (value === null || value === undefined) {
    return ''
  }

  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function normalizeEmailRoleList(roles = []) {
  return (Array.isArray(roles) ? roles : [roles])
    .map((role) => String(role || '').trim().toLowerCase())
    .filter(Boolean)
}

function buildSoutenanceResponseDeadlineCopy(data = {}) {
  if (data.responseDeadlineCopy) {
    return String(data.responseDeadlineCopy).trim()
  }

  const audience = String(data.recipientAudience || '').trim().toLowerCase()
  const roles = normalizeEmailRoleList(data.recipientRoles)

  if (audience === 'cdp' || roles.includes('chef_projet')) {
    return 'Merci de faire votre retour dans les 3 jours uniquement si une modification est indispensable.'
  }

  if (
    audience === 'expert' ||
    roles.includes('expert') ||
    roles.includes('expert1') ||
    roles.includes('expert2')
  ) {
    return 'Merci de faire votre retour dans les 5 jours maximum uniquement si une modification est indispensable.'
  }

  return ''
}

function buildGeneralSoutenanceViewUrl(value) {
  const rawUrl = String(value || '').trim()

  if (!rawUrl) {
    return ''
  }

  try {
    const url = new URL(rawUrl)
    url.searchParams.set('view', 'general')
    return url.toString()
  } catch (error) {
    return rawUrl
  }
}

function buildSoutenanceAccessEmail(data) {
  const brandName = escapeHtml(data.brandName || 'TPI Organizer')
  const recipientName = escapeHtml(data.recipientName || '')
  const year = escapeHtml(data.year)
  const deadline = escapeHtml(data.deadline)
  const magicLinkUrl = escapeHtml(data.magicLinkUrl)
  const isScheduleUpdateMessage = sanitizeHeaderText(data.messageType) === 'schedule_update'
  const recipientRoles = Array.isArray(data.recipientRoles)
    ? data.recipientRoles.map((role) => String(role || '').trim().toLowerCase()).filter(Boolean)
    : []
  const isAdminRecipient = data.isAdmin === true || recipientRoles.includes('admin')
  const generalViewUrl = escapeHtml(buildGeneralSoutenanceViewUrl(data.adminGeneralViewUrl || data.magicLinkUrl))
  const responseDeadlineCopy = buildSoutenanceResponseDeadlineCopy(data)
  const responseDeadlineCopyHtml = escapeHtml(responseDeadlineCopy)
  const responseDeadlineHtml = responseDeadlineCopyHtml
    ? `<p style="margin:0 0 14px; font-size:15px; line-height:23px; color:#0f172a;"><strong style="color:#0f766e;">${responseDeadlineCopyHtml}</strong></p>`
    : ''
  const adminAccessHtml = isAdminRecipient
    ? `<p style="margin:0 0 14px; color:#1e40af; font-size:15px; line-height:24px;"><strong>Accès administrateur:</strong> ce lien personnel permet aussi d’afficher la vue générale des défenses. Dans cette vue, seuls les filtres date et type de classe restent appliqués.</p><p style="margin:0 0 14px; color:#334155; font-size:15px; line-height:24px;"><a href="${generalViewUrl}" style="color:#1d4ed8; font-weight:700;">Ouvrir la vue générale</a></p>`
    : ''
  const responseDeadlineText = responseDeadlineCopy
    ? `\n      ${responseDeadlineCopy}\n`
    : ''
  const adminAccessText = isAdminRecipient
    ? `\n      Accès administrateur: ce lien personnel permet aussi d’afficher la vue générale des défenses. Dans cette vue, seuls les filtres date et type de classe restent appliqués.\n      Vue générale: ${buildGeneralSoutenanceViewUrl(data.adminGeneralViewUrl || data.magicLinkUrl)}\n`
    : ''

  if (isScheduleUpdateMessage) {
    const updateDeadlineCopy = responseDeadlineCopy
      ? responseDeadlineCopy.replace(
          'uniquement si une modification est indispensable',
          'si la nouvelle planification pose un empêchement réel'
        )
      : ''
    const updateDeadlineHtml = updateDeadlineCopy
      ? `<p style="margin:0 0 14px; font-size:15px; line-height:23px; color:#0f172a;"><strong style="color:#0f766e;">${escapeHtml(updateDeadlineCopy)}</strong></p>`
      : ''
    const updateDeadlineText = updateDeadlineCopy ? `\n      ${updateDeadlineCopy}\n` : ''

    return {
      subject: `[${data.brandName || 'TPI Organizer'}] Mise à jour de l’horaire des défenses TPI ${data.year}`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <title>Mise à jour de l’horaire des défenses TPI ${year}</title>
        </head>
        <body style="margin:0; padding:0; background:#f3f6f8; color:#172033; font-family:Arial, Helvetica, sans-serif;">
          <div style="display:none; max-height:0; overflow:hidden; color:#f3f6f8; opacity:0;">L’horaire des défenses TPI ${year} a été modifié. Merci de contrôler votre vue personnelle.</div>
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse; background:#f3f6f8;">
            <tr>
              <td align="center" style="padding:32px 16px;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="width:100%; max-width:640px; border-collapse:separate; border-spacing:0; background:#ffffff; border:1px solid #dbe5ec; border-radius:14px; overflow:hidden; box-shadow:0 12px 30px rgba(15, 23, 42, 0.08);">
                  <tr>
                    <td style="height:6px; line-height:6px; background:#0f766e; font-size:1px;">&nbsp;</td>
                  </tr>
                  <tr>
                    <td style="padding:26px 30px 20px; background:#ffffff;">
                      <div style="display:inline-block; margin:0 0 12px; padding:5px 10px; border-radius:999px; background:#ecfdf5; color:#0f766e; font-size:12px; line-height:16px; font-weight:700; text-transform:uppercase;">${brandName}</div>
                      <h1 style="margin:0; color:#0f172a; font-size:25px; line-height:32px; font-weight:700;">Mise à jour de l’horaire des défenses TPI ${year}</h1>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding:0 30px 30px;">
                      <p style="margin:0 0 16px; color:#172033; font-size:16px; line-height:25px;">Bonjour ${recipientName},</p>
                      <p style="margin:0 0 24px; color:#334155; font-size:16px; line-height:26px;">Nous avons modifié l’horaire des défenses TPI ${year}. Merci de contrôler votre vue personnelle et de vérifier si les modifications vous conviennent.</p>

                      <table role="presentation" align="center" cellspacing="0" cellpadding="0" style="border-collapse:collapse; margin:0 auto 26px;">
                        <tr>
                          <td style="border-radius:10px; background:#0f766e;">
                            <a href="${magicLinkUrl}" style="display:inline-block; background:#0f766e; color:#ffffff; text-decoration:none; font-weight:700; font-size:16px; line-height:20px; padding:14px 22px; border-radius:10px;">Contrôler mon horaire</a>
                          </td>
                        </tr>
                      </table>

                      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:separate; border-spacing:0; margin:0 0 24px; background:#f8fafc; border:1px solid #e2e8f0; border-radius:12px;">
                        <tr>
                          <td style="padding:18px 20px;">
                            <p style="margin:0 0 14px; color:#334155; font-size:15px; line-height:24px;">Veuillez vérifier la date, l’heure et la salle de vos défenses, ainsi que l’impact éventuel sur votre calendrier.</p>
                            ${adminAccessHtml}
                            ${updateDeadlineHtml}
                            <p style="margin:0 0 14px; color:#334155; font-size:15px; line-height:24px;">Si tout est en ordre, aucune action n’est nécessaire.</p>
                            <p style="margin:0; color:#334155; font-size:15px; line-height:24px;">Si cette nouvelle planification pose un empêchement réel et important, utilisez le formulaire accessible depuis votre lien personnel. Les possibilités de déplacement restent limitées et aucune nouvelle adaptation ne peut être garantie.</p>
                          </td>
                        </tr>
                      </table>

                      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse; border-top:1px solid #e5edf3;">
                        <tr>
                          <td style="padding:18px 0 0;">
                            <p style="margin:0 0 8px; color:#526072; font-size:14px; line-height:21px;"><strong style="color:#172033;">Validité du lien:</strong> ${deadline}</p>
                            <p style="margin:0 0 20px; color:#64748b; font-size:13px; line-height:20px;">Ce lien est personnel et ne doit pas être partagé.</p>
                            <p style="margin:0; color:#334155; font-size:15px; line-height:23px;">Meilleures salutations</p>
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </body>
        </html>
      `,
      text: `
        Mise à jour de l’horaire des défenses TPI ${data.year}

        Bonjour ${data.recipientName},

        Nous avons modifié l’horaire des défenses TPI ${data.year}. Merci de contrôler votre vue personnelle et de vérifier si les modifications vous conviennent.

        Contrôler mon horaire:
        ${data.magicLinkUrl}

        Veuillez vérifier la date, l’heure et la salle de vos défenses, ainsi que l’impact éventuel sur votre calendrier.
        ${adminAccessText}
        ${updateDeadlineText}

        Si tout est en ordre, aucune action n’est nécessaire.

        Si cette nouvelle planification pose un empêchement réel et important, utilisez le formulaire accessible depuis votre lien personnel. Les possibilités de déplacement restent limitées et aucune nouvelle adaptation ne peut être garantie.

        Validité du lien: ${data.deadline}
        Ce lien est personnel.
      `
    }
  }

  return {
    subject: `[${data.brandName || 'TPI Organizer'}] Horaire des défenses TPI ${data.year}`,
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <title>Horaire des défenses TPI ${year}</title>
      </head>
      <body style="margin:0; padding:0; background:#f3f6f8; color:#172033; font-family:Arial, Helvetica, sans-serif;">
        <div style="display:none; max-height:0; overflow:hidden; color:#f3f6f8; opacity:0;">L’horaire des défenses TPI ${year} est publié. Consultez votre vue personnelle.</div>
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse; background:#f3f6f8;">
          <tr>
            <td align="center" style="padding:32px 16px;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="width:100%; max-width:640px; border-collapse:separate; border-spacing:0; background:#ffffff; border:1px solid #dbe5ec; border-radius:14px; overflow:hidden; box-shadow:0 12px 30px rgba(15, 23, 42, 0.08);">
                <tr>
                  <td style="height:6px; line-height:6px; background:#0f766e; font-size:1px;">&nbsp;</td>
                </tr>
                <tr>
                  <td style="padding:26px 30px 20px; background:#ffffff;">
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;">
                      <tr>
                        <td style="padding:0;">
                          <div style="display:inline-block; margin:0 0 12px; padding:5px 10px; border-radius:999px; background:#ecfdf5; color:#0f766e; font-size:12px; line-height:16px; font-weight:700; text-transform:uppercase;">${brandName}</div>
                          <h1 style="margin:0; color:#0f172a; font-size:25px; line-height:32px; font-weight:700;">Horaire des défenses TPI ${year}</h1>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td style="padding:0 30px 30px;">
                    <p style="margin:0 0 16px; color:#172033; font-size:16px; line-height:25px;">Bonjour ${recipientName},</p>
                    <p style="margin:0 0 24px; color:#334155; font-size:16px; line-height:26px;">L’horaire des défenses TPI ${year} est publié. Vous pouvez consulter votre vue personnelle avec le lien ci-dessous.</p>

                    <table role="presentation" align="center" cellspacing="0" cellpadding="0" style="border-collapse:collapse; margin:0 auto 26px;">
                      <tr>
                        <td style="border-radius:10px; background:#0f766e;">
                          <a href="${magicLinkUrl}" style="display:inline-block; background:#0f766e; color:#ffffff; text-decoration:none; font-weight:700; font-size:16px; line-height:20px; padding:14px 22px; border-radius:10px;">Voir mon horaire</a>
                        </td>
                      </tr>
                    </table>

                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:separate; border-spacing:0; margin:0 0 24px; background:#f8fafc; border:1px solid #e2e8f0; border-radius:12px;">
                      <tr>
                        <td style="padding:18px 20px;">
                          <p style="margin:0 0 14px; color:#334155; font-size:15px; line-height:24px;">Ce lien donne aussi accès au téléchargement iCal et, si nécessaire, au formulaire de demande de modification.</p>
                          ${adminAccessHtml}
                          ${responseDeadlineHtml}
                          <p style="margin:0 0 14px; color:#334155; font-size:15px; line-height:24px;">Merci de considérer l’horaire comme définitif. Une demande de modification ne doit être déposée qu’en cas d’empêchement réel et important, après avoir vérifié qu’aucune adaptation de votre côté n’est possible.</p>
                          <p style="margin:0; color:#334155; font-size:15px; line-height:24px;">Les possibilités de déplacement sont très limitées. Toute demande sera examinée, mais aucune modification ne peut être garantie.</p>
                        </td>
                      </tr>
                    </table>

                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse; border-top:1px solid #e5edf3;">
                      <tr>
                        <td style="padding:18px 0 0;">
                          <p style="margin:0 0 8px; color:#526072; font-size:14px; line-height:21px;"><strong style="color:#172033;">Validité du lien:</strong> ${deadline}</p>
                          <p style="margin:0 0 20px; color:#64748b; font-size:13px; line-height:20px;">Ce lien est personnel et ne doit pas être partagé.</p>
                          <p style="margin:0; color:#334155; font-size:15px; line-height:23px;">Meilleures salutations</p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
      </html>
    `,
    text: `
      Horaire des défenses TPI ${data.year}

      Bonjour ${data.recipientName},

      L’horaire des défenses TPI ${data.year} est publié. Vous pouvez consulter votre vue personnelle avec le lien ci-dessous.

      Ouvrir ma vue personnelle:
      ${data.magicLinkUrl}

      Ce lien donne aussi accès au téléchargement iCal et, si nécessaire, au formulaire de demande de modification.
      ${adminAccessText}
      ${responseDeadlineText}

      Merci de considérer l’horaire comme définitif. Une demande de modification ne doit être déposée qu’en cas d’empêchement réel et important, après avoir vérifié qu’aucune adaptation de votre côté n’est possible.

      Les possibilités de déplacement sont très limitées. Toute demande sera examinée, mais aucune modification ne peut être garantie.

      Validité du lien: ${data.deadline}
      Ce lien est personnel.
    `
  }
}

function buildSoutenanceSchedulePackageEmail(data) {
  const brandName = escapeHtml(data.brandName || 'TPI Organizer')
  const recipientName = escapeHtml(data.recipientName || '')
  const year = escapeHtml(data.year)
  const tpiCount = Number(data.tpiCount || 0)
  const roomCount = Number(data.roomCount || 0)
  const publicationVersion = data.publicationVersion
    ? escapeHtml(data.publicationVersion)
    : ''
  const generatedAt = escapeHtml(data.generatedAtLabel || '')
  const publicationCopy = publicationVersion
    ? `Publication ${publicationVersion}`
    : 'Publication active'
  const generatedCopyHtml = generatedAt
    ? `<p style="margin:0 0 8px; color:#64748b; font-size:13px; line-height:20px;">Généré le ${generatedAt}</p>`
    : ''
  const generatedCopyText = generatedAt ? `\nGénéré le ${data.generatedAtLabel}` : ''

  return {
    subject: `[${data.brandName || 'TPI Organizer'}] Horaire définitif des défenses TPI ${data.year}`,
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <title>Horaire définitif des défenses TPI ${year}</title>
      </head>
      <body style="margin:0; padding:0; background:#f3f6f8; color:#172033; font-family:Arial, Helvetica, sans-serif;">
        <div style="display:none; max-height:0; overflow:hidden; color:#f3f6f8; opacity:0;">Votre horaire personnel, votre iCal et la vue globale des salles sont joints à ce message.</div>
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse; background:#f3f6f8;">
          <tr>
            <td align="center" style="padding:32px 16px;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="width:100%; max-width:660px; border-collapse:separate; border-spacing:0; background:#ffffff; border:1px solid #dbe5ec; border-radius:14px; overflow:hidden; box-shadow:0 12px 30px rgba(15, 23, 42, 0.08);">
                <tr>
                  <td style="height:6px; line-height:6px; background:#0f766e; font-size:1px;">&nbsp;</td>
                </tr>
                <tr>
                  <td style="padding:26px 30px 20px; background:#ffffff;">
                    <div style="display:inline-block; margin:0 0 12px; padding:5px 10px; border-radius:999px; background:#ecfdf5; color:#0f766e; font-size:12px; line-height:16px; font-weight:700; text-transform:uppercase;">${brandName}</div>
                    <h1 style="margin:0; color:#0f172a; font-size:25px; line-height:32px; font-weight:700;">Horaire définitif des défenses TPI ${year}</h1>
                  </td>
                </tr>
                <tr>
                  <td style="padding:0 30px 30px;">
                    <p style="margin:0 0 16px; color:#172033; font-size:16px; line-height:25px;">Bonjour ${recipientName},</p>
                    <p style="margin:0 0 20px; color:#334155; font-size:16px; line-height:26px;">La planification définitive des défenses TPI ${year} est jointe à ce message.</p>
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:separate; border-spacing:0; margin:0 0 22px; background:#f8fafc; border:1px solid #e2e8f0; border-radius:12px;">
                      <tr>
                        <td style="padding:18px 20px;">
                          <p style="margin:0 0 10px; color:#0f172a; font-size:15px; line-height:23px;"><strong>${publicationCopy}</strong></p>
                          <p style="margin:0 0 8px; color:#334155; font-size:15px; line-height:23px;">Vous êtes concerné(e) par <strong>${tpiCount}</strong> défense(s).</p>
                          <p style="margin:0 0 8px; color:#334155; font-size:15px; line-height:23px;">La vue globale contient <strong>${roomCount}</strong> salle(s).</p>
                          ${generatedCopyHtml}
                        </td>
                      </tr>
                    </table>
                    <p style="margin:0 0 12px; color:#334155; font-size:15px; line-height:24px;">Pièces jointes :</p>
                    <ul style="margin:0 0 22px 18px; padding:0; color:#334155; font-size:15px; line-height:24px;">
                      <li>un fichier iCal personnel pour votre calendrier ;</li>
                      <li>un PDF avec vos horaires personnels ;</li>
                      <li>un PDF global avec la planification des salles.</li>
                    </ul>
                    <p style="margin:0; color:#334155; font-size:15px; line-height:23px;">Meilleures salutations</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
      </html>
    `,
    text: `
      Horaire définitif des défenses TPI ${data.year}

      Bonjour ${data.recipientName},

      La planification définitive des défenses TPI ${data.year} est jointe à ce message.

      ${publicationCopy}
      Vous êtes concerné(e) par ${tpiCount} défense(s).
      La vue globale contient ${roomCount} salle(s).${generatedCopyText}

      Pièces jointes:
      - fichier iCal personnel
      - PDF avec vos horaires personnels
      - PDF global avec la planification des salles
    `
  }
}

function buildDefenseChangeNotificationEmail(data) {
  const brandName = escapeHtml(data.brandName || 'TPI Organizer')
  const recipientName = escapeHtml(data.recipientName || '')
  const year = escapeHtml(data.year)
  const publicationVersion = escapeHtml(data.publicationVersion || '')
  const previousPublicationVersion = escapeHtml(data.previousPublicationVersion || '')
  const deadline = escapeHtml(data.deadline)
  const magicLinkUrl = escapeHtml(data.magicLinkUrl)
  const changes = Array.isArray(data.changes) ? data.changes : []
  const changeRowsHtml = changes.map((change) => {
    const reasons = Array.isArray(change.reasonLabels) && change.reasonLabels.length > 0
      ? change.reasonLabels.join(', ')
      : 'mise à jour'
    const previousLocation = escapeHtml(change.previousLocationLabel || 'Non publié')
    const currentLocation = escapeHtml(change.currentLocationLabel || 'Non publié')

    return `
      <tr>
        <td style="padding:12px 0; border-top:1px solid #e2e8f0;">
          <strong style="display:block; color:#0f172a; font-size:15px; line-height:22px;">${escapeHtml(change.reference || 'TPI')}</strong>
          <span style="display:block; color:#334155; font-size:14px; line-height:21px;">${escapeHtml(change.candidateName || 'Candidat non renseigné')}</span>
          <span style="display:block; margin-top:6px; color:#0f766e; font-size:13px; line-height:19px; font-weight:700;">${escapeHtml(reasons)}</span>
          <span style="display:block; margin-top:6px; color:#64748b; font-size:13px; line-height:19px;">Avant: ${previousLocation}</span>
          <span style="display:block; color:#172033; font-size:13px; line-height:19px;">Maintenant: ${currentLocation}</span>
        </td>
      </tr>
    `
  }).join('')
  const changesText = changes.map((change) => {
    const reasons = Array.isArray(change.reasonLabels) && change.reasonLabels.length > 0
      ? change.reasonLabels.join(', ')
      : 'mise à jour'

    return [
      `- ${change.reference || 'TPI'} - ${change.candidateName || 'Candidat non renseigné'}`,
      `  Changement: ${reasons}`,
      change.previousLocationLabel ? `  Avant: ${change.previousLocationLabel}` : '',
      change.currentLocationLabel ? `  Maintenant: ${change.currentLocationLabel}` : ''
    ].filter(Boolean).join('\n')
  }).join('\n\n')

  return {
    subject: `[${data.brandName || 'TPI Organizer'}] Mise à jour des défenses TPI ${data.year}`,
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <title>Mise à jour des défenses TPI ${year}</title>
      </head>
      <body style="margin:0; padding:0; background:#f3f6f8; color:#172033; font-family:Arial, Helvetica, sans-serif;">
        <div style="display:none; max-height:0; overflow:hidden; color:#f3f6f8; opacity:0;">Une mise à jour concerne une ou plusieurs défenses TPI ${year} auxquelles vous êtes lié(e).</div>
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse; background:#f3f6f8;">
          <tr>
            <td align="center" style="padding:32px 16px;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="width:100%; max-width:640px; border-collapse:separate; border-spacing:0; background:#ffffff; border:1px solid #dbe5ec; border-radius:14px; overflow:hidden; box-shadow:0 12px 30px rgba(15, 23, 42, 0.08);">
                <tr>
                  <td style="height:6px; line-height:6px; background:#0f766e; font-size:1px;">&nbsp;</td>
                </tr>
                <tr>
                  <td style="padding:26px 30px 12px;">
                    <div style="display:inline-block; margin:0 0 12px; padding:5px 10px; border-radius:999px; background:#ecfdf5; color:#0f766e; font-size:12px; line-height:16px; font-weight:700; text-transform:uppercase;">${brandName}</div>
                    <h1 style="margin:0; color:#0f172a; font-size:25px; line-height:32px; font-weight:700;">Mise à jour des défenses TPI ${year}</h1>
                    <p style="margin:10px 0 0; color:#64748b; font-size:13px; line-height:20px;">Publication v${publicationVersion}${previousPublicationVersion ? `, comparaison avec v${previousPublicationVersion}` : ''}</p>
                  </td>
                </tr>
                <tr>
                  <td style="padding:0 30px 30px;">
                    <p style="margin:0 0 16px; color:#172033; font-size:16px; line-height:25px;">Bonjour ${recipientName},</p>
                    <p style="margin:0 0 18px; color:#334155; font-size:16px; line-height:26px;">Une nouvelle publication des défenses contient une modification qui vous concerne.</p>
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse; margin:0 0 24px;">
                      ${changeRowsHtml}
                    </table>
                    <table role="presentation" align="center" cellspacing="0" cellpadding="0" style="border-collapse:collapse; margin:0 auto 24px;">
                      <tr>
                        <td style="border-radius:10px; background:#0f766e;">
                          <a href="${magicLinkUrl}" style="display:inline-block; background:#0f766e; color:#ffffff; text-decoration:none; font-weight:700; font-size:16px; line-height:20px; padding:14px 22px; border-radius:10px;">Voir mes défenses</a>
                        </td>
                      </tr>
                    </table>
                    <p style="margin:0 0 8px; color:#526072; font-size:14px; line-height:21px;"><strong style="color:#172033;">Validité du lien:</strong> ${deadline}</p>
                    <p style="margin:0; color:#64748b; font-size:13px; line-height:20px;">Ce lien est personnel et ne doit pas être partagé.</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
      </html>
    `,
    text: `
      Mise à jour des défenses TPI ${data.year}

      Bonjour ${data.recipientName},

      Une nouvelle publication des défenses contient une modification qui vous concerne.

      ${changesText}

      Voir mes défenses:
      ${data.magicLinkUrl}

      Validité du lien: ${data.deadline}
      Ce lien est personnel.
    `
  }
}

function buildTemplateData(data = {}, options = {}) {
  const emailSettings = options.emailSettings || data?.emailSettings || {}
  const brandName = sanitizeHeaderText(data?.brandName) || getConfiguredBrandName(emailSettings)
  const contactEmail = sanitizeEmailAddress(data?.contactEmail) || getConfiguredContactEmail(emailSettings)

  return {
    ...(data || {}),
    brandName,
    contactEmail,
    emailFooterSignature: data?.emailFooterSignature || `ETML / CFPV - ${brandName}`,
    autoReplyNotice: data?.autoReplyNotice || (
      contactEmail
        ? `Pour toute question, contactez ${contactEmail}.`
        : 'Ce message est automatique, merci de ne pas y répondre.'
    ),
    linkValidityLabel: data?.linkValidityLabel || options.linkValidityLabel || formatLinkValidityLabel(options.expiresInHours)
  }
}

// Templates d'emails
const emailTemplates = {
  /**
   * Email avec magic link pour voter
   */
  voteRequest: (data) => ({
    subject: `[${data.brandName || 'TPI Organizer'}] Créneaux de défense TPI - ${data.candidateName}`,
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #1f4f8f; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; background: #f9f9f9; }
          .button { display: inline-block; padding: 12px 24px; background: #0f766e; color: white; text-decoration: none; border-radius: 4px; margin: 10px 0; }
          .slots { background: white; padding: 15px; margin: 15px 0; border-left: 4px solid #1f4f8f; }
          .footer { padding: 20px; text-align: center; font-size: 12px; color: #666; }
          .deadline { color: #1f2937; font-weight: bold; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>${data.brandName || 'TPI Organizer'}</h1>
          </div>
          <div class="content">
            <p>Bonjour ${data.recipientName},</p>
            
            <p>Vous êtes invité(e) à voter pour les créneaux de défense du TPI de <strong>${data.candidateName}</strong>.</p>
            
            <h3>Informations du TPI</h3>
            <ul>
              <li><strong>Référence :</strong> ${data.tpiReference}</li>
              <li><strong>Sujet :</strong> ${data.tpiSubject || 'Non défini'}</li>
              <li><strong>Votre rôle :</strong> ${data.role}</li>
            </ul>
            
            <h3>Créneaux proposés</h3>
            <div class="slots">
              ${(data.slots || []).map(slot => `
                <p>• <strong>${slot.date}</strong> - Période ${slot.period} (${slot.startTime} - ${slot.endTime})<br>
                   <em>Salle: ${slot.room}</em></p>
              `).join('')}
            </div>
            
            <p class="deadline">Réponse souhaitée d’ici le ${data.deadline}</p>
            
            <p style="text-align: center;">
              <a href="${data.magicLinkUrl}" class="button">Ouvrir le formulaire de vote</a>
            </p>
            
            <p><small>Ce lien est valide pendant ${data.linkValidityLabel || '24 heures'}. Si vous ne pouvez pas voter avant la date limite, contactez l'administration.</small></p>
          </div>
          <div class="footer">
            <p>${data.emailFooterSignature || 'ETML / CFPV - TPI Organizer'}</p>
            <p>${data.autoReplyNotice || 'Ce message est automatique, merci de ne pas y répondre.'}</p>
          </div>
        </div>
      </body>
      </html>
    `,
    text: `
      ${data.brandName || 'TPI Organizer'} - Demande de vote
      
      Bonjour ${data.recipientName},
      
      Vous êtes invité(e) à voter pour les créneaux de défense du TPI de ${data.candidateName}.
      
      Référence: ${data.tpiReference}
      Sujet: ${data.tpiSubject || 'Non défini'}
      Votre rôle: ${data.role}
      
      Réponse souhaitée d’ici le ${data.deadline}
      
      Formulaire de vote: ${data.magicLinkUrl}
      
      Ce lien est valide pendant ${data.linkValidityLabel || '24 heures'}.
    `
  }),

  /**
   * Email d'acces a la vue finale des défenses
   */
  soutenanceAccess: buildSoutenanceAccessEmail,

  /**
   * Email final avec PDF/iCal joints pour les parties prenantes.
   */
  soutenanceSchedulePackage: buildSoutenanceSchedulePackageEmail,

  /**
   * Email ciblé après changement dans une nouvelle publication des défenses.
   */
  defenseChangeNotification: buildDefenseChangeNotificationEmail,

  /**
   * Email avec un magic link unique pour tous les votes d'une partie prenante.
   */
  voteRequestDigest: (data) => ({
    subject: `[${data.brandName || 'TPI Organizer'}] Votes de défense à traiter - ${data.year}`,
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 640px; margin: 0 auto; padding: 20px; }
          .header { background: #1f4f8f; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; background: #f9f9f9; }
          .button { display: inline-block; padding: 12px 24px; background: #0f766e; color: white; text-decoration: none; border-radius: 4px; margin: 10px 0; }
          .tpi { background: white; padding: 14px; margin: 12px 0; border-left: 4px solid #1f4f8f; }
          .slots { margin: 8px 0 0 0; padding-left: 18px; }
          .deadline { color: #1f2937; font-weight: bold; }
          .footer { padding: 16px 20px 0; text-align: center; font-size: 12px; color: #666; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>${data.brandName || 'TPI Organizer'}</h1>
          </div>
          <div class="content">
            <p>Bonjour ${data.recipientName},</p>
            <p>Vous avez <strong>${data.tpiCount}</strong> TPI à traiter pour la campagne de votes ${data.year}.</p>

            ${(data.tpis || []).map(tpi => `
              <div class="tpi">
                <p><strong>${tpi.reference}</strong> - ${tpi.candidateName || 'Candidat non renseigné'}<br>
                  <em>${tpi.subject || 'Sujet non défini'} · ${tpi.roleLabel || 'Rôle non défini'}</em>
                </p>
                <ul class="slots">
                  ${(tpi.slots || []).map(slot => `
                    <li>${slot.date} - Période ${slot.period} (${slot.startTime} - ${slot.endTime}) · ${slot.room}</li>
                  `).join('')}
                </ul>
              </div>
            `).join('')}

            <p class="deadline">Réponse souhaitée d’ici le ${data.deadline}</p>
            <p style="text-align: center;">
              <a href="${data.magicLinkUrl}" class="button">Ouvrir mes votes</a>
            </p>
            <p><small>Ce lien est personnel. Il ouvre uniquement les TPI où votre réponse est attendue.</small></p>
          </div>
          <div class="footer">
            <p>${data.emailFooterSignature || 'ETML / CFPV - TPI Organizer'}</p>
            <p>${data.autoReplyNotice || 'Ce message est automatique, merci de ne pas y répondre.'}</p>
          </div>
        </div>
      </body>
      </html>
    `,
    text: `
      ${data.brandName || 'TPI Organizer'} - Votes de défense

      Bonjour ${data.recipientName},

      Vous avez ${data.tpiCount} TPI à traiter pour la campagne ${data.year}.

      ${(data.tpis || []).map(tpi => `
      - ${tpi.reference} - ${tpi.candidateName || 'Candidat non renseigné'} (${tpi.roleLabel || 'Rôle non défini'})
        Sujet: ${tpi.subject || 'Non défini'}
      `).join('')}

      Réponse souhaitée d’ici le ${data.deadline}

      Ouvrir mes votes: ${data.magicLinkUrl}
    `
  }),

  /**
   * Email d'arbitrage: l'administration propose une solution à confirmer.
   */
  resolutionProposal: (data) => ({
    subject: `[${data.brandName || 'TPI Organizer'}] Proposition d'arbitrage - ${data.tpiReference}`,
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 640px; margin: 0 auto; padding: 20px; }
          .header { background: #334155; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; background: #f9f9f9; }
          .button { display: inline-block; padding: 12px 24px; background: #2563eb; color: white; text-decoration: none; border-radius: 4px; margin: 10px 0; }
          .box { background: white; padding: 14px; margin: 12px 0; border-left: 4px solid #2563eb; }
          .deadline { color: #1f2937; font-weight: bold; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>${data.brandName || 'TPI Organizer'} - Proposition d'arbitrage</h1>
          </div>
          <div class="content">
            <p>Bonjour ${data.recipientName},</p>
            <p>Une contrainte bloque la planification du TPI ci-dessous. L'administration vous propose une solution à confirmer.</p>

            <div class="box">
              <p><strong>${data.tpiReference}</strong> - ${data.candidateName || 'Candidat non renseigné'}<br>
              <em>${data.tpiSubject || 'Sujet non défini'} · ${data.roleLabel || 'Partie prenante'}</em></p>
              <p><strong>Créneau proposé:</strong><br>${data.proposedSlotLabel}</p>
              ${data.adminMessage ? `<p><strong>Message:</strong><br>${data.adminMessage}</p>` : ''}
            </div>

            <p style="text-align: center;">
              <a href="${data.magicLinkUrl}" class="button">Répondre à la proposition</a>
            </p>
            <p class="deadline">Réponse souhaitée avant le ${data.deadline || 'délai indiqué'}.</p>
            <p><small>Ce lien est personnel. En cas de refus, vous pourrez indiquer la raison et une proposition éventuelle.</small></p>
          </div>
          <div class="footer">
            <p>${data.emailFooterSignature || 'ETML / CFPV - TPI Organizer'}</p>
            <p>${data.autoReplyNotice || 'Ce message est automatique, merci de ne pas y répondre.'}</p>
          </div>
        </div>
      </body>
      </html>
    `,
    text: `
      ${data.brandName || 'TPI Organizer'} - Proposition d'arbitrage

      Bonjour ${data.recipientName},

      Une contrainte bloque la planification du TPI ${data.tpiReference} - ${data.candidateName || 'Candidat non renseigné'}.

      Créneau proposé: ${data.proposedSlotLabel}
      ${data.adminMessage ? `Message: ${data.adminMessage}` : ''}

      Répondre à la proposition: ${data.magicLinkUrl}
      Réponse souhaitée avant le ${data.deadline || 'délai indiqué'}.
    `
  }),

  /**
   * Email de rappel de vote
   */
  voteReminder: (data) => ({
    subject: `[${data.brandName || 'TPI Organizer'}] Vote de défense en attente - ${data.candidateName}`,
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #1f4f8f; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; background: #f9f9f9; }
          .button { display: inline-block; padding: 12px 24px; background: #0f766e; color: white; text-decoration: none; border-radius: 4px; }
          .notice { color: #1f2937; font-size: 16px; }
          .footer { padding: 16px 20px 0; text-align: center; font-size: 12px; color: #666; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>${data.brandName || 'TPI Organizer'} - Vote en attente</h1>
          </div>
          <div class="content">
            <p>Bonjour ${data.recipientName},</p>
            
            <p class="notice">Votre vote est toujours attendu pour le TPI de <strong>${data.candidateName}</strong>.</p>
            
            <p><strong>Réponse souhaitée d’ici le :</strong> ${data.deadline}</p>
            
            <p style="text-align: center;">
              <a href="${data.magicLinkUrl}" class="button">Ouvrir le formulaire de vote</a>
            </p>
          </div>
          <div class="footer">
            <p>${data.emailFooterSignature || 'ETML / CFPV - TPI Organizer'}</p>
            <p>${data.autoReplyNotice || 'Ce message est automatique, merci de ne pas y répondre.'}</p>
          </div>
        </div>
      </body>
      </html>
    `,
    text: `
      ${data.brandName || 'TPI Organizer'} - Rappel vote
      
      Bonjour ${data.recipientName},
      
      Votre vote est toujours attendu pour le TPI de ${data.candidateName}.
      Réponse souhaitée d’ici le ${data.deadline}
      
      Formulaire de vote: ${data.magicLinkUrl}
    `
  }),

  /**
   * Rappel avec un lien unique pour tous les votes encore attendus.
   */
  voteReminderDigest: (data) => ({
    subject: `[${data.brandName || 'TPI Organizer'}] Rappel votes TPI - ${data.year}`,
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 640px; margin: 0 auto; padding: 20px; }
          .header { background: #1f4f8f; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; background: #f9f9f9; }
          .button { display: inline-block; padding: 12px 24px; background: #0f766e; color: white; text-decoration: none; border-radius: 4px; }
          .notice { color: #1f2937; font-size: 16px; }
          .tpi { background: white; padding: 12px; margin: 10px 0; border-left: 4px solid #1f4f8f; }
          .footer { padding: 16px 20px 0; text-align: center; font-size: 12px; color: #666; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>${data.brandName || 'TPI Organizer'} - Votes en attente</h1>
          </div>
          <div class="content">
            <p>Bonjour ${data.recipientName},</p>
            <p class="notice">Votre réponse est toujours attendue pour <strong>${data.tpiCount}</strong> TPI.</p>
            ${(data.tpis || []).map(tpi => `
              <div class="tpi">
                <strong>${tpi.reference}</strong> - ${tpi.candidateName || 'Candidat non renseigné'}<br>
                <em>${tpi.roleLabel || 'Rôle non défini'}</em>
              </div>
            `).join('')}
            <p><strong>Réponse souhaitée d’ici le :</strong> ${data.deadline}</p>
            <p style="text-align: center;">
              <a href="${data.magicLinkUrl}" class="button">Ouvrir mes votes</a>
            </p>
          </div>
          <div class="footer">
            <p>${data.emailFooterSignature || 'ETML / CFPV - TPI Organizer'}</p>
            <p>${data.autoReplyNotice || 'Ce message est automatique, merci de ne pas y répondre.'}</p>
          </div>
        </div>
      </body>
      </html>
    `,
    text: `
      ${data.brandName || 'TPI Organizer'} - Rappel votes

      Bonjour ${data.recipientName},

      Votre réponse est toujours attendue pour ${data.tpiCount} TPI.
      Réponse souhaitée d’ici le ${data.deadline}

      Ouvrir mes votes: ${data.magicLinkUrl}
    `
  }),

  /**
   * Email de confirmation de défense
   */
  soutenanceConfirmation: (data) => ({
    subject: `[${data.brandName || 'TPI Organizer'}] Défense TPI confirmée - ${data.candidateName} - ${data.date}`,
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #28a745; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; background: #f9f9f9; }
          .details { background: white; padding: 20px; border-left: 4px solid #28a745; margin: 15px 0; }
          .calendar-btn { display: inline-block; padding: 10px 20px; background: #007bff; color: white; text-decoration: none; border-radius: 4px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Défense TPI confirmée</h1>
          </div>
          <div class="content">
            <p>Bonjour ${data.recipientName},</p>
            
            <p>La défense du TPI a été <strong>confirmée</strong> avec succès.</p>
            
            <div class="details">
              <h3>Détails de la défense</h3>
              <p><strong>Candidat :</strong> ${data.candidateName}</p>
              <p><strong>Référence :</strong> ${data.tpiReference}</p>
              <p><strong>Date :</strong> ${data.date}</p>
              <p><strong>Heure :</strong> ${data.time}</p>
              <p><strong>Salle :</strong> ${data.room}</p>
              <p><strong>Site :</strong> ${data.site}</p>
              
              <h4>Participants</h4>
              <ul>
                <li>${formatTpiStakeholderRoleLabel('expert1')}: ${data.expert1}</li>
                <li>${formatTpiStakeholderRoleLabel('expert2')}: ${data.expert2}</li>
                <li>${formatTpiStakeholderRoleLabel('chef_projet')}: ${data.chefProjet}</li>
              </ul>
            </div>
            
            <p style="text-align: center;">
              <a href="${data.calendarUrl}" class="calendar-btn">Ajouter au calendrier</a>
            </p>
          </div>
        </div>
      </body>
      </html>
    `,
    text: `
      Défense TPI confirmée
      
      Bonjour ${data.recipientName},
      
      La défense du TPI a été confirmée.
      
      Candidat: ${data.candidateName}
      Référence: ${data.tpiReference}
      Date: ${data.date}
      Heure: ${data.time}
      Salle: ${data.room}
      Site: ${data.site}
      
      ${formatTpiStakeholderRoleLabel('expert1')}: ${data.expert1}
      ${formatTpiStakeholderRoleLabel('expert2')}: ${data.expert2}
      ${formatTpiStakeholderRoleLabel('chef_projet')}: ${data.chefProjet}
    `
  }),

  /**
   * Email demandant une intervention manuelle
   */
  manualInterventionRequired: (data) => ({
    subject: `[${data.brandName || 'TPI Organizer'}] Conflit de planification - ${data.candidateName}`,
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #334155; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; background: #f9f9f9; }
          .conflict { background: #fff3cd; padding: 15px; border-left: 4px solid #ffc107; margin: 15px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Intervention de planification</h1>
          </div>
          <div class="content">
            <p>Bonjour,</p>
            
            <p>Le système n'a pas pu trouver de créneau commun pour la défense du TPI de <strong>${data.candidateName}</strong>.</p>
            
            <div class="conflict">
              <h3>Raison du conflit</h3>
              <p>${data.conflictReason}</p>
            </div>
            
            <h3>Actions possibles</h3>
            <ol>
              <li>Contacter les personnes concernées pour de nouvelles disponibilités</li>
              <li>Imposer une date manuellement via l'interface d'administration</li>
            </ol>
            
            <p><a href="${data.adminUrl}">Accéder à l'interface d'administration</a></p>
          </div>
        </div>
      </body>
      </html>
    `,
    text: `
      Intervention de planification
      
      Le système n'a pas pu trouver de créneau commun pour le TPI de ${data.candidateName}.
      
      Raison: ${data.conflictReason}
      
      Accédez à l'administration: ${data.adminUrl}
    `
  })
}

/**
 * Envoie un email
 */
async function sendEmail(to, template, data, options = {}) {
  const templateData = buildTemplateData(data, options)
  const emailContent = emailTemplates[template](templateData)
  const mailOptions = buildMailOptions({
    to,
    emailContent,
    emailSettings: options.emailSettings || templateData?.emailSettings,
    fromArbitrage: options.fromArbitrage === true,
    messageType: template,
    attachments: options.attachments
  })
  
  let transporter

  try {
    transporter = createTransporter()
    const info = await transporter.sendMail(mailOptions)
    return { success: true, messageId: info.messageId }
  } catch (error) {
    console.error('Erreur envoi email:', error)
    return { success: false, error: error.message }
  } finally {
    transporter?.close?.()
  }
}

/**
 * Envoie les demandes de vote à tous les votants d'un TPI
 */
async function sendVoteRequests(tpi, magicLinks, options = {}) {
  const results = []
  
  for (const link of magicLinks) {
    const candidateName = tpi.candidat?.fullName || [tpi.candidat?.firstName, tpi.candidat?.lastName].filter(Boolean).join(' ').trim()
    const result = await sendEmail(link.email, 'voteRequest', {
      recipientName: link.personName,
      candidateName,
      tpiReference: tpi.reference,
      tpiSubject: tpi.sujet,
      role: formatTpiStakeholderRoleLabel(link.role),
      slots: link.slots,
      deadline: tpi.votingSession.deadline.toLocaleDateString('fr-CH'),
      magicLinkUrl: link.url
    }, options)
    
    results.push({ email: link.email, ...result })
  }
  
  return results
}

async function sendVoteDigestRequests(targets, options = {}) {
  const results = []
  const template = options.reminder === true ? 'voteReminderDigest' : 'voteRequestDigest'

  for (const target of Array.isArray(targets) ? targets : []) {
    if (!target?.email) {
      continue
    }

    const result = await sendEmail(target.email, template, {
      recipientName: target.personName,
      year: target.year,
      tpiCount: Array.isArray(target.tpis) ? target.tpis.length : 0,
      tpis: target.tpis || [],
      deadline: target.deadline || '',
      magicLinkUrl: target.url
    }, options)

    results.push({ email: target.email, ...result })
  }

  return results
}

function canReceiveAutomaticEmail(recipient) {
  return Boolean(recipient?.email) && recipient?.sendEmails !== false
}

/**
 * Envoie les confirmations de défense
 */
async function sendSoutenanceConfirmations(tpi, slot, recipients, options = {}) {
  const results = []
  
  for (const recipient of recipients) {
    if (!canReceiveAutomaticEmail(recipient)) {
      continue
    }

    const candidateName = tpi.candidat?.fullName || [tpi.candidat?.firstName, tpi.candidat?.lastName].filter(Boolean).join(' ').trim()
    const expert1Name = tpi.expert1?.fullName || [tpi.expert1?.firstName, tpi.expert1?.lastName].filter(Boolean).join(' ').trim()
    const expert2Name = tpi.expert2?.fullName || [tpi.expert2?.firstName, tpi.expert2?.lastName].filter(Boolean).join(' ').trim()
    const chefProjetName = tpi.chefProjet?.fullName || [tpi.chefProjet?.firstName, tpi.chefProjet?.lastName].filter(Boolean).join(' ').trim()
    const result = await sendEmail(recipient.email, 'soutenanceConfirmation', {
      recipientName: recipient.fullName,
      candidateName,
      tpiReference: tpi.reference,
      date: slot.date.toLocaleDateString('fr-CH'),
      time: slot.startTime,
      room: slot.room.name,
      site: slot.room.site,
      expert1: expert1Name,
      expert2: expert2Name,
      chefProjet: chefProjetName,
      calendarUrl: '#' // À implémenter: génération de lien ICS
    }, options)
    
    results.push({ email: recipient.email, ...result })
  }
  
  return results
}

module.exports = {
  buildArbitrageSender,
  buildConfiguredSender,
  buildDeliverabilityHeaders,
  buildEnvelope,
  buildListUnsubscribeHeader,
  buildMessageId,
  buildTemplateData,
  extractEmailAddress,
  getAllowedSenderDomains,
  getDkimConfig,
  getEmailDomain,
  getSmtpTransportConfig,
  isSenderDomainAllowed,
  formatLinkValidityLabel,
  resolveMailSender,
  buildMailOptions,
  sendEmail,
  sendVoteDigestRequests,
  sendVoteRequests,
  sendSoutenanceConfirmations,
  emailTemplates
}
