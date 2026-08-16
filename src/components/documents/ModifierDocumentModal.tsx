import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { majMetadonnees } from '../../lib/documents'
import { LIBELLES_DOCUMENT } from '../../lib/format'
import type { Document } from '../../lib/types'
import Modal from '../ui/Modal'
import Button from '../ui/Button'

interface Props {
  doc: Document
  open: boolean
  onClose: () => void
  onSaved: () => void
}

export default function ModifierDocumentModal({ doc, open, onClose, onSaved }: Props) {
  const [dateExpiration, setDateExpiration] = useState(doc.date_expiration ?? '')
  const [numero, setNumero] = useState(doc.numero_document ?? '')
  const [erreur, setErreur] = useState('')

  const sauver = useMutation({
    mutationFn: async () => {
      await majMetadonnees(doc.id, {
        date_expiration: dateExpiration === '' ? null : dateExpiration,
        numero_document: numero === '' ? null : numero,
      })
    },
    onSuccess: () => {
      onSaved()
      onClose()
    },
    onError: (e: Error) => {
      setErreur(e.message)
    },
  })

  return (
    <Modal open={open} title={`Modifier ${LIBELLES_DOCUMENT[doc.type_document]}`} onClose={onClose}>
      <div className="space-y-4">
        <div>
          <label htmlFor="date-expiration" className="text-label-md text-on-surface-variant">
            Date d’expiration
          </label>
          <input
            id="date-expiration"
            type="date"
            className="input mt-1"
            value={dateExpiration}
            onChange={(e) => setDateExpiration(e.target.value)}
          />
        </div>
        <div>
          <label htmlFor="numero-document" className="text-label-md text-on-surface-variant">
            N° de document
          </label>
          <input
            id="numero-document"
            type="text"
            className="input mt-1"
            placeholder="Ex. : A1234567"
            value={numero}
            onChange={(e) => setNumero(e.target.value)}
          />
        </div>
        {erreur && <p className="text-body-md text-error">{erreur}</p>}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Annuler
          </Button>
          <Button type="button" disabled={sauver.isPending} onClick={() => sauver.mutate()}>
            {sauver.isPending ? 'Enregistrement…' : 'Enregistrer'}
          </Button>
        </div>
      </div>
    </Modal>
  )
}