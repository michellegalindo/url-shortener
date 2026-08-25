import { useState } from 'react'
import { toast } from 'sonner'
import logo from '@/assets/logo.svg'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
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
    <div className="mx-auto flex min-h-dvh w-full max-w-5xl flex-col gap-3 p-3 md:gap-8 md:p-8">
      <img
        src={logo}
        alt="Brev.ly"
        className="h-6 w-fit self-center md:self-start"
      />

      <main className="grid gap-3 md:grid-cols-[minmax(0,380px)_1fr] md:items-start md:gap-5">
        <CreateLinkForm />

        <section className="flex flex-col gap-4 rounded-lg bg-white p-6 md:p-8">
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

      <ConfirmDialog
        open={linkToDelete !== null}
        title="Excluir link"
        description={`O link brev.ly/${linkToDelete?.slug ?? ''} será removido permanentemente. Essa ação não pode ser desfeita.`}
        confirmLabel="Excluir"
        loading={isDeleting}
        onConfirm={handleConfirmDelete}
        onCancel={() => setLinkToDelete(null)}
      />
    </div>
  )
}
