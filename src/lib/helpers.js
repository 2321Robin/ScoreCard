export const clampInt = (value) => {
  const n = Number.parseInt(value, 10)
  return Number.isFinite(n) ? n : 0
}

export const ensureLength = (arr, target, fill = 0) => {
  const next = arr.slice(0, target)
  if (next.length < target) {
    const make = typeof fill === 'object' && fill !== null ? () => ({ ...fill }) : () => fill
    for (let i = next.length; i < target; i += 1) {
      next.push(make())
    }
  }
  return next
}

export const formatTimestamp = () => {
  const d = new Date()
  const pad = (n) => n.toString().padStart(2, '0')
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}`
}

export const parseDateFromFilename = (name = '') => {
  const match = name.match(/(\d{4})\D?(\d{2})\D?(\d{2})\D?(\d{2})(\d{2})/)
  if (!match) return null
  const [, y, m, d, hh, mm] = match
  const year = Number.parseInt(y, 10)
  const month = Number.parseInt(m, 10) - 1
  const day = Number.parseInt(d, 10)
  const hour = Number.parseInt(hh, 10)
  const minute = Number.parseInt(mm, 10)
  const result = new Date(year, month, day, hour, minute)
  return Number.isNaN(result.getTime()) ? null : result.getTime()
}
