/* Análise por período — desenho de buildFilter/renderPeriodo do Kit.
   Presets e "Aplicar" pedem os números ao servidor (ctx.buscar). */
'use strict';
window.DESENHO=window.DESENHO||{};
window.DESENHO_POS=window.DESENHO_POS||{};

function _pePeriodo(A,a,b){ if(a<=200001&&b>=300000)return 'histórico completo ('+ymLabAno(A.minym)+'–'+ymLab(A.maxym)+')';
  if(a===b) return ymLab(a).replace('/','/20'); const Y1=Math.floor(a/100),Y2=Math.floor(b/100);
  if(a%100===1&&b%100===12&&Y1===Y2) return 'ano '+Y1; return ymLab(a)+' – '+ymLab(b);}

function _peCorpo(P){
  let s='';
  const A=P['periodo.abertura'];
  if(A) s+='<div class="kpis k4">'+kpi('Venda contratada',mi(A.total),_pePeriodo(A,A.a,A.b))
    +kpi('Pedidos',nf(A.peds),'')+kpi('Ticket médio',mi(A.ticket),'por pedido')
    +kpi('Quantidade',nf(A.qnt),'itens')+'</div>';
  const CH=P['pe-cart'];
  if(CH){
    s+=H3('Carteira em aberto — posição mês a mês','saldo reconstruído da data do pedido e da NF','pe-cart');
    s+='<div id="cart-hist-chart">'+fig(evolCombo(CH.yms.map(ymLab),[{name:'Carteira em aberto',values:CH.valor,color:SER[0]}],CH.meses,
      {valfmt:v=>mi(v,1),acumfmt:v=>nf(v,1)+'x',dashName:'Meses de carteira',dashArea:false,dashColor:BAD,dashLabels:true,
       leftLine:[{name:'Venda contratada',values:CH.venda,color:'#c9a227'},
                 {name:'Média faturamento 6M',values:CH.fat6m,color:SER[2],cls:'evolcombo-fat6m'}],
       linesHidden:true,w:980,h:320}),ins('carteiraMesesCobertura'))+'</div>';
    s+=cap('Barras = saldo em aberto no fim de cada mês (pedidos sem NF até aquela data — mesmo critério da foto atual de carteira). Linha amarela = venda contratada do mês (mesmo eixo, R$). Linha tracejada vermelha (eixo direito) = carteira ÷ faturamento médio dos últimos 6 meses (Receita Bruta da DRE) — quantas vezes o faturamento a carteira representa naquele mês.');
  }
  const V=P['pe-vend'];
  if(V){
    s+=H3('Desempenho por vendedor(a)','','pe-vend');
    s+=fig(hbar(V.top,{valfmt:v=>mi(v,1),maxbars:10}),ins('auto'));
    s+=table(['Vendedor(a)','Venda','% contrib.','Pedidos','Ticket/pedido','Ticket/item','Custo comissão','% custo'],
      V.linhas.map(x=>[esc(x[0]),money(x[1]),pct(x[2]),nf(x[3]),money(x[4]),money(x[5]),money(x[6]),pct(x[7])]),
      ['left','right','right','right','right','right','right','right'],null,ins('auto'));
  }
  const F=P['pe-cat'];
  if(F){
    s+=H3('Categorias (famílias de produto)','','pe-cat');
    s+=fig(hbar(F.top,{valfmt:v=>mi(v,1),color:SER[2],maxbars:12,pct:true,total:F.total}),ins('auto'));
    s+=cap('Percentuais sobre '+mi(F.total)+' — o total das categorias no período selecionado, já sem Frete/Serviço.'
      +(F.n>12?' O gráfico mostra as 12 maiores das '+F.n+' categorias, por isso o acumulado não fecha 100%.':''));
  }
  const M=P['pe-catvend'];
  if(M){ const md={}; M.linhas.forEach((vn,i)=>{md[vn]={}; M.colunas.forEach((fn,j)=>md[vn][fn]=M.mat[i][j]);});
    s+=H3('Principais categorias por vendedor(a)','R$ mil','pe-catvend');
    s+=fig(heatmap(M.linhas,M.colunas,md,{valfmt:v=>v>1000?nf(v/1000,0):'',padLeft:150,w:900}),ins('mixCruzado'));
  }
  const K=P['pe-canal'];
  if(K){
    s+=H3('Clientes e canal','','pe-canal');
    s+='<div class="two"><div>'+fig(hbar(K.top,{valfmt:v=>mi(v,1),padLeft:210,w:520,maxbars:12}),ins('auto'))+'</div>';
    s+='<div>'+fig(donut(K.canal,{valfmt:v=>mi(v,1)}),ins('auto'))+'</div></div>';
  }
  const T=P['pe-cli'];
  if(T){ const total=T.total; let acum=0;
    const trs=T.linhas.map((x,i)=>{ acum+=x.v;
      const ehCorte=T.corte&&i===T.corte.n-1;
      const cls=['cli-row',ehCorte?'cut':''].filter(Boolean).join(' ');
      return `<tr class="${cls}"><td class="left">${esc(x.name)}</td>`
        +`<td class="right">${money(x.v)}</td>`
        +`<td class="right">${pct(total?x.v/total:0)}</td>`
        +`<td class="right acum">${pct(total?acum/total:0)}</td></tr>`;}).join('');
    s+=H3('Maiores clientes do período',
      T.truncado?(nf(T.n)+' maiores de '+nf(T.n_clis)):
      T.corte?(nf(T.corte.n)+(T.corte.n===1?' cliente':' clientes')+' = 80% da venda'):'','pe-cli');
    s+='<div class="tw"><table class="dt"><thead><tr><th class="left">Cliente</th>'
      +`<th class="right">Venda</th><th class="right">${esc('% do total')}</th><th class="right">% acumulado</th>`
      +`</tr></thead><tbody>${trs}</tbody></table></div>`;
    s+='<div class="tw-ins"></div>';
    s+=cap(T.truncado
      ? 'Os '+nf(T.n)+' maiores clientes do período, que somam '+pct(T.share,1)+' da venda. Chegar a 80% exigiria '
        +nf(T.corte.n)+' clientes dos '+nf(T.n_clis)+' do período — quanto mais longo o período escolhido, mais espalhada fica a venda entre os clientes.'
      : (T.corte&&T.n>T.corte.n?'A linha marcada é onde o acumulado cruza os 80%. ':'')
        +(T.restantes>0?'Outros '+nf(T.restantes)+' clientes compraram no período e somam '+pct(1-T.share,1)+'.':'Todos os clientes do período estão na tabela.'));
  }
  const D=P['pe-desig'];
  if(D){
    s+=H3('Designers — royalties pagos','','pe-desig');
    s+=fig(hbar(D.top,{valfmt:v=>money(v),color:SER[4],padLeft:240,w:760,maxbars:12}),ins('auto'));
    s+=table(['Designer','Royalties pagos','Venda associada','% roy.','Pedidos'],
      D.linhas.map(x=>[esc(x[0]),money(x[1]),money(x[2]),pct(x[3]),nf(x[4])]),['left','right','right','right','right'],null,ins('auto'));
  }
  const R=P['pe-arq'];
  if(R){
    s+=H3('Arquitetos — RT paga','','pe-arq');
    s+=fig(hbar(R.top,{valfmt:v=>money(v),color:SER[6],padLeft:240,w:760,maxbars:12}),ins('auto'));
    s+=table(['Arquiteto / escritório','RT paga','Venda associada','% RT','Pedidos'],
      R.linhas.map(x=>[esc(x[0]),money(x[1]),money(x[2]),pct(x[3]),nf(x[4])]),['left','right','right','right','right'],null,ins('auto'));
  }
  const Q=P['pe-repasses'];
  if(Q){
    s+=H3('Composição de repasses e comissões','','pe-repasses');
    s+=fig(stackbar(Q.comp.map(x=>[x[0],x[1]]),{valfmt:v=>mi(v,1)}),ins('auto'));
    s+=table(['Componente','Valor pago','% das vendas'],Q.comp.map(x=>[esc(x[0]),money(x[1]),pct(x[2]==null?NaN:x[2])]),['left','right','right'],
      ['Total repasses',money(Q.total),pct(Q.pct==null?NaN:Q.pct)],ins('auto'));
  }
  return s;
}

DESENHO.periodo=function(P){
  const A=P['periodo.abertura'];
  let s='';
  if(A){
    const M=A.maxym, AV=A.ano_v;
    const presets=[['Histórico completo',200001,300000],
      ...A.anos_fechados.map(y=>[String(y),y*100+1,y*100+12]),
      ['YTD '+(AV-1)+' ('+ytdLab(M)+')',(AV-1)*100+1,M-100],
      [AV+' YTD ('+ytdLab(M)+')',AV*100+1,M],
      [MES_LONGO[M%100-1]+' '+Math.floor(M/100),M,M]];
    const opts=ymList(A.minym,A.maxym).map(y=>`<option value="${y}">${ymLab(y)}</option>`).join('');
    s+=`<div class="sec-head"><div class="kick">Exploração</div><h2>Análise por período</h2>
      <p class="lead">Selecione um período para recalcular todas as análises abaixo (vendedoras, categorias, clientes, designers, arquitetos e repasses).</p></div>
      <div class="filterbar"><div class="fb-presets">`
      +presets.map(p=>`<button class="preset" data-a="${p[1]}" data-b="${p[2]}">${esc(p[0])}</button>`).join('')
      +`</div><div class="fb-custom">De <select id="f-de">${opts}</select> até <select id="f-ate">${opts}</select>
      <button id="f-apply">Aplicar</button></div><div id="periodo-label" class="fb-label">Período: ${_pePeriodo(A,A.a,A.b)}</div></div>`;
  }
  s+='<div id="periodo-body">'+_peCorpo(P)+'</div>';
  return s;
};

DESENHO_POS.periodo=function(sec,ctx){
  const A=ctx.payload['periodo.abertura']; if(!A) return;
  const f={de:A.a,ate:A.b};
  const de=document.getElementById('f-de'), ate=document.getElementById('f-ate');
  const marca=()=>sec.querySelectorAll('.preset').forEach(el=>el.classList.toggle('on',+el.dataset.a===f.de&&+el.dataset.b===f.ate));
  async function corpo(){
    const P=await ctx.buscar(f);
    document.getElementById('periodo-body').innerHTML=_peCorpo(P);
    document.getElementById('periodo-label').textContent='Período: '+_pePeriodo(A,f.de,f.ate);
    marca(); ctx.remarcar();
  }
  sec.querySelectorAll('.preset').forEach(el=>el.addEventListener('click',()=>{f.de=+el.dataset.a; f.ate=+el.dataset.b;
    de.value=Math.max(A.minym,f.de===200001?A.minym:f.de); ate.value=Math.min(A.maxym,f.ate===300000?A.maxym:f.ate); corpo();}));
  document.getElementById('f-apply').addEventListener('click',()=>{let a=+de.value,b=+ate.value; if(a>b){const t=a;a=b;b=t;} f.de=a; f.ate=b; corpo();});
  de.value=f.de; ate.value=f.ate;
  marca();
};
