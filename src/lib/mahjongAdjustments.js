import { clampInt } from './helpers'

export const applyBuyMaAdjustment = ({ scores, buyMa, winnerIndex, playersCount }) => {
  const x = Number.parseInt(buyMa ?? 0, 10)
  if (!Number.isFinite(x) || x <= 0) return scores
  if (x < 0 || x > 4) return scores
  if (playersCount !== 4) return scores
  if (!Number.isInteger(winnerIndex) || winnerIndex < 0 || winnerIndex >= playersCount) return scores

  return scores.map((v, idx) => clampInt(v) + (idx === winnerIndex ? 3 * x : -x))
}

export const applyFollowDealerAdjustment = ({ scores, followType, followTarget, dealerIndex, playersCount }) => {
  const normalized = scores.map((v) => clampInt(v))
  if (followType === 'none') return normalized
  if (!Number.isInteger(dealerIndex) || dealerIndex < 0 || dealerIndex >= playersCount) return normalized
  if (playersCount !== 4) return normalized

  if (followType === 'all') {
    return normalized.map((v, idx) => (idx === dealerIndex ? v - 3 : v + 1))
  }

  if (followType === 'single') {
    if (!Number.isInteger(followTarget) || followTarget < 0 || followTarget >= playersCount) return normalized
    if (followTarget === dealerIndex) return normalized
    return normalized.map((v, idx) => {
      if (idx === dealerIndex) return v - 3
      if (idx === followTarget) return v + 3
      return v
    })
  }

  return normalized
}
