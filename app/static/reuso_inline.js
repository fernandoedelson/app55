/* Fechamento: "Usar a do mês anterior" sem recarregar a página.
   Marcar ou desmarcar a caixa envia o formulário em segundo plano e troca só a linha daquela base pela
   que o servidor devolve; as planilhas já escolhidas nas outras linhas continuam onde estão. */
'use strict';
(function () {
  const aviso = (texto, ok) => {
    const q = document.getElementById('up-progresso');
    if (q) { q.textContent = (ok ? '✓ ' : '✗ ') + texto; q.style.color = ok ? '' : 'var(--crit)'; }
  };

  // depois da confirmação do dialogo.js (que reenvia o formulário), o envio chega aqui
  document.addEventListener('submit', async ev => {
    const form = ev.target;
    if (!form.classList || !form.classList.contains('reuso-flag') || ev.defaultPrevented) return;
    ev.preventDefault();
    const linha = form.closest('tr');
    const base = form.querySelector('[name=base]').value;
    const tabela = document.querySelector('#tabela-bases tbody');
    const posicao = Array.from(tabela.rows).indexOf(linha);
    form.querySelector('input[type=checkbox]').disabled = true;
    try {
      const r = await fetch(form.action, { method: 'POST', body: new FormData(form), credentials: 'same-origin' });
      if (!r.ok) throw new Error('erro ' + r.status);
      const doc = new DOMParser().parseFromString(await r.text(), 'text/html');
      const alvo = doc.querySelector('#tabela-bases tbody');
      const nova = alvo && alvo.rows[posicao];
      const flash = doc.querySelector('.flash');
      const nome = n => n.querySelector('[name=base]') && n.querySelector('[name=base]').value;
      if (!nova || nome(nova) !== base) throw new Error('linha não encontrada');
      linha.replaceWith(document.importNode(nova, true));
      if (window.envioLoteLigar) window.envioLoteLigar();
      aviso(flash ? flash.textContent.trim() : 'Atualizado.', !(flash && /erro|bad/.test(flash.className)));
    } catch (e) {
      aviso('não consegui atualizar a linha (' + e.message + '). Recarregue a página.', false);
      form.querySelector('input[type=checkbox]').disabled = false;
    }
  });
})();
