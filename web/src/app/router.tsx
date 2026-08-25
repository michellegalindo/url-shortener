import { createBrowserRouter } from 'react-router'
import { HomePage } from '@/pages/home'
import { NotFoundPage } from '@/pages/not-found'
import { RedirectPage } from '@/pages/redirect'
import { ROUTES } from './routes'

export const router = createBrowserRouter([
  { path: ROUTES.home, element: <HomePage /> },
  { path: ROUTES.redirect, element: <RedirectPage /> },
  { path: ROUTES.notFound, element: <NotFoundPage /> },
])
