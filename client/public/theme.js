/* Applique le thème choisi avant le premier rendu (évite un flash sombre). */
try {
  var p = localStorage.getItem('wouaff-theme') || 'dark';
  var t = p === 'system' ? (matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark') : p;
  document.documentElement.setAttribute('data-theme', t);
} catch (e) {}
