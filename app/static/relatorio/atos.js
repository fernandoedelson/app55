/* ===== +55 Design · a reunião em atos (versão da aplicação) ==========================
   Camada de REORGANIZAÇÃO, como o atos.js do Kit: não calcula nada e não desenha nada.
   As seções são desenhadas normalmente (DESENHO[sec]) num palco escondido e os BLOCOS são
   MOVIDOS para dentro dos atos — mover preserva os listeners, então detalhamento, ordenação
   de tabela, zoom e destaques continuam funcionando.

   Diferença para o Kit: lá um MutationObserver precisava repor os blocos que os filtros
   recriavam; aqui a própria página avisa (ctx.remarcar), porque é ela quem redesenha a seção.

   Um bloco negado ao perfil simplesmente não existe no palco: o slot fica vazio e a montagem
   segue. Ato que acabou sem nenhum conteúdo é marcado pelo servidor como restrito.
   =================================================================================== */
'use strict';
(function (G) {

  const filhos = el => (el ? Array.prototype.slice.call(el.children) : []);

  /* Os elementos que pertencem a um bloco (data-blk-of vem do marcarEm do kit.js).
     A corrida de um bloco quase nunca está na raiz da seção: o desenho embrulha tudo num
     "#<sec>-body", e o marcarEm marca esse embrulho com data-blkbox e desce um nível. Então a
     busca desce por caixa, e nunca para dentro de um elemento que já é do bloco (senão o mesmo
     conteúdo viria duas vezes, pai e filho). */
  function corrida(sec, teste) {
    const out = [];
    (function visitar(el) {
      filhos(el).forEach(ch => {
        if (ch.dataset.blkOf !== undefined) { if (teste(ch)) out.push(ch); return; }
        if (ch.dataset.blkbox) visitar(ch);
      });
    })(sec);
    return out;
  }

  function doBloco(sec, blk) {
    return corrida(sec, el => el.dataset.blkOf === blk);
  }

  function daAbertura(sec, semHead, semFiltro) {
    return corrida(sec, el => {
      if (el.dataset.blkOf !== '__abre') return false;
      if (semHead && el.classList.contains('sec-head')) return false;
      if (semFiltro && el.classList.contains('filterbar')) return false;
      return true;
    });
  }

  /* o que cada slot pede, na ordem em que foi escrito no roteiro */
  function paraOSlot(slot, palco) {
    const sec = palco.querySelector('#' + slot.dataset.sec);
    if (!sec) return [];
    if (slot.dataset.blk) return doBloco(sec, slot.dataset.blk);
    if (slot.dataset.filtroSel) {
      const el = sec.querySelector(slot.dataset.filtroSel.replace(/^#[^ ]+/, '#' + slot.dataset.sec + '-body'));
      return el ? [el] : [];
    }
    if (slot.dataset.filtro !== undefined) {
      const el = sec.querySelector('.filterbar');
      return el ? [el] : [];
    }
    if (slot.dataset.abre !== undefined) {
      return daAbertura(sec, slot.dataset.semHead !== undefined, slot.dataset.semFiltro !== undefined);
    }
    return [];
  }

  /* move o conteúdo do palco para os atos. Roda depois de cada desenho de seção. */
  function distribuir(raiz) {
    const palco = document.getElementById('palco');
    if (!palco) return;
    document.querySelectorAll('[data-slot]').forEach(slot => {
      paraOSlot(slot, palco).forEach(el => slot.appendChild(el));
      slot.classList.toggle('vazio', slot.children.length === 0);
    });
    marcarSlots();
    /* o zoom de tabela embrulha cada .tw num .twz NOVO, por observador (setTimeout 0) — e a caixa
       nasce sem dono. Sem esta segunda passada o botão ⤢ fica fora do bloco a que pertence. */
    setTimeout(marcarSlots, 30);
    if (raiz !== false) marcarVazios();
  }

  /* dentro do ato o bloco não está mais sob a seção: quem carimba o dono aqui é o slot */
  function marcarSlots() {
    if (typeof marcarEm !== 'function') return;
    document.querySelectorAll('[data-slot]').forEach(slot => {
      marcarEm(slot, { k: slot.dataset.blk || '__abre' });
    });
  }

  function marcarVazios() {
    document.querySelectorAll('section.ato').forEach(ato => {
      const temConteudo = ato.querySelector('[data-slot] > *');
      ato.classList.toggle('sem-conteudo', !temConteudo && !ato.dataset.restrito);
    });
  }

  /* ---------- modo Apresentar: um ato por vez, em tela cheia ---------- */
  function apresentar(ligar) {
    const body = document.body;
    body.classList.toggle('modo-apresentar', ligar);
    if (ligar) {
      if (document.documentElement.requestFullscreen) document.documentElement.requestFullscreen().catch(() => {});
      irPara(atoAtual());
    } else if (document.fullscreenElement && document.exitFullscreen) {
      document.exitFullscreen().catch(() => {});
    }
  }

  const atos = () => Array.prototype.slice.call(document.querySelectorAll('section.ato'));
  function atoAtual() {
    const a = atos().find(s => s.classList.contains('ato-ativo'));
    return a ? atos().indexOf(a) : 0;
  }
  function irPara(i) {
    const lista = atos();
    if (!lista.length) return;
    const n = Math.max(0, Math.min(lista.length - 1, i));
    lista.forEach((s, k) => s.classList.toggle('ato-ativo', k === n));
    const passo = document.getElementById('ato-passo');
    if (passo) passo.textContent = (n + 1) + ' / ' + lista.length;
    if (!document.body.classList.contains('modo-apresentar')) lista[n].scrollIntoView({ behavior: 'smooth' });
  }

  document.addEventListener('keydown', ev => {
    if (!document.body.classList.contains('modo-apresentar')) return;
    if (ev.key === 'ArrowRight' || ev.key === 'PageDown') { irPara(atoAtual() + 1); ev.preventDefault(); }
    if (ev.key === 'ArrowLeft' || ev.key === 'PageUp') { irPara(atoAtual() - 1); ev.preventDefault(); }
    if (ev.key === 'Escape') apresentar(false);
  });

  G.ATOS = { distribuir, apresentar, irPara, atoAtual };

})(window);
