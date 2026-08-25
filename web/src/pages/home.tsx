import { useState } from 'react'
import { toast } from 'sonner'
import logo from '@/assets/logo.svg'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { ScrollToTop } from '@/components/ui/scroll-to-top'
import { CreateLinkForm } from '@/features/create-link/create-link-form'
import { ExportCsvButton } from '@/features/links-list/export-csv-button'
import { LinksList } from '@/features/links-list/links-list'
import { useDeleteLink } from '@/features/links-list/use-delete-link'
import { useLinks } from '@/features/links-list/use-links'
import type { Link } from '@/lib/api'

export function HomePage() {
  const [linkToDelete, setLinkToDelete] = useState<Link | null>(null)

  const { data } = useLinks()
  const { mutateAsync: deleteLink, isPending: isDeleting } = useDeleteLink()

  const isEmpty = (data?.pages[0]?.links.length ?? 0) === 0

  async function handleCopy(shortUrl: string) {
    try {
      await navigator.clipboard.writeText(shortUrl)
      toast.success('Link copiado para a área de transferência.')
    } catch {
      toast.error('Não foi possível copiar o link.')
    }
  }

  async function handleConfirmDelete() {
    if (!linkToDelete) return

    try {
      await deleteLink(linkToDelete.slug)
      toast.success('Link excluído.')
    } catch {
      toast.error('Não foi possível excluir o link.')
    } finally {
      setLinkToDelete(null)
    }
  }

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-5xl flex-col gap-3 px-3 pt-8 pb-3 md:gap-8 md:px-8 md:pt-22 md:pb-8">
      <img
        src={logo}
        alt="Brev.ly"
        className="h-6 w-fit self-center md:self-start"
      />

      {/* minmax(0, …) nas DUAS larguras: a coluna auto do grid herdaria o
          min-content da URL truncada (nowrap) e estouraria a tela no mobile */}
      <main className="grid grid-cols-[minmax(0,1fr)] gap-3 md:grid-cols-[minmax(0,380px)_1fr] md:items-start md:gap-5">
        <CreateLinkForm />

        <section className="flex min-w-0 flex-col gap-4 rounded-lg bg-white p-6 md:p-8">
          <div className="flex items-center justify-between gap-4">
            <h2 className="text-lg">Meus links</h2>
            <ExportCsvButton disabled={isEmpty} />
          </div>

          <LinksList
            onCopy={handleCopy}
            onDelete={setLinkToDelete}
            deletingSlug={isDeleting ? (linkToDelete?.slug ?? null) : null}
          />
        </section>
      </main>

      {/* limiar fixo, não a altura da tela: num monitor alto com poucos links
          a página nunca rola uma tela inteira e o botão jamais apareceria */}
      <ScrollToTop threshold={400} />

      <ConfirmDialog
        open={linkToDelete !== null}
        title="Excluir link"
        description={
          <>
            O link{' '}
            <strong className="font-semibold text-gray-600">
              brev.ly/{linkToDelete?.slug ?? ''}
            </strong>{' '}
            será removido permanentemente. Essa ação não pode ser desfeita.
          </>
        }
        confirmLabel="Excluir"
        loading={isDeleting}
        onConfirm={handleConfirmDelete}
        onCancel={() => setLinkToDelete(null)}
      />
    </div>
  )
}
