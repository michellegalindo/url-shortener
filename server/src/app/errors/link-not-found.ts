export class LinkNotFound extends Error {
  readonly name = 'LinkNotFound'

  constructor() {
    super('Link não encontrado.')
  }
}
