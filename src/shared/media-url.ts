const MEDIA_HOST = 'media'

export function mediaUrlFor(filePath: string): string {
  return `sonoarchive://${MEDIA_HOST}/${encodeURIComponent(filePath)}`
}

export function filePathFromMediaUrl(requestUrl: string): string | undefined {
  let url: URL
  try {
    url = new URL(requestUrl)
  } catch {
    return undefined
  }
  if (url.protocol !== 'sonoarchive:' || url.hostname !== MEDIA_HOST) {
    return undefined
  }
  if (url.pathname.length <= 1) return undefined
  try {
    const filePath = decodeURIComponent(url.pathname.slice(1))
    if (filePath.length === 0) return undefined
    return filePath
  } catch {
    return undefined
  }
}
