/* Vendedor × Arquiteto — desenho de buildArqFilter/renderArquitetos/blocoRfvArquitetos do Kit.
   A janela pede os números ao servidor; a carteira de um vendedor e os arquitetos de um segmento
   do RFV vêm por detalhamento. */
'use strict';
window.DESENHO=window.DESENHO||{};
window.DESENHO_POS=window.DESENHO_POS||{};
const AQ_SEG_CORES=()=>({'Campeões':GOOD,'Fiéis':SER[0],'Em risco':BAD,'Novos / únicos':SER[2],
  'Ocasionais':BASE,'Hibernando':WARN,'Perdidos':MUT});

function _aqCorpo(P){
  const A=P['arquitetos.abertura'];
  if(A&&A.vazio) return call('Sem venda com arquiteto na janela selecionada.','warn');
  let s='';
  const K=P['aq-peso'];
  if(K){
    s+=H3('O peso do canal','janela de '+K.janela+' meses até '+ymLab(K.fim),'aq-peso');
    s+='<div class="kpis k4">'
     +kpi('Venda com arquiteto',mi(K.totA),pct(K.share,1)+' de toda a venda')
     +kpi('Arquitetos ativos',nf(K.n),'com ao menos um pedido')
     +kpi('RT paga',mi(K.rt),pct(K.rt_pct,1)+' da venda com arquiteto')
     +kpi('Exclusivos de um vendedor',pct(K.excl_pct,0),nf(K.excl)+' de '+nf(K.n),'warn')
     +'</div>';
  }
  const D=P['aq-dependencia'];
  if(D){
    s+=H3('Quanto cada vendedor depende do canal','venda com arquiteto × venda direta','aq-dependencia');
    s+=fig(stackedCols(D.nomes.map(n=>trunc(n,14)),[
        {name:'Com arquiteto',values:D.arq,color:SER[0]},
        {name:'Venda direta',values:D.sem,color:BASE},
      ],{valfmt:v=>mi(v,1),w:960,subLabels:D.share.map(v=>pct(v,0)),subTitle:'% via arquiteto'}),ins('arqCanal','arq-canal'));
    s+=cap('A linha de baixo é a fatia da venda de cada um que passou por um arquiteto. '
      +'Dois vendedores com a mesma venda podem estar em negócios completamente diferentes.');
  }
  const Q=P['aq-quantos'];
  if(Q){
    s+=H3('De quantos arquitetos cada vendedor vive','clique numa linha para ver a carteira dele','aq-quantos');
    const alinha=['left','right','right','right','right','right','right','right'];
    const cab=['Vendedor(a)','Venda total','% via arquiteto','Arquitetos','Bastam p/ 50%','Maior arquiteto',
               'Ticket c/ arq.','Ticket direto'];
    s+='<div class="tw"><table class="dt"><thead><tr>'
      +cab.map((h,i)=>`<th class="${alinha[i]}">${h}</th>`).join('')+'</tr></thead><tbody>'
      +Q.linhas.map(x=>`<tr class="aq-vend-row" data-v="${esc(x[0])}">`
        +`<td class="left">${esc(trunc(x[0],24))}</td>`
        +`<td class="right">${money(x[1])}</td>`
        +`<td class="right">${pct(x[2],0)}</td>`
        +`<td class="right">${nf(x[3])}</td>`
        +`<td class="right"><b>${x[3]?nf(x[4]):'—'}</b></td>`
        +`<td class="right">${x[3]?pct(x[5],0):'—'}</td>`
        +`<td class="right">${x[6]!=null?money(x[6]):'—'}</td>`
        +`<td class="right">${x[7]!=null?money(x[7]):'—'}</td></tr>`).join('')
      +'</tbody></table></div>';
    s+=cap('<b>Bastam p/ 50%</b>: quantos arquitetos, somados do maior para o menor, já chegam à metade da '
      +'venda que aquele vendedor faz pelo canal. Se o número é <b>2</b>, dois arquitetos respondem por metade '
      +'de tudo — e a coluna ao lado mostra quantos existem no total. Quanto mais distantes esses dois números, '
      +'mais distribuída a agenda; quanto mais próximos, mais ela depende de poucas relações.');
    s+='<div class="tw-ins">'+(window.INSRT?INSRT.strip(ins('arqDependencia','arq-dependencia')):'')+'</div>';
    s+='<div id="aq-detalhe"></div>';
  }
  const M=P['aq-matriz'];
  if(M){ const md={}; M.linhas.forEach((vn,i)=>{md[vn]={}; M.colunas.forEach((an,j)=>md[vn][an]=M.mat[i][j]);});
    s+=H3('Quem trabalha com quem','R$ mil · maiores arquitetos × maiores vendedores','aq-matriz');
    s+=fig(heatmap(M.linhas,M.colunas,md,{valfmt:v=>v>1000?nf(v/1000,0):'',padLeft:150,w:940}),ins('arqMatriz','arq-matriz'));
    s+=cap('Célula vazia é par que nunca trabalhou junto. Uma coluna concentrada numa linha só é um '
      +'arquiteto que pertence a um vendedor; espalhada, é um arquiteto da casa.');
  }
  const L=P['aq-lista'];
  if(L){
    s+=H3('Os arquitetos','ordenados por venda atribuída na janela','aq-lista');
    s+=fig(hbar(L.top,{valfmt:v=>mi(v,1),padLeft:250,w:820,color:SER[6],maxbars:14,pct:true,total:L.total}),ins('auto','auto-arq-canal'));
    s+=table(['Arquiteto / escritório','Venda atribuída','RT paga','RT efetiva','Pedidos','Clientes',
              'Vendedor principal','% com ele','Meses sem trazer'],
      L.linhas.map(x=>[esc(trunc(x[0],30)),money(x[1]),money(x[2]),pct(x[3],1),nf(x[4]),nf(x[5]),
        esc(trunc(x[6]||'—',18)),
        `<span style="color:${x[7]>=.9?WARN:MUT}">${pct(x[7],0)}</span>`,
        `<span style="color:${x[8]>=6?BAD:(x[8]>=3?WARN:GOOD)};font-weight:600">${nf(x[8])}</span>`]),
      ['left','right','right','right','right','right','left','right','right'],null,ins('arqExclusividade','arq-exclusividade'));
    s+=cap('“% com ele” é quanto da venda daquele arquiteto passou pelo vendedor principal. '
      +'Perto de 100% significa relação exclusiva — o arquiteto é do vendedor, não da casa.');
  }
  const PA=P['aq-parados'];
  if(PA){
    s+=H3('Arquitetos que pararam de trazer','sem nenhum pedido há seis meses ou mais','aq-parados');
    s+=table(['Arquiteto / escritório','Venda na janela','Pedidos','Meses sem trazer','Vendedor principal'],
      PA.linhas.map(x=>[esc(trunc(x[0],32)),money(x[1]),nf(x[2]),
        `<span style="color:${BAD};font-weight:600">${nf(x[3])}</span>`,esc(trunc(x[4]||'—',20))]),
      ['left','right','right','right','left'],null,ins('arqParados','arq-parados'));
  }
  const R=P['aq-rfv'];
  if(R){ const segCores=AQ_SEG_CORES();
    s+=H3('Carteira de arquitetos · RFV','o mesmo corte da carteira de clientes, aplicado ao canal','aq-rfv');
    s+=call('Cada arquiteto recebe nota de 1 a 5 em <b>recência</b> (há quantos meses trouxe o último pedido), '
      +'<b>frequência</b> (quantos pedidos trouxe) e <b>valor</b> (quanto somou). Os segmentos saem da combinação '
      +'das três — e valem para o canal como valem para o cliente final: um arquiteto que parou de especificar '
      +'não avisa, só some da lista.');
    s+=fig(hbar(R.segs.map(x=>[x[0],x[3]]),{valfmt:v=>mi(v,1),padLeft:170,w:820,color:SER[6]}),ins('rfvArqSegmentos','rfv-arq-segmentos'));
    const al=['left','right','right','right','right','right','right'];
    const cb=['Segmento','Arquitetos','% do canal (nº)','Venda atribuída','% do valor','Pedidos/arquiteto','Meses sem trazer'];
    s+='<div class="tw"><table class="dt"><thead><tr>'
      +cb.map((h,i)=>`<th class="${al[i]}">${h}</th>`).join('')+'</tr></thead><tbody>'
      +R.segs.map(x=>`<tr class="aqrfv-row" data-seg="${esc(x[0])}">`
        +`<td class="left"><span style="color:${segCores[x[0]]||INK};font-weight:600">${esc(x[0])}</span></td>`
        +`<td class="right">${nf(x[1])}</td><td class="right">${pct(x[2],1)}</td>`
        +`<td class="right">${money(x[3])}</td><td class="right">${pct(x[4],1)}</td>`
        +`<td class="right">${nf(x[5],2)}</td><td class="right">${nf(x[6],1)}</td></tr>`).join('')
      +'</tbody><tfoot><tr><td class="left">Total</td>'
      +`<td class="right">${nf(R.n)}</td><td class="right">100,0%</td>`
      +`<td class="right">${money(R.total)}</td><td class="right">100,0%</td>`
      +`<td class="right">${nf(R.f_medio,2)}</td>`
      +`<td class="right">${nf(R.r_medio,1)}</td></tr></tfoot></table></div>`;
    s+=cap('Clique num segmento para ver os arquitetos que estão nele, com o vendedor responsável.');
    s+='<div class="tw-ins">'+(window.INSRT?INSRT.strip(ins('rfvArqTabela','rfv-arq-recompra')):'')+'</div>';
    s+='<div id="aqrfv-detalhe"></div>';
  }
  const PF=P['aq-perf'];
  if(PF){
    s+=H3('Performance do vendedor com o arquiteto','de que qualidade é a carteira de canal de cada um','aq-perf');
    s+=fig(stackedCols(PF.nomes.map(n=>trunc(n,14)),[
        {name:'Campeões e fiéis',values:PF.bons,color:GOOD},
        {name:'Ocasionais / novos',values:PF.meio,color:BASE},
        {name:'Em risco / parados',values:PF.ruins,color:BAD},
      ],{valfmt:v=>mi(v,1),w:960,subLabels:PF.sub.map(v=>pct(v,0)),subTitle:'% em fiéis'}),ins('rfvArqPorVendedor','rfv-arq-por-vendedor'));
    s+=table(['Vendedor(a)','Arquitetos','Venda pelo canal','Campeões + fiéis','% do valor dele',
              'Em risco / parados','% do valor','Pedidos por arquiteto','Ticket'],
      PF.linhas.map(x=>[esc(trunc(x[0],22)),nf(x[1]),money(x[2]),
        nf(x[3]),`<span style="color:${GOOD};font-weight:600">${pct(x[4],0)}</span>`,
        nf(x[5]),`<span style="color:${x[6]>.4?BAD:MUT};font-weight:600">${pct(x[6],0)}</span>`,
        nf(x[7],2),money(x[8])]),
      ['left','right','right','right','right','right','right','right','right'],null,ins('rfvArqQualidade','rfv-arq-qualidade'));
    s+=cap('A mesma carteira de arquitetos pode render de formas muito diferentes: o que separa não é '
      +'quantos arquitetos alguém tem, e sim quantos deles continuam trazendo pedido.');
  }
  return s;
}

DESENHO.arquitetos=function(P){
  const A=P['arquitetos.abertura'];
  let s='';
  if(A){
    const op=[[12,'Últimos 12 meses'],[6,'Últimos 6 meses'],[24,'Últimos 24 meses']];
    s+=`<div class="sec-head"><div class="kick">Canal de venda</div><h2>Vendedor × Arquiteto</h2>
      <p class="lead">Na maior parte dos projetos quem especifica e traz o cliente é o arquiteto — o que faz do par vendedor × arquiteto o canal real da venda. Quanto cada vendedor depende dele, de quantas relações vive, quais arquitetos são da casa e quais são de uma pessoa só.</p></div>`
      +'<div class="filterbar"><div class="fb-custom"><span class="fb-t">Janela:</span> '
      +'<select id="aq-janela">'+op.map(o=>`<option value="${o[0]}"${o[0]===12?' selected':''}>${o[1]}</option>`).join('')
      +`</select></div><div class="fb-lab" id="aq-label">${A.janela} meses até ${ymLab(A.fim)}</div></div>`;
  }
  s+='<div id="aq-body">'+_aqCorpo(P)+'</div>';
  return s;
};

DESENHO_POS.arquitetos=function(sec,ctx){
  const A=ctx.payload['arquitetos.abertura']||{};
  let janela=A.janela||12, vendSel=null, segSel=null;
  const sel=document.getElementById('aq-janela'); if(sel) sel.value=janela;
  const marcaVend=()=>sec.querySelectorAll('.aq-vend-row').forEach(tr=>{
    tr.style.background=(tr.dataset.v===vendSel)?'rgba(146,112,93,.12)':''; });
  const marcaSeg=()=>sec.querySelectorAll('.aqrfv-row').forEach(tr=>{
    tr.style.background=(tr.dataset.seg===segSel)?'rgba(146,112,93,.12)':''; });
  async function carteira(vn){
    const det=document.getElementById('aq-detalhe'); if(!det) return;
    if(vendSel===vn){ vendSel=null; det.innerHTML=''; marcaVend(); return; }
    vendSel=vn; marcaVend();
    const R=await ctx.detalhe('vendedor',{janela,vend:vn});
    if(!R.linhas.length){ det.innerHTML=call('Sem venda com arquiteto para '+esc(vn)+' na janela.','warn'); return; }
    det.innerHTML=H3('Arquitetos de '+esc(vn), nf(R.linhas.length)+' · '+mi(R.total))
      +table(['Arquiteto / escritório','Venda atribuída','% do vendedor','% acumulada','Exclusivo?','RT efetiva','Meses sem trazer'],
        R.linhas.map(x=>[esc(trunc(x[0],34)),money(x[1]),pct(x[2],1),pct(x[3],1),
          x[4]?'<span style="color:'+WARN+'">só com '+esc(trunc(vn,14))+'</span>'
              :'<span class="mut">com '+nf(x[5])+' vendedores</span>',
          pct(x[6],1),
          x[7]==null?'—':`<span style="color:${x[7]>=6?BAD:(x[7]>=3?WARN:GOOD)};font-weight:600">${nf(x[7])}</span>`]),
        ['left','right','right','right','left','right','right'])
      +cap('“Exclusivo” marca o arquiteto que só trouxe negócio para este vendedor na janela — a relação é '
        +'pessoal, e some junto com ele. Clique de novo na linha para fechar.');
    ctx.remarcar();
    det.scrollIntoView({behavior:'smooth',block:'nearest'});
  }
  async function segmento(seg){
    const det=document.getElementById('aqrfv-detalhe'); if(!det) return;
    if(segSel===seg){ segSel=null; det.innerHTML=''; marcaSeg(); return; }
    segSel=seg; marcaSeg();
    const R=await ctx.detalhe('segmento',{janela,seg});
    if(!R.linhas.length){ det.innerHTML=''; return; }
    det.innerHTML=H3('Arquitetos em “'+esc(seg)+'”', nf(R.linhas.length)+' · '+mi(R.total))
      +table(['Arquiteto / escritório','Venda atribuída','Pedidos','Meses sem trazer','RT efetiva',
              'Vendedor principal','Exclusivo?','% acumulada'],
        R.linhas.map(x=>[esc(trunc(x[0],32)),money(x[1]),nf(x[2]),
          `<span style="color:${x[3]>=6?BAD:(x[3]>=3?WARN:GOOD)};font-weight:600">${nf(x[3])}</span>`,
          pct(x[4],1),esc(trunc(x[5]||'—',20)),
          x[6]?'<span style="color:'+WARN+'">sim</span>':'<span class="mut">não</span>',
          pct(x[7],1)]),
        ['left','right','right','right','right','left','left','right'])
      +cap('Clique de novo no segmento para fechar.');
    ctx.remarcar();
    det.scrollIntoView({behavior:'smooth',block:'nearest'});
  }
  function ligar(){
    if(!ctx.pode('detalhar')) return;
    sec.querySelectorAll('.aq-vend-row').forEach(tr=>{ tr.style.cursor='pointer'; tr.addEventListener('click',()=>carteira(tr.dataset.v)); });
    sec.querySelectorAll('.aqrfv-row').forEach(tr=>{ tr.style.cursor='pointer'; tr.addEventListener('click',()=>segmento(tr.dataset.seg)); });
  }
  if(sel) sel.addEventListener('change',async e=>{
    janela=+e.target.value; vendSel=null; segSel=null;
    const P=await ctx.buscar({janela});
    document.getElementById('aq-body').innerHTML=_aqCorpo(P);
    const lb=document.getElementById('aq-label'); if(lb) lb.textContent=janela+' meses até '+ymLab((P['arquitetos.abertura']||A).fim);
    ligar(); ctx.remarcar();
  });
  ligar();
};
