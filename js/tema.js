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

// Nuestras marcas: "Ver productos" busca la marca en el catálogo.
(function () {
  const buscar = document.getElementById('buscar');
  document.querySelectorAll('.marca-card').forEach(card => {
    const marca = card.dataset.marca;
    const ver = () => {
      if (!buscar) return;
      const todos = document.querySelector('.chip[data-grupo=""]');
      if (todos && !todos.classList.contains('activo')) todos.click();
      buscar.value = marca;
      buscar.dispatchEvent(new Event('input', { bubbles: true }));
      const y = document.getElementById('productos').getBoundingClientRect().top + scrollY - 70;
      scrollTo({ top: y, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
    };
    card.querySelector('.marca-ver').addEventListener('click', e => { e.stopPropagation(); ver(); });
    card.addEventListener('click', e => { if (!e.target.closest('a,button')) ver(); });
  });
})();
