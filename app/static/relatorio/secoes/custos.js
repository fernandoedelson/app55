/* Custos — Operacional — desenho de renderCustosBody/renderCompare/drawNZ/drawPC do Kit.
   Período, comparativo, nível zero e evolutivo pedem os números ao servidor; a busca de produto
   trabalha sobre o payload; materiais da categoria e produtos do grupo vêm por detalhamento. */
'use strict';
window.DESENHO=window.DESENHO||{};
window.DESENHO_POS=window.DESENHO_POS||{};
const CU_MAT_CORES={}; ['Metal','Couro','Pedra','Madeira','Tecido','Espuma','Outros materiais'].forEach((c,i)=>CU_MAT_CORES[c]=SER[i%8]);

function _cuPeriodo(A,a,b){
  if(a<=200001&&b>=300000) return 'histórico completo ('+ymLabAno(A.minym)+'–'+ymLabAno(A.maxym)+')';
  if(a===b) return custosMesLab(a).replace('/','/20');
  const Y1=Math.floor(a/100),Y2=Math.floor(b/100);
  if(a%100===1&&b%100===12&&Y1===Y2) return 'ano '+Y1;
  return custosMesLab(a)+' – '+custosMesLab(b);
}

function _cuTopProd(lista,query){
  const top20=lista.slice(0,20), rest=lista.slice(20);
  const tQ=lista.reduce((s,p)=>s+p[2],0),tM=lista.reduce((s,p)=>s+p[3],0),tO=lista.reduce((s,p)=>s+p[4],0),
    tG=lista.reduce((s,p)=>s+p[5],0),tC=lista.reduce((s,p)=>s+p[6],0);
  if(!lista.length) return call('Nenhum produto encontrado para "'+esc(query)+'" no período.','warn');
  const rows=top20.map(p=>[esc(trunc(p[0],50)),esc(p[1]),nf(p[2]),money(p[3]),money(p[4]),money(p[5]),money(p[6]),money(p[2]?p[6]/p[2]:0)]);
  if(rest.length){ const r=rest.reduce((s,p)=>({qtd:s.qtd+p[2],mat:s.mat+p[3],mod:s.mod+p[4],ggf:s.ggf+p[5],custo:s.custo+p[6]}),{qtd:0,mat:0,mod:0,ggf:0,custo:0});
    rows.push(['<b>Demais produtos</b>',`<span class="mut">${nf(rest.length)} itens</span>`,nf(r.qtd),money(r.mat),money(r.mod),money(r.ggf),money(r.custo),money(r.qtd?r.custo/r.qtd:0)]);}
  return '<div class="tbl-fit">'+table(['Produto','Grupo','Qtde produzida','MAT','M.O','GGF','CPP total','CPP/unidade'],rows,
    ['left','left','right','right','right','right','right','right'],
    ['Total',esc(lista.length+' produtos'),nf(tQ),money(tM),money(tO),money(tG),money(tC),money(tQ?tC/tQ:0)])+'</div>';
}

function _cuNZBox(titulo,vol,custoUnit,custoTotal){
  return `<div class="nzbox"><div class="nzhead">${esc(titulo)}</div>
    <div class="nzrow"><b>Vol. Produzido</b><span>${nf(vol,1)}</span></div>
    <div class="nzrow"><b>Custo Unit. (R$/peça)</b><span>${money(custoUnit,2)}</span></div>
    <div class="nzrow"><b>Custo Total (R$)</b><span>${money(custoTotal)}</span></div></div>`;
}

function _cuNZCorpo(N){
  const r=N.r;
  let s='<div class="two">'+_cuNZBox('Período A ('+custosMesLab(N.ymA)+(N.idA?' · ID '+N.idA:'')+')',r.volA,r.custoUnitProdA,r.custoTotalA)
    +_cuNZBox('Período B ('+custosMesLab(N.ymB)+(N.idB?' · ID '+N.idB:'')+')',r.volB,r.custoUnitProdB,r.custoTotalB)+'</div>';
  if(!r.linhas.length){ s+=call('Sem consumo de matéria-prima direta (TP=C) registrado para este produto nos períodos/IDs selecionados.','warn'); return s; }
  s+='<div class="nzwide">'+table(['Material','UM','Qtd Consumida (A)','Qtd Unitária (A)','Custo Unit. (A)','Custo Total (A)',
    'Qtd Consumida (B)','Qtd Unitária (B)','Custo Unit. (B)','Custo Total (B)',
    'Dif. Qtd Unitária','Dif. Custo Unit.','Efeito Mix/Consumo (R$/Un)','Efeito Custo (R$/Un)','Impacto Total (R$/Un)','% Impacto'],
    r.linhas.map(l=>[esc(trunc(l.nm,40)),esc(l.um),nf(l.qA,2),nf(l.qtdUnitA,4),money(l.custoUnitA,2),money(l.custoTotalA),
      nf(l.qB,2),nf(l.qtdUnitB,4),money(l.custoUnitB,2),money(l.custoTotalB),
      nf(l.difQtdUnit,4),money(l.difCustoUnit,2),
      `<span style="color:${l.efeitoMix>=0?BAD:GOOD}">${money(l.efeitoMix,2)}</span>`,
      `<span style="color:${l.efeitoCusto>=0?BAD:GOOD}">${money(l.efeitoCusto,2)}</span>`,
      `<span style="color:${l.impacto>=0?BAD:GOOD};font-weight:700">${money(l.impacto,2)}</span>`,
      pct(l.pctImpacto,1)]),
    ['left','left','right','right','right','right','right','right','right','right','right','right','right','right','right','right'],
    ['Total','','','','',money(r.custoTotalA),'','','',money(r.custoTotalB),'','',
      money(r.linhas.reduce((s2,l)=>s2+l.efeitoMix,0),2),money(r.linhas.reduce((s2,l)=>s2+l.efeitoCusto,0),2),
      money(r.linhas.reduce((s2,l)=>s2+l.impacto,0),2),pct(r.custoUnitProdB?r.linhas.reduce((s2,l)=>s2+l.impacto,0)/r.custoUnitProdB:0,1)])+'</div>';
  s+=cap('Efeito Mix/Consumo (R$/Un) = (Qtd Unit. B − Qtd Unit. A) × Custo Unit. A. Efeito Custo (R$/Un) = (Custo Unit. B − Custo Unit. A) × Qtd Unit. B. Impacto Total (R$/Un) = soma dos dois efeitos, por unidade de produto acabado. % Impacto = Impacto Total (R$/Un) ÷ Custo Unitário (B) do produto.');
  return s;
}

function _cuPCCorpo(E){
  let s=`<p class="cap" style="margin:2px 0 10px">${esc(E.desc||E.cod)}${E.id?' · ID '+esc(E.id):''}</p>`;
  if(!E.tem){ s+=call('Sem consumo de matéria-prima direta (TP=C) registrado para este produto no período/ID selecionado.','warn'); return s; }
  const cores=[SER[3],SER[0],SER[6],SER[2]];
  s+=fig(line(E.ordem.map((ano,i)=>['Custo de '+ano,E.anos[String(ano)],cores[i%cores.length]]),MES,{valfmt:v=>money(v,2),w:980,h:320,legend:true}),
    ins('comparaAnos','compara-anos-pc'));
  const linhas=[];
  E.ordem.forEach(ano=>{
    const vals=E.anos[String(ano)];
    linhas.push(['Custo de '+ano].concat(vals.map(v=>v==null?'—':money(v,2))));
    const varr=vals.map((v,i)=>{ if(v==null||i===0||vals[i-1]==null) return '—'; return spct(vals[i-1]?v/vals[i-1]-1:0); });
    linhas.push(['Variação Mês'].concat(varr.map(v=>v==='—'?v:`<span style="color:${v.startsWith('-')?BAD:GOOD}">${v}</span>`)));
  });
  s+=table([''].concat(MES),linhas,['left'].concat(MES.map(()=>'right')));
  return s;
}

function _cuCorpo(P){
  const A=P['custos.abertura'];
  if(A&&!A.tem) return call('Fontes de custo não encontradas (pasta fontes/custos). Seção não gerada.','warn');
  if(A&&A.vazio) return call('Sem dados de custo no período selecionado.','warn');
  let s='';
  const CP=P['cu-comparativo'];
  if(CP){ const la=_cuPeriodo(A,CP.a[0],CP.a[1]), lb=_cuPeriodo(A,CP.b[0],CP.b[1]);
    const dv=(x,y)=>y?deltaCost(x/y-1):'—';
    const L=CP.linhas;
    s+=H3('Comparativo de períodos','<b>'+esc(la)+'</b> vs '+esc(lb),'cu-comparativo');
    s+=table(['Indicador',la,lb,'Variação'],[
      ['CPP total',money(L[0][0]),money(L[0][1]),dv(L[0][0],L[0][1])],
      ['Volume produzido',nf(Math.round(L[1][0])),nf(Math.round(L[1][1])),L[1][1]?deltaHtml(L[1][0]/L[1][1]-1):'—'],
      ['CPP médio / unidade',money(L[2][0]),money(L[2][1]),dv(L[2][0],L[2][1])],
      ['Matéria-prima (MAT)',money(L[3][0]),money(L[3][1]),dv(L[3][0],L[3][1])],
      ['Mão de obra (M.O)',money(L[4][0]),money(L[4][1]),dv(L[4][0],L[4][1])],
      ['GGF',money(L[5][0]),money(L[5][1]),dv(L[5][0],L[5][1])],
      ['Retrabalho',money(L[6][0]),money(L[6][1]),dv(L[6][0],L[6][1])],
      ['Assistência técnica',money(L[7][0]),money(L[7][1]),dv(L[7][0],L[7][1])],
    ],['left','right','right','right']);
    const MC=P['cu-mp-cat'], GC=P['cu-cpp-grupo'];
    s+='<div class="two">';
    if(MC) s+='<div>'+H3('Matéria-prima por categoria','','cu-mp-cat')
      +table(['Categoria',la,lb,'Var.'],MC.linhas.map(x=>[esc(x[0]),money(x[1]),money(x[2]),dv(x[1],x[2])]),
        ['left','right','right','right'])+'</div>';
    if(GC) s+='<div>'+H3('CPP/unidade por grupo','','cu-cpp-grupo')
      +table(['Grupo',la,lb,'Var.'],GC.linhas.map(x=>[esc(x[0]),money(x[1]),x[2]?money(x[2]):'—',x[2]?dv(x[1],x[2]):'—']),
        ['left','right','right','right'])+'</div>';
    s+='</div>';
    s+=call('Nas linhas de custo, <b>verde = caiu</b> (bom) e <b>vermelho = subiu</b>. Volume usa a convenção inversa. Use "Limpar comparação" no filtro para fechar este bloco.','note');
  }
  const K=P['cu-painel'];
  if(K){
    s+=H3('Painel de indicadores — visão executiva','','cu-painel');
    const kpiCount=9+(K.cc_caro?1:0), kpiRem=kpiCount%4, kpiSpan=kpiRem?4-kpiRem:0;
    const leituraTxt='Leitura rápida: cada R$1 de retrabalho e assistência técnica é custo evitável — some '+mi(K.ret+K.ass)+' ('+pct(K.ret_pct+K.ass_pct,1)+' do custo de produção interno) que não agrega valor ao produto. GGF responde por '+pct(K.custo?K.ggf/K.custo:0,0)+' do CPP — a maior alavanca de eficiência é a absorção de custo fixo fabril por unidade produzida.';
    const leituraHtml=call(leituraTxt,(K.ret_pct+K.ass_pct)>0.04?'warn':'note');
    s+='<div class="kpis">'
     +kpi('CPP Total',mi(K.custo),_cuPeriodo(A,K.a,K.b))
     +kpi('Volume Produzido',nf(Math.round(K.qtd))+' un.','base do CPP (ordens de produção)')
     +kpi('CPP Médio',money(K.qtd?K.custo/K.qtd:0),'CPP total ÷ volume produzido')
     +kpi('Matéria-prima (MAT)',pct(K.custo?K.mat/K.custo:0,0),mi(K.mat)+' do CPP')
     +kpi('Mão de obra (M.O)',pct(K.custo?K.mod/K.custo:0,0),mi(K.mod)+' do CPP')
     +kpi('Gastos Gerais Fabricação',pct(K.custo?K.ggf/K.custo:0,0),mi(K.ggf)+' do CPP')
     +kpi('Custo de retrabalho',mi(K.ret),pct(K.ret_pct,1)+' do custo de produção',K.ret_pct>0.02?'warn':'ok')
     +kpi('Custo de assist. técnica',mi(K.ass),pct(K.ass_pct,1)+' do custo de produção',K.ass_pct>0.03?'warn':'ok')
     +kpi('Horas apontadas (produção)',nf(Math.round(K.horas)),'taxa média '+money(K.taxa)+'/h')
     +(K.cc_caro?kpi('Centro de custo mais caro/h',esc(K.cc_caro[0]),money(K.cc_caro[5])+'/hora','warn'):'')
     +(kpiSpan?leituraHtml.replace('<div class="callout','<div style="grid-column:span '+kpiSpan+';margin:0;height:100%;box-sizing:border-box" class="callout'):'')
     +'</div>';
    if(!kpiSpan) s+=leituraHtml;
  }
  const D=P['cu-desmembrado'];
  if(D){
    s+=H3('Custo de Produção Desmembrado — CPP','matéria-prima, mão de obra e GGF · mensal · volume de produção no eixo','cu-desmembrado');
    if(D.meses.length>=1){
      const w=Math.min(980,Math.max(220,80*D.meses.length+150));
      s+=fig(stackedCols(D.meses.map(m=>custosMesLab(m[0])),[
        {name:'Matéria-prima (MAT)',values:D.meses.map(m=>m[1]),color:SER[0]},
        {name:'Mão de obra (M.O)',values:D.meses.map(m=>m[2]),color:SER[2]},
        {name:'GGF',values:D.meses.map(m=>m[3]),color:SER[1]},
      ],{valfmt:v=>mi(v,1),w:w,subLabels:D.meses.map(m=>nf(m[5])+' un.'),subTitle:'Vol. produção'}),ins('cpvAbsorcao','cpv-absorcao'));
    }
    s+=table(['Componente','Valor total','% do CPP'],[
      ['Matéria-prima (MAT)',money(D.mat),pct(D.custo?D.mat/D.custo:0)],
      ['Mão de obra (M.O)',money(D.mod),pct(D.custo?D.mod/D.custo:0)],
      ['Gastos Gerais de Fabricação (GGF)',money(D.ggf),pct(D.custo?D.ggf/D.custo:0)],
    ],['left','right','right'],['CPP total',money(D.custo),'100,0%'],ins('auto','auto-cpp-componentes'));
  }
  const CO=P['cu-composicao'];
  if(CO){
    s+=H3('Composição do Custo de Produção - CPP','matéria-prima direta · clique numa fatia ou na legenda para abrir o detalhe da categoria','cu-composicao');
    s+=fig(pie3D(CO.materiais,{valfmt:v=>mi(v,1),colorOf:nm=>CU_MAT_CORES[nm]||SER[0]}),ins('auto','auto-cpp-materiais'));
    s+=cap('Considera apenas matéria-prima direta (TP=C). Componentes fabricados internamente (TP=F) ficam de fora — o custo deles (MAT+M.O+GGF) já foi contabilizado na etapa de produção em que foram fabricados, e entrar aqui de novo seria contagem em duplicidade. <b>Clique numa fatia ou na legenda para abrir os principais materiais da categoria.</b>');
    s+='<div id="matdetail"></div>';
  }
  const G=P['cu-grupos'];
  if(G){
    s+=H3('CPP por grupo de produtos','volume e desmembramento · clique numa barra ou numa linha da tabela para abrir os produtos do grupo','cu-grupos');
    s+='<div id="grpchart">'+fig(hbar(G.grupos.map(g=>[g[0],g[5]]),{valfmt:v=>mi(v,1),padLeft:220,w:820,maxbars:12}),ins('auto','auto-cpp-grupos'))+'</div>';
    s+='<div id="grpdetail"></div>';
    const hasTrend=G.meses.length>1;
    s+='<div class="nzwide">'+table(['Grupo de produto','Qtde produzida','MAT','M.O','GGF','CPP total','CPP/unidade'].concat(hasTrend?['Tendência']:[]),
      G.grupos.map(g=>{
        const row=[`<span class="op-grp-cell drillable" data-grp="${esc(g[0])}">${esc(g[0])}</span>`,nf(g[1]),money(g[2]),money(g[3]),money(g[4]),money(g[5]),money(g[1]?g[5]/g[1]:0)];
        if(hasTrend) row.push(spark(G.serie[g[0]]||[],SER[0]));
        return row;
      }),
      ['left','right','right','right','right','right','right'].concat(hasTrend?['right']:[]),
      ['Total',nf(G.total[0]),money(G.total[1]),money(G.total[2]),money(G.total[3]),money(G.total[4]),money(G.total[0]?G.total[4]/G.total[0]:0)].concat(hasTrend?['']:[]),
      ins('auto','auto-cpp-grupos-tab'))+'</div>';
  }
  const R=P['cu-ranking'];
  if(R){
    s+='<div id="topprod-section" class="hidden-section">';
    s+='<div class="sec-head-flex">'+H3('Ranking de produtos produzidos - CPP','curva 80/20 · até 20 produtos · use a busca para achar qualquer produto da base','cu-ranking')
      +'<button id="topprod-close" type="button" class="dr-close">Fechar &#10005;</button></div>';
    s+=`<div class="searchbar"><input id="prodsearch" type="search" placeholder="Buscar produto na base completa (${nf(R.produtos.length)} itens)…" autocomplete="off"></div>`;
    s+='<div id="topprod">'+_cuTopProd(R.produtos,'')+'</div>';
    s+='<div class="tw-ins">'+(window.INSRT?INSRT.strip(ins('auto','auto-cpp-produtos')):'')+'</div>';
    s+=cap('Ranking por CPP total no período selecionado, limitado aos 20 produtos de maior custo. "Demais produtos" agrupa o restante da base para fechar com o total geral — juntos, Top 20 + Demais produtos somam o mesmo total da tabela por grupo acima.');
    s+='</div>';
  }
  const V=P['cu-volume'];
  if(V){
    s+=H3('Volume de produção por grupo de produto','mensal · evolutivo','cu-volume');
    if(V.meses.length>1){
      const lbl=V.meses.map(custosMesLab);
      const hdata={}; V.grupos.forEach((g,i)=>{ hdata[g]={}; lbl.forEach((m,j)=>hdata[g][m]=V.mat[i][j]); });
      s+=fig(heatmap(V.grupos,lbl,hdata,{valfmt:v=>v?nf(v,0):'',padLeft:190,w:900}),ins('mixCruzado','mix-cruzado-cpp-vol-mes'));
      s+=fig(line([['Volume total',V.total,SER[0]]],lbl,{valfmt:v=>nf(v,0),w:960,h:260}),ins('serieOscilacao','serie-oscilacao-cpp-volume'));
      s+='<div class="nzwide">'+table(['Grupo de produto'].concat(lbl,['Total']),
        V.grupos.map((g,i)=>[esc(g)].concat(V.mat[i].map(v=>nf(v)),[nf(V.mat[i].reduce((s2,v)=>s2+v,0))])),
        ['left'].concat(lbl.map(()=>'right'),['right']),
        ['Total'].concat(V.total.map(v=>nf(v)),[nf(V.total.reduce((s2,v)=>s2+v,0))]),ins('auto','auto-cpp-vol-tab'))+'</div>';
    } else { s+=cap('Selecione um período com mais de um mês para ver a evolutiva mensal.'); }
  }
  const OP=P['cu-operacionais'];
  if(OP){ const tot=OP.produtivo+OP.apoio;
    s+=H3('Custos operacionais — Apoio × Produtivo','Razão contábil por centro de custo','cu-operacionais');
    s+='<div class="kpis k3">'
      +kpi('Produtivo',mi(OP.produtivo),pct(tot?OP.produtivo/tot:0,0)+' do total')
      +kpi('Apoio / Auxiliar',mi(OP.apoio),pct(tot?OP.apoio/tot:0,0)+' do total')
      +kpi('Total (Produtivo + Apoio)',mi(tot),'')+'</div>';
  }
  const PR=P['cu-produtivo'], AP=P['cu-apoio'];
  if(PR||AP){
    s+='<div class="two">';
    if(PR) s+='<div>'+H3('Produtivo — por tipo de conta','','cu-produtivo')
      +fig(hbar(PR.itens,{valfmt:v=>mi(v,1),color:SER[2],padLeft:190,w:520,maxbars:8}),ins('auto','auto-cpp-produtivo'))+'</div>';
    if(AP) s+='<div>'+H3('Apoio / Auxiliar — por tipo de conta','','cu-apoio')
      +fig(hbar(AP.itens,{valfmt:v=>mi(v,1),color:SER[3],padLeft:190,w:520,maxbars:8}),ins('auto','auto-cpp-apoio'))+'</div>';
    s+='</div>';
    s+=cap('Classificação por centro de custo (Produtivo = fábrica; Apoio/Auxiliar = administrativo, comercial, suporte). "Produtivo" é a base de absorção de custo no CPP; "Apoio" fica fora do CPP, tratado como despesa operacional.');
  }
  const CT=P['cu-absorcao-conta'];
  if(CT){
    s+=H3('Absorção de custo por tipo de conta','Produtivo × Apoio / Auxiliar','cu-absorcao-conta');
    s+=table(['Tipo de conta','Produtivo (R$)','% Produtivo','Apoio/Auxiliar (R$)','% Apoio'],
      CT.linhas.map(x=>[esc(x[0]),money(x[1]),pct(CT.produtivo?x[1]/CT.produtivo:0),money(x[2]),pct(CT.apoio?x[2]/CT.apoio:0)]),
      ['left','right','right','right','right'],
      ['Total',money(CT.produtivo),'100,0%',money(CT.apoio),'100,0%'],ins('auto','auto-cpp-conta'));
  }
  if(P['cu-absorcao-cc']) s+=H3('Absorção por centro de custo','MOD · GGF · horas · R$/hora','cu-absorcao-cc');
  const CCT=P['cu-cc-total'], CCX=P['cu-cc-taxa'];
  if(CCT||CCX){
    s+='<div class="two">';
    if(CCT) s+='<div>'+H3('Custo total absorvido','','cu-cc-total')+fig(hbar(CCT.cc,{valfmt:v=>mi(v,1),color:SER[0],padLeft:170,w:520}),ins('auto','auto-cpp-cc'))+'</div>';
    if(CCX) s+='<div>'+H3('Taxa hora (R$/h)','','cu-cc-taxa')+fig(hbar(CCX.taxa,{valfmt:v=>money(v),color:SER[6],padLeft:170,w:520}),ins('auto','auto-cpp-taxa'))+'</div>';
    s+='</div>';
  }
  if(CCX){
    s+=table(['Centro de custo','MOD','GGF','Custo total','Horas apontadas','R$/hora'],
      CCX.cc.map(x=>[esc(x[0]),money(x[1]),money(x[2]),money(x[3]),nf(Math.round(x[4])),x[5]?money(x[5]):'—']),
      ['left','right','right','right','right','right'],
      ['Total',money(CCX.mod),money(CCX.ggf),money(CCX.custo),nf(Math.round(CCX.horas)),money(CCX.taxa_total)],
      ins('taxaHoraCC','taxa-hora-cc-cpp-tab')||ins('auto','auto-cpp-cc-tab'));
    s+=cap('Horas apontadas via NDPRO359 (centros de trabalho reagrupados nos 8 centros de custo produtivos); coluna original vem em minutos e foi convertida para horas. Taxa hora = custo total absorvido ÷ horas apontadas no período.');
  }
  const RT=P['cu-retrabalho'];
  if(RT){
    s+=H3('Custo de retrabalho','evolução mensal · operações "RET"','cu-retrabalho');
    s+='<div class="kpis k3">'+kpi('Retrabalho total',mi(RT.total),_cuPeriodo(A,RT.a,RT.b)+(RT.ytd!=null?' · YTD '+RT.ano+': '+mi(RT.ytd):''))
      +kpi('% do custo de produção',pct(RT.pct,2),'vs. custo total absorvido',RT.pct>0.02?'warn':'ok')
      +kpi('Item mais afetado',RT.top?esc(RT.top[0]):'—',RT.top?money(RT.top[2]):'')+'</div>';
    if(RT.mensal.length>1) s+=fig(line([['Custo de retrabalho',RT.mensal.map(m=>m[1]),BAD]],RT.mensal.map(m=>custosMesLab(m[0])),{valfmt:v=>money(v),w:960,h:280}),ins('custoEvitavel','custo-evitavel'));
  }
  const PT=P['cu-retrabalho-pareto'];
  if(PT){
    s+=H3('Pareto de retrabalho por centro de custo','onde se concentra o custo evitável','cu-retrabalho-pareto');
    s+=fig(pareto(PT.pareto.map(x=>[trunc(x[0],22),x[1]]),{valfmt:v=>money(v,0),w:900,h:300}),ins('auto','auto-cpp-retrabalho'));
    s+=cap('A linha tracejada acumula a participação: os primeiros centros de custo concentram a maior parte do retrabalho — ponto de partida para o plano de ação da fábrica.');
  }
  if(RT) s+=table(['Centro de custo','Produto retrabalhado','Custo de retrabalho','% do retrabalho total'],
    RT.por_item.map(x=>[esc(x[0]),esc(trunc(x[1],48)),money(x[2]),pct(RT.total?x[2]/RT.total:0)]),['left','left','right','right'],null,ins('auto','auto-retrab-item'));
  const AS=P['cu-assistencia'];
  if(AS){
    s+=H3('Custo de assistência técnica','evolução mensal · por produto','cu-assistencia');
    s+='<div class="kpis k2">'+kpi('Assist. técnica total',mi(AS.total),_cuPeriodo(A,AS.a,AS.b)+(AS.ytd!=null?' · YTD '+AS.ano+': '+mi(AS.ytd):''))
      +kpi('% do custo de produção',pct(AS.pct,2),'vs. custo total absorvido',AS.pct>0.03?'warn':'ok')+'</div>';
    if(AS.mensal.length>1) s+=fig(line([['Custo de assistência técnica',AS.mensal.map(m=>m[1]),WARN]],AS.mensal.map(m=>custosMesLab(m[0])),{valfmt:v=>money(v),w:960,h:280}),ins('serieOscilacao','serie-oscilacao-assist'));
  }
  const ASP=P['cu-assistencia-prod'];
  if(ASP){
    s+=H3('Maiores custos de assistência técnica por produto','','cu-assistencia-prod');
    s+=table(['Produto','Custo de assistência técnica'],ASP.produtos.map(x=>[esc(trunc(x[0],60)),money(x[1])]),['left','right'],null,ins('auto','auto-assist-prod'));
  }
  const N=P['cu-nivelzero'];
  if(N){
    s+=H3('Abertura de Custo — Nível Zero','matéria-prima direta por produto acabado · comparativo A × B','cu-nivelzero');
    s+=cap('Explosão de custo ao nível zero: matéria-prima direta (TP=C) consumida nas ordens de produção do item selecionado. Componentes fabricados internamente (TP=F) não entram aqui — já são custo de uma etapa de produção anterior. Escolha o produto acabado e dois períodos para comparar.');
    if(N.ausente) s+=call('Sem dados de nível zero disponíveis.','warn');
    else {
      const codOpts=N.produtos.map(p=>`<option value="${esc(p[0])}"${p[0]===N.cod?' selected':''}>${esc(p[0])}</option>`).join('');
      const descOpts=N.produtos_desc.map(p=>`<option value="${esc(p[1])}">`).join('');
      const opts=ymList(N.minym,N.maxym).map(y=>`<option value="${y}">${ymLab(y)}</option>`).join('');
      const ids=(lista,sel)=>'<option value="">Todos</option>'+lista.map(i=>`<option value="${esc(i)}"${i===sel?' selected':''}>${esc(i)}</option>`).join('');
      s+=`<div class="nz-fb">
    <div class="nzf">Código do produto acabado<select id="nz-cod">${codOpts}</select></div>
    <div class="nzf">Descrição do produto acabado<input id="nz-desc" list="nz-desc-list" autocomplete="off" placeholder="Digite para buscar..." value="${esc(N.desc||'')}">
      <datalist id="nz-desc-list">${descOpts}</datalist></div>
    <div class="nzf">Período A (base)<select id="nz-a">${opts}</select></div>
    <div class="nzf">ID (ordem) — período A<select id="nz-ida">${ids(N.idsA,N.idA)}</select></div>
    <div class="nzf">Período B (comparado)<select id="nz-b">${opts}</select></div>
    <div class="nzf">ID (ordem) — período B<select id="nz-idb">${ids(N.idsB,N.idB)}</select></div>
    <button id="nz-apply">Comparar</button></div>`;
      s+='<div id="nz-body">'+_cuNZCorpo(N)+'</div>';
    }
  }
  const E=P['cu-evolutivo'];
  if(E){
    s+=H3('Evolutivo Custo de Produção — Prod. Acab. (R$/Un.)','matéria-prima direta · evolução mensal por ano','cu-evolutivo');
    s+=cap('Custo unitário de matéria-prima direta (TP=C) por unidade de produto acabado, mês a mês. Quando não há produção no mês, repete o custo do último mês com dado disponível (sem quedas artificiais a zero).');
    if(E.ausente) s+=call('Sem dados disponíveis.','warn');
    else {
      const codOpts=E.produtos.map(p=>`<option value="${esc(p[0])}"${p[0]===E.cod?' selected':''}>${esc(p[0])}</option>`).join('');
      const descOpts=E.produtos_desc.map(p=>`<option value="${esc(p[1])}">`).join('');
      const opts=ymList(E.minym,E.maxym).map(y=>`<option value="${y}">${ymLab(y)}</option>`).join('');
      s+=`<div class="nz-fb">
    <div class="nzf">Código do produto acabado<select id="pc-cod">${codOpts}</select></div>
    <div class="nzf">Descrição do produto acabado<input id="pc-desc" list="pc-desc-list" autocomplete="off" placeholder="Digite para buscar..." value="${esc(E.desc||'')}">
      <datalist id="pc-desc-list">${descOpts}</datalist></div>
    <div class="nzf">ID do produto acabado (ordens)<select id="pc-id">`
      +'<option value="">Todos</option>'+E.ids.map(i=>`<option value="${esc(i)}"${i===E.id?' selected':''}>${esc(i)}</option>`).join('')
      +`</select></div>
    <div class="nzf">Período — de<select id="pc-de">${opts}</select></div>
    <div class="nzf">até<select id="pc-ate">${opts}</select></div>
    <button id="pc-apply">Atualizar</button></div>`;
      s+='<div id="pc-body">'+_cuPCCorpo(E)+'</div>';
    }
    s+=call('Assunções de cálculo: (1) Composição de materiais aproximada por palavra-chave na descrição técnica — itens sem palavra-chave reconhecida entram em "Outros materiais"; (2) mapeamento dos centros de trabalho do NDPRO359 para os 8 centros de custo produtivos é uma correspondência aproximada (ex.: Preparar Madeira → Marcenaria, Costura/Couro → Tapeçaria); (3) "Absorção (+CPP) por tipo de conta" considera todo custo classificado como Produtivo na Razão CC; "Custos operacionais" mostra apenas Produtivo e Apoio/Auxiliar (CPP pós-venda e Reforma de galpão ficam fora); (4) Matéria-prima, MOD/GGF por centro de custo e por tipo de conta são escalados proporcionalmente para fechar com o CPP Total do Painel de Indicadores. Ajustes finos devem ser validados com a controladoria.','note');
  }
  return s;
}

DESENHO.custos=function(P){
  const A=P['custos.abertura'];
  let s='';
  if(A){
    s+=`<div class="sec-head"><div class="kick">Fábrica · +55 Fábrica</div><h2>Custo de Produção - CPP</h2>
      <p class="lead">Custo de produção (CPP) desmembrado em Matéria-prima, Mão de obra e Gastos Gerais de Fabricação, absorção por centro de custo, retrabalho e assistência técnica — apurados a partir das ordens de fabricação do ERP fabril (Valorização_Ordens, NDVAL666 e NDPRO359), pelo volume produzido no período.</p></div>`;
    if(A.tem&&A.presets){
      const presets=A.presets.map(p=>[p[0]===null?A.ano+' ('+ytdLab(A.maxym||101)+')':p[0],p[1],p[2]]);
      const opts=ymList(A.minym,A.maxym).map(y=>`<option value="${y}">${ymLab(y)}</option>`).join('');
      s+='<div class="filterbar"><div class="fb-presets">'
        +presets.map(p=>`<button class="custpreset" data-a="${p[1]}" data-b="${p[2]}">${esc(p[0])}</button>`).join('')
        +`</div><div class="fb-custom">De <select id="cu-de">${opts}</select> até <select id="cu-ate">${opts}</select>
      <button id="cu-apply">Aplicar</button></div>
      <div class="fb-custom">Comparar com: <select id="cb-de">${opts}</select> até <select id="cb-ate">${opts}</select>
      <button id="cb-apply">Comparar</button> <button id="cb-clear"${A.cb?'':' style="display:none"'}>Limpar comparação</button></div>
      <div id="custos-label" class="fb-label">Período: ${_cuPeriodo(A,A.a,A.b)}</div></div>`;
    }
  }
  s+='<div id="custos-body">'+_cuCorpo(P)+'</div>';
  return s;
};

DESENHO_POS.custos=function(sec,ctx){
  const A=ctx.payload['custos.abertura']||{};
  const N0=ctx.payload['cu-nivelzero']||{}, E0=ctx.payload['cu-evolutivo']||{};
  const f={de:A.a,ate:A.b};
  if(A.cb){ f.cbde=A.cb[0]; f.cbate=A.cb[1]; }
  if(N0.cod){ f.nzcod=N0.cod; f.nza=N0.ymA; f.nzb=N0.ymB; f.nzida=N0.idA; f.nzidb=N0.idB; }
  if(E0.cod){ f.pccod=E0.cod; f.pcde=E0.de; f.pcate=E0.ate; f.pcid=E0.id; }
  let matSel=null, grpSel=null;
  const params=()=>{ const p={}; Object.keys(f).forEach(k=>{ if(f[k]!=null&&f[k]!=='') p[k]=f[k]; }); return p; };
  const marca=()=>sec.querySelectorAll('.custpreset').forEach(el=>el.classList.toggle('on',+el.dataset.a===f.de&&+el.dataset.b===f.ate));
  async function corpo(){
    matSel=null; grpSel=null;
    const P=await ctx.buscar(params());
    ctx.payload=P;
    document.getElementById('custos-body').innerHTML=_cuCorpo(P);
    const lb=document.getElementById('custos-label'); if(lb) lb.textContent='Período: '+_cuPeriodo(A,f.de,f.ate);
    const cbc=document.getElementById('cb-clear'); if(cbc) cbc.style.display=f.cbde?'':'none';
    marca(); ligar(); ctx.remarcar();
  }
  async function trocaNZ(){
    const P=await ctx.buscar(params());
    ctx.payload=P;
    const N=P['cu-nivelzero']; if(!N||N.ausente) return;
    f.nzida=N.idA; f.nzidb=N.idB;
    const ida=document.getElementById('nz-ida'), idb=document.getElementById('nz-idb');
    const opts=(lista,sel)=>'<option value="">Todos</option>'+lista.map(i=>`<option value="${esc(i)}"${i===sel?' selected':''}>${esc(i)}</option>`).join('');
    if(ida) ida.innerHTML=opts(N.idsA,N.idA);
    if(idb) idb.innerHTML=opts(N.idsB,N.idB);
    const desc=document.getElementById('nz-desc'); if(desc) desc.value=N.desc||'';
    document.getElementById('nz-body').innerHTML=_cuNZCorpo(N);
    ctx.remarcar();
  }
  async function trocaPC(){
    const P=await ctx.buscar(params());
    ctx.payload=P;
    const E=P['cu-evolutivo']; if(!E||E.ausente) return;
    f.pcid=E.id;
    const idsel=document.getElementById('pc-id');
    if(idsel) idsel.innerHTML='<option value="">Todos</option>'+E.ids.map(i=>`<option value="${esc(i)}"${i===E.id?' selected':''}>${esc(i)}</option>`).join('');
    const desc=document.getElementById('pc-desc'); if(desc) desc.value=E.desc||'';
    document.getElementById('pc-body').innerHTML=_cuPCCorpo(E);
    ctx.remarcar();
  }
  async function matDetalhe(cat){
    const box=document.getElementById('matdetail'); if(!box) return;
    if(matSel===cat){ matSel=null; box.innerHTML=''; return; }
    matSel=cat;
    const R=await ctx.detalhe('material',Object.assign({cat},params()));
    const col=CU_MAT_CORES[cat]||SER[0];
    let inner='';
    if(R.yms.length>1) inner+=fig(line([[cat,R.serie,col]],R.yms.map(custosMesLab),{valfmt:v=>mi(v,1),w:880,h:230}));
    const rows=R.linhas.map(x=>{const cu=x[2]?x[3]/x[2]:0; const u=x[1]||'un.';
      return [esc(x[0]),esc(u),nf(x[2],2),money(x[3]),money(cu,2),pct(R.total?x[3]/R.total:0,1)];});
    if(R.resto[0]) rows.push([`<b>Demais materiais</b> <span class="mut">(${nf(R.resto[0])} itens)</span>`,'','',money(R.resto[1]),'',pct(R.total?R.resto[1]/R.total:0,1)]);
    inner+='<div class="nzwide">'+table(['Material','UM','Qtde','Custo','Custo/UM','% da categoria'],rows,
      ['left','left','right','right','right','right'],['Total','','',money(R.total),'','100,0%'])+'</div>';
    box.innerHTML=`<div class="drill" style="border-top-color:${col}">
    <div class="dr-head"><div><div class="dr-kick">Detalhe da matéria-prima</div><h4>${esc(cat)}</h4>
    <span class="dr-sub">${money(R.total)} &middot; ${nf(R.n)} materiais &middot; ${esc(_cuPeriodo(A,R.a,R.b))}</span></div>`
      +`<button class="dr-close" type="button" data-for="matdetail">Fechar &#10005;</button></div>${inner}</div>`;
    const b=box.querySelector('.dr-close'); if(b) b.addEventListener('click',()=>{matSel=null; box.innerHTML='';});
    ctx.remarcar();
    box.scrollIntoView({behavior:'smooth',block:'nearest'});
  }
  async function grpDetalhe(grp){
    const box=document.getElementById('grpdetail'); if(!box) return;
    if(grpSel===grp){ grpSel=null; box.innerHTML=''; return; }
    grpSel=grp;
    const R=await ctx.detalhe('grupo',Object.assign({grp},params()));
    let inner='';
    if(R.yms.length>1) inner+=fig(line([['CPP '+grp,R.serie,SER[0]]],R.yms.map(custosMesLab),{valfmt:v=>mi(v,1),w:880,h:230}));
    const rows=R.linhas.map(p=>[esc(trunc(p[0],60)),nf(p[1]),money(p[2]),money(p[3]),money(p[4]),money(p[5]),money(p[1]?p[5]/p[1]:0)]);
    if(R.resto[0]) rows.push([`<b>Demais produtos</b> <span class="mut">(${nf(R.resto[0])} itens)</span>`,nf(R.resto[1]),money(R.resto[2]),money(R.resto[3]),money(R.resto[4]),money(R.resto[5]),money(R.resto[1]?R.resto[5]/R.resto[1]:0)]);
    inner+='<div class="nzwide">'+table(['Produto','Qtde','MAT','M.O','GGF','CPP total','CPP/un.'],rows,
      ['left','right','right','right','right','right','right'],
      ['Total',nf(R.qtd),'','','',money(R.total),money(R.qtd?R.total/R.qtd:0)])+'</div>';
    box.innerHTML=`<div class="drill" style="border-top-color:${SER[0]}">
    <div class="dr-head"><div><div class="dr-kick">Detalhe do grupo de produtos</div><h4>${esc(grp)}</h4>
    <span class="dr-sub">${money(R.total)} &middot; ${nf(R.n)} produtos &middot; ${esc(_cuPeriodo(A,R.a,R.b))}</span></div>`
      +`<button class="dr-close" type="button" data-for="grpdetail">Fechar &#10005;</button></div>${inner}</div>`;
    const b=box.querySelector('.dr-close'); if(b) b.addEventListener('click',()=>{grpSel=null; box.innerHTML='';});
    ctx.remarcar();
    box.scrollIntoView({behavior:'smooth',block:'nearest'});
  }
  function ligar(){
    const de=document.getElementById('cu-de'), ate=document.getElementById('cu-ate');
    if(de) de.value=Math.max(A.minym,f.de===200001?A.minym:f.de);
    if(ate) ate.value=Math.min(A.maxym,f.ate===300000?A.maxym:f.ate);
    const cbde=document.getElementById('cb-de'), cbate=document.getElementById('cb-ate');
    if(cbde) cbde.value=f.cbde||A.minym;
    if(cbate) cbate.value=f.cbate||Math.min(A.minym+5,A.maxym);
    const nza=document.getElementById('nz-a'), nzb=document.getElementById('nz-b');
    if(nza) nza.value=f.nza; if(nzb) nzb.value=f.nzb;
    const pcde=document.getElementById('pc-de'), pcate=document.getElementById('pc-ate');
    if(pcde) pcde.value=f.pcde; if(pcate) pcate.value=f.pcate;
    const inp=document.getElementById('prodsearch');
    if(inp){ let tmr=null;
      inp.addEventListener('input',()=>{ clearTimeout(tmr); tmr=setTimeout(()=>{
        const R=ctx.payload['cu-ranking']; if(!R) return;
        const q=inp.value.trim().toLowerCase();
        const lista=q?R.produtos.filter(p=>p[0].toLowerCase().includes(q)||p[1].toLowerCase().includes(q)):R.produtos;
        const box=document.getElementById('topprod'); if(box) box.innerHTML=_cuTopProd(lista,q);
        ctx.remarcar();
      },220); }); }
    sec.querySelectorAll('.piewrap [data-cat], #cx-mat-pie [data-cat]').forEach(el=>el.classList.add('drillable'));
    sec.querySelectorAll('#grpchart rect[data-lab]').forEach(el=>{
      el.classList.add('drillable');
      if(ctx.pode('detalhar')) el.addEventListener('click',()=>grpDetalhe(el.dataset.lab));
    });
  }
  sec.addEventListener('click',ev=>{
    const preset=ev.target.closest('.custpreset');
    if(preset){ f.de=+preset.dataset.a; f.ate=+preset.dataset.b; corpo(); return; }
    if(ev.target.closest('#cu-apply')){
      let a=+document.getElementById('cu-de').value, b=+document.getElementById('cu-ate').value;
      if(a>b){const t=a;a=b;b=t;} f.de=a; f.ate=b; corpo(); return; }
    if(ev.target.closest('#cb-apply')){
      let a=+document.getElementById('cb-de').value, b=+document.getElementById('cb-ate').value;
      if(a>b){const t=a;a=b;b=t;} f.cbde=a; f.cbate=b; corpo(); return; }
    if(ev.target.closest('#cb-clear')){ delete f.cbde; delete f.cbate; corpo(); return; }
    if(ev.target.closest('#nz-apply')){ trocaNZ(); return; }
    if(ev.target.closest('#pc-apply')){ trocaPC(); return; }
    if(ev.target.closest('#topprod-close')){
      const s2=document.getElementById('topprod-section'); if(s2) s2.classList.add('hidden-section'); return; }
    const matCel=ev.target.closest('.piewrap [data-cat]');
    if(matCel&&ctx.pode('detalhar')){ matDetalhe(matCel.dataset.cat); return; }
    const grpCel=ev.target.closest('.op-grp-cell');
    if(grpCel){
      const s2=document.getElementById('topprod-section'); if(!s2) return;
      s2.classList.remove('hidden-section');
      const inp=document.getElementById('prodsearch');
      if(inp){ inp.value=grpCel.dataset.grp; inp.dispatchEvent(new Event('input')); }
      s2.scrollIntoView({behavior:'smooth',block:'start'});
    }
  });
  sec.addEventListener('change',ev=>{
    const t=ev.target;
    if(t.id==='nz-cod'){ f.nzcod=t.value; f.nzida=''; f.nzidb=''; trocaNZ(); return; }
    if(t.id==='nz-desc'){ const N=ctx.payload['cu-nivelzero']||{};
      const pr=(N.produtos||[]).find(p=>p[1]===t.value);
      if(pr){ f.nzcod=pr[0]; const sel=document.getElementById('nz-cod'); if(sel) sel.value=pr[0]; f.nzida=''; f.nzidb=''; trocaNZ(); } return; }
    if(t.id==='nz-a'){ f.nza=+t.value; f.nzida=''; trocaNZ(); return; }
    if(t.id==='nz-b'){ f.nzb=+t.value; f.nzidb=''; trocaNZ(); return; }
    if(t.id==='nz-ida'){ f.nzida=t.value; trocaNZ(); return; }
    if(t.id==='nz-idb'){ f.nzidb=t.value; trocaNZ(); return; }
    if(t.id==='pc-cod'){ f.pccod=t.value; f.pcid=''; trocaPC(); return; }
    if(t.id==='pc-desc'){ const E=ctx.payload['cu-evolutivo']||{};
      const pr=(E.produtos||[]).find(p=>p[1]===t.value);
      if(pr){ f.pccod=pr[0]; const sel=document.getElementById('pc-cod'); if(sel) sel.value=pr[0]; f.pcid=''; trocaPC(); } return; }
    if(t.id==='pc-id'){ f.pcid=t.value; trocaPC(); return; }
  });
  marca(); ligar();
};
