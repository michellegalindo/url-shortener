import type { InfiniteData } from '@tanstack/react-query'
import { describe, expect, it } from 'vitest'
import {
  keepFirstPage,
  type LinksCache,
  type LinksPage,
  removeLink,
} from './links-cache'

const page = (slug: string, nextCursor: string | null): LinksPage => ({
  links: [
    { slug, originalUrl: 'https://example.com', accessCount: 0, createdAt: '' },
  ],
  nextCursor,
})

describe('keepFirstPage', () => {
  it('descarta todas as páginas além da primeira', () => {
    const data: InfiniteData<LinksPage, string | undefined> = {
      pages: [page('a', 'c1'), page('b', 'c2'), page('c', null)],
      pageParams: [undefined, 'c1', 'c2'],
    }

    expect(keepFirstPage(data)).toEqual({
      pages: [page('a', 'c1')],
      pageParams: [undefined],
    })
  })

  it('mantém intacta uma lista com uma página só', () => {
    const data: InfiniteData<LinksPage, string | undefined> = {
      pages: [page('a', null)],
      pageParams: [undefined],
    }

    expect(keepFirstPage(data)).toEqual(data)
  })

  it('devolve undefined quando o cache está vazio', () => {
    expect(keepFirstPage(undefined)).toBeUndefined()
  })
})

describe('removeLink', () => {
  it('remove o slug de qualquer página, preservando os cursores', () => {
    const data: LinksCache = {
      pages: [page('a', 'c1'), page('b', 'c2'), page('c', null)],
      pageParams: [undefined, 'c1', 'c2'],
    }

    expect(removeLink('b')(data)).toEqual({
      pages: [
        page('a', 'c1'),
        { links: [], nextCursor: 'c2' },
        page('c', null),
      ],
      pageParams: [undefined, 'c1', 'c2'],
    })
  })

  it('mantém os demais links da mesma página', () => {
    const data: LinksCache = {
      pages: [
        {
          links: [...page('a', null).links, ...page('b', null).links],
          nextCursor: null,
        },
      ],
      pageParams: [undefined],
    }

    expect(removeLink('a')(data)?.pages[0]?.links.map(l => l.slug)).toEqual([
      'b',
    ])
  })

  it('devolve undefined quando o cache está vazio', () => {
    expect(removeLink('a')(undefined)).toBeUndefined()
  })
})
