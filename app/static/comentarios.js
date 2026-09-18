/* ===== +55 Design · comentário em cima do dado =============================================
   Cada gráfico ou tabela que o leitor enxerga ganha, ao lado do título, o estado do comentário
   da área (ou o botão para escrever). O clique abre um painel lateral: o gráfico continua à
   vista enquanto a área escreve, e a Controladoria cura no mesmo lugar.

   A camada só existe quando o servidor manda a configuração (#cmt-config): sem mês aberto e sem
   comentário aprovado, a página é exatamente o relatório aprovado.
   ========================================================================================= */
'use strict';
(function () {
  const cfgEl = document.getElementById('cmt-config');
  if (!cfgEl) return;
  const CFG = JSON.parse(cfgEl.textContent);
  const CSRF = (document.querySelector('meta[name="csrf-token"]') || {}).content || '';
  const BASE = cfgEl.dataset.api;               // /comentarios/api/<comp>
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g,
    c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  const ICONE = '<svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true" fill="none" ' +
    'stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' +
    '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>';
  const ROTULO_STATUS = { rascunho: 'Rascunho', enviado: 'Enviado', aprovado: 'Aprovado', recusado: 'Devolvido' };

  /* ---------- o que o botão diz, bloco a bloco ---------- */
  function resumo(bloco) {
    const b = CFG.blocos[bloco];
    if (!b) return null;
    const minhasAreas = CFG.areas.filter(a => a.blocos.indexOf(bloco) >= 0);
    const podeEscrever = CFG.aberto && minhasAreas.length > 0;
    const estados = Object.values(b.minhas || {}).map(m => m.status);
    const pedido = (b.pedidos || []).some(p => minhasAreas.some(a => a.codigo === p.area) &&
      !(b.minhas[p.area] && ['enviado', 'aprovado'].indexOf(b.minhas[p.area].status) >= 0));
    if (CFG.cura && b.curar) return { rotulo: b.curar + (b.curar > 1 ? ' para curar' : ' para curar'), tom: 'acao' };
    if (estados.indexOf('recusado') >= 0) return { rotulo: 'Devolvido', tom: 'alerta' };
    if (pedido) return { rotulo: 'Pedido da Controladoria', tom: 'acao' };
    if (estados.length) {
      const s = ['rascunho', 'enviado', 'aprovado'].find(x => estados.indexOf(x) >= 0);
      return { rotulo: ROTULO_STATUS[s], tom: s === 'rascunho' ? 'rascunho' : 'ok' };
    }
    if (b.aprovados.length) return { rotulo: b.aprovados.length + (b.aprovados.length > 1 ? ' comentários' : ' comentário'), tom: 'ok' };
    if (podeEscrever) return { rotulo: 'Comentar', tom: 'neutro' };
    if (CFG.cura && CFG.aberto && !CFG.so_ler) return { rotulo: 'Comentários', tom: 'neutro' };
    return null;
  }

  /* onde o botão entra: no título do bloco; a abertura da seção (sem <h3>) usa o cabeçalho */
  function tituloDo(raiz, bloco) {
    if (bloco.endsWith('.abertura')) {
      const sec = document.getElementById(bloco.split('.')[0]);
      return sec ? sec.querySelector('.sec-head h2, .sec-head .h2, .sec-head') : null;
    }
    return raiz.querySelector('h3[data-blk="' + bloco + '"]');
  }

  function montar(raiz) {
    raiz = raiz || document;
    Object.keys(CFG.blocos).forEach(bloco => {
      const alvo = tituloDo(raiz, bloco);
      if (!alvo) return;
      const r = resumo(bloco);
      let btn = alvo.querySelector(':scope > .cmt-btn');
      if (!r) { if (btn) btn.remove(); return; }
      if (!btn) {
        // o botão mora dentro do título; sem isto o leitor de tela anunciaria "Top vendedoras Comentar"
        if (!alvo.hasAttribute('aria-label')) alvo.setAttribute('aria-label', alvo.textContent.trim());
        btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'cmt-btn';
        btn.dataset.bloco = bloco;
        btn.addEventListener('click', ev => { ev.preventDefault(); ev.stopPropagation(); abrir(bloco, btn); });
        alvo.appendChild(btn);
      }
      // só reescreve quando o estado muda — o vigia de redesenho reagiria à própria escrita
      if (btn.dataset.rotulo !== r.rotulo) {
        btn.dataset.rotulo = r.rotulo;
        btn.dataset.tom = r.tom;
        btn.innerHTML = ICONE + '<span>' + esc(r.rotulo) + '</span>';
        btn.setAttribute('aria-label', r.rotulo + ' — comentário da área neste gráfico');
      }
      // comentário aprovado se lê sem clicar: aparece logo abaixo do título
      mostrarAprovados(alvo, bloco);
    });
    montarNosGraficos(raiz);
  }

  /* ---------- um botão em cada gráfico e em cada tabela ----------
     Um bloco pode ter vários gráficos e tabelas; o comentário é do bloco, mas quem está olhando
     para uma tabela não deve ter de subir até o título para achar onde escrever. */
  function blocoDe(el) {
    const dono = el.closest('[data-blk-of]');
    if (!dono) return null;
    if (dono.dataset.blkOf !== '__abre') return dono.dataset.blkOf;
    const sec = el.closest('section[id]');
    return sec ? sec.id + '.abertura' : null;
  }

  function montarNosGraficos(raiz) {
    raiz.querySelectorAll('#main .fig, #main .twz').forEach(el => {
      if (el.closest('#chartzoom')) return;                    // a camada ampliada é só leitura
      const bloco = blocoDe(el);
      const r = bloco && CFG.blocos[bloco] ? resumo(bloco) : null;
      let btn = el.querySelector(':scope > .cmt-mini');
      if (!r) { if (btn) btn.remove(); return; }
      if (!btn) {
        btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'cmt-mini';
        btn.addEventListener('click', ev => { ev.preventDefault(); ev.stopPropagation(); abrir(btn.dataset.bloco, btn); });
        el.appendChild(btn);
      }
      const tipo = el.classList.contains('fig') ? 'gráfico' : 'tabela';
      const chave = bloco + '|' + r.rotulo;
      if (btn.dataset.chave !== chave) {
        btn.dataset.chave = chave;
        btn.dataset.bloco = bloco;
        btn.dataset.tom = r.tom;
        btn.innerHTML = ICONE + '<span class="cmt-mini-rot">' + esc(r.rotulo) + '</span>';
        btn.title = r.rotulo + ' — comentário da área sobre este ' + tipo;
        btn.setAttribute('aria-label', btn.title);
      }
    });
  }

  function mostrarAprovados(alvo, bloco) {
    const b = CFG.blocos[bloco];
    let caixa = alvo.nextElementSibling;
    if (caixa && !caixa.classList.contains('cmt-aprovados')) caixa = null;
    if (!b.aprovados.length) { if (caixa) caixa.remove(); return; }
    if (!caixa) {
      caixa = document.createElement('div');
      caixa.className = 'cmt-aprovados';
      alvo.insertAdjacentElement('afterend', caixa);
    }
    const html = b.aprovados.map(a =>
      '<p><span class="cmt-area">' + esc(a.area) + '</span>' + esc(a.texto) + '</p>').join('');
    if (caixa.dataset.html !== html) { caixa.dataset.html = html; caixa.innerHTML = html; }
  }

  /* ---------- o painel lateral ---------- */
  let painel, atual = null, origem = null, sujo = false;

  function criarPainel() {
    painel = document.createElement('aside');
    painel.className = 'cmt-painel';
    painel.setAttribute('role', 'dialog');
    painel.setAttribute('aria-modal', 'false');
    painel.setAttribute('aria-labelledby', 'cmt-titulo');
    painel.hidden = true;
    painel.innerHTML = '<div class="cmt-cab"><div><div class="cmt-eyebrow" id="cmt-eyebrow"></div>' +
      '<h2 id="cmt-titulo"></h2></div><button type="button" class="cmt-fechar" aria-label="Fechar o painel de comentário">' +
      '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" ' +
      'stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg></button></div>' +
      '<div class="cmt-corpo" id="cmt-corpo"></div><div class="cmt-aviso" role="status" aria-live="polite"></div>';
    document.body.appendChild(painel);
    painel.querySelector('.cmt-fechar').addEventListener('click', fechar);
    document.addEventListener('keydown', ev => { if (ev.key === 'Escape' && !painel.hidden) fechar(); });
  }

  async function abrir(bloco, botao) {
    if (!painel) criarPainel();
    if (sujo && atual !== bloco && !confirm('Há texto não guardado neste comentário. Descartar?')) return;
    atual = bloco; origem = botao || null; sujo = false;
    painel.hidden = false;
    document.body.classList.add('cmt-aberto');
    requestAnimationFrame(() => painel.classList.add('cmt-visivel'));
    painel.querySelector('#cmt-corpo').innerHTML = '<p class="cmt-carregando">Carregando…</p>';
    const alvo = tituloDo(document, bloco);
    if (alvo) alvo.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
    marcarAtivo(bloco);
    const url = new URL(location.href); url.searchParams.set('comentar', bloco);
    history.replaceState(null, '', url);
    try {
      const r = await fetch(BASE + '/' + encodeURIComponent(bloco), { credentials: 'same-origin' });
      if (!r.ok) throw new Error(r.status);
      desenhar(await r.json());
    } catch (e) {
      painel.querySelector('#cmt-corpo').innerHTML =
        '<p class="cmt-erro">Não consegui carregar o comentário. <button type="button" class="cmt-link" id="cmt-tentar">Tentar de novo</button></p>';
      painel.querySelector('#cmt-tentar').addEventListener('click', () => abrir(bloco, origem));
    }
    painel.querySelector('.cmt-fechar').focus();
  }

  function fechar() {
    if (sujo && !confirm('Há texto não guardado neste comentário. Descartar?')) return;
    sujo = false;
    painel.classList.remove('cmt-visivel');
    document.body.classList.remove('cmt-aberto');
    marcarAtivo(null);
    setTimeout(() => { painel.hidden = true; }, 180);
    const url = new URL(location.href); url.searchParams.delete('comentar');
    history.replaceState(null, '', url);
    if (origem) origem.focus();
    atual = null;
  }

  function marcarAtivo(bloco) {
    document.querySelectorAll('.cmt-btn, .cmt-mini').forEach(b => b.classList.toggle('cmt-ativo', b.dataset.bloco === bloco));
  }

  const chip = s => '<span class="cmt-chip" data-status="' + s + '">' + esc(ROTULO_STATUS[s] || s) + '</span>';
  const quando = t => t ? esc(String(t).replace('T', ' ').slice(0, 16)) : '';

  function desenhar(D) {
    painel.querySelector('#cmt-eyebrow').textContent = D.secao + ' · ' + D.comp;
    painel.querySelector('#cmt-titulo').textContent = D.titulo;
    let h = '';
    if (!D.aberto && D.minhas.length) h += '<p class="cmt-nota">' + esc(cap(D.motivo)) + ' Dá para ler, não para escrever.</p>';

    D.minhas.forEach(m => {
      const c = m.comentario, st = c ? c.status : null;
      const editavel = D.aberto && (!c || st === 'rascunho' || st === 'recusado');
      h += '<section class="cmt-bloco" data-area="' + esc(m.area) + '">';
      h += '<div class="cmt-linha"><h3>Comentário da ' + esc(m.nome) + '</h3>' + (st ? chip(st) : '') + '</div>';
      if (m.pedido && editavel) h += '<p class="cmt-pedido"><b>A Controladoria pediu comentário aqui.</b>' +
        (m.pedido.observacao ? ' “' + esc(m.pedido.observacao) + '”' : '') + '</p>';
      if (st === 'recusado') h += '<p class="cmt-recusa"><b>Devolvido:</b> ' + esc(c.motivo) + '</p>';
      if (editavel) {
        const id = 'cmt-txt-' + m.area;
        h += '<label class="cmt-rotulo" for="' + id + '">O que explica este número?</label>' +
          '<textarea id="' + id + '" rows="6" maxlength="4000" data-area="' + esc(m.area) + '">' + esc(c ? c.texto : '') + '</textarea>' +
          '<div class="cmt-ajuda"><span>Só a sua área vê até a Controladoria aprovar.</span><span class="cmt-conta">' +
          (c ? c.texto.length : 0) + '/4000</span></div><div class="cmt-acoes">';
        if (CFG.pode_enviar) {
          h += '<button type="button" class="cmt-bt cmt-bt-primario" data-acao="enviar" data-area="' + esc(m.area) + '">Enviar à Controladoria</button>' +
               '<button type="button" class="cmt-bt" data-acao="escrever" data-area="' + esc(m.area) + '">Salvar rascunho</button>';
        } else {
          h += '<button type="button" class="cmt-bt cmt-bt-primario" data-acao="escrever" data-area="' + esc(m.area) + '">Salvar</button>' +
               '<span class="cmt-dica">Quem envia é o responsável da área.</span>';
        }
        h += '</div>';
      } else if (c) {
        h += '<blockquote class="cmt-texto">' + esc(c.texto) + '</blockquote>';
        if (st === 'enviado') h += '<p class="cmt-dica">Com a Controladoria desde ' + quando(c.enviado_em) + '.</p>';
        if (st === 'aprovado' && c.texto_area) h += '<p class="cmt-dica">A Controladoria ajustou o texto. O que a área enviou: “' + esc(c.texto_area) + '”</p>';
      } else if (!D.aberto) {
        h += '<p class="cmt-dica">Nada escrito por esta área.</p>';
      }
      if (m.historico.length) {
        h += '<details class="cmt-hist"><summary>Histórico (' + m.historico.length + ')</summary><ol>' +
          m.historico.map(x => '<li><span>' + quando(x.em) + '</span> ' + esc(x.quem) + ' · ' + esc(x.acao) +
            (x.detalhes ? ' — ' + esc(x.detalhes) : '') + '</li>').join('') + '</ol></details>';
      }
      h += '</section>';
    });

    if (D.curar.length || D.areas_para_pedir.length) {
      h += '<section class="cmt-bloco cmt-cura"><h3>Curadoria</h3>';
      if (!D.curar.length) h += '<p class="cmt-dica">Nenhuma área enviou comentário neste gráfico.</p>';
      D.curar.forEach(c => {
        const id = 'cmt-cur-' + c.area;
        h += '<div class="cmt-curar" data-area="' + esc(c.area) + '"><div class="cmt-linha"><b>' + esc(c.nome) + '</b>' + chip(c.status) + '</div>' +
          '<label class="cmt-rotulo" for="' + id + '">Texto (ajustar avisa o autor)</label>' +
          '<textarea id="' + id + '" rows="4" maxlength="4000">' + esc(c.texto) + '</textarea>' +
          '<label class="cmt-check"><input type="checkbox" data-campo="apresentacao"' + (c.na_apresentacao ? ' checked' : '') +
          '> Entra na apresentação do mês</label>' +
          '<div class="cmt-acoes"><button type="button" class="cmt-bt cmt-bt-primario" data-acao="aprovar" data-area="' + esc(c.area) + '">' +
          (c.status === 'aprovado' ? 'Salvar' : 'Aprovar') + '</button>' +
          '<button type="button" class="cmt-bt" data-acao="devolver" data-area="' + esc(c.area) + '">Devolver para reescrever</button></div>' +
          '<details class="cmt-recusar"><summary>Recusar com motivo</summary><label class="cmt-rotulo" for="' + id + '-m">Motivo (a área vê)</label>' +
          '<input id="' + id + '-m" type="text" maxlength="400" data-campo="motivo">' +
          '<button type="button" class="cmt-bt cmt-bt-perigo" data-acao="recusar" data-area="' + esc(c.area) + '">Recusar</button></details></div>';
      });
      if (D.aberto && D.areas_para_pedir.length) {
        h += '<details class="cmt-pedir"><summary>Pedir comentário a uma área</summary>' +
          '<label class="cmt-rotulo" for="cmt-pedir-area">Área</label><select id="cmt-pedir-area">' +
          D.areas_para_pedir.map(a => '<option value="' + esc(a.codigo) + '">' + esc(a.nome) + '</option>').join('') + '</select>' +
          '<label class="cmt-rotulo" for="cmt-pedir-obs">O que você quer entender</label><input id="cmt-pedir-obs" type="text" maxlength="300">' +
          '<button type="button" class="cmt-bt" data-acao="pedir">Pedir</button></details>';
      }
      h += '</section>';
    }

    if (D.aprovados.length) {
      h += '<section class="cmt-bloco"><h3>Aprovados</h3>' + D.aprovados.map(a =>
        '<blockquote class="cmt-texto"><span class="cmt-area">' + esc(a.area) + '</span>' + esc(a.texto) + '</blockquote>').join('') + '</section>';
    }
    if (!D.minhas.length && (D.curar.length || D.areas_para_pedir.length)) {
      // o administrador e a Controladoria curam; quem escreve é a área — dizer isso evita a caça ao campo de texto
      h = '<p class="cmt-nota">Você cura os comentários, mas não escreve por nenhuma área. Quem escreve são os ' +
          'usuários dos perfis das áreas (Gestão Comercial, Fábrica, Loja). Aqui você pode pedir comentário a uma ' +
          'área e aprovar o que elas enviarem.</p>' + h;
    }
    if (!h) h = '<p class="cmt-dica">Nada para mostrar aqui.</p>';
    const corpo = painel.querySelector('#cmt-corpo');
    corpo.innerHTML = h;
    corpo.querySelectorAll('textarea').forEach(t => t.addEventListener('input', () => {
      sujo = true;
      const conta = t.parentElement.querySelector('.cmt-conta');
      if (conta) conta.textContent = t.value.length + '/4000';
    }));
    corpo.querySelectorAll('[data-acao]').forEach(b => b.addEventListener('click', () => agir(b)));
  }

  const cap = s => s ? s.charAt(0).toUpperCase() + s.slice(1) : '';

  async function agir(botao) {
    const acao = botao.dataset.acao, area = botao.dataset.area || '';
    // o botão também tem data-area: a caixa é o bloco que o contém (curadoria de uma área ou a área do leitor)
    const caixa = botao.closest('.cmt-curar') || botao.closest('section.cmt-bloco') || botao.closest('details');
    const corpo = { acao: acao, area: area };
    const txt = caixa && caixa.querySelector('textarea');
    if (txt) corpo.texto = txt.value;
    if (acao === 'aprovar') corpo.na_apresentacao = !!(caixa.querySelector('[data-campo="apresentacao"]') || {}).checked;
    if (acao === 'recusar') {
      corpo.motivo = (caixa.querySelector('[data-campo="motivo"]') || {}).value || '';
      if (!corpo.motivo.trim()) { avisar('Diga o motivo: a área precisa saber o que corrigir.', true); return; }
    }
    if (acao === 'pedir') { corpo.area = painel.querySelector('#cmt-pedir-area').value; corpo.observacao = painel.querySelector('#cmt-pedir-obs').value; }
    if ((acao === 'escrever' || acao === 'enviar') && !(corpo.texto || '').trim()) { avisar('Escreva o comentário antes.', true); if (txt) txt.focus(); return; }
    if (acao === 'enviar' && !confirm('Enviar à Controladoria? Depois de enviado, só volta para edição se ela devolver.')) return;
    const original = botao.textContent;
    botao.disabled = true; botao.textContent = 'Salvando…';
    try {
      const r = await fetch(BASE + '/' + encodeURIComponent(atual), {
        method: 'POST', credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': CSRF }, body: JSON.stringify(corpo) });
      const D = await r.json().catch(() => ({}));
      if (!r.ok) {
        const msg = D.erro ? cap(D.erro) : (r.status === 403
          ? 'Sem permissão para gravar aqui (no modo "ver como perfil" nada é gravado).'
          : 'Não consegui salvar (erro ' + r.status + '). O texto continua na tela.');
        avisar(msg, true); botao.disabled = false; botao.textContent = original; return;
      }
      sujo = false;
      atualizarResumo(D);
      desenhar(D);
      avisar(D.mensagem || 'Feito.');
    } catch (e) {
      avisar('Sem conexão com o servidor. O texto continua na tela — tente de novo.', true);
      botao.disabled = false; botao.textContent = original;
    }
  }

  /* depois de uma ação, o botão do gráfico passa a dizer o novo estado */
  function atualizarResumo(D) {
    const b = CFG.blocos[D.bloco];
    if (!b) return;
    b.minhas = {};
    D.minhas.forEach(m => { if (m.comentario) b.minhas[m.area] = { status: m.comentario.status, motivo: m.comentario.motivo }; });
    b.curar = D.curar.filter(c => c.status === 'enviado').length;
    b.aprovados = D.aprovados;
    montar(document);
    marcarAtivo(D.bloco);
  }

  function avisar(msg, erro) {
    const a = painel.querySelector('.cmt-aviso');
    a.textContent = msg;
    a.classList.toggle('cmt-aviso-erro', !!erro);
    a.classList.add('cmt-aviso-on');
    clearTimeout(avisar._t);
    avisar._t = setTimeout(() => a.classList.remove('cmt-aviso-on'), erro ? 6000 : 3500);
  }

  /* os filtros redesenham as seções: o botão volta sozinho */
  function vigiar() {
    const main = document.getElementById('main');
    if (!main) return;
    let pend = false;
    new MutationObserver(() => {
      if (pend) return; pend = true;
      setTimeout(() => { pend = false; montar(document); if (atual) marcarAtivo(atual); }, 60);
    }).observe(main, { childList: true, subtree: true });
  }

  window.CMT = { montar: montar, abrir: abrir };
  function iniciar() {
    montar(document);
    vigiar();
    const pedido = new URL(location.href).searchParams.get('comentar');
    if (pedido && CFG.blocos[pedido]) setTimeout(() => abrir(pedido, tituloDo(document, pedido) &&
      tituloDo(document, pedido).querySelector('.cmt-btn')), 250);
  }
  if (document.readyState === 'complete') setTimeout(iniciar, 80);
  else window.addEventListener('load', () => setTimeout(iniciar, 80));
})();
