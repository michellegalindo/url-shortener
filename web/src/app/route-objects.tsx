import type { RouteObject } from 'react-router'
import { HomePage } from '@/pages/home'
import { NotFoundPage } from '@/pages/not-found'
import { RedirectPage } from '@/pages/redirect'
import { ROUTES } from './routes'

// separado de router.tsx para que routes.spec.ts possa importar as rotas
// declaradas sem disparar createBrowserRouter, que exige `window`/`document`
// e não roda no ambiente de teste node
export const routeObjects: RouteObject[] = [
  { path: ROUTES.home, element: <HomePage /> },
  { path: ROUTES.redirect, element: <RedirectPage /> },
  { path: ROUTES.notFound, element: <NotFoundPage /> },
]
