import { MIN_PLAYERS, MAX_PLAYERS } from '../lib/constants'

function PlayersSection({ players, onAddPlayer, onRemovePlayer, onRenamePlayer, sectionId = 'players' }) {
  return (
    <section id={sectionId} className="rounded-xl border border-line bg-panel/90 p-4 shadow-lg shadow-[rgba(0,0,0,0.08)]">
      <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold">玩家</h2>
          <p className="text-sm text-muted">默认 4 人，最多 8 人；可重命名，至少保留 2 人。</p>
        </div>
        <button
          className="rounded-lg border border-line px-3 py-2 text-sm text-text hover:border-accent disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 focus-visible:ring-offset-2 focus-visible:ring-offset-panel"
          onClick={onAddPlayer}
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
              onChange={(e) => onRenamePlayer(idx, e.target.value)}
            />
            <button
              className="text-xs text-muted hover:text-text disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 focus-visible:ring-offset-2 focus-visible:ring-offset-panel"
              onClick={() => onRemovePlayer(idx)}
              disabled={players.length <= MIN_PLAYERS}
              title="删除玩家"
            >
              删除
            </button>
          </div>
        ))}
      </div>
    </section>
  )
}

export default PlayersSection
