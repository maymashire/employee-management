/** Product identity: name, slogan, icon and the dotted-"o" wordmark. */
export const BRAND = {
  name:   'Teamora',
  slogan: 'Where teams come together.',
}

const NAVY   = '#1e3a8a'
const ACCENT = '#f59e0b'

// Eight people around one table — the "o" in teamora (viewBox 64×64).
const RING      = [[32, 16], [43.3, 20.7], [48, 32], [43.3, 43.3], [32, 48], [20.7, 43.3], [16, 32], [20.7, 20.7]]
const ICON_RING = [[32, 17], [42.6, 21.4], [47, 32], [42.6, 42.6], [32, 47], [21.4, 42.6], [17, 32], [21.4, 21.4]]

/** The dotted ring on its own (the "o"). */
export function DotsRing({ size = 32, color = NAVY, accent = ACCENT, r = 4.4, style, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true" className={`shrink-0 ${className}`} style={style}>
      {RING.map(([cx, cy], i) => <circle key={i} cx={cx} cy={cy} r={r} fill={i === 0 ? accent : color} />)}
    </svg>
  )
}

/** App icon: navy rounded square with the white dotted ring — same artwork as public/favicon.svg. */
export function LogoMark({ size = 36, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" className={`shrink-0 ${className}`} role="img" aria-label={BRAND.name}>
      <rect width="64" height="64" rx="16" fill={NAVY} />
      {ICON_RING.map(([cx, cy], i) => <circle key={i} cx={cx} cy={cy} r="4.2" fill={i === 0 ? '#fbbf24' : '#ffffff'} />)}
    </svg>
  )
}

/** "team•ra" wordmark. `tone` = 'light' on dark backgrounds, 'dark' on light ones. */
export function Wordmark({ size = 28, tone = 'dark', className = '' }) {
  const light = tone === 'light'
  const ring  = size * 0.86
  return (
    <span role="img" aria-label={BRAND.name}
      className={`inline-flex items-center leading-none whitespace-nowrap ${className}`}
      style={{ fontFamily: "'Urbanist', 'Plus Jakarta Sans', sans-serif", fontWeight: 800, fontSize: size, letterSpacing: '-0.03em', color: light ? '#ffffff' : '#0f172a' }}>
      <span aria-hidden="true">team</span>
      <DotsRing size={ring} color={light ? '#ffffff' : NAVY} accent={light ? '#fbbf24' : ACCENT} r={light ? 4.6 : 4.4}
        style={{ margin: `${size * 0.14}px ${-size * 0.083}px 0 ${-size * 0.055}px` }} />
      <span aria-hidden="true">ra</span>
    </span>
  )
}

/** Wordmark with the slogan underneath. */
export function BrandLockup({ size = 40, tone = 'light', slogan = true, tagline = BRAND.slogan }) {
  const light = tone === 'light'
  return (
    <div className="flex flex-col gap-1.5 min-w-0">
      <Wordmark size={size} tone={tone} />
      {slogan && <p className={`truncate ${size >= 36 ? 'text-sm' : 'text-[11px]'} ${light ? 'text-indigo-200' : 'text-gray-500'}`}>{tagline}</p>}
    </div>
  )
}
