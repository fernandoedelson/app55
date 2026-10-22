/* ===== +55 · motor de leitura dos Custos =====
   GERADO por ferramentas/extrair_desenho.py a partir do app.js do Kit na tag gabarito-v19.
   Não editar à mão: é o mesmo código que escreveu o texto das leituras no gabarito. Os números
   (períodos A e B, produtos, materiais, centros de custo...) chegam do servidor no formato do Kit.
   ====================================================================== */
'use strict';
/* o período A × B dos Drivers: quem monta a tela grava estes quatro antes de chamar as leituras */
let cxgAggA=null,cxgAggB=null,cxgLabA='',cxgLabB='';
/* o Kit lê a base de custos inteira; aqui só chegam as linhas das janelas pedidas (materiais_item, cpp, cpv) */
window.CUSTOS=window.CUSTOS||{materiais_item:[],cpp:[],cpv:[]};

/* ===== Motor de leitura executiva (Custos — Executivo) ================================================
   Todo quadro explicativo nasce de uma decomposição por PRODUTO (SKU) e cita os produtos e valores que a
   sustentam — o texto já traz a causa, em vez de mandar "investigar". Duas réguas, sempre nomeadas:
   (1) CPV MÉDIO POR UNIDADE (R$/un) = MIX + CUSTO. Mix = composição do que foi vendido, a custo unitário
       constante; custo = os mesmos produtos ficando mais caros/baratos. Volume não move a média.
       U* = CPV/un de B se vendesse o mix de B ao custo unitário de A (produto novo entra ao próprio custo);
       mix = U* − UA ; custo = UB − U* ; mix + custo = UB − UA (exato).
   (2) CPV TOTAL (R$) = MIX + VOLUME + CUSTO por produto — as mesmas fórmulas dos Drivers de Impacto
       (cxgImpact), que somam exatamente ΔCPV. ====================================================== */
const cxSg=v=>Math.abs(v)<0.5?'R$ 0':(v<0?'-':'+')+money(Math.abs(v));   // sinal explícito: +R$ 1.234 / -R$ 1.234 / R$ 0

const cxCol=v=>`<span style="color:${v<=0?GOOD:BAD};font-weight:600">${cxSg(v)}</span>`;   // idem, colorido (vermelho = pressiona o CPV)

const cxAbsPct=v=>pct(Math.abs(v),1);                                  // magnitude, quando o verbo já indica o sentido

const cxUn=q=>nf(Math.round(q))+' un.';

const cxMod=n=>nf(n)+(n===1?' modelo':' modelos');

const cxNomes=(arr,n,fmt)=>{ const t=arr.slice(0,n).map(fmt).join('; '); const r=arr.length-n; return r>0?t+'; +'+r+(r===1?' outro':' outros'):t; };

const cxCn=txt=>'<span class="cn">'+txt+'</span> ';

function cxUnitBridge(merged){
  // sA/sB = custo de itens SEM unidade no período (componentes/semi-acabados do CPP e produtos com custo apurado
  // num período e unidades concluídas em outro). Ficam fora de mix/custo e aparecem à parte (semU), para a
  // soma sempre fechar com a variação do CPV/CPP por unidade.
  let QA=0,CA=0,QB=0,CB=0,ref=0,cBoth=0,cBothA=0,nBoth=0,sA=0,sB=0;
  merged.forEach(p=>{
    if(p.qtyA>0){ QA+=p.qtyA; CA+=p.custoA; } else sA+=p.custoA;       // custo sem unidade no período A
    if(p.qtyB>0){ QB+=p.qtyB; CB+=p.custoB; } else sB+=p.custoB;       // custo sem unidade no período B
    if(p.qtyB>0){ const uB=p.custoB/p.qtyB, uA=p.qtyA>0?p.custoA/p.qtyA:uB; ref+=p.qtyB*uA;
      if(p.qtyA>0){ nBoth++; cBoth+=p.custoB; cBothA+=p.qtyB*uA; } } });
  if(!(QA>0&&QB>0)) return null;
  const UAf=CA/QA, UBf=CB/QB, Us=ref/QB, semU=sB/QB-sA/QA;
  return {UA:UAf+sA/QA,UB:UBf+sB/QB,dU:(UBf+sB/QB)-(UAf+sA/QA),mixU:Us-UAf,rateU:UBf-Us,semU,QA,QB,CA:CA+sA,CB:CB+sB,nBoth,rateCont:cBothA>0?cBoth/cBothA-1:null};
}

function cxSkuStats(merged,side){
  const q='qty'+side, c='custo'+side;
  const rows=merged.filter(p=>p[q]>0).map(p=>({q:p[q],c:p[c],u:p[c]/p[q]}));
  if(!rows.length) return {n:0,q:0,c:0,min:0,max:0,avg:0};
  const Q=rows.reduce((s,r)=>s+r.q,0), Cc=rows.reduce((s,r)=>s+r.c,0), us=rows.map(r=>r.u);
  return {n:rows.length,q:Q,c:Cc,min:Math.min(...us),max:Math.max(...us),avg:Cc/Q};
}

function cxPvm(merged){
  const rows=merged.map(p=>({...p,...cxgImpact(p.qtyA,p.custoA,p.qtyB,p.custoB)}));
  const sum=k=>rows.reduce((s,r)=>s+r[k],0);
  const sem=rows.reduce((s2,r)=>s2+((r.custoB-r.custoA)-r.total),0);   // custo sem unidade no período: fecha a soma com ΔCPV/ΔCPP
  return {rows,mix:sum('mix'),vol:sum('vol'),cst:sum('cst'),total:sum('total'),sem,
    entradas:rows.filter(r=>r.qtyA===0&&r.qtyB>0), saidas:rows.filter(r=>r.qtyB===0&&r.qtyA>0), mantidos:rows.filter(r=>r.qtyA>0&&r.qtyB>0)};
}

/* matéria-prima de uma categoria: CONSUMO × PREÇO × itens novos/saídos, item a item (razão NDVAL, valores
   brutos antes do ajuste proporcional — por isso os índices, adimensionais, são o que vale comparar). */
function cxMatBridge(cat,aggA,aggB){
  const C=window.CUSTOS;
  const pega=agg=>{ const m={}; for(const [ym,c,item,um,qtd,custo] of C.materiais_item){ if(c!==cat||ym<agg.ymMin||ym>agg.ymMax) continue;
    const o=m[item]||(m[item]={q:0,c:0,um}); o.q+=qtd; o.c+=custo; if(um) o.um=um; } return m; };
  const A=pega(aggA), B=pega(aggB);
  let cons=0,preco=0,novos=0,saidos=0,qNum=0,qDen=0,pNum=0,pDen=0,nNovos=0,nSaidos=0; const itens=[];
  new Set([...Object.keys(A),...Object.keys(B)]).forEach(k=>{
    const a=A[k], b=B[k];
    if(a&&b&&a.q>0&&b.q>0){ const pA=a.c/a.q, pB=b.c/b.q, ec=(b.q-a.q)*pA, ep=(pB-pA)*b.q;
      cons+=ec; preco+=ep; qNum+=b.q*pA; qDen+=a.q*pA; pNum+=b.q*pB; pDen+=b.q*pA;
      itens.push({item:k,um:b.um||a.um,qA:a.q,qB:b.q,pA,pB,eff:ec+ep,tipo:'mantido'}); }
    else if(b&&b.c>0&&!(a&&a.q>0)){ novos+=b.c; nNovos++; itens.push({item:k,um:b.um,qA:0,qB:b.q,pA:0,pB:b.q?b.c/b.q:0,eff:b.c,tipo:'novo'}); }
    else if(a&&a.c>0&&!(b&&b.q>0)){ saidos-=a.c; nSaidos++; itens.push({item:k,um:a.um,qA:a.q,qB:0,pA:a.q?a.c/a.q:0,pB:0,eff:-a.c,tipo:'saiu'}); }
  });
  itens.sort((x,y)=>Math.abs(y.eff)-Math.abs(x.eff));
  return {cons,preco,novos,saidos,nNovos,nSaidos,qIdx:qDen?qNum/qDen-1:null,pIdx:pDen?pNum/pDen-1:null,itens};
}

/* unidades produzidas (produto acabado, CPP) na janela — dá a escala das horas apontadas */
function cxVolProd(ymMin,ymMax){ let q=0; for(const r of window.CUSTOS.cpp){ if(r[0]>=ymMin&&r[0]<=ymMax) q+=r[2]; } return q; }

function cxCausaUnit(br){
  const den=Math.abs(br.mixU)+Math.abs(br.rateU), sMix=den?Math.abs(br.mixU)/den:0;
  const causa=Math.abs(br.dU)<0.005*br.UA?'ESTÁVEL':(sMix>=0.6?'MIX':(sMix<=0.4?'CUSTO':'MIX e CUSTO'));
  return {causa,sMix};
}

/* Grupo: por que o CPV/un mudou entre A e B — conclusão + evidências por modelo */
function cxLeitGrupo(g,aggA,aggB,labA,labB){
  const merged=cxgMergeProdutos(aggA,aggB).filter(p=>p.grp===g);
  const br=cxUnitBridge(merged); if(!br) return null;
  const pv=cxPvm(merged), sa=cxSkuStats(merged,'A'), sb=cxSkuStats(merged,'B');
  const LA=esc(labA), LB=esc(labB);
  const nome=p=>esc(trunc(p.prod,42));
  const uA=p=>p.custoA/p.qtyA, uB=p=>p.custoB/p.qtyB;
  const ent=pv.entradas.slice().sort((x,y)=>y.custoB-x.custoB), sai=pv.saidas.slice().sort((x,y)=>y.custoA-x.custoA);
  const mant=pv.mantidos.slice().sort((x,y)=>Math.abs(y.cst)-Math.abs(x.cst));
  const {causa,sMix}=cxCausaUnit(br);
  let concl=cxCn('Conclusão')+`<b>${esc(g)}</b>: CPV/un ${br.dU>=0?'subiu':'caiu'} <b>${cxAbsPct(br.UB/br.UA-1)}</b> (${money(br.UA)} → ${money(br.UB)}), `
    +(causa==='ESTÁVEL'?'variação desprezível.':`causa principal <b>${causa}</b> — mix ${cxSg(br.mixU)}/un (${pct(sMix,0)}) e custo ${cxSg(br.rateU)}/un (${pct(1-sMix,0)}).`);
  let leit='';
  if(causa==='MIX'||causa==='MIX e CUSTO')
    leit+=br.nBoth===0
      ? ` Nenhum modelo foi vendido nos dois períodos: a variação vem de <b>qual</b> modelo foi vendido — o mix de ${LB} ficou ${br.mixU>0?'mais caro':'mais barato'} que o de ${LA}, e não há como o custo dos mesmos modelos ter mudado.`
      : ` O mix de ${LB} ficou ${br.mixU>0?'mais caro':'mais barato'} que o de ${LA} (a composição das vendas mudou).`;
  if(causa==='CUSTO'||causa==='MIX e CUSTO')
    leit+=` Nos dois períodos foram vendidos ${cxMod(br.nBoth)}, e o CPV/un deles ${br.rateU>0?'subiu':'caiu'} ${spct(br.rateCont)} em média ponderada`
      +(mant[0]?` (maior efeito: ${nome(mant[0])}, ${money(uA(mant[0]))} → ${money(uB(mant[0]))}/un).`:'.');
  if(causa==='MIX'&&br.nBoth>0&&br.rateCont!=null) leit+=` O custo dos modelos vendidos nos dois períodos variou ${spct(br.rateCont)} — peso de ${pct(1-sMix,0)} da variação do CPV/un.`;
  const comp=(s,lab)=>`<b>${lab}</b>: ${cxUn(s.q)} de ${cxMod(s.n)}`+(s.n>1?` (CPV/un de ${money(s.min)} a ${money(s.max)}; média ${money(s.avg)})`:` (${money(s.avg)}/un)`);
  const ev=[comp(sa,LA)+' · '+comp(sb,LB)+'.'];
  if(ent.length) ev.push(`Entraram (não vendidos em ${LA}): `+cxNomes(ent,3,p=>`${nome(p)} (${cxUn(p.qtyB)} a ${money(uB(p))})`)+'.');
  if(sai.length) ev.push(`Saíram (vendidos em ${LA}, não em ${LB}): `+cxNomes(sai,3,p=>`${nome(p)} (${cxUn(p.qtyA)} a ${money(uA(p))})`)+'.');
  if(mant.length) ev.push(`Vendidos nos dois períodos: ${cxMod(mant.length)}, CPV/un ${spct(br.rateCont)} em média ponderada.`);
  ev.push(`CPV total do grupo ${spct(br.CB/br.CA-1)} (${money(br.CA)} → ${money(br.CB)}) = mix ${cxCol(pv.mix)} · volume ${cxCol(pv.vol)} · custo ${cxCol(pv.cst)} (fórmulas dos Drivers de Impacto).`);
  return {concl:concl+leit, ev:ev.join('<br>'), br, pv};
}

/* Sem período anterior: descreve o grupo de maior CPV pelos modelos que o compõem */
function cxLeitGrupoSolo(g,agg,totCusto){
  const row=agg.grupos.find(r=>r[0]===g); if(!row) return null;
  const lst=agg.produtos.filter(p=>p.grp===g&&p.qtd>0).map(p=>({prod:p.prod,q:p.qtd,c:p.custo,u:p.custo/p.qtd})).sort((x,y)=>y.c-x.c);
  if(!lst.length) return null;
  const us=lst.map(x=>x.u);
  return {concl:cxCn('Conclusão')+`<b>${esc(g)}</b> concentra o maior CPV: ${mi(row[5])} (${pct(totCusto?row[5]/totCusto:0,0)} do total), ${cxUn(row[1])} a ${money(row[1]?row[5]/row[1]:0)}/un.`,
    ev:`${cxMod(lst.length)} vendidos (CPV/un de ${money(Math.min(...us))} a ${money(Math.max(...us))}); maior peso: ${esc(trunc(lst[0].prod,42))} (${money(lst[0].c)}, ${pct(row[5]?lst[0].c/row[5]:0,0)} do grupo).`};
}

/* Os 7 pontos que importam — cada um traz CONCLUSÃO (o que aconteceu e por quê) + EVIDÊNCIA (modelos,
   itens, centros e valores que sustentam). Base do CPV = a mesma do Painel de Indicadores (CPV_Acumulado completo do
   período, inclusive COMPONENTES; só o grupo MATERIAIS fica fora), para que CPV, unidades e CPV/un fechem com o arquivo. */
function cxPontos(a,prev,lab,labPrev){
  const t=a.total, LB=esc(lab), LA=labPrev?esc(labPrev):'';
  const tX=t, pX=prev?prev.total:null;
  const temPrev=!!(pX&&pX.qtd>0&&pX.custo>0&&tX.qtd>0);
  const u=(o,k)=>o.qtd?o[k]/o.qtd:0;
  const pts=[];

  // ---------- 1) Onde está o custo ----------
  { const comps=[['Matéria-prima','MAT','mat'],['Mão de obra','M.O','mod'],['GGF','GGF','ggf']];
    const sh=k=>tX.custo?tX[k]/tX.custo:0;
    const topC=comps.map(c=>({nome:c[0],k:c[2],v:tX[c[2]]})).sort((x,y)=>y.v-x.v)[0];
    const main=cxCn('Conclusão')+`<b>${topC.nome}</b> é o maior componente do CPV: ${pct(sh(topC.k),0)} (${mi(topC.v)} de ${mi(tX.custo)}) — MAT ${pct(sh('mat'),0)} · M.O ${pct(sh('mod'),0)} · GGF ${pct(sh('ggf'),0)}.`;
    let ev='';
    if(temPrev){
      const dU=u(tX,'custo')-u(pX,'custo');
      const parts=comps.map(c=>({sig:c[1],d:u(tX,c[2])-u(pX,c[2])}));
      const den=parts.reduce((s2,x)=>s2+Math.abs(x.d),0)||1;
      parts.sort((x,y)=>Math.abs(y.d)-Math.abs(x.d));
      ev=`CPV por unidade ${cxSg(dU)} (${money(u(pX,'custo'))} → ${money(u(tX,'custo'))}): `+parts.map(x=>`${x.sig} ${cxSg(x.d)}/un (${pct(Math.abs(x.d)/den,0)})`).join(' · ')+'.';
      if(pX.ggf>0){
        const gD=tX.ggf/pX.ggf-1, vD=tX.qtd/pX.qtd-1, gu=u(tX,'ggf')-u(pX,'ggf');
        ev+=` GGF total ${spct(gD)} frente a volume ${spct(vD)}: `+(vD<0
          ?(gD>vD?`o GGF não acompanhou a queda de vendas, o que elevou o GGF por unidade (${cxSg(gu)}/un).`:`o GGF caiu tanto quanto (ou mais que) as vendas (${cxSg(gu)}/un por unidade).`)
          :(gD<vD?`o GGF cresceu menos que as vendas, diluindo o GGF por unidade (${cxSg(gu)}/un).`:`o GGF cresceu tanto quanto (ou mais que) as vendas (${cxSg(gu)}/un por unidade).`));
      }
    } else ev='Sem período anterior para comparar a evolução por componente.';
    pts.push(['1','Onde está o custo',main,ev]);
  }

  // ---------- 2) CPV por unidade ----------
  { let main='',ev='';
    if(temPrev){
      const m2=cxgMergeProdutos(prev,a), br=cxUnitBridge(m2);
      if(br){
        const pvm=cxPvm(m2), {causa,sMix}=cxCausaUnit(br);
        main=cxCn('Conclusão')+`CPV médio por peça ${br.dU>=0?'subiu':'caiu'} <b>${cxAbsPct(br.UB/br.UA-1)}</b> (${money(br.UA)} → ${money(br.UB)}) com volume ${spct(br.QB/br.QA-1)} (${nf(Math.round(br.QA))} → ${nf(Math.round(br.QB))} un.)`
          +(causa==='ESTÁVEL'?': variação desprezível.':`: causa principal <b>${causa}</b> — mix ${cxSg(br.mixU)}/un (${pct(sMix,0)}) e custo ${cxSg(br.rateU)}/un (${pct(1-sMix,0)}).`);
        const entC=pvm.entradas.reduce((s2,r)=>s2+r.custoB,0), saiC=pvm.saidas.reduce((s2,r)=>s2+r.custoA,0);
        ev=`<b>Mix</b> (composição vendida): ${cxMod(pvm.entradas.length)} entraram (${money(entC)} de CPV) e ${cxMod(pvm.saidas.length)} saíram (${money(saiC)}). <b>Custo</b>: ${cxMod(br.nBoth)} vendidos nos dois períodos, CPV/un ${br.rateCont==null?'sem base de comparação':spct(br.rateCont)} em média ponderada.`;
        if(causa==='MIX') ev+=` → Predomina a troca para produtos mais ${br.mixU>0?'caros':'baratos'} (${pct(sMix,0)}); o custo dos mesmos produtos explica o restante (${pct(1-sMix,0)}).`;
        else if(causa==='CUSTO') ev+=` → Predomina o custo unitário dos próprios produtos (${pct(1-sMix,0)}); a troca de mix explica o restante (${pct(sMix,0)}).`;
        else if(causa==='MIX e CUSTO') ev+=` → Mix e custo ${(br.mixU*br.rateU)<0?'têm sinais opostos e se compensam parcialmente':'atuam na mesma direção e se reforçam'}.`;
      }
    }
    if(!main){ main=`CPV médio de <b>${money(u(tX,'custo'))}</b> por peça, sobre ${nf(Math.round(tX.qtd))} unidades.`; ev='Sem período anterior para separar o efeito de mix do efeito de custo.'; }
    pts.push(['2','CPV por unidade',main,ev]);
  }

  // ---------- 3) Material em foco ----------
  { const catPrev={}; if(prev) prev.materiais.forEach(([c,v])=>catPrev[c]=v);
    let mov=null;
    if(prev){ const m=a.materiais.map(([c,v])=>[c,v,catPrev[c]||0,v-(catPrev[c]||0)]).filter(x=>x[2]>0).sort((x,y)=>Math.abs(y[3])-Math.abs(x[3])); if(m.length) mov=m[0]; }
    let main='—',ev='';
    if(mov){
      const [cat,vB,vA,d]=mov, br=cxMatBridge(cat,prev,a);
      const parts=[['CONSUMO',br.cons],['PREÇO',br.preco],['ITENS NOVOS/SAÍDOS',br.novos+br.saidos]].sort((x,y)=>Math.abs(y[1])-Math.abs(x[1]));
      const den=parts.reduce((s2,p)=>s2+Math.abs(p[1]),0)||1;
      main=cxCn('Conclusão')+`<b>${esc(cat)}</b> foi a categoria que mais ${d>=0?'subiu':'caiu'}: ${mi(vB)} vs ${mi(vA)} (${spct(vB/vA-1)}; ${cxSg(d)}) — causa principal <b>${parts[0][0]}</b> (${pct(Math.abs(parts[0][1])/den,0)} do movimento nos registros do razão).`;
      const fmtI=it=>it.tipo==='mantido'
        ?`${esc(trunc(it.item,34))} (consumo ${spct(it.qB/it.qA-1)}, preço ${spct(it.pB/it.pA-1)})`
        :`${esc(trunc(it.item,34))} (${it.tipo==='novo'?'item novo':'saiu'}: ${money(Math.abs(it.eff))})`;
      ev=`Consumo ${br.qIdx==null?'—':spct(br.qIdx)} a preços constantes · preço médio ${br.pIdx==null?'—':spct(br.pIdx)} nos mesmos itens · ${br.nNovos} ${br.nNovos===1?'item novo':'itens novos'} (${money(br.novos)}) e ${br.nSaidos} ${br.nSaidos===1?'item que saiu':'itens que saíram'} (${money(-br.saidos)}). Itens de maior efeito: `+(br.itens.length?cxNomes(br.itens,3,fmtI):'—')+'.';
    } else {
      const top=a.materiais[0];
      if(top){ const it=(a.materiaisTop[top[0]]||[])[0];
        main=cxCn('Conclusão')+`<b>${esc(top[0])}</b> é a maior categoria de matéria-prima: ${mi(top[1])} (${pct(t.mat?top[1]/t.mat:0,0)} da MP direta).`;
        ev=(it?`Item de maior peso: ${esc(trunc(it[0],40))} (${mi(it[1])}, ${pct(top[1]?it[1]/top[1]:0,0)} da categoria). `:'')+'Sem período anterior para medir consumo × preço.'; }
    }
    pts.push(['3','Material em foco',main,ev]);
  }

  // ---------- 4) Grupo pressionado ----------
  { let main='',ev='';
    const gruposX=a.grupos;
    if(temPrev){
      const gp={}; prev.grupos.forEach(g=>gp[g[0]]={q:g[1],c:g[5]});
      const cand=gruposX.filter(g=>g[5]>tX.custo*0.05&&g[1]>0).map(g=>{ const p=gp[g[0]], uB=g[5]/g[1], uA=p&&p.q?p.c/p.q:0; return uA?{g:g[0],uA,uB,d:uB/uA-1}:null; })
        .filter(Boolean).sort((x,y)=>y.d-x.d);
      const sel=cand[0];
      if(sel&&sel.d>0.005){ const L=cxLeitGrupo(sel.g,prev,a,labPrev,lab); if(L){ main=L.concl; ev=L.ev; } }
      else if(sel){
        main=cxCn('Conclusão')+`Nenhum grupo relevante (≥5% do CPV) teve alta de CPV/un: todos ficaram estáveis ou em queda. A menor queda foi em <b>${esc(sel.g)}</b> (${spct(sel.d)}: ${money(sel.uA)} → ${money(sel.uB)}).`;
        ev='Critério: maior variação percentual do CPV por unidade entre os grupos que representam pelo menos 5% do CPV do período.';
      }
    }
    if(!main){ const top=gruposX[0], L=top?cxLeitGrupoSolo(top[0],a,tX.custo):null; if(L){ main=L.concl; ev=L.ev+' Sem período anterior para medir pressão.'; } else main='—'; }
    pts.push(['4','Grupo pressionado',main,ev]);
  }

  // ---------- 5) Custo evitável ----------
  { const retT=a.retrabalho.total, assT=a.assistencia.total, evT=retT+assT, base=a.ccTotal.custoRaw;
    const pRet=prev?prev.retrabalho.total:0, pAss=prev?prev.assistencia.total:0, pEv=pRet+pAss, pBase=prev?prev.ccTotal.custoRaw:0;
    const chg=(cur,old)=>old>0?` (${spct(cur/old-1)} vs ${LA})`:'';
    let main,ev=[];
    if(!(evT>0)) main=cxCn('Conclusão')+'Sem retrabalho nem assistência técnica registrados no período.';
    else {
      main=cxCn('Conclusão')+`Custo evitável de <b>${mi(evT)}</b> = ${pct(base?evT/base:0,1)} do custo de produção`
        +(prev&&pEv>0?`, ${cxSg(evT-pEv)} vs ${LA} (${pct(pBase?pEv/pBase:0,1)} do custo de produção então)`:'')
        +`: retrabalho ${mi(retT)}${chg(retT,pRet)} + assistência técnica ${mi(assT)}${chg(assT,pAss)}.`;
      const retCC={}, retProd={}; a.retrabalho.porItem.forEach(x=>{ retCC[x[0]]=(retCC[x[0]]||0)+x[2]; retProd[x[1]]=(retProd[x[1]]||0)+x[2]; });
      const ccTop=Object.entries(retCC).sort((x,y)=>y[1]-x[1]), prTop=Object.entries(retProd).sort((x,y)=>y[1]-x[1]);
      const assTop=a.assistencia.porProduto, ass5=assTop.slice(0,5).reduce((s2,x)=>s2+x[1],0);
      ev.push(`Assistência técnica pesa ${pct(assT/evT,0)} do custo evitável e retrabalho ${pct(retT/evT,0)}.`);
      if(assT>0&&assTop.length) ev.push(`<b>Assistência</b>: ${Math.min(5,assTop.length)} ${Math.min(5,assTop.length)===1?'produto concentra':'produtos concentram'} ${pct(ass5/assT,0)} (maior: ${esc(trunc(assTop[0][0],40))}, ${money(assTop[0][1])}).`);
      if(retT>0&&ccTop.length) ev.push(`<b>Retrabalho</b>: ${pct(ccTop[0][1]/retT,0)} em ${esc(ccTop[0][0])}`+(ccTop[1]?` e ${pct(ccTop[1][1]/retT,0)} em ${esc(ccTop[1][0])}`:'')+(prTop[0]?`; maior produto: ${esc(trunc(prTop[0][0],40))} (${money(prTop[0][1])}, ${pct(prTop[0][1]/retT,0)} do retrabalho)`:'')+'.');
    }
    pts.push(['5','Custo evitável',main,ev.join('<br>')]);
  }

  // ---------- 6) Eficiência fabril ----------
  { const hB=a.ccTotal.horas, cB=a.ccTotal.custoRaw, tB=a.ccTotal.taxaRaw;
    const hA=prev?prev.ccTotal.horas:0, cA=prev?prev.ccTotal.custoRaw:0, tA=prev?prev.ccTotal.taxaRaw:0;
    let main=cxCn('Conclusão')+`Taxa média de <b>${money(tB)}/h</b>`;
    const ev=[];
    if(prev&&tA>0&&hA>0&&cA>0){
      const cD=cB/cA-1, hD=hB/hA-1;
      main+=` (${spct(tB/tA-1)} vs ${LA}: ${money(tA)}/h): absorção ${spct(cD)} (${mi(cA,2)} → ${mi(cB,2)}) e horas apontadas ${spct(hD)} (${nf(Math.round(hA))} h → ${nf(Math.round(hB))} h) — a ${tB>=tA?'alta':'queda'} vem principalmente ${Math.abs(hD)>=Math.abs(cD)?'das <b>horas</b>':'da <b>absorção</b>'}.`;
    } else main+=` (${mi(cB)} absorvidos em ${nf(Math.round(hB))} h apontadas).`;
    const vpB=cxVolProd(a.ymMin,a.ymMax), vpA=prev?cxVolProd(prev.ymMin,prev.ymMax):0;
    if(vpB>0&&hB>0){
      const hpB=hB/vpB, hpA=(vpA>0&&hA>0)?hA/vpA:null;
      let l=`Horas por unidade produzida: <b>${nf(hpB,1)} h/un.</b>`+(hpA!=null?` (${nf(hpA,1)} em ${LA})`:'')+` — produção de ${nf(Math.round(vpB))} un.`+(vpA>0?` (${nf(Math.round(vpA))} em ${LA})`:'')+'.';
      if(hpA!=null&&hpB<0.75*hpA&&vpB>=0.9*vpA) l+=' Produção estável com bem menos horas: antes de ler como ganho de produtividade, conferir se o apontamento de horas (NDPRO359) está completo.';
      ev.push(l);
    }
    const ccs=a.cc.filter(x=>x[4]>0&&x[7]>0), ccCaro=ccs.slice().sort((x,y)=>y[7]-x[7])[0], ccHoras=ccs.slice().sort((x,y)=>y[4]-x[4])[0];
    if(ccCaro){ const shH=hB?ccCaro[4]/hB:0;
      let l=`Centro mais caro por hora: <b>${esc(ccCaro[0])}</b> a ${money(ccCaro[7])}/h, com ${nf(Math.round(ccCaro[4]))} h (${pct(shH,1)} das horas)`;
      if(shH<0.05) l+=' — taxa sensível a poucas horas apontadas';
      l+=(ccHoras&&ccHoras[0]!==ccCaro[0])?`; maior volume de horas: ${esc(ccHoras[0])} (${pct(hB?ccHoras[4]/hB:0,0)}) a ${money(ccHoras[7])}/h.`:'.';
      ev.push(l);
    }
    pts.push(['6','Eficiência fabril',main,ev.join('<br>')]);
  }

  // ---------- 7) CPV do período ----------
  { let main='',ev='';
    if(!temPrev) main='Sem período anterior disponível para decompor a variação do CPV em volume, mix e custo neste recorte.';
    else {
      const m7=cxgMergeProdutos(prev,a), pv=cxPvm(m7), br=cxUnitBridge(m7), gd=cxgGroupDriversOf(m7);
      const CA=pX.custo, CB=tX.custo, dC=CB-CA;
      const ef=[['VOLUME',pv.vol],['MIX',pv.mix],['CUSTO',pv.cst]].sort((x,y)=>Math.abs(y[1])-Math.abs(x[1]));
      const liq=pv.mix+pv.cst;
      main=cxCn('Conclusão')+`O CPV ${dC>=0?'subiu':'caiu'} <b>${cxAbsPct(CB/CA-1)}</b> (${cxSg(dC)}: ${mi(CA,2)} → ${mi(CB,2)}) frente a ${LA}. Efeito dominante: <b>${ef[0][0]}</b> ${cxCol(ef[0][1])}, seguido de ${ef[1][0].toLowerCase()} ${cxCol(ef[1][1])} e ${ef[2][0].toLowerCase()} ${cxCol(ef[2][1])}.`;
      if(Math.sign(pv.vol)*Math.sign(liq)<0&&Math.abs(liq)>0.05*Math.abs(dC))
        main+=` Sem o efeito volume, o CPV teria ${liq>0?'subido':'caído'} ${money(Math.abs(liq))} (mix + custo): o volume ${Math.abs(pv.vol)>Math.abs(liq)?'mais que compensou':'compensou em parte'} esse movimento.`;
      const topG=(k)=>{ const l=gd.slice().sort((x,y)=>Math.abs(y[k])-Math.abs(x[k])).filter(g=>Math.abs(g[k])>=1).slice(0,3); return l.length?l.map(g=>`${esc(g.grp)} ${cxCol(g[k])}`).join(' · '):'nenhum grupo com efeito relevante'; };
      const entC=pv.entradas.reduce((s2,r)=>s2+r.custoB,0), saiC=pv.saidas.reduce((s2,r)=>s2+r.custoA,0);
      ev=[`<b>Volume</b> ${cxCol(pv.vol)}: unidades vendidas ${spct(br.QB/br.QA-1)} (${nf(Math.round(br.QA))} → ${nf(Math.round(br.QB))}) — maiores: ${topG('vol')}.`,
        `<b>Mix</b> ${cxCol(pv.mix)}: ${cxMod(pv.entradas.length)} ${pv.entradas.length===1?'entrou':'entraram'} (${cxSg(entC)}) e ${cxMod(pv.saidas.length)} ${pv.saidas.length===1?'saiu':'saíram'} (${cxSg(-saiC)}) — maiores: ${topG('mix')}.`,
        `<b>Custo</b> ${cxCol(pv.cst)}: ${cxMod(pv.mantidos.length)} vendidos nos dois períodos, CPV/un ${br.rateCont==null?'sem base':spct(br.rateCont)} em média ponderada — maiores: ${topG('cst')}.`,
        ...(Math.abs(pv.sem)>=1?[`<b>Itens sem unidade vendida</b> ${cxCol(pv.sem)}: linhas de CPV sem quantidade (ajustes), fora de volume, mix e custo.`]:[]),
        'Mesmas fórmulas por produto da seção "Drivers de Impacto no CPV" (que permite comparar quaisquer dois meses).'].join('<br>');
    }
    pts.push(['7','CPV do período',main,ev]);
  }
  return pts;
}

/* ===== Leituras dos demais quadros do Executivo: cada uma conclui o que a tabela/gráfico mostra, com números ===== */
function cxConc(vals,alvo){
  const tot=vals.reduce((s2,v)=>s2+v,0); if(!(tot>0)) return {n:0,tot:0,top3:0};
  let acc=0,n=0; for(const v of vals){ acc+=v; n++; if(acc>=alvo*tot) break; }
  return {n,tot,top3:vals.slice(0,3).reduce((s2,v)=>s2+v,0)/tot};
}

/* "CPV por grupo de produtos" (Período A × B do filtro próprio) */
function cxLeituraGrupos(){
  const A=cxgAggA,B=cxgAggB; if(!A||!B) return '';
  const tA=A.total,tB=B.total; if(!(tA.qtd>0&&tB.qtd>0&&tA.custo>0)) return '';
  const gA={}; A.grupos.forEach(g=>gA[g[0]]={q:g[1],c:g[5]});
  const rows=B.grupos.map(g=>({g:g[0],qB:g[1],cB:g[5],qA:(gA[g[0]]||{}).q||0,cA:(gA[g[0]]||{}).c||0}));
  A.grupos.forEach(g=>{ if(!B.grupos.find(x=>x[0]===g[0])) rows.push({g:g[0],qB:0,cB:0,qA:g[1],cA:g[5]}); });
  rows.forEach(r=>{ r.d=r.cB-r.cA; });
  const rel=rows.slice().sort((x,y)=>x.d-y.d)[0], pre=rows.slice().sort((x,y)=>y.d-x.d)[0];
  const uA=tA.custo/tA.qtd, uB=tB.custo/tB.qtd;
  const un=rows.filter(r=>r.qA>0&&r.qB>0&&r.cB>0.05*tB.custo).map(r=>({g:r.g,uA:r.cA/r.qA,uB:r.cB/r.qB})).map(r=>({...r,d:r.uB/r.uA-1})).sort((x,y)=>y.d-x.d);
  let t=`<b>Leitura</b> (${esc(cxgLabA)} → ${esc(cxgLabB)}): o CPV ${tB.custo>=tA.custo?'subiu':'caiu'} <b>${cxAbsPct(tB.custo/tA.custo-1)}</b> (${mi(tA.custo,2)} → ${mi(tB.custo,2)}) com volume ${spct(tB.qtd/tA.qtd-1)} (${nf(Math.round(tA.qtd))} → ${nf(Math.round(tB.qtd))} un.) e CPV médio/un ${spct(uB/uA-1)} (${money(uA)} → ${money(uB)}).`;
  if(rel&&rel.d<0) t+=` Maior redução de CPV: <b>${esc(rel.g)}</b> ${cxCol(rel.d)}${rel.qA>0?` (unidades ${spct(rel.qB/rel.qA-1)})`:''}.`;
  if(pre&&pre.d>0) t+=` Maior aumento: <b>${esc(pre.g)}</b> ${cxCol(pre.d)}${pre.qA>0?` (unidades ${spct(pre.qB/pre.qA-1)})`:' (não vendido no período A)'}.`;
  if(un[0]&&un[0].d>0.005) t+=` Maior alta de CPV/un entre grupos com ≥5% do CPV: <b>${esc(un[0].g)}</b> ${spct(un[0].d)} (${money(un[0].uA)} → ${money(un[0].uB)}).`;
  t+=' A decomposição em mix, volume e custo de cada grupo está em "Drivers de Impacto no CPV", logo abaixo.';
  return call(t,'note');
}

/* "Onde o CPV se concentra" */
function cxLeituraConcentracao(a,sig,und){
  sig=sig||'CPV'; und=und||'vendidas';
  const g=a.grupos.filter(x=>x[0]!=='MATERIAIS'), tot=g.reduce((s2,x)=>s2+x[5],0), Q=g.reduce((s2,x)=>s2+x[1],0); if(!(tot>0&&Q>0&&g.length)) return '';
  const c=cxConc(g.map(x=>x[5]),0.8), top=g[0];
  const shC=top[5]/tot, shQ=top[1]/Q;
  const un=g.filter(x=>x[1]>0).map(x=>({g:x[0],u:x[5]/x[1]})).sort((x,y)=>x.u-y.u), uMin=un[0], uMax=un[un.length-1];
  let t=`<b>Leitura:</b> ${c.n} de ${g.length} grupos concentram 80% do ${sig} (${mi(tot,2)}); os três maiores (${g.slice(0,3).map(x=>esc(x[0])).join(', ')}) respondem por ${pct(c.top3,0)}. `
    +`<b>${esc(top[0])}</b> pesa ${pct(shC,0)} do ${sig} com ${pct(shQ,0)} das unidades ${und} (${sig}/un de ${money(top[1]?top[5]/top[1]:0)} contra média de ${money(tot/Q)})`
    +(shC>shQ*1.2?': o peso do grupo vem do custo por peça, não do volume.':(shQ>shC*1.2?': o grupo pesa mais em unidades que em '+sig+' (peça de custo baixo).':': peso proporcional entre unidades e '+sig+'.'));
  if(uMin&&uMax&&uMin.g!==uMax.g) t+=` ${sig}/un varia de ${money(uMin.u)} (${esc(uMin.g)}) a ${money(uMax.u)} (${esc(uMax.g)}).`;
  return call(t,'note');
}

/* "Composição da matéria-prima no CPV" */
function cxLeituraMP(a,prev){
  const m=a.materiais, tot=m.reduce((s2,x)=>s2+x[1],0); if(!(tot>0)||m.length<2) return '';
  const c=cxConc(m.map(x=>x[1]),0.8);
  let t=`<b>Leitura:</b> ${m.slice(0,2).map(x=>`<b>${esc(x[0])}</b> (${pct(x[1]/tot,0)})`).join(' e ')} somam ${pct((m[0][1]+m[1][1])/tot,0)} da matéria-prima (${mi(tot,2)}); ${c.n} de ${m.length} categorias bastam para 80%.`;
  if(prev){ const cp={}; prev.materiais.forEach(([k,v])=>cp[k]=v);
    const ptot=prev.materiais.reduce((s2,x)=>s2+x[1],0)||1;
    const mv=m.filter(x=>cp[x[0]]>0).map(x=>({k:x[0],d:x[1]/tot-cp[x[0]]/ptot,sB:x[1]/tot})).sort((x,y)=>Math.abs(y.d)-Math.abs(x.d))[0];
    if(mv&&Math.abs(mv.d)>=0.01) t+=` Maior mudança de participação vs anterior: <b>${esc(mv.k)}</b> ${mv.d>0?'+':''}${nf(mv.d*100,1)} p.p. (de ${pct(cp[mv.k]/ptot,0)} para ${pct(mv.sB,0)}). A causa (consumo × preço × itens) está no ponto 3 de "Os pontos que importam".`; }
  return call(t,'note');
}

/* "Absorção por centro de custo no CPV" */
function cxLeituraCentros(a,prev,raw){
  // raw=true (Executivo): absorção cheia [6]/[7]; raw=false (Operacional): valores da tabela [3]/[5]
  const iC=raw===false?3:6, iT=raw===false?5:7, A=raw===false?a.ccTotal.custo:a.ccTotal.custoRaw, TX=raw===false?a.ccTotal.taxa:a.ccTotal.taxaRaw, H=a.ccTotal.horas;
  const cc=a.cc.filter(x=>x[iC]>0); if(!(A>0&&H>0&&cc.length)) return '';
  const top3=cc.slice().sort((x,y)=>y[iC]-x[iC]).slice(0,3);
  const shA=top3.reduce((s2,x)=>s2+x[iC],0)/A, shH=top3.reduce((s2,x)=>s2+x[4],0)/H;
  let t=`<b>Leitura:</b> ${top3.map(x=>esc(x[0])).join(', ')} concentram ${pct(shA,0)} da absorção (${mi(top3.reduce((s2,x)=>s2+x[iC],0),2)}) e ${pct(shH,0)} das horas apontadas. A taxa de cada centro é absorção ÷ horas: `
    +top3.map(x=>`${esc(x[0])} ${money(x[iT])}/h`).join(' · ')+`; média da fábrica ${money(TX)}/h.`;
  if(prev){ const pc={}; prev.cc.forEach(x=>pc[x[0]]=x);
    const mv=cc.filter(x=>pc[x[0]]&&pc[x[0]][iT]>0&&pc[x[0]][4]>0&&pc[x[0]][iC]>0&&x[4]/H>=0.05)
      .map(x=>({cc:x[0],d:x[iT]/pc[x[0]][iT]-1,tA:pc[x[0]][iT],tB:x[iT],hD:x[4]/pc[x[0]][4]-1,cD:x[iC]/pc[x[0]][iC]-1})).sort((x,y)=>Math.abs(y.d)-Math.abs(x.d))[0];
    if(mv) t+=` Maior mudança de taxa entre centros com ≥5% das horas: <b>${esc(mv.cc)}</b> ${spct(mv.d)} (${money(mv.tA)} → ${money(mv.tB)}/h; absorção ${spct(mv.cD)}, horas ${spct(mv.hD)}).`; }
  const poucos=cc.filter(x=>x[4]/H<0.05).sort((x,y)=>y[iT]-x[iT])[0];
  if(poucos&&poucos[iT]>1.5*TX) t+=` Atenção: <b>${esc(poucos[0])}</b> mostra ${money(poucos[iT])}/h com apenas ${nf(Math.round(poucos[4]))} h (${pct(poucos[4]/H,1)} das horas) — taxa sensível a poucas horas apontadas.`;
  return call(t,'note');
}

/* "Absorção por tipo de conta no CPV" */
function cxLeituraContas(itens,totMO,totGGF){
  const tot=totMO+totGGF; if(!(tot>0)) return '';
  const ggf=itens.filter(x=>x[1]==='GGF').sort((x,y)=>y[2]-x[2]); if(!ggf.length||!(totGGF>0)) return '';
  const c=cxConc(ggf.map(x=>x[2]),0.8);
  const dep=ggf.filter(x=>/deprecia|amortiza/i.test(x[0])), ctrl=ggf.filter(x=>!/deprecia|amortiza/i.test(x[0]));
  let t=`<b>Leitura:</b> Mão de Obra (conta Pessoal) responde por ${pct(totMO/tot,0)} da absorção produtiva e GGF por ${pct(totGGF/tot,0)}. Dentro do GGF (${mi(totGGF,2)}), as maiores contas são ${ggf.slice(0,3).map(x=>`${esc(x[0])} (${pct(x[2]/totGGF,0)})`).join(', ')}; ${c.n} de ${ggf.length} contas formam 80% do GGF.`;
  if(dep.length){ const dv=dep.reduce((s2,x)=>s2+x[2],0);
    t+=` Depreciação e amortização (${mi(dv,2)}, ${pct(dv/totGGF,0)} do GGF) é custo contábil de ativos já adquiridos e não se reduz no curto prazo; as maiores contas gerenciáveis são ${ctrl.slice(0,3).map(x=>`${esc(x[0])} (${mi(x[2],2)}, ${pct(x[2]/totGGF,0)})`).join(', ')}.`; }
  return call(t,'note');
}

/* pico mensal e média de uma série [[ym,valor],...] */
function cxPico(serie){
  if(!serie||serie.length<2) return null;
  const media=serie.reduce((s2,m)=>s2+m[1],0)/serie.length, pk=serie.slice().sort((x,y)=>y[1]-x[1])[0];
  return {ym:pk[0],v:pk[1],media,x:media?pk[1]/media:0,n:serie.length};
}

/* Retrabalho: concentração por centro × produto e pico mensal (Executivo e Operacional) */
function cxLeituraRetrabalho(r){
  const tot=r.total; if(!(tot>0)||!r.porItem.length) return '';
  const cc={}; r.porItem.forEach(x=>{ cc[x[0]]=(cc[x[0]]||0)+x[2]; });
  const ccs=Object.entries(cc).sort((x,y)=>y[1]-x[1]);
  const pares=cxConc(r.porItem.map(x=>x[2]),0.8), pk=cxPico(r.mensal);
  let t=`<b>Leitura:</b> ${ccs.slice(0,2).map(([k,v])=>`<b>${esc(k)}</b> (${pct(v/tot,0)})`).join(' e ')} concentram ${pct(ccs.slice(0,2).reduce((s2,x)=>s2+x[1],0)/tot,0)} do retrabalho (${mi(tot,2)}); `
    +`${pares.n} de ${r.porItem.length} combinações centro × produto formam 80% do total — o item de maior peso é ${esc(trunc(r.porItem[0][1],40))} em ${esc(r.porItem[0][0])} (${money(r.porItem[0][2])}, ${pct(r.porItem[0][2]/tot,0)}).`;
  if(pk) t+=` Pico mensal em ${custosMesLab(pk.ym)} (${money(pk.v)}, ${nf(pk.x,1)}× a média de ${money(pk.media)}/mês).`;
  return call(t,'note');
}

/* Assistência técnica: concentração por produto e pico mensal */
function cxLeituraAssistencia(as){
  const tot=as.total; if(!(tot>0)||!as.porProduto.length) return '';
  const pk=cxPico(as.mensal);
  let t=`<b>Leitura:</b> ${Math.min(5,as.porProduto.length)} produtos concentram ${pct(as.porProduto.slice(0,5).reduce((s2,x)=>s2+x[1],0)/tot,0)} da assistência técnica (${mi(tot,2)}); o maior é ${esc(trunc(as.porProduto[0][0],44))} (${money(as.porProduto[0][1])}, ${pct(as.porProduto[0][1]/tot,0)}).`;
  if(pk) t+=` Pico mensal em ${custosMesLab(pk.ym)} (${money(pk.v)}, ${nf(pk.x,1)}× a média de ${money(pk.media)}/mês).`;
  return call(t,'note');
}

/* Drivers: resumo executivo do total (antes da tabela por grupo) */
function cxgResumoDrivers(groups){
  const sum=k=>groups.reduce((s2,g)=>s2+g[k],0);
  const CA=sum('custoA'), CB=sum('custoB'), tot=sum('total'); if(!(CA>0)) return '';
  const ef=[['MIX',sum('mix')],['VOLUME',sum('vol')],['CUSTO',sum('cst')]].sort((x,y)=>Math.abs(y[1])-Math.abs(x[1]));
  const dom=g=>[['mix',g.mix],['volume',g.vol],['custo',g.cst]].sort((x,y)=>Math.abs(y[1])-Math.abs(x[1]))[0][0];
  const alivio=groups.filter(g=>g.total<0).sort((x,y)=>x.total-y.total)[0], pressao=groups.filter(g=>g.total>0).sort((x,y)=>y.total-x.total)[0];
  let t=`<b>Resumo.</b> O CPV ${tot<=0?'caiu':'subiu'} <b>${cxAbsPct(CB/CA-1)}</b> (${cxSg(tot)}: ${mi(CA,2)} → ${mi(CB,2)}) entre ${esc(cxgLabA)} e ${esc(cxgLabB)}. Efeito dominante: <b>${ef[0][0]}</b> ${cxCol(ef[0][1])}, seguido de ${ef[1][0].toLowerCase()} ${cxCol(ef[1][1])} e ${ef[2][0].toLowerCase()} ${cxCol(ef[2][1])}.`;
  if(alivio) t+=` Maior alívio: <b>${esc(alivio.grp)}</b> ${cxCol(alivio.total)} (principalmente ${dom(alivio)}).`;
  t+=pressao?` Maior pressão: <b>${esc(pressao.grp)}</b> ${cxCol(pressao.total)} (principalmente ${dom(pressao)}).`:' Nenhum grupo pressionou o CPV no período.';
  return call(t,tot>0?'warn':'ok');
}

/* seleciona de 3 a 5 produtos: sempre os 3 maiores impactos absolutos, estendendo até 5 só
   enquanto o próximo item ainda for relevante (≥15% do maior impacto do grupo). */


/* leitura de segundo grau: compara o que os destaques (top 3-5) somam contra o total do
   grupo inteiro — revela se a cauda longa (produtos pequenos demais para aparecer sozinhos)
   reforça, contradiz ou é irrelevante perto do que salta aos olhos na tabela. */
/* leitura executiva do impacto total do grupo: qual dos três efeitos (mix, volume, custo)
   domina a variação e o que isso significa em termos simples — direto do total já calculado
   para o grupo em cxgGroupDrivers(), sem depender da lista de produtos. */




/* ===== Leituras do Operacional (CPP): mesma régua do Executivo, agora sobre produção ===== */
function cxCV(vs){ const n=vs.length; if(n<3) return null; const m=vs.reduce((s2,v)=>s2+v,0)/n; if(!m) return null; return Math.sqrt(vs.reduce((s2,v)=>s2+(v-m)*(v-m),0)/(n-1))/Math.abs(m); }

/* Caixa "Leitura rápida" do painel: o essencial, com números e sem recomendação sem lastro */
function opLeituraRapida(a,retPct,assPct){
  const t=a.total, ev=a.retrabalho.total+a.assistencia.total; if(!(t.custo>0&&t.qtd>0)) return {txt:'',kind:'note'};
  const cmp=[['Matéria-prima',t.mat],['Mão de obra',t.mod],['GGF',t.ggf]].sort((x,y)=>y[1]-x[1])[0];
  let txt=`<b>Leitura rápida.</b> CPP de ${mi(t.custo,2)} para ${nf(Math.round(t.qtd))} un. produzidas (${money(t.custo/t.qtd)}/un); <b>${cmp[0]}</b> é a maior parcela (${pct(cmp[1]/t.custo,0)}). `
    +`Custo evitável: retrabalho ${mi(a.retrabalho.total)} + assistência técnica ${mi(a.assistencia.total)} = ${mi(ev)} (${pct(retPct+assPct,1)} do custo de produção)`
    +(ev>0?`, dos quais ${pct(a.assistencia.total/ev,0)} são assistência técnica`:'')+'.';
  if(a.mesesYm.length>=4) txt+=' Quanto do GGF é fixo (e por que o CPP/un oscila com o volume) está na leitura abaixo do gráfico de CPP desmembrado.';
  return {txt,kind:(retPct+assPct)>0.04?'warn':'note'};
}

/* regressão linear simples y = a + b·x (a = parte fixa, b = parte variável por unidade) */
function cxOls(xs,ys){
  const n=xs.length; if(n<4) return null;
  const mx=xs.reduce((s2,v)=>s2+v,0)/n, my=ys.reduce((s2,v)=>s2+v,0)/n; let sxy=0,sxx=0,syy=0;
  for(let i=0;i<n;i++){ const dx=xs[i]-mx, dy=ys[i]-my; sxy+=dx*dy; sxx+=dx*dx; syy+=dy*dy; }
  if(!(sxx>0&&syy>0)) return null;
  const b=sxy/sxx; return {a:my-b*mx,b,r2:sxy*sxy/(sxx*syy),my,mx,n};
}

/* GGF × volume: quanto do GGF é fixo? (regressão mensal, só meses com MOD/GGF apurado) */
function opLeituraDesmembrado(a){
  const t=a.total; if(!(t.custo>0&&t.qtd>0)) return '';
  const all=a.meses.filter(x=>x[5]>0);
  const sem=all.filter(x=>(x[2]+x[3])===0), m=all.filter(x=>(x[2]+x[3])>0);
  let txt=`<b>Leitura:</b> CPP médio de ${money(t.custo/t.qtd)}/un (${nf(Math.round(t.qtd))} un. em ${nf(all.length)} ${all.length===1?'mês':'meses'}). `;
  if(sem.length) txt+=`Atenção: ${sem.map(x=>custosMesLab(x[0])).join(', ')} ${sem.length===1?'tem':'têm'} só matéria-prima (MOD e GGF só existem a partir de jun/25, início da Valorização_Ordens), então o CPP e o CPP/un ${sem.length===1?'desse mês estão subestimados':'desses meses estão subestimados'} e puxam para baixo o CPP médio do período. `;
  if(m.length>=4){
    const q=m.map(x=>x[5]), g=m.map(x=>x[3]), gu=m.map(x=>x[3]/x[5]), cu=m.map(x=>x[4]/x[5]);
    const iMax=q.indexOf(Math.max(...q)), iMin=q.indexOf(Math.min(...q)), cvG=cxCV(g), cvQ=cxCV(q), ols=cxOls(q,g);
    txt+=`Nos ${m.length} meses com MOD/GGF apurado (${custosMesLab(m[0][0])} a ${custosMesLab(m[m.length-1][0])}): o volume oscilou ${pct(cvQ,0)} ao mês (${nf(Math.round(Math.min(...q)))} a ${nf(Math.round(Math.max(...q)))} un.) e o GGF total só ${pct(cvG,0)} (${mi(Math.min(...g),2)} a ${mi(Math.max(...g),2)}). `;
    if(ols){ const fixo=Math.max(0,Math.min(1,ols.a/ols.my));
      txt+=`A regressão mensal GGF = ${mi(ols.a,2)} + ${money(ols.b)} × unidades (R² = ${nf(ols.r2,2)}) indica que ${ols.r2<0.3&&fixo>=0.6?`cerca de <b>${pct(fixo,0)} do GGF médio é fixo</b> — o volume explica apenas ${pct(ols.r2,0)} da variação`:(ols.r2>=0.6?`o GGF acompanha o volume (custo predominantemente variável)`:`a relação entre GGF e volume é parcial (${pct(ols.r2,0)} da variação explicada pelo volume)`)}. `;
      if(ols.r2<0.3&&fixo>=0.6) txt+=`Por isso o GGF por unidade varia de ${money(gu[iMax])} em ${custosMesLab(m[iMax][0])} (${nf(Math.round(q[iMax]))} un., CPP ${money(cu[iMax])}/un) a ${money(gu[iMin])} em ${custosMesLab(m[iMin][0])} (${nf(Math.round(q[iMin]))} un., CPP ${money(cu[iMin])}/un): produzir mais dilui o custo unitário.`; }
  } else if(!sem.length) txt+='Selecione um período com pelo menos 4 meses com MOD/GGF apurado para medir quanto do GGF é fixo.';
  return call(txt,sem.length?'warn':'note');
}

function opLeituraVolume(a,grpOrd){
  const ms=a.mesesYm; if(ms.length<2) return '';
  const tot=ms.map(ym=>grpOrd.reduce((s2,g)=>s2+((a.volGrpMes[g]||{})[ym]||0),0)), T=tot.reduce((s2,v)=>s2+v,0); if(!(T>0)) return '';
  const iMax=tot.indexOf(Math.max(...tot)), iMin=tot.indexOf(Math.min(...tot));
  const byG=grpOrd.map(g=>({g,q:ms.reduce((s2,ym)=>s2+((a.volGrpMes[g]||{})[ym]||0),0)})).filter(x=>x.q>0).sort((x,y)=>y.q-x.q);
  const mat=(a.grupos.find(g=>g[0]==='MATERIAIS')||[0,0])[1];
  let txt=`<b>Leitura:</b> ${nf(Math.round(T))} un. em ${ms.length} meses (média de ${nf(Math.round(T/ms.length))} un./mês${mat>0?`; o grupo MATERIAIS, com ${nf(Math.round(mat))} un., não é exibido neste quadro e por isso o total é menor que o do painel`:''}); pico em ${custosMesLab(ms[iMax])} (${nf(Math.round(tot[iMax]))} un.) e vale em ${custosMesLab(ms[iMin])} (${nf(Math.round(tot[iMin]))} un.).`;
  if(byG.length>=2) txt+=` ${esc(byG[0].g)} lidera com ${pct(byG[0].q/T,0)} das unidades, seguido de ${esc(byG[1].g)} (${pct(byG[1].q/T,0)}).`;
  return call(txt,'note');
}

function opLeituraApoio(a){
  const P=a.operacionais.PRODUTIVO, A=a.operacionais['AUXILIAR/APOIO'], tot=P.total+A.total; if(!(tot>0)) return '';
  const top=(l,n)=>l.slice(0,n).map(x=>`${esc(x[0])} (${mi(x[1],2)})`).join(', ');
  const t=`<b>Leitura:</b> a fábrica (produtivo) concentra ${pct(P.total/tot,0)} do custo operacional (${mi(P.total,2)}) e apoio/auxiliar ${pct(A.total/tot,0)} (${mi(A.total,2)}), que fica fora do CPP. Maiores contas produtivas: ${top(P.itens,3)}. Maiores contas de apoio: ${top(A.itens,3)}.`;
  return call(t,'note');
}

/* Bloco comparativo (Período atual × comparação): mesma decomposição por produto do Executivo, sobre CPP */
function opLeituraComparativo(a,b,la,lb){
  const m=cxgMergeProdutos(b,a), br=cxUnitBridge(m); if(!br) return '';
  const pv=cxPvm(m), gd=cxgGroupDriversOf(m), {causa,sMix}=cxCausaUnit(br);
  const CA=b.total.custo, CB=a.total.custo; if(!(CA>0)) return '';
  const ef=[['VOLUME',pv.vol],['MIX',pv.mix],['CUSTO',pv.cst]]; if(Math.abs(pv.sem)>=1) ef.push(['ITENS SEM VOLUME',pv.sem]);
  ef.sort((x,y)=>Math.abs(y[1])-Math.abs(x[1]));
  const resto=ef.slice(1).map(e=>`${e[0].toLowerCase()} ${cxCol(e[1])}`); const restoTxt=resto.length>1?resto.slice(0,-1).join(', ')+' e '+resto[resto.length-1]:resto[0];
  const topG=k=>{ const l=gd.slice().sort((x,y)=>Math.abs(y[k])-Math.abs(x[k])).filter(g=>Math.abs(g[k])>=1).slice(0,2); return l.length?l.map(g=>`${esc(g.grp)} ${cxCol(g[k])}`).join(' · '):'—'; };
  let t=`<b>Leitura:</b> o CPP ${CB>=CA?'subiu':'caiu'} <b>${cxAbsPct(CB/CA-1)}</b> (${cxSg(CB-CA)}: ${mi(CA,2)} → ${mi(CB,2)}) com volume produzido ${spct(br.QB/br.QA-1)} (${nf(Math.round(br.QA))} → ${nf(Math.round(br.QB))} un.). Efeito dominante: <b>${ef[0][0]}</b> ${cxCol(ef[0][1])}, seguido de ${restoTxt}. `
    +`CPP médio por unidade ${spct(br.UB/br.UA-1)} (${money(br.UA)} → ${money(br.UB)})`+(causa==='ESTÁVEL'?': variação desprezível.':`, causa principal <b>${causa}</b> (mix ${cxSg(br.mixU)}/un, ${pct(sMix,0)}; custo ${cxSg(br.rateU)}/un, ${pct(1-sMix,0)}${Math.abs(br.semU)>=1?`; itens sem volume próprio ${cxSg(br.semU)}/un`:''}).`);
  t+=`<span class="cxev"><b>Volume</b> ${cxCol(pv.vol)} — maiores grupos: ${topG('vol')}.<br><b>Mix</b> ${cxCol(pv.mix)} — ${cxMod(pv.entradas.length)} ${pv.entradas.length===1?'entrou':'entraram'} e ${cxMod(pv.saidas.length)} ${pv.saidas.length===1?'saiu':'saíram'} da produção — maiores grupos: ${topG('mix')}.<br><b>Custo</b> ${cxCol(pv.cst)} — ${cxMod(pv.mantidos.length)} produzidos nos dois períodos, CPP/un ${br.rateCont==null?'sem base':spct(br.rateCont)} — maiores grupos: ${topG('cst')}.${Math.abs(pv.sem)>=1?`<br><b>Itens sem volume</b> ${cxCol(pv.sem)} — custo apurado em um período sem unidade concluída nele (componentes e semi-acabados, cuja quantidade já está no produto "pai", ou produto cujas unidades fecharam só no outro período); a soma de volume, mix, custo e itens sem volume fecha com a variação do CPP.`:''}<br>Fórmulas por produto: mix = produto produzido em só um período (CPP cheio que entrou ou saiu); volume = Δ unidades × CPP/un do período atual; custo = Δ CPP/un × unidades do período de comparação.</span>`;
  return call(t,'note');
}

function cxgDesvio(p){
  if(p.qtyA===0&&p.qtyB>0) return 'produto novo na curva — '+nf(p.qtyB)+(p.qtyB===1?' un. vendida':' un. vendidas');
  if(p.qtyA>0&&p.qtyB===0) return 'saiu da curva — vendia '+nf(p.qtyA)+' un.';
  const dq=p.qtyB-p.qtyA, du=(p.qtyB?p.custoB/p.qtyB:0)-(p.qtyA?p.custoA/p.qtyA:0);
  const parts=[];
  if(dq) parts.push((dq>0?'+':'')+nf(dq)+' un.');
  if(Math.abs(du)>0.5) parts.push('CPV/un '+(du>0?'+':'')+money(du,0));
  return parts.length?parts.join(' · '):'sem variação relevante';
}

/* leitura de segundo grau: compara o que os destaques (top 3-5) somam contra o total do
   grupo inteiro — revela se a cauda longa (produtos pequenos demais para aparecer sozinhos)
   reforça, contradiz ou é irrelevante perto do que salta aos olhos na tabela. */
/* leitura executiva do impacto total do grupo: qual dos três efeitos (mix, volume, custo)
   domina a variação e o que isso significa em termos simples — direto do total já calculado
   para o grupo em cxgGroupDrivers(), sem depender da lista de produtos. */
function cxgExecutiveInsight(g,prods){
  const aMix=Math.abs(g.mix), aVol=Math.abs(g.vol), aCst=Math.abs(g.cst);
  const clr=v=>`<span style="color:${v<=0?GOOD:BAD};font-weight:600">${money(Math.abs(v))}</span>`;
  const clause=(nome,v)=>Math.abs(v)<1?(nome+' não teve efeito relevante'):(nome+' '+(v<=0?'aliviou':'pressionou')+' o CPV em '+clr(v));
  let headline;
  if(aMix>=aVol&&aMix>=aCst){
    headline='O impacto em '+esc(g.grp)+' foi dominado por <b>Mix</b>: produtos entraram ou saíram da curva de vendas — não é vender mais ou menos dos mesmos itens, nem mudança no CPV unitário deles.';
  } else if(aVol>=aMix&&aVol>=aCst){
    headline='O impacto em '+esc(g.grp)+' foi dominado por <b>Volume</b>: os mesmos produtos venderam mais ou menos — o CPV unitário deles não mudou de forma relevante, e a curva de produtos é praticamente a mesma.';
  } else {
    headline='O impacto em '+esc(g.grp)+' foi dominado por <b>Custo</b>: o CPV unitário dos mesmos produtos mudou — a quantidade vendida e a curva de produtos seguem parecidas.';
  }
  const detail=clause('Mix',g.mix)+'; '+clause('Volume',g.vol)+'; '+clause('Custo',g.cst)+' — juntos, o grupo '+(g.total<=0?'aliviou':'pressionou')+' o CPV total em '+clr(g.total)+' ('+esc(cxgLabB)+' vs '+esc(cxgLabA)+').';
  // evidências por produto: quem entrou/saiu (mix), quem mais moveu o volume e o custo
  const nm=p=>esc(trunc(p.prod,38)), ev=[];
  const ent=(prods||[]).filter(p=>p.qtyA===0&&p.qtyB>0).sort((x,y)=>y.custoB-x.custoB), sai=(prods||[]).filter(p=>p.qtyB===0&&p.qtyA>0).sort((x,y)=>y.custoA-x.custoA);
  const mant=(prods||[]).filter(p=>p.qtyA>0&&p.qtyB>0);
  if(Math.abs(g.mix)>=1){ const pa=[];
    if(ent.length) pa.push(`${cxMod(ent.length)} ${ent.length===1?'entrou':'entraram'} (${cxSg(ent.reduce((s2,p)=>s2+p.custoB,0))}): `+cxNomes(ent,2,p=>`${nm(p)}, ${cxUn(p.qtyB)} a ${money(p.custoB/p.qtyB)}`));
    if(sai.length) pa.push(`${cxMod(sai.length)} ${sai.length===1?'saiu':'saíram'} (${cxSg(-sai.reduce((s2,p)=>s2+p.custoA,0))}): `+cxNomes(sai,2,p=>`${nm(p)}, ${cxUn(p.qtyA)} a ${money(p.custoA/p.qtyA)}`));
    ev.push(`<b>Mix</b> ${cxCol(g.mix)} — `+pa.join('; ')+'.'); }
  if(Math.abs(g.vol)>=1){ const tp=mant.slice().sort((x,y)=>Math.abs(y.vol)-Math.abs(x.vol)).slice(0,2);
    ev.push(`<b>Volume</b> ${cxCol(g.vol)} — ${cxMod(mant.length)} vendidos nos dois períodos; maiores: `+tp.map(p=>`${nm(p)} (${p.qtyB-p.qtyA>0?'+':''}${nf(p.qtyB-p.qtyA)} un. a ${money(p.custoB/p.qtyB)} = ${cxCol(p.vol)})`).join('; ')+'.'); }
  if(Math.abs(g.cst)>=1){ const tp=mant.slice().sort((x,y)=>Math.abs(y.cst)-Math.abs(x.cst)).slice(0,2);
    ev.push(`<b>Custo</b> ${cxCol(g.cst)} — maiores: `+tp.map(p=>`${nm(p)} (${money(p.custoA/p.qtyA)} → ${money(p.custoB/p.qtyB)}/un sobre ${cxUn(p.qtyA)} = ${cxCol(p.cst)})`).join('; ')+'.'); }
  const L=cxLeitGrupo(g.grp,cxgAggA,cxgAggB,cxgLabA,cxgLabB);
  if(L){ const cu=cxCausaUnit(L.br);
    if(cu.causa!=='ESTÁVEL') ev.push(`<b>CPV por unidade do grupo</b> ${spct(L.br.UB/L.br.UA-1)} (${money(L.br.UA)} → ${money(L.br.UB)}): causa principal ${cu.causa} (mix ${cxSg(L.br.mixU)}/un · custo ${cxSg(L.br.rateU)}/un).`); }
  return {kind:g.total>0?'warn':'ok',txt:headline+' '+detail+(ev.length?'<span class="cxev">'+ev.join('<br>')+'</span>':'')};
}

function cxgGroupDrivers(){ return cxgGroupDriversOf(cxgMergeProdutos(cxgAggA,cxgAggB)); }

function cxgGroupDriversOf(merged){
  const grpMap={};
  merged.forEach(p=>{
    const im=cxgImpact(p.qtyA,p.custoA,p.qtyB,p.custoB);
    const g=grpMap[p.grp]||(grpMap[p.grp]={grp:p.grp,mix:0,vol:0,cst:0,total:0,custoA:0,custoB:0});
    g.mix+=im.mix; g.vol+=im.vol; g.cst+=im.cst; g.total+=im.total; g.custoA+=p.custoA; g.custoB+=p.custoB;
  });
  return Object.values(grpMap).sort((x,y)=>Math.abs(y.total)-Math.abs(x.total));
}

function cxgImpact(qtyA,custoA,qtyB,custoB){
  const uA=qtyA?custoA/qtyA:0, uB=qtyB?custoB/qtyB:0;
  const oneZero=(qtyA===0)!==(qtyB===0), bothPos=qtyA>0&&qtyB>0;
  const mix=oneZero?(qtyB-qtyA)*(qtyB>0?uB:uA):0;
  const vol=bothPos?(qtyB-qtyA)*uB:0;
  const cst=bothPos?(uB-uA)*qtyA:0;
  return {mix,vol,cst,total:mix+vol+cst};
}

/* ===== Drivers de Impacto no CPV: decompõe a variação de CPV entre Período A e B em Mix (produto
   entrou/saiu da curva), Volume (mesma curva, quantidade mudou) e Custo (CPV unitário mudou).
   Fórmulas (conforme especificado): Mix = Δqtde × CPV unitário do período com volume > 0, só
   quando exatamente um dos dois períodos tem qtde zero; Volume = Δqtde × CPV unitário do Período B
   (base), só quando nenhum dos dois é zero; Custo = ΔCPV unitário × qtde do Período A (mês em
   comparação), só quando nenhum dos dois é zero — isso faz Mix/Volume/Custo somarem exatamente
   ΔCusto do item em todos os casos, sem sobreposição. ===== */
function cxgMergeProdutos(aggA,aggB,exclGrp){
  const map={};
  const add=(list,side)=>{ (list||[]).forEach(p=>{ if(exclGrp&&p.grp===exclGrp) return; const k=p.prod+'||'+p.grp;
    const o=map[k]||(map[k]={prod:p.prod,grp:p.grp,qtyA:0,custoA:0,qtyB:0,custoB:0}); map[k]=o;
    if(side==='A'){ o.qtyA+=p.qtd; o.custoA+=p.custo; } else { o.qtyB+=p.qtd; o.custoB+=p.custo; } }); };
  add(aggA&&aggA.produtos,'A'); add(aggB&&aggB.produtos,'B');
  return Object.values(map);
}

/* seleciona de 3 a 5 produtos: sempre os 3 maiores impactos absolutos, estendendo até 5 só
   enquanto o próximo item ainda for relevante (≥15% do maior impacto do grupo). */
function cxgPickTop(list){
  const n=Math.min(5,list.length);
  if(n<=3) return list.slice(0,n);
  const topAbs=Math.abs(list[0].total)||1;
  let cut=3;
  for(let i=3;i<n;i++){ if(Math.abs(list[i].total)>=0.15*topAbs) cut=i+1; else break; }
  return list.slice(0,cut);
}

/* ===== experiências de luxo: contadores, cortina, apresentação, cursor, leitura ===== */
const REDUCED=window.matchMedia&&matchMedia('(prefers-reduced-motion: reduce)').matches;
