import apiService from './apiService'
import { workflowCoordinationService } from './coordinationService'
import { TIMEOUTS } from '../config/appConfig'

jest.mock('./apiService', () => ({
  __esModule: true,
  default: {
    get: jest.fn(),
    post: jest.fn(),
    put: jest.fn(),
    delete: jest.fn()
  }
}))

describe('workflowCoordinationService email access payloads', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    apiService.post.mockResolvedValue({ success: true })
  })

  test('previewSoutenanceAccessEmail transmet le type de message au backend', async () => {
    const target = {
      linkId: 'link-cdp',
      recipientEmail: 'camille.projet@example.ch'
    }

    await workflowCoordinationService.previewSoutenanceAccessEmail(2026, target, {
      messageType: 'schedule_update'
    })

    expect(apiService.post).toHaveBeenCalledWith(
      '/api/workflow/2026/access-links/email-preview',
      {
        template: 'soutenanceAccess',
        target,
        messageType: 'schedule_update'
      }
    )
  })

  test('previewSoutenanceAccessEmail peut reprendre le type depuis la cible', async () => {
    const target = {
      linkId: 'link-cdp',
      messageType: 'schedule_update'
    }

    await workflowCoordinationService.previewSoutenanceAccessEmail(2026, target)

    expect(apiService.post).toHaveBeenCalledWith(
      '/api/workflow/2026/access-links/email-preview',
      {
        template: 'soutenanceAccess',
        target,
        messageType: 'schedule_update'
      }
    )
  })

  test('sendSoutenanceAccessEmails transmet relance et messageType avec le timeout email', async () => {
    const targets = [
      {
        linkId: 'link-cdp',
        recipientEmail: 'camille.projet@example.ch'
      }
    ]

    await workflowCoordinationService.sendSoutenanceAccessEmails(2026, targets, {
      baseUrl: 'http://localhost',
      forceResend: true,
      messageType: 'schedule_update'
    })

    expect(apiService.post).toHaveBeenCalledWith(
      '/api/workflow/2026/access-links/send-soutenance-emails',
      {
        targets,
        testEmail: '',
        forceResend: true,
        messageType: 'schedule_update',
        baseUrl: 'http://localhost'
      },
      TIMEOUTS.EMAIL_SEND
    )
  })
})
