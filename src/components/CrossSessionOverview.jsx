import { useMemo } from 'react'

function CrossSessionOverview({
  visible,
  sessionSort,
  setSessionSort,
  overviewMetric,
  setOverviewMetric,
  sessionFilterMode,
  setSessionFilterMode,
  selectedSessionIds,
  setSelectedSessionIds,
  sortedSessions,
  filteredSessions,
  allPlayers,
  showCrossChart,
  setShowCrossChart,
  showCrossTable,
  setShowCrossTable,
  crossSessionAggregate,
  crossCumulativeSeries,
  exportSvgAsPng,
  openSvgInNewTab,
  crossChartRef,
  sectionId = 'cross-overview',
}) {
  const metricLabel = overviewMetric === 'win' ? '赢局数' : overviewMetric === 'hu' ? '胡数（麻将）' : overviewMetric === 'gang' ? '杠数（麻将）' : '总分'

  const metricValuesFor = useMemo(
    () =>
      (session) => {
        if (!session) return []
        if (overviewMetric === 'win') return session.wins ?? []
        if (overviewMetric === 'hu') return session.huCounts ?? []
        if (overviewMetric === 'gang') return session.gangCounts ?? []
        return session.totals ?? []
      },
    [overviewMetric],
  )

  if (!visible) return null

  return (
    <section id={sectionId} className="rounded-xl border border-line bg-panel/90 p-4 shadow-lg shadow-[rgba(0,0,0,0.08)]">
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
          <button
            className="rounded-lg border border-line bg-panel px-3 py-2 text-text hover:border-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 focus-visible:ring-offset-2 focus-visible:ring-offset-panel"
            onClick={() => setShowCrossTable((v) => !v)}
            aria-expanded={showCrossTable}
          >
            {showCrossTable ? '收起跨会话表格' : '展开跨会话表格'}
          </button>
          <button
            className="rounded-lg border border-line bg-panel px-3 py-2 text-text hover:border-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 focus-visible:ring-offset-2 focus-visible:ring-offset-panel disabled:opacity-50"
            onClick={() => exportSvgAsPng(crossChartRef, 'cross-sessions-chart.png')}
            disabled={filteredSessions.length === 0}
          >
            导出 PNG
          </button>
          <button
            className="rounded-lg border border-line bg-panel px-3 py-2 text-text hover:border-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 focus-visible:ring-offset-2 focus-visible:ring-offset-panel disabled:opacity-50"
            onClick={() => openSvgInNewTab(crossChartRef)}
            disabled={filteredSessions.length === 0}
          >
            放大查看
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

      <div className="mb-2 text-xs uppercase tracking-wide text-muted">当前指标：{metricLabel}</div>

      {showCrossTable && (
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
              const metricValues = metricValuesFor(session)
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
              const aggregateValues = metricValuesFor(crossSessionAggregate)
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
      )}

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
                    <svg ref={crossChartRef} viewBox={`0 0 ${width} ${height}`} width={width} height={height} className="w-full max-w-full">
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
  )
}

export default CrossSessionOverview
