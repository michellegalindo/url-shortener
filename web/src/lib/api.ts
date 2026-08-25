import { env } from '@/env'

export type ApiIssue = { path: string; message: string }

/** Formato devolvido pela API em toda resposta que carrega um link. */
export type Link = {
  originalUrl: string
  slug: string
  accessCount: number
  createdAt: string
}

export class ApiError extends Error {
  readonly name = 'ApiError'

  constructor(
    readonly status: number,
    message: string,
    readonly issues?: ApiIssue[]
  ) {
    super(message)
  }

  /** true quando a requisição nem chegou ao servidor */
  get isNetworkError() {
    return this.status === 0
  }
}

const delay = (ms: number) =>
  ms > 0 ? new Promise(resolve => setTimeout(resolve, ms)) : undefined

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  await delay(env.VITE_API_DELAY_MS)

  let response: Response

  try {
    response = await fetch(`${env.VITE_BACKEND_URL}${path}`, {
      ...init,
      headers: { 'content-type': 'application/json', ...init?.headers },
    })
  } catch {
    // fetch só rejeita por falha de transporte; status HTTP de erro resolve
    // normalmente. Status 0 marca "não chegou ao servidor" (D18).
    throw new ApiError(0, 'Não foi possível conectar ao servidor.')
  }

  if (response.status === 204) {
    return undefined as T
  }

  const body = await response.json().catch(() => null)

  if (!response.ok) {
    throw new ApiError(
      response.status,
      body?.message ?? 'Erro inesperado.',
      body?.issues
    )
  }

  return body as T
}
