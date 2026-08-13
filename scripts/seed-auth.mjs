import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'

config({ path: ['.env.local', '.env'] })

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

const comptes = [
  { email: 'moussa@alhidjah.sn', password: 'Hajj2027!', nom: 'Moussa Ndiaye' },
  { email: 'fatou@alhidjah.sn', password: 'Hajj2027!', nom: 'Fatou Diop' },
  { email: 'omar@albarakah.sn', password: 'Hajj2027!', nom: 'Omar Fall' },
  { email: 'aissatou@albarakah.sn', password: 'Hajj2027!', nom: 'Aissatou Sy' },
]

for (const c of comptes) {
  const { data, error } = await supabase.auth.admin.createUser({
    email: c.email,
    password: c.password,
    email_confirm: true,
    user_metadata: { nom: c.nom },
  })
  if (error) {
    if (error.message.includes('already been registered')) {
      console.log('Déjà existant :', c.email)
    } else {
      console.error('Échec :', c.email, error.message)
    }
    continue
  }
  console.log('OK :', c.email, '→', data.user.id)
}

console.log('Terminé. Les comptes sont reliés aux utilisateurs seedés par le trigger handle_new_user.')