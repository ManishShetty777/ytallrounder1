import legacyDownloadHandler from '../../api/download.js'
import { runLegacyHandler } from '../lib/legacy-handler-adapter.mts'

export default async function download(request: Request): Promise<Response> {
  return runLegacyHandler(legacyDownloadHandler, request)
}

export const config = {
  path: '/api/download',
}
