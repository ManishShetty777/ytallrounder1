import legacyStreamHandler from '../../api/stream.js'
import { runLegacyHandler } from '../lib/legacy-handler-adapter.mts'

export default async function stream(request: Request): Promise<Response> {
  return runLegacyHandler(legacyStreamHandler, request)
}

export const config = {
  path: '/api/stream',
}
