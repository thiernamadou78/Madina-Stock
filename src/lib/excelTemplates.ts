import * as XLSX from 'xlsx'

// ── TEMPLATE 1: Dépôts & Gestionnaires ──────────────────────

export function downloadTemplate1(): void {
  const wb = XLSX.utils.book_new()

  const depotsData = [
    ['Nom du dépôt', 'Type', 'Localisation'],
    ['Magasin principal', 'principal', 'Conakry centre'],
    ['Dépôt Madina', 'secondaire', 'Madina'],
    ['Dépôt Ratoma', 'secondaire', 'Ratoma'],
  ]
  const ws1 = XLSX.utils.aoa_to_sheet(depotsData)
  ws1['!cols'] = [{ wch: 25 }, { wch: 15 }, { wch: 20 }]

  if (ws1['B1']) {
    ws1['B1'].c = [{ a: 'MadinaStock', t: 'Valeurs acceptées: principal, secondaire' }]
  }

  XLSX.utils.book_append_sheet(wb, ws1, 'Dépôts')

  const gestData = [
    ['Prénom', 'Nom', 'Téléphone', 'Rôle', 'Dépôts assignés'],
    ['Mamadou', 'Baldé', '622000001', 'gestionnaire', 'Dépôt Madina'],
    ['Fatoumata', 'Camara', '628000002', 'gestionnaire', 'Dépôt Ratoma, Dépôt Madina'],
    ['Aliou', 'Souaré', '631000003', 'responsable', 'TOUS'],
  ]
  const ws2 = XLSX.utils.aoa_to_sheet(gestData)
  ws2['!cols'] = [{ wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 35 }]

  if (ws2['D1']) {
    ws2['D1'].c = [{ a: 'MadinaStock', t: 'Valeurs: gestionnaire, responsable' }]
  }
  if (ws2['E1']) {
    ws2['E1'].c = [{ a: 'MadinaStock', t: 'Noms exacts des dépôts (onglet Dépôts) séparés par virgule, ou "TOUS"' }]
  }

  XLSX.utils.book_append_sheet(wb, ws2, 'Gestionnaires')

  XLSX.writeFile(wb, 'modele_depots_gestionnaires.xlsx')
}

// ── TEMPLATE 2: Produits & Stocks ───────────────────────────

export function downloadTemplate2(depots: string[] = ['Magasin principal', 'Dépôt Madina']): void {
  const wb = XLSX.utils.book_new()

  const firstDepot = depots[0] ?? 'Magasin principal'
  const secondDepot = depots[1] ?? 'Dépôt secondaire'

  const headers = [
    'Nom produit', 'Catégorie', 'Unité',
    'Seuil alerte', 'Seuil critique', 'Nom du dépôt', 'Quantité initiale',
  ]

  const examples = [
    ['Riz importé 50kg', 'Céréales', 'Sac', 20, 10, firstDepot, 150],
    ['Riz importé 50kg', 'Céréales', 'Sac', 20, 10, secondDepot, 45],
    ['Huile végétale 20L', 'Huiles & graisses', 'Bidon', 10, 5, firstDepot, 62],
    ['Huile végétale 20L', 'Huiles & graisses', 'Bidon', 10, 5, secondDepot, 0],
    ['Sucre 25kg', 'Sucre & confiserie', 'Sac', 15, 5, firstDepot, 30],
  ]

  const wsData = [headers, ...examples]
  const ws = XLSX.utils.aoa_to_sheet(wsData)
  ws['!cols'] = [
    { wch: 25 }, { wch: 20 }, { wch: 10 },
    { wch: 12 }, { wch: 14 }, { wch: 25 }, { wch: 18 },
  ]

  if (ws['B1']) {
    ws['B1'].c = [{ a: 'MadinaStock', t: 'Catégories: Céréales / Huiles & graisses / Sucre & confiserie / Boissons / Conserves / Produits laitiers / Autres' }]
  }
  if (ws['C1']) {
    ws['C1'].c = [{ a: 'MadinaStock', t: 'Unités: Sac / Bidon / Carton / Bouteille / Boîte / Pièce / Kg / Litre' }]
  }
  if (ws['F1']) {
    ws['F1'].c = [{ a: 'MadinaStock', t: 'Doit correspondre exactement au nom dans le fichier Dépôts & Gestionnaires' }]
  }
  if (ws['G1']) {
    ws['G1'].c = [{ a: 'MadinaStock', t: '0 est accepté (stock vide mais produit enregistré)' }]
  }

  XLSX.utils.book_append_sheet(wb, ws, 'Produits & Stocks')
  XLSX.writeFile(wb, 'modele_produits_stocks.xlsx')
}

// ── Types ────────────────────────────────────────────────────

export interface DepotRow {
  nom: string
  type: 'principal' | 'secondaire'
  localisation?: string
  valid: boolean
  errors: string[]
}

export interface GestionnaireRow {
  prenom: string
  nom: string
  telephone: string
  role: string
  depots: string[]
  all_depots: boolean
  valid: boolean
  errors: string[]
}

export interface ProduitStockRow {
  nom_produit: string
  categorie: string
  unite: string
  seuil_alerte: number
  seuil_critique: number
  nom_depot: string
  qte: number
  valid: boolean
  errors: string[]
}

// ── PARSER: Fichier 1 ────────────────────────────────────────

export function parseFichier1(file: File): Promise<{
  depots: DepotRow[]
  gestionnaires: GestionnaireRow[]
}> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target!.result as ArrayBuffer)
        const wb = XLSX.read(data, { type: 'array' })

        const ws1 = wb.Sheets['Dépôts']
        if (!ws1) throw new Error("Onglet 'Dépôts' introuvable")

        const depotsRaw = XLSX.utils.sheet_to_json<{ nom?: string; type?: string; localisation?: string }>(ws1, {
          header: ['nom', 'type', 'localisation'],
          range: 1,
        })

        const depots: DepotRow[] = depotsRaw
          .filter((r) => r.nom)
          .map((r) => {
            const errors: string[] = []
            if (!r.nom?.trim()) errors.push('Nom du dépôt manquant')
            if (!['principal', 'secondaire'].includes(r.type?.trim() ?? ''))
              errors.push(`Type invalide "${r.type}" — utilisez principal ou secondaire`)
            return {
              nom: r.nom?.trim() ?? '',
              type: (r.type?.trim() ?? 'secondaire') as 'principal' | 'secondaire',
              localisation: r.localisation?.trim(),
              valid: errors.length === 0,
              errors,
            }
          })

        const ws2 = wb.Sheets['Gestionnaires']
        if (!ws2) throw new Error("Onglet 'Gestionnaires' introuvable")

        const gestRaw = XLSX.utils.sheet_to_json<{
          prenom?: string; nom?: string; telephone?: string | number
          role?: string; depots_str?: string
        }>(ws2, {
          header: ['prenom', 'nom', 'telephone', 'role', 'depots_str'],
          range: 1,
        })

        const gestionnaires: GestionnaireRow[] = gestRaw
          .filter((r) => r.prenom || r.nom)
          .map((r) => {
            const errors: string[] = []
            if (!r.prenom?.trim()) errors.push('Prénom manquant')
            if (!r.nom?.trim()) errors.push('Nom manquant')
            if (!r.telephone) errors.push('Téléphone manquant')
            if (!['gestionnaire', 'responsable'].includes(r.role?.trim() ?? ''))
              errors.push(`Rôle invalide "${r.role}"`)

            const depotsStr = r.depots_str?.trim() ?? ''
            const all_depots = depotsStr.toUpperCase() === 'TOUS'
            const depotsList = all_depots
              ? []
              : depotsStr.split(',').map((d) => d.trim()).filter(Boolean)

            if (!all_depots && depotsList.length === 0) errors.push('Dépôts assignés manquants')

            return {
              prenom: r.prenom?.trim() ?? '',
              nom: r.nom?.trim() ?? '',
              telephone: String(r.telephone ?? '').trim(),
              role: r.role?.trim() ?? 'gestionnaire',
              depots: depotsList,
              all_depots,
              valid: errors.length === 0,
              errors,
            }
          })

        resolve({ depots, gestionnaires })
      } catch (err) {
        reject(err)
      }
    }
    reader.onerror = reject
    reader.readAsArrayBuffer(file)
  })
}

// ── PARSER: Fichier 2 ────────────────────────────────────────

const CATEGORIES_VALIDES = [
  'Céréales', 'Huiles & graisses', 'Sucre & confiserie',
  'Boissons', 'Conserves', 'Produits laitiers', 'Autres',
]

const UNITES_VALIDES = [
  'Sac', 'Bidon', 'Carton', 'Bouteille', 'Boîte', 'Pièce', 'Kg', 'Litre',
]

export function parseFichier2(file: File): Promise<ProduitStockRow[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target!.result as ArrayBuffer)
        const wb = XLSX.read(data, { type: 'array' })

        const ws = wb.Sheets['Produits & Stocks']
        if (!ws) throw new Error("Onglet 'Produits & Stocks' introuvable")

        const raw = XLSX.utils.sheet_to_json<{
          nom_produit?: string; categorie?: string; unite?: string
          seuil_alerte?: number; seuil_critique?: number
          nom_depot?: string; qte?: number | string
        }>(ws, {
          header: ['nom_produit', 'categorie', 'unite', 'seuil_alerte', 'seuil_critique', 'nom_depot', 'qte'],
          range: 1,
        })

        const rows: ProduitStockRow[] = raw
          .filter((r) => r.nom_produit)
          .map((r) => {
            const errors: string[] = []
            if (!r.nom_produit?.trim()) errors.push('Nom produit manquant')
            if (!CATEGORIES_VALIDES.includes(r.categorie?.trim() ?? ''))
              errors.push(`Catégorie invalide "${r.categorie}"`)
            if (!UNITES_VALIDES.includes(r.unite?.trim() ?? ''))
              errors.push(`Unité invalide "${r.unite}"`)
            if (!r.nom_depot?.trim()) errors.push('Nom du dépôt manquant')

            const qte = Number(r.qte)
            if (isNaN(qte) || qte < 0) errors.push(`Quantité invalide "${r.qte}" — doit être ≥ 0`)

            return {
              nom_produit: r.nom_produit?.trim() ?? '',
              categorie: r.categorie?.trim() ?? 'Autres',
              unite: r.unite?.trim() ?? 'Pièce',
              seuil_alerte: Number(r.seuil_alerte) || 10,
              seuil_critique: Number(r.seuil_critique) || 5,
              nom_depot: r.nom_depot?.trim() ?? '',
              qte: isNaN(qte) ? 0 : Math.max(0, qte),
              valid: errors.length === 0,
              errors,
            }
          })

        resolve(rows)
      } catch (err) {
        reject(err)
      }
    }
    reader.onerror = reject
    reader.readAsArrayBuffer(file)
  })
}
