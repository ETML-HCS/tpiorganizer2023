/**
 * Service d'envoi d'emails
 * Gère les notifications par email (magic links, rappels de vote, confirmations)
 */

const nodemailer = require('nodemailer')
const { normalizeEmailSettings } = require('./planningCatalogService')

// Configuration du transporteur (à adapter selon l'environnement)
const createTransporter = () => {
  // En développement, utiliser un service de test comme Ethereal ou Mailtrap
  if (process.env.NODE_ENV === 'development') {
    return nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.ethereal.email',
      port: process.env.SMTP_PORT || 587,
      secure: false,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      }
    })
  }
  
  // En production, utiliser un vrai service SMTP
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: process.env.SMTP_PORT || 465,
    secure: true,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    }
  })
}

const transporter = createTransporter()

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

function buildConfiguredSender(emailSettings = {}) {
  const settings = normalizeEmailSettings(emailSettings)
  const senderEmail = sanitizeEmailAddress(settings.senderEmail)

  if (!senderEmail) {
    return process.env.SMTP_FROM || '"TPI Organizer" <noreply@tpi-organizer.ch>'
  }

  return `${quoteDisplayName(settings.senderName)} <${senderEmail}>`
}

function buildMailOptions({ to, emailContent, emailSettings = {} }) {
  const settings = normalizeEmailSettings(emailSettings)
  const replyToEmail = sanitizeEmailAddress(settings.replyToEmail)
  const mailOptions = {
    from: buildConfiguredSender(settings),
    to,
    subject: emailContent.subject,
    text: emailContent.text,
    html: emailContent.html
  }

  if (replyToEmail) {
    mailOptions.replyTo = replyToEmail
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
    subject: `[${data.brandName || 'TPI Organizer'}] Votez pour les créneaux de défense - ${data.candidateName}`,
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #007bff; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; background: #f9f9f9; }
          .button { display: inline-block; padding: 12px 24px; background: #28a745; color: white; text-decoration: none; border-radius: 4px; margin: 10px 0; }
          .slots { background: white; padding: 15px; margin: 15px 0; border-left: 4px solid #007bff; }
          .footer { padding: 20px; text-align: center; font-size: 12px; color: #666; }
          .deadline { color: #dc3545; font-weight: bold; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🎓 ${data.brandName || 'TPI Organizer'}</h1>
          </div>
          <div class="content">
            <p>Bonjour ${data.recipientName},</p>
            
            <p>Vous êtes invité(e) à voter pour les créneaux de défense du TPI de <strong>${data.candidateName}</strong>.</p>
            
            <h3>📋 Informations du TPI</h3>
            <ul>
              <li><strong>Référence :</strong> ${data.tpiReference}</li>
              <li><strong>Sujet :</strong> ${data.tpiSubject || 'Non défini'}</li>
              <li><strong>Votre rôle :</strong> ${data.role}</li>
            </ul>
            
            <h3>📅 Créneaux proposés</h3>
            <div class="slots">
              ${data.slots.map(slot => `
                <p>• <strong>${slot.date}</strong> - Période ${slot.period} (${slot.startTime} - ${slot.endTime})<br>
                   <em>Salle: ${slot.room}</em></p>
              `).join('')}
            </div>
            
            <p class="deadline">⏰ Date limite pour voter : ${data.deadline}</p>
            
            <p style="text-align: center;">
              <a href="${data.magicLinkUrl}" class="button">Voter maintenant</a>
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
      
      Date limite: ${data.deadline}
      
      Cliquez sur ce lien pour voter: ${data.magicLinkUrl}
      
      Ce lien est valide pendant ${data.linkValidityLabel || '24 heures'}.
    `
  }),

  /**
   * Email d'acces a la vue finale des défenses
   */
  soutenanceAccess: (data) => ({
    subject: `[${data.brandName || 'TPI Organizer'}] Acces Défenses ${data.year}`,
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #0d47a1; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; background: #f9f9f9; }
          .button { display: inline-block; padding: 12px 24px; background: #1976d2; color: white; text-decoration: none; border-radius: 4px; margin: 10px 0; }
          .deadline { color: #d32f2f; font-weight: bold; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🎓 Défenses publiees</h1>
          </div>
          <div class="content">
            <p>Bonjour ${data.recipientName},</p>
            <p>La version definitive des défenses ${data.year} est disponible.</p>
            <p style="text-align: center;">
              <a href="${data.magicLinkUrl}" class="button">Ouvrir ma vue Défenses</a>
            </p>
            <p class="deadline">Validite du lien: ${data.deadline}</p>
            <p><small>Ce lien est personnel et ne doit pas etre partage.</small></p>
          </div>
        </div>
      </body>
      </html>
    `,
    text: `
      Défenses publiees ${data.year}

      Bonjour ${data.recipientName},

      La version definitive des défenses est disponible.
      Ouvrir ma vue: ${data.magicLinkUrl}
      Validite du lien: ${data.deadline}
    `
  }),

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
          .header { background: #007bff; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; background: #f9f9f9; }
          .button { display: inline-block; padding: 12px 24px; background: #28a745; color: white; text-decoration: none; border-radius: 4px; margin: 10px 0; }
          .tpi { background: white; padding: 14px; margin: 12px 0; border-left: 4px solid #007bff; }
          .slots { margin: 8px 0 0 0; padding-left: 18px; }
          .deadline { color: #dc3545; font-weight: bold; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🎓 ${data.brandName || 'TPI Organizer'}</h1>
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

            <p class="deadline">⏰ Date limite pour voter : ${data.deadline}</p>
            <p style="text-align: center;">
              <a href="${data.magicLinkUrl}" class="button">Ouvrir mes votes</a>
            </p>
            <p><small>Ce lien est personnel. Il ouvre uniquement les TPI où votre réponse est attendue.</small></p>
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

      Date limite: ${data.deadline}

      Ouvrir mes votes: ${data.magicLinkUrl}
    `
  }),

  /**
   * Email de rappel de vote
   */
  voteReminder: (data) => ({
    subject: `[${data.brandName || 'TPI Organizer'}] Rappel vote - ${data.candidateName}`,
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #ffc107; color: #333; padding: 20px; text-align: center; }
          .content { padding: 20px; background: #f9f9f9; }
          .button { display: inline-block; padding: 12px 24px; background: #dc3545; color: white; text-decoration: none; border-radius: 4px; }
          .urgent { color: #dc3545; font-size: 18px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>⚠️ ${data.brandName || 'TPI Organizer'} - Vote en attente</h1>
          </div>
          <div class="content">
            <p>Bonjour ${data.recipientName},</p>
            
            <p class="urgent">Votre vote est toujours attendu pour le TPI de <strong>${data.candidateName}</strong>.</p>
            
            <p><strong>Date limite :</strong> ${data.deadline}</p>
            
            <p style="text-align: center;">
              <a href="${data.magicLinkUrl}" class="button">Voter maintenant</a>
            </p>
          </div>
        </div>
      </body>
      </html>
    `,
    text: `
      ${data.brandName || 'TPI Organizer'} - Rappel vote
      
      Bonjour ${data.recipientName},
      
      Votre vote est toujours attendu pour le TPI de ${data.candidateName}.
      Date limite: ${data.deadline}
      
      Lien pour voter: ${data.magicLinkUrl}
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
          .header { background: #ffc107; color: #333; padding: 20px; text-align: center; }
          .content { padding: 20px; background: #f9f9f9; }
          .button { display: inline-block; padding: 12px 24px; background: #dc3545; color: white; text-decoration: none; border-radius: 4px; }
          .urgent { color: #dc3545; font-size: 18px; }
          .tpi { background: white; padding: 12px; margin: 10px 0; border-left: 4px solid #ffc107; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>⚠️ ${data.brandName || 'TPI Organizer'} - Votes en attente</h1>
          </div>
          <div class="content">
            <p>Bonjour ${data.recipientName},</p>
            <p class="urgent">Votre réponse est toujours attendue pour <strong>${data.tpiCount}</strong> TPI.</p>
            ${(data.tpis || []).map(tpi => `
              <div class="tpi">
                <strong>${tpi.reference}</strong> - ${tpi.candidateName || 'Candidat non renseigné'}<br>
                <em>${tpi.roleLabel || 'Rôle non défini'}</em>
              </div>
            `).join('')}
            <p><strong>Date limite :</strong> ${data.deadline}</p>
            <p style="text-align: center;">
              <a href="${data.magicLinkUrl}" class="button">Ouvrir mes votes</a>
            </p>
          </div>
        </div>
      </body>
      </html>
    `,
    text: `
      ${data.brandName || 'TPI Organizer'} - Rappel votes

      Bonjour ${data.recipientName},

      Votre réponse est toujours attendue pour ${data.tpiCount} TPI.
      Date limite: ${data.deadline}

      Ouvrir mes votes: ${data.magicLinkUrl}
    `
  }),

  /**
   * Email de confirmation de défense
   */
  soutenanceConfirmation: (data) => ({
    subject: `[CONFIRMÉ] Défense TPI - ${data.candidateName} - ${data.date}`,
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
            <h1>✅ Défense Confirmée</h1>
          </div>
          <div class="content">
            <p>Bonjour ${data.recipientName},</p>
            
            <p>La défense du TPI a été <strong>confirmée</strong> avec succès.</p>
            
            <div class="details">
              <h3>📋 Détails de la défense</h3>
              <p><strong>Candidat :</strong> ${data.candidateName}</p>
              <p><strong>Référence :</strong> ${data.tpiReference}</p>
              <p><strong>Date :</strong> ${data.date}</p>
              <p><strong>Heure :</strong> ${data.time}</p>
              <p><strong>Salle :</strong> ${data.room}</p>
              <p><strong>Site :</strong> ${data.site}</p>
              
              <h4>👥 Participants</h4>
              <ul>
                <li>Expert 1: ${data.expert1}</li>
                <li>Expert 2: ${data.expert2}</li>
                <li>Chef de projet: ${data.chefProjet}</li>
              </ul>
            </div>
            
            <p style="text-align: center;">
              <a href="${data.calendarUrl}" class="calendar-btn">📅 Ajouter au calendrier</a>
            </p>
          </div>
        </div>
      </body>
      </html>
    `,
    text: `
      Défense Confirmée
      
      Bonjour ${data.recipientName},
      
      La défense du TPI a été confirmée.
      
      Candidat: ${data.candidateName}
      Référence: ${data.tpiReference}
      Date: ${data.date}
      Heure: ${data.time}
      Salle: ${data.room}
      Site: ${data.site}
      
      Expert 1: ${data.expert1}
      Expert 2: ${data.expert2}
      Chef de projet: ${data.chefProjet}
    `
  }),

  /**
   * Email demandant une intervention manuelle
   */
  manualInterventionRequired: (data) => ({
    subject: `[ACTION REQUISE] Conflit de planification - ${data.candidateName}`,
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #dc3545; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; background: #f9f9f9; }
          .conflict { background: #fff3cd; padding: 15px; border-left: 4px solid #ffc107; margin: 15px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🚨 Intervention Manuelle Requise</h1>
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
      Intervention Manuelle Requise
      
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
    emailSettings: options.emailSettings || templateData?.emailSettings
  })
  
  try {
    const info = await transporter.sendMail(mailOptions)
    return { success: true, messageId: info.messageId }
  } catch (error) {
    console.error('Erreur envoi email:', error)
    return { success: false, error: error.message }
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
      role: link.role === 'expert1' || link.role === 'expert2' ? 'Expert' : 'Chef de projet',
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
  buildConfiguredSender,
  buildTemplateData,
  formatLinkValidityLabel,
  buildMailOptions,
  sendEmail,
  sendVoteDigestRequests,
  sendVoteRequests,
  sendSoutenanceConfirmations,
  emailTemplates
}
