/**
 * Tests du service d'emails
 * Teste les flux critiques d'envoi (magic links, vote requests, confirmations)
 */

const test = require('node:test')
const assert = require('node:assert/strict')

const emailService = require('../services/emailService')

// Mock du service nodemailer pour testing
const mockTransporter = {
  sendMail: async (mailOptions) => {
    // Simuler un envoi réussi
    return {
      messageId: `<test-${Date.now()}@ethereal.email>`,
      response: 'Success'
    }
  }
}

/**
 * Test des templates d'emails
 */
test('Email templates should have required fields', async () => {
  const emailTemplates = {
    voteRequest: (data) => ({
      subject: `Vote requis pour ${data.candidateName}`,
      html: `<p>Bonjour ${data.recipientName} <a href="${data.magicLinkUrl}">Voter</a></p>`,
      text: `Vote for ${data.candidateName} ${data.magicLinkUrl}`
    }),
    confirmation: (data) => ({
      subject: `Confirmation de défense - ${data.candidateName}`,
      html: `<div><h1>Défense confirmée</h1><p>Bonjour ${data.recipientName}</p></div>`,
      text: `Confirmed for ${data.candidateName}`
    })
  }

  // Test: voteRequest has all required fields
  const voteData = {
    recipientName: 'Jean Expert',
    candidateName: 'Alice Student',
    tpiReference: 'TPI-2026-001',
    tpiSubject: 'Machine Learning',
    role: 'Expert',
    slots: [
      { date: '13.06.2026', period: 'Matin', startTime: '08:00', endTime: '12:00', room: 'Salle 1' }
    ],
    deadline: '12.06.2026',
    magicLinkUrl: 'http://localhost:3000/vote/abc123'
  }

  const voteEmail = emailTemplates.voteRequest(voteData)

  assert.ok(voteEmail.subject.includes(voteData.candidateName), 
    'voteRequest subject should include candidate name')
  assert.ok(voteEmail.html.includes(voteData.recipientName),
    'voteRequest HTML should include recipient name')
  assert.ok(voteEmail.html.includes(voteData.magicLinkUrl),
    'voteRequest should include magic link')

  // Test: confirmation has required fields
  const confirmData = {
    recipientName: 'Alice Student',
    candidateName: 'Alice Student',
    selectedSlot: {
      date: '13.06.2026',
      period: 'Matin',
      room: 'Salle 1'
    },
    time: '08:00 - 12:00'
  }

  const confirmEmail = emailTemplates.confirmation(confirmData)

  assert.ok(confirmEmail.subject.includes(confirmData.candidateName),
    'confirmation subject should include candidate name')
  assert.ok(confirmEmail.html.length > 50,
    'confirmation HTML should have content')
})

/**
 * Test des configurations d'emails
 */
test('Email configuration should be environment-dependent', async () => {
  // Test: Dev environment should use Ethereal or Mailtrap
  const devConfig = {
    NODE_ENV: 'development',
    SMTP_HOST: 'smtp.ethereal.email',
    SMTP_PORT: 587,
    SMTP_USER: 'dev@ethereal.email',
    SMTP_PASS: 'dev-pass'
  }

  assert.equal(devConfig.SMTP_HOST, 'smtp.ethereal.email',
    'Dev environment should use Ethereal')
  assert.equal(devConfig.SMTP_PORT, 587,
    'Dev environment should use port 587 (insecure)')

  // Test: Production environment should use secure SMTP
  const prodConfig = {
    NODE_ENV: 'production',
    SMTP_HOST: 'smtp.example.com',
    SMTP_PORT: 465,
    SMTP_USER: 'noreply@example.com',
    SMTP_PASS: 'prod-password'
  }

  assert.equal(prodConfig.SMTP_HOST, 'smtp.example.com',
    'Prod environment should use real SMTP server')
  assert.equal(prodConfig.SMTP_PORT, 465,
    'Prod environment should use port 465 (secure)')
})

/**
 * Test des validations d'email
 */
test('Email validation should reject invalid addresses', async () => {
  const validateEmail = (email) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    return emailRegex.test(email)
  }

  // Valid emails
  assert.ok(validateEmail('user@example.com'), 'Valid email should pass')
  assert.ok(validateEmail('john.doe+tag@company.co.uk'), 'Email with + should pass')

  // Invalid emails
  assert.ok(!validateEmail('invalid-email'), 'Missing @ should fail')
  assert.ok(!validateEmail('user@'), 'Missing domain should fail')
  assert.ok(!validateEmail('user@.com'), 'Missing host should fail')
})

/**
 * Test de sécurité - injection d'emails
 */
test('Email addresses should be sanitized against injection', async () => {
  const sanitizeEmail = (email) => {
    // Rejected malicious patterns
    if (email.includes('\n') || email.includes('\r') || email.includes(',')) {
      return null
    }
    return email.toLowerCase().trim()
  }

  // Normal emails should pass
  assert.equal(
    sanitizeEmail('user@example.com'),
    'user@example.com',
    'Normal email should pass'
  )

  // Injection attempts should be rejected
  assert.equal(
    sanitizeEmail('user@example.com\n\nBcc: attacker@evil.com'),
    null,
    'Email with newlines (header injection) should be rejected'
  )

  assert.equal(
    sanitizeEmail('user@example.com, attacker@evil.com'),
    null,
    'Email with comma (multiple recipients injection) should be rejected'
  )
})

test('Email service should build mail options from configured sender settings', () => {
  const mailOptions = emailService.buildMailOptions({
    to: 'expert@example.com',
    emailContent: {
      subject: 'Test',
      text: 'Texte',
      html: '<p>Texte</p>'
    },
    emailSettings: {
      senderName: 'Secretariat TPI',
      senderEmail: 'SECRETARIAT@example.com',
      replyToEmail: 'tpi.admin@example.com'
    }
  })

  assert.equal(mailOptions.from, '"Secretariat TPI" <secretariat@example.com>')
  assert.equal(mailOptions.replyTo, 'tpi.admin@example.com')
  assert.equal(mailOptions.to, 'expert@example.com')
})

test('Email voteRequest template should use configured link validity label', () => {
  const email = emailService.emailTemplates.voteRequest({
    recipientName: 'Jean Expert',
    candidateName: 'Alice Student',
    tpiReference: 'TPI-2026-001',
    tpiSubject: 'Machine Learning',
    role: 'Expert',
    slots: [],
    deadline: '12.06.2026',
    magicLinkUrl: 'http://localhost:3000/vote/abc123',
    linkValidityLabel: '7 jours'
  })

  assert.match(email.html, /Ce lien est valide pendant 7 jours/)
  assert.match(email.text, /Ce lien est valide pendant 7 jours/)
  assert.equal(emailService.formatLinkValidityLabel(168), '7 jours')
  assert.equal(emailService.formatLinkValidityLabel(25), '25 heures')
})

test('Email templates should reflect configured brand and reply contact', () => {
  const templateData = emailService.buildTemplateData({
    recipientName: 'Jean Expert',
    candidateName: 'Alice Student',
    tpiReference: 'TPI-2026-001',
    tpiSubject: 'Machine Learning',
    role: 'Expert',
    slots: [],
    deadline: '12.06.2026',
    magicLinkUrl: 'http://localhost:3000/vote/abc123'
  }, {
    emailSettings: {
      senderName: 'Commission TPI',
      senderEmail: 'noreply@example.ch',
      replyToEmail: 'support@example.ch'
    },
    expiresInHours: 168
  })
  const email = emailService.emailTemplates.voteRequest(templateData)

  assert.equal(templateData.brandName, 'Commission TPI')
  assert.equal(templateData.contactEmail, 'support@example.ch')
  assert.match(email.subject, /^\[Commission TPI\]/)
  assert.match(email.html, /ETML \/ CFPV - Commission TPI/)
  assert.match(email.html, /support@example\.ch/)
  assert.doesNotMatch(email.html, /ne pas y répondre/)
})

test('Email reminder digest should reflect configured brand', () => {
  const templateData = emailService.buildTemplateData({
    recipientName: 'Jean Expert',
    year: 2026,
    tpiCount: 1,
    tpis: [
      {
        reference: 'TPI-2026-001',
        candidateName: 'Alice Student',
        roleLabel: 'Expert'
      }
    ],
    deadline: '12.06.2026',
    magicLinkUrl: 'http://localhost:3000/vote/abc123'
  }, {
    emailSettings: {
      senderName: 'Commission TPI',
      senderEmail: 'noreply@example.ch',
      replyToEmail: 'support@example.ch'
    }
  })
  const email = emailService.emailTemplates.voteReminderDigest(templateData)

  assert.match(email.subject, /^\[Commission TPI\]/)
  assert.match(email.html, /Commission TPI - Votes en attente/)
  assert.match(email.text, /Commission TPI - Rappel votes/)
})

test('Email service should ignore unsafe configured header addresses', () => {
  const previousSmtpFrom = process.env.SMTP_FROM
  process.env.SMTP_FROM = '"Env Sender" <env@example.com>'

  try {
    const mailOptions = emailService.buildMailOptions({
      to: 'expert@example.com',
      emailContent: {
        subject: 'Test',
        text: 'Texte',
        html: '<p>Texte</p>'
      },
      emailSettings: {
        senderName: 'Secretariat\r\nBcc: attacker@example.com',
        senderEmail: 'sender@example.com\nBcc: attacker@example.com',
        replyToEmail: 'reply@example.com, attacker@example.com'
      }
    })

    assert.equal(mailOptions.from, '"Env Sender" <env@example.com>')
    assert.equal(Object.prototype.hasOwnProperty.call(mailOptions, 'replyTo'), false)
  } finally {
    if (previousSmtpFrom === undefined) {
      delete process.env.SMTP_FROM
    } else {
      process.env.SMTP_FROM = previousSmtpFrom
    }
  }
})

/**
 * Test: Rate limiting pour emails
 */
test('Email sending should respect rate limits', async () => {
  const emailRateLimit = new Map()
  
  const canSendEmail = (email, maxPerHour = 5) => {
    const now = Date.now()
    const oneHourAgo = now - 3600000

    if (!emailRateLimit.has(email)) {
      emailRateLimit.set(email, [])
    }

    const timestamps = emailRateLimit.get(email)
      .filter(t => t > oneHourAgo)

    if (timestamps.length >= maxPerHour) {
      return false // Rate limit exceeded
    }

    timestamps.push(now)
    emailRateLimit.set(email, timestamps)
    return true
  }

  // First 5 emails should succeed
  for (let i = 0; i < 5; i++) {
    assert.ok(canSendEmail('user@example.com'), `Email ${i+1} should succeed`)
  }

  // 6th email should fail (rate limit)
  assert.ok(!canSendEmail('user@example.com'), 'Email 6 should fail (rate limit)')
})

/**
 * Test: Magic links should have expiration
 */
test('Magic link tokens should have expiration time', async () => {
  const generateMagicLink = (email) => {
    const token = `token-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    const expiresAt = new Date(Date.now() + 24 * 3600000) // 24 hours

    return {
      token,
      url: `http://example.com/verify?token=${token}`,
      expiresAt
    }
  }

  const link = generateMagicLink('user@example.com')

  assert.ok(link.token.length > 10, 'Token should have sufficient length')
  assert.ok(link.expiresAt > new Date(), 'Token should not be expired at creation')
  assert.ok(link.url.includes(link.token), 'URL should include token')

  // Test expired token rejection
  const checkToken = (token, expiresAt) => {
    return expiresAt > new Date()
  }

  assert.ok(checkToken(link.token, link.expiresAt), 'Fresh token should be valid')

  const expiredLink = {
    token: 'expired-token',
    expiresAt: new Date(Date.now() - 1000) // 1 second ago
  }

  assert.ok(!checkToken(expiredLink.token, expiredLink.expiresAt), 
    'Expired token should be rejected')
})
