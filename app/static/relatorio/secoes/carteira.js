/* Carteira em aberto — desenho de renderCarteira() do Kit, alimentado pelo servidor. */
'use strict';
window.DESENHO=window.DESENHO||{};
DESENHO.carteira=function(P){
  let s='';
  const A=P['carteira.abertura'];
  const cols=['#577c69',SER[3],WARN,'#c0885a','#a8493c','#d0c4b0'];
  const aging=(ag,total)=>fig(vbars(ag.map(x=>[x[0],x[1]]),{valfmt:v=>mi(v,1),w:820,h:280,colors:cols}),
      ins('carteiraTicketPorEspera','carteira-ticket-espera')||ins('auto','auto-cart-aging'))
    +table(['Faixa','Valor pendente','Pedidos'],ag.map(x=>[esc(x[0]),money(x[1]),nf(x[2])]),['left','right','right'],
      ['Total',money(total),nf(ag.reduce((a,x)=>a+x[2],0))],ins('auto','auto-cart-aging-tab'));
  if(A){
    s+=`<div class="sec-head"><div class="kick">Carteira de pedidos</div><h2>Carteira em aberto</h2>
     <p class="lead">Pedidos ainda sem nota fiscal emitida, apurados na base atualizada (posição ${ymLab(A.maxym)}): ${mi(A.total)}.</p></div>`;
    if(A.aging) s+=aging(A.aging,A.total);
  }
  const S=P['ce-status'];
  if(S){ const stat=S.stat, stTot=stat.reduce((a,x)=>a+x[1],0);
    s+=H3('Classificação da carteira por status','carteira dinâmica · '+S.data_base,'ce-status');
    s+=fig(pareto(stat,{valfmt:v=>mi(v,1),colors:[SER[0],GOOD,WARN,BAD]}),ins('auto','auto-cart-status'));
    s+=cap('Carteira de '+mi(stTot)+' ('+nf(S.itens)+' itens, posição '+S.data_base+') segmentada por status. "Em andamento" concentra '+pct(stat[0][1]/stTot,0)+' do total; andamento + finalizado somam '+pct((stat[0][1]+stat[1][1])/stTot,0)+'.');
    s+=aging(S.aging,S.total_base);
    const rotSt=stat.map(x=>x[0].split(' ')[x[0].startsWith('Em ')?1:0].toLowerCase()+' '+mi(x[1])).join(' · ');
    s+=call('<b>Conciliação de carteira.</b> Base comercial (posição '+ymLab(S.maxym)+'): '+mi(S.total_base)+'. Carteira dinâmica ('+S.data_base+'): '+mi(stTot)+', já segmentada por status ('+rotSt+'). A diferença reflete as datas de posição distintas e o critério de cada planilha.','recon');
  }
  const V=P['ce-vend'], D=P['ce-peds'];
  if(V||D){
    s+='<div class="two">';
    if(V) s+='<div>'+H3('Carteira por vendedor(a)','','ce-vend')+table(['Vendedor(a)','Pendente','Pedidos'],V.vend.map(x=>[esc(x[0]),money(x[1]),nf(x[2])]),['left','right','right'],null,ins('auto','auto-cart-vend'))+'</div>';
    if(D) s+='<div>'+H3('Maiores pedidos em carteira','','ce-peds')+table(['Pedido','Cliente','Pendente'],D.peds.map(x=>['FOCCO-'+esc(x[0]),esc(trunc(x[1],22)),money(x[2])]),['left','left','right'],null,ins('auto','auto-cart-peds'))+'</div>';
    s+='</div>';
  }
  return s;
};
