import { describe, expect, it } from 'vitest'
import { isLeft, isRight, makeLeft, makeRight, unwrapEither } from './either'

describe('Either', () => {
  it('identifica um Left', () => {
    const result = makeLeft(new Error('falhou'))
    expect(isLeft(result)).toBe(true)
    expect(isRight(result)).toBe(false)
  })

  it('identifica um Right', () => {
    const result = makeRight({ ok: true })
    expect(isRight(result)).toBe(true)
    expect(isLeft(result)).toBe(false)
  })

  it('desembrulha o valor de cada lado', () => {
    expect(unwrapEither(makeRight(42))).toBe(42)
    expect(unwrapEither(makeLeft('erro'))).toBe('erro')
  })

  it('aceita `true` como valor de sucesso vazio', () => {
    const result = makeRight(true)
    expect(isRight(result)).toBe(true)
    expect(unwrapEither(result)).toBe(true)
  })

  it('rejeita `undefined` em runtime — a armadilha da D7', () => {
    const broken = makeRight(undefined as unknown as string)

    expect(isRight(broken)).toBe(false)
    expect(isLeft(broken)).toBe(false)
    expect(() => unwrapEither(broken)).toThrow()
  })
})
