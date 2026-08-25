import { ROUTES } from '@/app/routes'
import notFoundImage from '@/assets/404.svg'

export function LinkNotFound() {
  return (
    <div className="flex min-h-dvh items-center justify-center p-3">
      <div className="flex w-full max-w-lg flex-col items-center gap-6 rounded-lg bg-gray-100 px-5 py-12 text-center md:px-12 md:py-16">
        <img src={notFoundImage} alt="" width={194} height={85} />

        <h1 className="text-xl">Link não encontrado</h1>

        <p className="text-md font-normal text-gray-500">
          O link que você está tentando acessar não existe, foi removido ou é
          uma URL inválida. Saiba mais em{' '}
          <a href={ROUTES.home} className="text-blue-base underline">
            brev.ly
          </a>
          .
        </p>
      </div>
    </div>
  )
}
