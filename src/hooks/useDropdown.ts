import { useEffect, useRef, useState } from 'react'

export default function useDropdown() {
  const [ouvert, setOuvert] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!ouvert) return
    function onClicExt(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOuvert(false)
    }
    function onEchap(e: KeyboardEvent) {
      if (e.key === 'Escape') setOuvert(false)
    }
    document.addEventListener('mousedown', onClicExt)
    document.addEventListener('keydown', onEchap)
    return () => {
      document.removeEventListener('mousedown', onClicExt)
      document.removeEventListener('keydown', onEchap)
    }
  }, [ouvert])

  return { ref, ouvert, basculer: () => setOuvert((v) => !v), fermer: () => setOuvert(false) }
}