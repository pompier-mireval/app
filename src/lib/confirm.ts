// Enveloppe autour de window.confirm : garde un point d'entrée unique pour
// les confirmations destructrices, au cas où on veut remplacer plus tard
// par une vraie modale plutôt que la boîte de dialogue native.
export function confirmAction(message: string): boolean {
  return window.confirm(message);
}
