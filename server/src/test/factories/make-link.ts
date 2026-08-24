import { faker } from '@faker-js/faker'

export type NewLink = {
  originalUrl: string
  slug: string
  accessCount?: number
  createdAt?: Date
}

export function makeLink(overrides: Partial<NewLink> = {}): NewLink {
  return {
    originalUrl: faker.internet.url(),
    slug: faker.string.alphanumeric({ length: 8, casing: 'lower' }),
    ...overrides,
  }
}
