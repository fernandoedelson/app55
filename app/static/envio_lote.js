/* Fechamento: enviar vários arquivos de uma vez.
   Cada linha continua sendo um formulário (base + planilha(s) ou pasta + posição). Aqui eles são enviados
   um a um, em sequência, sem recarregar a página: escolher os arquivos de todas as bases e enviar tudo
   evita perder o que já foi escolhido. O servidor é o mesmo de sempre (/upload, um arquivo por pedido).
   O andamento aparece na própria linha (com a porcentagem do arquivo) e no quadro de cima. */
'use strict';
(function () {
  let forms = [];
  const botao = document.getElementById('up-todos');
  if (!botao) return;
  const geral = document.getElementById('up-data-geral');
  const progresso = document.getElementById('up-progresso');
  const lista = document.getElementById('up-resultado');
  let enviando = false;

  const entradas = f => Array.from(f.querySelectorAll('input[type=file]'));
  /* planilhas escolhidas uma a uma e/ou uma pasta inteira; da pasta só entram .xlsx/.xlsm (sem os temporários ~$) */
  const arquivos = f => entradas(f).flatMap(i => Array.from(i.files))
    .filter(a => /\.(xlsx|xlsm)$/i.test(a.name) && !a.name.startsWith('~$'));
  const rotulo = f => f.closest('tr').querySelector('td').childNodes[0].textContent.trim().replace(/\s+/g, ' ');
  /* onde o andamento aparece na linha: o contador das bases de pasta, ou um aviso criado ao lado do botão */
  function status(f) {
    let q = f.querySelector('.up-qtd');
    if (!q) { q = document.createElement('span'); q.className = 'muted up-qtd'; q.setAttribute('aria-live', 'polite'); f.appendChild(q); }
    return q;
  }
  const mb = n => (n / 1048576).toFixed(1).replace('.', ',') + ' MB';

  function contar() {
    const n = forms.reduce((s, f) => s + arquivos(f).length, 0);
    botao.disabled = enviando || n === 0;
    botao.textContent = n ? 'Enviar todos os escolhidos (' + n + ')' : 'Enviar todos os escolhidos';
    forms.forEach(f => {
      f.querySelector('button[type=submit]').disabled = enviando;
      if (enviando) return;
      const k = arquivos(f).length;
      status(f).textContent = k === 1 ? arquivos(f)[0].name : k ? k + ' planilhas escolhidas' : '';
    });
  }

  function linha(texto, ok) {
    const li = document.createElement('li');
    li.className = ok ? 'up-ok' : 'up-erro';
    li.textContent = (ok ? '✓ ' : '✗ ') + texto;
    lista.appendChild(li);
  }

  /* o servidor responde com um redirecionamento e uma mensagem: lê a mensagem da página devolvida.
     XMLHttpRequest, e não fetch, para saber quantos bytes já subiram (a planilha comercial tem 9 MB). */
  function enviarUm(form, arquivo, data, aoProgredir) {
    return new Promise(resolve => {
      const fd = new FormData();
      fd.append('csrf_token', form.querySelector('[name=csrf_token]').value);
      fd.append('base', form.querySelector('[name=base]').value);
      fd.append('data_posicao', data);
      fd.append('arquivo', arquivo, arquivo.name);
      const x = new XMLHttpRequest();
      x.open('POST', form.action);
      x.timeout = 15 * 60 * 1000;
      x.upload.onprogress = e => { if (e.lengthComputable) aoProgredir(e.loaded, e.total); };
      x.onerror = () => resolve({ ok: false, msg: 'sem conexão com o servidor.' });
      x.ontimeout = () => resolve({ ok: false, msg: 'o servidor demorou demais para responder.' });
      x.onload = () => {
        if (x.status < 200 || x.status >= 300) return resolve({ ok: false, msg: 'o servidor recusou (erro ' + x.status + ').' });
        if (/\/entrar/.test(x.responseURL || '')) return resolve({ ok: false, msg: 'sua sessão expirou: entre de novo (os arquivos escolhidos continuam aqui).' });
        const doc = new DOMParser().parseFromString(x.responseText, 'text/html');
        const msgs = Array.from(doc.querySelectorAll('.flash')).map(e => ({ ok: !/erro|bad/.test(e.className), t: e.textContent.trim() }));
        const ruim = msgs.find(m => !m.ok);
        if (ruim) return resolve({ ok: false, msg: ruim.t });
        resolve({ ok: true, msg: (msgs[0] || { t: arquivo.name + ' enviado.' }).t });
      };
      x.send(fd);
    });
  }

  async function enviar(lote) {
    if (enviando) return;
    lista.innerHTML = '';
    const sem = lote.filter(f => !(f.querySelector('[name=data_posicao]').value || (geral && geral.value)));
    if (sem.length) {
      sem.forEach(f => { linha('Falta a posição dos números: ' + rotulo(f) + '. Preencha a data da linha ou a de cima.', false); status(f).textContent = 'Falta a data.'; });
      progresso.textContent = 'Nada foi enviado.';
      return;
    }
    enviando = true; contar();
    const fila = [];
    lote.forEach(f => arquivos(f).forEach(a => fila.push({ f: f, a: a })));
    let feitos = 0, falhas = 0;
    for (const item of fila) {
      const n = feitos + falhas + 1;
      const texto = pct => 'Enviando ' + n + ' de ' + fila.length + ': ' + item.a.name + ' (' + mb(item.a.size) + ')' + (pct == null ? '…' : ' — ' + pct + '%');
      progresso.textContent = texto(null); status(item.f).textContent = texto(null);
      const data = item.f.querySelector('[name=data_posicao]').value || geral.value;
      const r = await enviarUm(item.f, item.a, data, (c, t) => {
        const p = Math.round(100 * c / t);
        progresso.textContent = texto(p); status(item.f).textContent = texto(p);
      });
      linha(item.a.name + ' — ' + r.msg, r.ok);
      r.ok ? feitos++ : falhas++;
    }
    // o que foi enviado sai da escolha; o que falhou continua, para tentar de novo
    lote.forEach(f => {
      const falhou = Array.from(lista.children).some(li => li.className === 'up-erro' &&
        arquivos(f).some(a => li.textContent.indexOf(a.name) >= 0));
      if (!falhou) entradas(f).forEach(i => { i.value = ''; });
    });
    enviando = false; contar();
    lote.forEach(f => { if (!arquivos(f).length) status(f).textContent = '✓ enviado'; });
    progresso.textContent = feitos + ' enviado(s)' + (falhas ? ', ' + falhas + ' com problema' : '') + '. ';
    const resta = forms.some(f => arquivos(f).length);
    if (!falhas && !resta) {
      progresso.textContent += 'Atualizando a página…';
      setTimeout(() => { location.href = location.pathname + '#bases'; location.reload(); }, 1200);
      return;
    }
    const rec = document.createElement('button');
    rec.type = 'button'; rec.className = 'btn btn-sm'; rec.textContent = 'Atualizar a página para ver os arquivos';
    rec.addEventListener('click', () => { location.href = location.pathname + '#bases'; location.reload(); });
    progresso.appendChild(rec);
    document.getElementById('envio-lote').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  /* liga os formulários da página; chamado de novo quando uma linha é trocada sem recarregar */
  function ligar() {
    forms = Array.from(document.querySelectorAll('form.upload-form'));
    forms.forEach(f => {
      if (f.dataset.ligado) return;
      f.dataset.ligado = '1';
      entradas(f).forEach(i => i.addEventListener('change', contar));
      /* o "Enviar" da linha usa o mesmo caminho: não recarrega, então as outras escolhas ficam */
      f.addEventListener('submit', ev => {
        ev.preventDefault();
        if (arquivos(f).length) enviar([f]); else status(f).textContent = 'Escolha a planilha primeiro.';
      });
    });
    contar();
  }
  window.envioLoteLigar = ligar;
  botao.addEventListener('click', () => enviar(forms.filter(f => arquivos(f).length)));
  ligar();
})();
