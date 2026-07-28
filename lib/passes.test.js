import { describe, it, expect } from 'vitest'
import { nextRemainingAfterPunch } from './passes'

describe('nextRemainingAfterPunch', () => {
  it('decrements a positive count', () => {
    expect(nextRemainingAfterPunch(5)).toBe(4)
  })

  it('does not go below 0', () => {
    expect(nextRemainingAfterPunch(0)).toBe(0)
  })

  it('decrements 1 to 0', () => {
    expect(nextRemainingAfterPunch(1)).toBe(0)
  })
})
