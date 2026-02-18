import { useEffect, useMemo, useRef, useState } from 'react'
import {
  MAX_HISTORY,
  MAX_PLAYERS,
  MIN_PLAYERS,
  STORAGE_KEY,
  defaultPlayers,
  DEFAULT_MAHJONG_RULES,
} from './lib/constants'
import { clampInt, ensureLength, formatTimestamp, parseDateFromFilename } from './lib/helpers'
import { computeMahjongScores, createEmptyGangDraft, deriveRoundWinners, normalizeGangs } from './lib/mahjong'
import { applyBuyMaAdjustment, applyFollowDealerAdjustment } from './lib/mahjongAdjustments'
import { csvEscape } from './lib/csv'
import { createSession, loadInitialState, parseSessionsFromCsv } from './lib/sessions'
import PageToc from './components/PageToc'
import PlayersSection from './components/PlayersSection'
import RoundsTable from './components/RoundsTable'
import NewRoundSection from './components/NewRoundSection'
import TotalsSection from './components/TotalsSection'
import ScoreChartSection from './components/ScoreChartSection'
import CrossSessionOverview from './components/CrossSessionOverview'

function App() {
  // Session state
  const [state, setState] = useState(loadInitialState)
  const [sessionNameDraft, setSessionNameDraft] = useState(state.sessions[0]?.name ?? '会话 1')
  const [targetDraft, setTargetDraft] = useState(state.sessions[0]?.targetRounds ?? '')
  const [isHeaderMenuOpen, setIsHeaderMenuOpen] = useState(true)
  const [isTocOpen, setIsTocOpen] = useState(true)

  // New round state
  const [scoreRange, setScoreRange] = useState({ min: -10, max: -1 })
  const [rangeDraft, setRangeDraft] = useState({ min: '-10', max: '-1' })
  const [newRoundScores, setNewRoundScores] = useState([])
  const [mahjongRulesDraft, setMahjongRulesDraft] = useState(state.mahjongRules)
  const [mahjongSpecial, setMahjongSpecial] = useState(false)
  const [mahjongSpecialScores, setMahjongSpecialScores] = useState([])
  const [mahjongSpecialNote, setMahjongSpecialNote] = useState('')
  const [winnerDraft, setWinnerDraft] = useState(null)
  const [dealerDraft, setDealerDraft] = useState(0)
  const [followTypeDraft, setFollowTypeDraft] = useState('none')
  const [followTargetDraft, setFollowTargetDraft] = useState(null)
  const [gangDraft, setGangDraft] = useState(createEmptyGangDraft(defaultPlayers.length))
  const [buyMaDraft, setBuyMaDraft] = useState(0)

  // Edit state
  const [editingRoundId, setEditingRoundId] = useState(null)
  const [editScores, setEditScores] = useState([])
  const [editMahjongSpecial, setEditMahjongSpecial] = useState(false)
  const [editMahjongScores, setEditMahjongScores] = useState([])
  const [editMahjongSpecialNote, setEditMahjongSpecialNote] = useState('')
  const [editWinnerDraft, setEditWinnerDraft] = useState(null)
  const [editDealerDraft, setEditDealerDraft] = useState(0)
  const [editFollowTypeDraft, setEditFollowTypeDraft] = useState('none')
  const [editFollowTargetDraft, setEditFollowTargetDraft] = useState(null)
  const [editGangDraft, setEditGangDraft] = useState(createEmptyGangDraft(defaultPlayers.length))
  const [editBuyMaDraft, setEditBuyMaDraft] = useState(0)

  // View state
  const [showChart, setShowChart] = useState(true)
  const [showCrossOverview, setShowCrossOverview] = useState(true)
  const [showCrossChart, setShowCrossChart] = useState(true)
  const [showCrossTable, setShowCrossTable] = useState(true)
  const [sessionSort, setSessionSort] = useState('createdAt')
  const [overviewMetric, setOverviewMetric] = useState('total')
  const [sessionFilterMode, setSessionFilterMode] = useState('all')
  const [selectedSessionIds, setSelectedSessionIds] = useState([])

  // Refs
  const historyRef = useRef({})
  const autoExportTriggeredRef = useRef({})
  const fileInputRef = useRef(null)
  const chartRef = useRef(null)
  const crossChartRef = useRef(null)
  const headerRef = useRef(null)
  const [headerHeight, setHeaderHeight] = useState(0)

  const currentSession = state.sessions.find((s) => s.id === state.currentSessionId) ?? state.sessions[0]
  const players = currentSession?.players ?? defaultPlayers
  const rounds = currentSession?.rounds ?? []
  const scoringMode = currentSession?.scoringMode ?? 'standard'

  // Persist
  useEffect(() => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ sessions: state.sessions, currentSessionId: state.currentSessionId, mahjongRules: state.mahjongRules }),
    )
  }, [state])

  // Reset drafts on session change
  useEffect(() => {
    setSessionNameDraft(currentSession?.name ?? '会话 1')
    setTargetDraft(currentSession?.targetRounds ?? '')
    setNewRoundScores(Array(players.length).fill(''))
    setMahjongRulesDraft(state.mahjongRules)
    setMahjongSpecial(false)
    setMahjongSpecialScores([])
    setMahjongSpecialNote('')
    setWinnerDraft(null)
    setDealerDraft(0)
    setFollowTypeDraft('none')
    setFollowTargetDraft(null)
    setGangDraft(createEmptyGangDraft(players.length))
    setBuyMaDraft(0)
    cancelEdit()
  }, [currentSession?.id, players.length, state.mahjongRules])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const shouldOpen = window.innerWidth >= 1024
    setIsTocOpen(shouldOpen)
  }, [])

  const measureHeader = () => {
    if (!headerRef.current) return
    const rect = headerRef.current.getBoundingClientRect()
    setHeaderHeight(rect.height)
  }

  useEffect(() => {
    measureHeader()
    const onResize = () => measureHeader()
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  useEffect(() => {
    const id = requestAnimationFrame(measureHeader)
    return () => cancelAnimationFrame(id)
  }, [isHeaderMenuOpen])

  const updateCurrentSessionState = (updater) => {
    setState((prev) => {
      const idx = prev.sessions.findIndex((s) => s.id === prev.currentSessionId)
      if (idx === -1) return prev
      const current = prev.sessions[idx]
      const nextSession = typeof updater === 'function' ? updater(current) : updater
      const nextSessions = [...prev.sessions]
      nextSessions[idx] = nextSession
      return { ...prev, sessions: nextSessions }
    })
  }

  // Session management
  const switchSession = (id) => {
    if (!state.sessions.some((s) => s.id === id)) return
    setState((prev) => ({ ...prev, currentSessionId: id }))
  }

  const renameCurrentSession = () => {
    updateCurrentSessionState((session) => ({ ...session, name: sessionNameDraft || session.name }))
  }

  const createNewSession = () => {
    const nextId = Math.max(...state.sessions.map((s) => s.id), 0) + 1
    const session = createSession({ id: nextId, name: `会话 ${nextId}` })
    setState((prev) => ({ ...prev, sessions: [...prev.sessions, session], currentSessionId: session.id }))
    historyRef.current[session.id] = { past: [], future: [] }
  }

  const deleteCurrentSession = () => {
    if (state.sessions.length <= 1) return
    const remaining = state.sessions.filter((s) => s.id !== currentSession.id)
    setState((prev) => ({
      ...prev,
      sessions: remaining,
      currentSessionId: remaining[0]?.id ?? prev.currentSessionId,
    }))
  }

  const applyTargetRounds = () => {
    updateCurrentSessionState((session) => ({ ...session, targetRounds: targetDraft }))
  }

  // History (placeholder to preserve API)
  const undo = () => {}
  const redo = () => {}

  // Player management
  const addPlayer = () => {
    updateCurrentSessionState((session) => {
      if (session.players.length >= MAX_PLAYERS) return session
      const nextPlayers = [...session.players, `玩家 ${session.players.length + 1}`]
      const nextRounds = session.rounds.map((r) => ({
        ...r,
        scores: ensureLength(r.scores, nextPlayers.length, 0),
        gangs: ensureLength(r.gangs || [], nextPlayers.length, []),
      }))
      return { ...session, players: nextPlayers, rounds: nextRounds }
    })
    setNewRoundScores((prev) => ensureLength(prev, players.length + 1, ''))
    setMahjongSpecialScores((prev) => ensureLength(prev, players.length + 1, ''))
    setGangDraft((prev) => ensureLength(prev, players.length + 1, []))
  }

  const removePlayer = (idx) => {
    updateCurrentSessionState((session) => {
      if (session.players.length <= MIN_PLAYERS) return session
      const nextPlayers = session.players.filter((_, i) => i !== idx)
      const nextRounds = session.rounds.map((r) => {
        const nextScores = r.scores.filter((_, i) => i !== idx)
        const nextGangs = ensureLength(r.gangs || [], session.players.length, []).filter((_, i) => i !== idx)
        const winner = Number.isInteger(r.winner)
          ? r.winner === idx
            ? null
            : r.winner > idx
              ? r.winner - 1
              : r.winner
          : null
        const dealer = Number.isInteger(r.dealer)
          ? r.dealer === idx
            ? 0
            : r.dealer > idx
              ? r.dealer - 1
              : r.dealer
          : null
        const followTarget = Number.isInteger(r.followTarget)
          ? r.followTarget === idx
            ? null
            : r.followTarget > idx
              ? r.followTarget - 1
              : r.followTarget
          : null
        return { ...r, scores: nextScores, gangs: nextGangs, winner, dealer, followTarget }
      })
      return { ...session, players: nextPlayers, rounds: nextRounds }
    })
  }

  const renamePlayer = (idx, name) => {
    updateCurrentSessionState((session) => {
      const next = [...session.players]
      next[idx] = name || `玩家 ${idx + 1}`
      return { ...session, players: next }
    })
  }

  // Range
  const applyRangeDraft = () => {
    const min = clampInt(rangeDraft.min)
    const max = clampInt(rangeDraft.max)
    const [lo, hi] = min <= max ? [min, max] : [max, min]
    setScoreRange({ min: lo, max: hi })
    setRangeDraft({ min: String(lo), max: String(hi) })
  }

  const scoreOptions = useMemo(() => {
    const opts = []
    const min = clampInt(scoreRange.min)
    const max = clampInt(scoreRange.max)
    for (let v = min; v <= max && opts.length < 400; v += 1) opts.push(v)
    return opts
  }, [scoreRange])

  // New round helpers
  const updateNewRoundScore = (idx, value) => {
    setNewRoundScores((prev) => ensureLength(prev, players.length, '').map((v, i) => (i === idx ? value : v)))
  }

  const autoBalanceNewRound = () => {
    setNewRoundScores((prev) => {
      if (prev.length === 0) return prev
      const emptyIdx = prev.findIndex((v) => v === '' || v === null || v === undefined)
      if (emptyIdx === -1) return prev
      const normalized = ensureLength(prev, players.length, '').map(clampInt)
      const sum = normalized.reduce((acc, val, i) => (i === emptyIdx ? acc : acc + val), 0)
      const next = [...normalized]
      next[emptyIdx] = -sum
      return next
    })
  }

  const updateMahjongSpecialScore = (idx, value) => {
    setMahjongSpecialScores((prev) => ensureLength(prev, players.length, '').map((v, i) => (i === idx ? value : v)))
  }

  const autoBalanceMahjongSpecial = () => {
    setMahjongSpecialScores((prev) => {
      const normalized = ensureLength(prev, players.length, '').map(clampInt)
      if (normalized.length === 0) return normalized
      const targetIdx = normalized.findIndex((v) => v === 0) === -1 ? 0 : normalized.findIndex((v) => v === 0)
      const sum = normalized.reduce((acc, val, i) => (i === targetIdx ? acc : acc + val), 0)
      const next = [...normalized]
      next[targetIdx] = -sum
      return next
    })
  }

  const applyMahjongRules = () => {
    const huPerLoser = clampInt(mahjongRulesDraft.huPerLoser)
    const anGangPerLoser = clampInt(mahjongRulesDraft.anGangPerLoser)
    const dianGangAmount = clampInt(mahjongRulesDraft.dianGangAmount)
    setState((prev) => ({ ...prev, mahjongRules: { huPerLoser, anGangPerLoser, dianGangAmount } }))
  }

  const computeMahjongScoresForDraft = () => {
    const base = computeMahjongScores({ playersCount: players.length, winnerIndex: winnerDraft, gangDraft, rules: state.mahjongRules })
    const afterBuyMa = applyBuyMaAdjustment({ scores: base, buyMa: buyMaDraft, winnerIndex: winnerDraft, playersCount: players.length })
    return applyFollowDealerAdjustment({
      scores: afterBuyMa,
      followType: followTypeDraft,
      followTarget: followTargetDraft,
      dealerIndex: dealerDraft,
      playersCount: players.length,
    })
  }

  const submitNewRound = () => {
    if (!currentSession) return
    if (scoringMode === 'standard') {
      const normalized = ensureLength(newRoundScores, players.length, '').map(clampInt)
      const sum = normalized.reduce((acc, v) => acc + v, 0)
      if (sum !== 0) {
        alert('需平衡到 0')
        return
      }
      updateCurrentSessionState((session) => ({
        ...session,
        rounds: [...session.rounds, { id: session.nextRoundId, scores: normalized, timestamp: Date.now(), isMahjongSpecial: false }],
        nextRoundId: session.nextRoundId + 1,
      }))
      setNewRoundScores(Array(players.length).fill(''))
      return
    }

    if (mahjongSpecial) {
      const normalized = ensureLength(mahjongSpecialScores, players.length, '').map(clampInt)
      const sum = normalized.reduce((acc, v) => acc + v, 0)
      if (sum !== 0) {
        alert('需平衡到 0')
        return
      }
      updateCurrentSessionState((session) => ({
        ...session,
        rounds: [
          ...session.rounds,
          {
            id: session.nextRoundId,
            scores: normalized,
            timestamp: Date.now(),
            isMahjongSpecial: true,
            specialNote: mahjongSpecialNote,
            followType: 'none',
            followTarget: null,
            buyMa: 0,
            winner: null,
            dealer: null,
            gangs: createEmptyGangDraft(players.length),
          },
        ],
        nextRoundId: session.nextRoundId + 1,
      }))
      setMahjongSpecial(false)
      setMahjongSpecialScores([])
      setMahjongSpecialNote('')
      setNewRoundScores(Array(players.length).fill(''))
      return
    }

    const normalizedGangs = normalizeGangs(gangDraft, players.length)
    const base = computeMahjongScores({ playersCount: players.length, winnerIndex: winnerDraft, gangDraft: normalizedGangs, rules: state.mahjongRules })
    const afterBuyMa = applyBuyMaAdjustment({ scores: base, buyMa: buyMaDraft, winnerIndex: winnerDraft, playersCount: players.length })
    const finalScores = applyFollowDealerAdjustment({
      scores: afterBuyMa,
      followType: followTypeDraft,
      followTarget: followTargetDraft,
      dealerIndex: dealerDraft,
      playersCount: players.length,
    })

    updateCurrentSessionState((session) => ({
      ...session,
      rounds: [
        ...session.rounds,
        {
          id: session.nextRoundId,
          scores: finalScores,
          timestamp: Date.now(),
          winner: winnerDraft,
          dealer: dealerDraft,
          gangs: normalizedGangs,
          isMahjongSpecial: false,
          specialNote: '',
          buyMa: buyMaDraft,
          followType: followTypeDraft,
          followTarget: followTargetDraft,
        },
      ],
      nextRoundId: session.nextRoundId + 1,
    }))

    setWinnerDraft(null)
    setDealerDraft(0)
    setFollowTypeDraft('none')
    setFollowTargetDraft(null)
    setGangDraft(createEmptyGangDraft(players.length))
    setBuyMaDraft(0)
    setNewRoundScores(Array(players.length).fill(''))
  }

  const copyPrevious = () => {
    if (rounds.length === 0) return
    const last = rounds[rounds.length - 1]
    setNewRoundScores(ensureLength(last.scores, players.length, ''))
  }

  // Edit flow
  const startEdit = (round) => {
    setEditingRoundId(round.id)
    setEditScores(ensureLength(round.scores, players.length, ''))
    setEditMahjongSpecial(Boolean(round.isMahjongSpecial))
    setEditMahjongScores(ensureLength(round.scores, players.length, ''))
    setEditMahjongSpecialNote(round.specialNote || '')
    setEditWinnerDraft(Number.isInteger(round.winner) ? round.winner : null)
    setEditDealerDraft(Number.isInteger(round.dealer) ? round.dealer : 0)
    setEditFollowTypeDraft(round.followType || 'none')
    setEditFollowTargetDraft(Number.isInteger(round.followTarget) ? round.followTarget : null)
    setEditGangDraft(normalizeGangs(round.gangs, players.length))
    setEditBuyMaDraft(Number.isFinite(round.buyMa) ? round.buyMa : 0)
  }

  const cancelEdit = () => {
    setEditingRoundId(null)
    setEditScores([])
    setEditMahjongSpecial(false)
    setEditMahjongScores([])
    setEditMahjongSpecialNote('')
    setEditWinnerDraft(null)
    setEditDealerDraft(0)
    setEditFollowTypeDraft('none')
    setEditFollowTargetDraft(null)
    setEditGangDraft(createEmptyGangDraft(players.length))
    setEditBuyMaDraft(0)
  }

  const updateEditScore = (idx, value) => {
    setEditScores((prev) => ensureLength(prev, players.length, '').map((v, i) => (i === idx ? value : v)))
  }

  const updateEditMahjongScore = (idx, value) => {
    setEditMahjongScores((prev) => ensureLength(prev, players.length, '').map((v, i) => (i === idx ? value : v)))
  }

  const autoBalanceEdit = () => {
    setEditScores((prev) => {
      const normalized = ensureLength(prev, players.length, '').map((v) => (v === '' ? 0 : clampInt(v)))
      const emptyIdx = prev.findIndex((v) => v === '' || v === null || v === undefined)
      if (emptyIdx === -1) return prev
      const sum = normalized.reduce((acc, cur, idx) => (idx === emptyIdx ? acc : acc + cur), 0)
      const next = [...normalized]
      next[emptyIdx] = -sum
      return next
    })
  }

  const autoBalanceEditMahjong = () => {
    setEditMahjongScores((prev) => {
      const normalized = ensureLength(prev, players.length, '').map((v) => (v === '' ? 0 : clampInt(v)))
      const emptyIdx = prev.findIndex((v) => v === '' || v === null || v === undefined)
      if (emptyIdx === -1) return prev
      const sum = normalized.reduce((acc, cur, idx) => (idx === emptyIdx ? acc : acc + cur), 0)
      const next = [...normalized]
      next[emptyIdx] = -sum
      return next
    })
  }

  const saveEdit = () => {
    if (!editingRoundId) return
    updateCurrentSessionState((session) => {
      const nextRounds = session.rounds.map((r) => {
        if (r.id !== editingRoundId) return r
        if (scoringMode === 'mahjong') {
          if (editMahjongSpecial) {
            const normalized = ensureLength(editMahjongScores, players.length, '').map(clampInt)
            const sum = normalized.reduce((acc, v) => acc + v, 0)
            if (sum !== 0) return r
            return {
              ...r,
              scores: normalized,
              isMahjongSpecial: true,
              specialNote: editMahjongSpecialNote,
              winner: null,
              dealer: null,
              gangs: createEmptyGangDraft(players.length),
              buyMa: 0,
              followType: 'none',
              followTarget: null,
            }
          }
          const normalizedGangs = normalizeGangs(editGangDraft, players.length)
          const base = computeMahjongScores({ playersCount: players.length, winnerIndex: editWinnerDraft, gangDraft: normalizedGangs, rules: state.mahjongRules })
          const afterBuyMa = applyBuyMaAdjustment({ scores: base, buyMa: editBuyMaDraft, winnerIndex: editWinnerDraft, playersCount: players.length })
          const finalScores = applyFollowDealerAdjustment({
            scores: afterBuyMa,
            followType: editFollowTypeDraft,
            followTarget: editFollowTargetDraft,
            dealerIndex: editDealerDraft,
            playersCount: players.length,
          })
          return {
            ...r,
            scores: finalScores,
            isMahjongSpecial: false,
            specialNote: '',
            winner: editWinnerDraft,
            dealer: editDealerDraft,
            gangs: normalizedGangs,
            buyMa: editBuyMaDraft,
            followType: editFollowTypeDraft,
            followTarget: editFollowTargetDraft,
          }
        }
        const normalized = ensureLength(editScores, players.length, '').map(clampInt)
        const sum = normalized.reduce((acc, v) => acc + v, 0)
        if (sum !== 0) return r
        return { ...r, scores: normalized, isMahjongSpecial: false, specialNote: '' }
      })
      return { ...session, rounds: nextRounds }
    })
    cancelEdit()
  }

  const deleteRound = (roundId) => {
    updateCurrentSessionState((session) => ({ ...session, rounds: session.rounds.filter((r) => r.id !== roundId) }))
    cancelEdit()
  }

  const clearAll = () => {
    if (!currentSession) return
    const ok = window.confirm('仅清空当前会话的对局数据（保留玩家、名称、模式与规则），确定吗？')
    if (!ok) return
    updateCurrentSessionState((session) => ({ ...session, rounds: [], nextRoundId: 1, targetRounds: '' }))
    cancelEdit()
    setNewRoundScores([])
    setMahjongSpecial(false)
    setMahjongSpecialScores([])
    setMahjongSpecialNote('')
    setWinnerDraft(null)
    setDealerDraft(0)
    setFollowTypeDraft('none')
    setFollowTargetDraft(null)
    setGangDraft(createEmptyGangDraft(players.length))
    setBuyMaDraft(0)
  }

  // Export helpers
  const exportSvgAsPng = (ref, filename) => {
    const node = ref?.current
    if (!node) return
    const serializer = new XMLSerializer()
    const source = serializer.serializeToString(node)
    const svgBlob = new Blob([source], { type: 'image/svg+xml;charset=utf-8' })
    const url = URL.createObjectURL(svgBlob)
    const img = new Image()
    img.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = node.clientWidth * 2
      canvas.height = node.clientHeight * 2
      const ctx = canvas.getContext('2d')
      ctx.scale(2, 2)
      ctx.drawImage(img, 0, 0)
      URL.revokeObjectURL(url)
      canvas.toBlob((blob) => {
        if (!blob) return
        const a = document.createElement('a')
        a.href = URL.createObjectURL(blob)
        a.download = filename
        a.click()
      })
    }
    img.src = url
  }

  const openSvgInNewTab = (ref) => {
    const node = ref?.current
    if (!node) return
    const serializer = new XMLSerializer()
    const source = serializer.serializeToString(node)
    const svgBlob = new Blob([source], { type: 'image/svg+xml;charset=utf-8' })
    const url = URL.createObjectURL(svgBlob)
    window.open(url, '_blank', 'noopener')
  }

  const exportCurrentCsv = () => {
    if (!currentSession) return
    const rows = []
    rows.push(['Generated At', formatTimestamp(Date.now()), 'Mode', scoringMode].map(csvEscape).join(','))
    rows.push(['Round', 'Timestamp', ...players].map(csvEscape).join(','))
    currentSession.rounds.forEach((r) => {
      rows.push([r.id, formatTimestamp(r.timestamp), ...ensureLength(r.scores, players.length, 0)].map(csvEscape).join(','))
    })
    const blob = new Blob([rows.join('\n')], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `${currentSession.name || 'session'}.csv`
    link.click()
  }

  const exportAllSessionsCsv = () => {
    const rows = []
    rows.push(['Generated At', formatTimestamp(Date.now())].map(csvEscape).join(','))
    state.sessions.forEach((session) => {
      rows.push(['Session', session.name].map(csvEscape).join(','))
      rows.push(['Round', 'Timestamp', ...session.players].map(csvEscape).join(','))
      session.rounds.forEach((r) => {
        rows.push([r.id, formatTimestamp(r.timestamp), ...ensureLength(r.scores, session.players.length, 0)].map(csvEscape).join(','))
      })
    })
    const blob = new Blob([rows.join('\n')], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'all-sessions.csv'
    link.click()
  }

  const handleImportFiles = async (files) => {
    const file = files?.[0]
    if (!file) return
    const text = await file.text()
    try {
      const sessions = parseSessionsFromCsv(text)
      const sessionsWithDate = sessions.map((s) => {
        const parsed = parseDateFromFilename(file.name)
        return parsed ? { ...s, name: `${s.name} (${parsed})` } : s
      })
      setState((prev) => ({ ...prev, sessions: sessionsWithDate, currentSessionId: sessionsWithDate[0].id }))
      historyRef.current = {}
      autoExportTriggeredRef.current = {}
      setEditingRoundId(null)
      setEditScores([])
      setNewRoundScores(Array(sessionsWithDate[0].players.length).fill(''))
      alert('导入成功')
    } catch (err) {
      alert(`导入失败：${err.message || '格式不正确'}`)
    }
  }

  const triggerImport = () => {
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
      fileInputRef.current.click()
    }
  }

  // Derived data
  const totals = useMemo(() => players.map((_, idx) => rounds.reduce((acc, r) => acc + clampInt(r.scores[idx]), 0)), [players, rounds])

  const leader = useMemo(() => (totals.length ? Math.max(...totals) : 0), [totals])

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
    const totalsAgg = allPlayers.map((_, idx) => base.reduce((acc, s) => acc + (s.totals[idx] ?? 0), 0))
    const winsAgg = allPlayers.map((_, idx) => base.reduce((acc, s) => acc + (s.wins?.[idx] ?? 0), 0))
    const roundsCount = base.reduce((acc, s) => acc + s.roundsCount, 0)
    const huCounts = allPlayers.map((_, idx) => base.reduce((acc, s) => acc + (s.huCounts?.[idx] ?? 0), 0))
    const gangCounts = allPlayers.map((_, idx) => base.reduce((acc, s) => acc + (s.gangCounts?.[idx] ?? 0), 0))
    return { totals: totalsAgg, wins: winsAgg, roundsCount, huCounts, gangCounts }
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
    let logicalRound = 0
    rounds.forEach((round) => {
      round.scores.forEach((s, i) => {
        running[i] += clampInt(s)
      })
      if (!round.isMahjongSpecial) {
        logicalRound += 1
        series.forEach((list, i) => {
          list.push({ round: logicalRound, value: running[i] })
        })
      }
    })
    if (logicalRound === 0 && rounds.length > 0) {
      series.forEach((list, i) => {
        list.push({ round: 1, value: running[i] })
      })
    }
    return series
  }, [players, rounds])

  const mahjongPreviewScores = useMemo(() => {
    if (scoringMode !== 'mahjong') return []
    if (mahjongSpecial) return ensureLength(mahjongSpecialScores, players.length, '').map(clampInt)
    return computeMahjongScoresForDraft()
  }, [scoringMode, mahjongSpecial, mahjongSpecialScores, players.length, winnerDraft, gangDraft, buyMaDraft, followTypeDraft, followTargetDraft, dealerDraft, state.mahjongRules])

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

  const logicalRoundNumbers = useMemo(() => {
    let idx = 0
    return rounds.map((r) => {
      if (r.isMahjongSpecial) return null
      idx += 1
      return idx
    })
  }, [rounds])

  const tocSections = [
    { id: 'players', label: '玩家' },
    { id: 'rounds', label: '对局记录' },
    { id: 'new-round', label: '新增一局' },
    { id: 'totals', label: '总分' },
    { id: 'score-chart', label: '分数变化折线图' },
    { id: 'cross-overview', label: '跨会话总览' },
  ]

  const tocTop = Math.max(headerHeight + 8, 72)
  const tocHeight = `calc(100vh - ${Math.max(tocTop + 16, 160)}px)`
  const mainClasses = `mx-auto flex w-full max-w-5xl flex-col gap-4 overflow-x-hidden px-4 py-6 text-text ${isTocOpen ? 'lg:pl-[300px]' : ''}`

  return (
    <div className="min-h-screen bg-surface text-text">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-20 focus:rounded-md focus:bg-accent focus:px-3 focus:py-2 focus:text-text"
      >
        跳转到主要内容
      </a>

      <header ref={headerRef} className="sticky top-0 z-10 border-b border-line bg-panel/90 backdrop-blur-sm">
        <div className="mx-auto flex max-w-5xl flex-col gap-3 px-4 py-4 text-text">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-col gap-1">
              <p className="text-xs uppercase tracking-[0.2em] text-muted">Score Tracker</p>
              <h1 className="text-xl font-semibold">打牌记分器</h1>
            </div>
            <button
              className="flex items-center gap-2 rounded-md border border-line bg-panel px-3 py-2 text-sm text-text hover:border-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 focus-visible:ring-offset-2 focus-visible:ring-offset-panel"
              onClick={() => setIsHeaderMenuOpen((v) => !v)}
              aria-expanded={isHeaderMenuOpen}
              aria-controls="top-menu-panel"
            >
              {isHeaderMenuOpen ? '收起菜单' : '展开菜单'}
            </button>
          </div>

          <div id="top-menu-panel" className={`${isHeaderMenuOpen ? 'flex' : 'hidden'} flex-col gap-3 text-sm`}>
            <div className="flex flex-wrap items-center justify-between gap-3">
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

            <div className="flex flex-wrap items-center gap-2">
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
              <div className="flex items-center gap-2 rounded-lg border border-line bg-panel px-3 py-2 text-muted">
                <span>目录</span>
                <button
                  className="rounded-md border border-line bg-panel px-2 py-1 text-text hover:border-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 focus-visible:ring-offset-2 focus-visible:ring-offset-panel"
                  onClick={() => setIsTocOpen((v) => !v)}
                  aria-pressed={isTocOpen}
                >
                  {isTocOpen ? '隐藏' : '显示'}
                </button>
              </div>
              <button
                className="rounded-lg border border-line bg-panel px-3 py-2 text-text hover:border-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
                onClick={clearAll}
              >
                清空（需确认）
              </button>
              <button
                className="rounded-lg border border-line bg-panel px-3 py-2 text-text hover:border-accent disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
                onClick={() => {}}
                disabled
              >
                撤销
              </button>
              <button
                className="rounded-lg border border-line bg-panel px-3 py-2 text-text hover:border-accent disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
                onClick={() => {}}
                disabled
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
              <div className="relative">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,text/csv"
                  className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                  onChange={(e) => handleImportFiles(e.target.files)}
                />
                <button
                  className="rounded-lg border border-line bg-panel px-3 py-2 text-text hover:border-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
                  onClick={triggerImport}
                >
                  导入 CSV
                </button>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main id="main-content" className={mainClasses}>
        <div className={`flex flex-col gap-6 ${isTocOpen ? 'lg:gap-8' : ''}`}>
          <aside
            id="page-toc-panel"
            className={`${isTocOpen ? 'block' : 'hidden'} sticky z-30 self-start lg:fixed lg:block lg:w-[260px] lg:overflow-y-auto lg:pr-3`}
            aria-hidden={!isTocOpen}
            style={{ left: 'max(16px, calc((100vw - 1100px) / 2))', top: tocTop, height: tocHeight }}
          >
            <PageToc sections={tocSections} isOpen={isTocOpen} onToggle={() => setIsTocOpen((v) => !v)} className="w-full" />
          </aside>

          <div className="flex flex-col gap-6">
            <PlayersSection
              players={players}
              onAddPlayer={addPlayer}
              onRemovePlayer={removePlayer}
              onRenamePlayer={renamePlayer}
            />

            <RoundsTable
              players={players}
              rounds={rounds}
              scoringMode={scoringMode}
              logicalRoundNumbers={logicalRoundNumbers}
              playerGridTemplate={playerGridTemplate}
              scoreOptions={scoreOptions}
              editingRoundId={editingRoundId}
              editScores={editScores}
              editMahjongSpecial={editMahjongSpecial}
              editMahjongScores={editMahjongScores}
              editMahjongSpecialNote={editMahjongSpecialNote}
              editWinnerDraft={editWinnerDraft}
              editDealerDraft={editDealerDraft}
              editFollowTypeDraft={editFollowTypeDraft}
              editFollowTargetDraft={editFollowTargetDraft}
              editGangDraft={editGangDraft}
              editBuyMaDraft={editBuyMaDraft}
              onUpdateEditScore={updateEditScore}
              onAutoBalanceEdit={autoBalanceEdit}
              onUpdateEditMahjongScore={updateEditMahjongScore}
              onAutoBalanceEditMahjong={autoBalanceEditMahjong}
              onStartEdit={startEdit}
              onCancelEdit={cancelEdit}
              onSaveEdit={saveEdit}
              onDeleteRound={deleteRound}
              onCopyPrevious={copyPrevious}
              setEditMahjongSpecial={setEditMahjongSpecial}
              setEditMahjongSpecialNote={setEditMahjongSpecialNote}
              setEditWinnerDraft={setEditWinnerDraft}
              setEditDealerDraft={setEditDealerDraft}
              setEditFollowTypeDraft={setEditFollowTypeDraft}
              setEditFollowTargetDraft={setEditFollowTargetDraft}
              setEditGangDraft={setEditGangDraft}
              setEditBuyMaDraft={setEditBuyMaDraft}
              mahjongRules={state.mahjongRules}
            />

            <NewRoundSection
              players={players}
              scoringMode={scoringMode}
              scoreOptions={scoreOptions}
              rangeDraft={rangeDraft}
              setRangeDraft={setRangeDraft}
              applyRangeDraft={applyRangeDraft}
              autoBalanceNewRound={autoBalanceNewRound}
              newRoundScores={newRoundScores}
              updateNewRoundScore={updateNewRoundScore}
              mahjongRulesDraft={mahjongRulesDraft}
              setMahjongRulesDraft={setMahjongRulesDraft}
              applyMahjongRules={applyMahjongRules}
              mahjongSpecial={mahjongSpecial}
              setMahjongSpecial={setMahjongSpecial}
              mahjongSpecialScores={mahjongSpecialScores}
              setMahjongSpecialScores={setMahjongSpecialScores}
              updateMahjongSpecialScore={updateMahjongSpecialScore}
              mahjongSpecialNote={mahjongSpecialNote}
              setMahjongSpecialNote={setMahjongSpecialNote}
              autoBalanceMahjongSpecial={autoBalanceMahjongSpecial}
              winnerDraft={winnerDraft}
              setWinnerDraft={setWinnerDraft}
              dealerDraft={dealerDraft}
              setDealerDraft={setDealerDraft}
              followTypeDraft={followTypeDraft}
              setFollowTypeDraft={setFollowTypeDraft}
              followTargetDraft={followTargetDraft}
              setFollowTargetDraft={setFollowTargetDraft}
              gangDraft={gangDraft}
              setGangDraft={setGangDraft}
              buyMaDraft={buyMaDraft}
              setBuyMaDraft={setBuyMaDraft}
              mahjongPreviewScores={mahjongPreviewScores}
              submitNewRound={submitNewRound}
            />

            <TotalsSection
              players={players}
              totals={totals}
              currentMahjongStats={currentMahjongStats}
              leader={leader}
              scoringMode={scoringMode}
            />

            <ScoreChartSection
              players={players}
              rounds={rounds}
              cumulativeSeries={cumulativeSeries}
              showChart={showChart}
              onToggleShow={() => setShowChart((v) => !v)}
              onExportPng={() => exportSvgAsPng(chartRef, 'scores-chart.png')}
              onOpenSvg={() => openSvgInNewTab(chartRef)}
              chartRef={chartRef}
            />

            <CrossSessionOverview
              visible={showCrossOverview || state.sessions.length > 1}
              sessionSort={sessionSort}
              setSessionSort={setSessionSort}
              overviewMetric={overviewMetric}
              setOverviewMetric={setOverviewMetric}
              sessionFilterMode={sessionFilterMode}
              setSessionFilterMode={setSessionFilterMode}
              selectedSessionIds={selectedSessionIds}
              setSelectedSessionIds={setSelectedSessionIds}
              sortedSessions={sortedSessions}
              filteredSessions={filteredSessions}
              allPlayers={allPlayers}
              showCrossChart={showCrossChart}
              setShowCrossChart={setShowCrossChart}
              showCrossTable={showCrossTable}
              setShowCrossTable={setShowCrossTable}
              crossSessionAggregate={crossSessionAggregate}
              crossCumulativeSeries={crossCumulativeSeries}
              exportSvgAsPng={exportSvgAsPng}
              openSvgInNewTab={openSvgInNewTab}
              crossChartRef={crossChartRef}
            />
          </div>
        </div>
      </main>

      <footer className="border-t border-line bg-panel/90">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-2 px-4 py-4 text-xs text-muted">
          <span>赣ICP备2026002780号 · 公网备案暂无</span>
          <a href="https://beian.miit.gov.cn/" target="_blank" rel="noreferrer" className="underline decoration-line hover:text-text">
            工信部备案查询
          </a>
        </div>
      </footer>
    </div>
  )
}

export default App
