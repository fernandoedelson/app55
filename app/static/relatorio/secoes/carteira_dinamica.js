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
     +(A.pr_total>0?kpi('Partes relacionadas (PR)',mi(A.pr_total),pct(A.total?A.pr_total/A.total:0,0)+' da carteira'):'')
     +'</div>';
  }
  const S=P['cd-status'];
  if(S){
    s+=H3('Classificação da carteira por status','','cd-status');
    s+=`<div class="fig" id="cartdin-status-fig">${pareto(S.status,{valfmt:v=>mi(v,1),colors:[SER[0],GOOD,WARN,BAD],clickable:true,partes:S.pr_status||null})}`
     +`${window.INSRT?INSRT.strip(ins('carteiraAtrasoConcentrado','carteira-atraso-concentrado')||ins('auto','auto-cartdin-status')):''}</div>`;
    s+=cap('Clique em uma barra para ver os pedidos daquele status.'+(S.pr_total>0?' Tom mais escuro = parte relacionada (PR): '+mi(S.pr_total,1)+' ('+pct(S.total?S.pr_total/S.total:0,0)+' da carteira).':''));
  }
  const E=P['cd-evol'];
  if(E){ const C=E.evol;
    s+=H3('Evolutiva mensal da carteira','por mês de venda · barras = valor do mês · área = acumulado','cd-evol');
    s+=fig(evolCombo(C.yms.map(ymLab),[{name:'Vendas',values:C.vendas,color:SER[0]},{name:'Atrasados',values:C.atrasados,color:BAD}],
      C.acum,{valfmt:v=>mi(v,1),partes:E.pr||null}),ins('auto','auto-cartdin-evol'));
    if(E.pr) s+=prCap(prSoma(E.pr[0]),prSoma(C.vendas),'das vendas em carteira'); }
  const D=P['cd-adiados'];
  if(D){ const C=D.evol;
    s+=H3('Carteira de pedidos adiados','evolutiva mensal · barras = valor do mês · área = acumulado','cd-adiados');
    s+='<div id="cartdin-adiado-fig">'+fig(evolCombo(C.yms.map(ymLab),[{name:'Adiado',values:C.valor,color:WARN}],C.acum,{valfmt:v=>mi(v,1),partes:D.pr||null,clicavel:true}),ins('carteiraAdiadoTicket','carteira-adiado-ticket'))+'</div>';
    if(D.pr) s+=prCap(prSoma(D.pr[0]),prSoma(C.valor),'dos pedidos adiados');
    s+=cap('Clique numa barra para ver os pedidos adiados vendidos naquele mês.')+'<div id="cartdin-adiado-det"></div>'; }
  const R=P['cd-previsao'];
  if(R){ const C=R.evol, SP=R.separada;
    /* mesma separação do "Em andamento": o que vira faturamento e o que é showroom (não vira). O acumulado é só do que fatura. */
    const _pvSh=!!SP&&(prSoma(SP.q_show)>0||prSoma(SP.v_show)>0);
    const _pvLeg=(rot,q,v)=>rot+' · '+nf(q,0)+' peças · '+money(v);
    s+=H3('Previsão de faturamento — pedidos em andamento','por data de entrega prevista · área = acumulado'+(_pvSh?' do que fatura':''),'cd-previsao');
    let _pvSer,_pvAc,_pvPartes;
    if(_pvSh){ let ac=0; _pvAc=SP.v_fat.map(x=>(ac+=x));
      _pvSer=[{name:'Vira faturamento',leg:_pvLeg('Vira faturamento',prSoma(SP.q_fat),prSoma(SP.v_fat)),values:SP.v_fat,color:SER[0]},
              {name:'Não vira faturamento (showroom)',leg:_pvLeg('Não vira faturamento (showroom)',prSoma(SP.q_show),prSoma(SP.v_show)),values:SP.v_show,color:'#8e8a84'}];
      _pvPartes=R.pr?[SP.vpr_fat,SP.vpr_show]:null;
    } else { _pvAc=C.acum;
      _pvSer=[{name:'Previsto',leg:SP?_pvLeg('Previsto',prSoma(SP.q_fat)+prSoma(SP.q_show),prSoma(C.valor)):undefined,values:C.valor,color:SER[0]}];
      _pvPartes=R.pr||null; }
    s+='<div id="cartdin-previsao-fig">'+fig(evolCombo(C.yms.map(ymLab),_pvSer,_pvAc,{valfmt:v=>mi(v,1),dashName:_pvSh?'Acumulado do que fatura':'Acumulado',partes:_pvPartes,clicavel:true}),ins('carteiraPicoEntrega','carteira-pico-entrega')||ins('auto','auto-cartdin-entrega'))+'</div>';
    if(R.pr) s+=prCap(prSoma(R.pr[0]),prSoma(C.valor),'da previsão de faturamento');
    s+=cap('Clique numa barra para ver os pedidos daquele mês de entrega.'+(_pvSh?' Pedidos do cliente SHOW ROOM não viram faturamento: aparecem em cinza e ficam fora do acumulado.':''))+'<div id="cartdin-previsao-det"></div>'; }
  const AN=P['cd-andamento'];
  if(AN){
    const _qS=prSoma(AN.q_show), _vS=prSoma(AN.v_show), _qF=prSoma(AN.q_fat), _vF=prSoma(AN.v_fat), _vT=_vF+_vS, _qT=_qF+_qS;
    const _sh=_qS>0||_vS>0;                        // só separa quando há showroom na carteira
    s+=H3('Em andamento — peças e valor por mês de entrega','por data de entrega prevista · barras = peças · linha = valor (eixo dir.)','cd-andamento');
    /* a legenda de cada recorte traz as peças e o valor dele (sempre, com ou sem showroom) */
    const _leg=(rot,q,v)=>rot+' · '+nf(q,0)+' peças · '+money(v);
    const _series=_sh?[{name:'Vira faturamento',leg:_leg('Vira faturamento',_qF,_vF),values:AN.q_fat,color:SER[0]},
                      {name:'Não vira faturamento (showroom)',leg:_leg('Não vira faturamento (showroom)',_qS,_vS),values:AN.q_show,color:'#8e8a84'}]
                     :[{name:'Peças',leg:_leg('Peças',_qT,_vT),values:AN.qtd,color:SER[0]}];
    s+='<div id="cartdin-andamento-fig">'+fig(evolCombo(AN.yms.map(ymLab),_series,_sh?AN.v_fat:AN.valor,
      {valfmt:v=>nf(v,0),acumfmt:v=>mi(v,1),dashName:_sh?'Valor que fatura (R$)':'Valor (R$)',dashArea:false,dashColor:SER[2],dashLabels:true,
       dash2:_sh?{values:AN.v_show,color:'#5d5852',name:'Valor showroom — não fatura (R$)'}:null,
       partes:AN.qtd_pr?(_sh?[AN.qpr_fat,AN.qpr_show]:[AN.qtd_pr]):null,clicavel:true}))+'</div>';
    s+=cap('Peças = soma da quantidade dos itens dos pedidos em andamento, no mês da entrega prevista; a linha tracejada é o valor desses pedidos'+(_sh?' (azul = o que fatura; cinza = showroom, que não fatura)':'')+'. Total: '
      +nf(_qT,0)+' peças · '+mi(_vT,1)+'.'
      +(_sh?' Pedidos do cliente SHOW ROOM não viram faturamento: aparecem em cinza.':'')
      +(AN.qtd_pr&&prSoma(AN.qtd_pr)>0?' Tom mais escuro = parte relacionada (PR): '+nf(prSoma(AN.qtd_pr),0)+' peças ('+pct(prSoma(AN.qtd_pr)/prSoma(AN.qtd),0)+').':'')+' Clique numa barra para ver os pedidos do mês.');
    if(_sh) s+='<div class="kpis k3">'
      +kpi('Vira faturamento',money(_vF),nf(_qF,0)+' peças · '+pct(_vT?_vF/_vT:0,0)+' do valor')
      +kpi('Não vira faturamento (showroom)',money(_vS),nf(_qS,0)+' peças · '+pct(_vT?_vS/_vT:0,0)+' do valor')
      +kpi('Total em andamento',money(_vT),nf(_qT,0)+' peças')+'</div>';
    s+='<div id="cartdin-andamento-det"></div>';
  }
  const V=P['cd-vend'], K=P['cd-peds'];
  if(V||K){
    s+='<div class="two">';
    if(V) s+='<div>'+H3('Carteira por vendedor(a)','','cd-vend')
      +(V.tem?table(['Vendedor(a)','Pendente','Pedidos'].concat(V.pr?['Do qual PR']:[]),V.vend.map(x=>[esc(x[0]),money(x[1]),nf(x[2])].concat(V.pr?[money(V.pr[x[0]]||0)]:[])),['left','right','right'].concat(V.pr?['right']:[]),null,ins('auto','auto-cartdin-vend'))
             :call('Coluna "VENDEDORA" não encontrada nesta geração da planilha.','warn'))+'</div>';
    if(K){ window.PARTES_RELACIONADAS=K.pr||[];
      s+='<div>'+H3('Maiores pedidos em carteira','','cd-peds')
      +table(['Pedido','Cliente','Status','Pendente'],
         K.peds.map(x=>[esc(String(x[0])),esc(trunc(x[1],22))+prTag(x[1]),esc(x[2].join(' + ')),money(x[3])]),
         ['left','left','left','right'],null,ins('concentracao','concentracao-ped-carteira'))+prLegenda()+'</div>'; }
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
/* Gráficos de entrega (previsão de faturamento e em andamento por mês): clicar na barra do mês abre os pedidos daquele mês;
   clicar no pedido abre os itens que entregam no mês (o servidor manda os pedidos; os itens vêm sob demanda). */
/* itens de um pedido abertos logo abaixo da linha dele (agrupamento de linhas); clicar de novo fecha */
function _cdAlternarItens(tr,itens,ncols){
  const prox=tr.nextElementSibling, sin=tr.querySelector('.cdm-sin');
  if(prox&&prox.classList.contains('cdm-itens')){ prox.remove(); tr.classList.remove('sel'); if(sin) sin.textContent='▸'; return; }
  const d=document.createElement('tr'); d.className='cdm-itens';
  d.innerHTML='<td colspan="'+ncols+'">'+table(['Produto','Qtd','Valor','Data venda','Data entrega'],
    itens.map(l=>[esc(l[0]),nf(l[1]),money(l[2]),l[3]||'—',l[4]||'—']),['left','right','right','right','right'])+'</td>';
  tr.after(d); tr.classList.add('sel'); if(sin) sin.textContent='▾';
}

/* SHOW ROOM não vira faturamento (o mesmo teste do Kit: nome do cliente sem acento nem espaço) */
function _cdEhShowroom(c){ return String(c==null?'':c).normalize('NFD').replace(/[^A-Za-z]/g,'').toUpperCase().indexOf('SHOWROOM')>=0; }

function _cdLigarMeses(ctx){
  [['cartdin-previsao-fig','cartdin-previsao-det','cd-previsao',X=>X.evol.yms,{}],
   ['cartdin-andamento-fig','cartdin-andamento-det','cd-andamento',X=>X.yms,{}],
   ['cartdin-adiado-fig','cartdin-adiado-det','cd-adiados',X=>X.evol.yms,{bucket:'ADIADO',col:3,titulo:'Pedidos adiados vendidos em'}]].forEach(([fid,did,bk,fyms,opt])=>{
    const BK=opt.bucket||'ANDAMENTO', COL=opt.col||4, FAT=BK==='ANDAMENTO';
    const X=ctx.payload[bk], fg=document.getElementById(fid); if(!X||!fg||!X.pedidos) return;
    window.PARTES_RELACIONADAS=X.pr_padroes||window.PARTES_RELACIONADAS||[];
    const yms=fyms(X), bars=fg.querySelectorAll('.ec-bar');
    const doMes=(l,ym)=>{ const m=String(l[COL]||'').split('/'); return (+m[2])*100+(+m[1])===ym; };
    function abre(i){
      const ym=yms[i], peds=X.pedidos[String(ym)]||[], box=document.getElementById(did); if(!box) return;
      const tq=peds.reduce((a,p)=>a+p[3],0), tv=peds.reduce((a,p)=>a+p[4],0); let acc=0;
      const vSh=FAT?peds.filter(p=>_cdEhShowroom(p[1])).reduce((a,p)=>a+p[4],0):0;
      const rows=peds.map(p=>{ acc+=p[4];
        return `<tr class="cdm-ped-row" data-p="${esc(String(p[0]))}"><td class="left"><span class="cdm-sin">▸</span> FOCCO-${esc(p[0])}</td><td class="left">${esc(trunc(p[1],30))}${prTag(p[1])}</td>${FAT?`<td class="left">${_cdEhShowroom(p[1])?'Não · showroom':'Sim'}</td>`:''}`
          +`<td class="right">${esc(p[5])}</td><td class="right">${esc(p[6])}</td><td class="right">${nf(p[2])}</td><td class="right">${nf(p[3],0)}</td><td class="right">${money(p[4])}</td>`
          +`<td class="right">${pct(tv?p[4]/tv:0,1)}</td><td class="right">${pct(tv?acc/tv:0,1)}</td></tr>`; }).join('');
      box.innerHTML=H3(opt.titulo?opt.titulo+' '+ymLab(ym):'Pedidos em andamento — '+ymLab(ym), nf(tq,0)+' peças · '+mi(tv,1)+' · '+nf(peds.length)+' pedidos'+(vSh>0?' · fatura '+mi(tv-vSh,1)+' · showroom '+mi(vSh,1):''))
        +`<div class="tw"><table class="dt"><thead><tr><th class="left">Pedido</th><th class="left">Cliente</th>${FAT?'<th class="left">Faturamento</th>':''}<th class="right">Venda</th><th class="right">Entrega prevista</th><th class="right">Itens</th><th class="right">Peças</th>`
        +`<th class="right">Valor</th><th class="right">% do mês</th><th class="right">% acumulada</th></tr></thead><tbody>${rows}</tbody></table></div>`
        +prLegenda()+cap('Clique num pedido para abrir, logo abaixo dele, os itens que entregam neste mês.');
      ctx.marcar();
      if(!ctx.pode('detalhar')) return;
      box.querySelectorAll('.cdm-ped-row').forEach(tr=>{ tr.style.cursor='pointer';
        tr.addEventListener('click',async()=>{
          if(tr.nextElementSibling&&tr.nextElementSibling.classList.contains('cdm-itens')){ _cdAlternarItens(tr,[],FAT?10:9); return; }
          const R=await ctx.detalhe('pedido',{ped:tr.dataset.p,status:BK});
          _cdAlternarItens(tr,R.itens.filter(l=>doMes(l,ym)),FAT?10:9); ctx.marcar(); }); });
    }
    bars.forEach(el=>el.addEventListener('click',()=>{
      const ativa=el.style.stroke!==''; bars.forEach(b=>{b.style.stroke='';b.style.strokeWidth='';});
      const box=document.getElementById(did);
      if(ativa){ if(box) box.innerHTML=''; ctx.marcar(); return; }
      bars.forEach(b=>{ if(b.dataset.i===el.dataset.i){ b.style.stroke=INK; b.style.strokeWidth='2.5'; } }); abre(+el.dataset.i); }));
  });
}

DESENHO_POS.carteira_dinamica=function(sec,ctx){
  _cdLigarMeses(ctx);
  const S=ctx.payload['cd-status']; if(!S) return;
  window.PARTES_RELACIONADAS=S.pr_padroes||window.PARTES_RELACIONADAS||[];
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
       +`<td class="left"><span class="cdm-sin">▸</span> FOCCO-${esc(p[0])}</td><td class="left">${esc(trunc(p[1],30))}${prTag(p[1])}</td>`
       +`<td class="right">${esc(p[4])}</td><td class="right">${esc(p[5])}</td><td class="right">${nf(p[3])}</td><td class="right">${money(p[2])}</td>`
       +`<td class="right">${pct(total?p[2]/total:0,1)}</td><td class="right">${pct(total?acc/total:0,1)}</td></tr>`;}).join('');
    const det=document.getElementById('cartdin-status-detail'); if(!det) return;
    det.innerHTML = H3('Pedidos em carteira — '+bucket, mi(total)+' · '+nf(peds.length)+' pedidos')
      +`<div class="tw"><table class="dt"><thead><tr>
          <th class="left">Pedido</th><th class="left">Cliente</th><th class="right">Venda</th><th class="right">Entrega prevista</th><th class="right">Itens</th>
          <th class="right">Valor</th><th class="right">% do status</th><th class="right">% acumulada</th>
        </tr></thead><tbody>${rows}</tbody></table></div>`
      +'<div class="tw-ins">'+(window.INSRT?INSRT.strip(ins('auto','auto-cartdin-peds-'+bucket)):'')+'</div>'
      +prLegenda()+cap('Clique num pedido para abrir os itens logo abaixo dele.');
    if(!ctx.pode('detalhar')) return;
    det.querySelectorAll('.cartdin-ped-row').forEach(tr=>{ tr.style.cursor='pointer';
      tr.addEventListener('click',async()=>{
        if(tr.nextElementSibling&&tr.nextElementSibling.classList.contains('cdm-itens')){ _cdAlternarItens(tr,[],8); return; }
        const R=await ctx.detalhe('pedido',{ped:tr.dataset.p,status:bucket});
        _cdAlternarItens(tr,R.itens,8); ctx.marcar(); });
    });
  }
  /* a lista de pedidos nasce recolhida: clicar numa barra (ou escolher o status) abre; clicar de novo na mesma barra recolhe */
  function oculta(){
    bars.forEach(b=>{b.style.stroke='';b.style.strokeWidth='';});
    const det=document.getElementById('cartdin-status-detail'); if(det) det.innerHTML='';
  }
  bars.forEach(el=>el.addEventListener('click',()=>{ if(el.style.strokeWidth==='2.5') oculta(); else desenha(+el.dataset.i); ctx.marcar(); }));
  const sel=document.getElementById('cartdin-status-sel');
  if(sel) sel.addEventListener('change',()=>{ desenha(+sel.value); ctx.marcar(); });
};
