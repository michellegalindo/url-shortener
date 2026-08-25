import { describe, expect, it } from 'vitest'
import { RESERVED_SLUGS } from '../../../server/src/infra/shared/reserved-slugs'
import { ROUTES, STATIC_PATHS } from './routes'

describe('tabela de rotas', () => {
  it('declara as três rotas da aplicação', () => {
    expect(ROUTES.home).toBe('/')
    expect(ROUTES.redirect).toBe('/:slug')
    expect(ROUTES.notFound).toBe('*')
  })

  it('resolve o caminho de um slug', () => {
    expect(ROUTES.redirectTo('meu-link')).toBe('/meu-link')
  })

  it('todo caminho estático do front está reservado no servidor', () => {
    const desprotegidos = STATIC_PATHS.filter(
      path => !RESERVED_SLUGS.includes(path as (typeof RESERVED_SLUGS)[number])
    )

    expect(desprotegidos).toEqual([])
  })
})
