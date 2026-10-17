/**
 * Animated three-line menu icon.
 * variant: 'open'  → three even lines (sidebar expanded)
 *          'mini'  → staggered lines (sidebar collapsed — click to expand)
 *          'close' → morphs into an X (mobile drawer open)
 */
export default function Hamburger({ variant = 'open', className = '' }) {
  const x    = variant === 'close'
  const mini = variant === 'mini'
  const line = 'absolute left-0 h-[2px] rounded-full bg-current transition-all duration-300 ease-out'
  return (
    <span className={`relative block w-[18px] h-[14px] ${className}`} aria-hidden="true">
      <span className={line} style={{ top: x ? 6 : 0, width: mini ? 12 : 18, transform: x ? 'rotate(45deg)' : 'none' }} />
      <span className={line} style={{ top: 6, width: mini ? 18 : 18, opacity: x ? 0 : 1, transform: x ? 'translateX(-6px)' : 'none' }} />
      <span className={line} style={{ top: x ? 6 : 12, width: mini ? 9 : 18, transform: x ? 'rotate(-45deg)' : 'none' }} />
    </span>
  )
}
