// ============================================================
// MadinaStock — Notifications (Push PWA, WhatsApp, SMS)
// ============================================================

import type { BonReception, BonSortie, StockProduit, Utilisateur } from '../types'

const WHATSAPP_PHONE_ID = import.meta.env.VITE_WHATSAPP_PHONE_ID
const WHATSAPP_API_TOKEN = import.meta.env.VITE_WHATSAPP_API_TOKEN
const AFRICAS_TALKING_KEY = import.meta.env.VITE_AFRICAS_TALKING_KEY
const AFRICAS_TALKING_USERNAME = import.meta.env.VITE_AFRICAS_TALKING_USERNAME ?? 'sandbox'

/**
 * Modèles de messages utilisés pour les notifications (push, WhatsApp, SMS).
 */
export const MESSAGES = {
  bonSoumis: (bon: BonSortie) =>
    `📦 Nouveau bon ${bon.numero} — ${bon.motif} — ${bon.depot.nom} — par ${bon.gestionnaire.nom}`,
  bonApprouve: (bon: BonSortie) => `✅ Votre bon ${bon.numero} a été approuvé`,
  bonRejete: (bon: BonSortie) => `❌ Votre bon ${bon.numero} a été rejeté`,
  alerteSeuil: (sp: StockProduit) =>
    `⚠️ ${sp.produit.nom} — Stock: ${sp.qte_disponible} ${sp.produit.unite}(s) — Seuil: ${sp.seuil_alerte}`,
  alerteCritique: (sp: StockProduit) =>
    `🚨 CRITIQUE — ${sp.produit.nom} — ${sp.qte_disponible} ${sp.produit.unite}(s) restant(s)`,
  alerteLevee: (sp: StockProduit) =>
    `🟢 Stock rétabli — ${sp.produit.nom} — ${sp.qte_disponible} ${sp.produit.unite}(s)`,
  receptionValidee: (reception: BonReception) =>
    `✅ Votre réception ${reception.numero} a été validée`,
  receptionSoumise: (r: BonReception) =>
    `📥 Nouvelle réception ${r.numero} — ${r.fournisseur} — ` +
    `${r.depot.nom} — ${r.valeur_totale?.toLocaleString()} GNF`,
}

/**
 * Demande la permission d'affichage des notifications Push au navigateur.
 */
export async function demanderPermissionPush(): Promise<boolean> {
  if (!('Notification' in window)) return false
  if (Notification.permission === 'granted') return true
  if (Notification.permission === 'denied') return false

  const permission = await Notification.requestPermission()
  return permission === 'granted'
}

/**
 * Affiche une notification Push locale via le service worker de la PWA.
 */
export async function envoyerPushLocal(titre: string, corps: string, data?: object): Promise<void> {
  if (!('Notification' in window) || Notification.permission !== 'granted') {
    throw new Error('Permission de notification refusée')
  }

  if ('serviceWorker' in navigator) {
    const registration = await navigator.serviceWorker.ready
    await registration.showNotification(titre, { body: corps, icon: '/pwa-192x192.svg', data })
    return
  }

  new Notification(titre, { body: corps, icon: '/pwa-192x192.svg', data })
}

/**
 * Envoie un message WhatsApp via l'API WhatsApp Business.
 * @param numero Numéro destinataire au format +224XXXXXXXXX
 */
export async function envoyerWhatsApp(numero: string, message: string): Promise<void> {
  if (!WHATSAPP_API_TOKEN || !WHATSAPP_PHONE_ID) {
    throw new Error('Configuration WhatsApp manquante (VITE_WHATSAPP_API_TOKEN / VITE_WHATSAPP_PHONE_ID)')
  }

  const response = await fetch(`https://graph.facebook.com/v18.0/${WHATSAPP_PHONE_ID}/messages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${WHATSAPP_API_TOKEN}`,
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to: numero,
      type: 'text',
      text: { body: message },
    }),
  })

  if (!response.ok) {
    throw new Error(`Échec de l'envoi WhatsApp (${response.status})`)
  }
}

/**
 * Envoie un SMS via l'API Africa's Talking (canal de repli).
 * @param numero Numéro destinataire au format +224XXXXXXXXX
 */
export async function envoyerSMS(numero: string, message: string): Promise<void> {
  if (!AFRICAS_TALKING_KEY) {
    throw new Error('Configuration SMS manquante (VITE_AFRICAS_TALKING_KEY)')
  }

  const response = await fetch('https://api.africastalking.com/version1/messaging', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json',
      apiKey: AFRICAS_TALKING_KEY,
    },
    body: new URLSearchParams({ username: AFRICAS_TALKING_USERNAME, to: numero, message }),
  })

  if (!response.ok) {
    throw new Error(`Échec de l'envoi SMS (${response.status})`)
  }
}

/**
 * Notifie une liste d'utilisateurs. En mode 'auto', tente le Push local,
 * puis bascule sur WhatsApp si le push échoue, puis sur le SMS en dernier recours.
 */
export async function notifier(params: {
  destinataires: Utilisateur[]
  titre: string
  message: string
  canal?: 'auto' | 'push' | 'whatsapp' | 'sms'
}): Promise<void> {
  const canal = params.canal ?? 'auto'

  for (const destinataire of params.destinataires) {
    try {
      if (canal === 'push') {
        await demanderPermissionPush()
        await envoyerPushLocal(params.titre, params.message)
        continue
      }

      if (canal === 'whatsapp') {
        if (destinataire.contact_wa) await envoyerWhatsApp(destinataire.contact_wa, params.message)
        continue
      }

      if (canal === 'sms') {
        if (destinataire.contact_wa) await envoyerSMS(destinataire.contact_wa, params.message)
        continue
      }

      // canal === 'auto' : Push d'abord, puis WhatsApp si échec, puis SMS
      try {
        if (await demanderPermissionPush()) {
          await envoyerPushLocal(params.titre, params.message)
          continue
        }
      } catch {
        // le push a échoué, on tente les canaux de repli ci-dessous
      }

      if (!destinataire.contact_wa) continue

      try {
        await envoyerWhatsApp(destinataire.contact_wa, params.message)
      } catch {
        await envoyerSMS(destinataire.contact_wa, params.message)
      }
    } catch (err) {
      // notifier() est best-effort : un échec d'envoi ne doit jamais
      // interrompre le flux métier appelant (approuverBon, statuerReception, etc.)
      console.warn('notifier: échec de notification', destinataire.nom, err)
    }
  }
}
