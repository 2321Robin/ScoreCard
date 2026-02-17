function PageToc({ sections }) {
  if (!sections || sections.length === 0) return null
  return (
    <nav className="rounded-xl border border-line bg-panel/90 p-4 shadow-lg shadow-[rgba(0,0,0,0.08)]" aria-label="目录">
      <div className="text-sm font-semibold text-text">目录</div>
      <ul className="mt-2 space-y-1 text-sm text-muted">
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
