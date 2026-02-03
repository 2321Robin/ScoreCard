import { clampInt, ensureLength } from './helpers'
import { DEFAULT_MAHJONG_RULES } from './constants'

export const createEmptyGangDraft = (count) => Array.from({ length: count }, () => [])

export const normalizeGangs = (raw, len) => {
  const base = ensureLength(raw, len, [])
  return base.map((entry) => {
    if (Array.isArray(entry)) {
      return entry
        .map((g) => ({ type: g?.type === 'an' || g?.type === 'dian' ? g.type : 'none', target: Number.isInteger(g?.target) ? g.target : null }))
        .filter((g) => g.type !== 'none')
    }
    const single = entry && (entry.type === 'an' || entry.type === 'dian')
    return single ? [{ type: entry.type, target: Number.isInteger(entry.target) ? entry.target : null }].filter((g) => g.type !== 'none') : []
  })
}

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

  const normalized = normalizeGangs(gangDraft, len)
  normalized.forEach((entries, idx) => {
    entries.forEach((g) => {
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
