/* Carteira dinâmica — desenho de renderCarteiraDinamica(), drawCartdinStatus() e
   toggleCartdinPedido() do Kit. Os itens de cada pedido vêm por detalhamento. */
'use strict';
window.DESENHO=window.DESENHO||{};
window.DESENHO_POS=window.DESENHO_POS||{};
DESENHO.carteira_dinamica=function(P){
  const A=P['carteira_dinamica.abertura'];
  if(A&&A.ausente) return call('Fonte "VENDAS LOJA *.xlsx" não encontrada em fontes/. Seção não gerada.','warn');
  let s='';
  if(A){
    s+=`<div class="sec-head"><div class="kick">Carteira · fonte ${esc((A.fonte||'VENDAS LOJA').replace(/\.xlsx$/i,''))}</div><h2>Carteira dinâmica</h2>
     <p class="lead">Pedidos em carteira (excluídos cancelados, devoluções e entregues), lidos diretamente de ${esc(A.fonte||'VENDAS LOJA')} — posição ${A.data_base}.</p></div>`;
    s+='<div class="kpis">'
     +kpi('Carteira total',mi(A.total),A.itens+' itens')
     +kpi('Pedidos',nf(A.pedidos))
     +kpi('Posição',A.data_base)
     +'</div>';
  }
  const S=P['cd-status'];
  if(S){
    s+=H3('Classificação da carteira por status','','cd-status');
    s+=`<div class="fig" id="cartdin-status-fig">${pareto(S.status,{valfmt:v=>mi(v,1),colors:[SER[0],GOOD,WARN,BAD],clickable:true})}`
     +`${window.INSRT?INSRT.strip(ins('carteiraAtrasoConcentrado','carteira-atraso-concentrado')||ins('auto','auto-cartdin-status')):''}</div>`;
    s+=cap('Clique em uma barra para ver os pedidos daquele status.');
  }
  const E=P['cd-evol'];
  if(E){ const C=E.evol;
    s+=H3('Evolutiva mensal da carteira','por mês de venda · barras = valor do mês · área = acumulado','cd-evol');
    s+=fig(evolCombo(C.yms.map(ymLab),[{name:'Vendas',values:C.vendas,color:SER[0]},{name:'Atrasados',values:C.atrasados,color:BAD}],
      C.acum,{valfmt:v=>mi(v,1)}),ins('auto','auto-cartdin-evol')); }
  const D=P['cd-adiados'];
  if(D){ const C=D.evol;
    s+=H3('Carteira de pedidos adiados','evolutiva mensal · barras = valor do mês · área = acumulado','cd-adiados');
    s+=fig(evolCombo(C.yms.map(ymLab),[{name:'Adiado',values:C.valor,color:WARN}],C.acum,{valfmt:v=>mi(v,1)}),ins('carteiraAdiadoTicket','carteira-adiado-ticket')); }
  const R=P['cd-previsao'];
  if(R){ const C=R.evol;
    s+=H3('Previsão de faturamento — pedidos em andamento','por data de entrega prevista · área = acumulado','cd-previsao');
    s+=fig(evolCombo(C.yms.map(ymLab),[{name:'Previsto',values:C.valor,color:SER[0]}],C.acum,{valfmt:v=>mi(v,1)}),ins('carteiraPicoEntrega','carteira-pico-entrega')||ins('auto','auto-cartdin-entrega')); }
  const V=P['cd-vend'], K=P['cd-peds'];
  if(V||K){
    s+='<div class="two">';
    if(V) s+='<div>'+H3('Carteira por vendedor(a)','','cd-vend')
      +(V.tem?table(['Vendedor(a)','Pendente','Pedidos'],V.vend.map(x=>[esc(x[0]),money(x[1]),nf(x[2])]),['left','right','right'],null,ins('auto','auto-cartdin-vend'))
             :call('Coluna "VENDEDORA" não encontrada nesta geração da planilha.','warn'))+'</div>';
    if(K) s+='<div>'+H3('Maiores pedidos em carteira','','cd-peds')
      +table(['Pedido','Cliente','Status','Pendente'],
         K.peds.map(x=>[esc(String(x[0])),esc(trunc(x[1],22)),esc(x[2].join(' + ')),money(x[3])]),
         ['left','left','left','right'],null,ins('concentracao','concentracao-ped-carteira'))+'</div>';
    s+='</div>';
    s+=cap('Pendente = valor ainda em carteira (excluídos cancelados, devoluções e entregues). '
      +'Os 12 maiores pedidos somam todos os status: quando um pedido tem itens em situações diferentes, os dois aparecem na coluna Status.');
  }
  const T=P['cd-status-tab'];
  if(T){
    s+=H3('Pedidos por status','','cd-status-tab');
    s+='<div class="filterbar"><div class="fb-custom"><span class="fb-t">Status:</span> <select id="cartdin-status-sel">'
     +T.status.map((x,idx)=>`<option value="${idx}">${esc(x[0])} · ${esc(mi(x[1],1))}</option>`).join('')
     +'</select></div></div>';
  }
  if(S) s+='<div id="cartdin-status-detail" data-blk="cd-status"></div>';
  return s;
};
DESENHO_POS.carteira_dinamica=function(sec,ctx){
  const S=ctx.payload['cd-status']; if(!S) return;
  const box=document.getElementById('cartdin-status-fig'); if(!box) return;
  const bars=box.querySelectorAll('.par-bar');
  function desenha(i){
    bars.forEach(b=>{b.style.stroke='';b.style.strokeWidth='';});
    const el=Array.from(bars).find(b=>+b.dataset.i===i); if(el){el.style.stroke=INK;el.style.strokeWidth='2.5';}
    const sel=document.getElementById('cartdin-status-sel'); if(sel) sel.value=i;
    const [bucket,total]=S.status[i], peds=S.pedidos[bucket]||[];
    let acc=0;
    const rows=peds.map(p=>{ acc+=p[2];
      return `<tr class="cartdin-ped-row" data-p="${esc(String(p[0]))}">`
       +`<td class="left">FOCCO-${esc(p[0])}</td><td class="left">${esc(trunc(p[1],30))}</td>`
       +`<td class="right">${nf(p[3])}</td><td class="right">${money(p[2])}</td>`
       +`<td class="right">${pct(total?p[2]/total:0,1)}</td><td class="right">${pct(total?acc/total:0,1)}</td></tr>`;}).join('');
    const det=document.getElementById('cartdin-status-detail'); if(!det) return;
    det.innerHTML = H3('Pedidos em carteira — '+bucket, mi(total)+' · '+nf(peds.length)+' pedidos')
      +`<div class="tw"><table class="dt"><thead><tr>
          <th class="left">Pedido</th><th class="left">Cliente</th><th class="right">Itens</th>
          <th class="right">Valor</th><th class="right">% do status</th><th class="right">% acumulada</th>
        </tr></thead><tbody>${rows}</tbody></table></div>`
      +'<div class="tw-ins">'+(window.INSRT?INSRT.strip(ins('auto','auto-cartdin-peds-'+bucket)):'')+'</div>'
      +cap('Clique num pedido para ver os itens.')
      +'<div id="cartdin-ped-detail"></div>';
    if(!ctx.pode('detalhar')) return;
    det.querySelectorAll('.cartdin-ped-row').forEach(tr=>{ tr.style.cursor='pointer';
      tr.addEventListener('click',async()=>{
        const detail=document.getElementById('cartdin-ped-detail'); if(!detail) return;
        const wasSel=tr.classList.contains('sel');
        tr.closest('table').querySelectorAll('.cartdin-ped-row').forEach(r=>{r.classList.remove('sel'); r.style.background='';});
        if(wasSel){ tr.classList.remove('sel'); detail.innerHTML=''; return; }
        tr.classList.add('sel'); tr.style.background='rgba(146,112,93,.12)';
        const R=await ctx.detalhe('pedido',{ped:tr.dataset.p,status:bucket});
        detail.innerHTML = H3('Itens do pedido FOCCO-'+esc(R.ped))
          + table(['Produto','Qtd','Valor','Data venda','Data entrega'],
              R.itens.map(l=>[esc(l[0]),nf(l[1]),money(l[2]),l[3]||'—',l[4]||'—']),
              ['left','right','right','right','right']);
      });
    });
  }
  bars.forEach(el=>el.addEventListener('click',()=>{ desenha(+el.dataset.i); ctx.marcar(); }));
  const sel=document.getElementById('cartdin-status-sel');
  if(sel) sel.addEventListener('change',()=>{ desenha(+sel.value); ctx.marcar(); });
  if(bars.length){ desenha(0); ctx.remarcar(); }
};
