// ============================================================
// MadinaStock — Fonctions utilitaires partagées
// ============================================================

/**
 * Normalise un numéro de téléphone guinéen vers le format +224XXXXXXXXX,
 * quel que soit le format saisi (0622000001, 622000001, +224622000001,
 * 00224622000001, avec espaces/tirets/points).
 */
export function normaliserTelephone(tel: string): string {
  let t = tel.replace(/[\s\-.]/g, '')

  if (t.startsWith('00224')) t = t.slice(5)
  if (t.startsWith('+224')) t = t.slice(4)
  if (t.startsWith('224') && t.length === 12) t = t.slice(3)
  if (t.startsWith('0') && t.length === 10) t = t.slice(1)

  return '+224' + t
}
