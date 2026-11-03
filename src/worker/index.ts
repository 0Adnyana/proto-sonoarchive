import { responseForWorkerMessage } from './ping'

type ParentPort = {
  on(event: 'message', listener: (event: { data: unknown }) => void): void
  postMessage(message: unknown): void
}

const parentPort = (
  process as NodeJS.Process & { parentPort?: ParentPort | null }
).parentPort

if (parentPort) {
  parentPort.on('message', (event) => {
    const response = responseForWorkerMessage(event.data)
    if (response) parentPort.postMessage(response)
  })
}
