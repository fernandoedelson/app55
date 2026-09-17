/* Comparativo YTD — desenho de renderYTD() do Kit, alimentado pelo payload do servidor.
   Cada bloco só é desenhado se veio no payload (o servidor já tirou o que o perfil não vê). */
'use strict';
window.DESENHO=window.DESENHO||{};
DESENHO.ytd=function(P){
  let s='';
  const A=P['ytd.abertura'];
  if(A) s+=`<div class="sec-head"><div class="kick">Comparativo</div><h2>YTD Jan–${A.mLab} · ${A.Y0} vs ${A.Y1}</h2>
    <p class="lead">Período comparável janeiro a ${A.mLab.toLowerCase()}, venda contratada da base atualizada.</p></div>`;
  const K=P['ytd-kpi'];
  if(K){ const a=K.a,b=K.b,Y0=K.Y0,Y1=K.Y1;
    s+='<div class="kpis k3" data-blk="ytd-kpi">'+kpi(`Venda ${Y1} · Jan–`+K.mLab,mi(b.total),deltaHtml(b.total/a.total-1)+' vs '+Y0)
      +kpi(`Pedidos ${Y1}`,nf(b.peds),deltaHtml(b.peds/a.peds-1)+' vs '+Y0)
      +kpi(`Ticket médio ${Y1}`,mi(b.ticket),deltaHtml(b.ticket/a.ticket-1)+' vs '+Y0)+'</div>'; }
  const L=P['ytd-linha'];
  if(L) s+=fig(line([[String(L.Y0),L.serieA,SER[3]],[String(L.Y1),L.serieB,SER[0]]],
     L.labels,{valfmt:v=>mi(v,1),w:900,h:300}),ins('serieOscilacao'),'ytd-linha');
  const I=P['ytd-ind'];
  if(I){ const a=I.a,b=I.b;
    s+=B('ytd-ind',table(['Indicador',String(I.Y0),String(I.Y1),'Variação'],[
      ['Venda contratada',money(a.total),money(b.total),deltaHtml(b.total/a.total-1)],
      ['Pedidos',nf(a.peds),nf(b.peds),deltaHtml(b.peds/a.peds-1)],
      ['Quantidade',nf(a.qnt),nf(b.qnt),deltaHtml(b.qnt/a.qnt-1)],
      ['Ticket médio / pedido',money(a.ticket),money(b.ticket),deltaHtml(b.ticket/a.ticket-1)],
    ],['left','right','right','right'])); }
  const V=P['ytd-vendedor'];
  if(V){ const rows=V.linhas.map(x=>[esc(x[0]),money(x[1]),money(x[2]),
      `<span style="color:${x[2]-x[1]>=0?GOOD:BAD}">${money(x[2]-x[1])}</span>`, x[1]?deltaHtml(x[2]/x[1]-1):'<span class="mut">novo</span>']);
    s+=H3('Variação por vendedor(a)','','ytd-vendedor');
    s+=table(['Vendedor(a)',String(V.Y0),String(V.Y1),'Variação R$','Var. %'],rows,['left','right','right','right','right'],null,
      ins('rotatividade')); }
  return s;
};
