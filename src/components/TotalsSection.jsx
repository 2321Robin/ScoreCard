function TotalsSection({ players, totals, currentMahjongStats, doudizhuStats = { landlordWins: [], farmerWins: [] }, leader, scoringMode, sectionId = 'totals' }) {
  return (
    <section id={sectionId} className="rounded-xl border border-line bg-panel/90 p-4 shadow-lg shadow-[rgba(0,0,0,0.08)]">
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
              {scoringMode === 'doudizhu' && (doudizhuStats.landlordWins[idx] > 0 || doudizhuStats.farmerWins[idx] > 0) && (
                <div className="mt-1 text-xs text-muted">地主赢 {doudizhuStats.landlordWins[idx]} · 农民赢 {doudizhuStats.farmerWins[idx]}</div>
              )}
              {scoringMode === 'standard' && wins > 0 && (
                <div className="mt-1 text-xs text-muted">赢 {wins} 局</div>
              )}
            </div>
          )
        })}
      </div>
    </section>
  )
}

export default TotalsSection
