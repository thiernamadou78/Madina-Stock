import { jsPDF } from 'jspdf'
import type { BonReception, BonSortie } from '../types'

const BRAND_COLOR = '#085041'

function addHeader(doc: jsPDF, title: string, numero: string) {
  doc.setFillColor(BRAND_COLOR)
  doc.rect(0, 0, 210, 28, 'F')

  doc.setTextColor('#ffffff')
  doc.setFontSize(18)
  doc.setFont('helvetica', 'bold')
  doc.text('MadinaStock', 14, 12)

  doc.setFontSize(12)
  doc.setFont('helvetica', 'normal')
  doc.text(title, 14, 21)

  doc.setFontSize(12)
  doc.setFont('helvetica', 'bold')
  doc.text(numero, 196, 16, { align: 'right' })

  doc.setTextColor('#000000')
}

function formatDate(value: string | null | undefined): string {
  if (!value) return '-'
  return new Date(value).toLocaleString('fr-FR')
}

/**
 * Génère le PDF d'un bon de sortie.
 */
export function generateBonSortiePDF(bon: BonSortie): jsPDF {
  const doc = new jsPDF()
  addHeader(doc, 'Bon de sortie', bon.numero)

  let y = 40
  doc.setFontSize(11)
  doc.text(`Dépôt : ${bon.depot?.nom ?? '-'}`, 14, y)
  y += 7
  doc.text(`Motif : ${bon.motif}`, 14, y)
  y += 7
  if (bon.motif === 'transfert') {
    doc.text(`Dépôt destination : ${bon.depot_destination?.nom ?? '-'}`, 14, y)
    y += 7
  }
  doc.text(`Gestionnaire : ${bon.gestionnaire?.nom ?? '-'}`, 14, y)
  y += 7
  doc.text(`Statut : ${bon.statut}`, 14, y)
  y += 7
  doc.text(`Créé le : ${formatDate(bon.created_at)}`, 14, y)
  y += 7
  doc.text(`Validé le : ${formatDate(bon.valide_le)}`, 14, y)

  y += 12
  doc.setFont('helvetica', 'bold')
  doc.text('Produit', 14, y)
  doc.text('Qté demandée', 120, y)
  doc.text('Qté accordée', 165, y)
  doc.setFont('helvetica', 'normal')
  y += 2
  doc.line(14, y, 196, y)
  y += 6

  for (const ligne of bon.lignes ?? []) {
    doc.text(ligne.produit?.nom ?? '-', 14, y)
    doc.text(String(ligne.qte_demandee), 120, y)
    doc.text(ligne.qte_accordee != null ? String(ligne.qte_accordee) : '-', 165, y)
    y += 7
  }

  return doc
}

/**
 * Génère le PDF d'un bon de réception.
 */
export function generateBonReceptionPDF(bon: BonReception): jsPDF {
  const doc = new jsPDF()
  addHeader(doc, 'Bon de réception', bon.numero)

  let y = 40
  doc.setFontSize(11)
  doc.text(`Dépôt : ${bon.depot?.nom ?? '-'}`, 14, y)
  y += 7
  doc.text(`Fournisseur : ${bon.fournisseur}`, 14, y)
  y += 7
  doc.text(`Canal : ${bon.canal}`, 14, y)
  y += 7
  doc.text(`Référence document : ${bon.reference_doc ?? '-'}`, 14, y)
  y += 7
  doc.text(`Statut : ${bon.statut}`, 14, y)
  y += 7
  doc.text(`Créé le : ${formatDate(bon.created_at)}`, 14, y)
  y += 7
  doc.text(`Validé le : ${formatDate(bon.valide_le)}`, 14, y)

  y += 12
  doc.setFont('helvetica', 'bold')
  doc.text('Produit', 14, y)
  doc.text('Qté reçue', 120, y)
  doc.text('Prix unitaire', 165, y)
  doc.setFont('helvetica', 'normal')
  y += 2
  doc.line(14, y, 196, y)
  y += 6

  for (const ligne of bon.lignes ?? []) {
    doc.text(ligne.produit?.nom ?? '-', 14, y)
    doc.text(String(ligne.qte_recue), 120, y)
    doc.text(
      ligne.prix_achat_unitaire != null ? String(ligne.prix_achat_unitaire) : '-',
      165,
      y
    )
    y += 7
  }

  if (bon.valeur_totale != null) {
    y += 5
    doc.setFont('helvetica', 'bold')
    doc.text(`Valeur totale : ${bon.valeur_totale} GNF`, 14, y)
  }

  return doc
}

/**
 * Génère et déclenche le téléchargement du PDF d'un bon de sortie.
 */
export function genererPDFBonSortie(bon: BonSortie): void {
  generateBonSortiePDF(bon).save(`${bon.numero}.pdf`)
}

/**
 * Génère et déclenche le téléchargement du PDF d'un bon de réception.
 */
export function genererPDFBonReception(reception: BonReception): void {
  generateBonReceptionPDF(reception).save(`${reception.numero}.pdf`)
}
