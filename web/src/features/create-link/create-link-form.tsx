import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import type { z } from 'zod'
import { Button } from '@/components/ui/button'
import { TextField } from '@/components/ui/text-field'
import { ApiError } from '@/lib/api'
import { createLinkSchema } from './create-link-schema'
import { useCreateLink } from './use-create-link'

export function CreateLinkForm() {
  // O input do formulário (`originalUrl`/`slug` antes do transform) e o
  // output do schema (`slug` já normalizado) divergem por causa do
  // `.transform().pipe()` do apelido. Os três genéricos do RHF cobrem isso:
  // TFieldValues = input, TContext = unknown, TTransformedValues = output —
  // com eles `onSubmit` já recebe o valor parseado, sem precisar chamar
  // `createLinkSchema.parse()` de novo dentro do handler.
  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<
    z.input<typeof createLinkSchema>,
    unknown,
    z.output<typeof createLinkSchema>
  >({
    resolver: zodResolver(createLinkSchema),
    defaultValues: { originalUrl: '', slug: '' },
  })

  const { mutateAsync } = useCreateLink()

  async function onSubmit(values: z.output<typeof createLinkSchema>) {
    try {
      await mutateAsync(values)
      reset()
      toast.success('Link criado com sucesso.')
    } catch (error) {
      if (error instanceof ApiError && error.status === 409) {
        // 409 é sempre sobre o apelido: leva o erro ao campo em vez de um
        // toast solto, para o usuário saber exatamente o que corrigir
        setError('slug', { message: error.message }, { shouldFocus: true })
        return
      }

      if (error instanceof ApiError && error.issues) {
        for (const issue of error.issues) {
          if (issue.path === 'originalUrl' || issue.path === 'slug') {
            setError(issue.path, { message: issue.message })
          }
        }
        return
      }

      toast.error(
        error instanceof ApiError
          ? error.message
          : 'Não foi possível criar o link.'
      )
    }
  }

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="flex flex-col gap-5 rounded-lg bg-white p-6 md:p-8"
      noValidate
    >
      <h2 className="text-lg">Novo link</h2>

      <TextField
        label="Link original"
        placeholder="www.exemplo.com.br"
        error={errors.originalUrl?.message}
        {...register('originalUrl')}
      />

      <TextField
        label="Link encurtado"
        prefix="brev.ly/"
        placeholder=" "
        error={errors.slug?.message}
        {...register('slug')}
      />

      <Button type="submit" loading={isSubmitting}>
        Salvar link
      </Button>
    </form>
  )
}
