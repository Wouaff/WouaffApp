const MONTHS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];

/* Date courte relative : « à l'instant », « 5 min », « 3 h », « 2 j », puis « 12 oct. ». */
export function timeAgo(dateStr: string | number): string {
  const then = new Date(dateStr);
  const diff = Math.floor((Date.now() - then.getTime()) / 1000);
  if (diff < 10) return "à l'instant";
  if (diff < 60) return `${diff} s`;
  if (diff < 3600) return `${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} h`;
  if (diff < 604800) return `${Math.floor(diff / 86400)} j`;
  const sameYear = then.getFullYear() === new Date().getFullYear();
  return `${then.getDate()} ${MONTHS[then.getMonth()]}${sameYear ? '' : ` ${then.getFullYear()}`}`;
}

export function fullDate(dateStr: string | number): string {
  return new Date(dateStr).toLocaleString('fr-FR', { dateStyle: 'long', timeStyle: 'short' });
}

export function monthYear(ts: number): string {
  return new Date(ts).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
}
