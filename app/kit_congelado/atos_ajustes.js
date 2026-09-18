/* ===== +55 Design · Roteiro em Atos — ajustes de conteúdo ==================
   Correções e cortes pedidos para o roteiro executivo. Vivem AQUI, e não no
   app.js/insights.js, porque o relatório completo continua sendo a versão de
   referência: nada neste arquivo o alcança.

   Carrega DEPOIS do app.js e do insights.js e ANTES do atos.js. As trocas são
   feitas no momento do load, antes do init() — que é quando os gráficos são
   desenhados. Os cortes de DOM rodam a cada passada do atos.js, porque os
   filtros redesenham o corpo das seções.

   O que muda
   ----------
   1. Régua de "Vendas realizadas vs. orçamento": ganha o quadro com a venda
      prevista para o ano cheio em cada cenário, e o ritmo composto de cada um.
   2. "Classificação da carteira por status": clicar de novo na barra já ativa
      fecha a tabela de pedidos, em vez de só redesenhá-la.
   3. "Ponte do resultado": a cascata para no EBIT (EBITDA − depreciação).
      Financeiro, absorção e resultado líquido saem do gráfico.
   4. line(): a escala passa a acomodar valores negativos. Com ymn fixo em zero,
      um EBITDA negativo era desenhado fora da área do gráfico e sumia.
   5. Sai o indicador "Taxa média fabril" do painel de CPV.
   6. Sai o grupo "Os pontos que importam".
   7. Saem os blocos de endividamento gerado, juros a terceiros e geração mês a
      mês — a seção fica só no saldo com o acionista.
   8. "O que está em jogo": corte de materialidade e fim do piso em zero, para o
      cartão da recompra poder mostrar um resultado negativo quando ele existe.
   9. Dois blocos novos no canal — a dispersão do esforço comercial e a
      recorrência da carteira de arquitetos. Ligados por window.CANAL_ATIVO.
  10. Totalizador nas duas tabelas de segmento do RFV (clientes e arquitetos).
  11. Acabamento dos gráficos: rótulo de ponta nas linhas e tipografia uniforme
      (uma unidade de viewBox = um pixel, em todo o deck).
   ========================================================================= */
'use strict';
(function(){

/* ---------- formatadores locais ----------
   nf, money, pct, spct e esc sao `const` no app.js e por isso nao existem em
   window; mi, table, waterfall, line e vendaMensalPorAno sao declaracoes de
   funcao e podem ser usados (e trocados) pelo nome. */
function nf(v,d){ d=d||0; return (v==null||isNaN(v))?'':Number(v).toLocaleString('pt-BR',
  {minimumFractionDigits:d,maximumFractionDigits:d}); }
function money(v,d){ return (v==null||v==='')?'':'R$ '+nf(v,d||0); }
function spct(v,d){ if(v==null||v==='') return ''; v=+v; return (v>0?'+':'')+nf(v*100,d==null?1:d)+'%'; }
function esc(s){ return s==null?'':String(s).replace(/[&<>]/g,function(c){
  return {'&':'&amp;','<':'&lt;','>':'&gt;'}[c]; }); }
var GOOD='#577c69', BAD='#a8493c', MUT='#9c8e80', GRID='#e2d9c8', INK='#2a211b';
function sinal(v){ return (v==null||!isFinite(v))?'<span class="mut">—</span>'
  :'<span style="color:'+(v>=0?GOOD:BAD)+';font-weight:600">'+spct(v)+'</span>'; }
var W=function(v){ return (+v).toFixed(2); };

/* =========================================================================
   1) A régua da projeção ganha o quadro de cenários
   ========================================================================= */
/* O gráfico mostra quatro curvas e nenhum número de fechamento de ano; o quadro
   responde "quanto dá cada uma delas no ano cheio" e a que ritmo de crescimento
   cada cenário corresponde. Base 2021, a mesma que a evolutiva usa para CAGR. */
/* mesmo começo de série do app.js (ANO_INI_SERIE, derivado da base) — nunca um ano escrito aqui */
var ANO_BASE=(typeof ANO_INI_SERIE!=="undefined")?ANO_INI_SERIE:2021;
function quadroCenarios(M){
  if(typeof table!=='function') return '';
  var vMes=(typeof vendaMensalPorAno==='function')?vendaMensalPorAno():null;
  var soma=function(y){ return (vMes&&vMes[y])?vMes[y].reduce(function(a,b){return a+b;},0):null; };
  var vBase=soma(ANO_BASE), ant=M.ano-1, vAnt=soma(ant);
  var cagr=function(v){ return (v==null||!vBase||M.ano<=ANO_BASE)?null
    :Math.pow(v/vBase,1/(M.ano-ANO_BASE))-1; };
  var linha=function(nome,nota,v){
    return ['<b>'+esc(nome)+'</b><br><span class="mut" style="font-size:11px">'+esc(nota)+'</span>',
      v==null?'—':money(v),
      (v==null||!M.metaAno)?'—':sinal(v/M.metaAno-1),
      (v==null||!vAnt)?'—':sinal(v/vAnt-1),
      sinal(cagr(v))];
  };
  var rows=[
    linha('Orçamento','Vendas Previstas, como estão na planilha de metas',M.metaAno),
    linha('Meta sazonal','o mesmo total do orçamento, redistribuído pelo peso histórico de cada mês',M.metaAno),
    linha('Projeção histórica','o realizado extrapolado pela fração do ano que o histórico já esperava',M.totProjHist),
    linha('Ritmo CAGR','o ano anterior corrigido pelo próprio crescimento composto',M.totProjCagr)
  ];
  return '<div class="hl-quadro">'
   +'<div class="hl-quadro-t">Venda prevista no ano cheio, cenário a cenário</div>'
   +table(['Cenário','Previsto no ano','vs orçamento','vs '+ant,'Ritmo composto desde '+ANO_BASE],
      rows,['left','right','right','right','right'])
   +'<p class="hl-nota">Venda <b>contratada</b> do ano fechado — é o que o gráfico mede. A receita da DRE '
   +'vem depois, no faturamento da entrega. A última coluna é o crescimento composto ao ano que cada '
   +'cenário implicaria desde '+ANO_BASE+': é ali que se vê qual deles pede um passo diferente do que a '
   +'empresa vem dando. Orçamento e meta sazonal fecham no mesmo total — mudam só os meses em que a venda é cobrada.</p>'
   +'</div>';
}

if(window.INS&&INS.R&&INS.R.projecaoDistancia){
  var origProj=INS.R.projecaoDistancia;
  INS.R.projecaoDistancia=function(ctx){
    var o=origProj(ctx);
    if(o&&ctx&&ctx.metas) o.quadro=quadroCenarios(ctx.metas);
    return o;
  };
}
/* strip() nao conhece o campo `quadro`; o quadro entra logo antes da linha do
   gatilho, depois da grade de evidencia. */
if(window.INSRT&&INSRT.strip){
  var origStrip=INSRT.strip;
  INSRT.strip=function(o){
    var html=origStrip(o);
    if(o&&o.quadro&&html&&html.indexOf('hl-trg')>=0)
      html=html.replace('<p class="hl-trg">', o.quadro+'<p class="hl-trg">');
    return html;
  };
}

/* =========================================================================
   2) Carteira por status: a barra já ativa fecha a tabela
   ========================================================================= */
if(typeof drawCartdinStatus==='function'){
  var origCart=window.drawCartdinStatus, cartSel=null;
  window.drawCartdinStatus=function(i,bars){
    var box=document.getElementById('cartdin-status-detail');
    var aberto=box && box.innerHTML.trim()!=='';
    if(cartSel===i && aberto){
      cartSel=null;
      if(box) box.innerHTML='';
      Array.prototype.forEach.call(bars||[],function(b){ b.style.stroke=''; b.style.strokeWidth=''; });
      return;
    }
    cartSel=i;
    origCart(i,bars);
  };
}

/* =========================================================================
   3) A ponte do resultado para no EBIT
   ========================================================================= */
/* O EBIT nao existe como passo na cascata: e o EBITDA depois da depreciacao.
   O corte e feito na entrada do waterfall(), e so quando a cascata e a ponte do
   resultado (a unica que traz o passo "Resultado Liquido"). */
if(typeof waterfall==='function'){
  var origWf=window.waterfall;
  window.waterfall=function(steps,o){
    try{
      var temRL=steps.some(function(s){ return /resultado\s+l[ií]quido/i.test(s.label||''); });
      if(temRL){
        var iEb=-1,iDep=-1;
        steps.forEach(function(s,i){
          if(/^EBITDA/i.test(s.label||'')) iEb=i;
          if(/deprecia/i.test(s.label||'')) iDep=i;
        });
        if(iEb>=0&&iDep>=0){
          var novos=steps.slice(0,iDep+1);
          novos.push({label:'(=) EBIT',value:steps[iEb].value+steps[iDep].value,type:'t'});
          steps=novos;
        }
      }
    }catch(e){}
    return origWf(steps,o);
  };
}

/* =========================================================================
   4) line(): escala que acomoda negativo
   ========================================================================= */
/* Copia fiel do line() do app.js com UMA diferenca: ymn deixa de ser zero fixo
   e passa a ser o menor valor da serie (com folga), mais a linha do zero
   tracejada. Sem isso um EBITDA negativo era desenhado abaixo da area util e
   simplesmente sumia do grafico. Quando nao ha negativo, devolve o original —
   o desenho continua identico ao do relatorio completo. */
if(typeof line==='function'){
  var origLine=window.line;
  window.line=function(series,xlabels,o){
    o=o||{};
    var all=[];
    series.forEach(function(s){ (s[1]||[]).forEach(function(v){ if(v!=null) all.push(+v); }); });
    if(!all.length || Math.min.apply(null,all)>=0) return origLine(series,xlabels,o);

    var valfmt=o.valfmt||function(v){ return mi(v,1); };
    var w=o.w||860, h=o.h||340, pt=18,pr=18,pb=46,pl=64, pw=w-pl-pr, ph=h-pt-pb;
    var ymax=Math.max.apply(null,all.concat([1]));
    var ymnReal=Math.min.apply(null,all);
    var ymn=ymnReal-(ymax-ymnReal)*0.08;       /* folga: a curva nao encosta no eixo */
    var n=xlabels.length;
    var X=function(i){ return pl+(n>1?pw*i/(n-1):pw/2); };
    var Y=function(v){ return pt+ph-(ymax>ymn?ph*(v-ymn)/(ymax-ymn):0); };
    var s='<svg viewBox="0 0 '+w+' '+h+'" class="chart" style="max-width:100%;height:auto">';
    for(var g=0;g<5;g++){
      var yv=ymn+(ymax-ymn)*g/4, yy=Y(yv);
      s+='<line x1="'+pl+'" y1="'+W(yy)+'" x2="'+(pl+pw)+'" y2="'+W(yy)+'" stroke="'+GRID+'"/>';
      s+='<text x="'+(pl-8)+'" y="'+W(yy+4)+'" text-anchor="end" font-size="11" fill="'+MUT+'">'+esc(valfmt(yv))+'</text>';
    }
    if(ymn<0&&ymax>0){
      var y0=Y(0);
      s+='<line x1="'+pl+'" y1="'+W(y0)+'" x2="'+(pl+pw)+'" y2="'+W(y0)+'" stroke="'+INK
        +'" stroke-opacity=".45" stroke-dasharray="4 3"/>';
      s+='<text x="'+(pl+pw)+'" y="'+W(y0-5)+'" text-anchor="end" font-size="9.5" fill="'+MUT+'">zero</text>';
    }
    var step=Math.max(1,Math.floor(n/12));
    xlabels.forEach(function(xl,i){ if(i%step===0||i===n-1)
      s+='<text x="'+W(X(i))+'" y="'+(h-pb+18)+'" text-anchor="middle" font-size="10.5" fill="'+MUT+'">'+esc(xl)+'</text>'; });
    series.forEach(function(sr){
      var nm=sr[0], vals=sr[1]||[], col=sr[2], pts=[];
      vals.forEach(function(v,i){ if(v!=null) pts.push(W(X(i))+','+W(Y(v))); });
      if(pts.length) s+='<polyline points="'+pts.join(' ')+'" fill="none" stroke="'+col
        +'" stroke-width="2.4" stroke-linejoin="round" stroke-linecap="round"/>';
      vals.forEach(function(v,i){ if(v!=null)
        s+='<circle cx="'+W(X(i))+'" cy="'+W(Y(v))+'" r="3" fill="'+col+'"><title>'
          +esc(xlabels[i])+' · '+esc(nm)+': '+esc(valfmt(v))+'</title></circle>'; });
    });
    var leg=(series.length>1||o.legend)?'<div class="legend">'+series.map(function(sr){
      return '<span class="lg"><i style="background:'+sr[2]+'"></i>'+esc(sr[0])+'</span>'; }).join('')+'</div>':'';
    return leg+s+'</svg>';
  };
}

/* =========================================================================
   5, 6 e 7) cortes no DOM
   ========================================================================= */
/* Estes nao dao para resolver na origem sem mexer no app.js: os elementos sao
   escritos no meio de funcoes grandes. Como os filtros reescrevem o corpo das
   secoes, a limpeza roda a cada passada do atos.js (que chama esta funcao). */
var BLOCOS_FORA=['dv-endiv','dv-juros','dv-geracao'];
var KPI_FORA=['taxa média fabril'];

window.ATOS_AJUSTES_DOM=function(){
  /* 7) endividamento gerado, juros a terceiros e geração mês a mês */
  BLOCOS_FORA.forEach(function(b){
    document.querySelectorAll('[data-blk-of="'+b+'"],[data-blk="'+b+'"]').forEach(function(el){ el.remove(); });
  });

  /* 5) o indicador da taxa média fabril */
  document.querySelectorAll('.kpi').forEach(function(k){
    var l=k.querySelector('.kpi-l'); if(!l) return;
    if(KPI_FORA.indexOf(l.textContent.trim().toLowerCase())>=0) k.remove();
  });

  /* 6) o grupo "Os pontos que importam" — o <h3> e a grade .prov logo abaixo */
  document.querySelectorAll('h3').forEach(function(h){
    if(!/^Os pontos que importam/.test(h.textContent.trim())) return;
    var prox=h.nextElementSibling;
    if(prox&&prox.classList.contains('prov')) prox.remove();
    h.remove();
  });

  /* 3) o título acompanha o corte da cascata */
  document.querySelectorAll('[data-blk="dre-ponte"]').forEach(function(h){
    if(h.firstChild&&h.firstChild.nodeType===3&&/receita l[ií]quida ao resultado/.test(h.firstChild.nodeValue))
      h.firstChild.nodeValue='Ponte do resultado — da receita líquida ao EBIT';
  });

  /* 8) "O que está em jogo" */
  try{ corrigeJogo(); }catch(e){ console.warn('ajuste av-jogo:',e); }

  /* 9) os dois blocos novos do canal */
  try{ injetaCanal(); }catch(e){ console.warn('bloco do canal:',e); }

  /* 11) acabamento: rótulos de ponta e tipografia uniforme — por último, para
     pegar tudo o que os itens acima criaram ou trocaram */
  try{ acabamentoGraficos(); }catch(e){ console.warn('acabamento dos gráficos:',e); }
};

/* =========================================================================
   8) "O que está em jogo": materialidade e sinal
   =========================================================================
   O bloco simula o time com o ticket da líder e com a recompra dela. Dois
   defeitos de construção faziam o segundo cartão mentir:

   a) SEM CORTE DE MATERIALIDADE. Quem fez um único pedido na janela entra na
      conta com uma "média de pedidos por cliente" de 1,00 — que não é padrão,
      é o próprio pedido. Na janela de 12m até jul/26 o cartão inteiro (R$ 17
      mil) vinha de uma vendedora com 1 cliente e 1 pedido.
   b) PISO EM ZERO. Quem ficaria PIOR com a recompra da líder era zerado em vez
      de entrar negativo. Com isso o cartão nunca conseguia mostrar um resultado
      ruim — sempre parecia haver dinheiro na mesa.

   Somados, os dois escondiam o fato: a líder tem a PIOR recompra do time (1,22
   pedido por cliente contra 1,47). A vantagem dela é tamanho de pedido, não
   frequência. Sem o piso e sem o ruído, o cartão passa a dizer isso.

   O corte é por número de pedidos, e não por venda, porque a métrica simulada é
   pedidos por cliente: é dela que a base precisa. */
var MIN_PEDIDOS=5;

function blocoJogo(){
  var els=Array.prototype.slice.call(document.querySelectorAll('[data-blk-of="av-jogo"]'));
  if(!els.length) return null;
  var o={kpis:null,tw:null,cap:null};
  els.forEach(function(el){
    if(el.classList.contains('kpis')){ if(!o.kpis) o.kpis=el; return; }
    if(el.classList.contains('cap')){ if(!o.cap) o.cap=el; return; }
    var t=el.classList.contains('tw')?el:el.querySelector('.tw');
    if(t&&!o.tw) o.tw=t;
  });
  return o.kpis?o:null;
}

function kpiHtml(l,v,s,t){
  return '<div class="kpi'+(t?' '+t:'')+'"><div class="kpi-l">'+esc(l)+'</div>'
    +'<div class="kpi-v">'+v+'</div><div class="kpi-s">'+s+'</div></div>';
}

function corrigeJogo(){
  var B=blocoJogo(); if(!B) return;
  if(B.kpis.getAttribute('data-jogo')==='1') return;   /* já corrigido nesta renderização */
  if(typeof comercialAgg!=='function'||typeof ymAddMonths!=='function'||typeof table!=='function') return;

  var fim=MAXYM_VENDAS, A=comercialAgg(ymAddMonths(fim,-(avMeses-1)),fim);
  if(!A.vend.length) return;
  var lider=A.vend[0], demais=A.vend.slice(1);
  var mat=demais.filter(function(x){ return x.peds>=MIN_PEDIDOS; });
  var fora=demais.filter(function(x){ return x.peds<MIN_PEDIDOS; });
  if(!mat.length) return;

  var somaDe=function(l,f){ return l.reduce(function(s,x){ return s+f(x); },0); };
  var totMat  =somaDe(mat,function(x){ return x.v; });
  var gTicket =somaDe(mat,function(x){ return x.peds*lider.ticket-x.v; });
  var gRecomp =somaDe(mat,function(x){ return x.clis*lider.pedCli*x.ticket-x.v; });
  var pedsMat =somaDe(mat,function(x){ return x.peds; });
  var clisMat =somaDe(mat,function(x){ return x.clis; });
  var pedCliTime=clisMat?pedsMat/clisMat:0;
  var negT=gTicket<0, negR=gRecomp<0;

  B.kpis.innerHTML=
     kpiHtml('Se todos tivessem o ticket da líder', mi(gTicket),
       (negT?'a menos':'a mais')+' no período — pedido médio de '+money(lider.ticket)
       +' contra '+money(pedsMat?totMat/pedsMat:0)+' do time', negT?'':'ok')
   + kpiHtml('Se todos tivessem a recompra da líder', mi(gRecomp),
       (negR?'a menos':'a mais')+' no período — '+nf(lider.pedCli,2)+' pedido por cliente '
       +'contra '+nf(pedCliTime,2)+' do time', negR?'':'ok')
   + kpiHtml('Venda atual dos demais', mi(totMat),
       nf(mat.length)+' vendedores'
       +(fora.length?' · '+nf(fora.length)+' fora da conta (menos de '+MIN_PEDIDOS+' pedidos)':''));
  B.kpis.setAttribute('data-jogo','1');

  /* a tabela é a evidência do cartão: ganha a coluna de recompra e a líder no
     rodapé, para a comparação estar na própria página */
  if(B.tw&&B.tw.parentNode){
    var ord=mat.slice().sort(function(a,b){
      return (b.peds*lider.ticket-b.v)-(a.peds*lider.ticket-a.v); });
    var linhas=ord.map(function(x){
      var d=x.peds*lider.ticket-x.v;
      return [esc(x.name), money(x.v), money(x.ticket), money(x.peds*lider.ticket),
        '<span style="color:'+(d>=0?GOOD:BAD)+';font-weight:600">'+(d>0?'+':'')+money(d)+'</span>',
        nf(x.pedCli,2)];
    });
    var rodape=['<b>'+esc(lider.name)+' · líder</b>','<b>'+money(lider.v)+'</b>',
      '<b>'+money(lider.ticket)+'</b>','<span class="mut">—</span>','<span class="mut">—</span>',
      '<b>'+nf(lider.pedCli,2)+'</b>'];
    var tmp=document.createElement('div');
    tmp.innerHTML=table(['Vendedor(a)','Venda no período','Pedido médio hoje',
        'No pedido médio da líder','Diferença','Pedidos por cliente'],
      linhas,['left','right','right','right','right','right'],rodape);
    var nova=tmp.querySelector('.tw');
    if(nova){
      if(B.tw.getAttribute('data-blk-of')) nova.setAttribute('data-blk-of',B.tw.getAttribute('data-blk-of'));
      B.tw.parentNode.replaceChild(nova,B.tw);
    }
  }

  if(B.cap&&B.cap.getAttribute('data-jogo')!=='1'){
    B.cap.setAttribute('data-jogo','1');
    B.cap.innerHTML='A coluna “No pedido médio da líder” mantém a mesma quantidade de pedidos de cada '
      +'pessoa e só troca o valor médio do pedido pelo de '+esc(lider.name)+'. Não é meta: é uma forma de '
      +'medir quanto da distância do time vem apenas do tamanho dos pedidos. '
      +'<b>Fora da conta:</b> quem fez menos de '+MIN_PEDIDOS+' pedidos na janela — com um ou dois negócios '
      +'a média por cliente é o próprio pedido, não um padrão. '
      +'<b>Sem piso em zero:</b> onde o time já está acima da líder, o número aparece negativo — é o que '
      +'acontece na recompra, e é a informação que interessa.';
  }
}


/* =========================================================================
   9) O canal por vendedor: esforço comercial e recorrência da carteira
   =========================================================================
   Dois blocos novos, logo abaixo da RFV dos arquitetos. Não existem no app.js:
   são montados aqui e injetados em #aq-body a cada desenho da seção — por isso
   acompanham o filtro de janela sem nenhuma ligação extra.

   O que cada um responde
   ----------------------
   aq-esforco    : de onde vem a venda pelo canal de cada vendedor, decomposta
                   em arquitetos × pedidos por arquiteto × ticket. A dispersão
                   mostra que ticket e frequência andam em sentidos opostos: o
                   quadrante "caro e frequente" está vazio, e quem lidera lidera
                   por tamanho de carteira, não por nenhum dos dois eixos.
   aq-recorrencia: quantos arquitetos de cada carteira repetiram. A faixa de um
                   pedido só é separada entre "ainda recente" e "esfriou" — sem
                   isso, quem acabou de abrir dez relações aparece como quem
                   perdeu dez, que é o contrário do que aconteceu.

   Materialidade: entram só vendedores com pedidos pelo canal — quem não vende
   por arquiteto não tem o que comparar aqui. */

var CANAL_RECENTE=3;      /* meses: até aqui, um pedido só ainda não é abandono */

/* Chave de entrada dos dois blocos. Fica DESLIGADA no relatório: eles só entram
   quando a página declara window.CANAL_ATIVO=true — hoje só a prévia faz isso.
   Para levá-los ao roteiro, basta o gerar_html_atos.py passar a declarar também. */
var CANAL_ATIVO=(typeof window!=='undefined'&&window.CANAL_ATIVO===true);

/* ---------- primitiva: dispersão com quadrantes ----------
   O relatório não tinha gráfico de dispersão. Área (não raio) proporcional ao
   valor: raio proporcional exagera o maior em ~3x e mente sobre a diferença. */
function bolhas(pts,o){
  o=o||{};
  var w=o.w||980, h=o.h||400, pt=30, pr=26, pb=54, pl=78, pw=w-pl-pr, ph=h-pt-pb;
  var cor=o.cor||SER[0], rmax=o.rmax||46, rmin=11;
  var xf=o.xfmt||function(v){ return nf(v,2); };
  var yf=o.yfmt||function(v){ return mi(v,0); };
  var xs=pts.map(function(p){ return p.x; }), ys=pts.map(function(p){ return p.y; });
  var x0=Math.min.apply(null,xs), x1=Math.max.apply(null,xs);
  var y0=Math.min.apply(null,ys), y1=Math.max.apply(null,ys);
  var dx=(x1-x0)||1, dy=(y1-y0)||1;
  x0-=dx*0.22; x1+=dx*0.22; y0-=dy*0.26; y1+=dy*0.26;
  /* folga arredondada: sem isto o eixo sai com 0,85 / 1,42 / 1,99, que ninguem le */
  var passo=function(r){ var e=Math.pow(10,Math.floor(Math.log(r/4)/Math.LN10));
    var n=(r/4)/e; return e*(n<1.5?1:(n<3?2:(n<7?5:10))); };
  var px=passo(x1-x0), py=passo(y1-y0);
  x0=Math.floor(x0/px)*px; x1=Math.ceil(x1/px)*px;
  y0=Math.floor(y0/py)*py; y1=Math.ceil(y1/py)*py;
  var X=function(v){ return pl+pw*(v-x0)/(x1-x0); };
  var Y=function(v){ return pt+ph-ph*(v-y0)/(y1-y0); };
  var vmax=Math.max.apply(null,pts.map(function(p){ return p.r||0; }).concat([1]));
  var R=function(v){ return rmin+(rmax-rmin)*Math.sqrt((v||0)/vmax); };

  var s='<svg viewBox="0 0 '+w+' '+h+'" class="chart" style="max-width:100%;height:auto">';
  var g,yv,yy,xv,xx;
  for(yv=y0;yv<=y1+py*0.001;yv+=py){
    yy=Y(yv);
    s+='<line x1="'+pl+'" y1="'+W(yy)+'" x2="'+(pl+pw)+'" y2="'+W(yy)+'" stroke="'+GRID+'"/>';
    s+='<text x="'+(pl-9)+'" y="'+W(yy+4)+'" text-anchor="end" font-size="11" fill="'+MUT+'">'+esc(yf(yv))+'</text>';
  }
  for(xv=x0;xv<=x1+px*0.001;xv+=px){
    xx=X(xv);
    s+='<text x="'+W(xx)+'" y="'+(h-pb+20)+'" text-anchor="middle" font-size="10.5" fill="'+MUT+'">'+esc(xf(xv))+'</text>';
  }
  /* as médias do time são a moldura da leitura: é o cruzamento delas que separa
     "vende caro" de "vende com frequência" */
  if(o.medX!=null){
    s+='<line x1="'+W(X(o.medX))+'" y1="'+pt+'" x2="'+W(X(o.medX))+'" y2="'+(pt+ph)
      +'" stroke="'+INK+'" stroke-opacity=".3" stroke-dasharray="5 4"/>';
  }
  if(o.medY!=null){
    s+='<line x1="'+pl+'" y1="'+W(Y(o.medY))+'" x2="'+(pl+pw)+'" y2="'+W(Y(o.medY))
      +'" stroke="'+INK+'" stroke-opacity=".3" stroke-dasharray="5 4"/>';
  }
  var quad=o.quad||{};
  var canto=function(txt,x,y,anc){
    if(!txt) return '';
    return '<text x="'+W(x)+'" y="'+W(y)+'" text-anchor="'+anc+'" font-size="9.5" fill="'+MUT
      +'" letter-spacing=".1em">'+esc(txt.toUpperCase())+'</text>';
  };
  s+=canto(quad.ne,pl+pw-6,pt+14,'end');
  s+=canto(quad.no,pl+8,pt+14,'start');
  s+=canto(quad.se,pl+pw-6,pt+ph-8,'end');
  s+=canto(quad.so,pl+8,pt+ph-8,'start');

  pts.forEach(function(p){
    var cx=X(p.x), cy=Y(p.y), r=R(p.r);
    s+='<circle cx="'+W(cx)+'" cy="'+W(cy)+'" r="'+W(r)+'" fill="'+cor+'" fill-opacity=".18" stroke="'+cor
      +'" stroke-width="2" data-lab="'+esc(p.nome)+'"><title>'+esc(p.nome)+' · '+esc(xf(p.x))+' · '
      +esc(yf(p.y))+(p.rlab?' · '+esc(p.rlab):'')+'</title></circle>';
    /* nome no mesmo tratamento que o resto do documento da a um rotulo de NOME:
       corpo 12,5, peso normal, tinta secundaria. Negrito aqui e reservado a
       valor — era o que fazia estes nomes destoarem de todos os outros. */
    s+='<text x="'+W(cx)+'" y="'+W(cy-r-9)+'" text-anchor="middle" font-size="12.5" fill="'
      +INK2+'">'+esc(p.nome)+'</text>';
  });
  s+='<text x="'+(pl+pw/2)+'" y="'+(h-8)+'" text-anchor="middle" font-size="10.5" fill="'+MUT+'">'
    +esc(o.xlab||'')+'</text>';
  s+='<text x="16" y="'+W(pt+ph/2)+'" transform="rotate(-90 16 '+W(pt+ph/2)+')" text-anchor="middle" '
    +'font-size="10.5" fill="'+MUT+'">'+esc(o.ylab||'')+'</text>';
  s+='</svg>';
  var leg='<div class="legend"><span class="lg"><i style="background:'+cor+';opacity:.5"></i>'
    +esc(o.rlab||'tamanho do círculo = valor')+'</span>'
    +'<span class="lg"><i style="background:'+INK+';opacity:.35;height:2px;border-radius:0"></i>linhas tracejadas = média do time</span></div>';
  return leg+s;
}

/* ---------- primitiva: barra empilhada horizontal ----------
   O stackedCols do app.js é vertical e reserva o rótulo de volume embaixo de
   cada coluna. Aqui o eixo é o nome do vendedor e a leitura é de composição,
   então a barra deitada lê melhor e ainda cabe o rótulo dentro do segmento. */
function barrasEmpH(linhas,o){
  o=o||{};
  var w=o.w||980, padLeft=o.padLeft||196, rowh=o.rowh||36, topo=o.topo||10, dirW=o.dirW||104;
  var ser=o.series||[];
  var n=linhas.length, h=topo+n*rowh+14;
  var soma=function(l){ return l.valores.reduce(function(a,b){ return a+(b||0); },0); };
  var maxTot=Math.max.apply(null,linhas.map(soma).concat([1]));
  var barw=w-padLeft-dirW;
  var s='<svg viewBox="0 0 '+w+' '+h+'" class="chart" style="max-width:100%;height:auto">';
  linhas.forEach(function(l,k){
    var y=topo+k*rowh, tot=soma(l), x=padLeft;
    s+='<text x="'+(padLeft-10)+'" y="'+(y+rowh/2+4)+'" text-anchor="end" font-size="12.5" fill="'+INK2+'">'
      +esc(trunc(l.nome,28))+'<title>'+esc(l.nome)+'</title></text>';
    l.valores.forEach(function(v,i){
      if(!v) return;
      var seg=barw*v/maxTot;
      s+='<rect x="'+W(x)+'" y="'+(y+7)+'" width="'+W(seg)+'" height="'+(rowh-18)+'" fill="'+ser[i].color
        +'"><title>'+esc(l.nome)+' · '+esc(ser[i].name)+': '+nf(v)+'</title></rect>';
      /* rótulo dentro do segmento só quando cabe — número espremido não se lê */
      if(seg>=22) s+='<text x="'+W(x+seg/2)+'" y="'+(y+rowh/2+3)+'" text-anchor="middle" font-size="11" '
        +'font-weight="600" fill="#fff">'+nf(v)+'</text>';
      x+=seg;
    });
    s+='<text x="'+W(x+9)+'" y="'+(y+rowh/2+4)+'" font-size="12" font-weight="600" fill="'+INK+'">'
      +nf(tot)+(o.unidade?' '+esc(o.unidade):'')+'</text>';
  });
  s+='</svg>';
  var leg='<div class="legend">'+ser.map(function(c){
    return '<span class="lg"><i style="background:'+c.color+'"></i>'+esc(c.name)+'</span>'; }).join('')+'</div>';
  return leg+s;
}

/* ---------- pedidos por par vendedor × arquiteto ----------
   O arqAgg() guarda o valor do par (MAT), mas não quantos pedidos — e é o
   número de pedidos que diz se a relação repetiu. Passada própria, mesmo
   recorte e mesmo filtro de linha comercial do resto da seção. */
function paresCanal(ymMin,ymMax){
  var P={};
  for(var i=0;i<DATA.rows.length;i++){
    var r=DATA.rows[i];
    if(r[0]<ymMin||r[0]>ymMax||!_linhaComercial(r)) continue;
    var lista=r[16]||[]; if(!lista.length) continue;
    var vn=DATA.vd[r[3]], cota=r[1]/lista.length;
    for(var j=0;j<lista.length;j++){
      var k=vn+'\u0001'+DATA.arq[lista[j][0]];
      var o=P[k]||(P[k]={vend:vn,arq:DATA.arq[lista[j][0]],v:0,peds:{},nped:0,ult:0});
      o.v+=cota;
      if(r[15]>=0&&!o.peds[r[15]]){ o.peds[r[15]]=1; o.nped++; }
      if(r[0]>o.ult) o.ult=r[0];
    }
  }
  var dif=function(a,b){ return (Math.floor(b/100)-Math.floor(a/100))*12+(b%100)-(a%100); };
  var porVend={}, pares=[];
  Object.keys(P).forEach(function(k){
    var o=P[k], r=dif(o.ult,ymMax);
    var g=porVend[o.vend]||(porVend[o.vend]={nome:o.vend,tot:0,totV:0,
      n:[0,0,0,0], v:[0,0,0,0]});     /* 0 = 1 ped. recente · 1 = 1 ped. frio · 2 = 2 ped. · 3 = 3+ */
    var faixa = o.nped<=1 ? (r<=CANAL_RECENTE?0:1) : (o.nped===2?2:3);
    g.n[faixa]++; g.v[faixa]+=o.v; g.tot++; g.totV+=o.v;
    pares.push({vend:o.vend, arq:o.arq, v:o.v, nped:o.nped, r:r});
  });
  return {porVend:porVend, pares:pares};
}

/* ---------- bloco 1: o esforço comercial ---------- */
function blocoEsforco(A,lab){
  var vs=A.vend.filter(function(v){ return v.pedsA>0&&v.nArq>0; });
  if(vs.length<3) return '';
  var pedsT=vs.reduce(function(s,v){ return s+v.pedsA; },0);
  var arqsT=vs.reduce(function(s,v){ return s+v.nArq; },0);
  var totA=vs.reduce(function(s,v){ return s+v.vArq; },0);
  var medX=arqsT?pedsT/arqsT:0, medY=pedsT?totA/pedsT:0;

  var pts=vs.map(function(v){
    return {nome:trunc(v.name.split(' ')[0],12), x:v.pedsA/v.nArq, y:v.ticketA, r:v.vArq,
      rlab:mi(v.vArq)};
  });
  var s=H3('O esforço comercial de cada um','frequência × ticket no canal · '+lab,'aq-esforco');
  s+=fig(bolhas(pts,{w:980,h:400,medX:medX,medY:medY,
      xlab:'pedidos por arquiteto',ylab:'ticket médio do canal',
      xfmt:function(v){ return nf(v,2); }, yfmt:function(v){ return mi(v,0); },
      rlab:'tamanho do círculo = venda pelo canal',
      quad:{no:'vende caro, mas raro',ne:'caro e frequente',
            so:'atenção',se:'gira muito, ticket baixo'}}),
    ins('arqCanal',{vend:A.vend,share:A.share,totA:A.totA,totV:A.totV}));
  s+=cap('Cada bolha é um vendedor. À direita, quem faz o mesmo arquiteto voltar mais vezes; acima, quem '
    +'vende pedidos maiores. As tracejadas são as médias do time — <b>'+nf(medX,2)+' pedidos por arquiteto</b> '
    +'e <b>'+money(medY)+' de ticket</b>. Só venda com arquiteto vinculado entra na conta.');

  /* a decomposição é o que faz a bolha virar conclusão: os três fatores
     multiplicados dão exatamente a venda pelo canal */
  var ord=vs.slice().sort(function(a,b){ return b.vArq-a.vArq; });
  var linhas=ord.map(function(v){
    return ['<span class="aqesf-nome">'+esc(v.name)+'</span>', nf(v.nArq), nf(v.pedsA/v.nArq,2),
      money(v.ticketA), money(v.vArq), pct(v.share,0)];
  });
  s+=table(['Vendedor(a)','Arquitetos','× Pedidos por arquiteto','× Ticket do canal','= Venda pelo canal','% da venda dele(a)'],
    linhas,['left','right','right','right','right','right'],
    ['<b>Time</b>','<b>'+nf(arqsT)+'</b>','<b>'+nf(medX,2)+'</b>','<b>'+money(medY)+'</b>',
     '<b>'+money(totA)+'</b>','<b>'+pct(A.share,0)+'</b>']);
  s+='<div id="aq-esforco-detalhe"></div>';
  s+=cap('<b>Clique num vendedor</b> para ver os dez maiores arquitetos da carteira dele, com a frequência de cada um. '
    +'A venda pelo canal é o produto exato das três colunas: <b>quantos arquitetos</b> a pessoa tem, '
    +'<b>quantas vezes cada um volta</b> e <b>quanto vale cada pedido</b>. É onde se vê que dois vendedores '
    +'com a mesma venda podem estar fazendo trabalhos completamente diferentes. '
    +'O total do time em "arquitetos" soma as carteiras — alguns profissionais atendem mais de um vendedor '
    +'e por isso aparecem em mais de uma.');
  return s;
}

/* ---------- bloco 2: a recorrência da carteira ---------- */
function blocoRecorrencia(A,lab,ymMin,ymMax){
  var por=paresCanal(ymMin,ymMax).porVend;
  var nomes=A.vend.filter(function(v){ return v.pedsA>0; }).map(function(v){ return v.name; });
  var linhas=nomes.filter(function(nm){ return por[nm]&&por[nm].tot>=5; })
    .map(function(nm){ return por[nm]; });
  if(linhas.length<3) return '';
  linhas.sort(function(a,b){ return b.tot-a.tot; });

  var SERIES=[
    {name:'1 pedido · ainda recente',color:SER[3]},
    {name:'1 pedido · esfriou',color:BAD},
    {name:'2 pedidos',color:WARN},
    {name:'3 ou mais',color:GOOD}
  ];
  var s=H3('Quanto da carteira de arquitetos repete','arquitetos por número de pedidos · '+lab,'aq-recorrencia');
  s+=fig(barrasEmpH(linhas.map(function(g){
      return {nome:g.nome, valores:[g.n[0],g.n[1],g.n[2],g.n[3]]}; }),
    {series:SERIES,w:980,unidade:'arquitetos'}),
    ins('arqExclusividade',{arqs:A.arqs,vend:A.vend}));
  s+=cap('Um pedido só não quer dizer relação perdida: quem trouxe o primeiro pedido nos últimos '
    +CANAL_RECENTE+' meses ainda não teve tempo de repetir. Por isso a faixa é dividida — '
    +'<b>ainda recente</b> é carteira em construção, <b>esfriou</b> é relação que parou. '
    +'Metade da carteira ter um pedido só é o normal da casa; o que diferencia é o peso disso na venda.');

  var tl=linhas.map(function(g){
    var repete=g.n[2]+g.n[3], vRep=g.v[2]+g.v[3];
    return [esc(g.nome), nf(g.tot),
      nf(g.n[1])+(g.n[0]?' <span class="mut">(+'+nf(g.n[0])+' recentes)</span>':''),
      nf(repete), pct(g.totV?vRep/g.totV:0,0), money(g.totV)];
  });
  var T={tot:0,frio:0,rec:0,vFrio:0,rep:0,vRep:0,v:0};
  linhas.forEach(function(g){ T.tot+=g.tot; T.frio+=g.n[1]; T.rec+=g.n[0];
    T.vFrio+=g.v[1]; T.rep+=g.n[2]+g.n[3]; T.vRep+=g.v[2]+g.v[3]; T.v+=g.totV; });
  s+=table(['Vendedor(a)','Arquitetos','Esfriaram (1 pedido)',
      'Repetiram (2+)','% da venda deles','Venda pelo canal'],
    tl,['left','right','right','right','right','right'],
    ['<b>Time</b>','<b>'+nf(T.tot)+'</b>',
     '<b>'+nf(T.frio)+'</b> <span class="mut">(+'+nf(T.rec)+' recentes)</span>',
     '<b>'+nf(T.rep)+'</b>','<b>'+pct(T.v?T.vRep/T.v:0,0)+'</b>','<b>'+money(T.v)+'</b>']);
  return s;
}

/* ---------- injeção ----------
   Entram logo depois da régua da RFV de arquitetos, antes do bloco de
   performance. Reconstruídos junto com a seção, então seguem o filtro. */
function injetaCanal(){
  if(!CANAL_ATIVO) return;
  var body=document.getElementById('aq-body'); if(!body) return;
  if(body.querySelector('[data-blk="aq-esforco"]')) return;      /* já está nesta renderização */
  var ancora=body.querySelector('h3[data-blk="aq-perf"]');
  if(!body.querySelector('h3[data-blk="aq-rfv"]')) return;       /* seção ainda sem RFV */

  var fim=MAXYM_VENDAS, ini=ymAddMonths(fim,-(arqMeses-1));
  var A=arqAgg(ini,fim); if(!A.vend.length) return;
  var lab='janela de '+arqMeses+' meses até '+ymLab(fim);

  var html=blocoEsforco(A,lab)+blocoRecorrencia(A,lab,ini,fim);
  if(!html) return;
  /* bloco redesenhado (troca de janela): a selecao antiga aponta para uma
     gaveta que nao existe mais, e o proximo clique no mesmo nome so fecharia */
  esfSel=null;
  var caixa=document.createElement('div');
  caixa.innerHTML=html;
  var nos=Array.prototype.slice.call(caixa.childNodes);
  nos.forEach(function(el){ body.insertBefore(el,ancora||null); });
  if(window.INSRT) try{ INSRT.mount(body.closest('section')||body); }catch(e){}
}

/* =========================================================================
   10) Totalizador nas tabelas de segmento do RFV
   =========================================================================
   As duas tabelas que abrem ao clicar num segmento (clientes e arquitetos)
   listavam dezenas de linhas sem fechar conta nenhuma. O rodapé soma o que é
   somável, tira média do que é tempo e pondera pelo valor o que é taxa —
   somar "meses sem comprar" daria um número sem significado. */
function rodapeRfv(det,lista,tipo){
  if(!det||!lista||!lista.length) return;
  var tab=det.querySelector('table.dt'); if(!tab||tab.tFoot) return;
  var n=lista.length;
  var sv=0,sf=0,sr=0,svida=0,srt=0,ex=0,donos={};
  lista.forEach(function(x){
    sv+=x.v||0; sf+=x.f||0; sr+=x.r||0; svida+=x.vida||0; srt+=x.rt||0;
    if(x.exclusivo) ex++;
    if(x.dono) donos[x.dono]=1;
  });
  var nd=Object.keys(donos).length;
  var med=function(v){ return '<span class="mut">méd. </span>'+nf(v/n,1); };
  var cels = tipo==='arq'
    ? ['<b>Total · '+nf(n)+' arquitetos</b>','<b>'+money(sv)+'</b>','<b>'+nf(sf)+'</b>',
       med(sr), '<b>'+pct(sv?srt/sv:0,1)+'</b>',
       '<span class="mut">'+nf(nd)+' vendedores</span>',
       '<span class="mut">'+nf(ex)+' de '+nf(n)+'</span>','<b>100,0%</b>']
    : ['<b>Total · '+nf(n)+' clientes</b>','<b>'+money(sv)+'</b>','<b>'+nf(sf)+'</b>',
       med(sr), med(svida)+' <span class="mut">meses</span>',
       '<span class="mut">'+nf(nd)+' vendedores</span>','<b>100,0%</b>'];
  var alin=[].slice.call(tab.querySelectorAll('thead th')).map(function(th){ return th.className||'right'; });
  var tf=document.createElement('tfoot');
  tf.innerHTML='<tr>'+cels.map(function(c,i){
    return '<td class="'+(alin[i]||'right')+'">'+c+'</td>'; }).join('')+'</tr>';
  tab.appendChild(tf);
}

if(typeof drawRFVSegmento==='function'){
  var origSegCli=window.drawRFVSegmento;
  window.drawRFVSegmento=function(seg){
    origSegCli(seg);
    try{
      var l=(avRFV&&avRFV.cli||[]).filter(function(x){ return x.seg===seg; });
      rodapeRfv(document.getElementById('rfv-detalhe'),l,'cli');
    }catch(e){}
  };
}
if(typeof drawAqRfvSeg==='function'){
  var origSegArq=window.drawAqRfvSeg;
  window.drawAqRfvSeg=function(seg){
    origSegArq(seg);
    try{
      var l=(aqRFV&&aqRFV.itens||[]).filter(function(x){ return x.seg===seg; });
      rodapeRfv(document.getElementById('aqrfv-detalhe'),l,'arq');
    }catch(e){}
  };
}


/* =========================================================================
   11) Tipografia uniforme e rótulos de ponta nos gráficos
   =========================================================================
   Dois acabamentos que valem para o deck inteiro.

   a) TAMANHO DE FONTE. Cada primitiva do app.js desenha num viewBox de largura
      própria — há treze larguras diferentes, de 200 a 980 — e o SVG é esticado
      para a coluna. O resultado é que um hbar (desenhado a 780) aparece com o
      texto 26% maior que um line (desenhado a 980) logo abaixo dele, embora os
      dois declarem font-size parecido. A correção mede a escala real de cada
      gráfico e ajusta os font-size para que UMA UNIDADE DO VIEWBOX VALHA UM
      PIXEL em todos eles. Não mexe no layout: o gráfico continua ocupando a
      coluna inteira, só o texto passa a ter o mesmo corpo em todo o relatório.

   b) RÓTULOS. 36 gráficos já mostram o valor; 25 não — e 17 desses são linhas.
      Rotular os doze pontos de uma linha vira poluição, então entram só as
      pontas e o extremo: primeiro, último e o pico (ou o vale, quando a série
      é negativa). O valor sai do <title> que o próprio line() já escreve em
      cada ponto, então o formato é exatamente o do gráfico — sem recalcular
      nada e sem precisar saber de que série se trata.
   ========================================================================= */

/* ---------- b) rótulos de ponta nas linhas ---------- */
function rotulaLinhas(sv){
  if(sv.getAttribute('data-rot')==='1') return;
  sv.setAttribute('data-rot','1');
  /* só linhas: a dispersão não tem polyline, e quem já rotula tem texto em
     negrito (o hbar, o pareto, as empilhadas) */
  if(!sv.querySelector('polyline')) return;
  var jaTem=Array.prototype.slice.call(sv.querySelectorAll('text'))
    .some(function(t){ return +t.getAttribute('font-weight')>=600; });
  if(jaTem) return;

  /* os pontos de cada série compartilham a cor; é o que permite separá-las */
  var series={};
  Array.prototype.slice.call(sv.querySelectorAll('circle')).forEach(function(c){
    var t=c.querySelector('title'); if(!t) return;
    var cor=c.getAttribute('fill')||'';
    (series[cor]||(series[cor]=[])).push(c);
  });

  Object.keys(series).forEach(function(cor){
    var pts=series[cor];
    if(pts.length<4) return;                       /* série curta já se lê inteira */
    var cy=function(c){ return +c.getAttribute('cy'); };
    var iAlto=0, iBaixo=0;
    pts.forEach(function(c,i){ if(cy(c)<cy(pts[iAlto])) iAlto=i; if(cy(c)>cy(pts[iBaixo])) iBaixo=i; });
    /* o extremo que interessa é o mais distante das pontas: num gráfico que sobe,
       o pico; num que desce, o vale */
    var extremo = (cy(pts[0])+cy(pts[pts.length-1]))/2 > (cy(pts[iAlto])+cy(pts[iBaixo]))/2
      ? iAlto : iBaixo;
    var quais={}; quais[0]=1; quais[pts.length-1]=1; quais[extremo]=1;
    Object.keys(quais).forEach(function(k){
      var i=+k, c=pts[i];
      var titulo=c.querySelector('title').textContent;
      var valor=titulo.slice(titulo.lastIndexOf(': ')+2).trim();
      if(!valor) return;
      var x=+c.getAttribute('cx'), y=cy(c);
      /* o rotulo desvia da propria linha: numa ponta que sobe, o espaco livre
         esta embaixo; num pico, em cima. Sem isso o texto cruza a curva. */
      var acima;
      if(i===0)                 acima = cy(pts[1])>=y;
      else if(i===pts.length-1) acima = cy(pts[pts.length-2])>=y;
      else                      acima = (i===iAlto);
      var t=document.createElementNS('http://www.w3.org/2000/svg','text');
      t.setAttribute('x',x.toFixed(2));
      t.setAttribute('y',(acima?y-9:y+15).toFixed(2));
      t.setAttribute('text-anchor', i===0?'start':(i===pts.length-1?'end':'middle'));
      t.setAttribute('font-size','10.5');
      t.setAttribute('font-weight','600');
      t.setAttribute('fill',cor);
      t.setAttribute('data-rotulo','1');
      t.textContent=valor;
      sv.appendChild(t);
    });
  });
}

/* ---------- a) uma unidade do viewBox = um pixel ---------- */
var _larguraJanela=0;
function normalizaFontes(reavaliar){
  var mudou = reavaliar || Math.abs(window.innerWidth-_larguraJanela)>1;
  _larguraJanela=window.innerWidth;
  document.querySelectorAll('svg.chart').forEach(function(sv){
    if(!mudou && sv.getAttribute('data-fs')==='1') return;
    var vb=(sv.getAttribute('viewBox')||'').split(/\s+/);
    var w=+vb[2]; if(!w) return;
    var r=sv.getBoundingClientRect();
    /* Medida implausível não vira ajuste. Um gráfico fora de tela, dentro de um
       container ainda sem layout ou escondido devolve largura zero (ou alguns
       pixels) — escalar por isso multiplicaria a fonte por dez. Nesses casos a
       marca não é gravada e o gráfico volta a ser avaliado na próxima passada. */
    if(!r.width || r.width<180) return;
    var escala=r.width/w;
    if(escala<0.5 || escala>2.2) return;
    sv.setAttribute('data-fs','1');
    Array.prototype.slice.call(sv.querySelectorAll('text')).forEach(function(t){
      /* o tamanho de projeto fica guardado: sem isso, uma segunda passada
         escalaria o valor já escalado e o texto encolheria sem parar */
      var f0=t.getAttribute('data-fs0');
      if(f0===null){
        f0=t.getAttribute('font-size'); if(!f0) return;
        t.setAttribute('data-fs0',f0);
      }
      /* So ENCOLHE. O desenho de cada primitiva foi feito supondo 1 unidade = 1
         pixel: as margens do eixo, o recuo do rotulo e o truncamento do nome sao
         dimensionados para o corpo de projeto. Reduzir sobra espaco; aumentar
         estoura — o "R$ 939 mil" do eixo perde o "R$" e fica cortado. Quando o
         grafico e desenhado mais estreito do que a coluna (escala < 1) o texto
         fica no tamanho original, que ja e o certo. */
      var f=+f0/escala; if(f>+f0) f=+f0;
      t.setAttribute('font-size',f.toFixed(2));
    });
  });
}

function acabamentoGraficos(){
  document.querySelectorAll('svg.chart').forEach(rotulaLinhas);
  normalizaFontes(false);
}

/* o layout definitivo pode chegar depois do primeiro desenho (fonte web, barra
   de rolagem que aparece, imagem que empurra a coluna): mais duas tentativas */
if(typeof window!=='undefined'){
  window.addEventListener('load',function(){ setTimeout(function(){ normalizaFontes(true); },60); });
  setTimeout(function(){ normalizaFontes(true); },1200);
}

/* a coluna muda de largura quando a janela muda: a escala tem de ser refeita */
var _tRedim=null;
if(typeof window!=='undefined') window.addEventListener('resize',function(){
  clearTimeout(_tRedim);
  _tRedim=setTimeout(function(){ normalizaFontes(true); },180);
});


/* ---------- a carteira de canal de um vendedor, aberta pela tabela ----------
   A tabela do esforço mostra a média (pedidos por arquiteto); a média esconde se
   ela vem de muitos arquitetos voltando pouco ou de poucos voltando muito. Aqui
   a linha se abre nos dez maiores da carteira daquele vendedor, com a frequência
   de cada um — que é a leitura que a média resume.

   Recalcula no clique em vez de guardar: a janela pode ter mudado desde o
   desenho, e a passada sobre a base é barata. */
var esfSel=null;

function marcaEsf(){
  document.querySelectorAll('tr').forEach(function(tr){
    var n=tr.querySelector('.aqesf-nome'); if(!n) return;
    var on=(n.textContent.trim()===esfSel);
    tr.style.background=on?'rgba(146,112,93,.12)':'';
  });
}

function drawEsforcoDetalhe(vn){
  var det=document.getElementById('aq-esforco-detalhe'); if(!det) return;
  if(esfSel===vn){ esfSel=null; det.innerHTML=''; marcaEsf(); return; }
  esfSel=vn; marcaEsf();

  var fim=MAXYM_VENDAS, ini=ymAddMonths(fim,-(arqMeses-1));
  var P=paresCanal(ini,fim).pares.filter(function(x){ return x.vend===vn; });
  if(!P.length){ det.innerHTML=''; return; }
  P.sort(function(a,b){ return b.v-a.v; });

  var tot=P.reduce(function(s,x){ return s+x.v; },0);
  var peds=P.reduce(function(s,x){ return s+x.nped; },0);
  var top=P.slice(0,10), acc=0;
  var vTop=top.reduce(function(s,x){ return s+x.v; },0);
  var pTop=top.reduce(function(s,x){ return s+x.nped; },0);

  var linhas=top.map(function(x){
    acc+=x.v;
    return [esc(trunc(x.arq,40)),
      '<b>'+nf(x.nped)+'</b>',
      money(x.v),
      money(x.nped?x.v/x.nped:0),
      x.r===0?'<span class="mut">no mês</span>':nf(x.r),
      pct(tot?acc/tot:0,1)];
  });

  det.innerHTML = H3('Carteira de canal de '+esc(vn),
      nf(P.length)+' arquitetos · '+mi(tot)+' · '+nf(peds)+' pedidos')
    + table(['Arquiteto / escritório','Pedidos','Venda atribuída','Ticket médio',
             'Meses sem trazer','% acumulada'],
        linhas, ['left','right','right','right','right','right'],
        ['<b>Os 10 maiores</b>','<b>'+nf(pTop)+'</b> <span class="mut">de '+nf(peds)+'</span>',
         '<b>'+money(vTop)+'</b>','<b>'+money(pTop?vTop/pTop:0)+'</b>',
         '<span class="mut">—</span>','<b>'+pct(tot?vTop/tot:0,1)+'</b>'])
    + cap('“Pedidos” é a frequência: quantas vezes aquele arquiteto trouxe negócio na janela. '
        + 'É o número que a coluna “pedidos por arquiteto” da tabela acima resume numa média. '
        + 'Clique no mesmo vendedor para fechar.');
  det.scrollIntoView({behavior:'smooth',block:'nearest'});
}

/* delegado no documento: a tabela e reescrita a cada troca de janela, e um
   listener presos as linhas morreria junto com elas */
if(typeof document!=='undefined') document.addEventListener('click',function(ev){
  if(!ev.target||!ev.target.closest) return;
  var cel=ev.target.closest('td'); if(!cel) return;
  var nome=cel.querySelector?cel.querySelector('.aqesf-nome'):null;
  if(!nome){ var tr=ev.target.closest('tr'); nome=tr?tr.querySelector('.aqesf-nome'):null;
    if(!nome||!tr.contains(cel)) return; }
  try{ drawEsforcoDetalhe(nome.textContent.trim()); }catch(e){ console.warn('carteira de canal:',e); }
});

})();
