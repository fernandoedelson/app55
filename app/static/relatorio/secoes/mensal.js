/* Análise mensal — desenho de buildMensalFilter/renderMensalBody do Kit.
   O filtro de mês e o clique no cliente pedem os números ao servidor (ctx.buscar). */
'use strict';
window.DESENHO=window.DESENHO||{};
window.DESENHO_POS=window.DESENHO_POS||{};

function _mensalTabelaClientes(T,rotulo){
  const corte=T.corte, total=T.total;
  let acum=0;
  const trs=T.linhas.map((x,i)=>{ acum+=x.v;
    const ehCorte=corte&&i===corte.n-1;
    const cls=['cli-row',ehCorte?'cut':''].filter(Boolean).join(' ');
    return `<tr class="${cls}" data-c="${x.idx}"><td class="left">${esc(x.name)}</td>`
      +`<td class="right">${money(x.v)}</td>`
      +`<td class="right">${pct(total?x.v/total:0)}</td>`
      +`<td class="right acum">${pct(total?acum/total:0)}</td></tr>`;}).join('');
  return '<div class="tw"><table class="dt"><thead><tr><th class="left">Cliente</th>'
    +`<th class="right">Venda</th><th class="right">${esc(rotulo)}</th><th class="right">% acumulado</th>`
    +`</tr></thead><tbody>${trs}</tbody></table></div>`;
}

function _mensalCorpo(P){
  const A=P['mensal.abertura'];
  let s='';
  if(A){ const j=A.j,p=A.p; const dV=(c,o)=>o?deltaHtml(c/o-1):'';
    s+='<div class="kpis k4">'
      +kpi('Venda contratada',mi(j.total),p.total?dV(j.total,p.total)+' vs '+mesLongo(A.pv):'')
      +kpi('Pedidos',nf(j.peds),p.peds?dV(j.peds,p.peds)+' vs mês anterior':'')
      +kpi('Ticket médio',mi(j.ticket),p.ticket?dV(j.ticket,p.ticket)+' vs mês anterior':'por pedido')
      +kpi('Quantidade',nf(j.qnt),'itens vendidos')+'</div>';
    if(!j.total) return s+call('Sem vendas registradas em '+mesLongo(A.ym)+'.','warn');
  }
  const E=P['mn-evol'];
  if(E){ s+=H3('Evolução — 12 meses até '+mesLongo(E.ym),'','mn-evol');
    s+=fig(line([['Venda contratada',E.serie,SER[0]]],E.meses.map(ymLab),{valfmt:v=>mi(v,1),w:960,h:260}),ins('vendasPrecoVolume')); }
  const V=P['mn-vend'], C=P['mn-cat'];
  if(V||C){
    s+='<div class="two">';
    if(V) s+='<div>'+H3('Top vendedoras','','mn-vend')+fig(hbar(V.top,{valfmt:v=>mi(v,1),padLeft:200,w:520}),ins('concentracao'))+'</div>';
    if(C) s+='<div>'+H3('Top categorias','','mn-cat')+fig(hbar(C.top,{valfmt:v=>mi(v,1),color:SER[2],padLeft:150,w:520}),ins('concentracao'))+'</div>';
    s+='</div>';
  }
  const T=P['mn-cli'];
  if(T){ const p80=T.corte;
    s+=H3('Maiores clientes do mês',p80?(nf(p80.n)+(p80.n===1?' cliente':' clientes')+' = 80% da venda'):'','mn-cli');
    s+=_mensalTabelaClientes(T,'% do mês');
    s+=cap('Clique num cliente para ver os itens comprados no mês.'
      +(p80&&T.n>p80.n?' A linha marcada é onde o acumulado cruza os 80%.':'')
      +(T.restantes>0?' Outros '+nf(T.restantes)+' clientes compraram no mês e somam '+pct(1-T.share,1)+'.':''));
    s+='<div class="tw-ins"></div>';
    s+='<div id="mn-cli-detail"></div>';
  }
  return s;
}

DESENHO.mensal=function(P){
  const A=P['mensal.abertura'];
  let s='';
  if(A){
    s+=`<div class="sec-head"><div class="kick">Fechamento do mês</div><h2>Análise mensal</h2>
      <p class="lead">Escolha o mês de referência para ver o fechamento comercial: venda, pedidos, ticket, evolução dos últimos 12 meses, vendedoras, categorias e clientes — com comparação ao mês anterior. Atualiza automaticamente a cada nova base.</p></div>`;
    const ms=A.meses, last=ms[ms.length-1];
    const opts=ms.slice().reverse().map(y=>`<option value="${y}"${y===last?' selected':''}>${mesLongo(y)}</option>`).join('');
    s+=`<div class="filterbar"><div class="fb-custom"><span class="fb-t">Mês de referência:</span> <select id="mn-sel">${opts}</select></div><div class="fb-label" id="mn-label">Referência: ${mesLongo(A.ym)}</div></div>`;
  }
  s+='<div id="mensal-body">'+_mensalCorpo(P)+'</div>';
  return s;
};

DESENHO_POS.mensal=function(sec,ctx){
  const sel=document.getElementById('mn-sel');
  const P0=ctx.payload['mensal.abertura']||ctx.payload['mn-cli']||{};
  let ym=P0.ym;
  if(sel){ sel.value=ym;
    sel.addEventListener('change',async()=>{
      ym=+sel.value;
      const P=await ctx.buscar({ym:ym});
      document.getElementById('mensal-body').innerHTML=_mensalCorpo(P);
      const lb=document.getElementById('mn-label'); if(lb) lb.textContent='Referência: '+mesLongo(ym);
      ctx.remarcar(); ligarClientes();
    }); }
  function ligarClientes(){
    const body=document.getElementById('mensal-body'); if(!body||!ctx.pode('detalhar')) return;
    body.querySelectorAll('.cli-row').forEach(tr=>{ tr.style.cursor='pointer';
      tr.addEventListener('click',async()=>{
        const det=document.getElementById('mn-cli-detail'); if(!det) return;
        const wasSel=tr.classList.contains('sel');
        body.querySelectorAll('.cli-row').forEach(r=>{r.classList.remove('sel'); r.style.background='';});
        if(wasSel){ tr.classList.remove('sel'); det.innerHTML=''; return; }
        tr.classList.add('sel'); tr.style.background='rgba(146,112,93,.12)';
        const R=await ctx.detalhe('itens',{cli:tr.dataset.c,ym:ym});
        const itens=R.itens||[];
        const totQ=itens.reduce((a,it)=>a+it[1],0), totV=itens.reduce((a,it)=>a+it[2],0);
        det.innerHTML=H3('Itens comprados — '+tr.children[0].textContent)
          +table(['Produto','Qtd','Valor','Previsão de entrega'],
              itens.map(it=>[esc(trunc(it[0],50)),nf(it[1]),money(it[2]),it[3]||'—']),
              ['left','right','right','right'],
              ['Total',nf(totQ),money(totV),'']);
      });
    });
  }
  ligarClientes();
};
