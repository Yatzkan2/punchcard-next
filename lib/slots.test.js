import { describe, it, expect } from 'vitest'
import { canClientCancel } from './slots'

describe('canClientCancel', () => {

    it('allows cancellation when cutoff is 0', () => {
        const slot = { starts_at: '2099-01-01T10:00:00', cancellation_cutoff_hours: 0 }
        expect(canClientCancel(slot)).toBe(true)
    })

    it('allows cancellation when well before the cutoff window', () => {
        // class is far in the future, so we're way before any cutoff
        const slot = { starts_at: '2099-01-01T10:00:00', cancellation_cutoff_hours: 12 }
        expect(canClientCancel(slot)).toBe(true)
    })

    it('blocks cancellation when past the cutoff window', () => {
        // class already happened, so cutoff is long past
        const slot = { starts_at: '2000-01-01T10:00:00', cancellation_cutoff_hours: 12 }
        expect(canClientCancel(slot)).toBe(false)
    })

    it('blocks cancellation just inside the window', () => {
        const tenHoursFromNow = new Date(Date.now() + 10 * 60 * 60 * 1000).toISOString()
        const slot = { starts_at: tenHoursFromNow, cancellation_cutoff_hours: 12 }
        expect(canClientCancel(slot)).toBe(false)
    })

    it('allows cancellation just outside the window', () => {
        const thirteenHoursFromNow = new Date(Date.now() + 13 * 60 * 60 * 1000).toISOString()
        const slot = { starts_at: thirteenHoursFromNow, cancellation_cutoff_hours: 12 }
        expect(canClientCancel(slot)).toBe(true)
    })

})