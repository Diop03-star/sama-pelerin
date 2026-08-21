export const NUMERO_WHATSAPP = '221773788392'
export const MESSAGE_DEMO = 'Bonjour, je souhaite une démo de SamaPèlerin.'

export function whatsappDemoUrl(): string {
  return `https://wa.me/${NUMERO_WHATSAPP}?text=${encodeURIComponent(MESSAGE_DEMO)}`
}