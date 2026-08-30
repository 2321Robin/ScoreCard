import { clampInt, ensureLength } from '../lib/helpers'
import ChoiceButtons from './ChoiceButtons'

function NewRoundSection({
  sectionId = 'new-round',
  players,
  scoringMode,
  scoreOptions,
  rangeDraft,
  setRangeDraft,
  applyRangeDraft,
  autoBalanceNewRound,
  newRoundScores,
  updateNewRoundScore,
  mahjongRulesDraft,
  setMahjongRulesDraft,
  applyMahjongRules,
  mahjongSpecial,
  setMahjongSpecial,
  mahjongSpecialScores,
  setMahjongSpecialScores,
  updateMahjongSpecialScore,
  mahjongSpecialNote,
  setMahjongSpecialNote,
  autoBalanceMahjongSpecial,
  winnerDraft,
  setWinnerDraft,
  dealerDraft,
  setDealerDraft,
  followTypeDraft,
  setFollowTypeDraft,
  followTargetDraft,
  setFollowTargetDraft,
  gangDraft,
  setGangDraft,
  buyMaDraft,
  setBuyMaDraft,
  qingShuiHuDraft,
  setQingShuiHuDraft,
  qiangGangRobberDraft,
  setQiangGangRobberDraft,
  qiangGangTargetDraft,
  setQiangGangTargetDraft,
  mahjongPreviewScores,
  landlordDraft,
  setLandlordDraft,
  landlordWonDraft,
  setLandlordWonDraft,
  baseScoreDraft,
  setBaseScoreDraft,
  multiplierDraft,
  setMultiplierDraft,
  capDraft,
  setCapDraft,
  doudizhuPreviewScores,
  submitNewRound,
}) {
  return (
    <section id={sectionId} className="rounded-xl border border-line bg-panel/90 p-4 shadow-lg shadow-[rgba(0,0,0,0.08)]">
      <div className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold">新增一局</h2>
          <p className="text-sm text-muted">在此填写分值并添加；如需调整已存在的记录，请在下方列表中点击编辑。</p>
        </div>
        {scoringMode === 'standard' ? (
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
        ) : scoringMode === 'doudizhu' ? (
          <div className="flex flex-col gap-2 text-sm sm:items-end">
            <div className="text-xs text-muted sm:text-right">底分 × 倍数自动结算，每局和为 0</div>
            <div className="flex flex-wrap gap-2">
              <button
                className="rounded-lg bg-accent px-3 py-2 font-semibold text-text hover:brightness-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 focus-visible:ring-offset-2 focus-visible:ring-offset-panel"
                onClick={submitNewRound}
              >
                添加本局
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-2 text-sm sm:items-end">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-muted">胡分</span>
              <input
                type="number"
                className="w-20 rounded-md border border-line bg-panel px-2 py-1 text-sm text-text focus:border-accent focus:outline-none"
                aria-label="胡分（每家付）"
                value={mahjongRulesDraft.huPerLoser}
                onChange={(e) => setMahjongRulesDraft((prev) => ({ ...prev, huPerLoser: e.target.value }))}
              />
              <span className="text-muted">暗杠分</span>
              <input
                type="number"
                className="w-20 rounded-md border border-line bg-panel px-2 py-1 text-sm text-text focus:border-accent focus:outline-none"
                aria-label="暗杠分（每家付）"
                value={mahjongRulesDraft.anGangPerLoser}
                onChange={(e) => setMahjongRulesDraft((prev) => ({ ...prev, anGangPerLoser: e.target.value }))}
              />
              <span className="text-muted">点杠分</span>
              <input
                type="number"
                className="w-20 rounded-md border border-line bg-panel px-2 py-1 text-sm text-text focus:border-accent focus:outline-none"
                aria-label="点杠分"
                value={mahjongRulesDraft.dianGangAmount}
                onChange={(e) => setMahjongRulesDraft((prev) => ({ ...prev, dianGangAmount: e.target.value }))}
              />
              <button
                className="rounded-md border border-line bg-panel px-2 py-1 text-text hover:border-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
                onClick={applyMahjongRules}
              >
                更新规则
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                className="rounded-lg bg-accent px-3 py-2 font-semibold text-text hover:brightness-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 focus-visible:ring-offset-2 focus-visible:ring-offset-panel"
                onClick={submitNewRound}
              >
                添加本局
              </button>
            </div>
          </div>
        )}
      </div>

      {scoringMode === 'standard' ? (
        <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          {players.map((name, idx) => (
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
      ) : scoringMode === 'doudizhu' ? (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
            <div className="rounded-lg border border-line bg-panel p-3">
              <div className="text-sm text-muted">地主</div>
              <ChoiceButtons
                className="mt-2"
                options={players.map((name, idx) => ({ value: idx, label: name }))}
                value={landlordDraft}
                onChange={setLandlordDraft}
                allowClear
                ariaLabel="选择地主"
              />
              <div className="mt-3">
                <div className="text-sm text-muted">胜方</div>
                <ChoiceButtons
                  className="mt-1"
                  options={[
                    { value: true, label: '地主赢' },
                    { value: false, label: '农民赢' },
                  ]}
                  value={landlordWonDraft}
                  onChange={setLandlordWonDraft}
                  ariaLabel="胜方"
                />
              </div>
            </div>
            <div className="rounded-lg border border-line bg-panel p-3">
              <div className="text-sm text-muted">计分参数</div>
              <label className="mt-2 flex items-center gap-2 text-sm text-muted">
                <span className="w-12 flex-shrink-0">底分</span>
                <input
                  type="number"
                  min={1}
                  aria-label="底分"
                  className="w-full rounded-md border border-line bg-panel px-2 py-1 text-text focus:border-accent focus:outline-none"
                  value={baseScoreDraft}
                  onChange={(e) => setBaseScoreDraft(e.target.value)}
                />
              </label>
              <div className="mt-2">
                <div className="text-sm text-muted">倍数</div>
                <ChoiceButtons
                  className="mt-1"
                  options={[1, 2, 4, 8, 16].map((v) => ({ value: v, label: String(v) }))}
                  value={multiplierDraft}
                  onChange={(v) => setMultiplierDraft(Number.isInteger(v) ? v : 1)}
                  ariaLabel="倍数"
                />
              </div>
              <label className="mt-2 flex items-center gap-2 text-sm text-muted">
                <span className="w-12 flex-shrink-0">封顶</span>
                <input
                  type="number"
                  min={1}
                  aria-label="封顶（每局单人最多输）"
                  className="w-full rounded-md border border-line bg-panel px-2 py-1 text-text focus:border-accent focus:outline-none"
                  value={capDraft}
                  onChange={(e) => setCapDraft(e.target.value)}
                />
              </label>
              <p className="mt-2 text-xs text-muted">
                地主赢：地主 +2×底分×倍数，每家农民 −底分×倍数；农民赢则反向。单人输分超过封顶时按封顶结算，保持和为 0。
              </p>
            </div>
            <div className="rounded-lg border border-line bg-panel p-3">
              <div className="text-sm text-muted">本局预览分数</div>
              <div className="mt-2 grid grid-cols-3 gap-2 text-sm">
                {players.map((name, idx) => (
                  <div key={name} className="rounded-md border border-line bg-panel px-2 py-2">
                    <div className="text-muted">{name}</div>
                    <div className="text-lg font-semibold text-text">{doudizhuPreviewScores[idx] ?? 0}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
            <span className="rounded-full bg-accent/10 px-2 py-1 text-accent">固定 3 人</span>
            <span>斗地主模式固定 3 人，分数由地主/胜方/底分/倍数自动结算。</span>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
            <div className="rounded-lg border border-line bg-panel p-3">
              <div className="text-sm text-muted">特殊局（手动分数）</div>
              <label className="mt-2 flex items-center gap-2 text-sm text-text">
                <input
                  type="checkbox"
                  className="accent-accent"
                  checked={mahjongSpecial}
                  onChange={(e) => {
                    const checked = e.target.checked
                    setMahjongSpecial(checked)
                    if (checked) {
                      setMahjongSpecialScores((prev) => ensureLength(prev, players.length, '').map((v) => String(clampInt(v))))
                      setMahjongSpecialNote('')
                      setBuyMaDraft(0)
                      setFollowTypeDraft('none')
                      setFollowTargetDraft(null)
                      setQingShuiHuDraft(false)
                    }
                  }}
                />
                <span>启用手动分数</span>
              </label>
              <p className="mt-1 text-xs text-muted">用于跟庄等特殊结算，勾选后手动填写每位玩家分数。</p>
              {mahjongSpecial && (
                <label className="mt-2 flex flex-col gap-1 text-sm text-muted">
                  <span>备注（可选）</span>
                  <input
                    type="text"
                    className="rounded-md border border-line bg-panel px-2 py-1 text-text focus:border-accent focus:outline-none"
                    value={mahjongSpecialNote}
                    maxLength={80}
                    onChange={(e) => setMahjongSpecialNote(e.target.value)}
                    aria-label="特殊局备注"
                  />
                </label>
              )}
              {mahjongSpecial && (
                <button
                  className="mt-2 w-full rounded-md border border-line bg-panel px-2 py-1 text-sm text-text hover:border-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
                  type="button"
                  onClick={autoBalanceMahjongSpecial}
                >
                  自动平衡
                </button>
              )}
            </div>
            <div className="rounded-lg border border-line bg-panel p-3">
              <div className="text-sm text-muted">选择胡的玩家</div>
              <ChoiceButtons
                className="mt-2"
                options={players.map((name, idx) => ({ value: idx, label: name }))}
                value={winnerDraft}
                onChange={setWinnerDraft}
                allowClear
                ariaLabel="选择胡的玩家"
              />
              {!mahjongSpecial && (
                <div className="mt-3">
                  <div className="text-sm text-muted">庄家</div>
                  <ChoiceButtons
                    className="mt-2"
                    options={players.map((name, idx) => ({ value: idx, label: name }))}
                    value={dealerDraft}
                    onChange={(v) => setDealerDraft(Number.isInteger(v) ? v : 0)}
                    ariaLabel="庄家"
                  />
                  <p className="mt-1 text-xs text-muted">默认是上一局赢家，可手动修改</p>
                </div>
              )}
              {!mahjongSpecial && (
                <div className="mt-3 space-y-2">
                  <div className="text-sm text-muted">清水胡</div>
                  <button
                    type="button"
                    className={`w-full rounded-md border px-3 py-2 text-sm transition ${qingShuiHuDraft ? 'border-accent bg-accent/20 text-text' : 'border-line bg-panel text-text'} ${players.length !== 4 ? 'opacity-60' : ''}`}
                    onClick={() => setQingShuiHuDraft((v) => !v)}
                    disabled={players.length !== 4}
                  >
                    {qingShuiHuDraft ? '已启用' : '未启用，点此启用'}
                  </button>
                </div>
              )}
              {!mahjongSpecial && (
                <div className="mt-3 space-y-2">
                  <div className="text-sm text-muted">抢杠</div>
                  <ChoiceButtons
                    options={players.map((name, idx) => ({ value: idx, label: name }))}
                    value={qiangGangRobberDraft}
                    onChange={(next) => {
                      setQiangGangRobberDraft(next)
                      setWinnerDraft(Number.isInteger(next) ? next : winnerDraft)
                      if (next === null) setQiangGangTargetDraft(null)
                      if (Number.isInteger(next) && next === qiangGangTargetDraft) setQiangGangTargetDraft(null)
                    }}
                    allowClear
                    ariaLabel="抢杠者（胡牌）"
                  />
                  <div className="text-xs text-muted">被抢杠者</div>
                  <ChoiceButtons
                    options={players.map((name, idx) => ({ value: idx, label: name }))}
                    value={qiangGangTargetDraft}
                    onChange={setQiangGangTargetDraft}
                    allowClear
                    disabled={qiangGangRobberDraft === null}
                    disabledOptions={Number.isInteger(qiangGangRobberDraft) ? [qiangGangRobberDraft] : []}
                    ariaLabel="被抢杠者"
                  />
                </div>
              )}
              {!mahjongSpecial && (
                <div className="mt-3 space-y-2">
                  <div className="text-sm text-muted">跟庄</div>
                  <ChoiceButtons
                    options={[
                      { value: 'none', label: '无' },
                      { value: 'all', label: '庄家给三家各 1 分' },
                      { value: 'single', label: '庄家给某人 3 分' },
                    ]}
                    value={followTypeDraft}
                    onChange={setFollowTypeDraft}
                    ariaLabel="跟庄"
                  />
                  {followTypeDraft === 'single' && players.length === 4 && (
                    <div className="space-y-1">
                      <div className="text-xs text-muted">选择被“出三分”的玩家</div>
                      <ChoiceButtons
                        options={players.map((name, idx) => ({ value: idx, label: name }))}
                        value={followTargetDraft}
                        onChange={setFollowTargetDraft}
                        allowClear
                        disabledOptions={[dealerDraft]}
                        ariaLabel="被出三分的玩家"
                      />
                    </div>
                  )}
                  {players.length !== 4 && <p className="text-xs text-muted">仅 4 人局可跟庄</p>}
                </div>
              )}
              <div className="mt-3">
                <div className="text-sm text-muted">买码（0-4）</div>
                <ChoiceButtons
                  className="mt-2"
                  options={[0, 1, 2, 3, 4].map((v) => ({ value: v, label: String(v) }))}
                  value={buyMaDraft}
                  onChange={(v) => setBuyMaDraft(Number.isInteger(v) ? Math.max(0, Math.min(4, v)) : 0)}
                  disabled={mahjongSpecial}
                  ariaLabel="买码"
                />
                {players.length !== 4 ? (
                  <p className="mt-1 text-xs text-muted">仅 4 人局支持买码</p>
                ) : (
                  <p className="mt-1 text-xs text-muted">买码为 x：胡的人 +3x，其余每人 -x</p>
                )}
              </div>
            </div>
            <div className="rounded-lg border border-line bg-panel p-3">
              <div className="text-sm text-muted">本局预览分数</div>
              <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
                {players.map((name, idx) => (
                  <div key={name} className="rounded-md border border-line bg-panel px-2 py-2">
                    <div className="text-muted">{name}</div>
                    <div className="text-lg font-semibold text-text">{mahjongPreviewScores[idx] ?? 0}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {mahjongSpecial && (
            <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
              {players.map((name, idx) => (
                <div key={name} className="rounded-lg border border-line bg-panel p-3" role="cell">
                  <div className="flex flex-col gap-2 text-sm text-muted">
                    <span className="font-medium text-text text-center">{name}</span>
                    <input
                      id={`mahjong-special-${idx}`}
                      aria-label={`新增一局，玩家 ${name}（特殊局分数）`}
                      type="text"
                      inputMode="numeric"
                      className="w-full rounded-md border border-line bg-panel px-2 py-1 text-sm text-text focus:border-accent focus:outline-none"
                      value={mahjongSpecialScores[idx] ?? ''}
                      onChange={(e) => updateMahjongSpecialScore(idx, e.target.value)}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
            {players.map((name, idx) => {
              const gangs = Array.isArray(gangDraft[idx]) ? gangDraft[idx] : []
              return (
                <div key={name} className="rounded-lg border border-line bg-panel p-3" role="cell">
                  <div className="flex flex-col gap-2 text-sm text-muted">
                    <span className="font-medium text-text text-center">{name}</span>
                    {gangs.map((entry, gi) => (
                      <div key={gi} className="rounded-md border border-line bg-panel p-2">
                        <div className="flex items-center justify-between gap-2 text-xs text-muted">
                          <span>杠 #{gi + 1}</span>
                          <button
                            className="text-danger hover:underline"
                            onClick={() => {
                              setGangDraft((prev) => {
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
                          <span>类型</span>
                          <ChoiceButtons
                            options={[
                              { value: 'an', label: '暗杠' },
                              { value: 'dian', label: '点杠' },
                            ]}
                            value={entry?.type ?? 'an'}
                            onChange={(type) => {
                              setGangDraft((prev) => {
                                const next = ensureLength(prev, players.length, [])
                                const list = Array.isArray(next[idx]) ? [...next[idx]] : []
                                list[gi] = { type, target: type === 'dian' ? entry?.target ?? 0 : null }
                                next[idx] = list
                                return [...next]
                              })
                            }}
                            ariaLabel="杠类型"
                          />
                        </label>
                        {entry?.type === 'dian' && (
                          <label className="flex flex-col gap-1">
                            <span>点谁</span>
                            <ChoiceButtons
                              options={players.map((p, pi) => ({ value: pi, label: p }))}
                              value={entry?.target ?? null}
                              onChange={(target) => {
                                setGangDraft((prev) => {
                                  const next = ensureLength(prev, players.length, [])
                                  const list = Array.isArray(next[idx]) ? [...next[idx]] : []
                                  list[gi] = { ...list[gi], target }
                                  next[idx] = list
                                  return [...next]
                                })
                              }}
                              allowClear
                              disabledOptions={[idx]}
                              ariaLabel={`玩家 ${name} 点谁`}
                            />
                          </label>
                        )}
                      </div>
                    ))}
                    <button
                      className="mt-1 rounded-md border border-line bg-panel px-2 py-1 text-text hover:border-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
                      type="button"
                      onClick={() => {
                        setGangDraft((prev) => {
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
                </div>
              )
            })}
          </div>
        </div>
      )}
    </section>
  )
}

export default NewRoundSection
