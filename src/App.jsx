import { useEffect, useMemo, useRef, useState } from 'react'

const STORAGE_KEY = 'dapai-score-state-v1'
const MAX_PLAYERS = 8
const MIN_PLAYERS = 2
const MAX_HISTORY = 50

const defaultPlayers = ['玩家 A', '玩家 B', '玩家 C', '玩家 D']
const clampInt = (value) => {
  const n = Number.parseInt(value, 10)
  return Number.isFinite(n) ? n : 0
}

function createDefaultState() {
  return {
    players: defaultPlayers,
    rounds: [],
    nextRoundId: 1,
    targetRounds: '',
  }
}

function loadInitialState() {
  if (typeof window === 'undefined') return createDefaultState()
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return createDefaultState()

    const parsed = JSON.parse(raw)
    const players = Array.isArray(parsed.players) && parsed.players.length >= MIN_PLAYERS ? parsed.players.slice(0, MAX_PLAYERS) : defaultPlayers

    let rounds = Array.isArray(parsed.rounds) ? parsed.rounds : []

    rounds = rounds.map((r, idx) => {
      const id = typeof r.id === 'number' ? r.id : idx + 1
      const scores = Array.isArray(r.scores) ? r.scores.slice(0, players.length) : []
      const padded = [...scores, ...Array(players.length - scores.length).fill(0)]
      return { id, scores: padded }
    })
    const maxId = Math.max(...rounds.map((r) => r.id), 0)

    return {
      players,
      rounds,
      nextRoundId: parsed.nextRoundId ? parsed.nextRoundId : maxId + 1,
      targetRounds: typeof parsed.targetRounds === 'number' || typeof parsed.targetRounds === 'string' ? parsed.targetRounds : '',
    }
  } catch (err) {
    console.warn('Failed to load state, using default', err)
    return createDefaultState()
  }
}
const ensureLength = (arr, target, fill = 0) => {
  const next = arr.slice(0, target)
  if (next.length < target) {
    next.push(...Array(target - next.length).fill(fill))
  }
  return next
}

const csvEscape = (value) => `"${String(value).replace(/"/g, '""')}"`

const splitCsvLine = (line) => {
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

const formatTimestamp = () => {
  const d = new Date()
  const pad = (n) => n.toString().padStart(2, '0')
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}`
}

const parseImportedCsv = (text) => {
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

function App() {
  const [state, setState] = useState(loadInitialState)
  const [scoreRange, setScoreRange] = useState({ min: -10, max: -1 })
  const [rangeDraft, setRangeDraft] = useState({ min: '-10', max: '-1' })
  const [newRoundScores, setNewRoundScores] = useState([])
  const [editingRoundId, setEditingRoundId] = useState(null)
  const [editScores, setEditScores] = useState([])
  const [showChart, setShowChart] = useState(true)
  const [targetDraft, setTargetDraft] = useState('')
  const fileInputRef = useRef(null)
  const historyRef = useRef({ past: [], future: [] })
  const autoExportTriggeredRef = useRef(null)

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
    setNewRoundScores((prev) => ensureLength(prev, state.players.length, ''))
    if (editingRoundId !== null) {
      setEditScores((prev) => ensureLength(prev, state.players.length, ''))
    }
  }, [state.players.length, editingRoundId])

  useEffect(() => {
    setTargetDraft(state.targetRounds === '' ? '' : String(state.targetRounds))
  }, [state.targetRounds])

  const updateState = (producer) => {
    setState((current) => {
      const next = producer(current)
      const past = [...historyRef.current.past, current].slice(-(MAX_HISTORY - 1))
      historyRef.current = { past, future: [] }
      return next
    })
  }

  const undo = () => {
    setState((current) => {
      const past = historyRef.current.past
      if (past.length === 0) return current
      const previous = past[past.length - 1]
      const future = [current, ...historyRef.current.future].slice(0, MAX_HISTORY)
      historyRef.current = { past: past.slice(0, -1), future }
      return previous
    })
  }

  const redo = () => {
    setState((current) => {
      const future = historyRef.current.future
      if (future.length === 0) return current
      const next = future[0]
      const past = [...historyRef.current.past, current].slice(-(MAX_HISTORY - 1))
      historyRef.current = { past, future: future.slice(1) }
      return next
    })
  }

  const addPlayer = () => {
    if (state.players.length >= MAX_PLAYERS) return
    updateState((prev) => {
      const name = `玩家 ${String.fromCharCode(65 + prev.players.length)}`
      const players = [...prev.players, name]
      const rounds = prev.rounds.map((r) => ({ ...r, scores: [...r.scores, 0] }))
      return { ...prev, players, rounds }
    })
  }

  const removePlayer = (index) => {
    if (state.players.length <= MIN_PLAYERS) return
    updateState((prev) => {
      const players = prev.players.filter((_, i) => i !== index)
      const rounds = prev.rounds.map((r) => ({ ...r, scores: r.scores.filter((_, i) => i !== index) }))
      return { ...prev, players, rounds }
    })
  }

  const renamePlayer = (index, name) => {
    updateState((prev) => {
      const players = prev.players.map((p, i) => (i === index ? name : p))
      return { ...prev, players }
    })
  }

  const addRoundWithScores = (scores = []) => {
    updateState((prev) => {
      const padded = ensureLength(scores, prev.players.length, '').map(clampInt)
      const round = {
        id: prev.nextRoundId,
        scores: padded,
      }
      return {
        ...prev,
        rounds: [...prev.rounds, round],
        nextRoundId: prev.nextRoundId + 1,
      }
    })
  }

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
    addRoundWithScores(newRoundScores)
    setNewRoundScores(Array(state.players.length).fill(''))
  }

  const applyTargetRounds = () => {
    const target = Number.parseInt(targetDraft, 10)
    if (!Number.isFinite(target) || target <= 0) {
      updateState((prev) => ({ ...prev, targetRounds: '' }))
      setTargetDraft('')
      return
    }
    if (target <= state.rounds.length) {
      window.alert('目标局数需大于当前已记录局数')
      return
    }
    autoExportTriggeredRef.current = null
    updateState((prev) => ({ ...prev, targetRounds: target }))
  }

  const deleteRound = (id) => {
    if (editingRoundId === id) {
      cancelEdit()
    }
    updateState((prev) => {
      const rounds = prev.rounds.filter((r) => r.id !== id)
      return { ...prev, rounds }
    })
  }

  const copyPrevious = (id) => {
    updateState((prev) => {
      const idx = prev.rounds.findIndex((r) => r.id === id)
      const source = prev.rounds[idx - 1] ?? prev.rounds[idx]
      const copy = { ...source, id }
      const rounds = prev.rounds.map((r) => (r.id === id ? copy : r))
      return { ...prev, rounds }
    })
  }

  const startEdit = (round) => {
    setEditingRoundId(round.id)
    setEditScores(ensureLength(round.scores.map((s) => String(clampInt(s))), state.players.length, ''))
  }

  const cancelEdit = () => {
    setEditingRoundId(null)
    setEditScores([])
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
    const normalized = ensureLength(editScores, state.players.length, '').map(clampInt)
    updateState((prev) => {
      const rounds = prev.rounds.map((r) => (r.id === editingRoundId ? { ...r, scores: normalized } : r))
      return { ...prev, rounds }
    })
    cancelEdit()
  }

  const clearAll = () => {
    const ok = window.confirm('确定要清空所有数据吗？此操作不可撤销。')
    if (!ok) return
    updateState(() => createDefaultState())
  }

  const totals = useMemo(() => {
    return state.players.map((_, idx) => state.rounds.reduce((acc, r) => acc + clampInt(r.scores[idx]), 0))
  }, [state.players, state.rounds])

  const playerGridTemplate = useMemo(() => `repeat(${state.players.length}, minmax(140px, 1fr))`, [state.players.length])

  const cumulativeSeries = useMemo(() => {
    const series = state.players.map(() => [{ round: 0, value: 0 }])
    const running = Array(state.players.length).fill(0)

    state.rounds.forEach((round, idx) => {
      round.scores.forEach((s, i) => {
        running[i] += clampInt(s)
        series[i].push({ round: idx + 1, value: running[i] })
      })
    })
    return series
  }, [state.players, state.rounds])

  const leader = Math.max(...totals)
  const exportCsv = () => {
    const rows = []
    rows.push(['Generated At', new Date().toISOString()])
    rows.push(['Round', ...state.players, ...state.players.map((p) => `${p} 累计总分`)])

    let cumulative = Array(state.players.length).fill(0)
    state.rounds.forEach((round, idx) => {
      const scores = round.scores.map((s) => clampInt(s))
      cumulative = cumulative.map((acc, i) => acc + scores[i])
      rows.push([idx + 1, ...scores, ...cumulative])
    })

    rows.push(['Total', ...totals, ...totals])

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

  useEffect(() => {
    const target = Number.parseInt(state.targetRounds, 10)
    if (!Number.isFinite(target) || target <= 0) return
    if (state.rounds.length >= target && autoExportTriggeredRef.current !== target) {
      autoExportTriggeredRef.current = target
      exportCsv()
      const nextInput = window.prompt(
        `已达到设定的 ${target} 局，是否继续？输入新的总局数继续，留空或取消则不再提醒。`,
        String(target + 1),
      )
      const nextTarget = Number.parseInt(nextInput ?? '', 10)
      if (Number.isFinite(nextTarget) && nextTarget > state.rounds.length) {
        autoExportTriggeredRef.current = null
        updateState((prev) => ({ ...prev, targetRounds: nextTarget }))
      } else {
        updateState((prev) => ({ ...prev, targetRounds: '' }))
      }
    }
  }, [state.rounds.length, state.targetRounds])

  const handleImportFile = async (file) => {
    try {
      const text = await file.text()
      const { players, rounds } = parseImportedCsv(text)
      updateState(() => ({ players, rounds, nextRoundId: rounds.length + 1, targetRounds: '' }))
      setEditingRoundId(null)
      setEditScores([])
      setNewRoundScores(Array(players.length).fill(''))
      alert('导入成功')
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
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-4 text-text">
          <div className="flex flex-col gap-1">
            <p className="text-xs uppercase tracking-[0.2em] text-muted">Score Tracker</p>
            <h1 className="text-xl font-semibold">打牌积分表单</h1>
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
            <button
              className="rounded-lg border border-line bg-panel px-3 py-2 text-text hover:border-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
              onClick={clearAll}
            >
              清空（需确认）
            </button>
            <button
              className="rounded-lg border border-line bg-panel px-3 py-2 text-text hover:border-accent disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
              onClick={undo}
              disabled={historyRef.current.past.length === 0}
            >
              撤销
            </button>
            <button
              className="rounded-lg border border-line bg-panel px-3 py-2 text-text hover:border-accent disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
              onClick={redo}
              disabled={historyRef.current.future.length === 0}
            >
              重做
            </button>
            <button
              className="rounded-lg bg-accent px-3 py-2 font-semibold text-text hover:brightness-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
              onClick={exportCsv}
            >
              导出 CSV
            </button>
            <button
              className="rounded-lg border border-line bg-panel px-3 py-2 text-text hover:border-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
              onClick={triggerImport}
            >
              导入 CSV
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
              disabled={state.players.length >= MAX_PLAYERS}
            >
              添加玩家
            </button>
          </div>
          <div className="flex flex-wrap gap-3">
            {state.players.map((player, idx) => (
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
                  disabled={state.players.length <= MIN_PLAYERS}
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
                  {state.players.map((name) => (
                    <div key={name} className="min-w-[140px] px-3 text-center" role="columnheader">
                      {name}
                    </div>
                  ))}
                </div>
                <div className="w-40 flex-shrink-0 text-center" role="columnheader">
                  操作
                </div>
              </div>

              {state.rounds.map((round, rowIndex) => {
                const currentScores = ensureLength(
                  editingRoundId === round.id ? editScores : round.scores,
                  state.players.length,
                  '',
                )
                const sum = currentScores.reduce((acc, v) => acc + clampInt(v), 0)
                const invalid = sum !== 0
                const isEditing = editingRoundId === round.id

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
                          {state.players.map((name, playerIndex) => {
                            const valueRaw = currentScores[playerIndex] ?? ''
                            const valueNumber = clampInt(valueRaw)
                            return (
                              <div
                                key={playerIndex}
                                className="rounded-lg border border-line bg-panel p-3 text-center"
                                role="cell"
                              >
                                {isEditing ? (
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
                        <div className="flex flex-wrap items-center gap-2 text-xs text-muted" aria-live="polite">
                          {invalid && <span className="rounded-full bg-red-100 px-2 py-1 text-danger">需平衡到 0</span>}
                        </div>
                      </div>

                      <div className="w-40 flex-shrink-0 space-y-2 text-right text-xs">
                        {isEditing ? (
                          <>
                            <button
                              className="w-full rounded-md border border-line bg-panel px-2 py-1 hover:border-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
                              aria-label={`自动平衡第 ${rowIndex + 1} 局`}
                              onClick={autoBalanceEdit}
                            >
                              自动平衡
                            </button>
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

        <section className="grid gap-4 lg:grid-cols-[2fr_1fr]">
          <div className="rounded-xl border border-line bg-panel/90 p-4 shadow-lg shadow-[rgba(0,0,0,0.08)]">
            <h2 className="text-lg font-semibold">总分</h2>
            <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
              {state.players.map((name, idx) => {
                const score = totals[idx]
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
          <div className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold">新增一局</h2>
              <p className="text-sm text-muted">在此填写分值并添加；如需调整已存在的记录，请在下方列表中点击编辑。</p>
            </div>
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
          </div>

          <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
            {state.players.map((name, idx) => (
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
              {state.rounds.length === 0 ? (
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
                {state.players.map((name, idx) => {
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
      </main>
    </div>
  )
}

export default App
