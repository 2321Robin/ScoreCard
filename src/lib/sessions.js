import { MAX_PLAYERS, MIN_PLAYERS, defaultPlayers, DEFAULT_MAHJONG_RULES, STORAGE_KEY } from './constants'
import { clampInt, ensureLength } from './helpers'
import { createEmptyGangDraft } from './mahjong'
import { parseImportedCsvV1, splitCsvLine } from './csv'

export const createSession = ({
  id,
  name,
  players = defaultPlayers,
  rounds = [],
  nextRoundId = 1,
  targetRounds = '',
  scoringMode = 'standard',
}) => {
  const safePlayers = Array.isArray(players) && players.length >= MIN_PLAYERS ? players.slice(0, MAX_PLAYERS) : defaultPlayers

  const normalizedRounds = Array.isArray(rounds)
    ? rounds.map((r, idx) => {
        const rid = typeof r.id === 'number' ? r.id : idx + 1
        const scores = Array.isArray(r.scores) ? r.scores.slice(0, safePlayers.length) : []
        const padded = [...scores, ...Array(safePlayers.length - scores.length).fill(0)]
        const gangs = Array.isArray(r.gangs)
          ? ensureLength(
              r.gangs.map((g) => ({
                type: g?.type === 'an' || g?.type === 'dian' ? g.type : 'none',
                target: Number.isInteger(g?.target) ? g.target : null,
              })),
              safePlayers.length,
              { type: 'none', target: null },
            )
          : createEmptyGangDraft(safePlayers.length)
        const winner = Number.isInteger(r.winner) ? r.winner : null
        return { id: rid, scores: padded, gangs, winner }
      })
    : []

  const maxId = Math.max(...normalizedRounds.map((r) => r.id), 0)

  return {
    id,
    name: name || `会话 ${id}`,
    players: safePlayers,
    rounds: normalizedRounds,
    nextRoundId: typeof nextRoundId === 'number' && nextRoundId > maxId ? nextRoundId : maxId + 1,
    targetRounds: typeof targetRounds === 'number' || typeof targetRounds === 'string' ? targetRounds : '',
    scoringMode: scoringMode === 'mahjong' ? 'mahjong' : 'standard',
    createdAt: Date.now(),
  }
}

const createDefaultState = () => {
  const firstSession = createSession({ id: 1, name: '会话 1' })
  return {
    sessions: [firstSession],
    currentSessionId: firstSession.id,
    mahjongRules: { ...DEFAULT_MAHJONG_RULES },
  }
}

export function loadInitialState() {
  if (typeof window === 'undefined') return createDefaultState()
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return createDefaultState()

    const parsed = JSON.parse(raw)

    if (Array.isArray(parsed.sessions)) {
      const sessions = parsed.sessions
        .map((s, idx) =>
          createSession({
            id: typeof s.id === 'number' ? s.id : idx + 1,
            name: s.name,
            players: s.players,
            rounds: s.rounds,
            nextRoundId: s.nextRoundId,
            targetRounds: s.targetRounds,
            scoringMode: s.scoringMode || parsed.scoringMode || 'standard',
          }),
        )
        .slice(0, 50)

      if (sessions.length === 0) {
        return createDefaultState()
      }

      const currentSessionId = sessions.some((s) => s.id === parsed.currentSessionId)
        ? parsed.currentSessionId
        : sessions[0].id

      return {
        sessions,
        currentSessionId,
        mahjongRules: parsed.mahjongRules || { ...DEFAULT_MAHJONG_RULES },
      }
    }

    const sessionFromV1 = createSession({
      id: 1,
      name: '会话 1',
      players: parsed.players,
      rounds: parsed.rounds,
      nextRoundId: parsed.nextRoundId,
      targetRounds: parsed.targetRounds,
    })

    return {
      sessions: [sessionFromV1],
      currentSessionId: 1,
      mahjongRules: { ...DEFAULT_MAHJONG_RULES },
    }
  } catch (err) {
    console.warn('Failed to load state, using default', err)
    return createDefaultState()
  }
}

export const parseSessionsFromCsv = (text) => {
  const rawLines = text.replace(/^\ufeff/, '').split(/\r?\n/)
  if (!rawLines.some((l) => l.trim())) {
    throw new Error('文件内容为空或格式不正确')
  }
  const lines = rawLines.map((l) => l.trim())

  let idx = 0
  while (idx < lines.length && lines[idx] === '') idx += 1

  if (idx < lines.length) {
    const cells = splitCsvLine(lines[idx])
    if (cells[0]?.toLowerCase() === 'generated at') {
      idx += 1
    }
  }

  let version = null
  if (idx < lines.length) {
    const cells = splitCsvLine(lines[idx])
    if (cells[0]?.toLowerCase() === 'version') {
      version = cells[1]
      idx += 1
    }
  }

  if (version !== '2') {
    const single = parseImportedCsvV1(text)
    const session = createSession({
      id: 1,
      name: '会话 1',
      players: single.players,
      rounds: single.rounds,
      nextRoundId: single.rounds.length + 1,
    })
    return [session]
  }

  const sessions = []

  while (idx < lines.length) {
    while (idx < lines.length && lines[idx] === '') idx += 1
    if (idx >= lines.length) break

    const sessionRow = splitCsvLine(lines[idx])
    if (sessionRow[0]?.toLowerCase() !== 'session') {
      throw new Error('缺少 Session 行')
    }
    const sessionId = Number.parseInt(sessionRow[1], 10)
    const sessionName = sessionRow[2] || `会话 ${sessionId || sessions.length + 1}`
    const createdAtCellIndex = sessionRow.findIndex((c) => c?.toLowerCase() === 'createdat')
    const createdAt = createdAtCellIndex !== -1 ? Date.parse(sessionRow[createdAtCellIndex + 1] ?? '') || Date.now() : Date.now()
    idx += 1

    while (idx < lines.length && lines[idx] === '') idx += 1
    if (idx >= lines.length) break

    const playersRow = splitCsvLine(lines[idx])
    if (playersRow[0]?.toLowerCase() !== 'players') {
      throw new Error('缺少 Players 行')
    }
    const players = playersRow.slice(1).filter(Boolean)
    if (players.length < MIN_PLAYERS || players.length > MAX_PLAYERS) {
      throw new Error('玩家数量不合法或超出范围')
    }
    idx += 1

    while (idx < lines.length && lines[idx] === '') idx += 1
    if (idx >= lines.length) break

    const headerRow = splitCsvLine(lines[idx])
    if (headerRow[0]?.toLowerCase() !== 'round') {
      throw new Error('缺少 Round 表头')
    }
    idx += 1

    const rounds = []
    while (idx < lines.length) {
      const row = lines[idx]
      idx += 1
      if (!row) continue
      const cells = splitCsvLine(row)
      const marker = cells[0]?.toLowerCase()
      if (marker === 'total') {
        break
      }
      const scores = cells.slice(1, 1 + players.length).map(clampInt)
      rounds.push({ id: rounds.length + 1, scores })
    }

    const session = createSession({
      id: Number.isFinite(sessionId) ? sessionId : sessions.length + 1,
      name: sessionName,
      players,
      rounds,
      nextRoundId: rounds.length + 1,
      targetRounds: '',
    })
    session.createdAt = createdAt
    sessions.push(session)
  }

  if (sessions.length === 0) {
    throw new Error('未找到会话数据')
  }

  return sessions
}
