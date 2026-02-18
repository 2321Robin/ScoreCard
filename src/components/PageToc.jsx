function PageToc({ sections, isOpen = true, onToggle, className = '' }) {
  if (!sections || sections.length === 0) return null
  return (
    <nav
      className={`rounded-xl border border-line bg-panel/90 p-4 shadow-lg shadow-[rgba(0,0,0,0.08)] ${className}`.trim()}
      aria-label="目录"
    >
      <div className="flex items-center justify-between text-sm font-semibold text-text">
        <span>目录</span>
        {onToggle ? (
          <button
            type="button"
            className="rounded-md px-2 py-1 text-xs text-muted hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 focus-visible:ring-offset-2 focus-visible:ring-offset-panel"
            onClick={onToggle}
            aria-expanded={isOpen}
          >
            {isOpen ? '收起' : '展开'}
          </button>
        ) : null}
      </div>
      <ul className={`mt-2 space-y-1 text-sm text-muted ${isOpen ? 'block' : 'hidden'}`}>
        {sections.map((item) => (
          <li key={item.id}>
            <a className="hover:text-text" href={`#${item.id}`}>
              {item.label}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  )
}

export default PageToc
