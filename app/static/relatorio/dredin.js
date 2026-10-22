/* GERADO por ferramentas/extrair_desenho.py a partir do dredin.js do Kit na tag gabarito-v20 — não editar. */
/* =====================================================================
   DRE no padrão da empresa ("DRE DINÂMICO" do Painel de Resultado)
   ---------------------------------------------------------------------
   Molde (layout, fórmulas e estilo de cada célula, extraídos da aba) + números das abas REAL/ORÇADO por unidade e ano.
   Aqui ficam: o avaliador das fórmulas da aba, o formato de número do Excel, o desenho idêntico ao da planilha e os filtros
   (unidade, ano, mês), as duas visões (mês + acumulado | evolutivo), recolher/expandir grupos, tela cheia e impressão.

   Uso:  DREDIN_UI.montar(host, {molde, dados, unidades, anos, padrao:{unidade,ano,mes}, buscar:async(sel)=>dados})
   `dados` = {REAL:{'2026':{CONSOLIDADO:{<conta>:[12 valores]}}}, 'ORÇADO':{...}}; com `buscar` o servidor entrega só o necessário.
   ===================================================================== */
'use strict';
(function () {
  const MESES = ['JANEIRO', 'FEVEREIRO', 'MARÇO', 'ABRIL', 'MAIO', 'JUNHO', 'JULHO', 'AGOSTO', 'SETEMBRO', 'OUTUBRO', 'NOVEMBRO', 'DEZEMBRO'];
  const MES3 = ['JAN', 'FEV', 'MAR', 'ABR', 'MAI', 'JUN', 'JUL', 'AGO', 'SET', 'OUT', 'NOV', 'DEZ'];
  const chaveConta = v => (v == null ? '' : (typeof v === 'number' ? String(Math.round(v)) : String(v).trim().toUpperCase()));

  /* ---------------- fórmulas ---------------- */
  class ErroCalc extends Error {}
  const compiladas = new Map();

  function tokens(s) {
    const t = []; const re = /\s*(?:(\d+(?:\.\d+)?)|([A-Z]{1,2}\d+)|([A-Z]+)|(<>|<=|>=|[-+*\/(),:=<>]))/gy; let m;
    re.lastIndex = 0;
    while (re.lastIndex < s.length && (m = re.exec(s))) {
      if (m[1] != null) t.push({ k: 'n', v: parseFloat(m[1]) });
      else if (m[2]) t.push({ k: 'r', v: m[2] });
      else if (m[3]) t.push({ k: 'i', v: m[3] });
      else t.push({ k: 'o', v: m[4] });
    }
    return t;
  }

  function compilar(formula) {
    if (compiladas.has(formula)) return compiladas.get(formula);
    const T = tokens(formula); let p = 0;
    const olha = () => T[p], pega = () => T[p++];
    const ehOp = v => T[p] && T[p].k === 'o' && T[p].v === v;
    function cmp() {
      let a = soma();
      if (T[p] && T[p].k === 'o' && ['<>', '=', '<', '>', '<=', '>='].includes(T[p].v)) {
        const op = pega().v, b = soma();
        return c => { const x = a(c), y = b(c);
          return op === '<>' ? x !== y : op === '=' ? x === y : op === '<' ? x < y : op === '>' ? x > y : op === '<=' ? x <= y : x >= y; };
      }
      return a;
    }
    function soma() {
      let a = prod();
      while (T[p] && T[p].k === 'o' && (T[p].v === '+' || T[p].v === '-')) {
        const op = pega().v, x = a, y = prod();
        a = op === '+' ? (c => num(x(c)) + num(y(c))) : (c => num(x(c)) - num(y(c)));
      }
      return a;
    }
    function prod() {
      let a = unario();
      while (T[p] && T[p].k === 'o' && (T[p].v === '*' || T[p].v === '/')) {
        const op = pega().v, x = a, y = unario();
        a = op === '*' ? (c => num(x(c)) * num(y(c))) : (c => { const d = num(y(c)); if (d === 0) throw new ErroCalc('#DIV/0!'); return num(x(c)) / d; });
      }
      return a;
    }
    function unario() {
      if (ehOp('+')) { pega(); return unario(); }
      if (ehOp('-')) { pega(); const x = unario(); return c => -num(x(c)); }
      return primario();
    }
    function primario() {
      const t = pega();
      if (!t) throw new Error('fórmula incompleta: ' + formula);
      if (t.k === 'n') return () => t.v;
      if (t.k === 'o' && t.v === '(') { const e = cmp(); pega(); return e; }
      if (t.k === 'r') {
        if (ehOp(':')) { pega(); const f = pega().v; return c => c.faixa(t.v, f); }
        return c => c.celula(t.v);
      }
      if (t.k === 'i') {
        if (t.v === 'MES') return c => c.mes;
        if (t.v === 'FLAG') return c => c.flag;
        pega(); // (
        const args = [];
        while (!ehOp(')')) {
          if (ehOp(',')) { pega(); args.push(null); continue; }
          args.push(cmp());
          if (ehOp(',')) { pega(); if (ehOp(')')) args.push(null); }
        }
        pega(); // )
        if (t.v === 'SUM') return c => { let s = 0; for (const a of args) { if (!a) continue; const v = a(c); s += Array.isArray(v) ? v.reduce((x, y) => x + num(y), 0) : num(v); } return s; };
        if (t.v === 'IFERROR') return c => { try { const v = args[0](c); if (typeof v === 'number' && !isFinite(v)) throw new ErroCalc('#NUM'); return v; } catch (e) { if (e instanceof ErroCalc) return args[1](c); throw e; } };
        if (t.v === 'IF') return c => (args[0](c) ? args[1](c) : (args[2] ? args[2](c) : false));
        throw new Error('função não suportada: ' + t.v);
      }
      throw new Error('símbolo inesperado em: ' + formula);
    }
    const f = cmp();
    compiladas.set(formula, f);
    return f;
  }
  const num = v => (v == null || v === '' || v === false ? 0 : (typeof v === 'number' ? v : (typeof v === 'boolean' ? (v ? 1 : 0) : (isNaN(parseFloat(v)) ? 0 : parseFloat(v)))));

  const colNum = s => s.split('').reduce((a, ch) => a * 26 + ch.charCodeAt(0) - 64, 0);
  const colLet = n => { let s = ''; while (n > 0) { const m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26); } return s; };
  const parteRef = r => { const m = /^([A-Z]+)(\d+)$/.exec(r); return [m[1], +m[2]]; };

  /* Cada coluna da aba tem a sua "fonte": qual aba (REAL/ORÇADO), qual ano e quais meses entram. */
  function fonteDaColuna(col, sel) {
    const { ano, mes } = sel;
    const un = {
      C: ['REAL', mes === 1 ? ano - 1 : ano, mes === 1 ? [12] : [mes - 1]],
      E: ['REAL', ano, [mes]], F: ['ORÇADO', ano, [mes]], G: ['REAL', ano - 1, [mes]],
      K: ['REAL', ano, rng(1, mes)], L: ['ORÇADO', ano, rng(1, mes)], M: ['REAL', ano - 1, rng(1, mes)],
    }[col];
    return un ? { src: un[0], ano: un[1], meses: un[2] } : null;
  }
  const rng = (a, b) => { const r = []; for (let i = a; i <= b; i++) r.push(i); return r; };

  /* Avaliador da aba: `fontes` = {coluna: {src, ano, meses}}. Cada coluna (C, E, F, G, K, L, M) tem as suas fórmulas e a sua fonte;
     uma fórmula que cita outra coluna (ex.: K298 = E298) lê o valor dela na fonte dela. Devolve ler(coluna, linha). */
  function avaliador(molde, dados, unidade, fontes, mesAcum) {
    const porNum = {};
    molde.linhas.forEach(l => { porNum[l.r] = l; });
    const memo = new Map();
    const ctxDe = col => ({
      mes: mesAcum, flag: molde.flag,
      celula(ref) {
        const [c, r] = parteRef(ref);
        if (c === 'A') { const l = porNum[r]; const a = l && l.a; return a && typeof a === 'object' ? molde.flag : (a == null ? 0 : a); }
        return valor(c, r);
      },
      faixa(a, b) {
        const [c1, r1] = parteRef(a), [c2, r2] = parteRef(b), out = [];
        for (let r = r1; r <= r2; r++) for (let c = colNum(c1); c <= colNum(c2); c++) out.push(valor(colLet(c), r));
        return out;
      },
    });
    const ctxs = {};
    function valor(col, r) {
      const k = col + r;
      if (memo.has(k)) return memo.get(k);
      const l = porNum[r], cel = l && l.cel[col], fonte = fontes[col];
      let v = 0;
      if (!cel || !fonte) v = 0;
      else if (cel.f === 'L') {
        const base = ((dados[fonte.src] || {})[fonte.ano] || {})[unidade];
        const conta = base && base[chaveConta(l.a)];
        v = conta ? fonte.meses.reduce((s, m) => s + (conta[m - 1] || 0), 0) : 0;
      } else if (cel.f) {
        try { v = compilar(cel.f)(ctxs[col] || (ctxs[col] = ctxDe(col))); } catch (e) { if (e instanceof ErroCalc) v = null; else throw e; }
        if (typeof v === 'number' && !isFinite(v)) v = null;
      } else if (cel.v != null) v = cel.v;
      memo.set(k, v);
      return v;
    }
    return valor;
  }

  /* Grade da visão "mês + acumulado": as sete colunas da aba. */
  function grade(molde, dados, sel) {
    const cols = ['C', 'E', 'F', 'G', 'K', 'L', 'M'], fontes = {};
    cols.forEach(c => { fontes[c] = fonteDaColuna(c, sel); });
    const ler = avaliador(molde, dados, sel.unidade, fontes, sel.mes);
    const out = {}; cols.forEach(c => { out[c] = r => ler(c, r); });
    return out;
  }

  /* ---------------- formato de número do Excel ---------------- */
  const sepMil = s => s.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  function secoesDe(fmt) {
    const out = []; let atual = '', aspas = false;
    for (let i = 0; i < fmt.length; i++) {
      const c = fmt[i];
      if (c === '"') { aspas = !aspas; atual += c; } else if (c === '\\' && !aspas) { atual += c + (fmt[++i] || ''); } else if (c === ';' && !aspas) { out.push(atual); atual = ''; } else atual += c;
    }
    out.push(atual); return out;
  }

  function formatar(fmt, v) {
    if (v == null) return '';
    if (typeof v === 'string') return esc(v);
    if (!fmt || fmt === 'General' || fmt === '@') { if (typeof v === 'number') return esc(Number.isInteger(v) ? String(v) : String(Math.round(v * 100) / 100).replace('.', ',')); return esc(v); }
    const sec = secoesDe(fmt);
    let corpo, x = v, neg = false;
    if (v === 0 && sec.length >= 3) corpo = sec[2];
    else if (v < 0 && sec.length >= 2) { corpo = sec[1]; x = -v; neg = true; }
    else { corpo = sec[0]; if (v < 0) { x = -v; neg = true; } }
    const temSecNeg = v < 0 && sec.length >= 2;
    let saida = '', i = 0, feito = false;
    const pct = /%/.test(corpo.replace(/"[^"]*"/g, ''));
    while (i < corpo.length) {
      const c = corpo[i];
      if (c === '"') { const j = corpo.indexOf('"', i + 1); saida += esc(corpo.slice(i + 1, j < 0 ? corpo.length : j)); i = (j < 0 ? corpo.length : j) + 1; continue; }
      if (c === '\\') { saida += esc(corpo[i + 1] || ''); i += 2; continue; }
      if (c === '_') { saida += '<span style="visibility:hidden">' + esc(corpo[i + 1] || '') + '</span>'; i += 2; continue; }
      if (c === '*') { i += 2; continue; }
      if (c === '[') { const j = corpo.indexOf(']', i); i = j < 0 ? corpo.length : j + 1; continue; }
      if (c === '%') { saida += '%'; i++; continue; }
      if (c === '@') { saida += esc(v); i++; continue; }
      if (/[#0?,.]/.test(c) && !feito) {
        let j = i; while (j < corpo.length && /[#0?,.]/.test(corpo[j])) j++;
        const tok = corpo.slice(i, j); i = j; feito = true;
        const ponto = tok.indexOf('.'); const inteiro = ponto < 0 ? tok : tok.slice(0, ponto); const dec = ponto < 0 ? '' : tok.slice(ponto + 1);
        const casas = (dec.match(/[0#?]/g) || []).length; const escala = (ponto < 0 ? inteiro : dec).match(/,+$/);
        const nEscala = escala ? escala[0].length : 0;
        const grupos = /[#0?],[#0?]/.test(inteiro);
        let val = x * (pct ? 100 : 1) / Math.pow(1000, nEscala);
        let txt = val.toFixed(casas);
        let [ip, fp] = txt.split('.');
        const minInt = (inteiro.replace(/,/g, '').match(/0/g) || []).length;
        if (ip === '0' && minInt === 0) ip = '';
        if (grupos) ip = sepMil(ip);
        const todosZero = !/[1-9]/.test(txt);
        if (c === '?' || (ip === '' && !fp)) { /* mantém */ }
        saida += (ip || '') + (fp ? ',' + fp : '');
        if (todosZero && sec.length === 1 && neg) { /* -0 vira 0 */ neg = false; }
        continue;
      }
      if (/[#0?,.]/.test(c)) { i++; continue; }
      saida += esc(c); i++;
    }
    if (neg && !temSecNeg) saida = '-' + saida;
    return saida;
  }

  /* ---------------- desenho ---------------- */
  const CSS = `
.dd-wrap{margin:8px 0 24px}
.dd-bar{display:flex;flex-wrap:wrap;gap:10px 16px;align-items:end;margin:0 0 12px;padding:12px 14px;background:var(--surface,#fff);border:1px solid var(--border,#e3dccf);border-radius:2px}
.dd-bar label{display:flex;flex-direction:column;gap:3px;font:600 10.5px/1.2 var(--sans,Arial);letter-spacing:.06em;text-transform:uppercase;color:var(--muted,#8a7f72)}
.dd-bar select{font:500 13px var(--sans,Arial);padding:5px 8px;border:1px solid var(--border,#d9d0c0);background:#fff;color:var(--ink,#1a140f);min-width:96px}
.dd-seg{display:inline-flex;border:1px solid var(--border,#d9d0c0);border-radius:2px;overflow:hidden}
.dd-seg button{font:600 12px var(--sans,Arial);padding:6px 12px;border:0;background:#fff;color:var(--ink2,#4a4036);cursor:pointer}
.dd-seg button.on{background:var(--blue,#92705d);color:#fff}
.dd-bar .dd-btn{font:600 12px var(--sans,Arial);padding:6px 12px;border:1px solid var(--border,#d9d0c0);border-radius:2px;background:#fff;color:var(--ink2,#4a4036);cursor:pointer}
.dd-bar .dd-btn:hover{border-color:var(--blue,#92705d);color:var(--blue,#92705d)}
.dd-bar .dd-esp{flex:1}
.dd-stage{overflow:auto;background:#fff;border:1px solid var(--border,#e3dccf)}
.dd-sheet{transform-origin:0 0;background:#fff}
.dd{border-collapse:collapse;table-layout:fixed;font-family:Arial,Helvetica,sans-serif;color:#000}
.dd td{position:relative;padding:0 3px;overflow:hidden;white-space:nowrap;box-sizing:border-box;vertical-align:middle}
.dd td.dd-q{white-space:normal;line-height:1.1}
.dd td.dd-h{position:sticky;z-index:3}
.dd td.dd-r{text-align:right}
.dd tr.dd-rec{display:none}
.dd .dd-tg{position:absolute;left:5px;top:50%;margin-top:-7px;width:13px;height:13px;border:1px solid #666;background:#fff;color:#222;font:700 11px/11px Arial;text-align:center;cursor:pointer;user-select:none;box-sizing:border-box}
.dd .dd-tg:hover{background:#e8e8ff}
.dd-nota{margin:8px 2px 0;font:12px/1.4 var(--sans,Arial);color:var(--muted,#8a7f72)}
.dd-wrap.dd-tela{position:fixed;inset:0;z-index:200;margin:0;padding:10px 14px;background:var(--ground,#f4efe7);overflow:auto}
.dd-wrap.dd-tela .dd-stage{border:0;overflow:visible;background:transparent}
@media print{.dd-bar,.dd-nota{display:none}.dd-stage{border:0;overflow:visible}.dd-wrap.dd-tela{position:static}
body.dd-imprimindo *{visibility:hidden}body.dd-imprimindo .dd-imp,body.dd-imprimindo .dd-imp *{visibility:visible}
.dd-imp{position:absolute;left:0;top:0;width:100%;margin:0}}
`;
  function injetarCss() {
    if (document.getElementById('dd-css')) return;
    const s = document.createElement('style'); s.id = 'dd-css'; s.textContent = CSS; document.head.appendChild(s);
  }

  const DENSIDADE = { gray125: .125, gray0625: .0625, lightGray: .25, mediumGray: .5, darkGray: .75, lightGrid: .2, lightTrellis: .25, lightUp: .2, lightDown: .2 };
  /* fixo = célula de cabeçalho congelado: fundo opaco e bordas por sombra interna (a borda da tabela não acompanha célula sticky) */
  function cssDoEstilo(e, fixo) {
    const css = [];
    if (fixo) css.push('background-color:#fff');
    css.push('font-family:' + (e.fn ? "'" + e.fn + "'," : '') + 'Arial,Helvetica,sans-serif');
    css.push('font-size:' + (((e.sz || 10) * 4) / 3).toFixed(2) + 'px');
    if (e.b) css.push('font-weight:700'); if (e.i) css.push('font-style:italic'); if (e.u) css.push('text-decoration:underline');
    if (e.co) css.push('color:#' + e.co);
    const f = e.fill;
    if (f) {
      if (f.t === 'solid') css.push('background:#' + f.fg);
      else {
        const d = DENSIDADE[f.t] || .125, r = Math.sqrt(16 * d / Math.PI).toFixed(2);
        css.push('background-color:#' + (f.bg || 'FFFFFF') + ';background-image:radial-gradient(circle,#' + f.fg + ' ' + r + 'px,transparent ' + (+r + .1).toFixed(2) + 'px);background-size:4px 4px');
      }
    }
    const larg = { thin: 1, hair: 1, dotted: 1, dashed: 1, medium: 2, thick: 3, double: 3 };
    const tipo = { dotted: 'dotted', hair: 'dotted', dashed: 'dashed', double: 'double' };
    const lado = { t: 'top', b: 'bottom', l: 'left', r: 'right' };
    if (fixo) {
      const sombras = Object.keys(e.bd || {}).map(k => { const [est, cor] = e.bd[k]; const w = larg[est] || 1;
        return 'inset ' + (k === 'l' ? w : k === 'r' ? -w : 0) + 'px ' + (k === 't' ? w : k === 'b' ? -w : 0) + 'px 0 0 #' + cor; });
      if (sombras.length) css.push('box-shadow:' + sombras.join(','));
    } else Object.keys(e.bd || {}).forEach(k => { const [est, cor] = e.bd[k]; css.push('border-' + lado[k] + ':' + (larg[est] || 1) + 'px ' + (tipo[est] || 'solid') + ' #' + cor); });
    if (e.h === 'center' || e.h === 'centerContinuous') css.push('text-align:center');
    else if (e.h === 'right') css.push('text-align:right');
    else if (e.h === 'left') css.push('text-align:left');
    if (e.ind) css.push('padding-left:' + (3 + e.ind * 9) + 'px');
    if (e.v === 'top') css.push('vertical-align:top'); else if (e.v === 'bottom') css.push('vertical-align:bottom');
    return css.join(';');
  }

  /* textos do cabeçalho que dependem da seleção (a aba os calcula por fórmula) */
  function cabecalho(sel) {
    const { ano, mes, unidade } = sel, ant = mes === 1 ? 12 : mes - 1;
    return {
      '4I': 'RESULTADO - ' + unidade, '6I': 'Performance - ' + ano,
      '7C': 'REAL ' + ano, '7E': 'REAL ' + ano, '7F': 'ORÇADO ' + ano, '7G': 'REAL ' + (ano - 1), '7K': 'REAL ' + ano, '7L': 'ORÇADO ' + ano, '7M': 'REAL ' + (ano - 1),
      '8C': 'MÊS ANTERIOR', '8E': MESES[mes - 1], '8K': 'ACUMULADO',
      '8I': unidade === 'CONSOLIDADO' ? 'CONSOLIDADO + 55 Brazil' : unidade + '          Resultado Gerencial',
      '9C': MESES[ant - 1], '9E': ano, '9F': 'ORÇAMENTO', '9G': ano - 1, '9K': ano, '9L': 'ORÇAMENTO', '9M': ano - 1,
    };
  }

  /* Monta o HTML da tabela. visao = 'mes' | 'evol'. recolhidas = Set dos grupos abertos. */
  function htmlTabela(molde, dados, sel, visao, abertos) {
    const est = molde.estilos, linhas = molde.linhas;
    const cab = cabecalho(sel);
    const px = w => Math.round(w * 7);
    let colunas, cabecalhoEvol = null;
    if (visao === 'evol') {
      colunas = [{ k: 'B' }, { k: 'I', largura: molde.colunas.I }].concat(rng(1, 12).map(m => ({ k: 'E', mes: m, largura: 12.5 })), [{ k: 'K', total: true, largura: 14.8 }]);
      cabecalhoEvol = true;
    } else {
      colunas = ['B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N'].map(k => ({ k, largura: molde.colunas[k] }));
    }
    colunas.forEach(c => { c.largura = c.largura || molde.colunas[c.k] || 8.43; });
    // valores
    let leitura;
    if (visao === 'mes') leitura = grade(molde, dados, sel);
    else {
      leitura = {};
      colunas.forEach((c, i) => {
        if (c.mes) { const ler = avaliador(molde, dados, sel.unidade, { E: { src: 'REAL', ano: sel.ano, meses: [c.mes] } }, c.mes); leitura[i] = r => ler('E', r); }
        else if (c.total) { const ler = avaliador(molde, dados, sel.unidade, { E: { src: 'REAL', ano: sel.ano, meses: [12] }, K: { src: 'REAL', ano: sel.ano, meses: rng(1, 12) } }, 12); leitura[i] = r => ler('K', r); }
      });
    }
    const larguraTotal = colunas.reduce((a, c) => a + px(c.largura), 0);
    let h = '<table class="dd" style="width:' + larguraTotal + 'px"><colgroup>' + colunas.map(c => '<col style="width:' + px(c.largura) + 'px">').join('') + '</colgroup><tbody>';
    // grupos: uma linha oculta pertence à última linha visível anterior
    const pai = {}; let ultimaVisivel = null;
    linhas.forEach(l => { if (l.o) pai[l.r] = ultimaVisivel; else ultimaVisivel = l.r; });
    const temFilhos = new Set(Object.values(pai));
    let alturaTotal = 0, topoAcum = 0;
    linhas.forEach(l => {
      if (l.r < 4) return;                               // linhas 1–3: seletores da planilha (não aparecem na imagem)
      const aberto = !l.o || abertos.has(pai[l.r]);
      const altura = Math.round((l.h || 15) * 4 / 3);
      if (aberto) alturaTotal += altura;
      h += '<tr' + (aberto ? '' : ' class="dd-rec"') + ' data-r="' + l.r + '" style="height:' + altura + 'px">';
      const pulo = {}, topoLinha = topoAcum;
      colunas.forEach((c, ci) => {
        if (pulo[ci]) return;
        const cel = l.cel[c.k] || {};
        const e = est[cel.s || 0] || {};
        let conteudo = '', cls = '', span = 1;
        const chaveCab = l.r + c.k;
        const ehCab = l.r <= 9;
        if (ehCab) {
          if (visao === 'evol') {
            if (c.k === 'I') conteudo = l.r === 4 ? cab['4I'] : l.r === 6 ? cab['6I'] : l.r === 8 ? cab['8I'] : (cel.v != null ? cel.v : '');
            else if (c.mes) conteudo = l.r === 7 ? 'REAL ' + sel.ano : l.r === 8 ? MES3[c.mes - 1] : l.r === 9 ? sel.ano : '';
            else if (c.total) conteudo = l.r === 7 ? 'REAL ' + sel.ano : l.r === 8 ? 'TOTAL' : l.r === 9 ? sel.ano : '';
          } else conteudo = cab[chaveCab] != null ? cab[chaveCab] : (cel.v != null ? cel.v : '');
          // títulos centralizados sobre as colunas seguintes (centerContinuous)
          if (e.h === 'centerContinuous' && conteudo !== '' && conteudo != null) {
            for (let k = ci + 1; k < colunas.length; k++) {
              const prox = l.cel[colunas[k].k] || {}; const ep = est[prox.s || 0] || {};
              const vazio = (cab[l.r + colunas[k].k] == null) && prox.v == null;
              if (ep.h === 'centerContinuous' && vazio && visao === 'mes') { span++; pulo[k] = true; } else break;
            }
          }
          if (typeof conteudo === 'number') conteudo = String(conteudo);
          conteudo = esc(conteudo);
        } else {
          const rot = c.k === 'I';
          if (rot) {
            conteudo = esc(cel.v != null ? cel.v : '');
            if (temFilhos.has(l.r) && conteudo !== '') conteudo = '<span class="dd-tg" data-g="' + l.r + '" title="Mostrar/ocultar detalhe">' + (abertos.has(l.r) ? '−' : '+') + '</span>' + conteudo;
          } else if (visao === 'mes' ? leitura[c.k] && cel.f : leitura[ci] && (l.cel.E || {}).f) {
            const ler = visao === 'mes' ? leitura[c.k] : leitura[ci];
            const v = ler(l.r);
            const celE = visao === 'mes' ? cel : (c.total ? (l.cel.K || {}) : (l.cel.E || {}));
            conteudo = formatar((est[celE.s || 0] || {}).nf, v);
            cls = ' class="dd-r"';
          }
        }
        const estilo = visao === 'evol' && !ehCab && c.k === 'E' ? est[(l.cel.E || {}).s || 0] : e;
        if ((estilo || e).wrap) cls = cls ? cls.replace('dd-r', 'dd-r dd-q') : ' class="dd-q"';
        let cl = cls; if (ehCab) cl = cl ? cl.replace('class="', 'class="dd-h ') : ' class="dd-h"';
        h += '<td' + cl + (span > 1 ? ' colspan="' + span + '"' : '') + ' style="' + cssDoEstilo(estilo || e, ehCab) + (ehCab ? ';top:' + topoLinha + 'px' : '') + '">' + conteudo + '</td>';
      });
      if (l.r <= 9) topoAcum += altura;
      h += '</tr>';
    });
    h += '</tbody></table>';
    return { html: h, largura: larguraTotal, altura: alturaTotal };
  }

  /* ---------------- interface ---------------- */
  function montar(host, cfg) {
    injetarCss();
    const molde = cfg.molde;
    /* a seleção (unidade, ano, mês) é uma só para a página: as visões "mês e acumulado" e "evolutivo" andam juntas */
    const comp = (window.__ddSel = window.__ddSel || {
      unidade: (cfg.padrao && cfg.padrao.unidade) || 'CONSOLIDADO', ano: (cfg.padrao && cfg.padrao.ano) || cfg.anos[cfg.anos.length - 1],
      mes: (cfg.padrao && cfg.padrao.mes) || 12 });
    const estado = {
      get unidade() { return comp.unidade; }, set unidade(v) { comp.unidade = v; },
      get ano() { return comp.ano; }, set ano(v) { comp.ano = v; },
      get mes() { return comp.mes; }, set mes(v) { comp.mes = v; },
      visao: cfg.visao || 'mes', abertos: new Set(),
    };
    const fixa = !!cfg.visao;                            // visão fixa: sem o seletor Mês e acumulado | Evolutivo
    const instancias = (window.__ddInst = (window.__ddInst || []).filter(i => document.body.contains(i.host)));
    let dados = cfg.dados || {}, tela = false;
    host.innerHTML = '<div class="dd-wrap"><div class="dd-bar"></div><div class="dd-stage"><div class="dd-sheet"></div></div>'
      + '<div class="dd-nota">Valores em R$ mil. Orçamento e ano anterior vêm das abas ORÇADO e REAL do Painel de Resultado; subtotais e percentuais são calculados pelas mesmas fórmulas da planilha.</div></div>';
    const wrap = host.querySelector('.dd-wrap'), bar = host.querySelector('.dd-bar'), stage = host.querySelector('.dd-stage'), folha = host.querySelector('.dd-sheet');
    const opcoes = (lista, atual, rot) => lista.map(v => '<option value="' + esc(v) + '"' + (String(v) === String(atual) ? ' selected' : '') + '>' + esc(rot ? rot(v) : v) + '</option>').join('');
    function barra() {
      bar.innerHTML = '<label>Unidade<select data-f="unidade">' + opcoes(cfg.unidades, estado.unidade) + '</select></label>'
        + '<label>Ano<select data-f="ano">' + opcoes(cfg.anos, estado.ano) + '</select></label>'
        + (estado.visao === 'evol' ? '' : '<label>Mês<select data-f="mes">' + opcoes(rng(1, 12), estado.mes, m => MESES[m - 1]) + '</select></label>')
        + (fixa ? '' : '<div class="dd-seg"><button type="button" data-v="mes" class="' + (estado.visao === 'mes' ? 'on' : '') + '">Mês e acumulado</button>'
        + '<button type="button" data-v="evol" class="' + (estado.visao === 'evol' ? 'on' : '') + '">Evolutivo</button></div>')
        + '<span class="dd-esp"></span><button type="button" class="dd-btn" data-a="todos">Expandir tudo</button>'
        + '<button type="button" class="dd-btn" data-a="tela">' + (tela ? 'Sair da tela cheia' : '⤢ Tela cheia') + '</button>'
        + '<button type="button" class="dd-btn" data-a="imprimir">Imprimir</button>';
    }
    function ajustar(info) {
      const disp = stage.clientWidth || info.largura;
      const escala = tela ? Math.max(.3, (wrap.clientWidth - 28) / info.largura) : Math.min(1, disp / info.largura);
      folha.style.width = info.largura + 'px';
      if ('zoom' in document.body.style) { folha.style.zoom = escala.toFixed(4); folha.style.transform = ''; folha.style.height = ''; }
      else { folha.style.transform = 'scale(' + escala.toFixed(4) + ')'; folha.style.height = info.altura + 'px'; }
      const cheia = Math.ceil(info.altura * escala + 2);
      const livre = tela ? Math.max(200, wrap.clientHeight - bar.offsetHeight - 70) : Math.max(380, window.innerHeight - 150);
      stage.style.height = Math.min(cheia, livre) + 'px';
      stage.style.overflowX = escala < 1 ? 'hidden' : 'auto';
      stage.style.overflowY = cheia > livre ? 'auto' : 'hidden';
    }
    async function desenhar() {
      barra();
      if (cfg.buscar) { try { dados = await cfg.buscar({ unidade: estado.unidade, ano: estado.ano, mes: estado.mes }); } catch (e) { folha.innerHTML = '<p>Não consegui carregar os números.</p>'; return; } }
      const r = htmlTabela(molde, dados, estado, estado.visao, estado.abertos);
      folha.innerHTML = r.html; ajustar(r);
      estado.ultima = r;
    }
    bar.addEventListener('change', ev => { const f = ev.target.dataset.f; if (!f) return; estado[f] = f === 'unidade' ? ev.target.value : +ev.target.value; window.__ddInst.forEach(i => i.desenhar()); });
    bar.addEventListener('click', ev => {
      const v = ev.target.closest('[data-v]'); if (v) { estado.visao = v.dataset.v; desenhar(); return; }
      const a = ev.target.closest('[data-a]'); if (!a) return;
      if (a.dataset.a === 'todos') {
        const todos = new Set(); molde.linhas.forEach(l => { if (!l.o) return; });
        const pais = new Set(); let ult = null; molde.linhas.forEach(l => { if (l.o) pais.add(ult); else ult = l.r; });
        estado.abertos = estado.abertos.size ? new Set() : pais; desenhar();
      } else if (a.dataset.a === 'tela') alternarTela();
      else if (a.dataset.a === 'imprimir') imprimir();
    });
    folha.addEventListener('click', ev => {
      const g = ev.target.closest('.dd-tg'); if (!g) return; const n = +g.dataset.g;
      estado.abertos.has(n) ? estado.abertos.delete(n) : estado.abertos.add(n); desenhar();
    });
    /* só a DRE sai na impressão, em A4 paisagem e reduzida para caber na largura da página */
    function imprimir() {
      const info = estado.ultima; if (!info) return;
      const est = document.createElement('style'); est.textContent = '@page{size:A4 landscape;margin:8mm}'; document.head.appendChild(est);
      document.body.classList.add('dd-imprimindo'); wrap.classList.add('dd-imp');
      const esc = Math.min(1, 1030 / info.largura);
      if ('zoom' in document.body.style) { folha.style.zoom = esc.toFixed(4); folha.style.transform = ''; folha.style.height = ''; }
      else { folha.style.transform = 'scale(' + esc.toFixed(4) + ')'; folha.style.height = info.altura + 'px'; }
      stage.style.height = 'auto'; stage.style.overflow = 'visible';
      const volta = () => { window.removeEventListener('afterprint', volta); document.body.classList.remove('dd-imprimindo'); wrap.classList.remove('dd-imp'); est.remove(); ajustar(info); };
      window.addEventListener('afterprint', volta);
      setTimeout(() => window.print(), 60);
    }
    function alternarTela() {
      tela = !tela; wrap.classList.toggle('dd-tela', tela);
      if (tela && wrap.requestFullscreen) wrap.requestFullscreen().catch(() => {});
      if (!tela && document.fullscreenElement) document.exitFullscreen().catch(() => {});
      desenhar();
    }
    document.addEventListener('fullscreenchange', () => { if (!document.fullscreenElement && tela) { tela = false; wrap.classList.remove('dd-tela'); desenhar(); } });
    window.addEventListener('resize', () => { if (estado.ultima) ajustar(estado.ultima); });
    desenhar();
    const inst = { host, desenhar, estado };
    instancias.push(inst);
    return inst;
  }

  window.DREDIN_UI = { montar, formatar, avaliador, grade, htmlTabela, compilar, fonteDaColuna, chaveConta };
  if (typeof module !== 'undefined') module.exports = window.DREDIN_UI;
})();
