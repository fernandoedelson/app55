/* Confirmação no padrão +55, no lugar da caixa cinza do navegador.
   Uso em script:  if (!(await app55Confirmar({titulo, texto, ok, tom}))) return;
   Uso em HTML:    <form data-confirmar="Texto" data-confirmar-titulo="…" data-confirmar-ok="…" data-confirmar-tom="perigo">
                   (ou os mesmos atributos no botão de envio, quando só aquele botão pede confirmação) */
(function () {
  'use strict';
  let dlg = null, resolver = null;

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  function criar() {
    dlg = document.createElement('dialog');
    dlg.className = 'dlg55';
    dlg.setAttribute('aria-labelledby', 'dlg55-titulo');
    dlg.setAttribute('aria-describedby', 'dlg55-texto');
    dlg.innerHTML =
      '<form method="dialog" class="dlg55-caixa">' +
      '<p class="dlg55-marca">+55 Design</p>' +
      '<h2 id="dlg55-titulo" class="dlg55-titulo"></h2>' +
      '<p id="dlg55-texto" class="dlg55-texto"></p>' +
      '<div class="dlg55-acoes">' +
      '<button type="button" class="dlg55-bt dlg55-cancelar" value="nao"></button>' +
      '<button type="button" class="dlg55-bt dlg55-ok" value="sim"></button>' +
      '</div></form>';
    document.body.appendChild(dlg);
    dlg.querySelector('.dlg55-ok').addEventListener('click', () => fechar(true));
    dlg.querySelector('.dlg55-cancelar').addEventListener('click', () => fechar(false));
    dlg.addEventListener('cancel', ev => { ev.preventDefault(); fechar(false); });   // tecla Esc
    dlg.addEventListener('click', ev => { if (ev.target === dlg) fechar(false); });   // clique fora da caixa
  }

  function fechar(valor) {
    if (!dlg || !dlg.open) return;
    dlg.classList.remove('dlg55-visivel');
    setTimeout(() => { dlg.close(); }, 140);
    const r = resolver; resolver = null;
    if (r) r(valor);
  }

  window.app55Confirmar = function (o) {
    if (typeof o === 'string') o = { texto: o };
    o = o || {};
    if (!dlg) criar();
    if (resolver) fechar(false);
    dlg.dataset.tom = o.tom || '';
    dlg.querySelector('.dlg55-titulo').textContent = o.titulo || 'Confirmar';
    dlg.querySelector('.dlg55-texto').innerHTML = esc(o.texto || '').replace(/\n/g, '<br>');
    dlg.querySelector('.dlg55-ok').textContent = o.ok || 'Confirmar';
    dlg.querySelector('.dlg55-cancelar').textContent = o.cancelar || 'Cancelar';
    dlg.showModal();
    requestAnimationFrame(() => dlg.classList.add('dlg55-visivel'));
    // numa ação que apaga ou descarta, o foco começa no "Cancelar": Enter por engano não destrói nada
    dlg.querySelector(o.tom === 'perigo' ? '.dlg55-cancelar' : '.dlg55-ok').focus();
    return new Promise(res => { resolver = res; });
  };

  // formulários e botões com data-confirmar
  document.addEventListener('submit', async ev => {
    const form = ev.target;
    const quem = (ev.submitter && ev.submitter.dataset.confirmar) ? ev.submitter : form;
    if (!quem.dataset || !quem.dataset.confirmar) return;
    if (form.dataset.dlg55Ok === '1') { delete form.dataset.dlg55Ok; return; }
    ev.preventDefault(); ev.stopPropagation();   // nenhum outro tratador vê o envio antes da confirmação
    const ok = await window.app55Confirmar({
      titulo: quem.dataset.confirmarTitulo, texto: quem.dataset.confirmar,
      ok: quem.dataset.confirmarOk, cancelar: quem.dataset.confirmarCancelar, tom: quem.dataset.confirmarTom });
    if (!ok) { if (form.hasAttribute('data-confirmar-desfaz')) form.reset(); return; }   // a caixa marcada volta
    form.dataset.dlg55Ok = '1';
    if (form.requestSubmit) form.requestSubmit(ev.submitter || undefined);
    else form.submit();
  }, true);
})();
