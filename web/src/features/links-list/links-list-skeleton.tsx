// noArrayIndexKey rejects an index key; these rows never reorder or change
// count, so a fixed label per row is a stable, honest key.
const SKELETON_ROWS = ['a', 'b', 'c', 'd'] as const

export function LinksListSkeleton() {
  return (
    <ul className="flex flex-col" aria-hidden>
      {SKELETON_ROWS.map(row => (
        <li
          key={row}
          className="flex items-center justify-between gap-4 border-t border-gray-200 py-4"
        >
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            <div className="h-4 w-32 animate-pulse rounded bg-gray-200" />
            <div className="h-3 w-48 max-w-full animate-pulse rounded bg-gray-200" />
          </div>
          <div className="h-3 w-16 animate-pulse rounded bg-gray-200" />
          <div className="flex gap-1">
            <div className="size-8 animate-pulse rounded bg-gray-200" />
            <div className="size-8 animate-pulse rounded bg-gray-200" />
          </div>
        </li>
      ))}
    </ul>
  )
}
