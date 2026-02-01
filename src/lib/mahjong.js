import { clampInt, ensureLength } from './helpers'
import { DEFAULT_MAHJONG_RULES } from './constants'

export const createEmptyGangDraft = (count) => Array.from({ length: count }, () => ({ type: 'none', target: null }))

export const computeMahjongScores = ({ playersCount, winnerIndex, gangDraft, rules }) => {
  const len = playersCount
  const scores = Array(len).fill(0)
  const safeRules = rules || DEFAULT_MAHJONG_RULES

  if (winnerIndex !== null && winnerIndex >= 0 && winnerIndex < len) {
    const winGain = (len - 1) * clampInt(safeRules.huPerLoser)
    scores[winnerIndex] += winGain
    for (let i = 0; i < len; i += 1) {
      if (i !== winnerIndex) {
        scores[i] -= clampInt(safeRules.huPerLoser)
      }
    }
  }

  ensureLength(gangDraft, len, { type: 'none', target: null }).forEach((g, idx) => {
    if (!g || g.type === 'none') return
    if (g.type === 'an') {
      const delta = clampInt(safeRules.anGangPerLoser)
      scores[idx] += delta * (len - 1)
      for (let i = 0; i < len; i += 1) {
        if (i !== idx) {
          scores[i] -= delta
        }
      }
    } else if (g.type === 'dian' && Number.isInteger(g.target) && g.target >= 0 && g.target < len) {
      const delta = clampInt(safeRules.dianGangAmount)
      scores[idx] += delta
      scores[g.target] -= delta
    }
  })

  return scores
}

export const deriveRoundWinners = (round) => {
  if (Number.isInteger(round?.winner)) return [round.winner]
  const scores = Array.isArray(round?.scores) ? round.scores.map(clampInt) : []
  if (scores.length === 0) return []
  const max = Math.max(...scores)
  if (!Number.isFinite(max) || max <= 0) return []
  return scores.reduce((acc, v, idx) => {
    if (v === max) acc.push(idx)
    return acc
  }, [])
}
