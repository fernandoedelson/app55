/* ===== +55 Design · Roteiro em Atos =====================================
   Camada de REORGANIZACAO. Nao calcula nada: o app.js continua dono de todo o
   calculo, de todo o grafico e de toda a interacao. Este arquivo so muda ONDE as
   coisas ficam — reordena o documento na sequencia da reuniao (seis atos) e joga
   o que sobra para os anexos, agrupado por tema.

   Como funciona
   -------------
   O app.js carimba cada elemento com data-blk-of (ver marcarBlocos()): um "bloco"
   e a corrida de elementos que vive sob um mesmo <h3>. Aqui os blocos sao MOVIDOS
   (nunca clonados) para dentro dos atos — mover preserva os listeners, entao
   drill-down, ordenacao de tabela, zoom e destaques continuam funcionando.

   Os filtros reescrevem o corpo das secoes por innerHTML e recriam os blocos la na
   origem. Um MutationObserver puxa os recem-criados de volta para o ato, do mesmo
   jeito que o setupBlocos() do app.js remarca os atributos. Move-se so o que
   reapareceu na origem; o que ja esta no ato e deixado em paz, e o ciclo fecha.

   NADA aqui e carregado pelo relatorio original — este arquivo so entra no
   Analise_Vendas_e_DRE_55Design_Atos.html, montado pelo gerar_html_atos.py.
   ====================================================================== */
'use strict';
(function(){

/* ---------- o roteiro ----------
   sec    : id da secao de origem
   blk    : id do bloco (data-blk) a trazer
   abre   : traz a abertura da secao (tudo que vem antes do primeiro <h3> com bloco)
   semHead: descarta o .sec-head — o ato ja tem o proprio titulo
   filtro : traz a primeira .filterbar da secao (o controle vem junto com o grafico)
   tudo   : traz a secao inteira (usado quando o ato E a secao)
   sub    : nao e conteudo, e um subtitulo dentro do ato                          */
var ATOS=[
{n:1,t:'De onde viemos',q:'A empresa está crescendo, e para onde vai se nada mudar?',min:'5 min',
 itens:[
  {sec:'evolutiva',abre:true,semHead:true},
  {sec:'evolutiva',blk:'ev-anual'},
  {sec:'performance',blk:'perf-acum'},
  {sec:'performance',blk:'perf-mes'}]},

{n:2,t:'O que já está vendido',q:'Quanto do faturamento dos próximos meses já está contratado?',min:'7 min',
 itens:[
  {sec:'periodo',blk:'pe-cart'},
  {sec:'carteira_dinamica',blk:'cd-status'},
  {sec:'carteira_dinamica',blk:'cd-evol'},
  {sec:'carteira_dinamica',blk:'cd-previsao'},
  {sec:'carteira_dinamica',blk:'cd-adiados'}]},

{n:3,t:'O mês',q:'Quanto se vendeu, e de quê?',min:'4 min',
 itens:[
  {sec:'mensal',filtro:true},
  {sec:'mensal',blk:'mn-evol'},
  {sec:'mensal',blk:'mn-cat'},
  {sec:'ytd',blk:'ytd-kpi'},
  {sec:'ytd',blk:'ytd-linha'},
  {sec:'ytd',blk:'ytd-ind'}]},

{n:4,t:'Por que vendemos o que vendemos',q:'O que separa um vendedor do outro, e o que sustenta os dois?',min:'14 min',
 itens:[
  {sub:'Primeiro, o time'},
  {sec:'ytd',blk:'ytd-vendedor'},
  {sec:'vendas',filtro:true},
  {sec:'vendas',blk:'av-lider'},
  {sec:'vendas',blk:'av-diferenca'},
  {sub:'Depois, o canal, que explica a diferença',nota:'CANAL_SHARE'},
  {sec:'arquitetos',filtro:true},
  {sec:'arquitetos',blk:'aq-dependencia'},
  {sec:'arquitetos',blk:'aq-quantos'},
  {sec:'arquitetos',blk:'aq-rfv'},
  {sec:'arquitetos',blk:'aq-esforco'},
  {sec:'arquitetos',blk:'aq-recorrencia'},
  {sec:'arquitetos',blk:'aq-parados'},
  {sec:'arquitetos',blk:'aq-perf'},
  {sub:'Por fim, a ponta e o que está em jogo'},
  {sec:'mensal',blk:'mn-cli'},
  {sec:'vendas',blk:'av-rfv'},
  {sec:'vendas',blk:'av-parados'},
  {sec:'vendas',blk:'av-jogo'}]},

{n:5,t:'O resultado',q:'Quanto sobrou, e o que consumiu a diferença?',min:'12 min',
 itens:[
  {sec:'dre',filtro:true},
  {sec:'dre',blk:'dre-ponte'},
  {sec:'dre',blk:'dre-evol'},
  {sec:'dre',blk:'dre-breakeven'},
  {sec:'dre',blk:'dre-minidre'},
  {sec:'custofixo',filtro:true},
  {sec:'custofixo',blk:'cf-cat'},
  {sec:'custofixo_mensal',filtro:true},
  {sec:'custofixo_mensal',blk:'cfm-pacotes'},
  {sec:'custosx',filtro:true},
  {sec:'custosx',abre:true,semHead:true,semFiltro:true},
  {sec:'custosx',blk:'cx-mensal'},
  /* o comparativo por grupo vem com a própria barra de período A × B, que o
     app.js escreve dentro de #custosx-body, logo antes do quadro */
  {sec:'custosx',filtroSel:'#custosx-body > .filterbar'},
  {sec:'custosx',blk:'cx-grp'},
  {sec:'custosx',blk:'cx-evitavel'},
  {sec:'custosx',blk:'cx-retrabalho'},
  {sec:'custosx',blk:'cx-retrabalho-pareto'},
  {sec:'custosx',blk:'cx-assistencia'},
  {sec:'custosx',blk:'cx-assistencia-prod'}]},

/* Ato de passagem: so o enunciado. O estudo Fabrica x Loja sai da leitura
   corrida porque sera apresentado em outro lugar — a secao inteira desce
   para o Anexo III, que ja a lista, e continua completa e interativa la. */
{n:6,t:'O que vem a seguir',q:'Como o resultado se reparte quando a leitura muda de empresa para função?',min:'4 min',
 itens:[]}
];

/* ---------- o que nao entrou no roteiro: anexos, por tema ---------- */
var GRUPOS=[
 {id:'anexo1',k:'Anexo I',t:'Vendas, carteira e canal',
  d:'O detalhamento comercial que sustenta os atos 1 a 4: a exploração por período, o retrato completo '
   +'do time e do canal, a carteira aberta por vendedor e por pedido.',
  secs:['resumo','evolutiva','ytd','mensal','periodo','performance','vendas','arquitetos','carteira','carteira_dinamica']},
 {id:'anexo2',k:'Anexo II',t:'Resultado, custo e dívida',
  d:'A demonstração de resultado inteira, o custo fixo aberto por pacote e por terceiro, o custo de '
   +'produção da fábrica linha a linha e o histórico da dívida com o acionista.',
  secs:['dre','custofixo','custofixo_mensal','divida','custosx','custos']},
 {id:'anexo3',k:'Anexo III',t:'Estudos e modelos',
  d:'Modelos gerenciais e estudos que não fazem parte do fechamento recorrente.',
  secs:['estudos']}
];

/* ---------- utilidades locais (os helpers do app.js sao const: nao estao em window) ---------- */
function esc(s){ return s==null?'':String(s).replace(/[&<>"]/g,function(c){
  return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]; }); }
function $(id){ return document.getElementById(id); }
function filhos(el){ return el?Array.prototype.slice.call(el.children):[]; }

/* lista achatada dos itens que carregam conteudo, na ordem do roteiro */
var ITENS=[];
ATOS.forEach(function(A){ A.itens.forEach(function(it){ if(!it.sub){ it._ato=A; ITENS.push(it); } }); });

/* ---------- 1) esqueleto: as secoes de ato e as faixas de anexo ---------- */
function montarEsqueleto(){
  var main=$('main'); if(!main) return false;
  /* Marcador no fim do main: tudo (atos, faixas e as proprias secoes originais) e
     inserido ANTES dele. Usar a primeira secao como referencia nao serve — mover
     essa secao para o anexo seria inseri-la antes de si mesma, um no-op que a
     deixaria por ultimo no documento. */
  var primeira=document.createComment('atos');
  main.appendChild(primeira);

  ATOS.forEach(function(A){
    var sec=document.createElement('section');
    sec.id='ato'+A.n; sec.className='ato';
    var head=document.createElement('div');
    head.className='ato-head';
    head.setAttribute('data-n',('0'+A.n).slice(-2));
    head.innerHTML='<div class="ato-n">Ato '+A.n+'</div>'
      +'<h2>'+esc(A.t)+'</h2>'
      +'<p class="ato-q">'+esc(A.q)+'</p>'
      +'<span class="ato-min">'+esc(A.min)+'</span>';
    sec.appendChild(head);
    /* Ato declarado sem nenhum item que carregue conteudo: e um ato de
       passagem, so o enunciado. A classe existe para o CSS nao desenhar a
       regua do cabecalho colada na borda da secao. */
    if(!A.itens.some(function(it){ return !it.sub; })) sec.classList.add('so-enunciado');
    A.itens.forEach(function(it){
      if(it.sub){
        var d=document.createElement('div'); d.className='ato-sub';
        var b=document.createElement('b'); b.textContent=it.sub; d.appendChild(b);
        if(it.nota){ var sp=document.createElement('span'); sp.setAttribute('data-nota',it.nota); d.appendChild(sp); }
        sec.appendChild(d); return;
      }
      var sl=document.createElement('div'); sl.className='ato-slot';
      sl.setAttribute('data-origem', it.sec+':'+(it.blk||(it.filtro?'filtro'
        :(it.filtroSel?'filtro-ab':(it.abre?'abertura':'tudo')))));
      sec.appendChild(sl); it._slot=sl;
    });
    main.insertBefore(sec,primeira);
  });

  /* faixa que abre o segundo tempo do documento */
  var abre=document.createElement('div'); abre.className='anexo-abre';
  abre.innerHTML='<div class="aa-in"><div class="aa-k">Segundo tempo</div>'
    +'<h2>Anexos</h2><p>Tudo o que não entra na leitura corrida da reunião continua aqui, inteiro e '
    +'interativo — agrupado por tema, na mesma profundidade de sempre. É para onde se vai quando a '
    +'pergunta da sala pede o número por dentro.</p></div>';
  main.insertBefore(abre,primeira);

  /* cada grupo recebe um cabecalho e, logo depois, as secoes originais na ordem do grupo */
  GRUPOS.forEach(function(G){
    var h=document.createElement('div'); h.className='anexo-head'; h.id=G.id;
    h.innerHTML='<div class="ah-k">'+esc(G.k)+'</div><h2>'+esc(G.t)+'</h2><p>'+esc(G.d)+'</p>';
    main.insertBefore(h,primeira);
    G.secs.forEach(function(id){ var s=$(id); if(s) main.insertBefore(s,primeira); });
  });

  /* a citacao de marca fica entre o 3o e o 4o ato — o respiro antes do ato longo */
  var q=document.querySelector('.quoteband');
  if(q){ var a4=$('ato4'); if(a4) main.insertBefore(q,a4); }
  return true;
}

/* ---------- 2) de onde sai cada pedaco ---------- */
/* o .digest e o resumo que o insights.js escreve no topo da secao; ele e refeito a
   cada mount e nao pertence a bloco nenhum — fica onde esta */
function movivel(el,it){
  return !el.classList.contains('chap') && !el.classList.contains('digest')
      && !el.classList.contains('fb-moved')   /* o aviso que este arquivo deixou na origem */
      && !(it.semHead && el.classList.contains('sec-head'));
}
function fontes(it){
  var sec=$(it.sec); if(!sec) return [];
  if(it.tudo) return filhos(sec).filter(function(el){ return movivel(el,it); });
  if(it.filtro){ var f=sec.querySelector(':scope > .filterbar'); return f?[f]:[]; }
  /* barra de filtro que nao e filha direta da secao (a do comparativo A x B vive
     dentro de #custosx-body). Ao contrario da barra da secao, esta e recriada a
     cada redesenho, entao continua sendo procurada em toda passada. */
  if(it.filtroSel){ var fs=sec.querySelector(it.filtroSel); return fs?[fs]:[]; }
  if(it.abre){
    var lista=Array.prototype.slice.call(sec.querySelectorAll('[data-blk-of="__abre"]'))
      .filter(function(el){ return movivel(el,it); });
    /* "__abre" e posicional: e tudo que vem antes do primeiro <h3> com bloco. Depois
       que a abertura sobe para o ato, quem ficou em primeiro lugar na origem herda a
       marca — em custosx isso e a barra do comparativo A x B, que pertence ao quadro
       "CPV por grupo" (esse fica no anexo). Excluir a barra fecha o ciclo: na passada
       seguinte a lista sai vazia e nada mais e movido. */
    if(it.semFiltro) lista=lista.filter(function(el){ return !el.classList.contains('filterbar'); });
    return lista;
  }
  return Array.prototype.slice.call(sec.querySelectorAll('[data-blk-of="'+it.blk+'"]'))
    .filter(function(el){ return !el.classList.contains('digest'); });
}

/* ---------- 3) a mudanca de lugar ----------
   Idempotente de proposito: so age quando o pedaco reapareceu na secao de origem
   (foi redesenhado por um filtro). Achou na origem, limpa o slot e traz o novo. */
function relocar(){
  if(typeof marcarBlocos==='function') marcarBlocos();
  /* os cortes de conteudo (atos_ajustes.js) vem antes: nao adianta mover para o
     ato um bloco que sai do roteiro, e a marcacao ja esta feita */
  if(typeof window.ATOS_AJUSTES_DOM==='function') window.ATOS_AJUSTES_DOM();
  ITENS.forEach(function(it){
    var sl=it._slot; if(!sl || it._pronto) return;
    var src=fontes(it);
    if(!src.length) return;                       /* ja esta no ato — nada a fazer */
    while(sl.firstChild) sl.removeChild(sl.firstChild);
    src.forEach(function(el){ sl.appendChild(el); });
    /* Barra de filtro e secao inteira sao movidas UMA vez. Sem isso, uma secao com
       duas barras (o DRE tem a do periodo e a do comparativo mensal) veria a segunda
       como "a primeira" na passada seguinte e trocaria o controle no ato. Os blocos,
       ao contrario, precisam ser repuxados: o filtro os recria na origem. */
    if(it.filtro||it.tudo) it._pronto=true;
    if(it.filtro) avisarFiltro(it);
  });
}

/* a secao de origem perdeu o controle para o ato — deixa o caminho de volta */
function avisarFiltro(it){
  var sec=$(it.sec); if(!sec || sec.querySelector(':scope > .fb-moved')) return;
  var A=it._ato;
  var d=document.createElement('div'); d.className='fb-moved';
  d.innerHTML='Os filtros desta seção vivem no <a href="#ato'+A.n+'">Ato '+A.n+' &middot; '+esc(A.t)
    +'</a> — o controle é único e vale para os dois lugares.';
  var alvo=sec.querySelector(':scope > .sec-head');
  if(alvo && alvo.parentNode) alvo.parentNode.insertBefore(d,alvo.nextSibling);
  else sec.insertBefore(d,sec.firstChild);
}

/* ---------- 4) faxina: secao de anexo que ficou sem conteudo some ---------- */
function esconderVazias(){
  document.querySelectorAll('main > section:not(.ato)').forEach(function(s){
    var util=filhos(s).some(function(el){
      return !el.classList.contains('chap') && !el.classList.contains('sec-head')
          && !el.classList.contains('digest') && !el.classList.contains('fb-moved')
          && (el.textContent||'').trim()!==''; });
    s.classList.toggle('vazio',!util);
    var a=document.querySelector('#nav a[data-t="'+s.id+'"]');
    if(a) a.classList.toggle('vazio',!util);
  });
  document.querySelectorAll('section.ato').forEach(function(s){
    var slots=Array.prototype.slice.call(s.querySelectorAll('.ato-slot'));
    /* Ato SEM NENHUM slot foi escrito assim de proposito — e o ato de
       passagem, e tem de aparecer. Ato COM slots que nao encheram e falha
       de relocacao, e ai sim some. A distincao importa porque o menu monta
       um link para todo ato: sem ela, o ato de passagem viraria um item de
       menu apontando para uma secao escondida. */
    var cheio = slots.length===0
      || slots.some(function(sl){ return sl.children.length>0; });
    s.classList.toggle('vazio',!cheio);
  });
}

/* ---------- 5) o numero do subtitulo do ato 4 sai do proprio relatorio ---------- */
function preencherNotas(){
  document.querySelectorAll('.ato-sub span[data-nota="CANAL_SHARE"]').forEach(function(sp){
    if(sp.textContent) return;
    var share='';
    document.querySelectorAll('.kpi').forEach(function(k){
      var l=k.querySelector('.kpi-l'), s=k.querySelector('.kpi-s');
      if(!l||!s) return;
      if(l.textContent.trim().toLowerCase()!=='venda com arquiteto') return;
      var m=s.textContent.match(/([\d.,]+\s*%)/);
      if(m) share=m[1].replace(/\s+/g,'');
    });
    sp.textContent=share?(share+' da venda passa por aqui'):'o canal que explica a diferença';
  });
}

/* ---------- 6) menu: os atos no topo, os anexos agrupados embaixo ---------- */
function montarMenu(){
  var nav=$('nav'); if(!nav) return;
  var antigos={};
  Array.prototype.slice.call(nav.querySelectorAll('a')).forEach(function(a){
    if(a.getAttribute('data-t')) antigos[a.getAttribute('data-t')]=a; });

  ATOS.forEach(function(A){
    var a=document.createElement('a');
    a.href='#ato'+A.n; a.setAttribute('data-t','ato'+A.n); a.className='nav-ato';
    a.innerHTML='<span class="na-n">'+A.n+'</span>'+esc(A.t);
    nav.appendChild(a);
  });
  GRUPOS.forEach(function(G){
    var h=document.createElement('div'); h.className='nav-grp'; h.textContent=G.k;
    nav.appendChild(h);
    G.secs.forEach(function(id){ var a=antigos[id]; if(!a) return;
      a.classList.add('nav-anexo'); nav.appendChild(a); });
  });
  nav.querySelectorAll('a').forEach(function(a){ a.addEventListener('click',function(){
    var side=$('side'); if(side) side.classList.remove('open'); }); });
}

/* ---------- barra de filtro que acompanha a leitura ----------
   O controle fica no alto do ato e os graficos que ele comanda seguem por
   centenas de pixels abaixo: mexer no periodo e nao ver o grafico responder
   tira metade da utilidade do filtro. A barra passa a grudar no topo enquanto
   a leitura estiver dentro do ato.

   Uma por vez, e nao todas: o Ato 5 tem cinco barras (DRE, custo fixo, custo
   fixo mensal, CPV e o comparativo A x B). Empilhadas no topo elas se cobririam
   e sobrariam bordas aparecendo por baixo. Fica fixa apenas a ultima que a
   leitura ja passou — que e justamente a que comanda o que esta na tela.

   A posicao natural e lida por offsetTop, e nao por getBoundingClientRect: uma
   barra ja grudada devolve topo zero para sempre e nunca se soltaria. */
/* posicao absoluta somando a cadeia de offsetParent: as <section> tem
   position:relative (a marca d'agua as posiciona), entao o offsetTop de um slot
   e relativo a secao, nao ao documento. E offsetTop, e nao getBoundingClientRect,
   porque sticky desloca a pintura mas nao o layout — a medida continua estavel
   depois que a barra gruda. */
function topoAbs(el){ var y=0; while(el){ y+=el.offsetTop; el=el.offsetParent; } return y; }

function fixarFiltros(){
  var y=scrollY;
  document.querySelectorAll('section.ato').forEach(function(sec){
    var barras=filhos(sec).filter(function(el){
      return el.classList.contains('ato-slot')
          && el.children.length===1
          && el.children[0].classList
          && el.children[0].classList.contains('filterbar'); });
    if(!barras.length) return;
    var topo=topoAbs(sec);
    var dentro = y>=topo && y<topo+sec.offsetHeight-160;
    var ativa=null;
    if(dentro) barras.forEach(function(b){ if(topoAbs(b)<=y+1) ativa=b; });
    barras.forEach(function(b){ b.classList.toggle('fb-fixa', b===ativa); });
  });
}

/* scrollspy proprio: o do app.js so conhece as secoes originais */
function spyAtos(){
  var links=Array.prototype.slice.call(document.querySelectorAll('#nav a[data-t]'));
  function spy(){
    var y=scrollY+130, atual=null;
    links.forEach(function(a){
      var el=$(a.getAttribute('data-t'));
      if(el && !el.classList.contains('vazio') && !el.classList.contains('admin-hidden')
         && el.offsetTop<=y) atual=a;
    });
    links.forEach(function(a){ a.classList.toggle('active',a===atual); });
  }
  addEventListener('scroll',function(){ spy(); fixarFiltros(); },{passive:true});
  spy(); fixarFiltros();
}

/* ---------- 7) modo apresentacao: uma parada por peca ---------- */
function ligarParadas(){
  window.paradasAtivas=function(){
    var out=[];
    ATOS.forEach(function(A){
      var s=$('ato'+A.n); if(!s||s.classList.contains('vazio')) return;
      var rot='Ato '+A.n+' · '+A.t;
      out.push({el:s,sec:'ato'+A.n,ato:rot});
      filhos(s).forEach(function(el){
        if(el.classList.contains('ato-head')) return;
        if(el.classList.contains('ato-slot')){
          if(!el.children.length) return;
          /* barra de filtro e controle, nao slide: parar nela numa apresentacao
             mostraria uma tira de botoes e nenhum numero */
          if(el.children.length===1 && el.children[0].classList
             && el.children[0].classList.contains('filterbar')) return;
        }
        if(el.classList.contains('ato-sub') || el.classList.contains('ato-slot'))
          out.push({el:el,sec:'ato'+A.n,ato:rot});
      });
    });
    document.querySelectorAll('main > section:not(.ato)').forEach(function(s){
      if(s.classList.contains('vazio')||s.classList.contains('admin-hidden')) return;
      var g=GRUPOS.filter(function(G){ return G.secs.indexOf(s.id)>=0; })[0];
      out.push({el:s,sec:s.id,ato:g?(g.k+' · '+g.t):'Anexos'});
    });
    return out;
  };
}

/* ---------- 8) remendo de escopo ----------
   Algumas funcoes do app.js pintam a linha selecionada varrendo o corpo da secao
   (#av-body, #aq-body, #mensal-body). Com o bloco morando no ato, a varredura nao
   acha nada e a marcacao some — o detalhe em si continua certo, porque e procurado
   por id. Aqui a pintura e refeita no pedaco onde a linha de fato esta, lendo do
   painel de detalhe se a selecao abriu ou fechou. */
function remendarEscopos(){
  var CASOS=[
    {linha:'.rfv-seg-row',  det:'rfv-detalhe'},
    {linha:'.aqrfv-row',    det:'aqrfv-detalhe'},
    {linha:'.aq-vend-row',  det:'aq-detalhe'},
    {linha:'.cli-row',      det:'mn-cli-detail'}
  ];
  document.addEventListener('click',function(ev){
    if(!ev.target||!ev.target.closest) return;
    CASOS.forEach(function(C){
      var tr=ev.target.closest(C.linha); if(!tr) return;
      var escopo=tr.closest('.ato-slot')||tr.closest('section'); if(!escopo) return;
      setTimeout(function(){
        var det=$(C.det), aberto=!!(det && det.textContent.trim());
        escopo.querySelectorAll(C.linha).forEach(function(r){
          var on=(r===tr && aberto);
          r.classList.toggle('sel',on);
          r.style.background=on?'rgba(146,112,93,.12)':'';
        });
      },0);
    });
  },true);
}

/* ---------- 9) barra lateral: as ferramentas que nao fazem sentido aqui ----------
   O roteiro E o documento. O seletor de itens e o botao de roteiro continuam
   existindo no relatorio original, que segue sendo a versao flexivel. */
function ajustarFerramentas(){
  ['admintoggle','roteirobtn'].forEach(function(id){ var el=$(id); if(el) el.remove(); });
  var p=$('adminpanel'); if(p) p.remove();
  var marca=document.querySelector('.brand span');
  if(marca) marca.textContent='Roteiro executivo · '+marca.textContent;
  var rod=document.querySelector('.side-foot');
  if(rod) rod.textContent='Seis atos · 46 min · anexos completos ao fim.';
}

/* ---------- partida ---------- */
function iniciar(){
  if(!montarEsqueleto()) return;
  relocar(); esconderVazias(); preencherNotas();
  montarMenu(); spyAtos(); ligarParadas(); remendarEscopos(); ajustarFerramentas();
  if(window.INSRT) document.querySelectorAll('section.ato').forEach(function(s){
    try{ INSRT.mount(s); }catch(e){} });

  /* os filtros recriam os blocos na origem; o observador traz cada um de volta.
     Mesmo desenho do setupBlocos() do app.js: sai do ciclo com setTimeout e nao
     realimenta, porque quem ja esta no ato nao e encontrado na origem. */
  var main=$('main'), pend=false;
  new MutationObserver(function(){ if(pend) return; pend=true;
    setTimeout(function(){ pend=false; relocar(); esconderVazias(); preencherNotas(); },0);
  }).observe(main,{childList:true,subtree:true});
}

if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',iniciar);
else iniciar();

})();
