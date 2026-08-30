import { clampInt } from './helpers'

export const DOUDIZHU_PLAYERS = 3

export const DOUDIZHU_MULTIPLIER_OPTIONS = [1, 2, 4, 8, 16]

/**
 * 斗地主一局结算：
 * - 地主赢：地主 +2×底分×倍数，两家农民各 −底分×倍数；
 * - 农民赢：地主 −2×底分×倍数，两家农民各 +底分×倍数。
 * - 封顶 cap：每局单个玩家最多输 cap 分。超限时按封顶结算，赢家按实际损失分账，保持零和：
 *   地主赢时每家农民输 min(底分×倍数, cap)；农民赢时地主输 min(2×底分×倍数, cap)，
 *   两家农民平分（封顶为奇数时多出的 1 分归其中一家）。
 */
export const computeDoudizhuScores = ({ landlord, landlordWon, baseScore, multiplier, cap }) => {
  const len = DOUDIZHU_PLAYERS
  const scores = Array(len).fill(0)
  if (!Number.isInteger(landlord) || landlord < 0 || landlord >= len) return scores

  const unit = Math.max(1, clampInt(baseScore)) * Math.max(1, clampInt(multiplier))
  const capValue = cap === undefined || cap === null || cap === '' ? 10 : clampInt(cap)
  const maxLoss = Math.max(1, capValue)

  if (landlordWon) {
    const farmerLoss = Math.min(unit, maxLoss)
    scores[landlord] = farmerLoss * 2
    for (let i = 0; i < len; i += 1) {
      if (i !== landlord) scores[i] = -farmerLoss
    }
  } else {
    const landlordLoss = Math.min(unit * 2, maxLoss)
    scores[landlord] = -landlordLoss
    const farmers = [0, 1, 2].filter((i) => i !== landlord)
    scores[farmers[0]] = Math.ceil(landlordLoss / 2)
    scores[farmers[1]] = Math.floor(landlordLoss / 2)
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
