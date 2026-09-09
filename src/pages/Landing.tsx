import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useAuth } from '../auth/AuthContext'
import { supabase } from '../lib/supabase'
import type { Tutos } from '../lib/types'
import Icon from '../components/ui/Icon'
import CarteTuto from '../components/vitrine/CarteTuto'
import WhatsAppIcon from '../components/ui/WhatsAppIcon'
import { whatsappDemoUrl } from '../lib/vitrine'
import heroImage from '../assets/mecca.jpg'

const AVANTAGES = [
  { icon: 'payments', titre: 'Paiements échelonnés en FCFA', texte: 'Plans de paiement, tranches avec échéances et calcul automatique du reste dû.' },
  { icon: 'notifications_active', titre: 'Rappels WhatsApp automatiques', texte: 'Vos pèlerins sont relancés automatiquement avant chaque échéance ou expiration de document.' },
  { icon: 'folder_open', titre: 'Dossiers pèlerins centralisés', texte: 'Passeport, visa, vaccination : statut calculé automatiquement, plus rien n’est oublié.' },
  { icon: 'groups', titre: 'Groupes avec quotas', texte: 'Places disponibles, inscrits et préparation de la répartition en amont du départ.' },
  { icon: 'dashboard', titre: 'Tableau de bord orienté action', texte: 'Alertes prioritaires : paiements en retard, encaissements, documents qui expirent.' },
  { icon: 'group_add', titre: 'Multi-utilisateur', texte: 'Gérant et agents travaillent ensemble, chacun avec son rôle.' },
]

const PALIERS = [
  { seuil: 'Dès 100 pèlerins', prix: '1 000 FCFA' },
  { seuil: 'Dès 300 pèlerins', prix: '750 FCFA' },
]

const TRAITS_TARIF = [
  'Sans abonnement mensuel — vous payez selon votre activité',
  'Facturation par campagne (Hajj ou Omra) : rien entre deux saisons',
  'Rappels WhatsApp automatiques inclus',
  'Vos données restent accessibles hors période facturée',
]

const TEMOIGNAGES = [
  { nom: 'Al Hidjah Travel', ville: 'Dakar', texte: '« Nous suivons enfin chaque tranche sans erreur. Les familles savent exactement où elles en sont. »' },
  { nom: 'Voyages Al-Barakah', ville: 'Dakar', texte: '« Les rappels WhatsApp nous ont libérés de la relance manuelle. Un gain de temps énorme. »' },
]

const SECURITE = [
  { icon: 'lock', titre: 'Chiffré en transit', texte: 'Toutes les communications passent en HTTPS.' },
  { icon: 'verified_user', titre: 'Accès cloisonné', texte: 'Chaque agence ne voit que ses propres données.' },
  { icon: 'cloud_done', titre: 'Hébergement sécurisé', texte: 'Données sauvegardées et accessibles toute l’année, même hors saison.' },
]

const TUTOS_EXEMPLE = [
  { titre: 'Créer votre agence et inviter vos agents' },
  { titre: 'Créer un plan de paiement' },
  { titre: 'Suivre les documents d’un pèlerin' },
]

export default function Landing() {
  const { session } = useAuth()
  const { data: tutos = [] } = useQuery({
    queryKey: ['tutos-preview'],
    queryFn: async () => {
      const { data } = await supabase
        .from('tutos')
        .select('*')
        .eq('actif', true)
        .order('ordre', { ascending: true })
        .limit(3)
      return data as Tutos[]
    },
  })

  return (
    <div>
      <section className="mx-auto grid w-full max-w-6xl items-center gap-10 px-4 py-16 lg:grid-cols-2 lg:py-24">
        <div>
          <h1 className="text-display-lg font-bold text-primary">
            Gérez vos pèlerins, leurs paiements et leurs dossiers — simplement.
          </h1>
          <p className="mt-4 text-body-lg text-on-surface-variant">
            SamaPèlerin est l’outil des agences de Hajj & Omra : dossiers administratifs,
            paiements échelonnés en FCFA et rappels WhatsApp, sans Excel ni cahier.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link to="/signup" className="btn-primary px-6 py-3">Essayer gratuitement</Link>
            {session ? (
              <Link to="/tableau-de-bord" className="btn-secondary px-6 py-3">Ouvrir l’app</Link>
            ) : (
              <Link to="/login" className="btn-secondary px-6 py-3">Se connecter</Link>
            )}
          </div>
        </div>
        <img src={heroImage} alt="La Mecque — Masjid al-Haram" className="w-full rounded-card border border-outline-variant shadow-sm" />
      </section>

      <section id="avantages" className="bg-surface-container-low py-16">
        <div className="mx-auto w-full max-w-6xl px-4">
          <h2 className="text-headline-md font-bold text-primary">Pourquoi SamaPèlerin ?</h2>
          <p className="mt-2 text-body-lg text-on-surface-variant">
            Tout ce qu’une agence de pèlerinage doit suivre, réuni dans un seul outil pensé pour le Sénégal.
          </p>
          <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {AVANTAGES.map((a) => (
              <div key={a.titre} className="rounded-card border border-outline-variant bg-surface-container-lowest p-6 shadow-sm">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-secondary-container text-on-secondary-container">
                  <Icon name={a.icon} size={20} />
                </div>
                <h3 className="mt-4 text-headline-sm font-bold text-primary">{a.titre}</h3>
                <p className="mt-2 text-body-md text-on-surface-variant">{a.texte}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="tarifs" className="bg-primary py-16">
        <div className="mx-auto w-full max-w-6xl px-4">
          <h2 className="text-headline-md font-bold text-on-primary">Tarifs simples et adaptés</h2>
          <p className="mt-2 text-body-lg text-on-primary-container">
            Payez selon votre activité : 1 500 FCFA par pèlerin inscrit. Sans abonnement mensuel.
          </p>
          <div className="mx-auto mt-10 grid max-w-4xl gap-6 md:grid-cols-2">
            <div className="flex flex-col rounded-card bg-surface-container-lowest p-6 shadow-sm">
              <h3 className="text-headline-sm font-bold text-primary">À l’usage</h3>
              <p className="mt-3 text-display-lg font-bold text-primary">
                1 500 FCFA
                <span className="text-body-md font-normal text-on-surface-variant"> /pèlerin inscrit</span>
              </p>
              <ul className="mt-6 flex-1 space-y-3 text-body-md text-on-surface-variant">
                {TRAITS_TARIF.map((trait) => (
                  <li key={trait} className="flex items-start gap-2">
                    <Icon name="check_circle" size={18} className="mt-0.5 text-vert" />
                    {trait}
                  </li>
                ))}
              </ul>
              <a href={whatsappDemoUrl()} target="_blank" rel="noreferrer" className="btn-primary mt-8 px-4 py-2.5 text-center">
                Demander une démo
              </a>
            </div>
            <div className="flex flex-col rounded-card bg-secondary-fixed p-6 shadow-sm">
              <h3 className="text-headline-sm font-bold text-on-secondary-fixed-variant">Tarif dégressif</h3>
              <p className="mt-2 text-body-md text-on-secondary-fixed-variant">
                Plus vous inscrivez de pèlerins, moins vous payez par pèlerin.
              </p>
              <div className="mt-6 flex-1 space-y-4">
                {PALIERS.map((p) => (
                  <div key={p.seuil} className="border-b border-secondary-fixed-dim pb-4 last:border-0 last:pb-0">
                    <p className="text-label-md text-on-secondary-fixed-variant">{p.seuil}</p>
                    <p className="mt-1 text-display-lg font-bold text-primary">{p.prix}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="tutoriels" className="py-16">
        <div className="mx-auto w-full max-w-6xl px-4">
          <h2 className="text-headline-md font-bold text-primary">Apprenez à utiliser l’outil</h2>
          <p className="mt-2 text-body-lg text-on-surface-variant">
            Des tutoriels vidéo courts, en français, pour chaque fonctionnalité.
          </p>
          {tutos.length > 0 ? (
            <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {tutos.map((t) => (
                <CarteTuto key={t.id} tuto={t} />
              ))}
            </div>
          ) : (
            <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {TUTOS_EXEMPLE.map((t) => (
                <Link
                  key={t.titre}
                  to="/tutoriels"
                  className="group block overflow-hidden rounded-xl border border-outline-variant bg-surface-container-lowest shadow-sm transition-all hover:shadow-md"
                >
                  <div className="relative flex aspect-video items-center justify-center bg-gradient-to-br from-primary via-navy-light to-secondary">
                    <span className="text-secondary-container transition-transform group-hover:scale-110">
                      <Icon name="play_circle" size={56} />
                    </span>
                    <span className="absolute left-3 top-3 rounded-full bg-secondary-fixed px-2 py-0.5 text-label-md text-on-secondary-fixed-variant">
                      Aperçu
                    </span>
                  </div>
                  <div className="p-4">
                    <h3 className="text-headline-sm font-bold text-primary">{t.titre}</h3>
                  </div>
                </Link>
              ))}
            </div>
          )}
          <div className="mt-10 text-center">
            <Link to="/tutoriels" className="btn-secondary px-6 py-3">Voir tous les tutoriels</Link>
          </div>
        </div>
      </section>

      <section className="bg-surface-container-low py-16">
        <div className="mx-auto w-full max-w-6xl px-4">
          <h2 className="text-headline-md font-bold text-primary">Ils nous font confiance</h2>
          <span className="mt-8 inline-block rounded-full bg-secondary-container px-3 py-1 text-label-md text-on-secondary-container">
            Agences pilotes — Dakar
          </span>
          <div className="mt-4 grid gap-6 md:grid-cols-2">
            {TEMOIGNAGES.map((t) => (
              <figure key={t.nom} className="rounded-card border border-outline-variant bg-surface-container-lowest p-6 shadow-sm">
                <blockquote className="text-body-md text-on-surface">{t.texte}</blockquote>
                <figcaption className="mt-4 text-label-md font-semibold text-primary">{t.nom}</figcaption>
                <p className="text-label-md text-on-surface-variant">{t.ville}</p>
              </figure>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-secondary-container/40 py-12">
        <div className="mx-auto w-full max-w-6xl px-4">
          <h2 className="text-headline-md font-bold text-primary">Vos données, prises au sérieux</h2>
          <div className="mt-8 grid gap-6 md:grid-cols-3">
            {SECURITE.map((s) => (
              <div key={s.titre} className="flex items-start gap-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-surface-container-lowest text-primary">
                  <Icon name={s.icon} size={20} />
                </div>
                <div>
                  <h3 className="text-headline-sm font-bold text-primary">{s.titre}</h3>
                  <p className="mt-1 text-body-md text-on-surface-variant">{s.texte}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="contact" className="bg-primary py-16">
        <div className="mx-auto w-full max-w-6xl px-4 text-center">
          <h2 className="text-headline-md font-bold text-on-primary">Prêt à simplifier votre saison ?</h2>
          <p className="mx-auto mt-2 max-w-xl text-body-lg text-on-primary-container">
            Discutons de votre agence sur WhatsApp : démo guidée et accompagnement à la mise en place.
          </p>
          <a
            href={whatsappDemoUrl()}
            target="_blank"
            rel="noreferrer"
            className="mt-8 inline-flex items-center gap-2 rounded-lg bg-[#25D366] px-6 py-3 font-semibold text-white hover:opacity-90"
          >
            <WhatsAppIcon size={20} />
            Demander une démo
          </a>
        </div>
      </section>
    </div>
  )
}