import { clampInt } from './helpers'

export const DOUDIZHU_PLAYERS = 3

/**
 * 斗地主一局结算：地主赢时地主 +2×底分×倍数、两家农民各 −底分×倍数；农民赢时反向。
 * 每局恒为零和。
 */
export const computeDoudizhuScores = ({ landlord, landlordWon, baseScore, multiplier }) => {
  const len = DOUDIZHU_PLAYERS
  const scores = Array(len).fill(0)
  if (!Number.isInteger(landlord) || landlord < 0 || landlord >= len) return scores

  const unit = Math.max(1, clampInt(baseScore)) * Math.max(1, clampInt(multiplier))
  if (landlordWon) {
    scores[landlord] = unit * 2
    for (let i = 0; i < len; i += 1) {
      if (i !== landlord) scores[i] = -unit
    }
  } else {
    scores[landlord] = -unit * 2
    for (let i = 0; i < len; i += 1) {
      if (i !== landlord) scores[i] = unit
    }
  }
  return scores
}

/**
 * 推导一局的胜方玩家下标：地主赢时只有地主，农民赢时是两位农民。
 */
export const deriveDoudizhuWinners = (round) => {
  if (!Number.isInteger(round?.landlord) || round.landlord < 0 || round.landlord >= DOUDIZHU_PLAYERS) return []
  if (round.landlordWon !== false) return [round.landlord]
  return [0, 1, 2].filter((i) => i !== round.landlord)
}
