/* Pilotar a reunião: o roteiro dos atos é editado aqui, salvo como rascunho e gerado.
   Comentários: pedir às áreas e escolher o que aparece na reunião usam a mesma API do
   painel de comentário dos gráficos (/comentarios/api/<comp>/<bloco>). */
(function () {
  'use strict';
  const D = JSON.parse(document.getElementById('pl-dados').textContent);
  const CSRF = (document.querySelector('meta[name="csrf-token"]') || {}).content || '';
  const BLOCO = {}, SECAO = {};
  D.secoes.forEach(s => { SECAO[s.id] = s; s.blocos.forEach(b => { BLOCO[b.id] = Object.assign({ sec: s.id }, b); }); });
  const NOME_AREA = {};
  D.areas.forEach(a => { NOME_AREA[a.codigo] = a.nome; });

  let atos = JSON.parse(JSON.stringify(D.atos));
  let sujo = false;
  const abertos = new Set();            // blocos com a gaveta de comentários aberta

  const $ = s => document.querySelector(s);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  function avisar(msg, erro) {
    const el = $('#pl-aviso');
    el.textContent = msg || '';
    el.className = 'pl-aviso' + (msg ? ' on' : '') + (erro ? ' erro' : '');
    if (msg && !erro) setTimeout(() => { if (el.textContent === msg) avisar(''); }, 4000);
  }
  function marcarSujo(v) { sujo = v; $('#pl-sujo').hidden = !v; }
  addEventListener('beforeunload', e => { if (sujo) { e.preventDefault(); e.returnValue = ''; } });

  function ondeEsta(blk) {
    for (const a of atos) if (a.itens.some(it => it.blk === blk)) return a.n;
    return 0;
  }
  function renumerar() { atos.forEach((a, i) => { a.n = i + 1; }); }

  /* ------------------------------------------------------------ comentários de um bloco */
  function resumoCmt(blk) {
    const c = D.comentarios[blk];
    if (!c) return '<span class="pl-cmt-chip vazio">sem comentário</span>';
    const partes = [];
    const na = c.aprovados.filter(x => x.na_apresentacao).length;
    if (c.aprovados.length) partes.push('<span class="pl-cmt-chip ok">' + c.aprovados.length + ' aprovado' + (c.aprovados.length > 1 ? 's' : '') +
      (na ? ' · ' + na + ' na reunião' : '') + '</span>');
    if (c.enviados) partes.push('<span class="pl-cmt-chip acao">' + c.enviados + ' para curar</span>');
    if (c.pedidos.length) partes.push('<span class="pl-cmt-chip pedido">' + c.pedidos.length + ' pedido' + (c.pedidos.length > 1 ? 's' : '') + '</span>');
    if (c.rascunhos) partes.push('<span class="pl-cmt-chip vazio">' + c.rascunhos + ' em rascunho</span>');
    return partes.join('') || '<span class="pl-cmt-chip vazio">sem comentário</span>';
  }

  function gavetaCmt(blk) {
    const c = D.comentarios[blk] || { aprovados: [], pedidos: [] };
    // a área dona do gráfico primeiro; a Controladoria (que vê tudo) por último
    const quem = (D.quem_ve[blk] || []).slice().sort((a, b) => (a === 'controladoria') - (b === 'controladoria'));
    let h = '<div class="pl-gaveta">';
    if (c.aprovados.length) {
      h += '<p class="pl-g-t">Aprovados — marque o que aparece na reunião, sob o título do gráfico</p><ul class="pl-aprov">';
      c.aprovados.forEach(x => {
        h += '<li><label><input type="checkbox" data-cmt-na="' + esc(x.area) + '"' + (x.na_apresentacao ? ' checked' : '') + '> ' +
          '<b>' + esc(x.nome) + '</b> ' + esc(x.texto) + '</label></li>';
      });
      h += '</ul>';
    }
    if (c.pedidos.length) {
      h += '<p class="pl-g-t">Já pedido</p><ul class="pl-ped">' + c.pedidos.map(p =>
        '<li><b>' + esc(p.nome) + '</b> — ' + esc(p.observacao) + '</li>').join('') + '</ul>';
    }
    if (quem.length) {
      h += '<div class="pl-pedir"><p class="pl-g-t">Solicitar comentário</p>' +
        '<select data-pedir-area>' + quem.map(a => '<option value="' + esc(a) + '">' + esc(NOME_AREA[a] || a) + '</option>').join('') + '</select>' +
        '<textarea data-pedir-obs rows="2" maxlength="1000" placeholder="O que você quer que a área explique neste gráfico?"></textarea>' +
        '<button type="button" class="btn btn-sm btn-secondary" data-pedir>Solicitar</button></div>';
    } else {
      h += '<p class="muted">Nenhuma área que comenta enxerga este gráfico.</p>';
    }
    const sec = (BLOCO[blk] || {}).sec;
    if (sec) h += '<a class="pl-link" target="_blank" rel="noopener" href="' + D.url_biblioteca + '/' + encodeURIComponent(sec) +
      '?comp=' + encodeURIComponent(D.comp) + '&comentar=' + encodeURIComponent(blk) + '">Abrir o gráfico para comentar, aprovar ou ajustar ↗</a>';
    return h + '</div>';
  }

  async function apiCmt(blk, corpo) {
    const r = await fetch(D.url_cmt + '/' + encodeURIComponent(blk), {
      method: 'POST', credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': CSRF }, body: JSON.stringify(corpo) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j.erro || ('erro ' + r.status));
    return j;
  }

  /* ------------------------------------------------------------ desenho */
  function opcoesAdicionar(ato) {
    let h = '<option value="">+ Adicionar ao ato…</option><option value="sub:">Subtítulo</option>';
    D.secoes.forEach(s => {
      const itens = s.blocos.map(b => {
        const em = ondeEsta(b.id);
        return '<option value="blk:' + esc(b.id) + '">' + esc(b.titulo) + (em ? ' — no Ato ' + em + ' (mover)' : '') + '</option>';
      });
      itens.push('<option value="filtro:' + esc(s.id) + '">Filtros da seção</option>');
      if (s.filtro_interno) itens.push('<option value="filtroSel:' + esc(s.id) + '">Filtro do comparativo A × B</option>');
      itens.push('<option value="abre:' + esc(s.id) + '">Abertura da seção (título, indicadores e resumo)</option>');
      h += '<optgroup label="' + esc(s.titulo) + '">' + itens.join('') + '</optgroup>';
    });
    return h;
  }

  function linhaItem(ato, it, i) {
    const setas = '<span class="pl-ctl">' +
      '<button type="button" class="pl-ico" data-mover="-1" title="Subir" aria-label="Subir">↑</button>' +
      '<button type="button" class="pl-ico" data-mover="1" title="Descer" aria-label="Descer">↓</button>' +
      (it.blk ? '<select class="pl-para" data-para title="Mover para outro ato" aria-label="Mover para outro ato"><option value="">Mover…</option>' +
        atos.filter(a => a !== ato).map(a => '<option value="' + a.n + '">Ato ' + a.n + '</option>').join('') + '</select>' : '') +
      '<button type="button" class="pl-ico pl-tirar" data-tirar title="Tirar do ato (volta para o anexo)" aria-label="Tirar do ato">✕</button></span>';
    if (it.sub !== undefined) {
      return '<li class="pl-item pl-sub" data-i="' + i + '"><span class="pl-tipo">Subtítulo</span>' +
        '<input class="pl-sub-in" data-sub value="' + esc(it.sub) + '" maxlength="120" aria-label="Subtítulo">' + setas + '</li>';
    }
    if (it.blk) {
      const b = BLOCO[it.blk] || { titulo: it.blk };
      const aberto = abertos.has(it.blk);
      return '<li class="pl-item pl-blk' + (aberto ? ' aberto' : '') + '" data-i="' + i + '" data-blk="' + esc(it.blk) + '">' +
        '<div class="pl-lin"><span class="pl-num">' + (ato.itens.slice(0, i + 1).filter(x => x.blk).length) + '</span><span class="pl-tit"><b>' + esc(b.titulo) + '</b>' +
        '<small>' + esc((SECAO[it.sec] || {}).titulo || it.sec) + '</small></span>' +
        '<button type="button" class="pl-cmt" data-gaveta aria-expanded="' + aberto + '">' + resumoCmt(it.blk) + '<span class="pl-cmt-v">Comentários ' + (aberto ? '▴' : '▾') + '</span></button>' +
        setas + '</div>' + (aberto ? gavetaCmt(it.blk) : '') + '</li>';
    }
    const rot = it.filtroSel ? 'Filtro do comparativo A × B' : (it.filtro ? 'Filtros da seção' : 'Abertura da seção');
    return '<li class="pl-item pl-ctrl" data-i="' + i + '"><span class="pl-tipo">' + rot + '</span><span class="pl-tit"><small>' +
      esc((SECAO[it.sec] || {}).titulo || it.sec) + '</small></span>' + setas + '</li>';
  }

  function desenhar() {
    const alvo = $('#pl-atos');
    alvo.innerHTML = atos.map((a, ai) =>
      '<section class="pl-ato" data-ato="' + ai + '">' +
      '<header class="pl-ato-h"><span class="pl-ato-n">Ato ' + a.n + '</span>' +
      '<input class="pl-ato-t" data-campo="t" value="' + esc(a.t) + '" maxlength="80" aria-label="Título do ato ' + a.n + '" placeholder="Título do ato">' +
      '<span class="pl-ctl"><button type="button" class="pl-ico" data-ato-mover="-1" title="Subir o ato" aria-label="Subir o ato">↑</button>' +
      '<button type="button" class="pl-ico" data-ato-mover="1" title="Descer o ato" aria-label="Descer o ato">↓</button>' +
      '<button type="button" class="pl-ico pl-tirar" data-ato-tirar title="Excluir o ato" aria-label="Excluir o ato">✕</button></span></header>' +
      '<div class="pl-ato-campos">' +
      '<label class="pl-q">Pergunta que o ato responde<input data-campo="q" value="' + esc(a.q) + '" maxlength="200"></label>' +
      '<label class="pl-min">Tempo<input data-campo="min" value="' + esc(a.min) + '" maxlength="12" placeholder="5 min"></label>' +
      '<label class="pl-cort"><input type="checkbox" data-campo="cortina"' + (a.cortina ? ' checked' : '') + '> Abrir com cortina</label></div>' +
      (a.itens.length ? '<ol class="pl-itens">' + a.itens.map((it, i) => linhaItem(a, it, i)).join('') + '</ol>'
        : '<p class="pl-vazio">Ato só de enunciado: aparece com o título e a pergunta, sem gráficos.</p>') +
      '<select class="pl-add" data-add aria-label="Adicionar ao ato ' + a.n + '">' + opcoesAdicionar(a) + '</select>' +
      '</section>').join('');
  }

  /* ------------------------------------------------------------ edição */
  function tirarDeOutros(blk) {
    atos.forEach(a => { a.itens = a.itens.filter(it => it.blk !== blk); });
  }

  $('#pl-atos').addEventListener('input', ev => {
    const sec = ev.target.closest('.pl-ato'); if (!sec) return;
    const a = atos[+sec.dataset.ato];
    const campo = ev.target.dataset.campo;
    if (campo) { a[campo] = ev.target.type === 'checkbox' ? ev.target.checked : ev.target.value; marcarSujo(true); return; }
    if (ev.target.hasAttribute('data-sub')) {
      a.itens[+ev.target.closest('.pl-item').dataset.i].sub = ev.target.value; marcarSujo(true);
    }
  });

  $('#pl-atos').addEventListener('change', async ev => {
    const sec = ev.target.closest('.pl-ato'); if (!sec) return;
    const a = atos[+sec.dataset.ato];
    if (ev.target.dataset.campo === 'cortina') return;            // já tratado no input
    if (ev.target.hasAttribute('data-add')) {
      const [tipo, id] = ev.target.value.split(':'); ev.target.value = '';
      if (!tipo) return;
      if (tipo === 'sub') a.itens.push({ sub: 'Novo subtítulo' });
      else if (tipo === 'blk') { tirarDeOutros(id); a.itens.push({ sec: BLOCO[id].sec, blk: id }); }
      else if (tipo === 'filtro') a.itens.push({ sec: id, filtro: true });
      else if (tipo === 'filtroSel') a.itens.push({ sec: id, filtroSel: SECAO[id].filtro_interno });
      else if (tipo === 'abre') a.itens.push({ sec: id, abre: true, semHead: true });
      marcarSujo(true); desenhar();
      if (tipo === 'sub') { const ins = document.querySelectorAll('.pl-ato')[+sec.dataset.ato].querySelectorAll('[data-sub]'); const u = ins[ins.length - 1]; if (u) { u.focus(); u.select(); } }
      return;
    }
    if (ev.target.hasAttribute('data-para')) {
      const destino = atos.find(x => x.n === +ev.target.value); if (!destino) return;
      const i = +ev.target.closest('.pl-item').dataset.i;
      destino.itens.push(a.itens.splice(i, 1)[0]);
      marcarSujo(true); desenhar(); avisar('Movido para o Ato ' + destino.n + '.');
      return;
    }
    if (ev.target.hasAttribute('data-cmt-na')) {
      const blk = ev.target.closest('.pl-item').dataset.blk, area = ev.target.dataset.cmtNa, entra = ev.target.checked;
      try {
        await apiCmt(blk, { acao: 'apresentacao', area: area, entra: entra });
        (D.comentarios[blk].aprovados.find(x => x.area === area) || {}).na_apresentacao = entra;
        avisar(entra ? 'O comentário aparece na reunião.' : 'O comentário saiu da reunião.');
        desenhar();
      } catch (e) { ev.target.checked = !entra; avisar(e.message, true); }
    }
  });

  $('#pl-atos').addEventListener('click', async ev => {
    const b = ev.target.closest('button'); if (!b) return;
    const sec = b.closest('.pl-ato'); if (!sec) return;
    const ai = +sec.dataset.ato, a = atos[ai];
    const li = b.closest('.pl-item'), i = li ? +li.dataset.i : -1;
    if (b.hasAttribute('data-mover')) {
      const j = i + (+b.dataset.mover); if (j < 0 || j >= a.itens.length) return;
      [a.itens[i], a.itens[j]] = [a.itens[j], a.itens[i]]; marcarSujo(true); desenhar();
    } else if (b.hasAttribute('data-tirar')) {
      a.itens.splice(i, 1); marcarSujo(true); desenhar();
    } else if (b.hasAttribute('data-ato-mover')) {
      const j = ai + (+b.dataset.atoMover); if (j < 0 || j >= atos.length) return;
      [atos[ai], atos[j]] = [atos[j], atos[ai]]; renumerar(); marcarSujo(true); desenhar();
    } else if (b.hasAttribute('data-ato-tirar')) {
      if (atos.length === 1) { avisar('A reunião precisa de pelo menos um ato.', true); return; }
      const ok = await app55Confirmar({ titulo: 'Excluir o Ato ' + a.n + '?', ok: 'Excluir o ato', tom: 'perigo',
        texto: 'Os gráficos dele voltam para os anexos. Nada é apagado dos dados.' });
      if (!ok) return;
      atos.splice(ai, 1); renumerar(); marcarSujo(true); desenhar();
    } else if (b.hasAttribute('data-gaveta')) {
      const blk = li.dataset.blk;
      abertos.has(blk) ? abertos.delete(blk) : abertos.add(blk); desenhar();
    } else if (b.hasAttribute('data-pedir')) {
      const blk = li.dataset.blk;
      const area = li.querySelector('[data-pedir-area]').value, obs = li.querySelector('[data-pedir-obs]').value.trim();
      if (!obs) { avisar('Escreva o que você quer que a área explique.', true); li.querySelector('[data-pedir-obs]').focus(); return; }
      b.disabled = true;
      try {
        await apiCmt(blk, { acao: 'pedir', area: area, observacao: obs });
        const c = D.comentarios[blk] = D.comentarios[blk] || { aprovados: [], enviados: 0, rascunhos: 0, recusados: 0, pedidos: [] };
        c.pedidos = c.pedidos.filter(p => p.area !== area).concat([{ area: area, nome: NOME_AREA[area] || area, observacao: obs }]);
        avisar('Pedido enviado a ' + (NOME_AREA[area] || area) + ': vira pendência da área.');
        desenhar();
      } catch (e) { avisar(e.message, true); b.disabled = false; }
    }
  });

  $('#pl-novo-ato').addEventListener('click', () => {
    atos.push({ n: atos.length + 1, t: 'Novo ato', q: '', min: '', cortina: false, itens: [] });
    marcarSujo(true); desenhar();
    const t = document.querySelectorAll('.pl-ato-t'); const u = t[t.length - 1]; if (u) { u.focus(); u.select(); }
  });

  $('#pl-comp').addEventListener('change', ev => {
    location.href = location.pathname.replace(/\/apresentacao\/[^/]+\/pilotar/, '/apresentacao/' + encodeURIComponent(ev.target.value) + '/pilotar');
  });

  /* ------------------------------------------------------------ salvar, gerar, descartar */
  function desenharAnexos(anexos) {
    $('#pl-anexos').innerHTML = anexos.map(g =>
      '<div class="pl-anexo"><h3><span>' + esc(g.k) + '</span> ' + esc(g.t) + '</h3>' +
      (g.secoes.length ? '<ul>' + g.secoes.map(s => '<li><b>' + esc(s.titulo) + '</b> — ' + s.blocos.map(b => esc(b.titulo)).join(' · ') + '</li>').join('') + '</ul>'
        : '<p class="muted">Nada: tudo deste anexo está nos atos. Ele não aparece na reunião.</p>') + '</div>').join('');
  }

  function dataBR(t) {
    const m = String(t || '').match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}:\d{2})/);
    return m ? m[3] + '/' + m[2] + '/' + m[1] + ' ' + m[4] : (t || '');
  }

  async function enviar(acao) {
    const TXT = {
      gerar: { titulo: 'Gerar a apresentação?', ok: 'Gerar', texto: 'A reunião de ' + D.comp + ' passa a seguir este roteiro para todos que a abrirem.' },
      descartar: { titulo: 'Descartar o rascunho?', ok: 'Descartar', tom: 'perigo', texto: 'As mudanças não geradas se perdem; o rascunho volta a ser a apresentação em vigor.' },
      padrao: { titulo: 'Voltar ao roteiro padrão?', ok: 'Voltar ao padrão', tom: 'perigo', texto: 'O rascunho passa a ser o roteiro original dos seis atos. A reunião só muda quando você gerar.' },
    };
    if (TXT[acao] && !(await app55Confirmar(TXT[acao]))) return;
    const corpo = { acao: acao };
    if (acao === 'salvar' || acao === 'gerar') corpo.atos = atos;
    document.querySelectorAll('.pl-acoes button').forEach(b => { b.disabled = true; });
    try {
      const r = await fetch(D.url_salvar, { method: 'POST', credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': CSRF }, body: JSON.stringify(corpo) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.erro || ('Não consegui salvar (erro ' + r.status + ').'));
      atos = j.atos; marcarSujo(false); desenhar(); desenharAnexos(j.anexos);
      $('#pl-pend').hidden = !j.estado.pendente;
      $('#pl-vigor').textContent = j.estado.gerado_em ? 'Em vigor: gerada em ' + dataBR(j.estado.gerado_em) + ' por ' + j.estado.gerado_por : 'Em vigor: o roteiro padrão';
      avisar({ salvar: 'Rascunho salvo. A reunião só muda quando você gerar.', gerar: 'Apresentação gerada: a reunião já segue este roteiro.',
        descartar: 'Rascunho descartado.', padrao: 'O rascunho voltou ao roteiro padrão. Gere para valer na reunião.' }[acao]);
    } catch (e) { avisar(e.message, true); }
    document.querySelectorAll('.pl-acoes button').forEach(b => { b.disabled = false; });
  }
  document.querySelectorAll('.pl-acoes [data-acao]').forEach(b => b.addEventListener('click', () => enviar(b.dataset.acao)));

  desenhar();
})();
