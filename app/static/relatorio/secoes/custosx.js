/* Custos — Visão executiva — desenho de renderCustosX/renderCxGrpTable/renderCxgDrivers do Kit.
   Período e comparativo A×B pedem os números ao servidor; a busca de produto e o desagrupar da
   tabela por grupo trabalham sobre o payload; materiais da categoria e produtos de um driver vêm
   por detalhamento. */
'use strict';
window.DESENHO=window.DESENHO||{};
window.DESENHO_POS=window.DESENHO_POS||{};
const CX_MAT_CORES={}; ['Metal','Couro','Pedra','Madeira','Tecido','Espuma','Outros materiais'].forEach((c,i)=>CX_MAT_CORES[c]=SER[i%8]);
const CX_DMONEY=v=>`<span style="color:${v<=0?GOOD:BAD};font-weight:600">${v>0?'+':''}${money(v)}</span>`;
let CX_EXPANDIDO=false;

function _cxPeriodo(A,a,b){
  if(a<=200001&&b>=300000) return 'histórico completo ('+ymLabAno(A.minym)+'–'+ymLabAno(A.maxym)+')';
  if(a===b) return custosMesLab(a).replace('/','/20');
  const Y1=Math.floor(a/100),Y2=Math.floor(b/100);
  if(a%100===1&&b%100===12&&Y1===Y2) return 'ano '+Y1;
  return custosMesLab(a)+' – '+custosMesLab(b);
}

function _cxTopProd(lista,query){
  const top20=lista.slice(0,20), rest=lista.slice(20);
  const tQ=lista.reduce((s,p)=>s+p[2],0),tM=lista.reduce((s,p)=>s+p[3],0),tO=lista.reduce((s,p)=>s+p[4],0),
    tG=lista.reduce((s,p)=>s+p[5],0),tC=lista.reduce((s,p)=>s+p[6],0);
  if(!lista.length) return call('Nenhum produto encontrado para "'+esc(query)+'" no período.','warn');
  const rows=top20.map(p=>[esc(trunc(p[0],50)),esc(p[1]),nf(p[2]),money(p[3]),money(p[4]),money(p[5]),money(p[6]),money(p[2]?p[6]/p[2]:0)]);
  if(rest.length){ const r=rest.reduce((s,p)=>({qtd:s.qtd+p[2],mat:s.mat+p[3],mod:s.mod+p[4],ggf:s.ggf+p[5],custo:s.custo+p[6]}),{qtd:0,mat:0,mod:0,ggf:0,custo:0});
    rows.push(['<b>Demais produtos</b>',`<span class="mut">${nf(rest.length)} itens</span>`,nf(r.qtd),money(r.mat),money(r.mod),money(r.ggf),money(r.custo),money(r.qtd?r.custo/r.qtd:0)]);}
  return '<div class="tbl-fit">'+table(['Produto','Grupo','Qtde vendida','MAT','M.O','GGF','CPV total','CPV/unidade'],rows,
    ['left','left','right','right','right','right','right','right'],
    ['Total',esc(lista.length+' produtos'),nf(tQ),money(tM),money(tO),money(tG),money(tC),money(tQ?tC/tQ:0)])+'</div>';
}

function _cxGrpTabela(G){
  const labB=_cxPeriodo(G,G.cxb,G.cxb)+' (B)', labA=_cxPeriodo(G,G.cxa,G.cxa)+' (A)';
  const prevMap={}; G.a.forEach(g=>prevMap[g[0]]={qtd:g[1],mat:g[2],mod:g[3],ggf:g[4],custo:g[5]});
  const dQ=(cur,old)=>old?deltaHtml(cur/old-1):'—';
  const dC2=(cur,old)=>old?deltaCost(cur/old-1):'—';
  const metricas=['Qtde'].concat(CX_EXPANDIDO?['MAT','M.O','GGF']:[]).concat(['CPV Total','CPV/Un']);
  const rows=G.b.map(g=>{
    const nome=g[0],qtd=g[1],mat=g[2],mod=g[3],ggf=g[4],custo=g[5];
    const gp=prevMap[nome]||{qtd:0,mat:0,mod:0,ggf:0,custo:0};
    const un=qtd?custo/qtd:0, unP=gp.qtd?gp.custo/gp.qtd:0;
    let row=[`<span class="cx-grp-row-cell drillable" data-grp="${esc(nome)}">${esc(nome)}</span>`,nf(qtd)];
    if(CX_EXPANDIDO) row=row.concat([money(mat),money(mod),money(ggf)]);
    row=row.concat([money(custo),money(un),nf(gp.qtd)]);
    if(CX_EXPANDIDO) row=row.concat([money(gp.mat),money(gp.mod),money(gp.ggf)]);
    return row.concat([money(gp.custo),gp.qtd?money(unP):'—',dQ(qtd,gp.qtd),dC2(custo,gp.custo)]);
  });
  const sum=(arr,i)=>arr.reduce((s,g)=>s+g[i],0);
  const tQ=sum(G.b,1),tM=sum(G.b,2),tO=sum(G.b,3),tG=sum(G.b,4),tC=sum(G.b,5);
  const pQ=sum(G.a,1),pM=sum(G.a,2),pO=sum(G.a,3),pG=sum(G.a,4),pC=sum(G.a,5);
  let foot=['Total',nf(tQ)];
  if(CX_EXPANDIDO) foot=foot.concat([money(tM),money(tO),money(tG)]);
  foot=foot.concat([money(tC),money(tQ?tC/tQ:0),nf(pQ)]);
  if(CX_EXPANDIDO) foot=foot.concat([money(pM),money(pO),money(pG)]);
  foot=foot.concat([money(pC),pQ?money(pC/pQ):'—',dQ(tQ,pQ),dC2(tC,pC)]);
  const td=(v,cls)=>'<td class="'+(cls||'right')+'">'+(v==null?'':v)+'</td>';
  const rowHtml=r=>'<tr>'+td(r[0],'left')+r.slice(1).map(c=>td(c)).join('')+'</tr>';
  const thead='<thead><tr>'
    +'<th class="left" rowspan="2">Grupo</th>'
    +'<th class="right" colspan="'+metricas.length+'">'+esc(labB)+'</th>'
    +'<th class="right" colspan="'+metricas.length+'">'+esc(labA)+'</th>'
    +'<th class="right" rowspan="2">Var. Qtde</th>'
    +'<th class="right" rowspan="2">Var. CPV</th>'
    +'</tr><tr>'
    +metricas.map(h=>'<th class="right">'+esc(h)+'</th>').join('')
    +metricas.map(h=>'<th class="right">'+esc(h)+'</th>').join('')
    +'</tr></thead>';
  const tabela='<table class="dt">'+thead+'<tbody>'+rows.map(rowHtml).join('')+'</tbody><tfoot>'+rowHtml(foot)+'</tfoot></table>';
  let s=H3('CPV por grupo de produtos','comparativo entre períodos · '+esc(labB)+' vs '+esc(labA),'cx-grp');
  s+='<button id="cx-grp-toggle" type="button" class="cxgrp-toggle">'+(CX_EXPANDIDO?'Agrupar CPV (ocultar MAT/M.O/GGF)':'Desagrupar CPV (ver MAT/M.O/GGF)')+'</button>';
  s+='<div class="cxgrp-table '+(CX_EXPANDIDO?'nzwide':'tbl-fit')+'"><div class="tw">'+tabela+'</div></div>';
  s+=cap('Em CPV, <b style="color:'+GOOD+'">verde = caiu</b> (bom) e <b style="color:'+BAD+'">vermelho = subiu</b>. Volume usa a convenção inversa.');
  return s;
}

function _cxDrivers(D){
  const labA=_cxPeriodo(D,D.cxa,D.cxa), labB=_cxPeriodo(D,D.cxb,D.cxb);
  let s=H3('Drivers de Impacto no CPV','onde o CPV está sendo impactado · '+esc(labB)+' (B) vs '+esc(labA)+' (A) · clique no grupo para ver os produtos','cx-drivers');
  s+=cap('Decompõe a variação de CPV de cada grupo em três efeitos: <b>Mix</b> (produto entrou ou saiu da curva de vendas), <b>Volume</b> (vendeu mais ou menos do mesmo produto) e <b>Custo</b> (o CPV unitário mudou). <b style="color:'+BAD+'">Vermelho</b> pressiona o CPV para cima; <b style="color:'+GOOD+'">verde</b> alivia. Inclui todos os grupos (Componentes incluso) — a soma fecha com o CPV total do período. Usa o mesmo filtro Período A/B da tabela "CPV por grupo de produtos" acima.');
  if(!D.grupos.length) return s+cap('Sem produtos comparáveis entre os dois períodos selecionados.');
  const rows=D.grupos.map(g=>[
    `<span class="cxg-driver-cell drillable" data-grp="${esc(g[0])}">${esc(g[0])}</span>`,
    money(g[1]),money(g[2]),CX_DMONEY(g[3]),CX_DMONEY(g[4]),CX_DMONEY(g[5]),CX_DMONEY(g[6])]);
  const sum=i=>D.grupos.reduce((s2,g)=>s2+g[i],0);
  s+=table(['Grupo','CPV '+esc(labA)+' (A)','CPV '+esc(labB)+' (B)','Mix','Volume','Custo','Impacto total'],
    rows,['left','right','right','right','right','right','right'],
    ['Total',money(sum(1)),money(sum(2)),CX_DMONEY(sum(3)),CX_DMONEY(sum(4)),CX_DMONEY(sum(5)),CX_DMONEY(sum(6))]);
  s+='<div id="cxg-driver-detail"></div>';
  return s;
}

function _cxPontos(A){
  const p=A.pontos, tX=p.tX, lab=_cxPeriodo(A,A.a,A.b);
  const labPrev=A.lab_prev?_cxPeriodo(A,A.lab_prev[0],A.lab_prev[1]):null;
  const prevTx=p.prev_tx, unTrend=labPrev&&p.p_un_x?(p.un_x>p.p_un_x?'subiu':'caiu'):null;
  let conclusao='';
  if(labPrev){
    const aMix=Math.abs(p.mix_eff), aCost=Math.abs(p.cost_eff), aVol=Math.abs(p.vol_eff);
    const opostos=(p.mix_eff*p.cost_eff)<0;
    if(aMix>=aCost&&aMix>=aVol){
      conclusao='Ou seja, a variação do CPV médio é explicada majoritariamente por troca de mix de produtos vendidos'
        +(opostos?' — o custo unitário real dentro de cada grupo caminhou na direção oposta, mascarada pelo efeito de mix':'')
        +', e não por uma redução ou alta real de custo dentro dos grupos.';
    } else if(aCost>=aMix&&aCost>=aVol){
      conclusao='Ou seja, houve uma variação real de custo unitário dentro dos grupos de produto'
        +(opostos?', em parte compensada (ou mascarada) pelo efeito de mix':'')
        +', e não apenas troca de mix.';
    } else {
      conclusao='Ou seja, o principal fator foi o volume total vendido, com efeitos secundários de mix e de custo unitário.';
    }
  }
  const cpvNote=!labPrev?'Sem período anterior disponível para comparar volume, mix e custo neste recorte.'
    :'O CPV total (sem Componentes) '+(tX.custo>=prevTx.custo?'subiu':'caiu')+' '+spct(prevTx.custo?tX.custo/prevTx.custo-1:0)+' ('+money(tX.custo-prevTx.custo)+') frente a '+esc(labPrev)+'. Decompondo a variação: '
      +'volume contribuiu com '+(p.vol_eff>=0?'+':'')+mi(p.vol_eff)+' ('+(p.qb>=p.qa?'cresceu':'recuou')+' '+spct(p.qa?p.qb/p.qa-1:0)+' em unidades vendidas); '
      +'mix de produtos contribuiu com '+(p.mix_eff>=0?'+':'')+mi(p.mix_eff)+(p.top_mix?' (puxado por '+esc(p.top_mix[0])+', cujo custo unitário está '+(p.top_mix[1]<0?'abaixo':'acima')+' da média do período anterior)':'')+'; '
      +'custo unitário real dentro dos grupos contribuiu com '+(p.cost_eff>=0?'+':'')+mi(p.cost_eff)+(p.top_cost?' (maior variação em '+esc(p.top_cost[0])+')':'')+'. '
      +conclusao;
  const evit=A.kpi.evit;
  const pts=[
   ['1','Onde está o custo',p.comp_max[0]+' é o maior componente do CPV: '+pct(tX.custo?p.comp_max[1]/tX.custo:0,0)+' ('+mi(p.comp_max[1])+'). Composição: MAT '+pct(tX.custo?tX.mat/tX.custo:0,0)+' · M.O '+pct(tX.custo?tX.mod/tX.custo:0,0)+' · GGF '+pct(tX.custo?tX.ggf/tX.custo:0,0)+'.'],
   ['2','CPV por unidade',unTrend
      ? 'O CPV médio por peça '+unTrend+' para '+money(p.un_x)+' ('+spct(p.un_x/p.p_un_x-1)+' vs '+labPrev+'). Volume de '+nf(Math.round(tX.qtd))+' un.'
      : 'CPV médio de '+money(p.un_x)+' por peça, sobre '+nf(Math.round(tX.qtd))+' unidades no período.'],
   ['3','Material em foco',p.cat_move
      ? esc(p.cat_move[0])+' foi a categoria que mais subiu: '+mi(p.cat_move[1])+' vs '+mi(p.cat_move[2])+' antes ('+spct(p.cat_move[2]?p.cat_move[1]/p.cat_move[2]-1:0)+').'
      : (p.cat_top?esc(p.cat_top[0])+' é a categoria de matéria-prima mais relevante: '+mi(p.cat_top[1])+' ('+pct(p.mat_total?p.cat_top[1]/p.mat_total:0,0)+' da MP direta).':'—')],
   ['4','Grupo pressionado',p.grp_press
      ? 'CPV unitário de '+esc(p.grp_press[0])+' subiu '+spct(p.grp_press[3])+': '+money(p.grp_press[1])+' vs '+money(p.grp_press[2])+' — investigar mix, material e retrabalho.'
      : (p.grp_top?esc(p.grp_top[0])+' concentra o maior CPV: '+mi(p.grp_top[5])+' ('+pct(tX.custo?p.grp_top[5]/tX.custo:0,0)+' do total), CPV/un de '+money(p.grp_top[1]?p.grp_top[5]/p.grp_top[1]:0)+'.':'—')],
   ['5','Custo evitável',mi(evit)+' entre retrabalho ('+mi(A.retrabalho_total)+') e assistência técnica ('+mi(A.assistencia_total)+') — '+pct(A.kpi.evit_pct,1)+' do custo de produção.'+(p.ret_top?' Maior ofensor: '+esc(trunc(p.ret_top[0],38))+' ('+money(p.ret_top[1])+').':'')],
   ['6','Eficiência fabril','Taxa média de '+money(A.kpi.taxa)+'/hora'+(A.kpi.prev&&A.kpi.prev.taxa?' ('+spct(A.kpi.taxa/A.kpi.prev.taxa-1)+' vs anterior)':'')+(p.cc_caro?'; centro mais caro: '+esc(p.cc_caro[0])+' a '+money(p.cc_caro[7])+'/h.':'.')],
   ['7','CPV do período',cpvNote],
  ];
  let s='<h3>Os pontos que importam'+(labPrev?' <span class="tag">vs '+esc(labPrev)+'</span>':'')+'</h3>';
  s+='<div class="prov prov3">'+pts.map((x,i)=>`<div class="pv${i===pts.length-1?' pv-wide':''}"><div class="pv-n">${x[0]}</div><div><b>${x[1]}</b><p>${x[2]}</p></div></div>`).join('')+'</div>';
  return s;
}

function _cxCorpo(P){
  const A=P['custosx.abertura'];
  if(A&&!A.tem) return call('Fontes de custo não encontradas.','warn');
  if(A&&A.vazio) return call('Sem dados de custo no período.','warn');
  let s='';
  if(A){ const K=A.kpi, pv=K.prev, lab=_cxPeriodo(A,A.a,A.b);
    const labPrev=A.lab_prev?_cxPeriodo(A,A.lab_prev[0],A.lab_prev[1]):null;
    const dC=(cur,old)=>pv&&old?deltaCost(cur/old-1):'';
    const dV=(cur,old)=>pv&&old?deltaHtml(cur/old-1):'';
    s+='<div class="kpis">'
     +kpi('CPV total',mi(K.custo),pv?dC(K.custo,pv.custo)+' vs '+labPrev:lab)
     +kpi('Volume vendido',nf(Math.round(K.qtd))+' un.',pv&&pv.qtd?dV(K.qtd,pv.qtd)+' vs '+labPrev:'base do CPV')
     +kpi('CPV médio / unidade',money(K.un),pv&&pv.un?dC(K.un,pv.un)+' vs '+labPrev:'CPV ÷ volume','ok')
     +kpi('Matéria-prima',pct(K.custo?K.mat/K.custo:0,0),mi(K.mat)+(pv?' · '+dC(K.mat,pv.mat):'')+' do CPV')
     +kpi('Mão de obra',pct(K.custo?K.mod/K.custo:0,0),mi(K.mod)+(pv?' · '+dC(K.mod,pv.mod):'')+' do CPV')
     +kpi('GGF',pct(K.custo?K.ggf/K.custo:0,0),mi(K.ggf)+(pv?' · '+dC(K.ggf,pv.ggf):'')+' do CPV')
     +kpi('Custo evitável',mi(K.evit),pct(K.evit_pct,1)+' do custo de produção'+(pv&&pv.evit?' · '+dC(K.evit,pv.evit):''),K.evit_pct>0.04?'warn':'ok')
     +kpi('Taxa média fabril',money(K.taxa)+'/h',pv&&pv.taxa?dC(K.taxa,pv.taxa)+' vs anterior':nf(Math.round(K.horas))+' h apontadas')
     +'</div>';
    s+=_cxPontos(A);
  }
  const G=P['cx-grp'];
  if(G){
    const yms=ymList(G.minym,G.maxym).map(y=>`<option value="${y}">${ymLab(y)}</option>`).join('');
    s+=`<div class="filterbar">
    <div class="fb-custom">Período A (comparação): <select id="cxg-a">${yms}</select></div>
    <div class="fb-custom">Período B (base): <select id="cxg-b">${yms}</select></div>
    <button id="cxg-apply" type="button">Comparar</button>
    <div id="cxg-compare-label" class="fb-label">Comparando ${esc(_cxPeriodo(G,G.cxb,G.cxb))} (B) vs ${esc(_cxPeriodo(G,G.cxa,G.cxa))} (A)</div>
  </div>`;
    s+='<div id="cx-grp-wrap">'+_cxGrpTabela(G)+'</div>';
    s+='<div class="tw-ins">'+(window.INSRT?INSRT.strip(ins('auto','auto-cx-grupos')):'')+'</div>';
  }
  const R=P['cx-ranking'];
  if(R){
    s+='<div id="cx-topprod-section" class="hidden-section">';
    s+='<div class="sec-head-flex">'+H3('Ranking de produtos vendidos - CPV','curva 80/20 · até 20 produtos · use a busca para achar qualquer produto da base','cx-ranking')
      +'<button id="cx-topprod-close" type="button" class="dr-close">Fechar &#10005;</button></div>';
    s+=`<div class="searchbar"><input id="cx-prodsearch" type="search" placeholder="Buscar produto na base completa (${nf(R.produtos.length)} itens)…" autocomplete="off"></div>`;
    s+='<div id="cx-topprod">'+_cxTopProd(R.produtos,'')+'</div>';
    s+='<div class="tw-ins">'+(window.INSRT?INSRT.strip(ins('auto','auto-cx-produtos')):'')+'</div>';
    s+=cap('Ranking por CPV total no Período B selecionado acima, limitado aos 20 produtos de maior custo. "Demais produtos" agrupa o restante da base para fechar com o total geral.');
    s+='</div>';
  }
  const M=P['cx-mensal'];
  if(M){
    s+=H3('CPV mensal — composição','matéria-prima, mão de obra e GGF · volume de vendas abaixo de cada mês','cx-mensal');
    s+=fig(stackedCols(M.meses.map(m=>custosMesLab(m[0])),[
      {name:'Matéria-prima',values:M.meses.map(m=>m[1]),color:SER[0]},
      {name:'Mão de obra',values:M.meses.map(m=>m[2]),color:SER[2]},
      {name:'GGF',values:M.meses.map(m=>m[3]),color:SER[1]},
    ],{valfmt:v=>mi(v,1),w:Math.min(980,Math.max(320,80*M.meses.length+150)),subLabels:M.meses.map(m=>nf(m[5])+' un.'),subTitle:'Vol. vendas'}),
    ins('cpvMix','cpv-mix'));
  }
  const U=P['cx-unidade'], V=P['cx-volume'];
  if(U||V){
    s+='<div class="two">';
    if(U) s+='<div>'+H3('CPV médio por unidade','','cx-unidade')
      +fig(line([['CPV/un',U.meses.map(m=>m[5]?m[4]/m[5]:0),SER[0]]],U.meses.map(m=>custosMesLab(m[0])),{valfmt:v=>money(v,0),w:520,h:250}),
        ins('custoUnitarioVolume','custo-unitario-volume-cpv'))+'</div>';
    if(V) s+='<div>'+H3('Volume vendido (un.)','','cx-volume')
      +fig(line([['Volume',V.meses.map(m=>m[5]),SER[2]]],V.meses.map(m=>custosMesLab(m[0])),{valfmt:v=>nf(v,0),w:520,h:250}),
        ins('serieOscilacao','serie-oscilacao-cx-volume'))+'</div>';
    s+='</div>';
  }
  const GR=P['cx-grupos'];
  if(GR){
    s+=H3('Onde o CPV se concentra','grupos de produto · maior custo','cx-grupos');
    s+=fig(hbar(GR.top.map(g=>[g[0],g[1]]),{valfmt:v=>money(v),padLeft:210,w:820,rowh:32,
      extraCols:[
        {header:'% do CPV',w:55,get:(it,k)=>pct(GR.total?GR.top[k][1]/GR.total:0,1)},
        {header:'CPV/un',w:80,get:(it,k)=>money(GR.top[k][2]?GR.top[k][1]/GR.top[k][2]:0)},
      ]}),ins('auto','auto-cx-concentra'));
    s+=cap('Para ver os produtos de cada grupo, use a tabela "CPV por grupo de produtos" acima — clique na linha do grupo.');
  }
  const D=P['cx-drivers'];
  if(D) s+='<div id="cxg-drivers-wrap">'+_cxDrivers(D)+'<div class="tw-ins">'+(window.INSRT?INSRT.strip(ins('auto','auto-cx-drivers')):'')+'</div></div>';
  const MT=P['cx-materia'];
  if(MT){
    const labPrev=P['custosx.abertura']&&P['custosx.abertura'].lab_prev
      ?_cxPeriodo(P['custosx.abertura'],P['custosx.abertura'].lab_prev[0],P['custosx.abertura'].lab_prev[1]):null;
    const dC=(cur,old)=>MT.prev&&old?deltaCost(cur/old-1):'';
    s+=H3('Composição da matéria-prima no CPV','categorias de maior peso · clique na categoria (fatia ou legenda) para ver os principais materiais','cx-materia');
    s+='<div id="cx-mat-pie">'+fig(pie3D(MT.materiais,{valfmt:v=>money(v),w:200,colorOf:nm=>CX_MAT_CORES[nm]||SER[0],
      extraHeader:MT.prev?('vs '+labPrev):null,
      extraCol:MT.prev?(it=>dC(+it[1],MT.prev[it[0]]||0)):null}),ins('auto','auto-cx-materiais'))+'</div>';
    s+=cap('Categorias escaladas proporcionalmente para fechar exatamente com o total de Matéria-prima do CPV ('+money(MT.mat)+') mostrado na leitura executiva.');
    s+='<div id="cx-matdetail"></div>';
  }
  const OP=P['cx-operacionais'];
  if(OP){
    s+=H3('Custos Operacionais no CPV','Mão de Obra (M.O) e Gastos Gerais de Fabricação (GGF)','cx-operacionais');
    s+=cap('Componentes de transformação do CPV (fora da matéria-prima direta), a partir da absorção por centro de custo e da Razão Contábil — escalados proporcionalmente para fechar exatamente com Mão de Obra ('+money(OP.mod)+') e GGF ('+money(OP.ggf)+') do CPV.');
  }
  const CC=P['cx-absorcao-cc'];
  if(CC){
    s+=H3('Absorção por centro de custo no CPV','MOD · GGF · horas · R$/hora','cx-absorcao-cc');
    s+=table(['Centro de custo','MOD','GGF','Absorção CPV','Absorção Total','Horas apontadas','R$/hora'],
      CC.cc.map(x=>[esc(x[0]),money(x[1]),money(x[2]),money(x[3]),money(x[6]),nf(Math.round(x[4])),x[7]?money(x[7]):'—']),
      ['left','right','right','right','right','right','right'],
      ['Total',money(CC.mod),money(CC.ggf),money(CC.custo),money(CC.custo_raw),nf(Math.round(CC.horas)),money(CC.taxa_raw)],
      ins('taxaHoraCC','taxa-hora-cc-cpv'));
    s+=cap('"Absorção CPV" é MOD+GGF escalado para fechar com o CPV Total da leitura executiva. "Absorção Total" é o valor cheio absorvido no período (mesma base da seção Custos — Operacional) — a taxa hora (R$/hora) usa este total, não o escalado ao CPV.');
  }
  const CT=P['cx-absorcao-conta'];
  if(CT){
    s+=H3('Absorção por tipo de conta no CPV','Produtivo · segregado entre Mão de Obra e GGF','cx-absorcao-conta');
    s+='<div class="kpis k2">'
      +kpi('Mão de Obra',mi(CT.mo),pct(CT.total?CT.mo/CT.total:0,0)+' do produtivo')
      +kpi('GGF',mi(CT.ggf),pct(CT.total?CT.ggf/CT.total:0,0)+' do produtivo')
      +'</div>';
    s+=table(['Tipo de conta','Classificação','Valor','% do total'],
      CT.itens.map(x=>[esc(x[0]),x[1],money(x[2]),pct(CT.total?x[2]/CT.total:0,1)]),
      ['left','left','right','right'],['Total','',money(CT.total),'100,0%'],ins('auto','auto-cx-conta'));
    s+=cap('Classificação por tipo de conta produtiva: "Pessoal" (salários e encargos) compõe Mão de Obra; os demais tipos de conta produtivos (materiais de consumo, terceiros, facilities, manutenção, aluguel/fretes, depreciação etc.) compõem GGF.');
  }
  if(P['cx-evitavel']) s+=H3('Custo evitável — retrabalho e assistência técnica','o que não agrega valor','cx-evitavel');
  const RT=P['cx-retrabalho'];
  if(RT){ const lab=_cxPeriodo(RT,RT.a,RT.b);
    s+=H3('Custo de retrabalho','evolução mensal · operações "RET"','cx-retrabalho');
    s+='<div class="kpis k3">'+kpi('Retrabalho total',mi(RT.total),lab+(RT.ytd!=null?' · YTD '+RT.ano+': '+mi(RT.ytd):''))
      +kpi('% do custo de produção',pct(RT.pct,2),'vs. custo total absorvido',RT.pct>0.02?'warn':'ok')
      +kpi('Item mais afetado',RT.top?esc(trunc(RT.top[1],30)):'—',RT.top?money(RT.top[2]):'')+'</div>';
    if(RT.mensal.length>1) s+=fig(line([['Custo de retrabalho',RT.mensal.map(m=>m[1]),BAD]],RT.mensal.map(m=>custosMesLab(m[0])),{valfmt:v=>money(v),w:960,h:280}),
      ins('custoEvitavel','custo-evitavel'));
  }
  const PT=P['cx-retrabalho-pareto'];
  if(PT){
    s+=H3('Pareto de retrabalho por centro de custo','onde se concentra o custo evitável','cx-retrabalho-pareto');
    s+=fig(pareto(PT.pareto.map(x=>[trunc(x[0],22),x[1]]),{valfmt:v=>money(v,0),w:900,h:300}),ins('auto','auto-cx-retrabalho'));
    s+=cap('A linha tracejada acumula a participação: os primeiros centros de custo concentram a maior parte do retrabalho — ponto de partida para o plano de ação da fábrica.');
  }
  if(RT) s+=table(['Centro de custo','Produto retrabalhado','Custo de retrabalho','% do retrabalho total'],
    RT.por_item.map(x=>[esc(x[0]),esc(trunc(x[1],48)),money(x[2]),pct(RT.total?x[2]/RT.total:0)]),['left','left','right','right'],null,ins('auto','auto-retrab-item'));
  const AS=P['cx-assistencia'];
  if(AS){ const lab=_cxPeriodo(AS,AS.a,AS.b);
    s+=H3('Custo de assistência técnica','evolução mensal · por produto','cx-assistencia');
    s+='<div class="kpis k2">'+kpi('Assist. técnica total',mi(AS.total),lab+(AS.ytd!=null?' · YTD '+AS.ano+': '+mi(AS.ytd):''))
      +kpi('% do custo de produção',pct(AS.pct,2),'vs. custo total absorvido',AS.pct>0.03?'warn':'ok')+'</div>';
    if(AS.mensal.length>1) s+=fig(line([['Custo de assistência técnica',AS.mensal.map(m=>m[1]),WARN]],AS.mensal.map(m=>custosMesLab(m[0])),{valfmt:v=>money(v),w:960,h:280}),
      ins('serieOscilacao','serie-oscilacao-assist'));
  }
  const AP=P['cx-assistencia-prod'];
  if(AP){
    s+=H3('Maiores custos de assistência técnica por produto','','cx-assistencia-prod');
    s+=table(['Produto','Custo de assistência técnica'],AP.produtos.map(x=>[esc(trunc(x[0],60)),money(x[1])]),['left','right'],null,ins('auto','auto-assist-prod'));
    s+=call('Esta é a leitura executiva. O detalhamento técnico completo — absorção por centro de custo, horas apontadas e explosão de custo ao nível zero — está na seção <b>Custos — Operacional</b>.','note');
  }
  return s;
}

DESENHO.custosx=function(P){
  const A=P['custosx.abertura'];
  let s='';
  if(A){
    s+=`<div class="sec-head"><div class="kick">Custos · Visão executiva</div><h2>Custo do Produto Vendido - CPV</h2>
      <p class="lead">A leitura executiva do custo do produto vendido (CPV), pronta para apresentação: os pontos que merecem atenção da diretoria, com comparação automática ao período anterior. O detalhamento operacional vive na seção “Custos — Operacional”.</p></div>`;
    if(A.tem&&A.presets){
      const presets=A.presets.map(p=>[p[0]===null?A.ano+' ('+ytdLab(A.maxym||101)+')':p[0],p[1],p[2]]);
      const opts=ymList(A.minym,A.maxym).map(y=>`<option value="${y}">${ymLab(y)}</option>`).join('');
      s+='<div class="filterbar"><div class="fb-presets">'
        +presets.map(p=>`<button class="cxpreset" data-a="${p[1]}" data-b="${p[2]}">${esc(p[0])}</button>`).join('')
        +`</div><div class="fb-custom">Mês: de <select id="cx-de">${opts}</select> até <select id="cx-ate">${opts}</select>
      <button id="cx-apply">Aplicar</button></div><div id="custosx-label" class="fb-label">Período: ${_cxPeriodo(A,A.a,A.b)}</div></div>`;
    }
  }
  s+='<div id="custosx-body">'+_cxCorpo(P)+'</div>';
  return s;
};

DESENHO_POS.custosx=function(sec,ctx){
  const A=ctx.payload['custosx.abertura']||{};
  const f={de:A.a,ate:A.b,cxa:(ctx.payload['cx-grp']||{}).cxa,cxb:(ctx.payload['cx-grp']||{}).cxb};
  let matSel=null, driverSel=null;
  const params=()=>{ const p={}; Object.keys(f).forEach(k=>{ if(f[k]!=null) p[k]=f[k]; }); return p; };
  const marca=()=>sec.querySelectorAll('.cxpreset').forEach(el=>el.classList.toggle('on',+el.dataset.a===f.de&&+el.dataset.b===f.ate));
  async function corpo(){
    CX_EXPANDIDO=false; matSel=null; driverSel=null;
    const P=await ctx.buscar(params());
    document.getElementById('custosx-body').innerHTML=_cxCorpo(P);
    ctx.payload=P;
    const lb=document.getElementById('custosx-label'); if(lb) lb.textContent='Período: '+_cxPeriodo(A,f.de,f.ate);
    const de=document.getElementById('cx-de'), ate=document.getElementById('cx-ate');
    if(de) de.value=f.de; if(ate) ate.value=f.ate;
    marca(); ligar(); ctx.remarcar();
  }
  function ligar(){
    const de=document.getElementById('cx-de'), ate=document.getElementById('cx-ate');
    if(de) de.value=f.de; if(ate) ate.value=f.ate;
    const ga=document.getElementById('cxg-a'), gb=document.getElementById('cxg-b');
    if(ga) ga.value=f.cxa; if(gb) gb.value=f.cxb;
    const aplicar=document.getElementById('cxg-apply');
    if(aplicar) aplicar.addEventListener('click',async()=>{
      f.cxa=+ga.value; f.cxb=+gb.value;
      const P=await ctx.buscar(params());
      ctx.payload=P;
      const wrap=document.getElementById('cx-grp-wrap'); if(wrap&&P['cx-grp']) wrap.innerHTML=_cxGrpTabela(P['cx-grp']);
      const dwrap=document.getElementById('cxg-drivers-wrap'); if(dwrap&&P['cx-drivers']) dwrap.innerHTML=_cxDrivers(P['cx-drivers'])+'<div class="tw-ins">'+(window.INSRT?INSRT.strip(ins('auto','auto-cx-drivers')):'')+'</div>';
      const lbl=document.getElementById('cxg-compare-label');
      if(lbl&&P['cx-grp']) lbl.textContent='Comparando '+_cxPeriodo(P['cx-grp'],P['cx-grp'].cxb,P['cx-grp'].cxb)+' (B) vs '+_cxPeriodo(P['cx-grp'],P['cx-grp'].cxa,P['cx-grp'].cxa)+' (A)';
      const sec2=document.getElementById('cx-topprod-section'); if(sec2) sec2.classList.add('hidden-section');
      const inp=document.getElementById('cx-prodsearch');
      if(inp&&P['cx-ranking']){ inp.value=''; inp.placeholder='Buscar produto na base completa ('+nf(P['cx-ranking'].produtos.length)+' itens)…';
        const box=document.getElementById('cx-topprod'); if(box) box.innerHTML=_cxTopProd(P['cx-ranking'].produtos,''); }
      driverSel=null; ctx.remarcar();
    });
    const inp=document.getElementById('cx-prodsearch');
    if(inp){ let tmr=null;
      inp.addEventListener('input',()=>{ clearTimeout(tmr); tmr=setTimeout(()=>{
        const R=ctx.payload['cx-ranking']; if(!R) return;
        const q=inp.value.trim().toLowerCase();
        const lista=q?R.produtos.filter(p=>p[0].toLowerCase().includes(q)||p[1].toLowerCase().includes(q)):R.produtos;
        const box=document.getElementById('cx-topprod'); if(box) box.innerHTML=_cxTopProd(lista,q);
        ctx.remarcar();
      },220); }); }
  }
  async function matDetalhe(cat){
    const box=document.getElementById('cx-matdetail'); if(!box) return;
    if(matSel===cat){ matSel=null; box.innerHTML=''; return; }
    matSel=cat;
    const R=await ctx.detalhe('material',Object.assign({cat},params()));
    const col=CX_MAT_CORES[cat]||SER[0];
    const rows=R.top.map(x=>{const u=x[3]||'un.'; const cu=x[2]?x[1]/x[2]:0;
      return [esc(x[0]),esc(u),nf(x[2],2),money(x[1]),money(cu,2),pct(R.total?x[1]/R.total:0,1)];});
    if(R.demais>0.5) rows.push(['<b>Demais materiais</b>','','',money(R.demais),'',pct(R.total?R.demais/R.total:0,1)]);
    const inner='<div class="nzwide">'+table(['Material','UM','Qtde','Custo','Custo/UM','% da categoria'],rows,
      ['left','left','right','right','right','right'])+'</div>';
    box.innerHTML=`<div class="drill" style="border-top-color:${col}">
    <div class="dr-head"><div><div class="dr-kick">Principais materiais por tipo</div><h4>${esc(cat)}</h4>
    <span class="dr-sub">${money(R.total)} · top ${nf(R.top.length)} materiais · ${esc(_cxPeriodo(A,R.a,R.b))}</span></div>`
      +`<button class="dr-close" type="button" data-for="cx-matdetail">Fechar &#10005;</button></div>${inner}</div>`;
    const b=box.querySelector('.dr-close'); if(b) b.addEventListener('click',()=>{matSel=null; box.innerHTML='';});
    ctx.remarcar();
    box.scrollIntoView({behavior:'smooth',block:'nearest'});
  }
  async function driverDetalhe(grp){
    const box=document.getElementById('cxg-driver-detail'); if(!box) return;
    if(driverSel===grp){ driverSel=null; box.innerHTML=''; return; }
    driverSel=grp;
    const R=await ctx.detalhe('driver',Object.assign({grp},params()));
    const desvio=p=>{
      if(p[1]===0&&p[2]>0) return 'produto novo na curva — '+nf(p[2])+' un. vendidas';
      if(p[1]>0&&p[2]===0) return 'saiu da curva — vendia '+nf(p[1])+' un.';
      const dq=p[2]-p[1], du=(p[2]?p[4]/p[2]:0)-(p[1]?p[3]/p[1]:0);
      const partes=[];
      if(dq) partes.push((dq>0?'+':'')+nf(dq)+' un.');
      if(Math.abs(du)>0.5) partes.push('CPV/un '+(du>0?'+':'')+money(du,0));
      return partes.length?partes.join(' · '):'sem variação relevante';
    };
    const rows=R.linhas.map(p=>[esc(trunc(p[0],46)),desvio(p),CX_DMONEY(p[5]),CX_DMONEY(p[6]),CX_DMONEY(p[7]),CX_DMONEY(p[8])]);
    let inner='';
    const g=R.grupo;
    if(g){
      const aMix=Math.abs(g.mix), aVol=Math.abs(g.vol), aCst=Math.abs(g.cst);
      const clr=v=>`<span style="color:${v<=0?GOOD:BAD};font-weight:600">${money(Math.abs(v))}</span>`;
      const clause=(nome,v)=>Math.abs(v)<1?(nome+' não teve efeito relevante'):(nome+' '+(v<=0?'aliviou':'pressionou')+' o CPV em '+clr(v));
      let headline;
      if(aMix>=aVol&&aMix>=aCst) headline='O impacto em '+esc(g.grp)+' foi dominado por <b>Mix</b>: produtos entraram ou saíram da curva de vendas — não é vender mais ou menos dos mesmos itens, nem mudança no CPV unitário deles.';
      else if(aVol>=aMix&&aVol>=aCst) headline='O impacto em '+esc(g.grp)+' foi dominado por <b>Volume</b>: os mesmos produtos venderam mais ou menos — o CPV unitário deles não mudou de forma relevante, e a curva de produtos é praticamente a mesma.';
      else headline='O impacto em '+esc(g.grp)+' foi dominado por <b>Custo</b>: o CPV unitário dos mesmos produtos mudou — a quantidade vendida e a curva de produtos seguem parecidas.';
      const labA=_cxPeriodo(R,R.cxa,R.cxa), labB=_cxPeriodo(R,R.cxb,R.cxb);
      const detail=clause('Mix',g.mix)+'; '+clause('Volume',g.vol)+'; '+clause('Custo',g.cst)+' — juntos, o grupo '+(g.total<=0?'aliviou':'pressionou')+' o CPV total em '+clr(g.total)+' ('+esc(labB)+' vs '+esc(labA)+').';
      inner=call(headline+' '+detail,g.total>0?'warn':'ok');
    }
    inner+='<div class="nzwide">'+table(['Produto','Desvio','Mix','Volume','Custo','Impacto total'],rows,
      ['left','left','right','right','right','right'])+'</div>';
    box.innerHTML=`<div class="drill" style="border-top-color:${SER[0]}">
    <div class="dr-head"><div><div class="dr-kick">Maiores impactos financeiros no CPV</div><h4>${esc(grp)}</h4>
    <span class="dr-sub">${nf(R.linhas.length)} de ${nf(R.n)} produtos comparáveis · ${esc(_cxPeriodo(R,R.cxb,R.cxb))} (B) vs ${esc(_cxPeriodo(R,R.cxa,R.cxa))} (A)</span></div>`
      +`<button class="dr-close" type="button" data-for="cxg-driver-detail">Fechar &#10005;</button></div>${inner}</div>`;
    const b=box.querySelector('.dr-close'); if(b) b.addEventListener('click',()=>{driverSel=null; box.innerHTML='';});
    ctx.remarcar();
    box.scrollIntoView({behavior:'smooth',block:'nearest'});
  }
  sec.addEventListener('click',ev=>{
    const preset=ev.target.closest('.cxpreset');
    if(preset){ f.de=+preset.dataset.a; f.ate=+preset.dataset.b; corpo(); return; }
    if(ev.target.closest('#cx-apply')){
      let a=+document.getElementById('cx-de').value, b=+document.getElementById('cx-ate').value;
      if(a>b){const t=a;a=b;b=t;} f.de=a; f.ate=b; corpo(); return; }
    if(ev.target.closest('#cx-grp-toggle')){
      CX_EXPANDIDO=!CX_EXPANDIDO;
      const wrap=document.getElementById('cx-grp-wrap');
      if(wrap&&ctx.payload['cx-grp']){ wrap.innerHTML=_cxGrpTabela(ctx.payload['cx-grp']); ctx.remarcar(); }
      return; }
    const matCel=ev.target.closest('#cx-mat-pie [data-cat]');
    if(matCel&&ctx.pode('detalhar')){ matDetalhe(matCel.dataset.cat); return; }
    const drv=ev.target.closest('.cxg-driver-cell');
    if(drv&&ctx.pode('detalhar')){ driverDetalhe(drv.dataset.grp); return; }
    if(ev.target.closest('#cx-topprod-close')){
      const s2=document.getElementById('cx-topprod-section'); if(s2) s2.classList.add('hidden-section'); return; }
    const grpCel=ev.target.closest('.cx-grp-row-cell');
    if(grpCel){
      const s2=document.getElementById('cx-topprod-section'); if(!s2) return;
      s2.classList.remove('hidden-section');
      const inp=document.getElementById('cx-prodsearch');
      if(inp){ inp.value=grpCel.dataset.grp; inp.dispatchEvent(new Event('input')); }
      s2.scrollIntoView({behavior:'smooth',block:'start'});
    }
  });
  sec.querySelectorAll('#cx-mat-pie [data-cat]').forEach(el=>el.classList.add('drillable'));
  marca(); ligar();
};
