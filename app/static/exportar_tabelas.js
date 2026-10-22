/* +55 Design — exportação das tabelas para Excel (.xlsx) e da reunião para PDF.

   Sem biblioteca externa: o .xlsx é montado aqui mesmo (um zip sem compressão com as partes do Office Open XML).
   Não mexe no DOM do relatório: o botão "Excel" é um só, flutuante, e aparece sobre a tabela em que o mouse está
   (ou que se tocou, no celular). Assim os blocos, os filtros e a reorganização dos Atos continuam como estão.

   Contrato (window.EXPORTAR_55, definido pela página): { comp:'2026-09', pode:true|false }
   Na reunião, ?acao=excel baixa uma planilha com todas as tabelas dos atos; ?acao=pdf abre a janela de impressão
   com o layout de papel (A4 retrato, um ato por página) — nos dois casos a aba se fecha sozinha ao terminar. */
'use strict';
(function () {
  const CFG = window.EXPORTAR_55 || {};
  if (!CFG.pode) return;

  /* ---------------------------------------------------------------- zip (sem compressão) */
  const CRC = (function () {
    const t = new Uint32Array(256);
    for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; }
    return b => { let c = 0xFFFFFFFF; for (let i = 0; i < b.length; i++) c = t[(c ^ b[i]) & 255] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; };
  })();
  const enc = new TextEncoder();

  function zip(arquivos) {              // arquivos: [[nome, texto]]
    const d = new Date(), hora = (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1),
      data = ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate();
    const partes = [], central = [];
    let pos = 0;
    arquivos.forEach(([nome, texto]) => {
      const nb = enc.encode(nome), cb = enc.encode(texto), crc = CRC(cb);
      const loc = new DataView(new ArrayBuffer(30));
      loc.setUint32(0, 0x04034b50, true); loc.setUint16(4, 20, true); loc.setUint16(6, 0x0800, true);
      loc.setUint16(8, 0, true); loc.setUint16(10, hora, true); loc.setUint16(12, data, true);
      loc.setUint32(14, crc, true); loc.setUint32(18, cb.length, true); loc.setUint32(22, cb.length, true);
      loc.setUint16(26, nb.length, true); loc.setUint16(28, 0, true);
      partes.push(new Uint8Array(loc.buffer), nb, cb);
      const cen = new DataView(new ArrayBuffer(46));
      cen.setUint32(0, 0x02014b50, true); cen.setUint16(4, 20, true); cen.setUint16(6, 20, true); cen.setUint16(8, 0x0800, true);
      cen.setUint16(10, 0, true); cen.setUint16(12, hora, true); cen.setUint16(14, data, true);
      cen.setUint32(16, crc, true); cen.setUint32(20, cb.length, true); cen.setUint32(24, cb.length, true);
      cen.setUint16(28, nb.length, true); cen.setUint32(42, pos, true);
      central.push(new Uint8Array(cen.buffer), nb);
      pos += 30 + nb.length + cb.length;
    });
    const tamCentral = central.reduce((s, p) => s + p.length, 0);
    const fim = new DataView(new ArrayBuffer(22));
    fim.setUint32(0, 0x06054b50, true); fim.setUint16(8, arquivos.length, true); fim.setUint16(10, arquivos.length, true);
    fim.setUint32(12, tamCentral, true); fim.setUint32(16, pos, true);
    return new Blob(partes.concat(central, [new Uint8Array(fim.buffer)]),
      { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  }

  /* ---------------------------------------------------------------- texto da tela -> célula do Excel */
  const FORMATOS = ['gen', 'money', 'money2', 'pct0', 'pct1', 'pct2', 'int', 'dec1', 'dec2', 'num'];
  /* com "+" explícito na tela (+7,3%, +R$ 1.369.335) o formato também mostra o "+" */
  const MAIS = { money: 169, money2: 170, pct0: 171, pct1: 172, pct2: 173, int: 174, dec1: 175, dec2: 176, num: 177 };
  const CODIGOS = { 169: '+&quot;R$ &quot;#,##0;-&quot;R$ &quot;#,##0;&quot;R$ &quot;0', 170: '+&quot;R$ &quot;#,##0.00;-&quot;R$ &quot;#,##0.00;&quot;R$ &quot;0.00',
    171: '+0%;-0%;0%', 172: '+0.0%;-0.0%;0.0%', 173: '+0.00%;-0.00%;0.00%', 174: '+#,##0;-#,##0;0', 175: '+#,##0.0;-#,##0.0;0.0', 176: '+#,##0.00;-#,##0.00;0.00', 177: '+0;-0;0' };
  const NUMFMT = { gen: 0, money: 164, money2: 165, pct0: 9, pct1: 166, pct2: 167, int: 3, dec1: 168, dec2: 4, num: 1 };
  const MIL = '(?:\\d{1,3}(?:\\.\\d{3})+|\\d+)';          // 1.234.567 ou 1234
  const RE_NUM = new RegExp('^([+-]?)' + MIL + '(?:,(\\d+))?$');
  const RE_MONEY = new RegExp('^([+-]?)\\s*R\\$\\s*([+-]?)(' + MIL + ')(?:,(\\d+))?$');
  const RE_PCT = new RegExp('^([+-]?)(' + MIL + ')(?:,(\\d+))?\\s*%$');

  function limpa(s) { return String(s == null ? '' : s).replace(/[ \t\r\n ]+/g, ' ').trim(); }
  const aNumero = (inteiro, dec) => parseFloat(inteiro.replace(/\./g, '') + (dec ? '.' + dec : ''));

  /* devolve {v, t:'n'|'s', f} — número só quando o texto INTEIRO é um número no formato da tela */
  function celula(texto) {
    const s = limpa(texto).replace(/^[▸▾]\s*/, '');
    let m;
    if ((m = RE_MONEY.exec(s))) {
      const neg = m[1] === '-' || m[2] === '-', v = aNumero(m[3], m[4]);
      return { v: neg ? -v : v, t: 'n', f: m[4] ? 'money2' : 'money', mais: m[1] === '+' || m[2] === '+' };
    }
    if ((m = RE_PCT.exec(s))) {
      const v = Math.round(aNumero(m[2], m[3]) * 1e8 / 100) / 1e8, d = (m[3] || '').length;
      return { v: m[1] === '-' ? -v : v, t: 'n', f: d === 0 ? 'pct0' : d === 1 ? 'pct1' : 'pct2', mais: m[1] === '+' };
    }
    if ((m = RE_NUM.exec(s)) && !/^-?0\d/.test(s)) {
      const sem = s.replace(/^[+-]/, ''), agrupado = sem.indexOf('.') >= 0, dec = (m[2] || '').length;
      if (!agrupado && !dec && sem.length > 6) return { v: s, t: 's', f: 'gen' };     // código/pedido: continua texto
      const v = aNumero(sem, m[2]);
      return { v: m[1] === '-' ? -v : v, t: 'n', f: dec ? (dec === 1 ? 'dec1' : 'dec2') : agrupado ? 'int' : 'num', mais: m[1] === '+' };
    }
    return { v: s, t: 's', f: 'gen' };
  }

  /* ---------------------------------------------------------------- tabela do DOM -> grade (com células mescladas) */
  function lerTabela(tabela) {
    const grade = [], mesclas = [];
    let cab = 0;
    const ocupa = {};                    // 'linha,coluna' já tomada por rowspan/colspan de cima
    let r = 0;
    Array.from(tabela.rows).forEach(tr => {
      if (!tr.getClientRects().length || tr.querySelector('table')) return;       // linha oculta ou que só abre outra tabela
      const linha = grade[r] = grade[r] || [];
      let c = 0;
      const nocab = tr.parentElement && tr.parentElement.tagName === 'THEAD';
      Array.from(tr.cells).forEach(td => {
        while (ocupa[r + ',' + c]) c++;
        const cs = Math.max(1, td.colSpan || 1), rs = Math.max(1, td.rowSpan || 1);
        const peso = parseInt(getComputedStyle(td).fontWeight, 10) || 400;
        const x = celula(td.innerText);
        x.b = nocab || td.tagName === 'TH' || peso >= 600;
        x.cab = nocab;
        x.al = c === 0 ? 'left' : 'right';                // descrição à esquerda; todo o resto à direita
        linha[c] = x;
        for (let i = 0; i < rs; i++) for (let j = 0; j < cs; j++) if (i || j) ocupa[(r + i) + ',' + (c + j)] = 1;
        if (cs > 1 || rs > 1) mesclas.push([r, c, r + rs - 1, c + cs - 1]);
        c += cs;
      });
      if (nocab) cab = r + 1;
      r++;
    });
    return { grade, mesclas, cab };
  }

  /* ---------------------------------------------------------------- planilha */
  const esc = s => String(s).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const colunaLetra = n => { let s = ''; for (n++; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + ((n - 1) % 26)) + s; return s; };

  /* cada combinação formato × negrito × alinhamento vira um estilo, registrado quando aparece */
  let XFS = [], XIDX = {};
  function estilo(x) {
    if (x.cab) return 1;                                  // cabeçalho: centralizado
    const al = x.al || (x.t === 'n' ? 'right' : 'left'), k = x.f + (x.mais ? '+' : '') + '|' + (x.b ? 1 : 0) + '|' + al;
    if (!(k in XIDX)) {
      XIDX[k] = XFS.length + 2;
      XFS.push('<xf numFmtId="' + (x.mais && MAIS[x.f] ? MAIS[x.f] : NUMFMT[x.f]) + '" fontId="' + (x.b ? 1 : 0) + '" fillId="0" borderId="0" xfId="0" applyNumberFormat="1" applyFont="1" applyAlignment="1"><alignment horizontal="' + al + '" vertical="center"/></xf>');
    }
    return XIDX[k];
  }

  function xmlAba(t) {
    const largura = [];
    t.grade.forEach(l => l.forEach((x, c) => { if (x) largura[c] = Math.max(largura[c] || 8, Math.min(60, String(x.t === 'n' ? Math.abs(x.v).toLocaleString('pt-BR') : x.v).length + 3)); }));
    const ncol = largura.length;
    let s = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">';
    if (t.cab) s += '<sheetViews><sheetView showGridLines="0" workbookViewId="0"><pane ySplit="' + t.cab + '" topLeftCell="A' + (t.cab + 1) + '" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>';
    else s += '<sheetViews><sheetView showGridLines="0" workbookViewId="0"/></sheetViews>';
    s += '<cols>';
    for (let c = 0; c < ncol; c++) s += '<col min="' + (c + 1) + '" max="' + (c + 1) + '" width="' + (largura[c] || 10) + '" customWidth="1"/>';
    s += '</cols><sheetData>';
    t.grade.forEach((l, r) => {
      s += '<row r="' + (r + 1) + '">';
      for (let c = 0; c < l.length; c++) {
        const x = l[c]; if (!x) continue;
        const ref = colunaLetra(c) + (r + 1), est = estilo(x);
        s += x.t === 'n' ? '<c r="' + ref + '" s="' + est + '"><v>' + x.v + '</v></c>'
          : '<c r="' + ref + '" s="' + est + '" t="inlineStr"><is><t xml:space="preserve">' + esc(x.v) + '</t></is></c>';
      }
      s += '</row>';
    });
    s += '</sheetData>';
    if (t.mesclas.length) s += '<mergeCells count="' + t.mesclas.length + '">' + t.mesclas.map(m =>
      '<mergeCell ref="' + colunaLetra(m[1]) + (m[0] + 1) + ':' + colunaLetra(m[3]) + (m[2] + 1) + '"/>').join('') + '</mergeCells>';
    return s + '</worksheet>';
  }

  function xmlEstilos() {
    const xfs = ['<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>',
      '<xf numFmtId="0" fontId="1" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>'].concat(XFS);
    return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'
      + '<numFmts count="14">' + '<numFmt numFmtId="164" formatCode="&quot;R$ &quot;#,##0;-&quot;R$ &quot;#,##0"/>'
      + '<numFmt numFmtId="165" formatCode="&quot;R$ &quot;#,##0.00;-&quot;R$ &quot;#,##0.00"/><numFmt numFmtId="166" formatCode="0.0%"/>'
      + '<numFmt numFmtId="167" formatCode="0.00%"/><numFmt numFmtId="168" formatCode="#,##0.0"/>'
      + Object.keys(CODIGOS).map(k => '<numFmt numFmtId="' + k + '" formatCode="' + CODIGOS[k] + '"/>').join('') + '</numFmts>'
      + '<fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts>'
      + '<fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill>'
      + '<fill><patternFill patternType="solid"><fgColor rgb="FFF2EEE4"/><bgColor indexed="64"/></patternFill></fill></fills>'
      + '<borders count="2"><border><left/><right/><top/><bottom/><diagonal/></border>'
      + '<border><left/><right/><top/><bottom style="thin"><color rgb="FFBFB6A8"/></bottom><diagonal/></border></borders>'
      + '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>'
      + '<cellXfs count="' + xfs.length + '">' + xfs.join('') + '</cellXfs>'
      + '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>';
  }

  function nomeAba(base, usados) {
    let n = limpa(base).replace(/[\[\]:*?\/\\]/g, '-').slice(0, 31) || 'Tabela', k = 2, final = n;
    while (usados[final.toLowerCase()]) { const suf = ' (' + k++ + ')'; final = n.slice(0, 31 - suf.length) + suf; }
    usados[final.toLowerCase()] = 1;
    return final;
  }

  function xlsx(abas) {                  // abas: [{nome, tabela:{grade,mesclas,cab}}]
    XFS = []; XIDX = {};
    const xmlAbas = abas.map(a => xmlAba(a.tabela));       // registra os estilos usados
    const arq = [
      ['[Content_Types].xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
        + '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/>'
        + '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>'
        + '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>'
        + abas.map((a, i) => '<Override PartName="/xl/worksheets/sheet' + (i + 1) + '.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>').join('')
        + '</Types>'],
      ['_rels/.rels', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
        + '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>'],
      ['xl/workbook.xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" '
        + 'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>'
        + abas.map((a, i) => '<sheet name="' + esc(a.nome).replace(/"/g, '&quot;') + '" sheetId="' + (i + 1) + '" r:id="rId' + (i + 1) + '"/>').join('') + '</sheets></workbook>'],
      ['xl/_rels/workbook.xml.rels', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
        + abas.map((a, i) => '<Relationship Id="rId' + (i + 1) + '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet' + (i + 1) + '.xml"/>').join('')
        + '<Relationship Id="rId' + (abas.length + 1) + '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>'],
      ['xl/styles.xml', xmlEstilos()]
    ];
    xmlAbas.forEach((x, i) => arq.push(['xl/worksheets/sheet' + (i + 1) + '.xml', x]));
    return zip(arq);
  }

  function baixar(blob, nome) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = nome;
    document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 4000);
  }

  /* ---------------------------------------------------------------- de onde é a tabela */
  function tituloDoBloco(tabela) {
    const el = tabela.closest('[data-blk-of]'), id = el && el.dataset.blkOf;
    const h = id && id !== '__abre' ? document.querySelector('h3[data-blk="' + id + '"]') : null;
    if (h) {                                           // só o texto do título (sem a etiqueta do período nem o botão de comentários)
      const t = Array.from(h.childNodes).filter(n => n.nodeType === 3).map(n => n.textContent).join(' ');
      if (limpa(t)) return limpa(t);
    }
    let a = tabela.closest('.tw,.twz') || tabela;       // sem bloco: o último título antes da tabela
    for (let i = 0; i < 40 && a; i++) {
      let p = a.previousElementSibling;
      while (p) { const x = p.matches('h3,h2') ? p : p.querySelector('h3,h2'); if (x && limpa(x.textContent)) return limpa(x.childNodes[0] ? x.childNodes[0].textContent : x.textContent); p = p.previousElementSibling; }
      a = a.parentElement;
    }
    return 'Tabela';
  }
  function atoDaTabela(tabela) {
    const s = tabela.closest('section.ato'), n = s && s.querySelector('.ato-n');
    return n ? limpa(n.textContent) : '';
  }
  const tabelaValida = t => t.getClientRects().length && !t.closest('#chartzoom') && (t.classList.contains('dt') || t.closest('.tw,.twz'));
  const slug = s => limpa(s).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 60) || 'tabela';

  /* ---------------------------------------------------------------- ações */
  function baixarTabela(tabela) {
    const t = lerTabela(tabela);
    if (!t.grade.length) return;
    const titulo = tituloDoBloco(tabela);
    baixar(xlsx([{ nome: nomeAba(titulo, {}), tabela: t }]), slug(titulo) + '_' + (CFG.comp || '') + '.xlsx');
  }

  function baixarReuniao() {
    const usados = {}, abas = [], indice = [[{ v: 'Aba', t: 's', f: 'gen', b: 1, cab: 1 }, { v: 'Ato', t: 's', f: 'gen', b: 1, cab: 1 }, { v: 'Tabela', t: 's', f: 'gen', b: 1, cab: 1 }]];
    reservar('Índice', usados);
    document.querySelectorAll('section.ato table').forEach(tb => {
      if (!tabelaValida(tb)) return;
      const t = lerTabela(tb);
      if (!t.grade.length) return;
      const ato = atoDaTabela(tb), titulo = tituloDoBloco(tb), nome = nomeAba(titulo, usados);
      abas.push({ nome, tabela: t });
      indice.push([{ v: nome, t: 's', f: 'gen' }, { v: ato, t: 's', f: 'gen' }, { v: titulo, t: 's', f: 'gen' }]);
    });
    if (!abas.length) throw new Error('nenhuma tabela encontrada na reunião');
    abas.unshift({ nome: 'Índice', tabela: { grade: indice, mesclas: [], cab: 1 } });
    baixar(xlsx(abas), 'Analise_Vendas_e_DRE_55Design_Reuniao_' + (CFG.comp || '') + '.xlsx');
    return abas.length - 1;
  }
  function reservar(n, usados) { usados[n.toLowerCase()] = 1; }

  /* ---------------------------------------------------------------- botão flutuante "Excel" sobre a tabela */
  const css = document.createElement('style');
  css.textContent = '.xl-flut{position:fixed;z-index:99990;display:none;padding:4px 11px;border:1px solid var(--border,#d8d2c6);border-radius:14px;'
    + 'background:var(--surface,#fff);color:var(--ink,#2a211b);font:600 11.5px/1.4 var(--sans,system-ui,sans-serif);letter-spacing:.04em;cursor:pointer;'
    + 'box-shadow:0 2px 8px rgba(42,33,27,.18)}.xl-flut:hover{background:var(--cream,#f4f0e8)}'
    + '.xl-aviso{position:fixed;left:50%;top:18px;transform:translateX(-50%);z-index:99999;padding:12px 22px;border-radius:6px;background:#2a211b;color:#f4f0e8;'
    + 'font:600 14px/1.4 system-ui,sans-serif;box-shadow:0 8px 30px rgba(0,0,0,.35)}'
    + '@media print{.xl-flut,.xl-aviso{display:none!important}}';
  document.head.appendChild(css);

  const botao = document.createElement('button');
  botao.type = 'button'; botao.className = 'xl-flut'; botao.textContent = '⬇ Excel'; botao.title = 'Baixar esta tabela em Excel';
  document.body.appendChild(botao);
  let alvo = null, esconder = 0;
  function mostrar(tb) {
    clearTimeout(esconder); alvo = tb;
    const r = tb.getBoundingClientRect(), topo = r.top >= 30 ? r.top - 28 : Math.max(4, r.top + 4);
    botao.style.top = topo + 'px';
    botao.style.left = Math.max(4, Math.min(innerWidth - 90, r.right - 80)) + 'px';
    botao.style.display = 'block';
  }
  function sumir(ms) { clearTimeout(esconder); esconder = setTimeout(() => { botao.style.display = 'none'; alvo = null; }, ms || 350); }
  document.addEventListener('mouseover', ev => {
    if (ev.target === botao) { clearTimeout(esconder); return; }
    const tb = ev.target.closest && ev.target.closest('table');
    if (tb && tabelaValida(tb)) mostrar(tb); else if (alvo) sumir();
  });
  document.addEventListener('touchstart', ev => {
    const tb = ev.target.closest && ev.target.closest('table');
    if (tb && tabelaValida(tb)) { mostrar(tb); sumir(5000); }
  }, { passive: true });
  window.addEventListener('scroll', () => { if (alvo) mostrar(alvo); }, { passive: true });
  botao.addEventListener('click', () => { if (alvo) baixarTabela(alvo); });

  /* ---------------------------------------------------------------- ?acao=excel / ?acao=pdf (a aba aberta pela lista de reuniões) */
  function aviso(texto) {
    let a = document.querySelector('.xl-aviso');
    if (!a) { a = document.createElement('div'); a.className = 'xl-aviso'; document.body.appendChild(a); }
    a.textContent = texto;
  }
  function quandoPronto(fazer) {                        // espera os atos serem montados e as tabelas pararem de mudar
    let ultimo = -1, estavel = 0, tentativas = 0;
    const t = setInterval(() => {
      const n = document.querySelectorAll('section.ato table').length;
      estavel = n > 0 && n === ultimo ? estavel + 1 : 0; ultimo = n; tentativas++;
      if (estavel >= 3 || tentativas > 40) { clearInterval(t); fazer(); }
    }, 500);
  }
  const acao = new URLSearchParams(location.search).get('acao');
  if (acao === 'excel' || acao === 'pdf') {
    window.addEventListener('load', () => {
      aviso(acao === 'excel' ? 'Preparando o Excel da reunião…' : 'Preparando o PDF da reunião…');
      quandoPronto(() => {
        if (acao === 'excel') {
          try { const n = baixarReuniao(); aviso('Excel baixado (' + n + ' tabelas). Pode fechar esta aba.'); }
          catch (e) { aviso('Não consegui montar o Excel: ' + e.message); return; }
          setTimeout(() => window.close(), 2500);
        } else {
          aviso('Na janela de impressão, escolha "Salvar como PDF".');
          window.addEventListener('afterprint', () => setTimeout(() => window.close(), 400));
          setTimeout(() => window.print(), 600);
        }
      });
    });
  }
  /* ---------------------------------------------------------------- PDF: capa e rodapé por página */
  const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
  function mesDaCompetencia() {
    const m = /^(\d{4})-(\d{2})$/.exec(CFG.comp || '');
    if (!m) return CFG.comp || '';
    const nome = MESES[parseInt(m[2], 10) - 1] || '';
    return nome.charAt(0).toUpperCase() + nome.slice(1) + ' de ' + m[1];
  }
  function montarCapa() {
    if (document.getElementById('pdf-capa')) return;
    const atos = Array.from(document.querySelectorAll('section.ato'));
    if (!atos.length) return;
    const mes = mesDaCompetencia(), capa = document.createElement('div');
    capa.id = 'pdf-capa';
    const logo = document.querySelector('.brand'), bg = logo ? getComputedStyle(logo, '::before').backgroundImage : 'none';
    const el = (tag, cls, txt) => { const e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; };
    const l = el('div', 'pc-logo'); if (bg && bg !== 'none') l.style.backgroundImage = bg;
    capa.appendChild(l);
    capa.appendChild(el('div', 'pc-k', 'Roteiro executivo em atos'));
    capa.appendChild(el('h1', '', 'Análise de Vendas e DRE'));
    capa.appendChild(el('div', 'pc-mes', mes));
    capa.appendChild(el('div', 'pc-reg'));
    const ol = el('ol');
    atos.forEach(a => {
      const n = a.querySelector('.ato-n'), t = a.querySelector('h2'), q = a.querySelector('.ato-q'), m = a.querySelector('.ato-min');
      const li = el('li');
      li.appendChild(el('span', 'n', ((n && n.textContent.match(/\d+/)) || [''])[0].padStart(2, '0')));
      li.appendChild(el('span', 't', t ? t.textContent : ''));
      li.appendChild(el('span', 'm', m ? m.textContent : ''));
      if (q && q.textContent) li.appendChild(el('span', 'q', q.textContent));
      ol.appendChild(li);
    });
    capa.appendChild(ol);
    capa.appendChild(el('div', 'pc-pe', '+55 Design · Controladoria'));
    document.body.insertBefore(capa, document.body.firstChild);
    /* rodapé de cada página (a capa não tem: a primeira página tem margem zero) */
    let st = document.getElementById('pdf-rodape');
    if (!st) { st = document.createElement('style'); st.id = 'pdf-rodape'; document.head.appendChild(st); }
    const txt = ('+55 Design · Roteiro executivo · ' + mes).replace(/["\\]/g, '');
    const base = 'font-family:Jost,"Avenir Next","Century Gothic","Segoe UI",sans-serif;font-size:7.5pt;letter-spacing:.16em;text-transform:uppercase;color:#9c8e80;vertical-align:top;padding-top:4mm;';
    const caixa = 'background:#f7f3ea;';
    st.textContent = '@page{@bottom-left{content:"' + txt + '";width:70%;padding-left:9mm;' + caixa + base + '}'
      + '@bottom-right{content:counter(page);width:30%;padding-right:9mm;text-align:right;' + caixa + base + '}}';
  }
  /* título + gráfico/tabela + legenda formam um grupo que não se parte entre páginas (o título nunca fica sozinho no pé);
     o cabeçalho do ato vai junto do primeiro grupo. Feito só ao imprimir: na tela, o grupo é transparente (display:contents). */
  function juntarTitulos() {
    document.querySelectorAll('section.ato').forEach(sec => {
      if (sec.dataset.juntado) return;
      sec.dataset.juntado = '1';
      sec.querySelectorAll('.ato-slot > h3').forEach(h => {
        const n = h.nextElementSibling;
        if (!n || h.parentElement.classList.contains('pdf-junto')) return;
        const g = [h, n];
        if (n.nextElementSibling && n.nextElementSibling.matches('p.cap')) g.push(n.nextElementSibling);
        const w = document.createElement('div'); w.className = 'pdf-junto';
        h.parentElement.insertBefore(w, h); g.forEach(x => w.appendChild(x));
      });
      sec.querySelectorAll(':scope > .ato-sub').forEach(sub => {   // o subtítulo do trecho vai junto do primeiro grupo dele
        const slot = sub.nextElementSibling, g = slot && slot.classList.contains('ato-slot') ? slot.querySelector(':scope > .pdf-junto') : null;
        if (!g) {                                  // o slot não abre com um grupo (ex.: começa por um aviso): embrulha subtítulo + slot
          if (slot && slot.classList.contains('ato-slot') && !(sub.previousElementSibling && sub.previousElementSibling.classList.contains('ato-head'))) {
            const w = document.createElement('div'); w.className = 'pdf-junto'; w.dataset.novoTrecho = '1';
            sub.parentElement.insertBefore(w, sub); w.appendChild(sub); w.appendChild(slot);
          }
          return;
        }
        g.insertBefore(sub, g.firstChild);
        const logo = sub.parentElement; // (o subtítulo agora mora no grupo)
        if (!(g.parentElement.previousElementSibling && g.parentElement.previousElementSibling.classList.contains('ato-head')) && logo) g.dataset.novoTrecho = '1';
      });
      const cab = sec.querySelector('.ato-head'), primeiro = sec.querySelector('.pdf-junto');
      if (cab && primeiro && !primeiro.parentElement.classList.contains('pdf-junto-ato')) {
        const slot = primeiro.parentElement, w = document.createElement('div'); w.className = 'pdf-junto pdf-junto-ato';
        sec.insertBefore(w, cab); w.appendChild(cab);
        // o grupo só entra se o slot dele for o primeiro conteúdo do ato (sem subtítulo no meio)
        const antes = Array.from(sec.children).filter(c => c !== w);
        if (antes[0] === slot) w.appendChild(slot); else sec.insertBefore(cab, w), w.remove();
      }
    });
  }
  function medirGrupos() {
    const raiz = document.documentElement;
    raiz.classList.add('pdf-medindo');                    // largura da folha impressa (A4 a 60%), sem a barra lateral
    document.querySelectorAll('.pdf-junto:not(.pdf-junto-ato)').forEach(w => {
      w.classList.toggle('pdf-grande', w.dataset.novoTrecho === '1' || w.getBoundingClientRect().height > 1250);
    });
    raiz.classList.remove('pdf-medindo');
  }
  window.addEventListener('beforeprint', () => { juntarTitulos(); medirGrupos(); });
  if (/montar_pdf/.test(location.search)) window.addEventListener('load', () => setTimeout(() => { juntarTitulos(); medirGrupos(); }, 2600));

  window.addEventListener('beforeprint', montarCapa);
  window.addEventListener('load', () => setTimeout(montarCapa, 2500));

  window.Exportar55 = { baixarTabela, baixarReuniao };
})();
