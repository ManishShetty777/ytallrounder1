type LegacyRequest = {
  method: string
  headers: Record<string, string>
  query: Record<string, string>
  url: string
}

type LegacyResponse = {
  setHeader(name: string, value: string | number | string[]): LegacyResponse
  status(code: number): LegacyResponse
  json(body: unknown): Response
  end(body?: BodyInit | null): Response
}

type LegacyHandler = (request: LegacyRequest, response: LegacyResponse) => Promise<Response | void> | Response | void

export async function runLegacyHandler(handler: LegacyHandler, request: Request): Promise<Response> {
  const url = new URL(request.url)
  const responseHeaders = new Headers()
  let statusCode = 200

  const legacyRequest: LegacyRequest = {
    method: request.method,
    headers: Object.fromEntries(request.headers.entries()),
    query: Object.fromEntries(url.searchParams.entries()),
    url: request.url,
  }

  const legacyResponse: LegacyResponse = {
    setHeader(name, value) {
      responseHeaders.set(name, Array.isArray(value) ? value.join(', ') : String(value))
      return legacyResponse
    },
    status(code) {
      statusCode = code
      return legacyResponse
    },
    json(body) {
      if (!responseHeaders.has('Content-Type')) {
        responseHeaders.set('Content-Type', 'application/json; charset=utf-8')
      }

      return new Response(JSON.stringify(body), {
        status: statusCode,
        headers: responseHeaders,
      })
    },
    end(body = null) {
      return new Response(body, {
        status: statusCode,
        headers: responseHeaders,
      })
    },
  }

  const response = await handler(legacyRequest, legacyResponse)

  return response instanceof Response
    ? response
    : new Response(null, { status: statusCode, headers: responseHeaders })
}
