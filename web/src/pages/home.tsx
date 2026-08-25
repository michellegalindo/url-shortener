import logo from '@/assets/logo.svg'
import { CreateLinkForm } from '@/features/create-link/create-link-form'

export function HomePage() {
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-5xl flex-col gap-3 p-3 md:gap-8 md:p-8">
      <img
        src={logo}
        alt="Brev.ly"
        className="h-6 w-fit self-center md:self-start"
      />

      <main className="grid gap-3 md:grid-cols-[minmax(0,380px)_1fr] md:items-start md:gap-5">
        <CreateLinkForm />
      </main>
    </div>
  )
}
