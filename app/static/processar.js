/* Fechamento: acompanha a leitura das planilhas, que roda no servidor e leva minutos.
   Pergunta o andamento de tempos em tempos e, quando termina, recarrega a página (o resultado aparece
   como mensagem). Se a conexão cair no meio, tenta de novo: a leitura continua no servidor. */
'use strict';
(function () {
  const caixa = document.getElementById('proc-andamento');
  if (!caixa || !caixa.dataset.ativo) return;
  const segundos = document.getElementById('proc-segundos');
  const inicio = Date.now();
  const tick = setInterval(() => { segundos.textContent = Math.round((Date.now() - inicio) / 1000); }, 1000);

  async function olhar() {
    try {
      const r = await fetch(caixa.dataset.url, { credentials: 'same-origin', cache: 'no-store' });
      if (r.ok) {
        const d = await r.json();
        if (typeof d.segundos === 'number') segundos.textContent = d.segundos;
        if (d.estado !== 'processando') {
          clearInterval(tick);
          caixa.textContent = 'Pronto. Atualizando a página…';
          setTimeout(() => { location.href = location.pathname + '#processar'; location.reload(); }, 800);
          return;
        }
      }
    } catch (e) { /* sem rede por um instante: tenta de novo */ }
    setTimeout(olhar, 3000);
  }
  setTimeout(olhar, 3000);
})();
