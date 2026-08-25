export class SlugAlreadyExists extends Error {
  readonly name = 'SlugAlreadyExists'

  constructor() {
    super('Esse link já está em uso.')
  }
}
