const test = require('node:test')
const assert = require('node:assert/strict')

const {
  canTransitionTpiStatus,
  deriveLifecycleStatus,
  validateStatusTransition,
  validateTpiRules
} = require('../modules/gestionTpi/rules')

test('validateTpiRules rejects incoherent TPI date ordering', () => {
  const result = validateTpiRules({
    dates: {
      depart: '2026-06-10',
      fin: '2026-06-01',
      renduFinal: '2026-05-30',
      soutenance: '2026-05-29'
    },
    journal: { status: 'not_started' },
    rapport: { status: 'not_started' }
  })

  assert.equal(result.isValid, false)
  assert.ok(result.issues.some((issue) => issue.type === 'tpi_date_order'))
  assert.ok(result.issues.some((issue) => issue.type === 'report_due_before_end'))
  assert.ok(result.issues.some((issue) => issue.type === 'defense_before_report_due'))
})

test('validateTpiRules enforces journal and report prerequisites', () => {
  const result = validateTpiRules({
    dates: {},
    journal: {
      status: 'in_progress',
      lastEntryAt: 'not-a-date'
    },
    rapport: {
      status: 'submitted'
    }
  })

  assert.equal(result.isValid, false)
  assert.ok(result.issues.some((issue) => issue.type === 'journal_requires_start_date'))
  assert.ok(result.issues.some((issue) => issue.type === 'invalid_journal_date'))
  assert.ok(result.issues.some((issue) => issue.type === 'report_submission_missing'))
})

test('validateTpiRules reports late report submissions as warnings', () => {
  const result = validateTpiRules({
    dates: {
      depart: '2026-03-01',
      fin: '2026-06-01',
      renduFinal: '2026-06-05'
    },
    rapport: {
      status: 'submitted',
      submittedAt: '2026-06-10',
      url: 'https://example.test/rapport.pdf'
    }
  })

  assert.equal(result.isValid, true)
  assert.deepEqual(result.issues.map((issue) => issue.type), ['report_submitted_late'])
  assert.equal(result.issues[0].severity, 'warning')
})

test('status transitions allow the current workflow and reject impossible jumps', () => {
  assert.equal(canTransitionTpiStatus('ready_for_planning', 'imported_to_planning'), true)
  assert.equal(canTransitionTpiStatus('draft', 'completed'), false)

  const transition = validateStatusTransition('draft', 'completed')
  assert.equal(transition.isValid, false)
  assert.equal(transition.issue.type, 'invalid_status_transition')
  assert.deepEqual(transition.issue.allowedTransitions, [
    'stakeholders_pending',
    'ready_for_planning',
    'cancelled'
  ])
})

test('deriveLifecycleStatus reflects coordination progress over stale catalog statuses', () => {
  assert.equal(
    deriveLifecycleStatus({
      tpi: {
        status: 'ready_for_planning',
        dates: {}
      },
      planningTpi: {
        status: 'confirmed',
        confirmedSlot: 'slot-1'
      }
    }),
    'defense_scheduled'
  )

  assert.equal(
    deriveLifecycleStatus({
      tpi: {
        status: 'report_review',
        dates: {
          soutenance: '2026-06-10'
        }
      },
      planningTpi: {
        status: 'confirmed',
        confirmedSlot: 'slot-1'
      }
    }),
    'report_review'
  )
})
