// The server cookie is the only credential; the localStorage flag is for navigation only.
(async function verifySessionOnNavigation() {
  try {
    const response = await fetch('/auth/me', { credentials: 'same-origin', cache: 'no-store' });
    if (response.ok) return;
    if (response.status !== 401) {
      console.warn('O serviço de autenticação está temporariamente indisponível.');
      return;
    }
  } catch (error) {
    console.warn('Não foi possível verificar a sessão.');
    return;
  }
  localStorage.removeItem('autenticado_garagem184');
  window.location.replace('/login.html');
})();
