import { describe, it, expect } from 'vitest'
import { shouldPunch, shouldCreateDebt } from './attendance'

describe('shouldPunch', () => {
  it('returns true when attended and not yet punched', () => {
    expect(shouldPunch({ draftStatus: 'attended', alreadyPunched: false, punchAnyway: false })).toBe(true)
  })

  it('returns false when attended but already punched', () => {
    expect(shouldPunch({ draftStatus: 'attended', alreadyPunched: true, punchAnyway: false })).toBe(false)
  })

  it('returns true when absent with punchAnyway and not yet punched', () => {
    expect(shouldPunch({ draftStatus: 'absent', alreadyPunched: false, punchAnyway: true })).toBe(true)
  })

  it('returns false when absent without punchAnyway', () => {
    expect(shouldPunch({ draftStatus: 'absent', alreadyPunched: false, punchAnyway: false })).toBe(false)
  })

  it('returns false when attended and already punched', () => {
    expect(shouldPunch({ draftStatus: 'attended', alreadyPunched: true, punchAnyway: false })).toBe(false)
  })
})

describe('shouldCreateDebt', () => {
  it('returns true when shouldPunch is true and no pass remaining', () => {
    expect(shouldCreateDebt({ shouldPunch: true, hasPassRemaining: false })).toBe(true)
  })

  it('returns false when shouldPunch is true but pass remaining', () => {
    expect(shouldCreateDebt({ shouldPunch: true, hasPassRemaining: true })).toBe(false)
  })

  it('returns false when shouldPunch is false even with no pass remaining', () => {
    expect(shouldCreateDebt({ shouldPunch: false, hasPassRemaining: false })).toBe(false)
  })
})
