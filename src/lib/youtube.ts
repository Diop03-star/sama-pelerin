const PATTERNS = [
  /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/shorts\/)([\w-]{11})/,
  /youtube\.com\/embed\/([\w-]{11})/,
]

export function extraireIdYoutube(url: string): string | null {
  for (const pattern of PATTERNS) {
    const match = url.match(pattern)
    if (match) return match[1]
  }
  return null
}

export function miniatureYoutube(id: string): string {
  return `https://img.youtube.com/vi/${id}/hqdefault.jpg`
}

export function lienYoutube(id: string): string {
  return `https://www.youtube.com/watch?v=${id}`
}