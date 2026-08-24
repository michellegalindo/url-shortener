export type Left<L> = { left: L; right?: never }
export type Right<R> = { left?: never; right: R }
export type Either<L, R> = NonNullable<Left<L> | Right<R>>

export const makeLeft = <L>(value: L): Left<L> => ({ left: value })
export const makeRight = <R>(value: R): Right<R> => ({ right: value })

export const isLeft = <L, R>(e: Either<L, R>): e is Left<L> =>
  e.left !== undefined

export const isRight = <L, R>(e: Either<L, R>): e is Right<R> =>
  e.right !== undefined

export function unwrapEither<L, R>(e: Either<L, R>): NonNullable<L | R> {
  if (e.left !== undefined && e.right !== undefined) {
    throw new Error('Either recebeu left e right ao mesmo tempo')
  }

  if (e.left !== undefined) return e.left as NonNullable<L>
  if (e.right !== undefined) return e.right as NonNullable<R>

  throw new Error('Either não recebeu nem left nem right')
}
