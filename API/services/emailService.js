/**
 * Service d'envoi d'emails
 * Gère les notifications par email (magic links, rappels de vote, confirmations)
 */

const nodemailer = require('nodemailer')

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

// Templates d'emails
const emailTemplates = {
  /**
   * Email avec magic link pour voter
   */
  voteRequest: (data) => ({
    subject: `[TPI Organizer] Votez pour les créneaux de soutenance - ${data.candidateName}`,
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
            <h1>🎓 TPI Organizer</h1>
          </div>
          <div class="content">
            <p>Bonjour ${data.recipientName},</p>
            
            <p>Vous êtes invité(e) à voter pour les créneaux de soutenance du TPI de <strong>${data.candidateName}</strong>.</p>
            
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
            
            <p><small>Ce lien est valide pendant 24 heures. Si vous ne pouvez pas voter avant la date limite, contactez l'administration.</small></p>
          </div>
          <div class="footer">
            <p>ETML / CFPV - TPI Organizer</p>
            <p>Ce message est automatique, merci de ne pas y répondre.</p>
          </div>
        </div>
      </body>
      </html>
    `,
    text: `
      TPI Organizer - Demande de vote
      
      Bonjour ${data.recipientName},
      
      Vous êtes invité(e) à voter pour les créneaux de soutenance du TPI de ${data.candidateName}.
      
      Référence: ${data.tpiReference}
      Sujet: ${data.tpiSubject || 'Non défini'}
      Votre rôle: ${data.role}
      
      Date limite: ${data.deadline}
      
      Cliquez sur ce lien pour voter: ${data.magicLinkUrl}
      
      Ce lien est valide pendant 24 heures.
    `
  }),

  /**
   * Email d'acces a la vue finale des soutenances
   */
  soutenanceAccess: (data) => ({
    subject: `[TPI Organizer] Acces Soutenances ${data.year}`,
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
            <h1>🎓 Soutenances publiees</h1>
          </div>
          <div class="content">
            <p>Bonjour ${data.recipientName},</p>
            <p>La version definitive des soutenances ${data.year} est disponible.</p>
            <p style="text-align: center;">
              <a href="${data.magicLinkUrl}" class="button">Ouvrir ma vue Soutenances</a>
            </p>
            <p class="deadline">Validite du lien: ${data.deadline}</p>
            <p><small>Ce lien est personnel et ne doit pas etre partage.</small></p>
          </div>
        </div>
      </body>
      </html>
    `,
    text: `
      Soutenances publiees ${data.year}

      Bonjour ${data.recipientName},

      La version definitive des soutenances est disponible.
      Ouvrir ma vue: ${data.magicLinkUrl}
      Validite du lien: ${data.deadline}
    `
  }),

  /**
   * Email de rappel de vote
   */
  voteReminder: (data) => ({
    subject: `[RAPPEL] Votez pour les créneaux - ${data.candidateName}`,
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
            <h1>⚠️ Rappel - Vote en attente</h1>
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
      RAPPEL - Vote en attente
      
      Bonjour ${data.recipientName},
      
      Votre vote est toujours attendu pour le TPI de ${data.candidateName}.
      Date limite: ${data.deadline}
      
      Lien pour voter: ${data.magicLinkUrl}
    `
  }),

  /**
   * Email de confirmation de soutenance
   */
  soutenanceConfirmation: (data) => ({
    subject: `[CONFIRMÉ] Soutenance TPI - ${data.candidateName} - ${data.date}`,
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
            <h1>✅ Soutenance Confirmée</h1>
          </div>
          <div class="content">
            <p>Bonjour ${data.recipientName},</p>
            
            <p>La soutenance du TPI a été <strong>confirmée</strong> avec succès.</p>
            
            <div class="details">
              <h3>📋 Détails de la soutenance</h3>
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
      Soutenance Confirmée
      
      Bonjour ${data.recipientName},
      
      La soutenance du TPI a été confirmée.
      
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
            
            <p>Le système n'a pas pu trouver de créneau commun pour la soutenance du TPI de <strong>${data.candidateName}</strong>.</p>
            
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
async function sendEmail(to, template, data) {
  const emailContent = emailTemplates[template](data)
  
  const mailOptions = {
    from: process.env.SMTP_FROM || '"TPI Organizer" <noreply@tpi-organizer.ch>',
    to,
    subject: emailContent.subject,
    text: emailContent.text,
    html: emailContent.html
  }
  
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
async function sendVoteRequests(tpi, magicLinks) {
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
    })
    
    results.push({ email: link.email, ...result })
  }
  
  return results
}

function canReceiveAutomaticEmail(recipient) {
  return Boolean(recipient?.email) && recipient?.sendEmails !== false
}

/**
 * Envoie les confirmations de soutenance
 */
async function sendSoutenanceConfirmations(tpi, slot, recipients) {
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
    })
    
    results.push({ email: recipient.email, ...result })
  }
  
  return results
}

module.exports = {
  sendEmail,
  sendVoteRequests,
  sendSoutenanceConfirmations,
  emailTemplates
}
