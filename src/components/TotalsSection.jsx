function TotalsSection({ players, totals, currentMahjongStats, leader, scoringMode, sectionId = 'totals' }) {
  return (
    <section id={sectionId} className="grid gap-4 lg:grid-cols-[2fr_1fr]">
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
  )
}

export default TotalsSection
