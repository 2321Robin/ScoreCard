function ScoreChartSection({ players, rounds, cumulativeSeries, showChart, onToggleShow, onExportPng, onOpenSvg, chartRef, sectionId = 'score-chart' }) {
  return (
    <section id={sectionId} className="rounded-xl border border-line bg-panel/90 p-4 shadow-lg shadow-[rgba(0,0,0,0.08)]">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">分数变化折线图</h2>
          <p className="text-sm text-muted">展示每位玩家的累计总分随对局的变化，便于对局过长时快速查看走势。</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            className="rounded-lg border border-line bg-panel px-3 py-2 text-sm text-text hover:border-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 focus-visible:ring-offset-2 focus-visible:ring-offset-panel"
            onClick={onToggleShow}
            aria-expanded={showChart}
          >
            {showChart ? '收起折线图' : '展开折线图'}
          </button>
          <button
            className="rounded-lg border border-line bg-panel px-3 py-2 text-sm text-text hover:border-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 focus-visible:ring-offset-2 focus-visible:ring-offset-panel disabled:opacity-50"
            onClick={onExportPng}
            disabled={rounds.length === 0}
          >
            导出 PNG
          </button>
          <button
            className="rounded-lg border border-line bg-panel px-3 py-2 text-sm text-text hover:border-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 focus-visible:ring-offset-2 focus-visible:ring-offset-panel disabled:opacity-50"
            onClick={onOpenSvg}
            disabled={rounds.length === 0}
          >
            放大查看
          </button>
        </div>
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
                    <svg ref={chartRef} viewBox={`0 0 ${width} ${height}`} width={width} height={height} className="w-full max-w-full">
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
  )
}

export default ScoreChartSection
