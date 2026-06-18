import * as XLSX from 'xlsx'

// ── Helpers ──────────────────────────────────────────────────

// ExcelJS chargé dynamiquement (lazy) pour ne pas alourdir le bundle principal
async function getExcelJS() {
  const mod = await import('exceljs')
  return mod.default
}

function downloadBuffer(buffer: ArrayBuffer, filename: string) {
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function styleHeader(row: any) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  row.eachCell((cell: any) => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF085041' } }
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 }
    cell.alignment = { vertical: 'middle', horizontal: 'center' }
    cell.border = { bottom: { style: 'thin', color: { argb: 'FFD1D5DB' } } }
  })
  row.height = 22
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function addValidation(ws: any, col: string, rowStart: number, rowEnd: number, formulae: string[], prompt?: string) {
  for (let r = rowStart; r <= rowEnd; r++) {
    ws.getCell(`${col}${r}`).dataValidation = {
      type: 'list',
      allowBlank: true,
      formulae,
      showInputMessage: !!prompt,
      promptTitle: 'Valeurs acceptées',
      prompt: prompt ?? '',
      showErrorMessage: true,
      errorStyle: 'warning',
      errorTitle: 'Valeur incorrecte',
      error: 'Choisissez une valeur dans la liste déroulante.',
    }
  }
}

// ── TEMPLATE 1: Dépôts & Gestionnaires ──────────────────────

export async function downloadTemplate1(): Promise<void> {
  const ExcelJS = await getExcelJS()
  const wb = new ExcelJS.Workbook()
  wb.creator = 'MadinaStock'

  // ---- Onglet Dépôts ----
  const ws1 = wb.addWorksheet('Dépôts')
  ws1.columns = [
    { key: 'nom', header: 'Nom du dépôt', width: 28 },
    { key: 'type', header: 'Type', width: 16 },
    { key: 'localisation', header: 'Localisation', width: 22 },
  ]
  styleHeader(ws1.getRow(1))

  const depotsExemples = [
    ['Magasin principal', 'principal', 'Conakry centre'],
    ['Dépôt Madina', 'secondaire', 'Madina'],
    ['Dépôt Ratoma', 'secondaire', 'Ratoma'],
  ]
  depotsExemples.forEach((row) => ws1.addRow(row))

  addValidation(ws1, 'B', 2, 100, ['"principal,secondaire"'], 'principal ou secondaire')

  // ---- Onglet Gestionnaires ----
  const ws2 = wb.addWorksheet('Gestionnaires')
  ws2.columns = [
    { key: 'prenom', header: 'Prénom', width: 16 },
    { key: 'nom', header: 'Nom', width: 16 },
    { key: 'telephone', header: 'Téléphone', width: 16 },
    { key: 'role', header: 'Rôle', width: 16 },
    { key: 'depots', header: 'Dépôts assignés', width: 38 },
  ]
  styleHeader(ws2.getRow(1))

  const gestExemples = [
    ['Mamadou', 'Baldé', '622000001', 'gestionnaire', 'Dépôt Madina'],
    ['Fatoumata', 'Camara', '628000002', 'gestionnaire', 'Dépôt Ratoma, Dépôt Madina'],
    ['Aliou', 'Souaré', '631000003', 'responsable', 'TOUS'],
  ]
  gestExemples.forEach((row) => ws2.addRow(row))

  addValidation(ws2, 'D', 2, 100, ['"gestionnaire,responsable"'], 'gestionnaire ou responsable')

  const buffer = await wb.xlsx.writeBuffer() as ArrayBuffer
  downloadBuffer(buffer, 'modele_depots_gestionnaires.xlsx')
}

// ── TEMPLATE 2: Produits & Stocks ───────────────────────────

const CATEGORIES = [
  'Céréales', 'Huiles & graisses', 'Sucre & confiserie',
  'Boissons', 'Conserves', 'Produits laitiers', 'Autres',
]

const UNITES = ['Sac', 'Bidon', 'Carton', 'Bouteille', 'Boîte', 'Pièce', 'Kg', 'Litre']

export async function downloadTemplate2(depots: string[] = ['Magasin principal', 'Dépôt Madina']): Promise<void> {
  const ExcelJS = await getExcelJS()
  const wb = new ExcelJS.Workbook()
  wb.creator = 'MadinaStock'

  // ---- Onglet caché : Listes (pour les dropdowns dynamiques dépôts) ----
  const wsListes = wb.addWorksheet('Listes')
  wsListes.state = 'veryHidden'
  depots.forEach((nom, i) => {
    wsListes.getCell(i + 1, 1).value = nom
  })
  CATEGORIES.forEach((cat, i) => {
    wsListes.getCell(i + 1, 2).value = cat
  })
  UNITES.forEach((u, i) => {
    wsListes.getCell(i + 1, 3).value = u
  })

  const firstDepot = depots[0] ?? 'Magasin principal'
  const secondDepot = depots[1] ?? 'Dépôt secondaire'

  // ---- Onglet Produits & Stocks ----
  const ws = wb.addWorksheet('Produits & Stocks')
  ws.columns = [
    { key: 'nom', header: 'Nom produit', width: 26 },
    { key: 'categorie', header: 'Catégorie', width: 22 },
    { key: 'unite', header: 'Unité', width: 12 },
    { key: 'seuil_alerte', header: 'Seuil alerte', width: 14 },
    { key: 'seuil_critique', header: 'Seuil critique', width: 16 },
    { key: 'depot', header: 'Nom du dépôt', width: 26 },
    { key: 'qte', header: 'Quantité initiale', width: 18 },
  ]
  styleHeader(ws.getRow(1))

  const exemples = [
    ['Riz importé 50kg', 'Céréales', 'Sac', 20, 10, firstDepot, 150],
    ['Riz importé 50kg', 'Céréales', 'Sac', 20, 10, secondDepot, 45],
    ['Huile végétale 20L', 'Huiles & graisses', 'Bidon', 10, 5, firstDepot, 62],
    ['Sucre 25kg', 'Sucre & confiserie', 'Sac', 15, 5, firstDepot, 30],
  ]
  exemples.forEach((row) => ws.addRow(row))

  // Dropdowns via feuille cachée (dépôts dynamiques)
  const depotsRange = `Listes!$A$1:$A$${depots.length}`
  const catsRange = `Listes!$B$1:$B$${CATEGORIES.length}`
  const unitesRange = `Listes!$C$1:$C$${UNITES.length}`

  for (let r = 2; r <= 200; r++) {
    ws.getCell(`B${r}`).dataValidation = {
      type: 'list', allowBlank: true,
      formulae: [catsRange],
      showErrorMessage: true, errorStyle: 'warning',
      errorTitle: 'Catégorie invalide', error: 'Choisissez dans la liste.',
    }
    ws.getCell(`C${r}`).dataValidation = {
      type: 'list', allowBlank: true,
      formulae: [unitesRange],
      showErrorMessage: true, errorStyle: 'warning',
      errorTitle: 'Unité invalide', error: 'Choisissez dans la liste.',
    }
    ws.getCell(`F${r}`).dataValidation = {
      type: 'list', allowBlank: true,
      formulae: [depotsRange],
      showErrorMessage: true, errorStyle: 'warning',
      errorTitle: 'Dépôt invalide', error: 'Choisissez un dépôt dans la liste.',
    }
  }

  const buffer = await wb.xlsx.writeBuffer() as ArrayBuffer
  downloadBuffer(buffer, 'modele_produits_stocks.xlsx')
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

const CATEGORIES_VALIDES = CATEGORIES
const UNITES_VALIDES = UNITES

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
