import { type AnalysisPayload, isAnalyseRequest } from '../shared/ipc'
import { analyseShortWav, onnxRuntime } from './analyse'
import { responseForWorkerMessage } from './ping'

export { onnxRuntime }

type ParentPort = {
  on(event: 'message', listener: (event: { data: unknown }) => void): void
  postMessage(message: unknown): void
}

type AnalyseInput = {
  filePath: string
  modelPath: string
  probePath: string
}

export function dispatchWorkerMessage(
  message: unknown,
  analyse: (input: AnalyseInput) => Promise<AnalysisPayload> = analyseShortWav,
): Promise<unknown> {
  const ping = responseForWorkerMessage(message)
  if (ping) return Promise.resolve(ping)
  if (!isAnalyseRequest(message)) return Promise.resolve(undefined)
  return analyse(message).then((result) => ({
    type: 'analyse',
    id: message.id,
    filePath: message.filePath,
    ...result,
  }))
}

const parentPort = (
  process as NodeJS.Process & { parentPort?: ParentPort | null }
).parentPort

if (parentPort) {
  parentPort.on('message', (event) => {
    void dispatchWorkerMessage(event.data)
      .then((response) => {
        if (response !== undefined) parentPort.postMessage(response)
      })
      .catch((error: unknown) => {
        console.error(error)
      })
  })
}
