/* +55 · Encaminhamentos durante a reunião.
   Entra só na reunião aberta na aplicação (o HTML para levar não o leva). Um botão fixo abre o
   painel lateral: a Controladoria registra o que foi combinado sem sair da apresentação — o ato e
   o gráfico que estão na tela vêm preenchidos —, e cada responsável marca o seu como feito. */
(function () {
  'use strict';
  var C = window.ENC_55; if (!C) return;
  var lista = C.lista, aberto = false;

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function dataBR(t) { return t && t.length >= 10 ? t.slice(8, 10) + '/' + t.slice(5, 7) + '/' + t.slice(0, 4) : ''; }

  var st = document.createElement('style');
  st.textContent =
    '#enc-bt{position:fixed;right:22px;bottom:22px;z-index:85;display:inline-flex;align-items:center;gap:8px;min-height:42px;' +
    'padding:10px 18px;border:0;border-radius:999px;background:var(--espresso,#211a14);color:#f2eee4;cursor:pointer;' +
    'font:500 13px/1 var(--sans);letter-spacing:.06em;box-shadow:0 10px 30px -10px rgba(33,26,20,.6)}' +
    '#enc-bt:hover{background:#3a2e24}#enc-bt b{display:inline-block;min-width:20px;padding:3px 6px;border-radius:999px;' +
    'background:var(--blue,#92705d);font-size:11px;text-align:center}' +
    '#enc-bt:focus-visible,#enc-p button:focus-visible{outline:2px solid var(--blue,#92705d);outline-offset:2px}' +
    '#enc-p{position:fixed;top:0;right:0;bottom:0;z-index:90;width:min(440px,100vw);display:flex;flex-direction:column;' +
    'background:#fbf9f4;color:var(--ink,#2a211b);box-shadow:-20px 0 60px -20px rgba(33,26,20,.45);' +
    'transform:translateX(100%);transition:transform .22s cubic-bezier(.22,.61,.36,1);font:400 14px/1.5 var(--sans)}' +
    '#enc-p.on{transform:none}' +
    '#enc-p header{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;padding:22px 22px 14px;' +
    'border-bottom:1px solid #e7dfd0}#enc-p header p{margin:0 0 4px;font-size:10.5px;font-weight:600;letter-spacing:.24em;' +
    'text-transform:uppercase;color:var(--blue,#92705d)}#enc-p h2{margin:0;font:400 22px/1.2 var(--serif)}' +
    '#enc-x{width:36px;height:36px;border:1px solid #e7dfd0;border-radius:999px;background:none;cursor:pointer;font-size:18px;color:#6b5d52}' +
    '#enc-c{flex:1;overflow:auto;padding:16px 22px 28px}' +
    '.enc-f{display:grid;gap:10px;padding:14px;border:1px solid #e7dfd0;border-radius:10px;background:#fff;margin-bottom:20px}' +
    '.enc-f label{display:grid;gap:4px;font-size:11px;font-weight:600;letter-spacing:.1em;text-transform:uppercase;color:#6b5d52}' +
    '.enc-f textarea,.enc-f select,.enc-f input{font:400 14px/1.4 var(--sans);color:#2a211b;padding:8px 10px;border:1px solid #d0c4b0;' +
    'border-radius:6px;background:#fff;text-transform:none;letter-spacing:0}' +
    '.enc-f .enc-2{display:grid;grid-template-columns:1fr 150px;gap:10px}' +
    '.enc-f .enc-graf{display:flex;gap:8px;align-items:center;font-weight:400;letter-spacing:0;text-transform:none;font-size:13px;color:#2a211b}' +
    '.enc-bt{min-height:36px;padding:8px 16px;border-radius:999px;border:1px solid #d0c4b0;background:transparent;cursor:pointer;' +
    'font:500 12.5px/1 var(--sans);color:#2a211b}.enc-bt.pri{background:#211a14;border-color:#211a14;color:#f2eee4}' +
    '.enc-bt.pri:hover{background:#614b3e}.enc-bt:disabled{opacity:.5;cursor:default}' +
    '.enc-h{margin:18px 0 8px;font-size:11px;font-weight:600;letter-spacing:.16em;text-transform:uppercase;color:#6b5d52}' +
    '.enc-i{padding:12px 0;border-top:1px solid #e7dfd0}.enc-i p{margin:0}' +
    '.enc-t{font-size:14.5px;color:#2a211b}.enc-m{margin-top:4px;font-size:12.5px;color:#6b5d52}' +
    '.enc-m .tarde{color:var(--bad,#a8493c);font-weight:600}.enc-r{margin-top:6px;font-size:13px;color:#577c69}' +
    '.enc-a{display:flex;flex-wrap:wrap;gap:6px;margin-top:8px}.enc-a textarea{flex:1 1 100%;font:400 13px var(--sans);' +
    'padding:6px 8px;border:1px solid #d0c4b0;border-radius:6px}' +
    '.enc-av{min-height:20px;margin:0 0 10px;font-size:13px;color:#577c69}.enc-av.erro{color:var(--bad,#a8493c)}' +
    '.enc-vazio{color:#9c8e80;font-style:italic}' +
    '@media (prefers-reduced-motion:reduce){#enc-p{transition:none}}';
  document.head.appendChild(st);

  var bt = document.createElement('button');
  bt.id = 'enc-bt'; bt.type = 'button'; bt.setAttribute('aria-controls', 'enc-p');
  document.body.appendChild(bt);
  var p = document.createElement('aside');
  p.id = 'enc-p'; p.setAttribute('aria-label', 'Encaminhamentos da reunião'); p.hidden = true;
  p.innerHTML = '<header><div><p>Reunião · ' + esc(C.comp) + '</p><h2>Encaminhamentos</h2></div>' +
    '<button type="button" id="enc-x" aria-label="Fechar">×</button></header><div id="enc-c"></div>';
  document.body.appendChild(p);

  function contar() {
    var n = lista.itens.filter(function (e) { return e.status === 'aberto' || e.status === 'feito'; }).length +
      lista.retomada.length;
    bt.innerHTML = 'Encaminhamentos' + (n ? ' <b>' + n + '</b>' : '');
  }

  /* o ato e o gráfico que estão na tela agora */
  function onde() {
    var ato = 0, bloco = '', titulo = '';
    document.querySelectorAll('section.ato').forEach(function (s) {
      var r = s.getBoundingClientRect();
      if (r.top <= innerHeight * 0.4 && r.bottom > innerHeight * 0.4) ato = +String(s.id).replace('ato', '');
    });
    if (ato) {
      document.querySelectorAll('#ato' + ato + ' h3[data-blk]').forEach(function (h) {
        if (h.getBoundingClientRect().top < innerHeight * 0.6) {
          bloco = h.getAttribute('data-blk'); titulo = (h.firstChild && h.firstChild.textContent || h.textContent).trim();
        }
      });
    }
    return { ato: ato, bloco: bloco, titulo: titulo };
  }

  function item(e) {
    var h = '<div class="enc-i" data-id="' + e.id + '"><p class="enc-t">' + esc(e.texto) + '</p>' +
      '<p class="enc-m">' + esc(e.responsavel) + (e.prazo ? ' · <span class="' + (e.atrasado ? 'tarde' : '') + '">prazo ' +
      dataBR(e.prazo) + (e.atrasado ? ' — atrasado' : '') + '</span>' : '') + ' · ' + esc(e.situacao) +
      (e.ato ? '<br>' + esc(e.ato) + (e.bloco ? ' · ' + esc(e.bloco) : '') : '') +
      (e.competencia !== C.comp ? '<br>combinado em ' + esc(e.competencia) : '') + '</p>';
    if (e.resposta) h += '<p class="enc-r">Feito: ' + esc(e.resposta) + '</p>';
    var a = '';
    if (e.pode_feito) a += '<textarea rows="2" data-resp placeholder="O que foi feito"></textarea>' +
      '<button type="button" class="enc-bt pri" data-acao="feito">Marcar feito</button>';
    if (e.pode_curar) {
      if (e.status === 'feito') a += '<button type="button" class="enc-bt pri" data-acao="confirmar">Confirmar</button>' +
        '<button type="button" class="enc-bt" data-acao="reabrir">Reabrir</button>';
      a += '<button type="button" class="enc-bt" data-acao="cancelar">Cancelar</button>';
    }
    return h + (a ? '<div class="enc-a">' + a + '</div>' : '') + '</div>';
  }

  function desenhar(msg, erro) {
    var o = onde(), h = '<p class="enc-av' + (erro ? ' erro' : '') + '" role="status" aria-live="polite">' + esc(msg || '') + '</p>';
    if (C.cura) {
      h += '<form class="enc-f" id="enc-form"><label>O que ficou combinado<textarea name="texto" rows="3" maxlength="2000" required></textarea></label>' +
        '<div class="enc-2"><label>Responsável<select name="responsavel" required><option value="">Escolha…</option>' +
        C.pessoas.map(function (u) { return '<option value="' + esc(u.login) + '">' + esc(u.rotulo) + '</option>'; }).join('') +
        '</select></label><label>Prazo<input type="date" name="prazo"></label></div>' +
        '<label>Ato<select name="ato"><option value="0">Fora dos atos</option>' + C.atos.map(function (a) {
          return '<option value="' + a.n + '"' + (a.n === o.ato ? ' selected' : '') + '>Ato ' + a.n + ' · ' + esc(a.t) + '</option>'; }).join('') +
        '</select></label>' +
        (o.bloco ? '<label class="enc-graf"><input type="checkbox" name="bloco" value="' + esc(o.bloco) + '" checked> Ligar ao gráfico “' + esc(o.titulo) + '”</label>' : '') +
        '<div><button class="enc-bt pri" type="submit">Registrar</button></div></form>';
    }
    h += '<p class="enc-h">Desta reunião</p>' + (lista.itens.length ? lista.itens.map(item).join('') :
      '<p class="enc-vazio">Nada combinado ainda.</p>');
    if (lista.retomada.length) h += '<p class="enc-h">Retomada — o que ficou dos meses anteriores</p>' + lista.retomada.map(item).join('');
    document.getElementById('enc-c').innerHTML = h;
    contar();
  }

  function abrir() {
    aberto = true; p.hidden = false; desenhar();
    requestAnimationFrame(function () { p.classList.add('on'); });
    var t = p.querySelector('textarea, button'); if (t) t.focus();
    bt.setAttribute('aria-expanded', 'true');
  }
  function fechar() {
    aberto = false; p.classList.remove('on'); bt.setAttribute('aria-expanded', 'false');
    setTimeout(function () { if (!aberto) p.hidden = true; }, 230); bt.focus();
  }
  bt.addEventListener('click', function () { aberto ? fechar() : abrir(); });
  p.querySelector('#enc-x').addEventListener('click', fechar);
  document.addEventListener('keydown', function (ev) { if (ev.key === 'Escape' && aberto) { ev.stopPropagation(); fechar(); } }, true);
  /* as setas e as teclas do modo apresentação não podem agir enquanto se digita no painel */
  p.addEventListener('keydown', function (ev) { if (ev.key !== 'Escape') ev.stopPropagation(); });

  function api(corpo) {
    return fetch(C.api, { method: 'POST', credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': C.csrf }, body: JSON.stringify(corpo) })
      .then(function (r) { return r.json().catch(function () { return {}; }).then(function (j) {
        if (!r.ok) throw new Error(j.erro || ('erro ' + r.status)); return j; }); });
  }

  p.addEventListener('submit', function (ev) {
    ev.preventDefault();
    var f = ev.target, b = f.querySelector('button[type=submit]');
    var corpo = { acao: 'criar', texto: f.texto.value, responsavel: f.responsavel.value, prazo: f.prazo.value,
      ato: f.ato.value, bloco: f.bloco && f.bloco.checked ? f.bloco.value : '' };
    if (!corpo.texto.trim()) { desenhar('Escreva o que ficou combinado.', true); return; }
    if (!corpo.responsavel) { desenhar('Escolha o responsável.', true); return; }
    b.disabled = true;
    api(corpo).then(function (j) { lista = j; desenhar('Registrado. O responsável vê em Pendências.'); })
      .catch(function (e) { b.disabled = false; desenhar(e.message, true); });
  });

  p.addEventListener('click', function (ev) {
    var b = ev.target.closest('[data-acao]'); if (!b) return;
    var it = b.closest('.enc-i'), acao = b.getAttribute('data-acao');
    if (acao === 'cancelar' && b.getAttribute('data-certeza') !== '1') {
      b.setAttribute('data-certeza', '1'); b.textContent = 'Cancelar mesmo?'; return;
    }
    var corpo = { acao: acao, id: +it.getAttribute('data-id') };
    if (acao === 'feito') corpo.resposta = (it.querySelector('[data-resp]') || {}).value || '';
    b.disabled = true;
    api(corpo).then(function (j) {
      lista = j;
      desenhar({ feito: 'Marcado como feito. A Controladoria confirma.', confirmar: 'Confirmado.', reabrir: 'Reaberto para o responsável.',
        cancelar: 'Cancelado.' }[acao]);
    }).catch(function (e) { b.disabled = false; desenhar(e.message, true); });
  });

  contar();
})();
