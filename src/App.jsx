function App() {
  return (
    <div className="min-h-screen bg-surface text-slate-100">
      <header className="border-b border-slate-800 bg-panel/70 backdrop-blur-sm">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-4">
          <div className="flex flex-col gap-1">
            <p className="text-xs uppercase tracking-[0.2em] text-muted">Score Tracker</p>
            <h1 className="text-xl font-semibold">打牌积分表单</h1>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <button className="rounded-lg border border-slate-700 bg-panel px-3 py-2 text-slate-100 hover:border-slate-500">
              清空（需确认）
            </button>
            <button className="rounded-lg border border-slate-700 bg-panel px-3 py-2 text-slate-100 hover:border-slate-500">
              撤销
            </button>
            <button className="rounded-lg border border-slate-700 bg-panel px-3 py-2 text-slate-100 hover:border-slate-500">
              重做
            </button>
            <button className="rounded-lg bg-accent px-3 py-2 font-semibold text-slate-900 hover:brightness-95">
              导出 CSV
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto flex max-w-5xl flex-col gap-6 px-4 py-6">
        <section className="rounded-xl border border-slate-800 bg-panel/80 p-4 shadow-lg shadow-slate-950/50">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold">玩家与表头</h2>
              <p className="text-sm text-muted">默认 4 人，最多 8 人；玩家可重命名，表头可横向滚动。</p>
            </div>
            <button className="rounded-lg border border-slate-700 px-3 py-2 text-sm text-slate-100 hover:border-slate-500">
              添加玩家
            </button>
          </div>
          <div className="overflow-hidden rounded-lg border border-slate-800">
            <div className="flex items-center bg-slate-900 px-3 py-2 text-xs uppercase tracking-wide text-muted">
              <div className="w-16 flex-shrink-0">局号</div>
              <div className="flex min-w-0 flex-1 items-center gap-3 overflow-x-auto">
                {['玩家 A', '玩家 B', '玩家 C', '玩家 D'].map((name) => (
                  <div key={name} className="min-w-[120px] flex-shrink-0">
                    {name}
                  </div>
                ))}
              </div>
              <div className="w-32 flex-shrink-0 text-right">操作</div>
            </div>
            <div className="border-t border-slate-800 px-3 py-4 text-sm text-muted">
              表格主体将在此渲染：每行代表一局，含快速按钮、自动平衡、复制上一行等操作。
            </div>
          </div>
        </section>

        <section className="grid gap-4 lg:grid-cols-[2fr_1fr]">
          <div className="rounded-xl border border-slate-800 bg-panel/80 p-4 shadow-lg shadow-slate-950/50">
            <h2 className="text-lg font-semibold">交互要点</h2>
            <ul className="mt-2 space-y-2 text-sm text-muted">
              <li>每局分值和必须为 0，不平衡时整行标红并禁止新增；可一键自动平衡。</li>
              <li>单元格提供 -10~10 快速按钮，附加 ±10 叠加；移动端支持长按连续加减。</li>
              <li>撤销/重做至少 50 步，清空需确认；本地存储自动保存玩家与局数据。</li>
            </ul>
          </div>
          <div className="rounded-xl border border-slate-800 bg-panel/80 p-4 shadow-lg shadow-slate-950/50">
            <h2 className="text-lg font-semibold">汇总区域</h2>
            <p className="mt-2 text-sm text-muted">
              底部（移动端）或右侧（桌面）固定展示总分与领先标识；支持横向滚动时保持可见。
            </p>
          </div>
        </section>

        <section className="rounded-xl border border-slate-800 bg-panel/80 p-4 shadow-lg shadow-slate-950/50">
          <h2 className="text-lg font-semibold">待接入</h2>
          <ul className="mt-2 space-y-2 text-sm text-muted">
            <li>实际表格数据模型与状态管理。</li>
            <li>CSV 导出实现与文件名规范。</li>
            <li>可访问性细节（焦点态、aria 标签、对比度）。</li>
          </ul>
        </section>
      </main>
    </div>
  )
}

export default App
