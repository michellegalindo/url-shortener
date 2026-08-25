import { ROUTES } from '@/app/routes'
import notFoundImage from '@/assets/404.svg'

export function NotFoundPage() {
  return (
    <div className="flex min-h-dvh items-center justify-center p-3">
      <div className="flex w-full max-w-lg flex-col items-center gap-6 rounded-lg bg-gray-100 px-5 py-12 text-center md:px-12 md:py-16">
        {/* decorativa: o título ao lado já diz o que aconteceu (§5.2.1) */}
        <img src={notFoundImage} alt="" width={194} height={85} />

        <h1 className="text-xl">Página não encontrada</h1>

        <p className="text-md text-gray-500">
          O conteúdo que você tentou acessar não existe.{' '}
          <a href={ROUTES.home} className="text-blue-base underline">
            Voltar para a página inicial
          </a>
        </p>
      </div>
    </div>
  )
}
