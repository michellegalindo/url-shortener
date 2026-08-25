import { DownloadSimpleIcon } from '@phosphor-icons/react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { ApiError } from '@/lib/api'
import { useExportLinks } from './use-export-links'

export function ExportCsvButton({ disabled }: { disabled: boolean }) {
  const { mutateAsync, isPending } = useExportLinks()

  async function handleExport() {
    try {
      const { reportUrl } = await mutateAsync()

      // o objeto sobe ao R2 com Content-Disposition: attachment, então
      // assign() baixa em vez de navegar. Criar um <a> e clicar por script
      // seria bloqueado como popup: o clique sintético acontece dentro de um
      // callback assíncrono e deixa de ser gesto confiável
      window.location.assign(reportUrl)
    } catch (error) {
      if (error instanceof ApiError && error.status === 422) {
        toast.error('Não há links para exportar.')
        return
      }

      toast.error('Não foi possível gerar o relatório.')
    }
  }

  return (
    <Button
      variant="secondary"
      density="compact"
      onClick={handleExport}
      loading={isPending}
      disabled={disabled}
    >
      <DownloadSimpleIcon className="size-4 text-gray-600" aria-hidden />
      Baixar CSV
    </Button>
  )
}
