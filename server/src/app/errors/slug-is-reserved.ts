export class SlugIsReserved extends Error {
  readonly name = 'SlugIsReserved'

  constructor() {
    super('Esse apelido é reservado pela aplicação.')
  }
}
