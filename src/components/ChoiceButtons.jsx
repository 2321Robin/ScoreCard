/**
 * 单选按钮组：固定选项的“点一次即选中”选择器，替代下拉框。
 * - 选中项高亮（accent 底）；再点一次当前选中项可取消（allowClear 时回调 null）。
 * - options: [{ value, label, disabled? }]；disabledOptions 可按 value 额外禁用。
 */
function ChoiceButtons({
  options,
  value,
  onChange,
  allowClear = false,
  disabled = false,
  disabledOptions = [],
  className = '',
  ariaLabel,
}) {
  return (
    <div className={`flex flex-wrap gap-1.5 ${className}`} role="group" aria-label={ariaLabel}>
      {options.map((opt) => {
        const isDisabled = disabled || opt.disabled || disabledOptions.includes(opt.value)
        const active = opt.value === value
        return (
          <button
            key={String(opt.value)}
            type="button"
            disabled={isDisabled}
            aria-pressed={active}
            className={`rounded-full border px-3 py-1.5 text-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 focus-visible:ring-offset-2 focus-visible:ring-offset-panel ${
              active
                ? 'border-accent bg-accent/20 font-medium text-text'
                : 'border-line bg-panel text-muted hover:border-accent hover:text-text'
            } ${isDisabled ? 'cursor-not-allowed opacity-50' : ''}`}
            onClick={() => onChange(active && allowClear ? null : opt.value)}
          >
            {opt.label}
          </button>
        )
      })}
    </div>
  )
}

export default ChoiceButtons
