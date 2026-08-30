import { describe, it, expect } from 'vitest'
import { computeDoudizhuScores, deriveDoudizhuWinners } from './doudizhu'

describe('computeDoudizhuScores', () => {
  it('landlord wins with base 1 multiplier 1: landlord +2, farmers -1 each', () => {
    expect(computeDoudizhuScores({ landlord: 0, landlordWon: true, baseScore: 1, multiplier: 1 })).toEqual([2, -1, -1])
  })

  it('farmers win: landlord -2, farmers +1 each', () => {
    expect(computeDoudizhuScores({ landlord: 2, landlordWon: false, baseScore: 1, multiplier: 1 })).toEqual([1, 1, -2])
  })

  it('scales with base and multiplier (base 2 x3 = 6 per unit)', () => {
    expect(computeDoudizhuScores({ landlord: 1, landlordWon: true, baseScore: 2, multiplier: 3 })).toEqual([-6, 12, -6])
  })

  it('always keeps a zero sum', () => {
    const scores = computeDoudizhuScores({ landlord: 1, landlordWon: false, baseScore: 5, multiplier: 4 })
    expect(scores.reduce((a, b) => a + b, 0)).toBe(0)
  })

  it('returns zeros when landlord is missing or out of range', () => {
    expect(computeDoudizhuScores({ landlord: null, landlordWon: true, baseScore: 1, multiplier: 1 })).toEqual([0, 0, 0])
    expect(computeDoudizhuScores({ landlord: 5, landlordWon: true, baseScore: 1, multiplier: 1 })).toEqual([0, 0, 0])
  })

  it('clamps base/multiplier to at least 1', () => {
    expect(computeDoudizhuScores({ landlord: 0, landlordWon: true, baseScore: 0, multiplier: 0 })).toEqual([2, -1, -1])
  })
})

describe('deriveDoudizhuWinners', () => {
  it('returns landlord when landlord wins', () => {
    expect(deriveDoudizhuWinners({ landlord: 1, landlordWon: true })).toEqual([1])
  })

  it('returns the two farmers when farmers win', () => {
    expect(deriveDoudizhuWinners({ landlord: 1, landlordWon: false })).toEqual([0, 2])
  })

  it('returns empty when landlord is missing', () => {
    expect(deriveDoudizhuWinners({ landlord: null })).toEqual([])
  })
})
