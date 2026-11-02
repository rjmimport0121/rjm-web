// Barra inferior del celular: "Mi lista" abre el panel de la lista de consulta
// y muestra cuántos productos tiene.
(function () {
  const btn = document.getElementById('bmLista'), cuenta = document.getElementById('bmCuenta');
  const fab = document.getElementById('listaFab'), total = document.getElementById('listaCuenta');
  if (!btn || !fab || !total) return;
  btn.addEventListener('click', () => {
    if (+total.textContent > 0) fab.click();
    else if (window.RJM_AVISO) RJM_AVISO('Tu lista está vacía: agrega productos con “+ Lista”.');
  });
  const sync = () => { cuenta.textContent = total.textContent; cuenta.hidden = !(+total.textContent > 0); };
  new MutationObserver(sync).observe(total, { childList: true, characterData: true, subtree: true });
  sync();
})();
