export function createNoticeHub() {
  const messages: string[] = []
  let listener: ((message: string) => void) | undefined

  return {
    push(message: string): void {
      messages.push(message)
      listener?.(message)
    },
    subscribe(next: (message: string) => void): () => void {
      listener = next
      for (const message of [...messages]) next(message)
      return () => {
        if (listener === next) listener = undefined
      }
    },
  }
}
