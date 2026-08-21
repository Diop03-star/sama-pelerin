import { Link, Outlet } from 'react-router-dom'
import { useAuth } from '../../auth/AuthContext'
import Icon from '../ui/Icon'
import WhatsAppIcon from '../ui/WhatsAppIcon'
import { whatsappDemoUrl } from '../../lib/vitrine'

export default function PublicLayout() {
  const { session } = useAuth()

  return (
    <div className="flex min-h-screen flex-col bg-surface">
      <header className="sticky top-0 z-20 border-b border-outline-variant bg-surface-container-lowest/95 backdrop-blur">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-4 py-3">
          <Link to="/" className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary-container text-on-primary-container">
              <Icon name="mosque" size={18} />
            </div>
            <span className="text-headline-sm font-bold text-primary">SamaPèlerin</span>
          </Link>
          <nav className="hidden items-center gap-6 text-label-md text-on-surface-variant md:flex">
            <Link to="/#avantages" className="hover:text-primary">Avantages</Link>
            <Link to="/#tarifs" className="hover:text-primary">Tarifs</Link>
            <Link to="/tutoriels" className="hover:text-primary">Tutoriels</Link>
            <Link to="/#contact" className="hover:text-primary">Contact</Link>
          </nav>
          <div className="flex items-center gap-2">
            {session ? (
              <Link to="/tableau-de-bord" className="btn-primary px-4 py-2 text-sm">Ouvrir l’app</Link>
            ) : (
              <>
                <Link to="/login" className="btn-secondary px-4 py-2 text-sm">Se connecter</Link>
                <Link to="/signup" className="btn-primary px-4 py-2 text-sm">Essayer gratuitement</Link>
              </>
            )}
          </div>
        </div>
      </header>
      <main className="flex-1"><Outlet /></main>
      <footer className="border-t border-outline-variant bg-surface-container-lowest">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-10 md:flex-row md:justify-between">
          <div>
            <p className="text-headline-sm font-bold text-primary">SamaPèlerin</p>
            <p className="mt-1 text-body-md text-on-surface-variant">
              La gestion des agences de Hajj & Omra, sans Excel ni cahier.
            </p>
          </div>
          <div className="flex flex-col gap-2 text-label-md text-on-surface-variant">
            <Link to="/#avantages" className="hover:text-primary">Avantages</Link>
            <Link to="/#tarifs" className="hover:text-primary">Tarifs</Link>
            <Link to="/tutoriels" className="hover:text-primary">Tutoriels</Link>
            <a href={whatsappDemoUrl()} target="_blank" rel="noreferrer" className="hover:text-primary">Nous contacter</a>
          </div>
          <div>
            <a
              href={whatsappDemoUrl()}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 rounded-lg bg-[#25D366] px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
            >
              <WhatsAppIcon size={18} />
              Demander une démo
            </a>
          </div>
        </div>
        <p className="border-t border-outline-variant px-4 py-4 text-center text-label-md text-on-surface-variant">
          © {new Date().getFullYear()} SamaPèlerin — Dakar, Sénégal
        </p>
      </footer>
    </div>
  )
}