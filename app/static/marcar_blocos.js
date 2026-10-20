/* Fechamento > Publicar: marcar ou desmarcar todos os blocos de uma vez, com a contagem do que está marcado. */
'use strict';
(function () {
  const barra = document.getElementById('marcar-blocos');
  if (!barra) return;
  const conta = document.getElementById('marcar-conta');
  const caixas = () => Array.from(barra.closest('form').querySelectorAll('input[type=checkbox][name=bloco]'));

  function atualizar() {
    const todas = caixas();
    conta.textContent = todas.filter(c => c.checked).length + ' de ' + todas.length + ' blocos marcados';
  }

  barra.hidden = false;                       // sem script, os botões não aparecem (não fariam nada)
  barra.querySelectorAll('[data-marcar]').forEach(b => b.addEventListener('click', () => {
    const marcar = b.dataset.marcar === '1';
    caixas().forEach(c => { c.checked = marcar; });
    atualizar();
  }));
  barra.closest('form').addEventListener('change', ev => { if (ev.target.name === 'bloco') atualizar(); });
  atualizar();
})();
