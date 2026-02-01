import { clampInt } from './helpers'
import { MAX_PLAYERS, MIN_PLAYERS } from './constants'

export const csvEscape = (value) => `"${String(value).replace(/"/g, '""')}"`

export const splitCsvLine = (line) => {
  const out = []
  let current = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i]
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"'
        i += 1
      } else {
        inQuotes = !inQuotes
      }
      continue
    }
    if (ch === ',' && !inQuotes) {
      out.push(current)
      current = ''
      continue
    }
    current += ch
  }
  out.push(current)
  return out
}

export const parseImportedCsvV1 = (text) => {
  const lines = text
    .replace(/^\ufeff/, '')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
  if (lines.length < 2) {
    throw new Error('文件内容为空或格式不正确')
  }

  const header = splitCsvLine(lines[1])
  if (header[0]?.toLowerCase() !== 'round') {
    throw new Error('缺少 Round 表头')
  }
  const playerCount = (header.length - 1) / 2
  if (!Number.isInteger(playerCount) || playerCount < MIN_PLAYERS || playerCount > MAX_PLAYERS) {
    throw new Error('玩家数量不合法或超出范围')
  }
  const players = header.slice(1, 1 + playerCount)

  const totalRowIdx = lines.findIndex((line) => {
    const cells = splitCsvLine(line)
    return cells[0]?.toLowerCase() === 'total'
  })

  const dataLines = lines.slice(2, totalRowIdx === -1 ? undefined : totalRowIdx)
  const rounds = dataLines.map((line, idx) => {
    const cells = splitCsvLine(line)
    const scores = cells.slice(1, 1 + playerCount).map(clampInt)
    return { id: idx + 1, scores }
  })

  return { players, rounds }
}
