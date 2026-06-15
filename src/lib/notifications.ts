// ============================================================
// MadinaStock — Notifications (Push PWA, WhatsApp, SMS)
// ============================================================

import { useAppStore } from '../stores/appStore'
import type { BonReception, BonSortie, NotificationType, StockProduit, Utilisateur } from '../types'

const WHATSAPP_PHONE_ID = import.meta.env.VITE_WHATSAPP_PHONE_ID
const WHATSAPP_API_TOKEN = import.meta.env.VITE_WHATSAPP_API_TOKEN
const AFRICAS_TALKING_KEY = import.meta.env.VITE_AFRICAS_TALKING_KEY
const AFRICAS_TALKING_USERNAME = import.meta.env.VITE_AFRICAS_TALKING_USERNAME ?? 'sandbox'

/**
 * Modèles de messages utilisés pour les notifications (push, WhatsApp, SMS).
 */
export const MESSAGES = {
  bonSoumis: (bon: BonSortie) =>
    `📦 Nouveau bon ${bon.numero} — ${bon.motif} — ` +
    `${bon.depot?.nom} — soumis par ${bon.gestionnaire?.nom ?? 'Gestionnaire'}`,

  bonApprouve: (bon: BonSortie) =>
    `✅ Votre bon ${bon.numero} a été APPROUVÉ — ` +
    `${bon.lignes?.map((l) => `${l.qte_accordee} ${l.produit?.unite}(s) de ${l.produit?.nom}`).join(', ')} — ` +
    `Dépôt: ${bon.depot?.nom}`,

  bonRejete: (bon: BonSortie) =>
    `❌ Votre bon ${bon.numero} a été REJETÉ — ` +
    `${bon.depot?.nom} — contactez le propriétaire`,

  bonExpire: (bon: BonSortie) =>
    `⏰ Votre bon ${bon.numero} a expiré sans validation — ` +
    `vous pouvez en soumettre un nouveau`,

  receptionSoumise: (r: BonReception) =>
    `📥 Nouvelle réception ${r.numero} — ${r.fournisseur} — ` +
    `${r.depot?.nom} — valeur: ${r.valeur_totale?.toLocaleString('fr-GN')} GNF`,

  receptionValidee: (r: BonReception) =>
    `✅ Votre réception ${r.numero} a été validée — stock crédité au ${r.depot?.nom ?? ''}`,

  receptionRejetee: (r: BonReception) =>
    `❌ Votre réception ${r.numero} a été rejetée par le propriétaire`,

  alerteSeuil: (sp: StockProduit) =>
    `⚠️ ALERTE STOCK — ${sp.produit?.nom} — ` +
    `${sp.qte_disponible} ${sp.produit?.unite}(s) restant(s) — ` +
    `Dépôt: ${sp.depot?.nom ?? ''} — ` +
    `Seuil: ${sp.seuil_alerte}`,

  alerteCritique: (sp: StockProduit) =>
    `🚨 STOCK CRITIQUE — ${sp.produit?.nom} — ` +
    `SEULEMENT ${sp.qte_disponible} ${sp.produit?.unite}(s) — ` +
    `Dépôt: ${sp.depot?.nom ?? ''} — RÉAPPRO URGENTE`,

  alerteLevee: (sp: StockProduit) =>
    `🟢 Stock rétabli — ${sp.produit?.nom} — ` +
    `${sp.qte_disponible} ${sp.produit?.unite}(s) disponibles — ` +
    `Dépôt: ${sp.depot?.nom ?? ''}`,
}

/**
 * Demande la permission d'affichage des notifications Push au navigateur.
 */
export async function demanderPermissionPush(): Promise<boolean> {
  if (!('Notification' in window)) return false
  if (!('serviceWorker' in navigator)) return false
  if (Notification.permission === 'granted') return true
  if (Notification.permission === 'denied') return false

  const permission = await Notification.requestPermission()
  return permission === 'granted'
}

/**
 * Affiche une notification Push locale via le service worker de la PWA.
 * Utilise `registration.showNotification()` (plutôt que `new Notification()`)
 * afin que la notification puisse s'afficher même lorsque l'app est en
 * arrière-plan (Android), avec vibration et persistance jusqu'au tap.
 */
export async function envoyerPushLocal(
  titre: string,
  corps: string,
  data?: { url?: string; bonId?: string; type?: string; tag?: string }
): Promise<void> {
  if (Notification.permission !== 'granted') {
    const perm = await Notification.requestPermission()
    if (perm !== 'granted') return
  }

  const options: NotificationOptions & { vibrate?: number[]; renotify?: boolean } = {
    body: corps,
    icon: '/pwa-192x192.svg',
    badge: '/pwa-192x192.svg',
    vibrate: [200, 100, 200, 100, 200],
    requireInteraction: true,
    tag: data?.tag ?? 'madina-stock-' + Date.now(),
    renotify: true,
    data: data ?? {},
  }

  if ('serviceWorker' in navigator) {
    const registration = await navigator.serviceWorker.ready
    await registration.showNotification(titre, options)
    return
  }

  new Notification(titre, options)
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
 * Notifie une liste d'utilisateurs et alimente le centre de notifications
 * local (si l'utilisateur connecté sur cet appareil fait partie des
 * destinataires).
 *
 * Cascade 'auto' :
 * - priorite 'critique' : WhatsApp d'abord (fonctionne app fermée sur iOS
 *   et Android), SMS si WhatsApp échoue, puis push en complément.
 * - sinon : push d'abord, WhatsApp en complément.
 */
export async function notifier(params: {
  destinataires: Utilisateur[]
  titre: string
  message: string
  canal?: 'auto' | 'push' | 'whatsapp' | 'sms'
  priorite?: 'normale' | 'haute' | 'critique'
  type?: NotificationType
}): Promise<void> {
  const canal = params.canal ?? 'auto'

  const currentUserId = useAppStore.getState().user?.id
  if (currentUserId && params.destinataires.some((d) => d.id === currentUserId)) {
    useAppStore.getState().addNotification({
      id: crypto.randomUUID(),
      titre: params.titre,
      message: params.message,
      type: params.type ?? 'bon_soumis',
      lu: false,
      created_at: new Date().toISOString(),
    })
  }

  for (const dest of params.destinataires) {
    try {
      if (canal === 'push') {
        await envoyerPushLocal(params.titre, params.message)
      } else if (canal === 'whatsapp') {
        if (dest.contact_wa) await envoyerWhatsApp(dest.contact_wa, params.message)
      } else if (canal === 'sms') {
        if (dest.contact_wa) await envoyerSMS(dest.contact_wa, params.message)
      } else if (params.priorite === 'critique') {
        // CRITIQUE : WhatsApp d'abord (app fermée iOS + Android), SMS si échec, push en complément
        if (dest.contact_wa) {
          try {
            await envoyerWhatsApp(dest.contact_wa, params.message)
          } catch {
            await envoyerSMS(dest.contact_wa, params.message)
          }
        }
        await envoyerPushLocal(params.titre, params.message)
      } else {
        // NORMALE/HAUTE : push d'abord, WhatsApp en complément
        await envoyerPushLocal(params.titre, params.message)
        if (dest.contact_wa) {
          await envoyerWhatsApp(dest.contact_wa, params.message)
        }
      }
    } catch (err) {
      // notifier() est best-effort : un échec d'envoi ne doit jamais
      // interrompre le flux métier appelant (approuverBon, statuerReception, etc.)
      console.warn('notifier: échec de notification', dest.nom, err)
    }
  }
}
