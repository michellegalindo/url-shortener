export class NoLinksToExport extends Error {
  readonly name = 'NoLinksToExport'

  constructor() {
    super('Não há links para exportar.')
  }
}
