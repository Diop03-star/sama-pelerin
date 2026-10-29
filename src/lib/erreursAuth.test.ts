import { describe, expect, it } from 'vitest'
import { messageErreurAuth } from './erreursAuth'

describe('messageErreurAuth', () => {
  it('traduit l’échec d’envoi de l’email de confirmation', () => {
    expect(messageErreurAuth({ code: 'unexpected_failure', message: 'Error sending confirmation email' }))
      .toBe('Impossible d’envoyer l’email de confirmation pour le moment. Réessayez dans quelques minutes.')
  })

  it('traduit un code connu', () => {
    expect(messageErreurAuth({ code: 'email_not_confirmed', message: 'Email not confirmed' }))
      .toMatch(/Confirmez d’abord votre email/)
  })

  it('n’affiche jamais le message brut d’une erreur inconnue', () => {
    expect(messageErreurAuth({ message: 'Database error saving new user' }, 'Message par défaut'))
      .toBe('Message par défaut')
  })
})
