export class SlugIsReserved extends Error {
  readonly name = 'SlugIsReserved'

  constructor() {
    super('Esse link é reservado pela aplicação.')
  }
}
