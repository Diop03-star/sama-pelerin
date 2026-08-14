interface IconProps {
  name: string
  fill?: boolean
  size?: number
  className?: string
}

export default function Icon({ name, fill = false, size = 20, className = '' }: IconProps) {
  return (
    <span
      aria-hidden="true"
      translate="no"
      className={`material-symbols-outlined notranslate inline-block select-none leading-none ${className}`}
      style={{ fontSize: size, fontVariationSettings: fill ? "'FILL' 1, 'wght' 500" : undefined }}
    >
      {name}
    </span>
  )
}