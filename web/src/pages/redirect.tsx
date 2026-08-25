import { useParams } from 'react-router'
import logoIcon from '@/assets/logo-icon.svg'
import { Button } from '@/components/ui/button'
import { LinkNotFound } from '@/features/redirect/link-not-found'
import { useRedirect } from '@/features/redirect/use-redirect'

export function RedirectPage() {
  const { slug = '' } = useParams<{ slug: string }>()

  const { originalUrl, isNotFound, isUnavailable, retry } = useRedirect(slug)

  if (isNotFound) {
    return <LinkNotFound />
  }

  if (isUnavailable) {
    return (
      <div className="flex min-h-dvh items-center justify-center p-3">
        <div className="flex w-full max-w-lg flex-col items-center gap-6 rounded-lg bg-gray-100 px-5 py-12 text-center md:px-12 md:py-16">
          <img src={logoIcon} alt="Brev.ly" width={48} height={48} />

          <h1 className="text-xl">Não foi possível carregar o link</h1>

          <p className="text-md font-normal text-gray-500">
            {isUnavailable.isNetworkError
              ? 'Verifique sua conexão e tente novamente.'
              : 'O serviço está indisponível no momento.'}
          </p>

          <Button onClick={() => retry()}>Tentar novamente</Button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-dvh items-center justify-center p-3">
      <div className="flex w-full max-w-lg flex-col items-center gap-6 rounded-lg bg-gray-100 px-5 py-12 text-center md:px-12 md:py-16">
        <img src={logoIcon} alt="Brev.ly" width={48} height={48} />

        <h1 className="text-xl">Redirecionando...</h1>

        <div className="flex flex-col gap-1 text-md font-normal text-gray-500">
          <p>O link será aberto automaticamente em alguns instantes.</p>
          <p>
            Não foi redirecionado?{' '}
            {originalUrl ? (
              <a href={originalUrl} className="text-blue-base underline">
                Acesse aqui
              </a>
            ) : (
              'Aguarde...'
            )}
          </p>
        </div>
      </div>
    </div>
  )
}
