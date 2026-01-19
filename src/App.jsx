import { useEffect, useMemo, useRef, useState } from 'react'

const STORAGE_KEY = 'dapai-score-state-v1'
const MAX_PLAYERS = 8
const MIN_PLAYERS = 2
const MAX_HISTORY = 50

const defaultPlayers = ['玩家 A', '玩家 B', '玩家 C', '玩家 D']
const scoreOptions = Array.from({ length: 41 }, (_, i) => i - 20)

function createDefaultState() {
  return {
    players: defaultPlayers,
    rounds: [
      {
        id: 1,
        scores: Array(defaultPlayers.length).fill(0),
      },
    ],
    nextRoundId: 2,
  }
}

function loadInitialState() {
  if (typeof window === 'undefined') return createDefaultState()
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return createDefaultState()

    const parsed = JSON.parse(raw)
    const players = Array.isArray(parsed.players) && parsed.players.length >= MIN_PLAYERS ? parsed.players.slice(0, MAX_PLAYERS) : defaultPlayers

    let rounds = Array.isArray(parsed.rounds) && parsed.rounds.length > 0 ? parsed.rounds : createDefaultState().rounds

    rounds = rounds.map((r, idx) => {
      const id = typeof r.id === 'number' ? r.id : idx + 1
      const scores = Array.isArray(r.scores) ? r.scores.slice(0, players.length) : []
      const padded = [...scores, ...Array(players.length - scores.length).fill(0)]
      return { id, scores: padded }
    })

    if (rounds.length === 0) {
      rounds = createDefaultState().rounds
    }

    const maxId = Math.max(...rounds.map((r) => r.id), 0)

    return {
      players,
      rounds,
      nextRoundId: parsed.nextRoundId ? parsed.nextRoundId : maxId + 1,
    }
  } catch (err) {
    console.warn('Failed to load state, using default', err)
    return createDefaultState()
  }
}

function clampInt(value) {
  const n = Number.parseInt(value, 10)
  return Number.isFinite(n) ? n : 0
}

const csvEscape = (value) => `"${String(value).replace(/"/g, '""')}"`

const formatTimestamp = () => {
  const d = new Date()
  const pad = (n) => n.toString().padStart(2, '0')
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}`
}

function App() {
  const [state, setState] = useState(loadInitialState)
  const historyRef = useRef({ past: [], future: [] })

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  }, [state])

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

  const addRound = () => {
    updateState((prev) => {
      const round = {
        id: prev.nextRoundId,
        scores: Array(prev.players.length).fill(0),
      }
      return {
        ...prev,
        rounds: [...prev.rounds, round],
        nextRoundId: prev.nextRoundId + 1,
      }
    })
  }

  const deleteRound = (id) => {
    updateState((prev) => {
      const rounds = prev.rounds.filter((r) => r.id !== id)
      if (rounds.length === 0) {
        return { ...createDefaultState(), players: prev.players }
      }
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

  const updateScore = (roundId, playerIndex, value) => {
    updateState((prev) => {
      const rounds = prev.rounds.map((r) =>
        r.id === roundId ? { ...r, scores: r.scores.map((s, i) => (i === playerIndex ? value : s)) } : r,
      )
      return { ...prev, rounds }
    })
  }

  const autoBalance = (roundId) => {
    updateState((prev) => {
      const rounds = prev.rounds.map((r) => {
        if (r.id !== roundId) return r
        if (r.scores.length === 0) return r
        const sumExcludingLast = r.scores.slice(0, -1).reduce((acc, v) => acc + clampInt(v), 0)
        const scores = r.scores.map((v, idx) => (idx === r.scores.length - 1 ? -sumExcludingLast : clampInt(v)))
        return { ...r, scores }
      })
      return { ...prev, rounds }
    })
  }

  const clearAll = () => {
    const ok = window.confirm('确定要清空所有数据吗？此操作不可撤销。')
    if (!ok) return
    updateState(() => createDefaultState())
  }

  const totals = useMemo(() => {
    return state.players.map((_, idx) => state.rounds.reduce((acc, r) => acc + clampInt(r.scores[idx]), 0))
  }, [state.players, state.rounds])

  const leader = Math.max(...totals)
  const exportCsv = () => {
    const rows = []
    rows.push(['Generated At', new Date().toISOString()])
    rows.push(['Players', ...state.players])
    rows.push(['Round', ...state.players, 'Sum'])

    state.rounds.forEach((round, idx) => {
      const scores = round.scores.map((s) => clampInt(s))
      const sum = scores.reduce((acc, v) => acc + v, 0)
      rows.push([idx + 1, ...scores, sum])
    })

    rows.push(['Total', ...totals])

    const csv = rows.map((row) => row.map(csvEscape).join(',')).join('\r\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `scores-${formatTimestamp()}.csv`
    link.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="min-h-screen bg-surface text-slate-100">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-20 focus:rounded-md focus:bg-accent focus:px-3 focus:py-2 focus:text-slate-900"
      >
        跳转到主要内容
      </a>
      <header className="sticky top-0 z-10 border-b border-slate-800 bg-panel/80 backdrop-blur-sm">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-4">
          <div className="flex flex-col gap-1">
            <p className="text-xs uppercase tracking-[0.2em] text-muted">Score Tracker</p>
            <h1 className="text-xl font-semibold">打牌积分表单</h1>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <button
              className="rounded-lg border border-slate-700 bg-panel px-3 py-2 text-slate-100 hover:border-slate-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/70 focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
              onClick={clearAll}
            >
              清空（需确认）
            </button>
            <button
              className="rounded-lg border border-slate-700 bg-panel px-3 py-2 text-slate-100 hover:border-slate-500 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/70 focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
              onClick={undo}
              disabled={historyRef.current.past.length === 0}
            >
              撤销
            </button>
            <button
              className="rounded-lg border border-slate-700 bg-panel px-3 py-2 text-slate-100 hover:border-slate-500 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/70 focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
              onClick={redo}
              disabled={historyRef.current.future.length === 0}
            >
              重做
            </button>
            <button
              className="rounded-lg bg-accent px-3 py-2 font-semibold text-slate-900 hover:brightness-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
              onClick={exportCsv}
            >
              导出 CSV
            </button>
          </div>
        </div>
      </header>

      <main id="main-content" className="mx-auto flex max-w-5xl flex-col gap-6 px-4 py-6">
        <section className="rounded-xl border border-slate-800 bg-panel/80 p-4 shadow-lg shadow-slate-950/50">
          <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold">玩家</h2>
              <p className="text-sm text-muted">默认 4 人，最多 8 人；可重命名，至少保留 2 人。</p>
            </div>
            <button
              className="rounded-lg border border-slate-700 px-3 py-2 text-sm text-slate-100 hover:border-slate-500 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/70 focus-visible:ring-offset-2 focus-visible:ring-offset-panel"
              onClick={addPlayer}
              disabled={state.players.length >= MAX_PLAYERS}
            >
              添加玩家
            </button>
          </div>
          <div className="flex flex-wrap gap-3">
            {state.players.map((player, idx) => (
              <div key={idx} className="flex items-center gap-2 rounded-lg border border-slate-800 bg-slate-900 px-3 py-2">
                <input
                  aria-label={`玩家名称 ${idx + 1}`}
                  className="w-28 rounded-md border border-slate-700 bg-panel px-2 py-1 text-sm focus:border-accent focus:outline-none"
                  value={player}
                  onChange={(e) => renamePlayer(idx, e.target.value)}
                />
                <button
                  className="text-xs text-muted hover:text-slate-100 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/70 focus-visible:ring-offset-2 focus-visible:ring-offset-panel"
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

        <section className="rounded-xl border border-slate-800 bg-panel/80 p-4 shadow-lg shadow-slate-950/50">
          <div className="mb-3 flex items-center justify-between gap-2">
            <div>
              <h2 className="text-lg font-semibold">对局记录</h2>
              <p className="text-sm text-muted">每行一局，分值和必须为 0；可自动平衡、复制上一行。</p>
            </div>
            <button
              className="rounded-lg bg-accent px-3 py-2 text-sm font-semibold text-slate-900 hover:brightness-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 focus-visible:ring-offset-2 focus-visible:ring-offset-panel"
              onClick={addRound}
            >
              新增一局
            </button>
          </div>

          <div className="overflow-auto rounded-lg border border-slate-800" role="table" aria-label="对局记录">
            <div className="min-w-[720px]">
              <div className="flex items-center bg-slate-900 px-3 py-2 text-xs uppercase tracking-wide text-muted" role="row">
                <div className="w-14 flex-shrink-0" role="columnheader">局号</div>
                <div className="flex flex-1 items-center gap-3" role="rowheader">
                  {state.players.map((name) => (
                    <div key={name} className="min-w-[160px] flex-shrink-0" role="columnheader">
                      {name}
                    </div>
                  ))}
                </div>
                <div className="w-40 flex-shrink-0 text-right" role="columnheader">
                  操作
                </div>
              </div>

              {state.rounds.map((round, rowIndex) => {
                const sum = round.scores.reduce((acc, v) => acc + clampInt(v), 0)
                const invalid = sum !== 0
                return (
                  <div
                    key={round.id}
                    className={`border-t border-slate-800 px-3 py-3 text-sm ${invalid ? 'bg-red-950/20 border-red-700' : 'bg-panel/60'}`}
                    role="row"
                    aria-label={`第 ${rowIndex + 1} 局，${invalid ? '未平衡' : '已平衡'}`}
                  >
                    <div className="flex items-start gap-3">
                      <div className="w-14 flex-shrink-0 pt-1 text-muted">#{rowIndex + 1}</div>
                      <div className="flex flex-1 flex-col gap-3">
                        {state.players.map((_, playerIndex) => {
                          const value = clampInt(round.scores[playerIndex])
                          return (
                            <div key={playerIndex} className="rounded-lg border border-slate-800 bg-slate-900/60 p-3" role="cell">
                              <label className="flex items-center gap-2 text-sm text-muted" htmlFor={`score-${round.id}-${playerIndex}`}>
                                分值
                                <select
                                  id={`score-${round.id}-${playerIndex}`}
                                  aria-label={`第 ${rowIndex + 1} 局，玩家 ${state.players[playerIndex]}`}
                                  aria-invalid={invalid}
                                  className="w-28 rounded-md border border-slate-700 bg-panel px-2 py-1 text-sm text-slate-100 focus:border-accent focus:outline-none"
                                  value={value}
                                  onChange={(e) => updateScore(round.id, playerIndex, clampInt(e.target.value))}
                                >
                                  {scoreOptions.map((opt) => (
                                    <option key={opt} value={opt}>
                                      {opt}
                                    </option>
                                  ))}
                                </select>
                              </label>
                            </div>
                          )
                        })}
                        <div className="flex flex-wrap items-center gap-2 text-xs text-muted" aria-live="polite">
                          <span
                            className={`rounded-full px-2 py-1 ${invalid ? 'bg-red-900/50 text-red-100' : 'bg-slate-800 text-slate-200'}`}
                            aria-label={`本局合计 ${sum}`}
                          >
                            本局合计：{sum}
                          </span>
                          {invalid && <span className="text-red-200">需平衡到 0</span>}
                        </div>
                      </div>

                      <div className="w-40 flex-shrink-0 space-y-2 text-right text-xs">
                        <button
                          className="w-full rounded-md border border-slate-700 bg-slate-800 px-2 py-1 hover:border-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/70"
                          aria-label={`自动平衡第 ${rowIndex + 1} 局`}
                          onClick={() => autoBalance(round.id)}
                        >
                          自动平衡
                        </button>
                        <button
                          className="w-full rounded-md border border-slate-700 bg-slate-800 px-2 py-1 hover:border-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/70 disabled:opacity-50"
                          aria-label={`复制第 ${rowIndex} 局到当前`}
                          onClick={() => copyPrevious(round.id)}
                          disabled={rowIndex === 0}
                        >
                          复制上一行
                        </button>
                        <button
                          className="w-full rounded-md border border-slate-700 bg-slate-800 px-2 py-1 hover:border-red-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400"
                          aria-label={`删除第 ${rowIndex + 1} 局`}
                          onClick={() => deleteRound(round.id)}
                        >
                          删除本局
                        </button>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </section>

        <section className="grid gap-4 lg:grid-cols-[2fr_1fr]">
          <div className="rounded-xl border border-slate-800 bg-panel/80 p-4 shadow-lg shadow-slate-950/50">
            <h2 className="text-lg font-semibold">总分</h2>
            <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
              {state.players.map((name, idx) => {
                const score = totals[idx]
                const leading = score === leader && totals.some((t) => t !== leader)
                return (
                  <div
                    key={name}
                    className="rounded-lg border border-slate-800 bg-slate-900/80 px-3 py-3"
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
          <div className="rounded-xl border border-slate-800 bg-panel/80 p-4 shadow-lg shadow-slate-950/50">
            <h2 className="text-lg font-semibold">提示</h2>
            <ul className="mt-2 space-y-2 text-sm text-muted">
              <li>每局必须平衡为 0，使用“自动平衡”快速填补最后一位。</li>
              <li>每格使用下拉选择 -20~20 的分值，保持分值整数输入。</li>
              <li>支持撤销/重做（最多 50 步）；清空前需确认；数据自动保存到本地。</li>
            </ul>
          </div>
        </section>
      </main>

      <button
        className="fixed bottom-6 right-6 rounded-full bg-accent px-4 py-3 text-sm font-semibold text-slate-900 shadow-lg shadow-accent/40 hover:brightness-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
        onClick={addRound}
        aria-label="新增一局"
      >
        + 新增一局
      </button>
    </div>
  )
}

export default App
