import { clampInt, ensureLength } from '../lib/helpers'
import { computeMahjongScores, normalizeGangs } from '../lib/mahjong'
import { computeDoudizhuScores } from '../lib/doudizhu'
import ChoiceButtons from './ChoiceButtons'
import {
  applyBuyMaAdjustment,
  applyFollowDealerAdjustment,
  applyQiangGangAdjustment,
  applyQingShuiHuAdjustment,
} from '../lib/mahjongAdjustments'

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
  editQingShuiHuDraft,
  editQiangGangRobberDraft,
  editQiangGangTargetDraft,
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
  setEditMahjongScores,
  setEditMahjongSpecialNote,
  setEditWinnerDraft,
  setEditDealerDraft,
  setEditFollowTypeDraft,
  setEditFollowTargetDraft,
  setEditGangDraft,
  setEditBuyMaDraft,
  setEditQingShuiHuDraft,
  setEditQiangGangRobberDraft,
  setEditQiangGangTargetDraft,
  editLandlordDraft,
  setEditLandlordDraft,
  editLandlordWonDraft,
  setEditLandlordWonDraft,
  editBaseScoreDraft,
  setEditBaseScoreDraft,
  editMultiplierDraft,
  setEditMultiplierDraft,
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
            const editingDoudizhu = isEditing && scoringMode === 'doudizhu'
            const doudizhuEditScores = editingDoudizhu
              ? computeDoudizhuScores({
                  landlord: editLandlordDraft,
                  landlordWon: editLandlordWonDraft,
                  baseScore: editBaseScoreDraft,
                  multiplier: editMultiplierDraft,
                })
              : null
            const logicalNumber = logicalRoundNumbers[rowIndex]
            const rowLabel = logicalNumber ? `第 ${logicalNumber} 局` : '特殊补充局'
            const mahjongEditScores = editingMahjong
              ? editingMahjongSpecial
                ? ensureLength(editMahjongScores, players.length, '')
                : (() => {
                    const hasQiangGang = Number.isInteger(editQiangGangRobberDraft) && Number.isInteger(editQiangGangTargetDraft)
                    const winnerForAdjustments = Number.isInteger(editQiangGangRobberDraft) ? editQiangGangRobberDraft : editWinnerDraft
                    const baseWinnerIndex = hasQiangGang ? null : winnerForAdjustments
                    const base = computeMahjongScores({
                      playersCount: players.length,
                      winnerIndex: baseWinnerIndex,
                      gangDraft: normalizeGangs(editGangDraft, players.length),
                      rules: mahjongRules,
                    })
                    const afterBuyMa = applyBuyMaAdjustment({
                      scores: base,
                      buyMa: editBuyMaDraft,
                      winnerIndex: winnerForAdjustments,
                      playersCount: players.length,
                      qiangGang: hasQiangGang ? { robber: editQiangGangRobberDraft, target: editQiangGangTargetDraft } : null,
                    })
                    const afterQingShuiHu = applyQingShuiHuAdjustment({
                      scores: afterBuyMa,
                      qingShuiHu: editQingShuiHuDraft,
                      winnerIndex: winnerForAdjustments,
                      playersCount: players.length,
                    })
                    const afterQiangGang = applyQiangGangAdjustment({
                      scores: afterQingShuiHu,
                      qiangGang: hasQiangGang ? { robber: editQiangGangRobberDraft, target: editQiangGangTargetDraft } : null,
                      playersCount: players.length,
                    })
                    return applyFollowDealerAdjustment({
                      scores: afterQiangGang,
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
                            ) : editingDoudizhu ? (
                              <div className="flex flex-col items-center justify-center gap-1 text-sm text-muted" aria-label={`${name} 当前计算分值 ${doudizhuEditScores[playerIndex] ?? 0}`}>
                                <div className="text-lg font-semibold text-text">{doudizhuEditScores[playerIndex] ?? 0}</div>
                                <div className="text-xs">由地主/胜方自动计算</div>
                              </div>
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
                                  setEditQingShuiHuDraft(false)
                                  setEditQiangGangRobberDraft(null)
                                  setEditQiangGangTargetDraft(null)
                                }
                                if (!checked) {
                                  setEditMahjongSpecialNote('')
                                  setEditDealerDraft(Number.isInteger(round.dealer) ? round.dealer : 0)
                                  setEditFollowTypeDraft(round.followType === 'all' || round.followType === 'single' ? round.followType : 'none')
                                  setEditFollowTargetDraft(Number.isInteger(round.followTarget) ? round.followTarget : null)
                                  setEditQingShuiHuDraft(Boolean(round.qingShuiHu))
                                  setEditQiangGangRobberDraft(Number.isInteger(round.qiangGang?.robber) ? round.qiangGang.robber : null)
                                  setEditQiangGangTargetDraft(Number.isInteger(round.qiangGang?.target) ? round.qiangGang.target : null)
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
                            <ChoiceButtons
                              options={players.map((name, idx) => ({ value: idx, label: name }))}
                              value={editWinnerDraft}
                              onChange={setEditWinnerDraft}
                              allowClear
                              ariaLabel="编辑胡牌者"
                            />
                          </label>
                          {!editMahjongSpecial && (
                            <label className="flex flex-col gap-1">
                              <span>庄家</span>
                              <ChoiceButtons
                                options={players.map((name, idx) => ({ value: idx, label: name }))}
                                value={editDealerDraft}
                                onChange={(v) => setEditDealerDraft(Number.isInteger(v) ? v : 0)}
                                ariaLabel="编辑庄家"
                              />
                            </label>
                          )}
                          {!editMahjongSpecial && (
                            <label className="flex flex-col gap-1">
                              <span>清水胡</span>
                              <button
                                type="button"
                                className={`rounded-md border px-3 py-2 text-left text-sm transition ${editQingShuiHuDraft ? 'border-accent bg-accent/20 text-text' : 'border-line bg-panel text-text'} ${players.length !== 4 ? 'opacity-60' : ''}`}
                                onClick={() => setEditQingShuiHuDraft((v) => !v)}
                                disabled={players.length !== 4}
                              >
                                {editQingShuiHuDraft ? '已启用' : '未启用，点此启用'}
                              </button>
                            </label>
                          )}
                          {!editMahjongSpecial && (
                            <div className="flex flex-col gap-1">
                              <span>抢杠</span>
                              <ChoiceButtons
                                options={players.map((name, idx) => ({ value: idx, label: name }))}
                                value={editQiangGangRobberDraft}
                                onChange={(next) => {
                                  setEditQiangGangRobberDraft(next)
                                  if (Number.isInteger(next)) setEditWinnerDraft(next)
                                  if (next === null || next === editQiangGangTargetDraft) setEditQiangGangTargetDraft(null)
                                }}
                                allowClear
                                ariaLabel="编辑抢杠者"
                              />
                              <div className="text-xs text-muted">被抢杠者</div>
                              <ChoiceButtons
                                options={players.map((name, idx) => ({ value: idx, label: name }))}
                                value={editQiangGangTargetDraft}
                                onChange={setEditQiangGangTargetDraft}
                                allowClear
                                disabled={editQiangGangRobberDraft === null}
                                disabledOptions={Number.isInteger(editQiangGangRobberDraft) ? [editQiangGangRobberDraft] : []}
                                ariaLabel="编辑被抢杠者"
                              />
                            </div>
                          )}
                          {!editMahjongSpecial && (
                            <div className="flex flex-col gap-1">
                              <span>跟庄</span>
                              <ChoiceButtons
                                options={[
                                  { value: 'none', label: '无' },
                                  { value: 'all', label: '庄家给三家各 1 分' },
                                  { value: 'single', label: '庄家给某人 3 分' },
                                ]}
                                value={editFollowTypeDraft}
                                onChange={setEditFollowTypeDraft}
                                ariaLabel="编辑跟庄"
                              />
                              {editFollowTypeDraft === 'single' && players.length === 4 && (
                                <div className="space-y-1">
                                  <div className="text-xs text-muted">选择被出 3 分的玩家</div>
                                  <ChoiceButtons
                                    options={players.map((name, idx) => ({ value: idx, label: name }))}
                                    value={editFollowTargetDraft}
                                    onChange={setEditFollowTargetDraft}
                                    allowClear
                                    disabledOptions={[editDealerDraft]}
                                    ariaLabel="编辑被出三分的玩家"
                                  />
                                </div>
                              )}
                              {players.length !== 4 && <span className="text-xs text-muted">仅 4 人局可跟庄</span>}
                            </div>
                          )}
                          {!editMahjongSpecial && (
                            <label className="flex flex-col gap-1">
                              <span>买码（0-4）</span>
                              <ChoiceButtons
                                options={[0, 1, 2, 3, 4].map((v) => ({ value: v, label: String(v) }))}
                                value={editBuyMaDraft}
                                onChange={(v) => setEditBuyMaDraft(Number.isInteger(v) ? Math.max(0, Math.min(4, v)) : 0)}
                                ariaLabel="编辑买码"
                              />
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
                                      <ChoiceButtons
                                        options={[
                                          { value: 'an', label: '暗杠' },
                                          { value: 'dian', label: '点杠' },
                                        ]}
                                        value={entry?.type ?? 'an'}
                                        onChange={(type) => {
                                          setEditGangDraft((prev) => {
                                            const next = ensureLength(prev, players.length, [])
                                            const list = Array.isArray(next[idx]) ? [...next[idx]] : []
                                            list[gi] = { type, target: type === 'dian' ? entry?.target ?? 0 : null }
                                            next[idx] = list
                                            return [...next]
                                          })
                                        }}
                                        ariaLabel="编辑杠类型"
                                      />
                                    </label>
                                    {entry?.type === 'dian' && (
                                      <label className="flex flex-col gap-1">
                                        <span className="text-xs text-muted">点谁</span>
                                        <ChoiceButtons
                                          options={players.map((p, pi) => ({ value: pi, label: p }))}
                                          value={entry?.target ?? null}
                                          onChange={(target) => {
                                            setEditGangDraft((prev) => {
                                              const next = ensureLength(prev, players.length, [])
                                              const list = Array.isArray(next[idx]) ? [...next[idx]] : []
                                              list[gi] = { ...list[gi], target }
                                              next[idx] = list
                                              return [...next]
                                            })
                                          }}
                                          allowClear
                                          disabledOptions={[idx]}
                                          ariaLabel={`编辑玩家 ${name} 点谁`}
                                        />
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
                    {editingDoudizhu && (
                      <div className="space-y-3 rounded-lg border border-line bg-panel p-3 text-sm text-muted">
                        <div className="font-medium text-text">编辑斗地主结果</div>
                        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                          <div className="flex flex-col gap-1">
                            <span>地主</span>
                            <ChoiceButtons
                              options={players.map((name, idx) => ({ value: idx, label: name }))}
                              value={editLandlordDraft}
                              onChange={setEditLandlordDraft}
                              allowClear
                              ariaLabel="编辑地主"
                            />
                          </div>
                          <label className="flex flex-col gap-1">
                            <span>胜方</span>
                            <div className="space-y-1 text-text">
                              <label className="flex items-center gap-2">
                                <input
                                  type="radio"
                                  name="ddz-edit-winner"
                                  className="accent-accent"
                                  checked={editLandlordWonDraft}
                                  onChange={() => setEditLandlordWonDraft(true)}
                                />
                                <span>地主赢</span>
                              </label>
                              <label className="flex items-center gap-2">
                                <input
                                  type="radio"
                                  name="ddz-edit-winner"
                                  className="accent-accent"
                                  checked={!editLandlordWonDraft}
                                  onChange={() => setEditLandlordWonDraft(false)}
                                />
                                <span>农民赢</span>
                              </label>
                            </div>
                          </label>
                          <label className="flex flex-col gap-1">
                            <span>底分</span>
                            <input
                              type="number"
                              min={1}
                              className="rounded-md border border-line bg-panel px-2 py-1 text-text focus:border-accent focus:outline-none"
                              value={editBaseScoreDraft}
                              onChange={(e) => setEditBaseScoreDraft(e.target.value)}
                            />
                          </label>
                          <label className="flex flex-col gap-1">
                            <span>倍数</span>
                            <input
                              type="number"
                              min={1}
                              className="rounded-md border border-line bg-panel px-2 py-1 text-text focus:border-accent focus:outline-none"
                              value={editMultiplierDraft}
                              onChange={(e) => setEditMultiplierDraft(e.target.value)}
                            />
                          </label>
                        </div>
                        <div className="text-xs leading-5 text-muted">
                          修改地主/胜方/底分/倍数会即时更新上方分数预览，确保仍保持和为 0。
                        </div>
                      </div>
                    )}
                    <div className="flex flex-wrap items-center gap-2 text-xs text-muted" aria-live="polite">
                      {invalid && <span className="rounded-full bg-red-100 px-2 py-1 text-danger">需平衡到 0</span>}
                      {round.isMahjongSpecial && <span className="rounded-full bg-accent/10 px-2 py-1 text-accent">特殊局</span>}
                      {scoringMode === 'doudizhu' && !round.isMahjongSpecial && Number.isInteger(round.landlord) && (
                        <>
                          <span className="rounded-full bg-panel px-2 py-1 text-muted">地主：{players[round.landlord] || '—'}</span>
                          <span className="rounded-full bg-panel px-2 py-1 text-muted">胜方：{round.landlordWon !== false ? '地主' : '农民'}</span>
                          <span className="rounded-full bg-panel px-2 py-1 text-muted">
                            底分×倍数：{round.baseScore ?? 1} × {round.multiplier ?? 1}
                          </span>
                        </>
                      )}
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
                      {!round.isMahjongSpecial && round.qingShuiHu && (
                        <span className="rounded-full bg-panel px-2 py-1 text-muted">清水胡</span>
                      )}
                      {!round.isMahjongSpecial && round.qiangGang && Number.isInteger(round.qiangGang.robber) && Number.isInteger(round.qiangGang.target) && (
                        <span className="rounded-full bg-panel px-2 py-1 text-muted">
                          抢杠：{players[round.qiangGang.robber] || '—'} 抢 {players[round.qiangGang.target] || '—'}
                        </span>
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
                                  return desc.length > 0 ? desc.join('，') : ''
                                })()
                              : ''}
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
