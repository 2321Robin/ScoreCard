import { clampInt, ensureLength } from '../lib/helpers'
import { computeMahjongScores, normalizeGangs } from '../lib/mahjong'
import { applyBuyMaAdjustment, applyFollowDealerAdjustment } from '../lib/mahjongAdjustments'

function RoundsTable({
  sectionId = 'rounds',
  players,
  rounds,
  scoringMode,
  logicalRoundNumbers,
  playerGridTemplate,
  scoreOptions,
  editingRoundId,
  editScores,
  editMahjongSpecial,
  editMahjongScores,
  editMahjongSpecialNote,
  editWinnerDraft,
  editDealerDraft,
  editFollowTypeDraft,
  editFollowTargetDraft,
  editGangDraft,
  editBuyMaDraft,
  onUpdateEditScore,
  onAutoBalanceEdit,
  onUpdateEditMahjongScore,
  onAutoBalanceEditMahjong,
  onStartEdit,
  onCancelEdit,
  onSaveEdit,
  onDeleteRound,
  onCopyPrevious,
  setEditMahjongSpecial,
  setEditMahjongSpecialNote,
  setEditWinnerDraft,
  setEditDealerDraft,
  setEditFollowTypeDraft,
  setEditFollowTargetDraft,
  setEditGangDraft,
  setEditBuyMaDraft,
  mahjongRules,
}) {
  return (
    <section id={sectionId} className="rounded-xl border border-line bg-panel/90 p-4 shadow-lg shadow-[rgba(0,0,0,0.08)]">
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
            const editingMahjongSpecial = editingMahjong && editMahjongSpecial
            const logicalNumber = logicalRoundNumbers[rowIndex]
            const rowLabel = logicalNumber ? `第 ${logicalNumber} 局` : '特殊补充局'
            const mahjongEditScores = editingMahjong
              ? editingMahjongSpecial
                ? ensureLength(editMahjongScores, players.length, '')
                : (() => {
                    const base = computeMahjongScores({
                      playersCount: players.length,
                      winnerIndex: editWinnerDraft,
                      gangDraft: normalizeGangs(editGangDraft, players.length),
                      rules: mahjongRules,
                    })
                    const afterBuyMa = applyBuyMaAdjustment({
                      scores: base,
                      buyMa: editBuyMaDraft,
                      winnerIndex: editWinnerDraft,
                      playersCount: players.length,
                    })
                    return applyFollowDealerAdjustment({
                      scores: afterBuyMa,
                      followType: editFollowTypeDraft,
                      followTarget: editFollowTargetDraft,
                      dealerIndex: editDealerDraft,
                      playersCount: players.length,
                    })
                  })()
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
                aria-label={`${rowLabel}，${invalid ? '未平衡' : '已平衡'}`}
              >
                <div className="flex items-start gap-3">
                  <div className="w-14 flex-shrink-0 pt-1 text-muted">{logicalNumber ? `#${logicalNumber}` : '补充'}</div>
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
                              editingMahjongSpecial ? (
                                <div className="flex flex-col gap-2 text-sm text-muted">
                                  <label className="sr-only" htmlFor={`mahjong-score-${round.id}-${playerIndex}`}>
                                    {`${rowLabel}，玩家 ${name} 分值`}
                                  </label>
                                  <input
                                    id={`mahjong-score-${round.id}-${playerIndex}`}
                                    aria-label={`${rowLabel}，玩家 ${name}`}
                                    aria-invalid={invalid}
                                    type="text"
                                    inputMode="numeric"
                                    className="w-full rounded-md border border-line bg-panel px-2 py-1 text-sm text-text focus:border-accent focus:outline-none"
                                    value={valueRaw}
                                    onChange={(e) => onUpdateEditMahjongScore(playerIndex, e.target.value)}
                                  />
                                </div>
                              ) : (
                                <div className="flex flex-col items-center justify-center gap-1 text-sm text-muted" aria-label={`${name} 当前计算分值 ${valueNumber}`}>
                                  <div className="text-lg font-semibold text-text">{valueNumber}</div>
                                  <div className="text-xs">由胡/杠自动计算</div>
                                </div>
                              )
                            ) : isEditing ? (
                              <div className="flex flex-col gap-2 text-sm text-muted">
                                <label className="sr-only" htmlFor={`score-${round.id}-${playerIndex}`}>
                                  {`${rowLabel}，玩家 ${name} 分值`}
                                </label>
                                <input
                                  id={`score-${round.id}-${playerIndex}`}
                                  aria-label={`${rowLabel}，玩家 ${name}`}
                                  aria-invalid={invalid}
                                  type="text"
                                  inputMode="numeric"
                                  className="w-full rounded-md border border-line bg-panel px-2 py-1 text-sm text-text focus:border-accent focus:outline-none"
                                  value={valueRaw}
                                  onChange={(e) => onUpdateEditScore(playerIndex, e.target.value)}
                                />
                                <select
                                  aria-label={`从下拉选择分值，玩家 ${name}`}
                                  className="w-full rounded-md border border-line bg-panel px-2 py-1 pr-10 text-sm text-text focus:border-accent focus:outline-none"
                                  value=""
                                  onChange={(e) => onUpdateEditScore(playerIndex, e.target.value)}
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
                        <div className="flex flex-col gap-2 text-text">
                          <div className="font-medium">编辑麻将结果</div>
                          <label className="flex items-center gap-2 text-sm text-muted">
                            <input
                              type="checkbox"
                              className="accent-accent"
                              checked={editMahjongSpecial}
                              onChange={(e) => {
                                const checked = e.target.checked
                                setEditMahjongSpecial(checked)
                                if (checked) {
                                  const base = ensureLength(mahjongEditScores ?? round.scores, players.length, '')
                                  setEditMahjongScores(base.map((v) => String(clampInt(v))))
                                  setEditBuyMaDraft(0)
                                  setEditDealerDraft(0)
                                  setEditFollowTypeDraft('none')
                                  setEditFollowTargetDraft(null)
                                }
                                if (!checked) {
                                  setEditMahjongSpecialNote('')
                                  setEditDealerDraft(Number.isInteger(round.dealer) ? round.dealer : 0)
                                  setEditFollowTypeDraft(round.followType === 'all' || round.followType === 'single' ? round.followType : 'none')
                                  setEditFollowTargetDraft(Number.isInteger(round.followTarget) ? round.followTarget : null)
                                }
                              }}
                            />
                            <span>特殊局：手动分数，不按胡/杠自动计算</span>
                          </label>
                          {editMahjongSpecial && (
                            <label className="flex flex-col gap-1 text-sm text-muted">
                              <span>备注（可选）</span>
                              <input
                                type="text"
                                className="rounded-md border border-line bg-panel px-2 py-1 text-text focus:border-accent focus:outline-none"
                                value={editMahjongSpecialNote}
                                maxLength={80}
                                onChange={(e) => setEditMahjongSpecialNote(e.target.value)}
                                aria-label="特殊局备注"
                              />
                            </label>
                          )}
                          <div className="text-xs text-muted">仍可记录胡/杠信息用于统计；未勾选时上方分数将按规则即时计算。</div>
                        </div>
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
                          {!editMahjongSpecial && (
                            <label className="flex flex-col gap-1">
                              <span>庄家</span>
                              <select
                                className="rounded-md border border-line bg-panel px-2 py-1 text-text focus:border-accent focus:outline-none"
                                value={editDealerDraft}
                                onChange={(e) => {
                                  const v = Number.parseInt(e.target.value, 10)
                                  setEditDealerDraft(Number.isFinite(v) ? Math.max(0, Math.min(players.length - 1, v)) : 0)
                                }}
                              >
                                {players.map((name, idx) => (
                                  <option key={name} value={idx}>
                                    {name}
                                  </option>
                                ))}
                              </select>
                            </label>
                          )}
                          {!editMahjongSpecial && (
                            <label className="flex flex-col gap-1">
                              <span>跟庄</span>
                              <select
                                className="rounded-md border border-line bg-panel px-2 py-1 text-text focus:border-accent focus:outline-none disabled:opacity-50"
                                value={editFollowTypeDraft}
                                disabled={players.length !== 4}
                                onChange={(e) => {
                                  const v = e.target.value
                                  setEditFollowTypeDraft(v === 'all' || v === 'single' ? v : 'none')
                                }}
                              >
                                <option value="none">无</option>
                                <option value="all">庄家给其它三人各出 1 分</option>
                                <option value="single">庄家给某个人出 3 分</option>
                              </select>
                              {editFollowTypeDraft === 'single' && players.length === 4 && (
                                <select
                                  className="mt-1 rounded-md border border-line bg-panel px-2 py-1 text-text focus:border-accent focus:outline-none"
                                  value={editFollowTargetDraft ?? ''}
                                  onChange={(e) => {
                                    const v = e.target.value === '' ? null : Number.parseInt(e.target.value, 10)
                                    setEditFollowTargetDraft(Number.isFinite(v) ? v : null)
                                  }}
                                >
                                  <option value="">选择被出 3 分的玩家</option>
                                  {players.map((name, idx) => (
                                    <option key={name} value={idx} disabled={idx === editDealerDraft}>
                                      {name}
                                    </option>
                                  ))}
                                </select>
                              )}
                              {players.length !== 4 && <span className="text-xs text-muted">仅 4 人局可跟庄</span>}
                            </label>
                          )}
                          {!editMahjongSpecial && (
                            <label className="flex flex-col gap-1">
                              <span>买码（0-4）</span>
                              <select
                                className="rounded-md border border-line bg-panel px-2 py-1 text-text focus:border-accent focus:outline-none disabled:opacity-50"
                                value={editBuyMaDraft}
                                disabled={players.length !== 4}
                                onChange={(e) => {
                                  const v = Number.parseInt(e.target.value, 10)
                                  setEditBuyMaDraft(Number.isFinite(v) ? Math.max(0, Math.min(4, v)) : 0)
                                }}
                              >
                                {[0, 1, 2, 3, 4].map((v) => (
                                  <option key={v} value={v}>
                                    {v}
                                  </option>
                                ))}
                              </select>
                              {players.length !== 4 && <span className="text-xs text-muted">仅 4 人局支持买码</span>}
                            </label>
                          )}
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
                                            ),
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
                      {round.isMahjongSpecial && <span className="rounded-full bg-accent/10 px-2 py-1 text-accent">特殊局</span>}
                      {scoringMode === 'mahjong' &&
                        !round.isMahjongSpecial &&
                        Number.isInteger(round.dealer) &&
                        round.dealer >= 0 &&
                        round.dealer < players.length && (
                          <span className="rounded-full bg-panel px-2 py-1 text-muted">庄家：{players[round.dealer] || '—'}</span>
                        )}
                      {round.isMahjongSpecial && round.specialNote && (
                        <span className="rounded-full bg-panel px-2 py-1 text-muted">备注：{round.specialNote}</span>
                      )}
                      {!round.isMahjongSpecial && Number.isFinite(round.buyMa) && round.buyMa > 0 && (
                        <span className="rounded-full bg-panel px-2 py-1 text-muted">买码：{round.buyMa}</span>
                      )}
                      {!round.isMahjongSpecial && round.followType === 'all' && (
                        <span className="rounded-full bg-panel px-2 py-1 text-muted">跟庄：庄家给三家各 1 分</span>
                      )}
                      {!round.isMahjongSpecial &&
                        round.followType === 'single' &&
                        Number.isInteger(round.followTarget) &&
                        round.followTarget >= 0 &&
                        round.followTarget < players.length && (
                          <span className="rounded-full bg-panel px-2 py-1 text-muted">跟庄：庄家给 {players[round.followTarget] || '—'} 3 分</span>
                        )}
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
                        {(scoringMode === 'standard' || (scoringMode === 'mahjong' && editMahjongSpecial)) && (
                          <button
                            className="w-full rounded-md border border-line bg-panel px-2 py-1 hover:border-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
                            aria-label={`自动平衡${rowLabel}`}
                            onClick={scoringMode === 'mahjong' ? onAutoBalanceEditMahjong : onAutoBalanceEdit}
                          >
                            自动平衡
                          </button>
                        )}
                        <button
                          className="w-full rounded-md border border-accent bg-accent/10 px-2 py-1 text-accent hover:bg-accent/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
                          aria-label={`保存${rowLabel}`}
                          onClick={onSaveEdit}
                        >
                          保存
                        </button>
                        <button
                          className="w-full rounded-md border border-line bg-panel px-2 py-1 hover:border-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50"
                          aria-label={`取消编辑${rowLabel}`}
                          onClick={onCancelEdit}
                        >
                          取消
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          className="w-full rounded-md border border-line bg-panel px-2 py-1 hover:border-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
                          aria-label={`编辑第 ${rowIndex + 1} 局`}
                          onClick={() => onStartEdit(round)}
                        >
                          编辑
                        </button>
                        <button
                          className="w-full rounded-md border border-line bg-panel px-2 py-1 hover:border-danger focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-danger/70"
                          aria-label={`删除第 ${rowIndex + 1} 局`}
                          onClick={() => onDeleteRound(round.id)}
                        >
                          删除本局
                        </button>
                        {onCopyPrevious && rowIndex > 0 && (
                          <button
                            className="w-full rounded-md border border-line bg-panel px-2 py-1 hover:border-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
                            aria-label={`复制上一局到第 ${rowIndex + 1} 局`}
                            onClick={() => onCopyPrevious(round.id)}
                          >
                            复制上一局
                          </button>
                        )}
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
  )
}

export default RoundsTable
