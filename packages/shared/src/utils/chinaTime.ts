/**
 * 中国时区工具（Asia/Shanghai）
 */

const TZ = 'Asia/Shanghai'

export function getChinaDate(): string {
  return new Date().toLocaleDateString('sv-SE', { timeZone: TZ })
}

export function getChinaTimestamp(): Date {
  return new Date(new Date().toLocaleString('en-US', { timeZone: TZ }))
}

export function getChinaDateFromTimestamp(ts: Date | number): string {
  const d = typeof ts === 'number' ? new Date(ts) : ts
  return d.toLocaleDateString('sv-SE', { timeZone: TZ })
}

export function getChinaTimeString(): string {
  return new Date().toLocaleString('zh-CN', { timeZone: TZ })
}

/**
 * 解析中文/英文时间字符串为 Date 对象
 */
const TIME_PATTERNS: Array<{ pattern: RegExp; fn: (m: RegExpMatchArray) => number }> = [
  { pattern: /(\d+)\s*分钟/, fn: m => parseInt(m[1]) * 60 },
  { pattern: /(\d+)\s*min/i, fn: m => parseInt(m[1]) * 60 },
  { pattern: /(\d+)\s*m\b/i, fn: m => parseInt(m[1]) * 60 },
  { pattern: /(\d+)\s*小时/, fn: m => parseInt(m[1]) * 3600 },
  { pattern: /(\d+)\s*h\b/i, fn: m => parseInt(m[1]) * 3600 },
  { pattern: /(\d+)\s*hour/i, fn: m => parseInt(m[1]) * 3600 },
  { pattern: /(\d+)\s*天/, fn: m => parseInt(m[1]) * 86400 },
  { pattern: /(\d+)\s*d\b/i, fn: m => parseInt(m[1]) * 86400 },
  { pattern: /(\d+)\s*day/i, fn: m => parseInt(m[1]) * 86400 },
]

export function parseTimeString(input: string): Date | null {
  const s = input.trim()
  const now = new Date()

  // 相对时间
  for (const { pattern, fn } of TIME_PATTERNS) {
    const m = s.match(pattern)
    if (m) return new Date(now.getTime() + fn(m) * 1000)
  }

  // 绝对时间 YYYY-MM-DD HH:mm
  const abs1 = s.match(/(\d{4})[-/](\d{1,2})[-/](\d{1,2})\s+(\d{1,2}):(\d{2})/)
  if (abs1) {
    const [, y, mo, d, h, mi] = abs1
    const date = new Date(`${y}-${mo.padStart(2, '0')}-${d.padStart(2, '0')}T${h.padStart(2, '0')}:${mi}:00+08:00`)
    return date
  }

  // 今天的时间 HH:mm
  const time = s.match(/^(\d{1,2}):(\d{2})$/)
  if (time) {
    const [, h, mi] = time
    const today = getChinaDate()
    const dt = new Date(`${today}T${h.padStart(2, '0')}:${mi}:00+08:00`)
    if (dt.getTime() <= now.getTime()) {
      dt.setDate(dt.getDate() + 1)
    }
    return dt
  }

  return null
}
