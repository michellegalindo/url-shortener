import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles/globals.css'

const root = document.getElementById('root')

if (!root) {
  throw new Error('Elemento #root não encontrado no index.html')
}

createRoot(root).render(
  <StrictMode>
    <h1 className="text-xl text-blue-base">Brev.ly</h1>
  </StrictMode>
)
