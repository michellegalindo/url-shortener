import { useEffect, useId, useRef } from 'react'
import { Button } from './button'

type ConfirmDialogProps = {
  open: boolean
  title: string
  description: string
  confirmLabel: string
  loading?: boolean
  onConfirm: () => void
  onCancel: () => void
}

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  loading = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const ref = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  const descriptionId = useId()

  useEffect(() => {
    const dialog = ref.current

    if (!dialog) return

    // showModal() do <dialog> nativo entrega foco preso, fechamento por Esc
    // e inertização do resto da página — tudo o que um overlay em <div>
    // exigiria implementar à mão
    if (open && !dialog.open) dialog.showModal()
    if (!open && dialog.open) dialog.close()
  }, [open])

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
      onCancel={event => {
        event.preventDefault()
        if (!loading) onCancel()
      }}
      className="m-auto w-[calc(100%-1.5rem)] max-w-md rounded-lg bg-white p-6 backdrop:bg-gray-600/60"
    >
      <div className="flex flex-col gap-4">
        <h2 id={titleId} className="text-lg">
          {title}
        </h2>
        <p id={descriptionId} className="text-md font-normal text-gray-500">
          {description}
        </p>

        <div className="flex justify-end gap-3">
          <Button variant="secondary" onClick={onCancel} disabled={loading}>
            Cancelar
          </Button>
          <Button variant="destructive" onClick={onConfirm} loading={loading}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </dialog>
  )
}
