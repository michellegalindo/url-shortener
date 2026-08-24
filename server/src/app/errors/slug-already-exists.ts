export class SlugAlreadyExists extends Error {
  readonly name = 'SlugAlreadyExists'

  constructor() {
    super('Esse apelido já está em uso.')
  }
}
