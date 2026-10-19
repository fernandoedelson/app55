/* Fechamento: enviar vários arquivos de uma vez.
   Cada linha continua sendo um formulário (base + planilha + posição). Aqui eles são enviados um a um,
   em sequência, sem recarregar a página: escolher os arquivos de todas as bases e enviar tudo evita
   perder o que já foi escolhido. O servidor é o mesmo de sempre (/upload, um arquivo por pedido). */
'use strict';
(function () {
  const forms = Array.from(document.querySelectorAll('form.upload-form'));
  const botao = document.getElementById('up-todos');
  if (!forms.length || !botao) return;
  const geral = document.getElementById('up-data-geral');
  const progresso = document.getElementById('up-progresso');
  const lista = document.getElementById('up-resultado');
  let enviando = false;

  const entradas = f => Array.from(f.querySelectorAll('input[type=file]'));
  /* planilhas escolhidas uma a uma e/ou uma pasta inteira; da pasta só entram .xlsx/.xlsm (sem os temporários ~$) */
  const arquivos = f => entradas(f).flatMap(i => Array.from(i.files))
    .filter(a => /\.(xlsx|xlsm)$/i.test(a.name) && !a.name.startsWith('~$'));
  const rotulo = f => f.closest('tr').querySelector('td').childNodes[0].textContent.trim().replace(/\s+/g, ' ');

  function contar() {
    const n = forms.reduce((s, f) => s + arquivos(f).length, 0);
    botao.disabled = enviando || n === 0;
    botao.textContent = n ? 'Enviar todos os escolhidos (' + n + ')' : 'Enviar todos os escolhidos';
    forms.forEach(f => {
      const q = f.querySelector('.up-qtd');
      if (q) { const k = arquivos(f).length; q.textContent = k ? k + ' planilha(s) escolhida(s)' : ''; }
    });
  }

  function linha(texto, ok) {
    const li = document.createElement('li');
    li.className = ok ? 'up-ok' : 'up-erro';
    li.textContent = (ok ? '✓ ' : '✗ ') + texto;
    lista.appendChild(li);
  }

  /* o servidor responde com um redirecionamento e uma mensagem: lê a mensagem da página devolvida */
  async function enviarUm(form, arquivo, data) {
    const fd = new FormData();
    fd.append('csrf_token', form.querySelector('[name=csrf_token]').value);
    fd.append('base', form.querySelector('[name=base]').value);
    fd.append('data_posicao', data);
    fd.append('arquivo', arquivo, arquivo.name);
    const r = await fetch(form.action, { method: 'POST', body: fd, credentials: 'same-origin' });
    if (!r.ok) return { ok: false, msg: 'o servidor recusou (erro ' + r.status + ')' };
    const doc = new DOMParser().parseFromString(await r.text(), 'text/html');
    const msgs = Array.from(doc.querySelectorAll('.flash')).map(e => ({ ok: !/erro|bad/.test(e.className), t: e.textContent.trim() }));
    const ruim = msgs.find(m => !m.ok);
    if (ruim) return { ok: false, msg: ruim.t };
    return { ok: true, msg: (msgs[0] || { t: arquivo.name + ' enviado.' }).t };
  }

  async function enviar(lote) {
    if (enviando) return;
    lista.innerHTML = '';
    const sem = lote.filter(f => !(f.querySelector('[name=data_posicao]').value || (geral && geral.value)));
    if (sem.length) {
      sem.forEach(f => linha('Falta a posição dos números: ' + rotulo(f) + '. Preencha a data da linha ou a de cima.', false));
      progresso.textContent = 'Nada foi enviado.';
      return;
    }
    enviando = true; contar();
    const fila = [];
    lote.forEach(f => arquivos(f).forEach(a => fila.push({ f: f, a: a })));
    let feitos = 0, falhas = 0;
    for (const item of fila) {
      progresso.textContent = 'Enviando ' + (feitos + falhas + 1) + ' de ' + fila.length + ': ' + item.a.name + '…';
      const data = item.f.querySelector('[name=data_posicao]').value || geral.value;
      try {
        const r = await enviarUm(item.f, item.a, data);
        linha(item.a.name + ' — ' + r.msg, r.ok);
        r.ok ? feitos++ : falhas++;
      } catch (e) {
        linha(item.a.name + ' — sem conexão com o servidor.', false);
        falhas++;
      }
    }
    // o que foi enviado sai da escolha; o que falhou continua, para tentar de novo
    lote.forEach(f => {
      const falhou = Array.from(lista.children).some(li => li.className === 'up-erro' &&
        arquivos(f).some(a => li.textContent.indexOf(a.name) >= 0));
      if (!falhou) entradas(f).forEach(i => { i.value = ''; });
    });
    enviando = false; contar();
    progresso.textContent = feitos + ' enviado(s)' + (falhas ? ', ' + falhas + ' com problema' : '') + '. ';
    const rec = document.createElement('button');
    rec.type = 'button'; rec.className = 'btn btn-sm'; rec.textContent = 'Atualizar a página para ver os arquivos';
    rec.addEventListener('click', () => { location.href = location.pathname + '#bases'; location.reload(); });
    progresso.appendChild(rec);
  }

  forms.forEach(f => {
    entradas(f).forEach(i => i.addEventListener('change', contar));
    /* o "Enviar" da linha usa o mesmo caminho: não recarrega, então as outras escolhas ficam */
    f.addEventListener('submit', ev => { ev.preventDefault(); if (arquivos(f).length) enviar([f]); });
  });
  botao.addEventListener('click', () => enviar(forms.filter(f => arquivos(f).length)));
  contar();
})();
