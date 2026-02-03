import { useEffect, useMemo, useRef, useState } from 'react'
import { DEFAULT_MAHJONG_RULES, MAX_HISTORY, MAX_PLAYERS, MIN_PLAYERS, STORAGE_KEY, defaultPlayers } from './lib/constants'
import { clampInt, ensureLength, formatTimestamp, parseDateFromFilename } from './lib/helpers'
import { computeMahjongScores, createEmptyGangDraft, deriveRoundWinners, normalizeGangs } from './lib/mahjong'
import { csvEscape, splitCsvLine } from './lib/csv'
import { createSession, loadInitialState, parseSessionsFromCsv } from './lib/sessions'


function App() {
  const [state, setState] = useState(loadInitialState)
  const [scoreRange, setScoreRange] = useState({ min: -10, max: -1 })
  const [rangeDraft, setRangeDraft] = useState({ min: '-10', max: '-1' })
  const [newRoundScores, setNewRoundScores] = useState([])
  const [editingRoundId, setEditingRoundId] = useState(null)
  const [editScores, setEditScores] = useState([])
  const [editWinnerDraft, setEditWinnerDraft] = useState(null)
  const [editGangDraft, setEditGangDraft] = useState([])
  const [showChart, setShowChart] = useState(true)
  const [showCrossChart, setShowCrossChart] = useState(true)
  const [winnerDraft, setWinnerDraft] = useState(null)
  const [gangDraft, setGangDraft] = useState([])
  const [mahjongRulesDraft, setMahjongRulesDraft] = useState({ ...DEFAULT_MAHJONG_RULES })
  const [showCrossOverview, setShowCrossOverview] = useState(true)
  const [sessionFilterMode, setSessionFilterMode] = useState('all')
  const [selectedSessionIds, setSelectedSessionIds] = useState([])
  const [overviewMetric, setOverviewMetric] = useState('score')
  const [targetDraft, setTargetDraft] = useState('')
  const [sessionNameDraft, setSessionNameDraft] = useState('')
  const [sessionSort, setSessionSort] = useState('created')
  const fileInputRef = useRef(null)
  const historyRef = useRef({})
  const autoExportTriggeredRef = useRef({})

  const currentSession = useMemo(() => {
    return state.sessions.find((s) => s.id === state.currentSessionId) ?? state.sessions[0]
  }, [state.sessions, state.currentSessionId])

  const players = currentSession?.players ?? []
  const rounds = currentSession?.rounds ?? []
  const targetRounds = currentSession?.targetRounds ?? ''
  const scoringMode = currentSession?.scoringMode || 'standard'

  const scoreOptions = useMemo(() => {
    const options = []
    for (let i = scoreRange.min; i <= scoreRange.max; i += 1) {
      options.push(i)
    }
    return options
  }, [scoreRange])

  const applyRangeDraft = () => {
    let min = clampInt(rangeDraft.min)
    let max = clampInt(rangeDraft.max)
    if (min > max) {
      ;[min, max] = [max, min]
    }
    setScoreRange({ min, max })
    setRangeDraft({ min: String(min), max: String(max) })
  }

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  }, [state])

  useEffect(() => {
    setNewRoundScores(Array(players.length).fill(''))
    setEditingRoundId(null)
    setEditScores([])
    setEditWinnerDraft(null)
    setEditGangDraft([])
    setWinnerDraft(null)
    setGangDraft(createEmptyGangDraft(players.length))
    setSessionNameDraft(currentSession?.name ?? '')
  }, [currentSession?.id, players.length])

  useEffect(() => {
    setNewRoundScores((prev) => ensureLength(prev, players.length, ''))
    if (editingRoundId !== null) {
      setEditScores((prev) => ensureLength(prev, players.length, ''))
    }
    setGangDraft((prev) => ensureLength(prev, players.length, []))
    setEditGangDraft((prev) => ensureLength(prev, players.length, []))
  }, [players.length, editingRoundId])

  useEffect(() => {
    setTargetDraft(targetRounds === '' ? '' : String(targetRounds))
  }, [targetRounds])

  useEffect(() => {
    setMahjongRulesDraft(state.mahjongRules || { ...DEFAULT_MAHJONG_RULES })
  }, [state.mahjongRules])

  useEffect(() => {
    const ids = state.sessions.map((s) => s.id)
    setSelectedSessionIds((prev) => {
      if (!Array.isArray(prev) || prev.length === 0) return ids
      const next = prev.filter((id) => ids.includes(id))
      return next.length === 0 ? ids : next
    })
  }, [state.sessions])

  const pushHistory = (sessionId, currentState, future = []) => {
    const bucket = historyRef.current[sessionId] ?? { past: [], future: [] }
    const past = [...bucket.past, currentState].slice(-(MAX_HISTORY - 1))
    historyRef.current = { ...historyRef.current, [sessionId]: { past, future } }
  }

  const updateCurrentSessionState = (producer) => {
    setState((current) => {
      const idx = current.sessions.findIndex((s) => s.id === current.currentSessionId)
      if (idx === -1) return current
      const session = current.sessions[idx]
      const nextSession = producer(session)
      if (!nextSession) return current
      const nextSessions = [...current.sessions]
      nextSessions[idx] = nextSession
      const nextState = { ...current, sessions: nextSessions }
      pushHistory(current.currentSessionId, current)
      return nextState
    })
  }

  const undo = () => {
    setState((current) => {
      const bucket = historyRef.current[current.currentSessionId] ?? { past: [], future: [] }
      if (bucket.past.length === 0) return current
      const previous = bucket.past[bucket.past.length - 1]
      const future = [current, ...bucket.future].slice(0, MAX_HISTORY)
      historyRef.current = {
        ...historyRef.current,
        [current.currentSessionId]: { past: bucket.past.slice(0, -1), future },
      }
      return previous
    })
  }

  const redo = () => {
    setState((current) => {
      const bucket = historyRef.current[current.currentSessionId] ?? { past: [], future: [] }
      if (bucket.future.length === 0) return current
      const next = bucket.future[0]
      const past = [...bucket.past, current].slice(-(MAX_HISTORY - 1))
      historyRef.current = {
        ...historyRef.current,
        [current.currentSessionId]: { past, future: bucket.future.slice(1) },
      }
      return next
    })
  }

  const switchSession = (id) => {
    setState((current) => {
      if (!current.sessions.some((s) => s.id === id)) return current
      return { ...current, currentSessionId: id }
    })
    setEditingRoundId(null)
    setEditScores([])
    setNewRoundScores([])
  }

  const createNewSession = () => {
    setState((current) => {
      const nextId = Math.max(...current.sessions.map((s) => s.id), 0) + 1
      const newSession = createSession({ id: nextId, name: `会话 ${current.sessions.length + 1}` })
      historyRef.current = { ...historyRef.current, [nextId]: { past: [], future: [] } }
      return {
        ...current,
        sessions: [...current.sessions, newSession],
        currentSessionId: nextId,
      }
    })
  }

  const deleteCurrentSession = () => {
    if (state.sessions.length <= 1) {
      window.alert('至少保留一个会话')
      return
    }
    const ok = window.confirm('删除当前会话将清空该会话的数据，是否继续？')
    if (!ok) return
    setState((current) => {
      const nextSessions = current.sessions.filter((s) => s.id !== current.currentSessionId)
      const nextId = nextSessions[0]?.id ?? null
      const { [current.currentSessionId]: _, ...restHistory } = historyRef.current
      historyRef.current = restHistory
      const { [current.currentSessionId]: __, ...restAuto } = autoExportTriggeredRef.current
      autoExportTriggeredRef.current = restAuto
      return {
        ...current,
        sessions: nextSessions,
        currentSessionId: nextId,
      }
    })
    setEditingRoundId(null)
    setEditScores([])
    setNewRoundScores([])
  }

  const renameCurrentSession = () => {
    const name = sessionNameDraft.trim()
    if (!name) {
      setSessionNameDraft(currentSession?.name ?? '')
      return
    }
    updateCurrentSessionState((prev) => ({ ...prev, name }))
  }

  const addPlayer = () => {
    if (players.length >= MAX_PLAYERS) return
    updateCurrentSessionState((prev) => {
      const name = `玩家 ${String.fromCharCode(65 + prev.players.length)}`
      const nextPlayers = [...prev.players, name]
      const nextRounds = prev.rounds.map((r) => ({ ...r, scores: [...r.scores, 0] }))
      return { ...prev, players: nextPlayers, rounds: nextRounds }
    })
  }

  const removePlayer = (index) => {
    if (players.length <= MIN_PLAYERS) return
    updateCurrentSessionState((prev) => {
      const nextPlayers = prev.players.filter((_, i) => i !== index)
      const nextRounds = prev.rounds.map((r) => ({ ...r, scores: r.scores.filter((_, i) => i !== index) }))
      return { ...prev, players: nextPlayers, rounds: nextRounds }
    })
  }

  const renamePlayer = (index, name) => {
    updateCurrentSessionState((prev) => {
      const nextPlayers = prev.players.map((p, i) => (i === index ? name : p))
      return { ...prev, players: nextPlayers }
    })
  }

  const addRoundWithScores = (scores = [], meta = {}) => {
    updateCurrentSessionState((prev) => {
      const padded = ensureLength(scores, prev.players.length, '').map(clampInt)
      const gangs = normalizeGangs(meta.gangs ?? [], prev.players.length)
      const timestamp = typeof meta.timestamp === 'number' && Number.isFinite(meta.timestamp) ? meta.timestamp : Date.now()
      const round = {
        id: prev.nextRoundId,
        scores: padded,
        winner: Number.isInteger(meta.winner) ? meta.winner : null,
        gangs,
        timestamp,
      }
      return {
        ...prev,
        rounds: [...prev.rounds, round],
        nextRoundId: prev.nextRoundId + 1,
      }
    })
  }

  const applyMahjongRules = () => {
    const huPerLoser = clampInt(mahjongRulesDraft.huPerLoser)
    const anGangPerLoser = clampInt(mahjongRulesDraft.anGangPerLoser)
    const dianGangAmount = clampInt(mahjongRulesDraft.dianGangAmount)
    setState((current) => ({
      ...current,
      mahjongRules: {
        huPerLoser,
        anGangPerLoser,
        dianGangAmount,
      },
    }))
  }

  const computeMahjongScoresForDraft = () =>
    computeMahjongScores({
      playersCount: players.length,
      winnerIndex: winnerDraft,
      gangDraft,
      rules: state.mahjongRules,
    })

  const updateNewRoundScore = (playerIndex, value) => {
    setNewRoundScores((prev) => prev.map((s, i) => (i === playerIndex ? value : s)))
  }

  const autoBalanceNewRound = () => {
    setNewRoundScores((prev) => {
      if (prev.length === 0) return prev
      const targetIndex = prev.findIndex((v) => v === '' || v === null || v === undefined)
      const balanceIndex = targetIndex === -1 ? prev.length - 1 : targetIndex
      const sumExcludingTarget = prev.reduce((acc, v, idx) => (idx === balanceIndex ? acc : acc + clampInt(v)), 0)
      const next = [...prev]
      next[balanceIndex] = String(-sumExcludingTarget)
      return next
    })
  }

  const submitNewRound = () => {
    if (scoringMode === 'mahjong') {
      const scores = computeMahjongScoresForDraft()
      addRoundWithScores(scores, { winner: winnerDraft, gangs: gangDraft })
      setWinnerDraft(null)
      setGangDraft(createEmptyGangDraft(players.length))
    } else {
      addRoundWithScores(newRoundScores)
      setNewRoundScores(Array(players.length).fill(''))
    }
  }

  const applyTargetRounds = () => {
    const target = Number.parseInt(targetDraft, 10)
    if (!Number.isFinite(target) || target <= 0) {
      updateCurrentSessionState((prev) => ({ ...prev, targetRounds: '' }))
      setTargetDraft('')
      return
    }
    if (target <= rounds.length) {
      window.alert('目标局数需大于当前已记录局数')
      return
    }
    autoExportTriggeredRef.current[currentSession.id] = null
    updateCurrentSessionState((prev) => ({ ...prev, targetRounds: target }))
  }

  const deleteRound = (id) => {
    if (editingRoundId === id) {
      cancelEdit()
    }
    updateCurrentSessionState((prev) => {
      const nextRounds = prev.rounds.filter((r) => r.id !== id)
      return { ...prev, rounds: nextRounds }
    })
  }

  const copyPrevious = (id) => {
    updateCurrentSessionState((prev) => {
      const idx = prev.rounds.findIndex((r) => r.id === id)
      const source = prev.rounds[idx - 1] ?? prev.rounds[idx]
      const copy = { ...source, id, timestamp: Date.now() }
      const nextRounds = prev.rounds.map((r) => (r.id === id ? copy : r))
      return { ...prev, rounds: nextRounds }
    })
  }

  const startEdit = (round) => {
    setEditingRoundId(round.id)
    setEditScores(ensureLength(round.scores.map((s) => String(clampInt(s))), players.length, ''))
    setEditWinnerDraft(Number.isInteger(round.winner) ? round.winner : null)
    setEditGangDraft(normalizeGangs(round.gangs ?? [], players.length))
  }

  const cancelEdit = () => {
    setEditingRoundId(null)
    setEditScores([])
    setEditWinnerDraft(null)
    setEditGangDraft([])
  }

  const updateEditScore = (playerIndex, value) => {
    setEditScores((prev) => prev.map((s, i) => (i === playerIndex ? value : s)))
  }

  const autoBalanceEdit = () => {
    setEditScores((prev) => {
      if (prev.length === 0) return prev
      const targetIndex = prev.findIndex((v) => v === '' || v === null || v === undefined)
      const balanceIndex = targetIndex === -1 ? prev.length - 1 : targetIndex
      const sumExcludingTarget = prev.reduce((acc, v, idx) => (idx === balanceIndex ? acc : acc + clampInt(v)), 0)
      const next = [...prev]
      next[balanceIndex] = String(-sumExcludingTarget)
      return next
    })
  }

  const saveEdit = () => {
    if (editingRoundId === null) return
    if (scoringMode === 'mahjong') {
      const normalizedGangs = normalizeGangs(editGangDraft, players.length)
      const scores = computeMahjongScores({
        playersCount: players.length,
        winnerIndex: editWinnerDraft,
        gangDraft: normalizedGangs,
        rules: state.mahjongRules,
      })
      updateCurrentSessionState((prev) => {
        const nextRounds = prev.rounds.map((r) =>
          r.id === editingRoundId ? { ...r, scores, winner: editWinnerDraft, gangs: normalizedGangs } : r,
        )
        return { ...prev, rounds: nextRounds }
      })
    } else {
      const normalized = ensureLength(editScores, players.length, '').map(clampInt)
      updateCurrentSessionState((prev) => {
        const nextRounds = prev.rounds.map((r) => (r.id === editingRoundId ? { ...r, scores: normalized } : r))
        return { ...prev, rounds: nextRounds }
      })
    }
    cancelEdit()
  }

  const clearAll = () => {
    const ok = window.confirm('确定要清空所有数据吗？此操作不可撤销。')
    if (!ok) return
    historyRef.current = {}
    autoExportTriggeredRef.current = {}
    setState(createDefaultState())
  }

  const totals = useMemo(() => {
    return players.map((_, idx) => rounds.reduce((acc, r) => acc + clampInt(r.scores[idx]), 0))
  }, [players, rounds])

  const playerGridTemplate = useMemo(() => `repeat(${players.length}, minmax(140px, 1fr))`, [players.length])

  const allPlayers = useMemo(() => {
    const names = []
    state.sessions.forEach((s) => {
      s.players.forEach((p) => {
        if (p && !names.includes(p)) names.push(p)
      })
    })
    return names
  }, [state.sessions])

  const sessionSummaries = useMemo(() => {
    return state.sessions.map((session) => {
      const perPlayerTotals = allPlayers.map((p) => {
        const idx = session.players.indexOf(p)
        if (idx === -1) return 0
        return session.rounds.reduce((acc, r) => acc + clampInt(r.scores[idx] ?? 0), 0)
      })

      const wins = allPlayers.map(() => 0)
      const huCounts = allPlayers.map(() => 0)
      const gangCounts = allPlayers.map(() => 0)

      session.rounds.forEach((round) => {
        const winners = deriveRoundWinners(round)
        const isMahjongRound = Array.isArray(round.gangs) || Number.isInteger(round.winner)
        winners.forEach((w) => {
          const globalIdx = session.players[w] ? allPlayers.indexOf(session.players[w]) : -1
          if (globalIdx !== -1) {
            wins[globalIdx] += 1
            if (isMahjongRound) huCounts[globalIdx] += 1
          }
        })

        if (Array.isArray(round.gangs)) {
          round.gangs.forEach((g, idx) => {
            const entries = Array.isArray(g) ? g : g ? [g] : []
            const globalIdx = session.players[idx] ? allPlayers.indexOf(session.players[idx]) : -1
            entries.forEach((entry) => {
              if (!entry || (entry.type !== 'an' && entry.type !== 'dian')) return
              if (globalIdx !== -1) gangCounts[globalIdx] += 1
            })
          })
        }
      })

      const totalSum = perPlayerTotals.reduce((acc, v) => acc + v, 0)
      return {
        id: session.id,
        name: session.name,
        roundsCount: session.rounds.length,
        createdAt: session.createdAt,
        totals: perPlayerTotals,
        wins,
        huCounts,
        gangCounts,
        totalSum,
      }
    })
  }, [state.sessions, allPlayers])

  const sortedSessions = useMemo(() => {
    const sorted = [...sessionSummaries]
    if (sessionSort === 'rounds') {
      sorted.sort((a, b) => b.roundsCount - a.roundsCount || a.id - b.id)
    } else if (sessionSort === 'total') {
      sorted.sort((a, b) => b.totalSum - a.totalSum || a.id - b.id)
    } else {
      sorted.sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0) || a.id - b.id)
    }
    return sorted
  }, [sessionSummaries, sessionSort])

  const filteredSessions = useMemo(() => {
    if (sessionFilterMode !== 'custom') return sortedSessions
    const filtered = sortedSessions.filter((s) => selectedSessionIds.includes(s.id))
    return filtered.length > 0 ? filtered : sortedSessions
  }, [sortedSessions, sessionFilterMode, selectedSessionIds])

  const crossSessionAggregate = useMemo(() => {
    const base = filteredSessions
    const totals = allPlayers.map((_, idx) => base.reduce((acc, s) => acc + (s.totals[idx] ?? 0), 0))
    const wins = allPlayers.map((_, idx) => base.reduce((acc, s) => acc + (s.wins?.[idx] ?? 0), 0))
    const roundsCount = base.reduce((acc, s) => acc + s.roundsCount, 0)
    const huCounts = allPlayers.map((_, idx) => base.reduce((acc, s) => acc + (s.huCounts?.[idx] ?? 0), 0))
    const gangCounts = allPlayers.map((_, idx) => base.reduce((acc, s) => acc + (s.gangCounts?.[idx] ?? 0), 0))
    return { totals, wins, roundsCount, huCounts, gangCounts }
  }, [allPlayers, filteredSessions])

  const getSessionMetricValues = (session, metric) => {
    if (metric === 'win') return session.wins ?? []
    if (metric === 'hu') return session.huCounts ?? []
    if (metric === 'gang') return session.gangCounts ?? []
    return session.totals ?? []
  }

  const crossCumulativeSeries = useMemo(() => {
    const series = allPlayers.map(() => [{ idx: 0, value: 0 }])
    filteredSessions.forEach((session, idx) => {
      allPlayers.forEach((p, pi) => {
        const metricValues = getSessionMetricValues(session, overviewMetric)
        const value = metricValues[pi] ?? 0
        series[pi].push({ idx: idx + 1, value, label: session.name })
      })
    })
    return series
  }, [allPlayers, filteredSessions, overviewMetric])

  const cumulativeSeries = useMemo(() => {
    const series = players.map(() => [{ round: 0, value: 0 }])
    const running = Array(players.length).fill(0)

    rounds.forEach((round, idx) => {
      round.scores.forEach((s, i) => {
        running[i] += clampInt(s)
        series[i].push({ round: idx + 1, value: running[i] })
      })
    })
    return series
  }, [players, rounds])

  const mahjongPreviewScores = useMemo(() => {
    if (scoringMode !== 'mahjong') return []
    return computeMahjongScoresForDraft()
  }, [scoringMode, winnerDraft, gangDraft, state.mahjongRules, players.length])

  const currentMahjongStats = useMemo(() => {
    const wins = Array(players.length).fill(0)
    const huCounts = Array(players.length).fill(0)
    const gangCounts = Array(players.length).fill(0)

    rounds.forEach((round) => {
      const winners = deriveRoundWinners(round)
      const isMahjongRound = Array.isArray(round.gangs) || Number.isInteger(round.winner)
      winners.forEach((w) => {
        if (w >= 0 && w < players.length) {
          wins[w] += 1
          if (isMahjongRound) huCounts[w] += 1
        }
      })
      if (Array.isArray(round.gangs)) {
        round.gangs.forEach((g, idx) => {
          const entries = Array.isArray(g) ? g : g ? [g] : []
          entries.forEach((entry) => {
            if (!entry || (entry.type !== 'an' && entry.type !== 'dian')) return
            if (idx >= 0 && idx < players.length) gangCounts[idx] += 1
          })
        })
      }
    })

    return { wins, huCounts, gangCounts }
  }, [rounds, players.length])

  const formatLocalDateTime = (ts) => {
    if (!ts) return ''
    const d = new Date(ts)
    if (Number.isNaN(d.getTime())) return ''
    const pad = (n) => n.toString().padStart(2, '0')
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
  }

  const computeSessionStats = (session) => {
    const len = session.players.length
    const wins = Array(len).fill(0)
    const huCounts = Array(len).fill(0)
    const gangCounts = Array(len).fill(0)

    session.rounds.forEach((round) => {
      const winners = deriveRoundWinners(round)
      const isMahjongRound = Array.isArray(round.gangs) || Number.isInteger(round.winner)
      winners.forEach((w) => {
        if (w >= 0 && w < len) {
          wins[w] += 1
          if (isMahjongRound) huCounts[w] += 1
        }
      })
      if (Array.isArray(round.gangs)) {
        round.gangs.forEach((g, idx) => {
          const entries = Array.isArray(g) ? g : g ? [g] : []
          entries.forEach((entry) => {
            if (!entry || (entry.type !== 'an' && entry.type !== 'dian')) return
            if (idx >= 0 && idx < len) gangCounts[idx] += 1
          })
        })
      }
    })

    return { wins, huCounts, gangCounts }
  }

  const leader = Math.max(...totals)
  const exportCurrentCsv = () => {
    const rows = []
    rows.push(['Generated At', new Date().toISOString(), 'Mode', scoringMode])
    rows.push(['Round', 'Timestamp', ...players, ...players.map((p) => `${p} 累计总分`)])

    let cumulative = Array(players.length).fill(0)
    rounds.forEach((round, idx) => {
      const scores = round.scores.map((s) => clampInt(s))
      cumulative = cumulative.map((acc, i) => acc + scores[i])
      rows.push([idx + 1, formatLocalDateTime(round.timestamp), ...scores, ...cumulative])
    })

    const stats = computeSessionStats({ players, rounds })
    const totalRow = ['Total', '', ...totals, ...totals]
    if (scoringMode === 'standard') {
      totalRow.push('Wins', ...stats.wins)
    } else {
      totalRow.push('Hu Count', ...stats.huCounts, 'Gang Count', ...stats.gangCounts)
    }
    rows.push(totalRow)

    const csv = rows.map((row) => row.map(csvEscape).join(',')).join('\r\n')
    const bom = '\ufeff'
    const blob = new Blob([bom + csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `scores-${formatTimestamp()}.csv`
    link.click()
    URL.revokeObjectURL(url)
  }

  const exportAllSessionsCsv = () => {
    const rows = []
    rows.push(['Generated At', new Date().toISOString()])
    rows.push(['Version', '2'])

    state.sessions.forEach((session) => {
      rows.push([
        'Session',
        session.id,
        session.name,
        'CreatedAt',
        new Date(session.createdAt || Date.now()).toISOString(),
        'Mode',
        session.scoringMode || 'standard',
      ])
      rows.push(['Players', ...session.players])
      rows.push(['Round', 'Timestamp', ...session.players, ...session.players.map((p) => `${p} 累计总分`)])

      let cumulative = Array(session.players.length).fill(0)
      session.rounds.forEach((round, idx) => {
        const scores = session.players.map((_, i) => clampInt(round.scores[i] ?? 0))
        cumulative = cumulative.map((acc, i) => acc + scores[i])
        rows.push([idx + 1, formatLocalDateTime(round.timestamp), ...scores, ...cumulative])
      })

      const totalsRow = session.players.map((_, i) => session.rounds.reduce((acc, r) => acc + clampInt(r.scores[i] ?? 0), 0))
      const stats = computeSessionStats({ players: session.players, rounds: session.rounds })
      const row = ['Total', '', ...totalsRow, ...totalsRow]
      if ((session.scoringMode || 'standard') === 'standard') {
        row.push('Wins', ...stats.wins)
      } else {
        row.push('Hu Count', ...stats.huCounts, 'Gang Count', ...stats.gangCounts)
      }
      rows.push(row)
      rows.push([])
    })

    const csv = rows.map((row) => row.map(csvEscape).join(',')).join('\r\n')
    const bom = '\ufeff'
    const blob = new Blob([bom + csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `scores-all-${formatTimestamp()}.csv`
    link.click()
    URL.revokeObjectURL(url)
  }

  useEffect(() => {
    const target = Number.parseInt(targetRounds, 10)
    if (!Number.isFinite(target) || target <= 0) return
    if (rounds.length >= target && autoExportTriggeredRef.current[currentSession.id] !== target) {
      autoExportTriggeredRef.current[currentSession.id] = target
      exportCurrentCsv()
      const nextInput = window.prompt(
        `已达到设定的 ${target} 局，是否继续？输入新的总局数继续，留空或取消则不再提醒。`,
        String(target + 1),
      )
      const nextTarget = Number.parseInt(nextInput ?? '', 10)
      if (Number.isFinite(nextTarget) && nextTarget > rounds.length) {
        autoExportTriggeredRef.current[currentSession.id] = null
        updateCurrentSessionState((prev) => ({ ...prev, targetRounds: nextTarget }))
      } else {
        updateCurrentSessionState((prev) => ({ ...prev, targetRounds: '' }))
      }
    }
  }, [rounds.length, targetRounds, currentSession.id])

  const handleImportFile = async (file) => {
    try {
      const text = await file.text()
      const sessions = parseSessionsFromCsv(text)
      const fileTimestamp = parseDateFromFilename(file.name) ?? (typeof file.lastModified === 'number' ? file.lastModified : null)
      const sessionsWithDate = sessions.map((s) => ({ ...s, createdAt: fileTimestamp ?? s.createdAt ?? Date.now() }))
      if (sessionsWithDate.length > 1) {
        const replaceAll = window.confirm(`检测到 ${sessionsWithDate.length} 个会话，确定替换当前所有会话吗？\n选择“确定”导入多会话，选择“取消”仅导入第一个会话到当前会话。`)
        if (replaceAll) {
          setState((prev) => ({
            ...prev,
            sessions: sessionsWithDate,
            currentSessionId: sessionsWithDate[0].id,
          }))
          historyRef.current = {}
          autoExportTriggeredRef.current = {}
          setEditingRoundId(null)
          setEditScores([])
          setNewRoundScores([])
          alert('导入成功（多会话）')
          return
        }
      }

      const first = sessionsWithDate[0]
      updateCurrentSessionState(() => ({
        ...first,
        id: currentSession?.id ?? first.id,
        name: currentSession?.name ?? first.name,
        nextRoundId: first.nextRoundId ?? first.rounds.length + 1,
        targetRounds: typeof first.targetRounds === 'number' || typeof first.targetRounds === 'string' ? first.targetRounds : '',
      }))
      historyRef.current[currentSession?.id ?? first.id] = { past: [], future: [] }
      setEditingRoundId(null)
      setEditScores([])
      setNewRoundScores(Array(first.players.length).fill(''))
      alert('导入成功（当前会话）')
    } catch (err) {
      console.error('导入失败', err)
      alert(`导入失败：${err.message || '格式不正确'}`)
    }
  }

  const triggerImport = () => {
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
      fileInputRef.current.click()
    }
  }

  return (
    <div className="min-h-screen bg-surface text-text">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-20 focus:rounded-md focus:bg-accent focus:px-3 focus:py-2 focus:text-text"
      >
        跳转到主要内容
      </a>
      <header className="sticky top-0 z-10 border-b border-line bg-panel/90 backdrop-blur-sm">
        <div className="mx-auto flex max-w-5xl flex-col gap-3 px-4 py-4 text-text">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-col gap-1">
              <p className="text-xs uppercase tracking-[0.2em] text-muted">Score Tracker</p>
              <h1 className="text-xl font-semibold">打牌积分表单</h1>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <div className="flex flex-wrap items-center gap-2 rounded-lg border border-line bg-panel px-3 py-2 text-muted">
                <span>会话</span>
                <select
                  aria-label="切换会话"
                  className="rounded-md border border-line bg-panel px-2 py-1 text-text focus:border-accent focus:outline-none"
                  value={currentSession?.id ?? ''}
                  onChange={(e) => switchSession(Number.parseInt(e.target.value, 10))}
                >
                  {state.sessions.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
                <input
                  aria-label="会话名称"
                  className="w-36 rounded-md border border-line bg-panel px-2 py-1 text-text focus:border-accent focus:outline-none"
                  value={sessionNameDraft}
                  onChange={(e) => setSessionNameDraft(e.target.value)}
                />
                <button
                  className="rounded-md border border-line bg-panel px-2 py-1 text-text hover:border-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 focus-visible:ring-offset-2 focus-visible:ring-offset-panel"
                  onClick={renameCurrentSession}
                >
                  重命名
                </button>
                <button
                  className="rounded-md border border-line bg-panel px-2 py-1 text-text hover:border-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 focus-visible:ring-offset-2 focus-visible:ring-offset-panel"
                  onClick={createNewSession}
                >
                  新建
                </button>
                <button
                  className="rounded-md border border-line bg-panel px-2 py-1 text-text hover:border-danger disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-danger/70 focus-visible:ring-offset-2 focus-visible:ring-offset-panel"
                  onClick={deleteCurrentSession}
                  disabled={state.sessions.length <= 1}
                >
                  删除
                </button>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-sm">
            <div className="flex items-center gap-2 rounded-lg border border-line bg-panel px-3 py-2 text-muted">
              <span>目标局数</span>
              <input
                type="number"
                className="w-20 rounded-md border border-line bg-panel px-2 py-1 text-sm text-text focus:border-accent focus:outline-none"
                value={targetDraft}
                onChange={(e) => setTargetDraft(e.target.value)}
                aria-label="设定目标局数"
              />
              <button
                className="rounded-md border border-line bg-panel px-2 py-1 text-text hover:border-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 focus-visible:ring-offset-2 focus-visible:ring-offset-panel"
                onClick={applyTargetRounds}
              >
                设定
              </button>
            </div>
            <div className="flex items-center gap-2 rounded-lg border border-line bg-panel px-3 py-2 text-muted">
              <span>模式</span>
              <select
                className="rounded-md border border-line bg-panel px-2 py-1 text-text focus:border-accent focus:outline-none"
                value={scoringMode}
                onChange={(e) => updateCurrentSessionState((prev) => ({ ...prev, scoringMode: e.target.value }))}
              >
                <option value="standard">积分模式</option>
                <option value="mahjong">麻将模式</option>
              </select>
            </div>
            <button
              className="rounded-lg border border-line bg-panel px-3 py-2 text-text hover:border-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
              onClick={clearAll}
            >
              清空（需确认）
            </button>
            <button
              className="rounded-lg border border-line bg-panel px-3 py-2 text-text hover:border-accent disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
              onClick={undo}
              disabled={(historyRef.current[state.currentSessionId]?.past ?? []).length === 0}
            >
              撤销
            </button>
            <button
              className="rounded-lg border border-line bg-panel px-3 py-2 text-text hover:border-accent disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
              onClick={redo}
              disabled={(historyRef.current[state.currentSessionId]?.future ?? []).length === 0}
            >
              重做
            </button>
            <button
              className="rounded-lg bg-accent px-3 py-2 font-semibold text-text hover:brightness-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
              onClick={exportCurrentCsv}
            >
              导出当前 CSV
            </button>
            <button
              className="rounded-lg border border-line bg-panel px-3 py-2 text-text hover:border-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
              onClick={exportAllSessionsCsv}
            >
              导出全部 CSV
            </button>
            <button
              className="rounded-lg border border-line bg-panel px-3 py-2 text-text hover:border-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
              onClick={triggerImport}
            >
              导入 CSV
            </button>
            <button
              className="rounded-lg border border-line bg-panel px-3 py-2 text-text hover:border-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
              onClick={() => setShowCrossOverview((v) => !v)}
              aria-expanded={showCrossOverview}
            >
              {showCrossOverview ? '隐藏跨会话总览' : '显示跨会话总览'}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) handleImportFile(file)
              }}
            />
          </div>
        </div>
      </header>

      <main id="main-content" className="mx-auto flex max-w-5xl flex-col gap-6 px-4 py-6 text-text">
        <section className="rounded-xl border border-line bg-panel/90 p-4 shadow-lg shadow-[rgba(0,0,0,0.08)]">
          <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold">玩家</h2>
              <p className="text-sm text-muted">默认 4 人，最多 8 人；可重命名，至少保留 2 人。</p>
            </div>
            <button
              className="rounded-lg border border-line px-3 py-2 text-sm text-text hover:border-accent disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 focus-visible:ring-offset-2 focus-visible:ring-offset-panel"
              onClick={addPlayer}
              disabled={players.length >= MAX_PLAYERS}
            >
              添加玩家
            </button>
          </div>
          <div className="flex flex-wrap gap-3">
            {players.map((player, idx) => (
              <div key={idx} className="flex items-center gap-2 rounded-lg border border-line bg-panel px-3 py-2">
                <input
                  aria-label={`玩家名称 ${idx + 1}`}
                  className="w-28 rounded-md border border-line bg-panel px-2 py-1 text-sm text-text focus:border-accent focus:outline-none"
                  value={player}
                  onChange={(e) => renamePlayer(idx, e.target.value)}
                />
                <button
                  className="text-xs text-muted hover:text-text disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 focus-visible:ring-offset-2 focus-visible:ring-offset-panel"
                  onClick={() => removePlayer(idx)}
                  disabled={players.length <= MIN_PLAYERS}
                  title="删除玩家"
                >
                  删除
                </button>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-xl border border-line bg-panel/90 p-4 shadow-lg shadow-[rgba(0,0,0,0.08)]">
          <div className="mb-3 flex items-center gap-2">
            <div>
              <h2 className="text-lg font-semibold">对局记录</h2>
              <p className="text-sm text-muted">仅展示已记录的对局，修改需点击“编辑”。</p>
            </div>
          </div>

          <div className="overflow-auto rounded-lg border border-line" role="table" aria-label="对局记录">
            <div className="min-w-[720px]">
              <div className="flex items-center bg-panel px-3 py-2 text-sm font-semibold uppercase tracking-wide text-muted" role="row">
                <div className="w-14 flex-shrink-0" role="columnheader">局号</div>
                <div className="grid flex-1 items-center gap-3" style={{ gridTemplateColumns: playerGridTemplate }} role="rowheader">
                  {players.map((name) => (
                    <div key={name} className="min-w-[140px] px-3 text-center" role="columnheader">
                      {name}
                    </div>
                  ))}
                </div>
                <div className="w-40 flex-shrink-0 text-center" role="columnheader">
                  操作
                </div>
              </div>

              {rounds.map((round, rowIndex) => {
                const isEditing = editingRoundId === round.id
                const editingMahjong = isEditing && scoringMode === 'mahjong'
                const mahjongEditScores = editingMahjong
                  ? computeMahjongScores({
                      playersCount: players.length,
                      winnerIndex: editWinnerDraft,
                      gangDraft: normalizeGangs(editGangDraft, players.length),
                      rules: state.mahjongRules,
                    })
                  : null
                const currentScores = ensureLength(
                  editingMahjong ? mahjongEditScores : isEditing ? editScores : round.scores,
                  players.length,
                  '',
                )
                const sum = currentScores.reduce((acc, v) => acc + clampInt(v), 0)
                const invalid = sum !== 0

                return (
                  <div
                    key={round.id}
                    className={`border-t border-line px-3 py-3 text-sm ${invalid ? 'bg-red-50 border-red-300' : 'bg-panel'}`}
                    role="row"
                    aria-label={`第 ${rowIndex + 1} 局，${invalid ? '未平衡' : '已平衡'}`}
                  >
                    <div className="flex items-start gap-3">
                      <div className="w-14 flex-shrink-0 pt-1 text-muted">#{rowIndex + 1}</div>
                      <div className="flex-1 space-y-3">
                        <div className="grid gap-3" style={{ gridTemplateColumns: playerGridTemplate }}>
                          {players.map((name, playerIndex) => {
                            const valueRaw = currentScores[playerIndex] ?? ''
                            const valueNumber = clampInt(valueRaw)
                            return (
                              <div
                                key={playerIndex}
                                className="rounded-lg border border-line bg-panel p-3 text-center"
                                role="cell"
                              >
                                {editingMahjong ? (
                                  <div className="flex flex-col items-center justify-center gap-1 text-sm text-muted" aria-label={`${name} 当前计算分值 ${valueNumber}`}>
                                    <div className="text-lg font-semibold text-text">{valueNumber}</div>
                                    <div className="text-xs">由胡/杠自动计算</div>
                                  </div>
                                ) : isEditing ? (
                                  <div className="flex flex-col gap-2 text-sm text-muted">
                                    <label className="sr-only" htmlFor={`score-${round.id}-${playerIndex}`}>
                                      {`第 ${rowIndex + 1} 局，玩家 ${name} 分值`}
                                    </label>
                                    <input
                                      id={`score-${round.id}-${playerIndex}`}
                                      aria-label={`第 ${rowIndex + 1} 局，玩家 ${name}`}
                                      aria-invalid={invalid}
                                      type="text"
                                      inputMode="numeric"
                                      className="w-full rounded-md border border-line bg-panel px-2 py-1 text-sm text-text focus:border-accent focus:outline-none"
                                      value={valueRaw}
                                      onChange={(e) => updateEditScore(playerIndex, e.target.value)}
                                    />
                                    <select
                                      aria-label={`从下拉选择分值，玩家 ${name}`}
                                      className="w-full rounded-md border border-line bg-panel px-2 py-1 pr-10 text-sm text-text focus:border-accent focus:outline-none"
                                      value=""
                                      onChange={(e) => updateEditScore(playerIndex, e.target.value)}
                                    >
                                      <option value="" disabled>
                                        下拉选择
                                      </option>
                                      {scoreOptions.map((opt) => (
                                        <option key={opt} value={opt}>
                                          {opt}
                                        </option>
                                      ))}
                                    </select>
                                  </div>
                                ) : (
                                  <div className="flex items-center justify-center text-lg font-semibold text-text" aria-label={`${name} 分值 ${valueNumber}`}>
                                    {valueNumber}
                                  </div>
                                )}
                              </div>
                            )
                          })}
                        </div>
                        {editingMahjong && (
                          <div className="space-y-3 rounded-lg border border-line bg-panel p-3 text-sm text-muted">
                            <div className="text-text font-medium">编辑麻将结果（保存后自动重新计算分数）</div>
                            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                              <label className="flex flex-col gap-1">
                                <span>胡牌者</span>
                                <select
                                  className="rounded-md border border-line bg-panel px-2 py-1 text-text focus:border-accent focus:outline-none"
                                  value={editWinnerDraft ?? ''}
                                  onChange={(e) => {
                                    const v = e.target.value === '' ? null : Number.parseInt(e.target.value, 10)
                                    setEditWinnerDraft(Number.isFinite(v) ? v : null)
                                  }}
                                >
                                  <option value="">无</option>
                                  {players.map((name, idx) => (
                                    <option key={name} value={idx}>
                                      {name}
                                    </option>
                                  ))}
                                </select>
                              </label>
                              <div className="text-xs leading-5 text-muted">
                                修改胡/杠信息会即时更新上方分数预览，确保仍保持和为 0。
                              </div>
                            </div>
                            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                              {players.map((name, idx) => {
                                const gangs = Array.isArray(editGangDraft[idx]) ? editGangDraft[idx] : []
                                return (
                                  <div key={name} className="rounded-md border border-line bg-panel p-3">
                                    <div className="font-medium text-text">{name}</div>
                                    {gangs.map((entry, gi) => (
                                      <div key={gi} className="mt-2 rounded-md border border-line bg-panel p-2">
                                        <div className="flex items-center justify-between gap-2 text-xs text-muted">
                                          <span>杠 #{gi + 1}</span>
                                          <button
                                            className="text-danger hover:underline"
                                            onClick={() => {
                                              setEditGangDraft((prev) => {
                                                const next = ensureLength(prev, players.length, [])
                                                const list = Array.isArray(next[idx]) ? [...next[idx]] : []
                                                list.splice(gi, 1)
                                                next[idx] = list
                                                return [...next]
                                              })
                                            }}
                                            type="button"
                                          >
                                            删除
                                          </button>
                                        </div>
                                        <label className="mt-1 flex flex-col gap-1">
                                          <span className="text-xs text-muted">类型</span>
                                          <select
                                            className="w-full rounded-md border border-line bg-panel px-2 py-1 text-sm text-text focus:border-accent focus:outline-none"
                                            value={entry?.type ?? 'an'}
                                            onChange={(e) => {
                                              const type = e.target.value
                                              setEditGangDraft((prev) => {
                                                const next = ensureLength(prev, players.length, [])
                                                const list = Array.isArray(next[idx]) ? [...next[idx]] : []
                                                list[gi] = { type, target: type === 'dian' ? entry?.target ?? 0 : null }
                                                next[idx] = list
                                                return [...next]
                                              })
                                            }}
                                          >
                                            <option value="an">暗杠</option>
                                            <option value="dian">点杠</option>
                                          </select>
                                        </label>
                                        {entry?.type === 'dian' && (
                                          <label className="flex flex-col gap-1">
                                            <span className="text-xs text-muted">点谁</span>
                                            <select
                                              className="w-full rounded-md border border-line bg-panel px-2 py-1 text-sm text-text focus:border-accent focus:outline-none"
                                              value={entry?.target ?? ''}
                                              onChange={(e) => {
                                                const target = e.target.value === '' ? null : Number.parseInt(e.target.value, 10)
                                                setEditGangDraft((prev) => {
                                                  const next = ensureLength(prev, players.length, [])
                                                  const list = Array.isArray(next[idx]) ? [...next[idx]] : []
                                                  list[gi] = { ...list[gi], target: Number.isFinite(target) ? target : null }
                                                  next[idx] = list
                                                  return [...next]
                                                })
                                              }}
                                            >
                                              <option value="">选择被点玩家</option>
                                              {players.map((p, pi) =>
                                                pi === idx ? null : (
                                                  <option key={p} value={pi}>
                                                    {p}
                                                  </option>
                                                )
                                              )}
                                            </select>
                                          </label>
                                        )}
                                      </div>
                                    ))}
                                    <button
                                      className="mt-2 rounded-md border border-line bg-panel px-2 py-1 text-sm text-text hover:border-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
                                      type="button"
                                      onClick={() => {
                                        setEditGangDraft((prev) => {
                                          const next = ensureLength(prev, players.length, [])
                                          const list = Array.isArray(next[idx]) ? [...next[idx]] : []
                                          list.push({ type: 'an', target: null })
                                          next[idx] = list
                                          return [...next]
                                        })
                                      }}
                                    >
                                      添加杠
                                    </button>
                                  </div>
                                )
                              })}
                            </div>
                          </div>
                        )}
                        <div className="flex flex-wrap items-center gap-2 text-xs text-muted" aria-live="polite">
                          {invalid && <span className="rounded-full bg-red-100 px-2 py-1 text-danger">需平衡到 0</span>}
                          {scoringMode === 'mahjong' && !isEditing && (
                            <>
                              <span className="rounded-full bg-panel px-2 py-1">胡：{Number.isInteger(round.winner) ? players[round.winner] || '—' : '无'}</span>
                              <span className="rounded-full bg-panel px-2 py-1">
                                杠：
                                {Array.isArray(round.gangs)
                                  ? (() => {
                                      const desc = []
                                      round.gangs.forEach((g, idx) => {
                                        const entries = Array.isArray(g) ? g : g ? [g] : []
                                        entries.forEach((entry) => {
                                          if (!entry || entry.type === 'none') return
                                          if (entry.type === 'an') desc.push(`${players[idx] || ''} 暗杠`)
                                          if (entry.type === 'dian') desc.push(`${players[idx] || ''} 点 ${players[entry.target] || ''}`)
                                        })
                                      })
                                      return desc.length > 0 ? desc.join('，') : '无'
                                    })()
                                  : '无'}
                              </span>
                            </>
                          )}
                        </div>
                      </div>

                      <div className="w-40 flex-shrink-0 space-y-2 text-right text-xs">
                        {isEditing ? (
                          <>
                            {scoringMode === 'standard' && (
                              <button
                                className="w-full rounded-md border border-line bg-panel px-2 py-1 hover:border-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
                                aria-label={`自动平衡第 ${rowIndex + 1} 局`}
                                onClick={autoBalanceEdit}
                              >
                                自动平衡
                              </button>
                            )}
                            <button
                              className="w-full rounded-md border border-accent bg-accent/10 px-2 py-1 text-accent hover:bg-accent/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
                              aria-label={`保存第 ${rowIndex + 1} 局`}
                              onClick={saveEdit}
                            >
                              保存
                            </button>
                            <button
                              className="w-full rounded-md border border-line bg-panel px-2 py-1 hover:border-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50"
                              aria-label={`取消编辑第 ${rowIndex + 1} 局`}
                              onClick={cancelEdit}
                            >
                              取消
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              className="w-full rounded-md border border-line bg-panel px-2 py-1 hover:border-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
                              aria-label={`编辑第 ${rowIndex + 1} 局`}
                              onClick={() => startEdit(round)}
                            >
                              编辑
                            </button>
                            <button
                              className="w-full rounded-md border border-line bg-panel px-2 py-1 hover:border-danger focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-danger/70"
                              aria-label={`删除第 ${rowIndex + 1} 局`}
                              onClick={() => deleteRound(round.id)}
                            >
                              删除本局
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </section>

        <section className="rounded-xl border border-line bg-panel/90 p-4 shadow-lg shadow-[rgba(0,0,0,0.08)]">
          <div className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold">新增一局</h2>
              <p className="text-sm text-muted">在此填写分值并添加；如需调整已存在的记录，请在下方列表中点击编辑。</p>
            </div>
            {scoringMode === 'standard' ? (
              <div className="flex flex-col gap-2 text-sm sm:items-end">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-muted">分值范围</span>
                  <input
                    type="number"
                    className="w-20 rounded-md border border-line bg-panel px-2 py-1 text-sm text-text focus:border-accent focus:outline-none"
                    aria-label="分值下限"
                    value={rangeDraft.min}
                    onChange={(e) => setRangeDraft((prev) => ({ ...prev, min: e.target.value }))}
                  />
                  <span className="text-muted">到</span>
                  <input
                    type="number"
                    className="w-20 rounded-md border border-line bg-panel px-2 py-1 text-sm text-text focus:border-accent focus:outline-none"
                    aria-label="分值上限"
                    value={rangeDraft.max}
                    onChange={(e) => setRangeDraft((prev) => ({ ...prev, max: e.target.value }))}
                  />
                  <button
                    className="rounded-md border border-line bg-panel px-2 py-1 text-text hover:border-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
                    onClick={applyRangeDraft}
                  >
                    更新范围
                  </button>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    className="rounded-lg border border-line bg-panel px-3 py-2 text-text hover:border-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 focus-visible:ring-offset-2 focus-visible:ring-offset-panel"
                    onClick={autoBalanceNewRound}
                  >
                    自动平衡
                  </button>
                  <button
                    className="rounded-lg bg-accent px-3 py-2 font-semibold text-text hover:brightness-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 focus-visible:ring-offset-2 focus-visible:ring-offset-panel"
                    onClick={submitNewRound}
                  >
                    添加本局
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-2 text-sm sm:items-end">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-muted">胡分</span>
                  <input
                    type="number"
                    className="w-20 rounded-md border border-line bg-panel px-2 py-1 text-sm text-text focus:border-accent focus:outline-none"
                    aria-label="胡分（每家付）"
                    value={mahjongRulesDraft.huPerLoser}
                    onChange={(e) => setMahjongRulesDraft((prev) => ({ ...prev, huPerLoser: e.target.value }))}
                  />
                  <span className="text-muted">暗杠分</span>
                  <input
                    type="number"
                    className="w-20 rounded-md border border-line bg-panel px-2 py-1 text-sm text-text focus:border-accent focus:outline-none"
                    aria-label="暗杠分（每家付）"
                    value={mahjongRulesDraft.anGangPerLoser}
                    onChange={(e) => setMahjongRulesDraft((prev) => ({ ...prev, anGangPerLoser: e.target.value }))}
                  />
                  <span className="text-muted">点杠分</span>
                  <input
                    type="number"
                    className="w-20 rounded-md border border-line bg-panel px-2 py-1 text-sm text-text focus:border-accent focus:outline-none"
                    aria-label="点杠分"
                    value={mahjongRulesDraft.dianGangAmount}
                    onChange={(e) => setMahjongRulesDraft((prev) => ({ ...prev, dianGangAmount: e.target.value }))}
                  />
                  <button
                    className="rounded-md border border-line bg-panel px-2 py-1 text-text hover:border-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
                    onClick={applyMahjongRules}
                  >
                    更新规则
                  </button>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    className="rounded-lg bg-accent px-3 py-2 font-semibold text-text hover:brightness-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 focus-visible:ring-offset-2 focus-visible:ring-offset-panel"
                    onClick={submitNewRound}
                  >
                    添加本局
                  </button>
                </div>
              </div>
            )}
          </div>

            {scoringMode === 'standard' ? (
            <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
              {players.map((name, idx) => (
                <div key={name} className="rounded-lg border border-line bg-panel p-3" role="cell">
                  <div className="flex flex-col gap-2 text-sm text-muted">
                    <span className="font-medium text-text text-center">{name}</span>
                    <input
                      id={`new-score-${idx}`}
                      aria-label={`新增一局，玩家 ${name}`}
                      type="text"
                      inputMode="numeric"
                      className="w-full rounded-md border border-line bg-panel px-2 py-1 text-sm text-text focus:border-accent focus:outline-none"
                      value={newRoundScores[idx] ?? ''}
                      onChange={(e) => updateNewRoundScore(idx, e.target.value)}
                    />
                    <select
                      aria-label={`从下拉选择分值，玩家 ${name}`}
                      className="w-full rounded-md border border-line bg-panel px-2 py-1 pr-10 text-sm text-text focus:border-accent focus:outline-none"
                      value=""
                      onChange={(e) => updateNewRoundScore(idx, e.target.value)}
                    >
                      <option value="" disabled>
                        下拉选择
                      </option>
                      {scoreOptions.map((opt) => (
                        <option key={opt} value={opt}>
                          {opt}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
                <div className="rounded-lg border border-line bg-panel p-3">
                  <div className="text-sm text-muted">选择胡的玩家</div>
                  <select
                    className="mt-2 w-full rounded-md border border-line bg-panel px-2 py-1 text-text focus:border-accent focus:outline-none"
                    value={winnerDraft ?? ''}
                    onChange={(e) => {
                      const v = e.target.value === '' ? null : Number.parseInt(e.target.value, 10)
                      setWinnerDraft(Number.isFinite(v) ? v : null)
                    }}
                  >
                    <option value="">无</option>
                    {players.map((name, idx) => (
                      <option key={name} value={idx}>
                        {name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="rounded-lg border border-line bg-panel p-3">
                  <div className="text-sm text-muted">本局预览分数（含胡/杠）</div>
                  <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
                    {players.map((name, idx) => (
                      <div key={name} className="rounded-md border border-line bg-panel px-2 py-2">
                        <div className="text-muted">{name}</div>
                        <div className="text-lg font-semibold text-text">{mahjongPreviewScores[idx] ?? 0}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
                {players.map((name, idx) => {
                  const gangs = Array.isArray(gangDraft[idx]) ? gangDraft[idx] : []
                  return (
                    <div key={name} className="rounded-lg border border-line bg-panel p-3" role="cell">
                      <div className="flex flex-col gap-2 text-sm text-muted">
                        <span className="font-medium text-text text-center">{name}</span>
                        {gangs.map((entry, gi) => (
                          <div key={gi} className="rounded-md border border-line bg-panel p-2">
                            <div className="flex items-center justify-between gap-2 text-xs text-muted">
                              <span>杠 #{gi + 1}</span>
                              <button
                                className="text-danger hover:underline"
                                onClick={() => {
                                  setGangDraft((prev) => {
                                    const next = ensureLength(prev, players.length, [])
                                    const list = Array.isArray(next[idx]) ? [...next[idx]] : []
                                    list.splice(gi, 1)
                                    next[idx] = list
                                    return [...next]
                                  })
                                }}
                                type="button"
                              >
                                删除
                              </button>
                            </div>
                            <label className="mt-1 flex flex-col gap-1">
                              <span>类型</span>
                              <select
                                className="w-full rounded-md border border-line bg-panel px-2 py-1 text-sm text-text focus:border-accent focus:outline-none"
                                value={entry?.type ?? 'an'}
                                onChange={(e) => {
                                  const type = e.target.value
                                  setGangDraft((prev) => {
                                    const next = ensureLength(prev, players.length, [])
                                    const list = Array.isArray(next[idx]) ? [...next[idx]] : []
                                    list[gi] = { type, target: type === 'dian' ? entry?.target ?? 0 : null }
                                    next[idx] = list
                                    return [...next]
                                  })
                                }}
                              >
                                <option value="an">暗杠</option>
                                <option value="dian">点杠</option>
                              </select>
                            </label>
                            {entry?.type === 'dian' && (
                              <label className="flex flex-col gap-1">
                                <span>点谁</span>
                                <select
                                  className="w-full rounded-md border border-line bg-panel px-2 py-1 text-sm text-text focus:border-accent focus:outline-none"
                                  value={entry?.target ?? ''}
                                  onChange={(e) => {
                                    const target = e.target.value === '' ? null : Number.parseInt(e.target.value, 10)
                                    setGangDraft((prev) => {
                                      const next = ensureLength(prev, players.length, [])
                                      const list = Array.isArray(next[idx]) ? [...next[idx]] : []
                                      list[gi] = { ...list[gi], target: Number.isFinite(target) ? target : null }
                                      next[idx] = list
                                      return [...next]
                                    })
                                  }}
                                >
                                  <option value="">选择被点玩家</option>
                                  {players.map((p, pi) => (
                                    pi === idx ? null : (
                                      <option key={p} value={pi}>
                                        {p}
                                      </option>
                                    )
                                  ))}
                                </select>
                              </label>
                            )}
                          </div>
                        ))}
                        <button
                          className="mt-1 rounded-md border border-line bg-panel px-2 py-1 text-text hover:border-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
                          type="button"
                          onClick={() => {
                            setGangDraft((prev) => {
                              const next = ensureLength(prev, players.length, [])
                              const list = Array.isArray(next[idx]) ? [...next[idx]] : []
                              list.push({ type: 'an', target: null })
                              next[idx] = list
                              return [...next]
                            })
                          }}
                        >
                          添加杠
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </section>

        <section className="grid gap-4 lg:grid-cols-[2fr_1fr]">
          <div className="rounded-xl border border-line bg-panel/90 p-4 shadow-lg shadow-[rgba(0,0,0,0.08)]">
            <h2 className="text-lg font-semibold">总分</h2>
            <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
              {players.map((name, idx) => {
                const score = totals[idx]
                const wins = currentMahjongStats.wins[idx] ?? 0
                const leading = score === leader && totals.some((t) => t !== leader)
                return (
                  <div
                    key={name}
                    className="rounded-lg border border-line bg-panel px-3 py-3"
                    aria-label={`${name} 总分 ${score}`}
                  >
                    <div className="flex items-center justify-between text-sm text-muted">
                      <span>{name}</span>
                      {leading && <span className="text-accent">领先</span>}
                    </div>
                    <div className="mt-1 text-2xl font-semibold">{score}</div>
                    {scoringMode === 'mahjong' && (currentMahjongStats.huCounts[idx] > 0 || currentMahjongStats.gangCounts[idx] > 0) && (
                      <div className="mt-1 text-xs text-muted">胡 {currentMahjongStats.huCounts[idx]} · 杠 {currentMahjongStats.gangCounts[idx]}</div>
                    )}
                    {scoringMode === 'standard' && wins > 0 && (
                      <div className="mt-1 text-xs text-muted">赢 {wins} 局</div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
          <div className="rounded-xl border border-line bg-panel/90 p-4 shadow-lg shadow-[rgba(0,0,0,0.08)]">
            <h2 className="text-lg font-semibold">提示</h2>
            <ul className="mt-2 space-y-2 text-sm text-muted">
              <li>先录完负分，留一格空，再点“自动平衡”自动补齐为正，整局合计为 0。</li>
              <li>分值可直接输入或下拉选择，默认范围 -10~-1，可在新增区域自定义。</li>
              <li>支持撤销/重做（最多 50 步）；清空前需确认；数据自动保存到本地。</li>
            </ul>
          </div>
        </section>

        <section className="rounded-xl border border-line bg-panel/90 p-4 shadow-lg shadow-[rgba(0,0,0,0.08)]">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold">分数变化折线图</h2>
              <p className="text-sm text-muted">展示每位玩家的累计总分随对局的变化，便于对局过长时快速查看走势。</p>
            </div>
            <button
              className="rounded-lg border border-line bg-panel px-3 py-2 text-sm text-text hover:border-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 focus-visible:ring-offset-2 focus-visible:ring-offset-panel"
              onClick={() => setShowChart((v) => !v)}
              aria-expanded={showChart}
            >
              {showChart ? '收起折线图' : '展开折线图'}
            </button>
          </div>

          {showChart && (
            <div className="space-y-3">
              {rounds.length === 0 ? (
                <p className="text-sm text-muted">暂无对局数据，添加几局后即可查看走势。</p>
              ) : (
                <div className="overflow-auto">
                  {(() => {
                    const allValues = cumulativeSeries.flatMap((s) => s.map((p) => p.value))
                    const minValue = Math.min(0, ...allValues)
                    const maxValue = Math.max(0, ...allValues)
                    const safeMin = minValue === maxValue ? minValue - 10 : minValue
                    const safeMax = minValue === maxValue ? maxValue + 10 : maxValue
                    const padding = 20
                    const height = 220
                    const roundCount = Math.max(...cumulativeSeries.map((s) => s.length), 1)
                    const width = Math.max(320, (roundCount - 1) * 80 + 80)
                    const colors = ['#7fb37a', '#e25b5b', '#6f7664', '#3b82f6', '#f59e0b', '#8b5cf6', '#0ea5e9', '#f97316']

                    const getX = (round) => {
                      if (roundCount <= 1) return padding
                      const ratio = round / (roundCount - 1)
                      return padding + ratio * (width - padding * 2)
                    }

                    const getY = (value) => {
                      const span = safeMax - safeMin || 1
                      return padding + ((safeMax - value) / span) * (height - padding * 2)
                    }

                    const zeroY = getY(0)

                    return (
                      <div className="min-w-full">
                        <svg viewBox={`0 0 ${width} ${height}`} className="w-full max-w-full">
                          <line x1={padding} y1={zeroY} x2={width - padding} y2={zeroY} stroke="#dcd8cc" strokeDasharray="4 4" />
                          {cumulativeSeries.map((series, idx) => {
                            const color = colors[idx % colors.length]
                            const points = series.map((p) => `${getX(p.round)},${getY(p.value)}`).join(' ')
                            return (
                              <g key={idx}>
                                <polyline fill="none" stroke={color} strokeWidth="2.5" points={points} />
                                {series.map((p, i) => (
                                  <circle key={i} cx={getX(p.round)} cy={getY(p.value)} r="3.5" fill={color} />
                                ))}
                              </g>
                            )
                          })}
                          <g fill="#6f7664" fontSize="10">
                            <text x={padding} y={padding - 4}>{safeMax}</text>
                            <text x={padding} y={height - padding + 12}>{safeMin}</text>
                          </g>
                        </svg>
                      </div>
                    )
                  })()}
                </div>
              )}
              <div className="flex flex-wrap gap-3 text-xs text-muted">
                {players.map((name, idx) => {
                  const colors = ['#7fb37a', '#e25b5b', '#6f7664', '#3b82f6', '#f59e0b', '#8b5cf6', '#0ea5e9', '#f97316']
                  return (
                    <span key={name} className="flex items-center gap-2 rounded-full border border-line bg-panel px-3 py-1">
                      <span className="h-2 w-4 rounded-sm" style={{ backgroundColor: colors[idx % colors.length] }} aria-hidden />
                      <span>{name}</span>
                    </span>
                  )
                })}
              </div>
            </div>
          )}
        </section>

        {showCrossOverview && (
          <section className="rounded-xl border border-line bg-panel/90 p-4 shadow-lg shadow-[rgba(0,0,0,0.08)]">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold">跨会话总览</h2>
                <p className="text-sm text-muted">按会话汇总局数与指标（总分/赢局/胡/杠），并可查看逐会话指标走势（非累计）。</p>
              </div>
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <label className="flex items-center gap-1 text-muted">
                  <span>排序</span>
                  <select
                    className="rounded-md border border-line bg-panel px-2 py-1 text-text focus:border-accent focus:outline-none"
                    value={sessionSort}
                    onChange={(e) => setSessionSort(e.target.value)}
                  >
                    <option value="created">创建时间</option>
                    <option value="rounds">局数降序</option>
                    <option value="total">总分降序</option>
                  </select>
                </label>
                <label className="flex items-center gap-1 text-muted">
                  <span>指标</span>
                  <select
                    className="rounded-md border border-line bg-panel px-2 py-1 text-text focus:border-accent focus:outline-none"
                    value={overviewMetric}
                    onChange={(e) => setOverviewMetric(e.target.value)}
                  >
                    <option value="score">总分</option>
                    <option value="win">赢局数</option>
                    <option value="hu">胡数（麻将）</option>
                    <option value="gang">杠数（麻将）</option>
                  </select>
                </label>
                <label className="flex items-center gap-1 text-muted">
                  <span>范围</span>
                  <select
                    className="rounded-md border border-line bg-panel px-2 py-1 text-text focus:border-accent focus:outline-none"
                    value={sessionFilterMode}
                    onChange={(e) => setSessionFilterMode(e.target.value)}
                  >
                    <option value="all">全部会话</option>
                    <option value="custom">自定义</option>
                  </select>
                </label>
                <button
                  className="rounded-lg border border-line bg-panel px-3 py-2 text-text hover:border-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 focus-visible:ring-offset-2 focus-visible:ring-offset-panel"
                  onClick={() => setShowCrossChart((v) => !v)}
                  aria-expanded={showCrossChart}
                >
                  {showCrossChart ? '收起跨会话折线图' : '展开跨会话折线图'}
                </button>
              </div>
            </div>

            {sessionFilterMode === 'custom' && (
              <div className="mb-3 flex flex-wrap items-center gap-2 text-sm">
                {sortedSessions.map((s) => {
                  const checked = selectedSessionIds.includes(s.id)
                  return (
                    <label key={s.id} className="flex items-center gap-2 rounded-md border border-line bg-panel px-3 py-2 shadow-sm">
                      <input
                        type="checkbox"
                        className="accent-accent"
                        checked={checked}
                        onChange={(e) => {
                          const { checked: isChecked } = e.target
                          setSelectedSessionIds((prev) => {
                            if (isChecked) return Array.from(new Set([...prev, s.id]))
                            return prev.filter((id) => id !== s.id)
                          })
                        }}
                      />
                      <span className="truncate max-w-[140px]" title={s.name}>
                        {s.name}
                      </span>
                      <span className="text-xs text-muted">{new Date(s.createdAt || 0).toLocaleDateString()}</span>
                    </label>
                  )
                })}
                <button
                  className="rounded-md border border-line bg-panel px-2 py-1 text-muted hover:border-accent"
                  onClick={() => setSelectedSessionIds(sortedSessions.map((s) => s.id))}
                >
                  全选
                </button>
              </div>
            )}

            <div className="mb-2 text-xs uppercase tracking-wide text-muted">
              当前指标：{overviewMetric === 'win' ? '赢局数' : overviewMetric === 'hu' ? '胡数（麻将）' : overviewMetric === 'gang' ? '杠数（麻将）' : '总分'}
            </div>

            <div className="overflow-auto rounded-lg border border-line">
              <div className="min-w-[720px]">
                <div className="grid grid-cols-[140px_100px_140px_repeat(var(--player-count),120px)] items-center bg-panel px-3 py-2 text-sm font-semibold uppercase tracking-wide text-muted" style={{ ['--player-count']: allPlayers.length }}>
                  <div>会话</div>
                  <div>局数</div>
                  <div>创建时间</div>
                  {allPlayers.map((p) => (
                    <div key={p} className="text-center">
                      {p}
                    </div>
                  ))}
                </div>

                {filteredSessions.map((session) => {
                  const metricValues = getSessionMetricValues(session, overviewMetric)
                  return (
                    <div key={session.id} className="grid grid-cols-[140px_100px_140px_repeat(var(--player-count),120px)] items-center border-t border-line bg-panel px-3 py-2 text-sm" style={{ ['--player-count']: allPlayers.length }}>
                      <div className="truncate" title={session.name}>
                        {session.name}
                      </div>
                      <div>{session.roundsCount}</div>
                      <div className="text-muted text-xs" title={new Date(session.createdAt || 0).toLocaleString()}>
                        {new Date(session.createdAt || 0).toLocaleDateString()}
                      </div>
                      {allPlayers.map((_, idx) => {
                        const value = metricValues[idx] ?? 0
                        return (
                          <div key={idx} className="text-center">
                            {value === 0 ? '—' : value}
                          </div>
                        )
                      })}
                    </div>
                  )
                })}

                {(() => {
                  const aggregateValues = getSessionMetricValues(crossSessionAggregate, overviewMetric)
                  return (
                    <div className="grid grid-cols-[140px_100px_140px_repeat(var(--player-count),120px)] items-center border-t border-line bg-panel px-3 py-2 text-sm font-semibold" style={{ ['--player-count']: allPlayers.length }}>
                      <div className="truncate">合计</div>
                      <div>{crossSessionAggregate.roundsCount}</div>
                      <div className="text-muted text-xs">—</div>
                      {allPlayers.map((_, idx) => {
                        const value = aggregateValues[idx] ?? 0
                        return (
                          <div key={idx} className="text-center">
                            {value === 0 ? '—' : value}
                          </div>
                        )
                      })}
                    </div>
                  )
                })()}
              </div>
            </div>

            {showCrossChart && allPlayers.length > 0 && (
              <div className="mt-4 space-y-3">
                {filteredSessions.length === 0 ? (
                  <p className="text-sm text-muted">暂无会话数据，添加对局后可查看累计走势。</p>
                ) : (
                  <div className="overflow-auto">
                    {(() => {
                      const allValues = crossCumulativeSeries.flatMap((s) => s.map((p) => p.value))
                      const minValue = Math.min(0, ...allValues)
                      const maxValue = Math.max(0, ...allValues)
                      const safeMin = minValue === maxValue ? minValue - 10 : minValue
                      const safeMax = minValue === maxValue ? maxValue + 10 : maxValue
                      const padding = 20
                      const height = 220
                      const sessionCount = Math.max(...crossCumulativeSeries.map((s) => s.length), 1)
                      const width = Math.max(320, (sessionCount - 1) * 120 + 80)
                      const colors = ['#7fb37a', '#e25b5b', '#6f7664', '#3b82f6', '#f59e0b', '#8b5cf6', '#0ea5e9', '#f97316']

                      const getX = (idx) => {
                        if (sessionCount <= 1) return padding
                        const ratio = idx / (sessionCount - 1)
                        return padding + ratio * (width - padding * 2)
                      }

                      const getY = (value) => {
                        const span = safeMax - safeMin || 1
                        return padding + ((safeMax - value) / span) * (height - padding * 2)
                      }

                      const zeroY = getY(0)

                      return (
                        <div className="min-w-full">
                          <svg viewBox={`0 0 ${width} ${height}`} className="w-full max-w-full">
                            <line x1={padding} y1={zeroY} x2={width - padding} y2={zeroY} stroke="#dcd8cc" strokeDasharray="4 4" />
                            {crossCumulativeSeries.map((series, idx) => {
                              const color = colors[idx % colors.length]
                              const points = series.map((p) => `${getX(p.idx)},${getY(p.value)}`).join(' ')
                              return (
                                <g key={idx}>
                                  <polyline fill="none" stroke={color} strokeWidth="2.5" points={points} />
                                  {series.map((p, i) => (
                                    <circle key={i} cx={getX(p.idx)} cy={getY(p.value)} r="3.5" fill={color} />
                                  ))}
                                </g>
                              )
                            })}
                            <g fill="#6f7664" fontSize="10">
                              <text x={padding} y={padding - 4}>{safeMax}</text>
                              <text x={padding} y={height - padding + 12}>{safeMin}</text>
                            </g>
                          </svg>
                        </div>
                      )
                    })()}
                  </div>
                )}
                <div className="flex flex-wrap gap-3 text-xs text-muted">
                  {allPlayers.map((name, idx) => {
                    const colors = ['#7fb37a', '#e25b5b', '#6f7664', '#3b82f6', '#f59e0b', '#8b5cf6', '#0ea5e9', '#f97316']
                    return (
                      <span key={name} className="flex items-center gap-2 rounded-full border border-line bg-panel px-3 py-1">
                        <span className="h-2 w-4 rounded-sm" style={{ backgroundColor: colors[idx % colors.length] }} aria-hidden />
                        <span>{name}</span>
                      </span>
                    )
                  })}
                </div>
              </div>
            )}
          </section>
        )}
      </main>
    </div>
  )
}

export default App
