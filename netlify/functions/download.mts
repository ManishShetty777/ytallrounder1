import legacyDownloadHandler from '../../api/download.js'
import { runLegacyHandler } from '../lib/legacy-handler-adapter.mts'

export default async function download(request: Request): Promise<Response> {
  const resolvedResponse = await runLegacyHandler(legacyDownloadHandler, request)
  const deliveryMode = new URL(request.url).searchParams.get('delivery')

  if (deliveryMode !== 'attachment' || !resolvedResponse.ok) {
    return resolvedResponse
  }

  const resolvedDownload = await resolvedResponse.json()
  if (!resolvedDownload.success || !resolvedDownload.downloadUrl) {
    return Response.json(
      { success: false, error: 'The media stream could not be prepared for download.' },
      { status: 502 },
    )
  }

  try {
    const mediaResponse = await fetch(resolvedDownload.downloadUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
      redirect: 'follow',
    })

    if (!mediaResponse.ok || !mediaResponse.body) {
      return Response.json(
        { success: false, error: `The media provider returned HTTP ${mediaResponse.status}.` },
        { status: 502 },
      )
    }

    const filename = String(resolvedDownload.filename || 'youtube-download')
    const fallbackFilename = filename.replace(/[^a-zA-Z0-9._-]/g, '_').replace(/"/g, '')
    const headers = new Headers({
      'Cache-Control': 'no-store, no-cache, must-revalidate',
      'Content-Disposition': `attachment; filename="${fallbackFilename}"; filename*=UTF-8''${encodeURIComponent(filename)}`,
      'Content-Type': mediaResponse.headers.get('Content-Type') || resolvedDownload.mimeType || 'application/octet-stream',
      'X-Content-Type-Options': 'nosniff',
    })

    const contentLength = mediaResponse.headers.get('Content-Length')
    if (contentLength) headers.set('Content-Length', contentLength)

    return new Response(mediaResponse.body, { status: 200, headers })
  } catch (error) {
    console.error('[Netlify /api/download] Attachment delivery failed:', error)
    return Response.json(
      { success: false, error: 'The file could not be delivered to this device.' },
      { status: 502 },
    )
  }
}

export const config = {
  path: '/api/download',
}
