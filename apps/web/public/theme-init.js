(function () {
  try {
    var pref = localStorage.getItem('jobward-theme');
    if (pref === null) {
      pref = localStorage.getItem('mr-theme');
      if (pref !== null) localStorage.setItem('jobward-theme', pref);
    }
    var dark =
      pref === 'dark' ||
      ((pref === null || pref === 'system') &&
        window.matchMedia('(prefers-color-scheme: dark)').matches);
    document.documentElement.classList.toggle('dark', dark);
    document.documentElement.style.colorScheme = dark ? 'dark' : 'light';
  } catch {
    /* storage non disponibile: resta il tema chiaro */
  }
})();
