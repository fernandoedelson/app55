/* Análise de Vendas — desenho de buildVendasFilter/renderAnaliseVendas/drawRFVSegmento do Kit.
   A janela pede os números ao servidor; os clientes de um segmento vêm por detalhamento. */
'use strict';
window.DESENHO=window.DESENHO||{};
window.DESENHO_POS=window.DESENHO_POS||{};
const AV_SEG_CORES=()=>({'Campeões':GOOD,'Fiéis':SER[0],'Em risco':BAD,'Novos / únicos':SER[2],
  'Ocasionais':BASE,'Hibernando':WARN,'Perdidos':MUT});

function _avCorpo(P){
  const A=P['vendas.abertura'];
  if(A&&A.vazio) return call('Sem venda comercial na janela selecionada.','warn');
  let s='';
  const T=P['av-time'];
  if(T){
    s+=H3('O time no período','janela de '+T.janela+' meses até '+ymLab(T.fim),'av-time');
    s+='<div class="kpis k4">'
     +kpi('Venda do time',mi(T.total),nf(T.n)+' vendedores ativos')
     +kpi('Líder',esc(trunc(T.lider,20)),pct(T.share,1)+' da venda','ok')
     +kpi('Ticket médio do time',money(T.ticket),'por pedido')
     +kpi('Custo de comissão',pct(T.custo,1),'sobre a venda')
     +'</div>';
  }
  const L=P['av-lider'];
  if(L){
    s+=H3('Retrato de '+esc(L.lider),'o que a distingue do resto do time','av-lider');
    const linha=(rot,vl,vd,fmt,melhorMaior)=>{
      const r=vd?vl/vd-1:0;
      const bom=melhorMaior===false?r<0:r>0;
      return [rot,fmt(vl),fmt(vd),`<span style="color:${bom?GOOD:BAD};font-weight:600">${spct(r,0)}</span>`];
    };
    const l=L.l, d=L.d;
    s+=table(['Indicador',esc(trunc(L.lider,22)),'Média dos demais','Diferença'],[
      linha('Venda no período',l[0],d[0],v=>mi(v)),
      linha('Valor médio do pedido',l[1],d[1],v=>money(v)),
      linha('Preço por peça',l[2],d[2],v=>money(v)),
      linha('Peças por pedido',l[3],d[3],v=>nf(v,1)),
      linha('Pedidos por cliente',l[4],d[4],v=>nf(v,2)),
      linha('Venda por cliente',l[5],d[5],v=>money(v)),
      linha('Custo de comissão',l[6],d[6],v=>pct(v,1),false),
    ],['left','right','right','right'],null,ins('lider'));
  }
  const D=P['av-diferenca'];
  if(D){
    s+=H3('De onde vem a diferença','clientes × pedidos por cliente × ticket','av-diferenca');
    s+=fig(hbar(D.barras,{valfmt:v=>spct(v,0),padLeft:200,w:760,color:SER[0]}),ins('fatoresLider'));
    s+=cap('Quanto a líder está acima (ou abaixo) da média dos outros vendedores em cada um dos três fatores. '
      +'A venda de qualquer pessoa do time nasce da multiplicação deles: atender mais clientes, '
      +'fazer cada cliente comprar mais vezes, ou vender pedidos maiores.');
  }
  const M=P['av-mix'];
  if(M){ const md={}; M.linhas.forEach((vn,i)=>{md[vn]={}; M.colunas.forEach((fn,j)=>md[vn][fn]=M.mat[i][j]);});
    s+=H3('O que cada um vende','participação de cada categoria na venda de cada vendedor','av-mix');
    s+=fig(heatmap(M.linhas,M.colunas,md,{valfmt:v=>v>1000?nf(v/1000,0):'',padLeft:170,w:900}),ins('mixCruzado'));
    s+=cap('Valores em R$ mil. Duas pessoas com a mesma venda podem ter chegado lá por categorias '
      +'completamente diferentes — e o caminho de uma nem sempre é replicável pela outra.');
  }
  const J=P['av-jogo'];
  if(J){
    s+=H3('O que está em jogo','simulações sobre a base do período, sem premissa nova','av-jogo');
    s+='<div class="kpis k3">'
     +kpi('Se todos tivessem o ticket da líder',mi(J.ganho_ticket),'a mais no período','ok')
     +kpi('Se todos tivessem a recompra da líder',mi(J.ganho_freq),'a mais no período','ok')
     +kpi('Venda atual dos demais',mi(J.tot_demais),nf(J.n_demais)+' vendedores')
     +'</div>';
    s+=table(['Vendedor(a)','Venda no período','Valor médio hoje','No valor médio da líder','Diferença'],
      J.linhas.map(x=>[esc(x[0]),money(x[1]),money(x[2]),money(x[3]),
        `<span style="color:${x[4]>0?GOOD:MUT};font-weight:600">${x[4]>0?'+'+money(x[4]):'—'}</span>`]),
      ['left','right','right','right','right'],null,ins('potencialTicket'));
    s+=cap('A coluna “No valor médio da líder” mantém a mesma quantidade de pedidos de cada pessoa e só '
      +'troca o valor médio de cada pedido pelo de '+esc(trunc(J.lider,20))+'. Não é meta: é uma forma de '
      +'medir quanto da distância do time vem apenas do tamanho dos pedidos.');
  }
  const R=P['av-rfv'];
  if(R){ const segCores=AV_SEG_CORES();
    s+=H3('Carteira de clientes · RFV','recência, frequência e valor — '+R.meses+' meses até '+ymLab(R.fim),'av-rfv');
    s+=call('<b>Como ler:</b> cada cliente recebe uma nota de 1 a 5 em recência (há quanto tempo comprou), '
      +'frequência (quantos pedidos fez) e valor (quanto somou). Os segmentos abaixo saem da combinação das três. '
      +'A base registra o mês da venda, não o dia, então a recência é contada em meses.');
    s+=fig(hbar(R.segs.map(x=>[x[0],x[3]]),{valfmt:v=>mi(v,1),padLeft:170,w:820,color:SER[0]}),ins('rfvSegmentos'));
    const alinha=['left','right','right','right','right','right','right'];
    const cab=['Segmento','Clientes','% dos clientes','Valor','% do valor','Pedidos/cliente','Meses sem comprar'];
    s+='<div class="tw"><table class="dt"><thead><tr>'
      +cab.map((h,i)=>`<th class="${alinha[i]}">${h}</th>`).join('')+'</tr></thead><tbody>'
      +R.segs.map(x=>`<tr class="rfv-seg-row" data-seg="${esc(x[0])}">`
        +`<td class="left"><span style="color:${segCores[x[0]]||INK};font-weight:600">${esc(x[0])}</span></td>`
        +`<td class="right">${nf(x[1])}</td><td class="right">${pct(x[2],1)}</td>`
        +`<td class="right">${money(x[3])}</td><td class="right">${pct(x[4],1)}</td>`
        +`<td class="right">${nf(x[5],2)}</td><td class="right">${nf(x[6],1)}</td></tr>`).join('')
      +'</tbody><tfoot><tr><td class="left">Total</td>'
      +`<td class="right">${nf(R.n)}</td><td class="right">100,0%</td>`
      +`<td class="right">${money(R.total)}</td><td class="right">100,0%</td>`
      +`<td class="right">${nf(R.f_medio,2)}</td>`
      +`<td class="right">${nf(R.r_medio,1)}</td></tr></tfoot></table></div>`;
    s+=cap('Clique num segmento para ver os clientes que estão nele.');
    s+='<div class="tw-ins"></div>';
    s+='<div id="rfv-detalhe"></div>';
  }
  const PA=P['av-parados'];
  if(PA){
    s+=H3('Clientes de valor que pararam de comprar','maior valor entre os que estão há mais tempo sem pedido','av-parados');
    s+=table(['Cliente','Valor no período','Pedidos','Meses sem comprar','Vendedor(a)'],
      PA.linhas.map(x=>[esc(trunc(x[0],34)),money(x[1]),nf(x[2]),
        `<span style="color:${x[3]>=6?BAD:WARN};font-weight:600">${nf(x[3])}</span>`,esc(trunc(x[4]||'—',20))]),
      ['left','right','right','right','left'],null,ins('rfvRisco'));
    s+=cap('Ordenado por valor, não por tempo parado: o cliente que mais vale entre os que sumiram '
      +'é onde a conversa de retomada rende mais.');
  }
  const Q=P['av-qualidade'];
  if(Q){
    s+=H3('Qualidade da carteira por vendedor(a)','quantos clientes de cada segmento cada um carrega','av-qualidade');
    s+=table(['Vendedor(a)','Clientes','Valor','Campeões + Fiéis','% do valor dele','Em risco / parados','Pedidos por cliente'],
      Q.linhas.map(x=>[esc(trunc(x[0],22)),nf(x[1]),money(x[2]),nf(x[3]),pct(x[4],0),
        `<span style="color:${x[6]>.3?BAD:MUT}">${nf(x[5])}</span>`,nf(x[7],2)]),
      ['left','right','right','right','right','right','right'],null,ins('rfvPorVendedor'));
    s+=cap('Um vendedor pode ter a mesma venda que outro com uma carteira muito diferente por baixo: '
      +'muitos clientes de uma compra só, ou poucos clientes que voltam sempre.');
  }
  return s;
}

DESENHO.vendas=function(P){
  const A=P['vendas.abertura'];
  let s='';
  if(A){
    const op=[[12,'Últimos 12 meses'],[6,'Últimos 6 meses'],[24,'Últimos 24 meses']];
    s+=`<div class="sec-head"><div class="kick">Gestão comercial</div><h2>Análise de Vendas</h2>
      <p class="lead">O que a líder faz diferente do resto do time, decomposto em clientes, recompra e tamanho de pedido — e a carteira de clientes lida por RFV (recência, frequência e valor). Tudo apurado da base comercial, sem premissa externa.</p></div>`
      +'<div class="filterbar"><div class="fb-custom"><span class="fb-t">Janela:</span> '
      +'<select id="av-janela">'+op.map(o=>`<option value="${o[0]}"${o[0]===12?' selected':''}>${o[1]}</option>`).join('')
      +`</select></div><div class="fb-lab" id="av-label">${A.janela} meses até ${ymLab(A.fim)}</div></div>`;
  }
  s+='<div id="av-body">'+_avCorpo(P)+'</div>';
  return s;
};

DESENHO_POS.vendas=function(sec,ctx){
  const A=ctx.payload['vendas.abertura']||{};
  let janela=A.janela||12, segSel=null;
  const sel=document.getElementById('av-janela'); if(sel) sel.value=janela;
  const figRFV=()=>{ let el=sec.querySelector('h3[data-blk="av-rfv"]');
    while(el&&(el=el.nextElementSibling)){ if(el.matches('h3[data-blk]')) return null; if(el.matches('.fig')) return el.querySelector('svg'); }
    return null; };
  function marcaSeg(){
    sec.querySelectorAll('.rfv-seg-row').forEach(tr=>{ tr.style.background=(tr.dataset.seg===segSel)?'rgba(146,112,93,.12)':''; });
    const f=figRFV();
    if(f) f.querySelectorAll('rect[data-lab]').forEach(r=>{ const on=r.dataset.lab===segSel; r.style.stroke=on?INK:''; r.style.strokeWidth=on?'2':''; });
  }
  async function segmento(seg){
    const det=document.getElementById('rfv-detalhe'); if(!det) return;
    if(segSel===seg){ segSel=null; det.innerHTML=''; marcaSeg(); return; }
    segSel=seg; marcaSeg();
    const R=await ctx.detalhe('segmento',{janela,seg});
    if(!R.linhas.length){ det.innerHTML=''; return; }
    det.innerHTML=H3('Clientes em “'+esc(seg)+'”', nf(R.linhas.length)+' · '+mi(R.total))
      +table(['Cliente','Valor no período','Pedidos','Meses sem comprar','Tempo de relação','Vendedor(a)','% acumulada'],
         R.linhas.map(x=>[esc(trunc(x[0],38)),money(x[1]),nf(x[2]),
           `<span style="color:${x[3]>=6?BAD:(x[3]>=3?WARN:GOOD)};font-weight:600">${nf(x[3])}</span>`,
           x[4]?nf(x[4])+' meses':'—',esc(trunc(x[5]||'—',20)),pct(x[6],1)]),
         ['left','right','right','right','right','left','right'])
      +cap('“Meses sem comprar” é a recência; “tempo de relação” é a distância entre a primeira e a última compra '
        +'dentro da janela. Clique de novo no segmento para fechar.');
    ctx.remarcar();
    det.scrollIntoView({behavior:'smooth',block:'nearest'});
  }
  function ligar(){
    if(!ctx.pode('detalhar')) return;
    sec.querySelectorAll('.rfv-seg-row').forEach(tr=>{ tr.style.cursor='pointer'; tr.addEventListener('click',()=>segmento(tr.dataset.seg)); });
    const f=figRFV();
    if(f) f.querySelectorAll('rect[data-lab]').forEach(r=>{ r.style.cursor='pointer'; r.addEventListener('click',()=>segmento(r.dataset.lab)); });
  }
  if(sel) sel.addEventListener('change',async e=>{
    janela=+e.target.value; segSel=null;
    const P=await ctx.buscar({janela});
    document.getElementById('av-body').innerHTML=_avCorpo(P);
    const lb=document.getElementById('av-label'); if(lb) lb.textContent=janela+' meses até '+ymLab((P['vendas.abertura']||A).fim);
    ligar(); ctx.remarcar();
  });
  ligar();
};
