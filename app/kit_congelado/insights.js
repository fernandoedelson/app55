/* ===== +55 Design · camada de destaques (análise de 2º grau) =====

   REGRA EDITORIAL (vale para todas as regras deste arquivo):

   1. Frase curta, palavra comum. O relatório é lido em reunião por gente de
      todas as áreas. Nada de "viés", "alavancagem operacional", "percentil",
      "ruído de execução", "absorção".
   2. Não repetir o que todo mundo já sabe. "O orçamento está acima da
      capacidade" não é análise — é o enunciado. O valor está em olhar o número
      por dentro: a variação, a dispersão, o que muda de mês para mês.
   3. NÃO RECOMENDAR NADA. O destaque entrega o fato que não estava visível e
      para por aí. Quem decide o que fazer é quem está na reunião — o papel do
      texto é dar o número que faz a pessoa pensar, não a conclusão pronta.
      Conta hipotética entra como FATO ("com 10% mais peças o custo seria X"),
      nunca como conselho ("produza 10% a mais").
   4. MATERIALIDADE ANTES DE ORIGINALIDADE. Todo achado que nomeia alguém tem
      de nomear alguém que move o número. Comparar extremos sem cortar a cauda
      leva sempre ao mesmo lugar: a maior taxa, o maior desvio e o maior
      crescimento percentual pertencem a quem pesa 2% do total. É verdadeiro e
      é inútil. Use `nucleoMaterial()` antes de qualquer leitura que aponte um
      item pelo nome, e prefira olhar o líder — o que dá para repetir está no
      que funciona, não no que está fora da curva por ser pequeno.

   Estrutura de um destaque:
     {id, fam, verdict, texto, ev, trigger, score, tom, anchor, tabela}
   - verdict : o fato com o número, uma frase (aparece ao abrir a régua)
   - texto   : 2 a 4 frases com a variação e o que ela esconde
   - ev      : grade de evidência (a memória de cálculo)
   - trigger : o que fez a regra disparar, para auditoria
   - score   : 0..1, ordena o ranking e alimenta o teto por seção
   - anchor  : {labels:[…]} — o que acender no gráfico ao abrir
   - tabela  : true quando a régua pende de um quadro, não de um gráfico

   Regra que não passa no gatilho devolve null. Silêncio é resultado válido.
   Carrega DEPOIS de app.js e usa os helpers dele (mi, pct, dreAgg…), que são
   `const` e portanto NAO existem em window — chamar pelo identificador nu.
*/
'use strict';
(function(G){

const FAM={
  decomposicao:'Decomposição',
  divergencia:'Divergência',
  concentracao:'Concentração',
  padrao:'Quebra de padrão',
  consequencia:'Consequência',
  oculto:'O que o gráfico esconde',
};

/* ---------- utilidades locais ---------- */
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const sum=a=>a.reduce((x,y)=>x+(y||0),0);
const avg=a=>a.length?sum(a)/a.length:0;
const argmax=a=>a.reduce((bi,v,i,arr)=>v>arr[bi]?i:bi,0);
const argmin=a=>a.reduce((bi,v,i,arr)=>v<arr[bi]?i:bi,0);
function posicaoNaSerie(arr,i){
  const v=arr[i], n=arr.length; if(n<2) return .5;
  let menores=0; for(const x of arr) if(x<v) menores++;
  return menores/(n-1);
}
const upper=s=>String(s||'').toUpperCase();
const un=n=>nf(Math.round(n))+(Math.round(n)===1?' peça':' peças');
const plural=(n,s,p)=>Math.round(n)===1?s:p;
/* Artigo do escopo no plural. A lista e curta e explicita porque a terminacao nao
   resolve: 'unidades' e feminino e 'meses' e masculino, ambos terminam em 'es'.
   Escopo novo que nao esteja aqui cai no masculino, que e o caso da maioria. */
const ESCOPO_FEM=/^(categorias|faixas|linhas|unidades|contas|empresas|lojas|marcas|pecas|peças)\b/i;
const artPl=(esc0,m,f)=>ESCOPO_FEM.test(String(esc0||''))?f:m;
/* quantos itens de um ranking somam uma fatia do total */
function quantosPara(vals,fatia){
  const tot=sum(vals); if(!tot) return 0;
  let acc=0,k=0; for(const v of vals){ acc+=v; k++; if(acc>=tot*fatia) break; }
  return k;
}
/* Núcleo material: o subconjunto que sustenta `fatia` do valor, sempre com um
   mínimo de itens para a comparação fazer sentido. Toda leitura que for citar
   um item pelo nome passa por aqui primeiro — é o que impede o destaque de
   apontar para a cauda. */
function nucleoMaterial(itens,campo,fatia,minimo){
  const f=campo||'v';
  const ord=[...itens].filter(x=>x&&x[f]>0).sort((a,b)=>b[f]-a[f]);
  if(!ord.length) return ord;
  const k=quantosPara(ord.map(x=>x[f]),fatia||.8);
  return ord.slice(0,Math.max(k,minimo||3));
}

/* ---------- séries derivadas da base comercial ---------- */
function serieVendas(nMeses,fimRef){
  const R=G.DATA&&G.DATA.rows; if(!R||!R.length) return null;
  const fim=fimRef||MAXYM_VENDAS, por={};
  for(const r of R){ const o=por[r[0]]||(por[r[0]]={v:0,q:0,peds:new Set()});
    o.v+=r[1]; o.q+=r[2]; if(r[15]>=0) o.peds.add(r[15]); }
  const yms=Object.keys(por).map(Number).sort((a,b)=>a-b);
  const ult=yms.filter(y=>y<=fim).slice(-(nMeses||12));
  return {
    yms:ult, labels:ult.map(ymLab),
    val:ult.map(y=>por[y].v), qnt:ult.map(y=>por[y].q),
    peds:ult.map(y=>por[y].peds.size),
    pm:ult.map(y=>por[y].q?por[y].v/por[y].q:0),
  };
}
function serieVendasPR(yms){
  const pats=(G.PARTES_RELACIONADAS||[]).map(upper).filter(Boolean);
  if(!pats.length||!G.DATA) return null;
  const ehPR=new Set();
  G.DATA.cl.forEach((n,i)=>{ if(pats.some(p=>upper(n).includes(p))) ehPR.add(i); });
  if(!ehPR.size) return null;
  const por={}; yms.forEach(y=>por[y]=0);
  for(const r of G.DATA.rows){ if(por[r[0]]===undefined) continue; if(ehPR.has(r[5])) por[r[0]]+=r[1]; }
  return {pr:yms.map(y=>por[y]), nomes:[...ehPR].map(i=>G.DATA.cl[i])};
}
function pedidosDoMes(ym){
  const R=G.DATA&&G.DATA.rows; if(!R) return null;
  const por={};
  for(const r of R){ if(r[0]!==ym||r[15]<0) continue; por[r[15]]=(por[r[15]]||0)+r[1]; }
  const vals=Object.values(por).sort((a,b)=>b-a);
  if(!vals.length) return null;
  return {n:vals.length, metade:quantosPara(vals,.5), maior:vals[0], total:sum(vals)};
}

const R={};

/* =====================================================================
   REGRAS GENÉRICAS
   Servem a qualquer ranking ou série do relatório. É o que permite cobrir
   dezenas de gráficos e quadros sem escrever uma regra para cada um: quem
   chama informa o recorte e o rótulo do universo pelo contexto.
   ===================================================================== */

/* ---------- G1. Concentração de um ranking ---------- */
/* ctx: {itens:[{name,v}], escopo, escopoPl, universo, id, limiar, tabela} */
R.concentracao=function(ctx){
  const it=((ctx&&ctx.itens)||[]).filter(x=>x&&x.v>0).sort((a,b)=>b.v-a.v);
  if(it.length<5) return null;
  const vals=it.map(x=>x.v), tot=sum(vals);
  const k50=quantosPara(vals,.5), k80=quantosPara(vals,.8);
  const sh=k50/it.length, lim=(ctx.limiar||.25);
  if(sh>lim) return null;
  const p1=vals[0]/tot;
  const cauda=it.length-k80, vCauda=sum(vals.slice(k80));
  return {
    id:'concentracao-'+(ctx.id||'geral'), fam:'concentracao',
    tabela:!!ctx.tabela, score:clamp((lim-sh)/lim*.55+p1,0,1),
    tom:sh<=.12?'warn':'note', anchor:{labels:it.slice(0,k50).map(x=>x.name)},
    verdict:`Bastam <b>${k50} de ${nf(it.length)} ${esc(ctx.escopoPl||ctx.escopo||'itens')}</b> para somar metade ${esc(ctx.universo||'do total')} — ${mi(tot/2)}.`,
    texto:`Só ${esc(trunc(it[0].name,34))} já responde por ${pct(p1,1)} (${mi(vals[0])}). `
      +`Até 80% do valor cabem em ${k80} ${plural(k80,esc(ctx.escopo||'item'),esc(ctx.escopoPl||'itens'))}. `
      +(cauda>0?`O resto da lista — ${nf(cauda)} ${plural(cauda,esc(ctx.escopo||'item'),esc(ctx.escopoPl||'itens'))} — `
        +`soma ${mi(vCauda)}, ${pct(vCauda/tot,1)} do total.`:''),
    ev:[[(ctx.escopoPl||'Itens'),nf(it.length)],['Bastam para 50%',nf(k50)],
        ['Bastam para 80%',nf(k80)],['Maior isolado',pct(p1,1)]],
    trigger:`${pct(sh,0)} ${artPl(ctx.escopoPl,'dos','das')} ${esc(ctx.escopoPl||'itens')} concentram metade do valor (limiar ${pct(lim,0)})`,
  };
};

/* ---------- G2. Rotatividade entre dois recortes ---------- */
/* O total pode ficar parado enquanto a composição vira do avesso. É a leitura
   que uma coluna de variação nunca dá, porque ela é lida linha a linha.
   ctx: {a:[{name,v}], b:[{name,v}], labelA, labelB, escopo, escopoPl, id} */
R.rotatividade=function(ctx){
  if(!ctx||!ctx.a||!ctx.b) return null;
  const ma={},mb={};
  ctx.a.forEach(x=>{ if(x&&x.v>0) ma[x.name]=(ma[x.name]||0)+x.v; });
  ctx.b.forEach(x=>{ if(x&&x.v>0) mb[x.name]=(mb[x.name]||0)+x.v; });
  const nomes=new Set([...Object.keys(ma),...Object.keys(mb)]);
  if(nomes.size<4) return null;
  const totA=sum(Object.values(ma)), totB=sum(Object.values(mb));
  if(!totA||!totB) return null;
  let ganho=0,perda=0; const novos=[],saidas=[];
  nomes.forEach(n=>{ const d=(mb[n]||0)-(ma[n]||0);
    if(d>0){ ganho+=d; if(!ma[n]) novos.push([n,mb[n]]); }
    else { perda+=-d; if(!mb[n]) saidas.push([n,ma[n]]); } });
  const movido=Math.min(ganho,perda), dTot=totB-totA;
  if(!movido||movido<Math.abs(dTot)*.8) return null;
  if(movido/totA<.15) return null;
  novos.sort((x,y)=>y[1]-x[1]); saidas.sort((x,y)=>y[1]-x[1]);
  return {
    id:'rotatividade-'+(ctx.id||'geral'), fam:'oculto',
    tabela:!!ctx.tabela, score:clamp(movido/totA*1.6,0,1), tom:'warn',
    anchor:{labels:novos.slice(0,2).map(x=>x[0]).concat(saidas.slice(0,2).map(x=>x[0]))},
    verdict:`O total ${dTot<0?'caiu':'subiu'} ${mi(Math.abs(dTot))} de ${esc(ctx.labelA||'antes')} para ${esc(ctx.labelB||'agora')}, mas <b>${mi(movido)} trocaram de mão</b> por dentro.`,
    texto:`Quem cresceu somou ${mi(ganho)}; quem caiu, ${mi(perda)}. `
      +`A diferença entre os dois é o que aparece na linha do total — e ela esconde que ${pct(movido/totA,0)} do valor mudou de mãos por dentro. `
      +(novos.length?`Entraram ${nf(novos.length)} ${plural(novos.length,esc(ctx.escopo||'item'),esc(ctx.escopoPl||'itens'))} `
        +`sem histórico em ${esc(ctx.labelA||'antes')}, ${plural(novos.length,'com','o maior com')} ${mi(novos[0][1])}. `:'')
      +(saidas.length?`Outros ${nf(saidas.length)} zeraram, somando ${mi(sum(saidas.map(x=>x[1])))}.`:''),
    ev:[['Cresceram',mi(ganho)],['Caíram',mi(perda)],
        ['Variação do total',mi(dTot)],['Trocaram de mão',mi(movido)]],
    trigger:`movimento interno de ${mi(movido)} contra variação líquida de ${mi(dTot)}`,
  };
};

/* ---------- G3. Oscilação de uma série mensal ---------- */
/* ctx: {labels, vals, id, tabela} */
R.serieOscilacao=function(ctx){
  const v=((ctx&&ctx.vals)||[]).map(x=>+x||0), L=(ctx&&ctx.labels)||[];
  /* nem toda serie e dinheiro: sem isto o grafico de volume dizia "fez R$ 93"
     para 93 pecas. `fmt` formata os valores e `verbo` troca a palavra do texto. */
  const F=(ctx&&ctx.fmt)||mi, VB=(ctx&&ctx.verbo)||'vendeu';
  if(v.length<5) return null;
  const iMax=argmax(v), iMin=argmin(v);
  if(!v[iMin]) return null;
  const amp=v[iMax]/v[iMin]-1;
  if(amp<.4) return null;
  const m=avg(v), abaixo=v.filter(x=>x<m).length;
  let iq=1,qd=0;
  for(let i=1;i<v.length;i++){ const d=v[i]-v[i-1]; if(d<qd){ qd=d; iq=i; } }
  return {
    id:'serie-oscilacao-'+(ctx.id||'geral'), fam:'padrao',
    tabela:!!ctx.tabela, score:clamp(amp/2,0,1), tom:'note',
    anchor:{labels:[L[iMax],L[iMin]].filter(Boolean)},
    verdict:`Entre o melhor e o pior mês há <b>${F(v[iMax]-v[iMin])} de diferença</b> — ${esc(L[iMin]||'')} fez ${F(v[iMin])} e ${esc(L[iMax]||'')}, ${F(v[iMax])}.`,
    texto:`O melhor mês ${VB} ${pct(amp,0)} mais que o pior, dentro do mesmo período. `
      +`${abaixo} dos ${v.length} meses ficaram abaixo da média de ${F(m)} — ou seja, a média está acima do que a maioria dos meses de fato ${VB}. `
      +(qd<0?`A maior queda de um mês para o outro foi de ${F(Math.abs(qd))}, em ${esc(L[iq]||'')}.`:''),
    ev:[['Melhor mês · '+(L[iMax]||''),F(v[iMax])],['Pior mês · '+(L[iMin]||''),F(v[iMin])],
        ['Média do período',F(m)],['Meses abaixo da média',abaixo+' de '+v.length]],
    trigger:`diferença de ${pct(amp,0)} entre o melhor e o pior mês (limiar 40%)`,
  };
};

/* =====================================================================
   REGRAS ESPECÍFICAS
   ===================================================================== */

/* ---------- 1. Vendas · o mês veio de poucas peças ---------- */
R.vendasPrecoVolume=function(ctx){
  const S=serieVendas(12,ctx&&ctx.fim); if(!S||S.yms.length<8) return null;
  /* Com mes de referencia informado (secao de fechamento mensal), a analise e
     DAQUELE mes — nao do vizinho mais extremo. Um destaque sobre Junho numa
     tela intitulada Julho descreve outra coisa. Sem referencia, varre os 3
     ultimos meses da base. */
  const inicio=(ctx&&ctx.fim)?S.yms.length-1:S.yms.length-3;
  let melhor=null;
  for(let i=Math.max(0,inicio);i<S.yms.length;i++){
    const d=posicaoNaSerie(S.pm,i)-posicaoNaSerie(S.qnt,i);
    if(d<.7) continue;
    if(!melhor||d>melhor.d) melhor={i,d};
  }
  if(!melhor) return null;
  const {i,d}=melhor, lab=S.labels[i];
  const pmMed=avg(S.pm), qMed=avg(S.qnt), vMed=avg(S.val);
  const dPm=S.pm[i]/pmMed-1, dQ=1-S.qnt[i]/qMed, dV=S.val[i]/vMed-1;
  const P=pedidosDoMes(S.yms[i]);
  return {
    id:'vendas-preco-volume', fam:'decomposicao', score:clamp(d,0,1),
    tom: dV<0?'warn':'note', anchor:{labels:[lab]},
    verdict:`${lab} vendeu <b>${un(S.qnt[i])}</b>, ${pct(dQ,0)} menos que a média do período, <b>a ${money(S.pm[i])} cada</b> — ${pct(dPm,0)} acima.`,
    texto:`O valor do mês não chama atenção: ${mi(S.val[i])}, ${pct(Math.abs(dV),0)} ${dV<0?'abaixo':'acima'} da média. `
      +`Mas ele veio de quase metade das peças, a um preço bem maior. `
      +(P?`Foram ${nf(P.n)} pedidos no mês, e ${P.metade} deles já somam metade do valor — `
        +`o maior sozinho vale ${pct(P.maior/P.total,0)} do mês.`:''),
    ev:[['Peças · '+lab,nf(Math.round(S.qnt[i]))],['Média do período',nf(qMed,1)],
        ['Preço por peça',money(S.pm[i])],['Média do período',money(pmMed)]],
    trigger:`no mesmo mês, preço por peça no topo da série de ${S.yms.length} meses e quantidade no fundo`,
  };
};

/* ---------- 1b. Vendas · o mês contra o anterior, por dentro ---------- */
/* O painel do mês mostra venda, pedidos e ticket com a variação de cada um,
   lado a lado. O que ele não mostra é qual dos dois fatores explica a variação
   da venda — e os dois costumam andar em direções opostas. */
R.mesVsAnterior=function(ctx){
  const fim=ctx&&ctx.fim; if(!fim) return null;
  const S=serieVendas(14,fim); if(!S||S.yms.length<2) return null;
  const i=S.yms.length-1, j=i-1;
  if(!S.val[j]||!S.qnt[j]||!S.qnt[i]) return null;
  const V1=S.val[i], V0=S.val[j], Q1=S.qnt[i], Q0=S.qnt[j];
  const P1=V1/Q1, P0=V0/Q0;
  const efP=(P1-P0)*Q1, efQ=(Q1-Q0)*P0, dTot=V1-V0;
  if(!dTot) return null;
  const opostos=(efP>0)!==(efQ>0);
  const menor=Math.min(Math.abs(efP),Math.abs(efQ)), maior=Math.max(Math.abs(efP),Math.abs(efQ));
  /* só vale a pena quando os dois fatores brigam entre si; se andaram juntos,
     a variação da venda já conta a história toda. */
  if(!opostos||menor<Math.abs(dTot)*.5) return null;
  const dominante=Math.abs(efQ)>Math.abs(efP)?'a quantidade':'o preço';
  const pmMed=avg(S.pm.slice(0,-1));
  return {
    id:'mes-vs-anterior', fam:'decomposicao',
    score:clamp(menor/maior,0,1), tom:dTot<0?'warn':'ok',
    anchor:{labels:[S.labels[i],S.labels[j]]},
    verdict:`${S.labels[i]} vendeu <b>${mi(Math.abs(dTot))} ${dTot>0?'a mais':'a menos'} que ${S.labels[j]}</b>, `
      +`com <b>${un(Math.abs(Q1-Q0))} ${Q1>Q0?'a mais':'a menos'}</b> a um preço ${P1>P0?'maior':'menor'}.`,
    texto:`A quantidade foi de ${un(Q0)} para ${un(Q1)} e ${efQ>0?'somou':'tirou'} ${mi(Math.abs(efQ))}; `
      +`o preço por peça foi de ${money(P0)} para ${money(P1)} e ${efP>0?'somou':'tirou'} ${mi(Math.abs(efP))}. `
      +`Um efeito quase cancelou o outro, e a diferença que sobrou foi ${mi(dTot)} — `
      +`quem mandou no mês foi ${dominante}. `
      +`O preço de ${S.labels[i]} (${money(P1)}) está ${P1>pmMed?'acima':'abaixo'} da média dos meses anteriores (${money(pmMed)}).`,
    ev:[['Peças',nf(Math.round(Q0))+' → '+nf(Math.round(Q1))],['Preço por peça',money(P0)+' → '+money(P1)],
        ['Efeito da quantidade',mi(efQ)],['Efeito do preço',mi(efP)]],
    trigger:`preço e quantidade em direções opostas entre ${S.labels[j]} e ${S.labels[i]}, com o menor efeito valendo ${nf(menor/maior,2)}× o maior`,
  };
};

/* ---------- 2. Vendas · quanto foi preço, quanto foi quantidade ---------- */
R.vendasEfeitoPrecoVolume=function(){
  const S=serieVendas(36); if(!S||S.yms.length<24) return null;
  const fim=MAXYM_VENDAS, ano=Math.floor(fim/100), mes=fim%100;
  const idx=y=>S.yms.indexOf(y);
  const cur=[],pre=[];
  for(let m=1;m<=mes;m++){ const a=idx(ano*100+m), b=idx((ano-1)*100+m); if(a>=0&&b>=0){cur.push(a);pre.push(b);} }
  if(cur.length<3) return null;
  const V1=sum(cur.map(i=>S.val[i])), Q1=sum(cur.map(i=>S.qnt[i]));
  const V0=sum(pre.map(i=>S.val[i])), Q0=sum(pre.map(i=>S.qnt[i]));
  if(!Q0||!Q1||!V0) return null;
  const P1=V1/Q1, P0=V0/Q0;
  const efP=(P1-P0)*Q1, efQ=(Q1-Q0)*P0, dTot=V1-V0;
  if(!dTot) return null;
  const menor=Math.min(Math.abs(efP),Math.abs(efQ)), maior=Math.max(Math.abs(efP),Math.abs(efQ));
  if((efP>0)===(efQ>0)||menor<Math.abs(dTot)*.35) return null;
  const pecasFalta=P1?Math.abs(dTot)/P1:0;
  return {
    id:'vendas-efeito-preco-volume', fam:'decomposicao',
    score:clamp(menor/maior,0,1), tom:dTot<0?'warn':'ok',
    verdict:`Vendemos <b>${mi(Math.abs(dTot))} ${dTot<0?'a menos':'a mais'} que em ${ano-1}</b>, mas cada peça saiu <b>${money(Math.abs(P1-P0))} ${P1>P0?'mais cara':'mais barata'}</b>.`,
    texto:`O preço por peça foi de ${money(P0)} para ${money(P1)} e ${efP>0?'trouxe':'tirou'} ${mi(Math.abs(efP))}. `
      +`A quantidade foi de ${nf(Math.round(Q0))} para ${nf(Math.round(Q1))} peças e ${efQ>0?'trouxe':'tirou'} ${mi(Math.abs(efQ))}. `
      +`No preço de hoje, a diferença equivale a ${un(pecasFalta)} — cerca de ${nf(Math.ceil(pecasFalta/cur.length))} por mês.`,
    ev:[['Preço por peça',money(P0)+' → '+money(P1)],['Peças',nf(Math.round(Q0))+' → '+nf(Math.round(Q1))],
        ['Efeito do preço',mi(efP)],['Efeito da quantidade',mi(efQ)]],
    trigger:`preço e quantidade em direções opostas, e o menor efeito vale ${nf(menor/maior,2)}× o maior`,
  };
};

/* ---------- 3. Vendas · quanto é venda para o próprio grupo ---------- */
R.vendasPartesRelacionadas=function(){
  const S=serieVendas(12); if(!S) return null;
  const P=serieVendasPR(S.yms); if(!P) return null;
  const total=sum(S.val), totalPR=sum(P.pr);
  if(!totalPR||totalPR/total<.04) return null;
  const ex=S.val.map((v,i)=>v-P.pr[i]);
  const iPiorCom=argmin(S.val), iPiorEx=argmin(ex), iMaiorPR=argmax(P.pr);
  const mudou=iPiorCom!==iPiorEx;
  const ord=[...P.pr].sort((a,b)=>b-a), conc=sum(ord.slice(0,3))/totalPR;
  if(!mudou && conc<.8) return null;
  return {
    id:'vendas-partes-relacionadas', fam:'oculto',
    score:clamp((mudou?.6:.3)+conc*.4,0,1), tom:'warn',
    anchor:{labels:mudou?[S.labels[iPiorEx],S.labels[iMaiorPR]]:[S.labels[iMaiorPR]]},
    verdict:`<b>${mi(totalPR)} da venda dos últimos 12 meses veio de empresas do próprio grupo</b> — ${pct(totalPR/total,1)} do total.`,
    texto:`Esse valor não entra espalhado: ${pct(conc,0)} dele está em apenas 3 meses, com pico em ${S.labels[iMaiorPR]} (${mi(P.pr[iMaiorPR])}). `
      +(mudou?`Tirando o grupo, o pior mês da série deixa de ser ${S.labels[iPiorCom]} e passa a ser ${S.labels[iPiorEx]}, com ${mi(ex[iPiorEx])}. `:'')
      +`Sem o grupo, a venda dos 12 meses é ${mi(total-totalPR)}.`,
    ev:[['Venda ao grupo',mi(totalPR)],['% do total',pct(totalPR/total,1)],
        ['Concentrado em 3 meses',pct(conc,0)],['Venda sem o grupo',mi(total-totalPR)]],
    trigger:mudou?'tirar a venda ao grupo troca qual foi o pior mês da série':`${pct(conc,0)} da venda ao grupo em 3 meses`,
  };
};

/* ---------- 4. Meta · o ritmo que falta ---------- */
R.metaRitmo=function(ctx){
  const M=ctx&&ctx.metas; if(!M||!M.restantes) return null;
  const S=serieVendas(24); if(!S) return null;
  const necessario=(M.metaAno-M.realAteAgora)/M.restantes;
  const maxReal=Math.max(...S.val), iMax=argmax(S.val);
  const media=M.realAteAgora/(M.iUlt+1);
  const quantos=S.val.filter(v=>v>=necessario).length;
  if(necessario<=maxReal && quantos>=Math.ceil(S.val.length*.25)) return null;
  const projetado=M.realAteAgora+media*M.restantes;
  return {
    id:'meta-ritmo', fam:'consequencia',
    score:clamp(necessario/Math.max(media,1)-1,0,1), tom:'warn',
    verdict:`Faltam <b>${mi(M.metaAno-M.realAteAgora)} em ${M.restantes} ${plural(M.restantes,'mês','meses')}</b>: ${mi(necessario)} por mês, contra ${mi(media)} de média no ano.`,
    texto:`Esse patamar de ${mi(necessario)} aconteceu ${quantos} ${plural(quantos,'vez','vezes')} nos últimos ${S.yms.length} meses. `
      +`O melhor mês da série foi ${S.labels[iMax]}, com ${mi(maxReal)}.`
      +(necessario>maxReal?` Ou seja: nunca foi atingido.`:'')
      +` Mantida a média do ano, ${M.ano} fecha em ${mi(projetado)} — ${mi(M.metaAno-projetado)} abaixo do orçado.`,
    ev:[['Falta vender',mi(M.metaAno-M.realAteAgora)],['Por mês',mi(necessario)],
        ['Média do ano',mi(media)],['Fecha em',mi(projetado)]],
    trigger:necessario>maxReal?'ritmo necessário acima do melhor mês da série':`ritmo necessário atingido em ${quantos} de ${S.yms.length} meses`,
  };
};

/* ---------- 5. Carteira · o atraso é de um cliente só? ---------- */
R.carteiraAtrasoConcentrado=function(){
  const C=G.CARTDIN; if(!C||!C.status_pedidos) return null;
  const bucket=Object.keys(C.status_pedidos).find(b=>upper(b).indexOf('ATRAS')>=0); if(!bucket) return null;
  const peds=C.status_pedidos[bucket]||[]; if(peds.length<2) return null;
  const tot=sum(peds.map(p=>p[2])); if(!tot) return null;
  const porCli={}; peds.forEach(p=>{ const c=p[1]||'Não informado'; porCli[c]=(porCli[c]||0)+p[2]; });
  const rank=Object.keys(porCli).map(c=>[c,porCli[c]]).sort((a,b)=>b[1]-a[1]);
  const sh=rank[0][1]/tot;
  if(sh<.35) return null;
  return {
    id:'carteira-atraso-concentrado', fam:'concentracao',
    score:clamp(sh,0,1), tom:'warn', anchor:{labels:[bucket]},
    verdict:`<b>${pct(sh,0)} do atraso é de um cliente só</b> — ${esc(trunc(rank[0][0],34))}, ${mi(rank[0][1])} de ${mi(tot)}.`,
    texto:`São ${nf(rank.length)} clientes no bucket, mas o valor está quase todo em um. `
      +`Sem ele, o atraso da carteira cai para ${mi(tot-rank[0][1])}.`,
    ev:[['Atraso total',mi(tot)],['Maior cliente',mi(rank[0][1])],
        ['% do atraso',pct(sh,0)],['Sem ele',mi(tot-rank[0][1])]],
    trigger:`maior cliente com ${pct(sh,0)} do bucket de atraso (limiar 35%)`,
  };
};

/* ---------- 6. Carteira · o mês prometido cabe na fábrica? ---------- */
R.carteiraPicoEntrega=function(){
  const C=G.CARTDIN; if(!C||!C.andamento_entrega||!C.andamento_entrega.yms.length) return null;
  const A=C.andamento_entrega, i=argmax(A.valor), pico=A.valor[i];
  if(!pico) return null;
  const fim=G.MAXYM_DRE, ini=ymShift(fim,-11);
  const fat=dreMonthly('CONSOLIDADO',ini,fim,'receita_bruta').map(x=>x[1]).filter(v=>v>0);
  if(fat.length<6) return null;
  const medFat=avg(fat), maxFat=Math.max(...fat), razao=pico/medFat;
  if(razao<1.2) return null;
  const totalAnd=sum(A.valor);
  return {
    id:'carteira-pico-entrega', fam:'consequencia',
    score:clamp((razao-1)/1.5,0,1), tom:'warn', anchor:{labels:[ymLab(A.yms[i])]},
    verdict:`A carteira promete <b>${mi(pico)} de entrega em ${ymLab(A.yms[i])}</b> — ${nf(razao,1)}× o que a fábrica costuma faturar num mês.`,
    texto:`${pct(pico/totalAnd,0)} de tudo que está em produção está marcado para esse único mês. `
      +`Nos últimos ${fat.length} meses a média faturada foi ${mi(medFat)}, com máximo de ${mi(maxFat)}. `
      +`As datas são preenchidas pedido a pedido, sem ninguém somar o total do mês.`,
    ev:[['Prometido em '+ymLab(A.yms[i]),mi(pico)],['Média faturada',mi(medFat)],
        ['Melhor mês já faturado',mi(maxFat)],['Acima da média',mi(pico-medFat)]],
    trigger:`mês de pico em ${nf(razao,1)}× o faturamento mensal médio (limiar 1,2×)`,
  };
};

/* ---------- 7. Carteira · o que o cliente adia ---------- */
R.carteiraAdiadoTicket=function(){
  const C=G.CARTDIN; if(!C||!C.status_pedidos) return null;
  const bucket=Object.keys(C.status_pedidos).find(b=>upper(b).indexOf('ADIA')>=0); if(!bucket) return null;
  const peds=C.status_pedidos[bucket]||[]; if(peds.length<5) return null;
  const valAd=sum(peds.map(p=>p[2])), itAd=sum(peds.map(p=>p[3]||0));
  if(!itAd) return null;
  const todos=[]; Object.keys(C.status_pedidos).forEach(b=>todos.push(...C.status_pedidos[b]));
  const valTot=sum(todos.map(p=>p[2])), itTot=sum(todos.map(p=>p[3]||0));
  if(!itTot) return null;
  const tAd=valAd/itAd, tGeral=valTot/itTot, d=tAd/tGeral-1;
  if(Math.abs(d)<.18) return null;
  const fim=G.MAXYM_DRE, ini=ymShift(fim,-11);
  const fat=dreMonthly('CONSOLIDADO',ini,fim,'receita_bruta').map(x=>x[1]).filter(v=>v>0);
  const medFat=fat.length?avg(fat):0;
  return {
    id:'carteira-adiado-ticket', fam:'decomposicao',
    score:clamp(Math.abs(d)*2.5,0,1), tom:'note',
    verdict:`Os itens adiados pelo cliente custam <b>${money(tAd)} cada, ${pct(Math.abs(d),0)} ${d<0?'menos':'mais'} que a média da carteira</b> (${money(tGeral)}).`,
    texto:`São ${mi(valAd)} parados em ${nf(itAd)} itens, ${pct(valAd/valTot,0)} do valor da carteira. `
      +(d<0
        ? `O que fica para depois é o item pequeno — o complemento, o acessório. O projeto principal seguiu. `
        : `O que fica para depois é justamente a peça cara. Não é o acessório que trava, é o projeto grande. `)
      +(medFat?`O valor parado equivale a ${nf(valAd/medFat,1)} ${plural(Math.round(valAd/medFat),'mês','meses')} de faturamento.`:''),
    ev:[['Valor adiado',mi(valAd)],['Itens',nf(itAd)],
        ['Preço por item',money(tAd)],['Média da carteira',money(tGeral)]],
    trigger:`preço por item do bucket ${pct(Math.abs(d),0)} ${d<0?'abaixo':'acima'} do da carteira (limiar 18%)`,
  };
};

/* ---------- 8. Custo fixo · a queda foi de todo mundo? ---------- */
R.cfComposicao=function(){
  const C=G.CF; if(!C||!C.entidade) return null;
  const cons=C.entidade['Consolidado']; if(!cons||cons.length<6) return null;
  const ini=avg(cons.slice(0,3)), fim=avg(cons.slice(-3)), dCons=fim/ini-1;
  if(Math.abs(dCons)<.05) return null;
  const partes=Object.keys(C.entidade).filter(k=>k!=='Consolidado').map(k=>{
    const a=C.entidade[k], i0=avg(a.slice(0,3)), i1=avg(a.slice(-3));
    return {nome:k, d:i0?i1/i0-1:0, ini:i0, fim:i1, delta:i1-i0};
  });
  if(partes.length<2) return null;
  partes.sort((a,b)=>a.d-b.d);
  const lider=partes[0], parada=partes[partes.length-1];
  if(Math.abs(parada.d)>Math.abs(dCons)*.5) return null;
  const seAcompanhasse=parada.ini*(1+lider.d);
  return {
    id:'cf-composicao', fam:'decomposicao',
    score:clamp(Math.abs(lider.delta/((lider.delta+parada.delta)||1)),0,1),
    tom:dCons<0?'note':'warn', anchor:{labels:[lider.nome,parada.nome]},
    verdict:`O custo fixo caiu ${pct(-dCons,0)}, mas <b>${esc(lider.nome)} caiu ${pct(-lider.d,0)} e ${esc(parada.nome)} ficou parado (${spct(parada.d,0)})</b>.`,
    texto:`Comparando a média dos 3 primeiros meses com a dos 3 últimos. `
      +`${esc(lider.nome)} saiu de ${mi(lider.ini)} para ${mi(lider.fim)} por mês; ${esc(parada.nome)} continua em ${mi(parada.fim)}. `
      +`No ritmo de ${esc(lider.nome)}, ${esc(parada.nome)} estaria em ${mi(seAcompanhasse)} — `
      +`${mi(Math.abs(parada.fim-seAcompanhasse)*12)} de diferença no ano.`,
    ev:[[lider.nome,spct(lider.d,1)],[parada.nome,spct(parada.d,1)],
        ['Consolidado',spct(dCons,1)],['Diferença no ano',mi(Math.abs(parada.fim-seAcompanhasse)*12)]],
    trigger:`${esc(parada.nome)} variou ${spct(parada.d,0)} contra ${spct(dCons,0)} do consolidado`,
  };
};

/* ---------- 9. Custo fixo · quem foi na contramão ---------- */
R.cfCategoriaContraFluxo=function(ctx){
  const C=G.CF; if(!C) return null;
  const CAT=(ctx&&ctx.cats)||C.categoria; if(!CAT) return null;
  const cats=Object.keys(CAT).filter(k=>sum(CAT[k])>0);
  if(cats.length<3) return null;
  const tot=cats.map(k=>CAT[k]).reduce((a,b)=>a.map((v,i)=>v+b[i]));
  const dTot=avg(tot.slice(-3))/avg(tot.slice(0,3))-1;
  const movs=cats.map(k=>{ const a=CAT[k], i0=avg(a.slice(0,3)), i1=avg(a.slice(-3));
    return {nome:k, d:i0?i1/i0-1:0, ini:i0, fim:i1, peso:sum(a)/sum(tot)}; })
    .filter(m=>m.peso>=.04);
  const contra=movs.filter(m=>Math.sign(m.d)!==Math.sign(dTot)&&Math.abs(m.d)>=.15)
    .sort((a,b)=>Math.abs(b.d*b.peso)-Math.abs(a.d*a.peso));
  if(!contra.length) return null;
  const m=contra[0], soUma=contra.length===1;
  const custo=sum(contra.map(c=>c.fim-c.ini*(1+dTot)));
  return {
    id:'cf-categoria-contrafluxo'+((ctx&&ctx.entidade&&ctx.entidade!=='CONSOLIDADO')?'-'+ctx.entidade.toLowerCase():''),
    fam:'divergencia', score:clamp(Math.abs(m.d)*m.peso*6,0,1),
    tom:dTot<0?'warn':'note', anchor:{labels:contra.map(c=>c.nome)},
    verdict:soUma
      ? `<b>${esc(m.nome)} subiu ${pct(m.d,0)}</b> enquanto o custo fixo total ${dTot<0?'caiu':'subiu'} ${pct(Math.abs(dTot),0)}.`
      : `<b>${esc(contra.map(c=>c.nome+' '+spct(c.d,0)).join(' e '))}</b>, enquanto o custo fixo total ${dTot<0?'caiu':'subiu'} ${pct(Math.abs(dTot),0)}.`,
    texto:`Comparando a média dos 3 primeiros meses com a dos 3 últimos. `
      +`${esc(m.nome)} passou de ${mi(m.ini)} para ${mi(m.fim)} por mês e hoje é ${pct(m.peso,1)} do custo fixo. `
      +`${soUma?'É a única linha':'São as únicas linhas'} que não acompanharam o conjunto — `
      +`a diferença vale ${mi(Math.abs(custo))} por mês, ${mi(Math.abs(custo)*12)} no ano.`,
    ev:[[m.nome,mi(m.ini)+' → '+mi(m.fim)],['Variação',spct(m.d,1)],
        ['Custo fixo total',spct(dTot,1)],['Diferença por mês',mi(Math.abs(custo))]],
    trigger:`categoria com peso ≥ 4% variando ${spct(m.d,0)} contra ${spct(dTot,0)} do total`,
  };
};

/* ---------- 10. DRE · juros contra o que a operação gera ---------- */
R.dreJurosEbitda=function(ctx){
  const g=ctx&&ctx.dre; if(!g) return null;
  const juros=Math.abs(g.juros_passivos||0), eb=g.ebitda||0, rol=g.receita_liquida||0;
  if(!juros||!rol) return null;
  if(eb>0 && juros/eb<.35) return null;
  const umPP=rol*.01, umPctJuros=juros*.01;
  return {
    id:'dre-juros-ebitda', fam:'consequencia',
    score:eb>0?clamp(juros/eb,0,1):1, tom:'warn',
    verdict:eb>0
      ? `<b>${pct(juros/eb,0)} do que a operação gera vai para juros</b> — ${mi(juros)} sobre ${mi(eb)} de EBITDA.`
      : `A operação <b>consumiu ${mi(Math.abs(eb))}</b> no período e ainda há <b>${mi(juros)} de juros</b> a pagar.`,
    texto:`Juros a terceiros somam ${mi(juros)}, o equivalente a ${pct(juros/rol,0)} de toda a receita líquida do período. `
      +(eb>0?`É mais que ${nf(juros/Math.max(eb,1),1)}× o que sobra da operação. `
            :`Sem geração positiva, esse custo é coberto por aporte ou por mais dívida. `)
      +`Para comparar as ordens de grandeza: 1 ponto de margem sobre toda a receita vale ${mi(umPP)}, `
      +`e 1% a menos no valor de juros vale ${mi(umPctJuros)}.`,
    ev:[['Juros a terceiros',mi(juros)],['EBITDA',mi(eb)],
        ['Juros / receita líquida',pct(juros/rol,0)],['Resultado líquido',mi(g.result_liq)]],
    trigger:eb>0?`juros consomem ${pct(juros/eb,0)} do EBITDA (limiar 35%)`:'EBITDA não positivo com juros a pagar',
  };
};

/* ---------- 11. DRE · margem subiu, quantidade caiu ---------- */
R.dreMargemVolume=function(ctx){
  const g=ctx&&ctx.dre, p=ctx&&ctx.drePrev;
  if(!g||!p||!p.volume||!g.volume||!p.receita_liquida||!g.receita_liquida) return null;
  const dMc=g.mc_pct-p.mc_pct, dVol=g.volume/p.volume-1;
  if(Math.abs(dMc)<.02||Math.abs(dVol)<.08) return null;
  if(Math.sign(dMc)===Math.sign(dVol)) return null;
  const dMcAbs=g.margem_contrib-p.margem_contrib;
  const mcPorPeca=g.volume?g.margem_contrib/g.volume:0;
  const seVolIgual=mcPorPeca*p.volume;
  return {
    id:'dre-margem-volume', fam:'decomposicao',
    score:clamp(Math.abs(dMc)*12+Math.abs(dVol),0,1), tom:dMcAbs<0?'warn':'note',
    verdict:`Cada real vendido deixa <b>${pct(g.mc_pct,1)} contra ${pct(p.mc_pct,1)}</b> antes, mas saíram <b>${un(Math.abs(g.volume-p.volume))} a ${dVol<0?'menos':'mais'}</b>.`,
    texto:`Em dinheiro a margem ${dMcAbs>0?'cresceu':'caiu'} ${mi(Math.abs(dMcAbs))} — muito menos do que a melhora percentual sugere. `
      +(dMc>0
        ? `A margem melhorou porque mudou o tipo de peça vendida, não porque o custo caiu. `
        : `O crescimento veio de peças de margem menor. `)
      +`Na margem por peça de hoje (${money(mcPorPeca)}), o volume do período anterior daria ${mi(seVolIgual)}.`,
    ev:[['Margem por real',pct(p.mc_pct,1)+' → '+pct(g.mc_pct,1)],['Peças faturadas',nf(Math.round(p.volume))+' → '+nf(Math.round(g.volume))],
        ['Margem por peça',money(mcPorPeca)],['Margem em dinheiro',mi(dMcAbs)]],
    trigger:`margem (${nf(dMc*100,1)} p.p.) e quantidade (${spct(dVol,0)}) em direções opostas`,
  };
};

/* ---------- 12. DRE · o custo fixo cabe na margem? ---------- */
R.dreCustoFixoNivel=function(ctx){
  const g=ctx&&ctx.dre; if(!g||!g.receita_liquida) return null;
  const cf=-g.despesas_op, rol=g.receita_liquida, mc=g.mc_pct, mcAbs=g.margem_contrib;
  if(cf<=0||mc<=0) return null;
  const sh=cf/rol; if(sh<.55) return null;
  const peV=cf/mc, falta=peV-rol, buraco=cf-mcAbs;
  return {
    id:'dre-cf-nivel', fam:'consequencia',
    score:clamp((sh-.4)*2,0,1), tom:'warn',
    anchor:{labels:['(−) Custo Fixo','EBITDA']},
    verdict:`A margem gerada foi <b>${mi(mcAbs)}</b> e o custo fixo, <b>${mi(cf)}</b>. Faltaram <b>${mi(buraco)}</b>.`,
    texto:`Cada R$ 1 vendido deixa ${money(mc,2)} depois do custo do produto. `
      +`Para cobrir ${mi(cf)} de estrutura seria preciso vender ${mi(peV)} — a venda foi ${mi(rol)}. `
      +`O mesmo buraco de ${mi(buraco)} aparece de dois jeitos: ${mi(falta)} de venda a mais `
      +`(${pct(falta/rol,0)} acima de hoje) ou ${pct(buraco/cf,0)} da estrutura a menos.`,
    ev:[['Margem gerada',mi(mcAbs)],['Custo fixo',mi(cf)],
        ['Venda para empatar',mi(peV)],['Venda realizada',mi(rol)]],
    trigger:`custo fixo em ${pct(sh,0)} da receita líquida (limiar 55%)`,
  };
};

/* ---------- 13. DRE · o custo fixo pesa mais na receita ---------- */
R.dreCustoFixoRol=function(ctx){
  const g=ctx&&ctx.dre, p=ctx&&ctx.drePrev;
  if(!g||!p||!p.receita_liquida||!g.receita_liquida) return null;
  const cfA=-p.despesas_op, cfB=-g.despesas_op;
  if(cfA<=0||cfB<=0) return null;
  const shA=cfA/p.receita_liquida, shB=cfB/g.receita_liquida;
  if(shB-shA<.03) return null;
  const dRol=g.receita_liquida/p.receita_liquida-1, dCf=cfB/cfA-1;
  const seAcompanhasse=cfA*(1+dRol);
  return {
    id:'dre-cf-rol', fam:'divergencia',
    score:clamp((shB-shA)*8,0,1), tom:'warn',
    verdict:`O custo fixo passou a comer <b>${pct(shB,0)} da receita, contra ${pct(shA,0)}</b> antes.`,
    texto:`A receita ${dRol<0?'caiu':'subiu'} ${pct(Math.abs(dRol),1)} e o custo fixo ${dCf<0?'caiu':'subiu'} ${pct(Math.abs(dCf),1)}. `
      +`Para manter o peso de antes, o custo fixo do período seria ${mi(seAcompanhasse)} — `
      +`${mi(Math.abs(cfB-seAcompanhasse))} de diferença.`,
    ev:[['Peso na receita',pct(shA,1)+' → '+pct(shB,1)],['Receita',spct(dRol,1)],
        ['Custo fixo',spct(dCf,1)],['Diferença',mi(cfB-seAcompanhasse)]],
    trigger:`peso do custo fixo na receita subiu ${nf((shB-shA)*100,1)} p.p. (limiar 3 p.p.)`,
  };
};

/* ---------- 14. Dívida · quanto do saldo é juro ---------- */
R.dividaCorrecao=function(){
  const A=G.APORTES; if(!A||!A.saldo_atual) return null;
  const sh=A.total_correcao/A.saldo_atual;
  if(sh<.25) return null;
  const liq=A.total_remessas+A.total_recebimentos;
  const n=A.correcao.length;
  const cor12=n>12?A.correcao[n-1]-A.correcao[n-13]:null;
  return {
    id:'divida-correcao', fam:'decomposicao',
    score:clamp(sh*1.6,0,1), tom:'warn',
    anchor:{labels:['Correção/juros acumulados']},
    verdict:`A dívida com o acionista é <b>${mi(A.saldo_atual)}</b>, mas só <b>${mi(liq)} foi dinheiro que entrou</b> — ${mi(A.total_correcao)} é juro acumulado.`,
    texto:`Entraram ${mi(A.total_remessas)} ao longo do tempo e voltaram ${mi(Math.abs(A.total_recebimentos))}. `
      +`O resto do saldo é correção pelo CDI, que continua correndo todo mês sem ninguém tomar um real a mais. `
      +(cor12?`Só nos últimos 12 meses ela somou ${mi(cor12)}.`:''),
    ev:[['Saldo hoje',mi(A.saldo_atual)],['Dinheiro que entrou',mi(liq)],
        ['Juro acumulado',mi(A.total_correcao)],['Juro dos últimos 12m',cor12?mi(cor12):'—']],
    trigger:`correção representa ${pct(sh,0)} do saldo (limiar 25%)`,
  };
};

/* ---------- 15. Custos · quanto do custo da peça é a fábrica ---------- */
R.cpvAbsorcao=function(ctx){
  const rows=G.CUSTOS&&G.CUSTOS.cpv; if(!rows||!rows.length) return null;
  const a=ctx&&ctx.custosA; if(!a||a[0]==null) return null;
  let mp=0,mo=0,ggf=0,tot=0,q=0;
  for(const r of rows){ if(r[0]<a[0]||r[0]>a[1]) continue; mp+=r[3]; mo+=r[4]; ggf+=r[5]; tot+=r[6]; q+=r[2]; }
  if(!tot) tot=mp+mo+ggf;
  if(!tot||!q) return null;
  const shG=ggf/tot; if(shG<.45) return null;
  const unit=tot/q, unitVar=(mp+mo)/q;
  const q10=q*1.1, unit10=(ggf+(mp+mo)*1.1)/q10;
  return {
    id:'cpv-absorcao', fam:'oculto',
    score:clamp(shG,0,1), tom:'warn', anchor:{labels:['Gastos gerais','GGF']},
    verdict:`<b>${pct(shG,0)} do custo da peça é estrutura da fábrica</b>, não material — matéria-prima é só ${pct(mp/tot,0)}.`,
    texto:`Cada peça custa ${money(unit)}, dos quais ${money(unitVar)} são material e mão de obra. `
      +`O resto é a fábrica dividida pelo que foi produzido. `
      +`Por isso, quando a produção cai, o custo por peça sobe sozinho — nada ficou mais caro. `
      +`Com 10% mais peças, a mesma estrutura se dividiria melhor e o custo seria ${money(unit10)}.`,
    ev:[['Custo por peça',money(unit)],['Material e mão de obra',money(unitVar)],
        ['Estrutura da fábrica',pct(shG,1)],['Com 10% mais volume',money(unit10)]],
    trigger:`gastos gerais de fabricação em ${pct(shG,0)} do CPV (limiar 45%)`,
  };
};

/* ---------- 16. Custos · a composição do custo mudou ---------- */
R.cpvMix=function(ctx){
  const rows=G.CUSTOS&&G.CUSTOS.cpv; if(!rows||!rows.length) return null;
  const a=ctx&&ctx.custosA, b=ctx&&ctx.custosB;
  if(!a||!b||a[0]==null||b[0]==null) return null;
  const janela=(y0,y1)=>{ const o={mp:0,mo:0,ggf:0,q:0,tot:0};
    for(const r of rows){ if(r[0]<y0||r[0]>y1) continue;
      o.mp+=r[3]; o.mo+=r[4]; o.ggf+=r[5]; o.q+=r[2]; o.tot+=r[6]; }
    if(!o.tot) o.tot=o.mp+o.mo+o.ggf; return o; };
  const cur=janela(a[0],a[1]), pre=janela(b[0],b[1]);
  if(!cur.tot||!pre.tot||!cur.q||!pre.q) return null;
  const comps=[['Matéria-prima','mp'],['Mão de obra','mo'],['Estrutura da fábrica','ggf']];
  const movs=comps.map(([nome,k])=>({nome,k,shA:pre[k]/pre.tot,shB:cur[k]/cur.tot}))
                  .map(m=>({...m,d:m.shB-m.shA}));
  movs.sort((x,y)=>Math.abs(y.d)-Math.abs(x.d));
  const m=movs[0]; if(Math.abs(m.d)<.03) return null;
  const uA=pre.tot/pre.q, uB=cur.tot/cur.q;
  const unitA=pre[m.k]/pre.q, unitB=cur[m.k]/cur.q;
  return {
    id:'cpv-mix', fam:'decomposicao',
    score:clamp(Math.abs(m.d)*10,0,1), tom:m.d>0?'warn':'note',
    anchor:{labels:m.k==='ggf'?[m.nome,'GGF']:[m.nome]},
    verdict:`<b>${esc(m.nome)} foi de ${pct(m.shA,0)} para ${pct(m.shB,0)} do custo da peça</b> entre os dois períodos.`,
    texto:`Por peça, ${esc(m.nome).toLowerCase()} passou de ${money(unitA)} para ${money(unitB)}, `
      +`enquanto o custo total por peça foi de ${money(uA)} para ${money(uB)}. `
      +`A conta fechada quase não mudou; o que mudou foi de onde vem o custo. `
      +`A diferença de ${money(Math.abs(unitB-unitA))} por peça vale ${mi(Math.abs(unitB-unitA)*cur.q)} no período.`,
    ev:[[m.nome+' por peça',money(unitA)+' → '+money(unitB)],['Participação',pct(m.shA,1)+' → '+pct(m.shB,1)],
        ['Custo total por peça',money(uA)+' → '+money(uB)],['Peças no período',nf(Math.round(cur.q))]],
    trigger:`participação de ${esc(m.nome)} variou ${nf(m.d*100,1)} p.p. (limiar 3 p.p.)`,
  };
};

/* ---------- 17. Meta · a distância não é a mesma todo mês (quadro) ---------- */
R.metaDispersao=function(ctx){
  const M=ctx&&ctx.metas; if(!M) return null;
  const n=M.iUlt+1; if(n<4) return null;
  const at=[]; for(let i=0;i<=M.iUlt;i++){ if(!M.meta[i]) return null; at.push(M.realizado[i]/M.meta[i]); }
  const iBom=argmax(at), iRuim=argmin(at);
  const amp=at[iBom]-at[iRuim];
  if(amp<.15) return null;
  const metaPer=sum(M.meta.slice(0,n)), realPer=sum(M.realizado.slice(0,n));
  const gap=metaPer-realPer, gapSeBom=metaPer*(1-at[iBom]);
  return {
    id:'meta-dispersao', fam:'padrao', tabela:true,
    score:clamp(amp*1.6,0,1), tom:'warn',
    verdict:`A distância para a meta varia muito: <b>${pct(1-at[iBom],0)} em ${ymLab(M.yms[iBom])} e ${pct(1-at[iRuim],0)} em ${ymLab(M.yms[iRuim])}</b>.`,
    texto:`Não é uma diferença fixa mês a mês. ${ymLab(M.yms[iBom])} chegou perto: vendeu ${mi(M.realizado[iBom])} `
      +`contra ${mi(M.meta[iBom])} de meta. ${ymLab(M.yms[iRuim])} ficou ${mi(M.meta[iRuim]-M.realizado[iRuim])} atrás. `
      +`Se os ${n} meses tivessem repetido ${ymLab(M.yms[iBom])}, o buraco do período seria ${mi(gapSeBom)} em vez de ${mi(gap)}.`,
    ev:[['Melhor mês · '+ymLab(M.yms[iBom]),pct(at[iBom],0)+' da meta'],['Pior mês · '+ymLab(M.yms[iRuim]),pct(at[iRuim],0)+' da meta'],
        ['Buraco no período',mi(gap)],['Se todos fossem como o melhor',mi(gapSeBom)]],
    trigger:`${nf(amp*100,0)} pontos entre o melhor e o pior mês de atingimento (limiar 15)`,
  };
};

/* ---------- 18. Evolutiva · venda contratada × faturamento (quadro) ---------- */
R.vendaVsFaturamento=function(ctx){
  const V=ctx&&ctx.vendaAnual, D=G.DRE; if(!V||!D) return null;
  const anoAtual=Math.floor(MAXYM_VENDAS/100);
  const anos=Object.keys(V).map(Number)
    .filter(y=>y<anoAtual&&D[y]&&D[y].annual>0&&V[y]>0).sort();
  if(anos.length<3) return null;
  const ult=anos[anos.length-1];
  const linhas=anos.map(y=>({y, venda:V[y], fat:D[y].annual, dif:V[y]-D[y].annual}));
  const acumDif=sum(linhas.map(l=>l.dif));
  const relevantes=linhas.filter(l=>Math.abs(l.dif)/l.venda>=.12);
  if(!relevantes.length) return null;
  const maior=relevantes[relevantes.length-1];
  const ultima=linhas[linhas.length-1];
  return {
    id:'venda-vs-faturamento', fam:'divergencia', tabela:true,
    score:clamp(Math.abs(maior.dif)/maior.venda*2.5,0,1), tom:'note',
    verdict:`Em ${maior.y} a empresa vendeu <b>${mi(Math.abs(maior.dif))} ${maior.dif>0?'a mais do que faturou':'a menos do que faturou'}</b> — ${pct(Math.abs(maior.dif)/maior.venda,0)} de diferença.`,
    texto:`As duas colunas medem coisas diferentes: a venda é o pedido assinado, o faturamento é a nota emitida. `
      +`Entre um e outro passa a produção, e o pedido de um ano vira nota no seguinte. `
      +`Somando ${anos[0]} a ${ult}, foram vendidos ${mi(acumDif)} ${acumDif>0?'além':'aquém'} do que já virou nota. `
      +`O contratado em ${ultima.y} foi ${mi(ultima.venda)}.`,
    ev:[['Venda contratada '+maior.y,mi(maior.venda)],['Faturamento '+maior.y,mi(maior.fat)],
        ['Diferença',mi(maior.dif)],['Acumulado '+anos[0]+'–'+ult,mi(acumDif)]],
    trigger:`diferença de ${pct(Math.abs(maior.dif)/maior.venda,0)} entre pedido e nota em ${maior.y} (limiar 12%)`,
  };
};

/* ---------- 19. Custo fixo · em quantas linhas está o dinheiro (quadro) ---------- */
R.cfConcentracao=function(ctx){
  const CAT=(ctx&&ctx.cats)||(G.CF&&G.CF.categoria); if(!CAT) return null;
  const itens=Object.keys(CAT).map(k=>({nome:k,v:sum(CAT[k])})).filter(o=>o.v>0)
                .sort((a,b)=>b.v-a.v);
  if(itens.length<4) return null;
  const tot=sum(itens.map(o=>o.v)); if(!tot) return null;
  const duas=(itens[0].v+itens[1].v)/tot;
  if(duas<.6) return null;
  const cauda=itens.slice(2), vCauda=sum(cauda.map(o=>o.v));
  const meses=(G.CF&&G.CF.meses&&G.CF.meses.length)||12;
  return {
    id:'cf-concentracao'+((ctx&&ctx.entidade&&ctx.entidade!=='CONSOLIDADO')?'-'+ctx.entidade.toLowerCase():''),
    fam:'concentracao', tabela:true,
    score:clamp((duas-.4)*2,0,1), tom:'note',
    anchor:{labels:[itens[0].nome,itens[1].nome]},
    verdict:`<b>${esc(itens[0].nome)} e ${esc(itens[1].nome)} são ${pct(duas,0)} do custo fixo</b> — ${mi(itens[0].v+itens[1].v)} em ${meses} meses.`,
    texto:`As outras ${cauda.length} categorias somadas dão ${mi(vCauda)}, ${pct(vCauda/tot,0)} do total. `
      +`Dez por cento de ${esc(itens[0].nome)} valem ${mi(itens[0].v*.1/meses)} por mês; `
      +`os mesmos 10% em todas as outras ${cauda.length} juntas valem ${mi(vCauda*.1/meses)}.`,
    ev:[[itens[0].nome,mi(itens[0].v)],[itens[1].nome,mi(itens[1].v)],
        ['Somadas',pct(duas,0)+' do total'],['Outras '+cauda.length+' categorias',mi(vCauda)]],
    trigger:`duas maiores categorias com ${pct(duas,0)} do custo fixo (limiar 60%)`,
  };
};

/* ---------- 20. DRE · a linha que mais mexeu no resultado (quadro) ---------- */
R.dreLinhaQueMudou=function(ctx){
  const g=ctx&&ctx.dre, p=ctx&&ctx.drePrev; if(!g||!p||!p.receita_liquida) return null;
  const linhas=[
    ['Receita líquida','receita_liquida'],
    ['Custos variáveis','custos_var'],
    ['Custo fixo','despesas_op'],
    ['Depreciação','deprec'],
    ['Resultado financeiro','financeiro'],
  ];
  const movs=linhas.map(([nome,k])=>({nome,k,a:p[k]||0,b:g[k]||0,d:(g[k]||0)-(p[k]||0)}))
                   .filter(m=>isFinite(m.d));
  if(!movs.length) return null;
  movs.sort((x,y)=>Math.abs(y.d)-Math.abs(x.d));
  const m=movs[0];
  const dResult=g.result_liq-p.result_liq;
  if(!dResult||Math.abs(m.d)<Math.abs(dResult)*.3) return null;
  const ajuda=Math.sign(m.d)===Math.sign(dResult);
  const resto=dResult-m.d;
  const engole=Math.abs(m.d)>Math.abs(dResult);
  const outras=movs.slice(1,3);
  const nome=esc(m.nome).toLowerCase();
  return {
    id:'dre-linha-que-mudou', fam:'decomposicao', tabela:true,
    score:clamp(Math.abs(m.d)/Math.max(Math.abs(dResult),1)*.6,0,1),
    tom:(engole&&ajuda)?'warn':(dResult>=0?'ok':'warn'),
    verdict:engole&&ajuda
      ? `O resultado ${dResult>0?'melhorou':'piorou'} ${mi(Math.abs(dResult))}, mas <b>${nome} sozinho ${dResult>0?'trouxe':'tirou'} ${mi(Math.abs(m.d))}</b> — o resto da DRE andou para o outro lado.`
      : `O resultado ${dResult>0?'melhorou':'piorou'} ${mi(Math.abs(dResult))} e <b>${nome} responde por ${mi(Math.abs(m.d))}</b> disso.`,
    texto:`Linha a linha contra o período anterior, ${nome} foi de ${mi(m.a)} para ${mi(m.b)}. `
      +(engole&&ajuda
        ? `Somadas, as outras linhas ${resto<0?'consumiram':'somaram'} ${mi(Math.abs(resto))} — sem ${nome}, `
          +`o resultado teria ${resto<0?'piorado':'melhorado'} ${mi(Math.abs(resto))}.`
        : `Os dois movimentos seguintes foram `
          +outras.map(o=>esc(o.nome).toLowerCase()+' ('+mi(o.d)+')').join(' e ')+`.`),
    ev:[[m.nome,mi(m.a)+' → '+mi(m.b)],['Efeito no resultado',mi(m.d)],
        ['Variação do resultado',mi(dResult)],['Demais linhas',mi(resto)]],
    trigger:`maior movimento de linha vale ${nf(Math.abs(m.d/dResult),2)}× a variação do resultado (limiar 0,30×)`,
  };
};

/* =====================================================================
   MOTOR AUTOMÁTICO — cobertura de todo gráfico e todo quadro
   ---------------------------------------------------------------------
   "2 de 9 vendedores fazem metade" é 1º grau: quem olha o gráfico de barras
   já viu. O que não se vê é o CRUZAMENTO — quem lidera em dinheiro não
   liderar em pedidos, a taxa efetiva variar entre iguais, o perfil de um
   item destoar da média da casa.

   R.auto recebe um ranking com as métricas que a figura tiver e escolhe
   sozinho a leitura mais forte entre as disponíveis. Uma única chamada
   cobre qualquer ranking do relatório.

   ctx: {itens:[{name, v, q, peds, extra}], escopo, escopoPl, universo,
         id, tabela, rotuloExtra}
     v     = valor (obrigatório)
     q     = quantidade de peças        (opcional)
     peds  = número de pedidos          (opcional)
     extra = repasse pago sobre v       (opcional: royalty, RT, comissão)
   ===================================================================== */

/* ---------- leitura A: quem lidera em dinheiro não lidera em esforço ---------- */
function _divergencia(it,ctx){
  const comQ=it.filter(x=>x.peds>0||x.q>0);
  if(comQ.length<4) return null;
  const chave=comQ[0].peds>0?'peds':'q';
  const rotulo=chave==='peds'?'pedidos':'peças';
  /* os dois rankings só valem comparação dentro do núcleo: um "líder em
     pedidos" que representa 1% do faturamento não é notícia. */
  const nucleo=nucleoMaterial(comQ,'v',.85,4);
  const porValor=[...nucleo].sort((a,b)=>b.v-a.v);
  const porVol=[...nucleo].sort((a,b)=>(b[chave]||0)-(a[chave]||0));
  if(porValor[0].name===porVol[0].name) return null;      // sem divergência, nada a dizer
  const lv=porValor[0], lq=porVol[0];
  const tkV=lv[chave]?lv.v/lv[chave]:0, tkQ=lq[chave]?lq.v/lq[chave]:0;
  if(!tkV||!tkQ) return null;
  const razao=tkV/tkQ;
  if(razao<1.25&&razao>.8) return null;
  return {
    fam:'divergencia', score:clamp(Math.abs(razao-1),0,1), tom:'note',
    anchor:{labels:[lv.name,lq.name]},
    verdict:`Quem mais vende em dinheiro não é quem mais vende em ${rotulo}: `
      +`<b>${esc(trunc(lv.name,30))} lidera em valor, ${esc(trunc(lq.name,30))} em ${rotulo}</b>.`,
    texto:`${esc(trunc(lv.name,30))} fez ${mi(lv.v)} em ${nf(lv[chave])} ${rotulo} — ${money(tkV)} cada. `
      +`${esc(trunc(lq.name,30))} fez ${nf(lq[chave])} ${rotulo} para ${mi(lq.v)}, ${money(tkQ)} cada. `
      +`Cada negócio de ${esc(trunc(lv.name,24))} vale ${nf(razao,1)}× o de ${esc(trunc(lq.name,24))}. `
      +`Quem traz mais dinheiro e quem fecha mais negócios são pessoas diferentes.`,
    ev:[['Líder em valor',esc(trunc(lv.name,22))],['Valor por '+rotulo.replace(/s$/,''),money(tkV)],
        ['Líder em '+rotulo,esc(trunc(lq.name,22))],['Valor por '+rotulo.replace(/s$/,''),money(tkQ)]],
    trigger:`o primeiro de cada lista é uma pessoa diferente, com ${nf(razao,2)}× de diferença no valor médio do pedido`,
  };
}

/* ---------- leitura B: a mesma regra custa preços diferentes ---------- */
function _taxaEfetiva(it,ctx){
  const comExtra=it.filter(x=>x.extra>0&&x.v>0).sort((a,b)=>b.extra-a.extra);
  if(comExtra.length<4) return null;
  const totExtra=sum(comExtra.map(x=>x.extra)), totV=sum(comExtra.map(x=>x.v));
  if(!totExtra||!totV) return null;
  /* MATERIALIDADE: so entram na comparacao os itens que sustentam 80% do valor
     pago. Sem esse corte, o "extremo" sai da cauda — o maior percentual pago
     costuma ser de quem representa 2% do total, e comparar com ele nao muda
     decisao nenhuma. */
  const k80=quantosPara(comExtra.map(x=>x.extra),.8);
  const nucleo=comExtra.slice(0,Math.max(k80,3));
  if(nucleo.length<2) return null;
  const taxas=nucleo.map(x=>({name:x.name, t:x.extra/x.v, extra:x.extra, v:x.v}))
                    .sort((a,b)=>b.t-a.t);
  const alta=taxas[0], baixa=taxas[taxas.length-1];
  if(!baixa.t) return null;
  const razao=alta.t/baixa.t;
  if(razao<1.25) return null;
  const media=totExtra/totV;
  const pesoNucleo=sum(nucleo.map(x=>x.extra))/totExtra;
  /* quanto custa a diferenca: o que se pagaria a mais aos do nucleo se todos
     estivessem na taxa do mais caro, contra a taxa do mais barato */
  const vNucleo=sum(nucleo.map(x=>x.v));
  const custoDaDiferenca=vNucleo*(alta.t-baixa.t);
  return {
    fam:'oculto', score:clamp((razao-1)/2+pesoNucleo*.3,0,1), tom:'note',
    anchor:{labels:[alta.name,baixa.name]},
    verdict:`Entre ${artPl(ctx.escopoPl,'os','as')} ${nucleo.length} ${esc(ctx.escopoPl||'itens')} que concentram ${pct(pesoNucleo,0)} ${esc(ctx.universo||'do total')}, `
      +`a taxa de ${esc(ctx.rotuloExtra||'repasse')} vai de <b>${pct(baixa.t,1)} a ${pct(alta.t,1)}</b>.`,
    texto:`${esc(trunc(alta.name,30))} fica com ${pct(alta.t,1)} do que vende, e `
      +`${esc(trunc(baixa.name,30))}, com ${pct(baixa.t,1)} — mesmo tipo de acordo, ${nf(razao,1)}× de diferença. `
      +`Na média, o grupo fica com ${pct(media,1)}. `
      +`Sobre os ${mi(vNucleo)} que esse grupo movimenta, a distância entre o maior e o menor vale ${mi(custoDaDiferenca)}.`,
    ev:[[esc(trunc(alta.name,20)),pct(alta.t,1)],[esc(trunc(baixa.name,20)),pct(baixa.t,1)],
        ['Média do conjunto',pct(media,1)],['Vale a diferença',mi(custoDaDiferenca)]],
    trigger:`entre ${artPl(ctx.escopoPl,'os','as')} ${esc(ctx.escopoPl||'itens')} que fazem 80% do valor, taxa variando ${nf(razao,2)}× (limiar 1,25×)`,
  };
}

/* ---------- leitura C: a cauda vale mais do que parece ---------- */
function _cauda(it,ctx){
  if(it.length<8) return null;
  const vals=it.map(x=>x.v), tot=sum(vals);
  const topo=Math.min(5,Math.floor(it.length/3));
  const vTopo=sum(vals.slice(0,topo)), vCauda=tot-vTopo;
  const nCauda=it.length-topo;
  if(vCauda/tot<.35) return null;
  const medioCauda=vCauda/nCauda, medioTopo=vTopo/topo;
  /* a cauda só é notícia se, somada, pesar mais que o topo por item — senão é
     só a forma normal de qualquer ranking */
  if(medioTopo/Math.max(medioCauda,1)>60) return null;
  return {
    fam:'concentracao', score:clamp(vCauda/tot,0,1), tom:'note',
    verdict:`Fora ${artPl(ctx.escopoPl,'dos','das')} ${topo} maiores, ${artPl(ctx.escopoPl,'os outros','as outras')} ${nf(nCauda)} ${esc(ctx.escopoPl||'itens')} somam `
      +`<b>${mi(vCauda)} — ${pct(vCauda/tot,0)}</b> ${esc(ctx.universo||'do total')}.`,
    texto:`Quem lê um ranking costuma parar nos primeiros nomes, mas aqui o resto da lista não é sobra: `
      +`são ${pct(nCauda/it.length,0)} ${artPl(ctx.escopoPl,'dos','das')} ${esc(ctx.escopoPl||'itens')}, e ${artPl(ctx.escopoPl,'juntos valem','juntas valem')} ${pct(vCauda/tot,0)} do total. `
      +`Cada um vale ${money(medioCauda)} em média, contra ${money(medioTopo)} de quem está no topo.`,
    ev:[['Fora do top '+topo,mi(vCauda)],['% do total',pct(vCauda/tot,0)],
        ['Média do resto da lista',money(medioCauda)],['Média do topo',money(medioTopo)]],
    trigger:`o resto da lista soma ${pct(vCauda/tot,0)} do valor (limiar 35%)`,
  };
}

/* ---------- leitura D: concentração (último recurso) ---------- */
function _concentracao(it,ctx){
  if(it.length<5) return null;
  const vals=it.map(x=>x.v), tot=sum(vals);
  const k50=quantosPara(vals,.5), k80=quantosPara(vals,.8);
  const p1=vals[0]/tot;
  const i80=Math.min(k80,it.length-1);
  const queda1=1-vals[k50]/vals[0];
  const queda2=1-vals[i80]/Math.max(vals[k50],1);
  /* a frase so se sustenta se o degrau do comeco for maior que o do meio */
  if(!(queda1>queda2+.12)) return null;
  return {
    fam:'concentracao', score:clamp(p1,0,.6), tom:'note',
    anchor:{labels:it.slice(0,k50).map(x=>x.name)},
    verdict:`O primeiro vale <b>${money(vals[0])}</b>; o ${k50+1}º já cai para <b>${money(vals[k50])}</b> — e daí para baixo a lista quase não muda.`,
    texto:`A diferença grande está no começo da lista, não no fim. `
      +`Do primeiro para o ${k50+1}º a queda é de ${pct(queda1,0)}; do ${k50+1}º para o ${i80+1}º, só ${pct(queda2,0)}. `
      +`Do ${i80+1}º em diante, cada um vale em média ${money(sum(vals.slice(k80))/Math.max(it.length-k80,1))}. `
      +`Metade ${esc(ctx.universo||'do total')} está em ${k50} de ${nf(it.length)} ${esc(ctx.escopoPl||'itens')}.`,
    ev:[[(ctx.escopoPl||'Itens'),nf(it.length)],['Bastam para 50%',nf(k50)],
        ['Bastam para 80%',nf(k80)],['Maior isolado',pct(p1,1)]],
    trigger:`leitura de estrutura do ranking (sem métrica cruzada disponível)`,
  };
}

/* ---------- leitura E: a distância do primeiro para a média ---------- */
/* Último recurso, para quando nenhuma das outras passa. Olhar o topo de um
   ranking é fácil; o que não se vê é quanto ele está acima do que é normal
   naquele grupo — e quantos itens ficam abaixo da própria média. */
function _relacao(it,ctx){
  if(it.length<3) return null;
  const vals=it.map(x=>x.v), tot=sum(vals), med=tot/it.length;
  if(!med) return null;
  const razao=vals[0]/med;
  const abaixo=vals.filter(v=>v<med).length;
  const seg=vals[1]||0;
  return {
    fam:'concentracao', score:clamp((razao-1)/6,0,.35), tom:'note',
    anchor:{labels:[it[0].name]},
    verdict:`${esc(trunc(it[0].name,30))} vale <b>${nf(razao,1)}× a média</b> ${esc(ctx.universo||'do grupo')} `
      +`— ${money(vals[0])} contra ${money(med)}.`,
    texto:`São ${nf(it.length)} ${esc(ctx.escopoPl||'itens')} no período, somando ${mi(tot)}. `
      +(seg?`Do primeiro para o segundo já cai ${pct(1-seg/vals[0],0)}. `:'')
      +`${abaixo} deles ficam abaixo da média de ${money(med)} — ou seja, a média não descreve o grupo: `
      +`ela é puxada para cima por poucos.`,
    ev:[[(ctx.escopoPl||'Itens'),nf(it.length)],['Maior',money(vals[0])],
        ['Média',money(med)],['Abaixo da média',nf(abaixo)+' de '+nf(it.length)]],
    trigger:`leitura de referência do ranking (as demais não passaram no gatilho)`,
  };
}

/* ---------- o motor: escolhe a leitura mais forte que os dados permitem ---------- */
R.auto=function(ctx){
  const it=((ctx&&ctx.itens)||[]).filter(x=>x&&x.v>0).sort((a,b)=>b.v-a.v);
  if(it.length<3) return null;
  const leituras={divergencia:_divergencia,taxa:_taxaEfetiva,cauda:_cauda,estrutura:_concentracao,
                  relacao:_relacao};
  /* ctx.preferir: quando o mesmo dado alimenta um grafico e um quadro, cada um
     pede uma leitura diferente — senao os dois diriam a mesma frase. */
  const ordem=(ctx.preferir||[]).concat(['divergencia','taxa','cauda','estrutura','relacao']);
  const vistos=new Set(); const cand=[];
  ordem.forEach(k=>{ if(vistos.has(k)||!leituras[k]) return; vistos.add(k);
    const r=leituras[k](it,ctx); if(r){ r._leitura=k; cand.push(r); } });
  if(!cand.length) return null;
  if(ctx.preferir&&ctx.preferir.length){
    const pref=cand.find(c=>ctx.preferir.includes(c._leitura));
    if(pref) return Object.assign(pref,{id:'auto-'+(ctx.id||'geral'),tabela:!!ctx.tabela});
  }
  cand.sort((a,b)=>b.score-a.score);
  const melhor=cand[0];
  return Object.assign(melhor,{
    id:'auto-'+(ctx.id||'geral'),
    tabela:!!ctx.tabela,
  });
};

/* ---------- matriz cruzada: quem tem o perfil mais diferente ---------- */
/* Um mapa de calor mostra intensidade, e é isso que se vê batendo o olho.
   O que ele não mostra é o DESVIO DE PERFIL: a média da casa não descreve
   ninguém, e quem mais destoa dela é a informação que não está desenhada.
   ctx: {linhas:[nome], colunas:[nome], mat:{linha:{coluna:valor}}, escopo, id} */
R.mixCruzado=function(ctx){
  const L=(ctx&&ctx.linhas)||[], C=(ctx&&ctx.colunas)||[], M=(ctx&&ctx.mat)||{};
  if(L.length<3||C.length<3) return null;
  const totCol={};
  C.forEach(c=>{ totCol[c]=sum(L.map(l=>(M[l]&&M[l][c])||0)); });
  const totGeral=sum(C.map(c=>totCol[c])); if(!totGeral) return null;
  const mixCasa={}; C.forEach(c=>mixCasa[c]=totCol[c]/totGeral);
  /* Olhar para QUEM VENDE MAIS, nao para quem mais destoa. O maior desvio de
     perfil quase sempre e de quem vende pouco — chamar atencao para ele gasta o
     tempo de quem analisa. O que interessa e por onde os lideres chegaram la,
     porque e isso que se pode tentar repetir com os demais. */
  const perfis=L.map(l=>{
    const tl=sum(C.map(c=>(M[l]&&M[l][c])||0));
    if(!tl) return null;
    let dist=0, forte=null, forteD=0, fraco=null, fracoD=0;
    C.forEach(c=>{
      const sh=((M[l]&&M[l][c])||0)/tl, d=sh-mixCasa[c];
      dist+=Math.abs(d);
      if(d>forteD){ forteD=d; forte=c; }
      if(d<fracoD){ fracoD=d; fraco=c; }
    });
    return {nome:l, tl, peso:tl/totGeral, dist:dist/2, forte, forteD, fraco, fracoD,
            shForte:forte?((M[l]&&M[l][forte])||0)/tl:0};
  }).filter(Boolean).sort((a,b)=>b.tl-a.tl);
  if(perfis.length<2) return null;
  const p1=perfis[0], p2=perfis[1];
  /* só vale a pena falar se os dois maiores chegaram por caminhos diferentes */
  if(!p1.forte||!p2.forte) return null;
  const mesmaAlavanca=p1.forte===p2.forte;
  if(p1.forteD<.04&&p2.forteD<.04) return null;
  const juntos=p1.peso+p2.peso;
  return {
    id:'mix-cruzado-'+(ctx.id||'geral'), fam:'oculto', tabela:!!ctx.tabela,
    score:clamp(juntos*.6+Math.max(p1.forteD,p2.forteD)*2,0,1), tom:'note',
    anchor:{labels:[p1.nome,p2.nome]},
    verdict:mesmaAlavanca
      ? `Os dois maiores fazem ${pct(juntos,0)} da venda e <b>ambos se apoiam em ${esc(p1.forte)}</b> — `
        +`${pct(p1.shForte,0)} e ${pct(p2.shForte,0)}, contra ${pct(mixCasa[p1.forte],0)} da casa.`
      : `<b>${esc(trunc(p1.nome,26))} chega ao topo por ${esc(p1.forte)}; ${esc(trunc(p2.nome,26))}, por ${esc(p2.forte)}</b> — `
        +`os dois maiores não vendem a mesma coisa.`,
    texto:`${esc(trunc(p1.nome,26))} lidera com ${mi(p1.tl)}, e ${pct(p1.shForte,0)} disso é ${esc(p1.forte)} `
      +`— a casa vende ${pct(mixCasa[p1.forte],0)}. `
      +(mesmaAlavanca
        ? `${esc(trunc(p2.nome,26))} repete a receita: ${pct(p2.shForte,0)} em ${esc(p1.forte)}. `
          +`A categoria que sustenta o topo é a mesma, e o que separa os dois é volume, não mix.`
        : `${esc(trunc(p2.nome,26))} vem logo atrás com ${mi(p2.tl)}, mas apoiado em ${esc(p2.forte)}: `
          +`${pct(((M[p2.nome]&&M[p2.nome][p2.forte])||0)/p2.tl,0)} contra ${pct(mixCasa[p2.forte],0)} da casa. `
          +`São dois caminhos diferentes para chegar ao mesmo lugar, e isso não aparece olhando o mapa.`)
      +(p1.fraco?` A categoria em que ${esc(trunc(p1.nome,20))} vende menos que a casa é ${esc(p1.fraco)}: `
        +`${pct(((M[p1.nome]&&M[p1.nome][p1.fraco])||0)/p1.tl,0)} contra ${pct(mixCasa[p1.fraco],0)}.`:''),
    ev:[['Líder',esc(trunc(p1.nome,20))],['Apoia-se em',esc(p1.forte)+' · '+pct(p1.shForte,0)],
        ['2º lugar',esc(trunc(p2.nome,20))],['Apoia-se em',esc(p2.forte)+' · '+pct(((M[p2.nome]&&M[p2.nome][p2.forte])||0)/p2.tl,0)]],
    trigger:`perfil dos dois maiores (${pct(juntos,0)} do valor), não do mais destoante`,
  };
};

/* ---------- composição contra o período anterior ---------- */
/* ctx: {itens:[{name,v}], anteriores:[{name,v}], escopo, id, tabela} */
R.composicaoDeslocou=function(ctx){
  const A=(ctx&&ctx.anteriores)||[], B=(ctx&&ctx.itens)||[];
  if(A.length<3||B.length<3) return null;
  const ma={},mb={};
  A.forEach(x=>{ if(x.v>0) ma[x.name]=x.v; });
  B.forEach(x=>{ if(x.v>0) mb[x.name]=x.v; });
  const tA=sum(Object.values(ma)), tB=sum(Object.values(mb));
  if(!tA||!tB) return null;
  const nomes=new Set([...Object.keys(ma),...Object.keys(mb)]);
  let maior=null;
  nomes.forEach(n=>{
    const shA=(ma[n]||0)/tA, shB=(mb[n]||0)/tB, d=shB-shA;
    if(!maior||Math.abs(d)>Math.abs(maior.d)) maior={n,shA,shB,d};
  });
  if(!maior||Math.abs(maior.d)<.04) return null;
  return {
    id:'composicao-'+(ctx.id||'geral'), fam:'padrao', tabela:!!ctx.tabela,
    score:clamp(Math.abs(maior.d)*8,0,1), tom:'note',
    anchor:{labels:[maior.n]},
    verdict:`<b>${esc(maior.n)} foi de ${pct(maior.shA,0)} para ${pct(maior.shB,0)}</b> da composição `
      +`entre os dois períodos.`,
    texto:`O total pode ter mudado pouco, mas o peso de cada parte mudou. `
      +`${esc(maior.n)} é a que mais se deslocou: ${nf(Math.abs(maior.d)*100,1)} pontos `
      +`${maior.d>0?'a mais':'a menos'}. `
      +`Aplicado ao total de hoje, esse deslocamento vale ${mi(Math.abs(maior.d)*tB)}.`,
    ev:[[maior.n+' · antes',pct(maior.shA,1)],[maior.n+' · agora',pct(maior.shB,1)],
        ['Deslocamento',nf(maior.d*100,1)+' p.p.'],['Vale hoje',mi(Math.abs(maior.d)*tB)]],
    trigger:`maior deslocamento de participação: ${nf(maior.d*100,1)} p.p. (limiar 4 p.p.)`,
  };
};

/* =====================================================================
   REGRAS DA SEÇÃO DE ANÁLISE DE VENDAS
   ===================================================================== */

/* ---------- o que separa a líder do resto ---------- */
R.lider=function(ctx){
  const L=ctx&&ctx.lider, M=ctx&&ctx.medDemais, D=ctx&&ctx.demais;
  if(!L||!M||!D||!D.length) return null;
  const fatores=[
    {nome:'clientes atendidos', l:L.clis, m:D.reduce((s,x)=>s+x.clis,0)/D.length},
    {nome:'pedidos por cliente', l:L.pedCli, m:M.pedCli},
    {nome:'ticket por pedido', l:L.ticket, m:M.ticket},
  ].map(f=>({...f, r:f.m?f.l/f.m:0}));
  const forte=fatores.reduce((b,f)=>f.r>b.r?f:b,fatores[0]);
  const fraco=fatores.reduce((b,f)=>f.r<b.r?f:b,fatores[0]);
  const razaoVenda=M.v?L.v/M.v:0;
  if(razaoVenda<1.3) return null;
  /* a venda é o produto dos três fatores: se a vantagem estivesse distribuída,
     cada um seria a raiz cúbica da razão total */
  const esperado=Math.pow(razaoVenda,1/3);
  return {
    id:'lider-retrato', fam:'decomposicao', tabela:true,
    score:clamp((forte.r-1)/2,0,1), tom:'ok',
    verdict:`${esc(trunc(L.name,26))} vende <b>${nf(razaoVenda,1)}× a média do time</b>, e a vantagem `
      +`não está espalhada: está em <b>${esc(forte.nome)}</b> (${nf(forte.r,1)}×).`,
    texto:`A venda de qualquer vendedor vem de três coisas multiplicadas: quantos clientes atende, `
      +`quantas vezes cada um compra e quanto vale cada pedido. `
      +`Se a vantagem fosse igual nos três, cada um seria ${nf(esperado,2)}× a média. `
      +`Não é o caso: ${esc(forte.nome)} está em ${nf(forte.r,1)}× e ${esc(fraco.nome)}, em ${nf(fraco.r,2)}×. `
      +`É um fator só puxando o resultado — e é nele que está o que ela faz de diferente.`,
    ev:[['Venda vs média do time',nf(razaoVenda,1)+'×'],['Maior vantagem',esc(forte.nome)+' · '+nf(forte.r,1)+'×'],
        ['Menor vantagem',esc(fraco.nome)+' · '+nf(fraco.r,2)+'×'],['Se fosse parelho',nf(esperado,2)+'× em cada']],
    trigger:`líder a ${nf(razaoVenda,1)}× a média, com os três fatores muito diferentes entre si (limiar 1,3×)`,
  };
};

/* ---------- os três fatores, lado a lado ---------- */
R.fatoresLider=function(ctx){
  const F=ctx&&ctx.fatores; if(!F||F.length<3) return null;
  const com=F.map(f=>({...f, r:f.d?f.l/f.d-1:0}));
  const acima=com.filter(f=>f.r>.1), abaixo=com.filter(f=>f.r<-.05);
  if(!acima.length) return null;
  const maior=com.reduce((b,f)=>f.r>b.r?f:b,com[0]);
  return {
    id:'lider-fatores', fam:'decomposicao',
    score:clamp(maior.r,0,1), tom:'note',
    anchor:{labels:[maior.nome]},
    verdict:abaixo.length
      ? `A líder está <b>${spct(maior.r,0)} em ${esc(maior.nome.toLowerCase())}</b>, mas `
        +`<b>${spct(abaixo[0].r,0)} em ${esc(abaixo[0].nome.toLowerCase())}</b>.`
      : `A líder está acima da média nos três fatores, com <b>${spct(maior.r,0)} em ${esc(maior.nome.toLowerCase())}</b>.`,
    texto:com.map(f=>`${esc(f.nome)}: ${f.f(f.l)} contra ${f.f(f.d)} da média (${spct(f.r,0)})`).join('. ')+'. '
      +(abaixo.length
        ? `Ou seja: ela não faz tudo melhor que os outros. Onde está atrás, há espaço para melhorar o `
          +`resultado dela também — e onde está muito à frente é o que vale entender e tentar repetir com o time.`
        : `A vantagem aparece nos três, o que costuma indicar carteira diferente, não técnica diferente.`),
    ev:com.map(f=>[f.nome,f.f(f.l)+' × '+f.f(f.d)]),
    trigger:`maior fator a ${spct(maior.r,0)} da média do time`,
  };
};

/* ---------- quanto vale fechar a distância de ticket ---------- */
R.potencialTicket=function(ctx){
  const cen=ctx&&ctx.cen, L=ctx&&ctx.lider;
  if(!cen||!cen.length||!L||!ctx.totDemais) return null;
  const ganho=ctx.ganhoTicket||0;
  if(ganho<=0) return null;
  const ord=[...cen].sort((a,b)=>b.porTicket-a.porTicket);
  const top2=ord.slice(0,2).reduce((s,x)=>s+x.porTicket,0);
  const sh=ganho/ctx.totDemais;
  return {
    id:'potencial-ticket', fam:'consequencia', tabela:true,
    score:clamp(sh,0,1), tom:'note',
    verdict:`Só o tamanho do pedido explica <b>${mi(ganho)}</b> de distância — ${pct(sh,0)} da venda `
      +`atual dos demais, com a mesma quantidade de pedidos.`,
    texto:`A conta mantém o número de pedidos de cada um e troca só o valor médio do pedido pelo de `
      +`${esc(trunc(L.name,24))} (${money(L.ticket)}). `
      +`${pct(top2/ganho,0)} de toda essa diferença está em duas pessoas: `
      +`${ord.slice(0,2).map(x=>esc(trunc(x.name,20))+' ('+mi(x.porTicket)+')').join(' e ')}. `
      +`Não é um problema do time inteiro — está em quem vende pedidos bem menores que a média da casa.`,
    ev:[['Distância total',mi(ganho)],['% da venda dos demais',pct(sh,0)],
        ['Valor médio do pedido dela',money(L.ticket)],['Concentrado em 2 pessoas',pct(top2/ganho,0)]],
    trigger:`diferença de ticket vale ${pct(sh,0)} da venda dos demais`,
  };
};

/* ---------- RFV: onde está o dinheiro por segmento ---------- */
R.rfvSegmentos=function(ctx){
  const S=ctx&&ctx.segs, tot=ctx&&ctx.total, cli=ctx&&ctx.cli;
  if(!S||!S.length||!tot||!cli) return null;
  const fieis=S.filter(x=>x.seg==='Campeões'||x.seg==='Fiéis');
  const risco=S.filter(x=>x.seg==='Em risco'||x.seg==='Hibernando');
  if(!fieis.length&&!risco.length) return null;
  const vF=sum(fieis.map(x=>x.v)), nF=sum(fieis.map(x=>x.n));
  const vR=sum(risco.map(x=>x.v)), nR=sum(risco.map(x=>x.n));
  const N=cli.length;
  if(!nF&&!nR) return null;
  return {
    id:'rfv-segmentos', fam:'concentracao',
    score:clamp(vF/tot+vR/tot,0,1), tom:vR>vF?'warn':'note',
    anchor:{labels:['Campeões','Fiéis','Em risco','Hibernando']},
    verdict:`<b>${nf(nF)} clientes que voltam</b> (${pct(nF/N,0)} da carteira) valem ${mi(vF)}; `
      +`<b>${nf(nR)} que pararam</b> valem ${mi(vR)}.`,
    texto:`Campeões e fiéis são ${pct(nF/N,0)} dos clientes e ${pct(vF/tot,0)} do valor — `
      +`compram ${nf(fieis.length?sum(fieis.map(x=>x.f*x.n))/nF:0,2)} vezes cada, em média. `
      +`Do outro lado, quem está em risco ou hibernando soma ${pct(vR/tot,0)} do valor já realizado `
      +`e está há ${nf(risco.length?sum(risco.map(x=>x.r*x.n))/nR:0,1)} meses sem comprar. `
      +`É valor que a casa já provou saber vender, parado.`,
    ev:[['Campeões + fiéis',nf(nF)+' · '+mi(vF)],['% do valor',pct(vF/tot,0)],
        ['Em risco + hibernando',nf(nR)+' · '+mi(vR)],['% do valor',pct(vR/tot,0)]],
    trigger:`segmentação RFV sobre ${nf(N)} clientes da janela`,
  };
};

/* ---------- RFV: a cara da carteira ---------- */
/* o que cada segmento quer dizer, em uma linha — a nota geral no topo do
   quadro explica o método; aqui a pessoa precisa saber, olhando a linha, o
   que aquele nome significa sem ter de subir a página */
const RFV_DEF={
  'Campeões':'compraram há pouco, várias vezes e entre os que mais gastam',
  'Fiéis':'voltam com regularidade e continuam comprando',
  'Em risco':'estão entre os de maior valor, mas pararam de comprar',
  'Novos / únicos':'chegaram há pouco e ainda só fizeram um ou dois pedidos',
  'Ocasionais':'compram de vez em quando, sem padrão de retorno',
  'Hibernando':'já foram frequentes e hoje estão parados',
  'Perdidos':'sem compra há muito tempo e com valor baixo',
};
R.rfvTabela=function(ctx){
  const cli=ctx&&ctx.cli, S=ctx&&ctx.segs, tot=ctx&&ctx.total;
  if(!cli||!cli.length||!tot) return null;
  const umaVez=cli.filter(x=>x.f<=1);
  const shUma=umaVez.length/cli.length, vUma=sum(umaVez.map(x=>x.v))/tot;
  const repete=cli.filter(x=>x.f>1);
  if(!repete.length) return null;
  const vMedioUma=umaVez.length?sum(umaVez.map(x=>x.v))/umaVez.length:0;
  const vMedioRep=sum(repete.map(x=>x.v))/repete.length;
  return {
    id:'rfv-recompra', fam:'oculto', tabela:true,
    score:clamp(shUma,0,1), tom:shUma>.7?'warn':'note',
    verdict:`<b>${pct(shUma,0)} dos clientes compraram uma vez só</b> — e valem ${pct(vUma,0)} do total.`,
    texto:`Quem volta é minoria: ${nf(repete.length)} clientes de ${nf(cli.length)}. `
      +`Mas cada um deles vale ${money(vMedioRep)} contra ${money(vMedioUma)} de quem comprou uma vez — `
      +`${nf(vMedioRep/Math.max(vMedioUma,1),1)}× mais. `
      +`A diferença entre os dois grupos não é o tamanho do primeiro pedido: é o que vem depois dele.`
      +(S&&S.length?`</p><div class="hl-defs"><b>O que é cada segmento</b>`
        +S.map(x=>{
          /* a faixa de recência é o que responde "pararam há quanto tempo" —
             a média sozinha esconde se o segmento é homogêneo ou não */
          const faixa = (x.rMax==null||x.rMin==null) ? ''
            : (x.rMin===x.rMax ? `${nf(x.rMin)} ${plural(x.rMin,'mês','meses')} sem comprar`
              : `${nf(x.rMin)} a ${nf(x.rMax)} meses sem comprar, ${nf(x.r,1)} em média`);
          return `<span><i>${esc(x.seg)}</i> — ${esc(RFV_DEF[x.seg]||'')} `
            +`<em>${nf(x.n)} ${plural(x.n,'cliente','clientes')} · ${mi(x.v)}`
            +(faixa?` · ${faixa}`:'')+`</em></span>`;
        }).join('')
        +`</div><p>`:''),
    ev:[['Compraram uma vez',nf(umaVez.length)+' · '+pct(shUma,0)],['Valem',pct(vUma,0)+' do total'],
        ['Valor médio · uma compra',money(vMedioUma)],['Valor médio · recompra',money(vMedioRep)]],
    trigger:`${pct(shUma,0)} da carteira com uma única compra no período`,
  };
};

/* ---------- RFV: os clientes de valor que sumiram ---------- */
R.rfvRisco=function(ctx){
  const R2=ctx&&ctx.risco, tot=ctx&&ctx.total, cli=ctx&&ctx.cli;
  if(!R2||R2.length<3||!tot) return null;
  const v=sum(R2.map(x=>x.v));
  const donos={}; R2.forEach(x=>{ if(x.dono) donos[x.dono]=(donos[x.dono]||0)+x.v; });
  const rank=Object.keys(donos).map(d=>[d,donos[d]]).sort((a,b)=>b[1]-a[1]);
  const mesesMed=sum(R2.map(x=>x.r))/R2.length;
  return {
    id:'rfv-risco', fam:'consequencia', tabela:true,
    score:clamp(v/tot*3,0,1), tom:'warn',
    verdict:`Os ${nf(R2.length)} maiores clientes parados somam <b>${mi(v)}</b> de compra já realizada, `
      +`com ${nf(mesesMed,1)} meses em média sem pedido.`,
    texto:`São clientes que já compraram antes — não é procurar cliente novo, é reaproximar quem já foi cliente. `
      +(rank.length?`${esc(trunc(rank[0][0],24))} responde por ${pct(rank[0][1]/v,0)} desse valor `
        +`(${mi(rank[0][1])}), o que torna a conversa de retomada concentrada em poucas mãos. `:'')
      +`O maior deles sozinho vale ${mi(R2[0].v)}.`,
    ev:[['Valor parado',mi(v)],['Clientes',nf(R2.length)],
        ['Meses sem comprar',nf(mesesMed,1)],['Maior isolado',mi(R2[0].v)]],
    trigger:`clientes de alto valor com recência no quintil mais baixo`,
  };
};

/* ---------- RFV: qualidade da carteira por vendedor ---------- */
R.rfvPorVendedor=function(ctx){
  const D=ctx&&ctx.donos; if(!D||D.length<3) return null;
  const comRec=D.map(x=>({...x, shCamp:x.v?x.vcamp/x.v:0}));
  const melhor=comRec.reduce((b,x)=>x.shCamp>b.shCamp?x:b,comRec[0]);
  const pior=comRec.reduce((b,x)=>x.shCamp<b.shCamp?x:b,comRec[0]);
  if(melhor.shCamp-pior.shCamp<.2) return null;
  const maiorVenda=[...comRec].sort((a,b)=>b.v-a.v)[0];
  return {
    id:'rfv-por-vendedor', fam:'oculto', tabela:true,
    score:clamp(melhor.shCamp-pior.shCamp,0,1), tom:'note',
    anchor:{labels:[melhor.d,pior.d]},
    verdict:`Carteiras muito diferentes por baixo: <b>${pct(melhor.shCamp,0)} da venda de `
      +`${esc(trunc(melhor.d,20))} vem de clientes que voltam, contra ${pct(pior.shCamp,0)} de ${esc(trunc(pior.d,20))}</b>.`,
    texto:`${esc(trunc(melhor.d,20))} atende ${nf(melhor.n)} clientes com ${nf(melhor.rec,2)} pedidos cada; `
      +`${esc(trunc(pior.d,20))}, ${nf(pior.n)} clientes com ${nf(pior.rec,2)}. `
      +`Quem lidera em venda é ${esc(trunc(maiorVenda.d,20))}, com ${pct(maiorVenda.shCamp,0)} vindo de clientes fiéis. `
      +`Duas pessoas com venda parecida podem ter uma carteira que se sustenta e outra que precisa ser refeita todo mês.`,
    ev:[[esc(trunc(melhor.d,18)),pct(melhor.shCamp,0)+' de fiéis'],[esc(trunc(pior.d,18)),pct(pior.shCamp,0)+' de fiéis'],
        ['Pedidos/cliente · melhor',nf(melhor.rec,2)],['Pedidos/cliente · pior',nf(pior.rec,2)]],
    trigger:`${nf((melhor.shCamp-pior.shCamp)*100,0)} pontos entre a melhor e a pior carteira (limiar 20)`,
  };
};

/* =====================================================================
   REGRAS DA SEÇÃO VENDEDOR × ARQUITETO
   ===================================================================== */

/* ---------- o canal vale o mesmo para todo mundo? ---------- */
R.arqCanal=function(ctx){
  const V=ctx&&ctx.vend; if(!V||V.length<3) return null;
  const nucleo=nucleoMaterial(V,'v',.85,3);
  if(nucleo.length<2) return null;
  const ord=[...nucleo].sort((a,b)=>b.share-a.share);
  const alto=ord[0], baixo=ord[ord.length-1];
  const dispersao=alto.share-baixo.share;
  const geral=ctx.share||0;
  /* Duas notícias possíveis: os vendedores dependem do canal em graus muito
     diferentes, OU dependem todos igualmente e demais — e a segunda é tão
     relevante quanto a primeira, porque significa que a casa não vende sozinha. */
  const uniforme = dispersao<.2 && geral>=.7;
  if(dispersao<.2 && !uniforme) return null;
  /* o ticket é a pergunta que interessa: o canal traz negócio maior ou só
     traz mais negócio? */
  const comA=nucleo.filter(x=>x.pedsA>0&&x.ticketA>0);
  const tA=sum(comA.map(x=>x.vArq))/Math.max(sum(comA.map(x=>x.pedsA)),1);
  const comS=nucleo.filter(x=>(x.pedsT-x.pedsA)>0);
  const tS=sum(comS.map(x=>x.vSem))/Math.max(sum(comS.map(x=>x.pedsT-x.pedsA)),1);
  const razao=tS?tA/tS:0;
  return {
    id:'arq-canal', fam:'divergencia',
    score:uniforme?clamp(geral,0,1):clamp(dispersao*1.5,0,1), tom:uniforme?'warn':'note',
    anchor:{labels:[trunc(alto.name,14),trunc(baixo.name,14)]},
    verdict:uniforme
      ? `<b>${pct(geral,0)} de toda a venda entra por um arquiteto</b>, e isso vale para o time inteiro — `
        +`de ${pct(baixo.share,0)} a ${pct(alto.share,0)} entre os maiores vendedores.`
      : `<b>${esc(trunc(alto.name,24))} faz ${pct(alto.share,0)} da venda por arquiteto; `
        +`${esc(trunc(baixo.name,24))}, ${pct(baixo.share,0)}</b> — não são o mesmo trabalho.`,
    texto:(uniforme
      ? `Não é um vendedor ou outro: praticamente toda venda da casa nasce da indicação de um arquiteto. `
        +`O que se vende direto ao cliente é o que sobra. `
        +`Isso muda a pergunta: o resultado do vendedor depende menos de quem atende no showroom e mais `
        +`de quais arquitetos indicam a marca — e avaliar o time sem olhar isso mede a coisa errada. `
      : `Entre os maiores vendedores, a dependência do canal vai de ${pct(baixo.share,0)} a ${pct(alto.share,0)}. `)
      +(razao?`E o canal não muda só o volume: o pedido que vem por arquiteto vale ${money(tA)} `
        +`contra ${money(tS)} do que vem direto — ${nf(razao,1)}× ${razao>1?'maior':'menor'}. `:'')
      +(uniforme?'':`Comparar a venda de quem vive de especificação com a de quem vende no balcão é comparar `
        +`dois processos diferentes com o mesmo número.`),
    ev:[[trunc(alto.name,18),pct(alto.share,0)+' via arquiteto'],[trunc(baixo.name,18),pct(baixo.share,0)],
        ['Pedido médio com arquiteto',money(tA)],['Pedido médio direto',money(tS)]],
    trigger:uniforme
      ? `${pct(geral,0)} da venda vem de arquiteto, e a diferença entre os vendedores é de só ${nf(dispersao*100,0)} pontos`
      : `${nf(dispersao*100,0)} pontos de diferença entre quem mais e quem menos vende por arquiteto (limiar 20)`,
  };
};

/* ---------- de quantas relações depende a agenda ---------- */
R.arqDependencia=function(ctx){
  const V=(ctx&&ctx.vend||[]).filter(x=>x.nArq>=2&&x.vArq>0);
  if(V.length<2) return null;
  const nucleo=nucleoMaterial(V,'vArq',.85,2);
  if(nucleo.length<2) return null;
  /* o que interessa não é ter poucos arquitetos, e sim depender de poucos:
     alguém com 30 arquitetos onde 2 fazem metade é mais frágil do que parece */
  const frag=nucleo.map(x=>({...x, conc:x.nArq?x.k50/x.nArq:1}))
                   .sort((a,b)=>a.conc-b.conc);
  const pior=frag[0];
  if(pior.conc>.25) return null;
  const A=ctx&&ctx.arqs||[];
  const doPior=A.filter(a=>a.dono===pior.name&&a.exclusivo);
  const vExcl=sum(doPior.map(a=>a.v));
  return {
    id:'arq-dependencia', fam:'concentracao', tabela:true,
    score:clamp(1-pior.conc*3,0,1), tom:'warn',
    verdict:`A agenda de <b>${esc(trunc(pior.name,26))} depende de ${pior.k50} `
      +`${plural(pior.k50,'arquiteto','arquitetos')}</b> de ${nf(pior.nArq)} — `
      +`bastam ${plural(pior.k50,'ele','eles')} para somar metade da venda pelo canal.`,
    texto:`O maior sozinho responde por ${pct(pior.shTop,0)} (${esc(trunc(pior.topArq||'—',26))}). `
      +(doPior.length?`Além disso, ${nf(doPior.length)} ${plural(doPior.length,'arquiteto trabalha','arquitetos trabalham')} `
        +`exclusivamente com ${esc(trunc(pior.name,22))}, somando ${mi(vExcl)} — `
        +`relação pessoal, que sai junto com quem a construiu. `:'')
      +`Ter muitos arquitetos cadastrados não é o mesmo que ter a venda distribuída entre eles.`,
    ev:[['Arquitetos ativos',nf(pior.nArq)],['Bastam para 50%',nf(pior.k50)],
        ['Maior deles',pct(pior.shTop,0)],['Exclusivos dele',nf(doPior.length)+' · '+mi(vExcl)]],
    trigger:`${pct(pior.conc,0)} dos arquitetos concentram metade da venda do canal (limiar 25%)`,
  };
};

/* ---------- o arquiteto é da casa ou do vendedor? ---------- */
R.arqExclusividade=function(ctx){
  const A=ctx&&ctx.arqs; if(!A||A.length<5) return null;
  const nucleo=nucleoMaterial(A,'v',.8,5);
  const excl=nucleo.filter(x=>x.shDono>=.9);
  const vExcl=sum(excl.map(x=>x.v)), vTot=sum(nucleo.map(x=>x.v));
  if(!vTot||excl.length<2) return null;
  const sh=vExcl/vTot;
  if(sh<.3) return null;
  const compart=nucleo.filter(x=>x.nVend>=2);
  const tkE=excl.reduce((s,x)=>s+x.peds,0)?vExcl/excl.reduce((s,x)=>s+x.peds,0):0;
  const tkC=compart.reduce((s,x)=>s+x.peds,0)
    ?sum(compart.map(x=>x.v))/compart.reduce((s,x)=>s+x.peds,0):0;
  return {
    id:'arq-exclusividade', fam:'oculto', tabela:true,
    score:clamp(sh,0,1), tom:'warn',
    verdict:`Entre os arquitetos que fazem 80% do canal, <b>${nf(excl.length)} trabalham com um único vendedor</b> — `
      +`${pct(sh,0)} da venda desse grupo.`,
    texto:`São ${mi(vExcl)} presos a uma relação pessoal: se o vendedor sai, o arquiteto não fica com a casa. `
      +(compart.length
        ? (compart.length===1
            ? `Só um circula entre vendedores, movimentando ${mi(sum(compart.map(x=>x.v)))}`
            : `Os ${nf(compart.length)} que circulam entre vendedores movimentam ${mi(sum(compart.map(x=>x.v)))}`)
          +(tkE&&tkC?`, com pedido médio de ${money(tkC)} contra ${money(tkE)} dos exclusivos`:'')+`. `
        :'')
      +`A diferença entre um cadastro de arquitetos e uma carteira de arquitetos está exatamente nisso.`,
    ev:[['Exclusivos',nf(excl.length)+' · '+mi(vExcl)],['% do canal',pct(sh,0)],
        ['Circulam entre vendedores',nf(compart.length)],['Pedido médio: exclusivo × compartilhado',
          (tkE?money(tkE):'—')+' × '+(tkC?money(tkC):'—')]],
    trigger:`${pct(sh,0)} do canal em arquitetos com 90%+ da venda num único vendedor (limiar 30%)`,
  };
};

/* ---------- a matriz: colunas cheias e colunas vazias ---------- */
R.arqMatriz=function(ctx){
  const L=(ctx&&ctx.linhas)||[], C=(ctx&&ctx.colunas)||[], M=(ctx&&ctx.mat)||{};
  if(L.length<3||C.length<3) return null;
  let pares=0, total=L.length*C.length;
  C.forEach(c=>L.forEach(l=>{ if((M[l]&&M[l][c])>0) pares++; }));
  const dens=pares/total;
  if(dens>.5) return null;
  /* qual arquiteto circula mais e qual está preso a um só vendedor */
  const porCol=C.map(c=>{ const q=L.filter(l=>(M[l]&&M[l][c])>0).length;
    const v=sum(L.map(l=>(M[l]&&M[l][c])||0)); return {c,q,v}; })
    .filter(x=>x.v>0).sort((a,b)=>b.v-a.v);
  if(!porCol.length) return null;
  const circula=[...porCol].sort((a,b)=>b.q-a.q)[0];
  const presos=porCol.filter(x=>x.q===1);
  return {
    id:'arq-matriz', fam:'oculto',
    score:clamp(1-dens,0,1), tom:'note',
    anchor:{labels:[circula.c]},
    verdict:`De todas as combinações possíveis entre vendedor e arquiteto, <b>só ${pct(dens,0)} existem</b> — `
      +(presos.length===porCol.length
        ? `<b>todos os ${nf(porCol.length)} maiores arquitetos</b> trabalham com um único vendedor.`
        : `${nf(presos.length)} dos ${nf(porCol.length)} maiores arquitetos trabalham com um único vendedor.`),
    texto:`O mapa tem muito espaço vazio, e não é acaso: cada arquiteto trabalha com um vendedor só. `
      +(circula.q>1
        ? `${esc(trunc(circula.c,26))} é a exceção — circula por ${nf(circula.q)} vendedores, somando ${mi(circula.v)}. `
        : `Nenhum dos maiores é exceção: não há um único arquiteto atendido por mais de um vendedor no período. `)
      +`Quando a coluna tem uma célula só, o relacionamento é da pessoa, não da empresa.`,
    ev:[['Pares que existem',pct(dens,0)],['Arquitetos presos a um',nf(presos.length)],
        ['Mais circula',esc(trunc(circula.c,20))],['Com quantos vendedores',nf(circula.q)]],
    trigger:`densidade de ${pct(dens,0)} na matriz vendedor × arquiteto (limiar 50%)`,
  };
};

/* ---------- quem parou de trazer ---------- */
R.arqParados=function(ctx){
  const P=ctx&&ctx.parados, A=ctx&&ctx.arqs, totA=ctx&&ctx.totA;
  if(!P||P.length<3||!A||!totA) return null;
  const v=sum(P.map(x=>x.v));
  const donos={}; P.forEach(x=>{ if(x.dono) donos[x.dono]=(donos[x.dono]||0)+x.v; });
  const rank=Object.keys(donos).map(d=>[d,donos[d]]).sort((a,b)=>b[1]-a[1]);
  const mesesMed=sum(P.map(x=>x.r))/P.length;
  const ativos=A.filter(x=>x.r<6).length;
  return {
    id:'arq-parados', fam:'consequencia', tabela:true,
    score:clamp(v/totA*3,0,1), tom:'warn',
    verdict:`<b>${nf(P.length)} arquitetos que trouxeram ${mi(v)}</b> não mandam pedido há ${nf(mesesMed,1)} meses em média.`,
    texto:`É ${pct(v/totA,0)} de tudo que veio por arquiteto no período, hoje parado. `
      +`Do outro lado, ${nf(ativos)} arquitetos seguem trazendo pedido. `
      +(rank.length?`A maior parte desse valor parado estava com ${esc(trunc(rank[0][0],24))} `
        +`(${mi(rank[0][1])}, ${pct(rank[0][1]/v,0)} do total). `:'')
      +`Arquiteto não cancela cadastro: ele apenas para de especificar, e isso não aparece em lugar nenhum `
      +`até alguém contar os meses.`,
    ev:[['Arquitetos parados',nf(P.length)],['Valor que traziam',mi(v)],
        ['% do canal',pct(v/totA,0)],['Meses sem trazer',nf(mesesMed,1)]],
    trigger:`arquitetos sem pedido há 6 meses ou mais, somando ${pct(v/totA,0)} do canal`,
  };
};

/* definições dos segmentos aplicadas ao canal — o mesmo corte dos clientes,
   com a linguagem do arquiteto (ele traz pedido, não compra) */
const RFV_DEF_ARQ={
  'Campeões':'trouxeram pedido há pouco, várias vezes e entre os que mais somam',
  'Fiéis':'especificam com regularidade e seguem trazendo',
  'Em risco':'estão entre os que mais trouxeram, mas pararam',
  'Novos / únicos':'chegaram há pouco e trouxeram um ou dois pedidos',
  'Ocasionais':'aparecem de vez em quando, sem regularidade',
  'Hibernando':'já foram frequentes e hoje não trazem nada',
  'Perdidos':'sem pedido há muito tempo e com valor baixo',
};

/* ---------- RFV do canal: onde está o dinheiro do arquiteto ---------- */
R.rfvArqSegmentos=function(ctx){
  const S=ctx&&ctx.segs, tot=ctx&&ctx.total, it=ctx&&ctx.itens;
  if(!S||!S.length||!tot||!it) return null;
  const bons=S.filter(x=>x.seg==='Campeões'||x.seg==='Fiéis');
  const maus=S.filter(x=>x.seg==='Em risco'||x.seg==='Hibernando'||x.seg==='Perdidos');
  if(!bons.length&&!maus.length) return null;
  const vB=sum(bons.map(x=>x.v)), nB=sum(bons.map(x=>x.n));
  const vM=sum(maus.map(x=>x.v)), nM=sum(maus.map(x=>x.n));
  const N=it.length;
  if(!nB&&!nM) return null;
  const rM=nM?sum(maus.map(x=>x.r*x.n))/nM:0;
  return {
    id:'rfv-arq-segmentos', fam:'concentracao',
    score:clamp(vM/tot+vB/tot,0,1), tom:vM>vB?'warn':'note',
    anchor:{labels:['Campeões','Fiéis','Em risco','Hibernando']},
    verdict:`<b>${nf(nB)} arquitetos ainda trazem pedido</b> (${pct(nB/N,0)} do cadastro) e valem ${mi(vB)}; `
      +`<b>${nf(nM)} já pararam</b>, com ${mi(vM)} de histórico.`,
    texto:`O canal tem duas metades muito diferentes. Quem segue ativo traz `
      +`${nf(nB?sum(bons.map(x=>x.f*x.n))/nB:0,1)} pedidos por arquiteto; quem parou está há `
      +`${nf(rM,1)} meses sem especificar nada. `
      +`A diferença entre um cadastro de arquitetos e uma carteira viva é essa — e ela não aparece `
      +`em nenhum ranking por faturamento, porque o histórico de quem sumiu continua somando lá.`,
    ev:[['Ativos (campeões + fiéis)',nf(nB)+' · '+mi(vB)],['% do valor',pct(vB/tot,0)],
        ['Parados',nf(nM)+' · '+mi(vM)],['Meses sem trazer',nf(rM,1)]],
    trigger:`segmentação RFV sobre ${nf(N)} arquitetos da janela`,
  };
};

/* ---------- RFV do canal: quantos trazem mais de uma vez ---------- */
R.rfvArqTabela=function(ctx){
  const it=ctx&&ctx.itens, tot=ctx&&ctx.total, S=ctx&&ctx.segs;
  if(!it||!it.length||!tot) return null;
  const umaVez=it.filter(x=>x.f<=1), repete=it.filter(x=>x.f>1);
  if(!repete.length) return null;
  const shUma=umaVez.length/it.length, vUma=sum(umaVez.map(x=>x.v))/tot;
  const mUma=umaVez.length?sum(umaVez.map(x=>x.v))/umaVez.length:0;
  const mRep=sum(repete.map(x=>x.v))/repete.length;
  return {
    id:'rfv-arq-recompra', fam:'oculto', tabela:true,
    score:clamp(shUma,0,1), tom:shUma>.6?'warn':'note',
    verdict:`<b>${pct(shUma,0)} dos arquitetos trouxeram um pedido só</b> — e respondem por ${pct(vUma,0)} do canal.`,
    texto:`Especificar uma vez é fácil; virar recorrente é outra coisa. `
      +`Os ${nf(repete.length)} que voltaram valem ${money(mRep)} cada, contra ${money(mUma)} de quem veio uma vez — `
      +`${nf(mRep/Math.max(mUma,1),1)}× mais. `
      +`O tamanho do cadastro não diz nada sobre o tamanho do canal.`
      +(S&&S.length?`</p><div class="hl-defs"><b>O que é cada segmento</b>`
        +S.map(x=>{
          const faixa = x.rMin===x.rMax
            ? `${nf(x.rMin)} ${plural(x.rMin,'mês','meses')} sem trazer`
            : `${nf(x.rMin)} a ${nf(x.rMax)} meses sem trazer, ${nf(x.r,1)} em média`;
          return `<span><i>${esc(x.seg)}</i> — ${esc(RFV_DEF_ARQ[x.seg]||'')} `
            +`<em>${nf(x.n)} ${plural(x.n,'arquiteto','arquitetos')} · ${mi(x.v)} · ${faixa}</em></span>`;
        }).join('')+`</div><p>`:''),
    ev:[['Trouxeram uma vez',nf(umaVez.length)+' · '+pct(shUma,0)],['Valem',pct(vUma,0)+' do canal'],
        ['Valor médio · uma vez',money(mUma)],['Valor médio · recorrente',money(mRep)]],
    trigger:`${pct(shUma,0)} do cadastro com um único pedido no período`,
  };
};

/* ---------- a carteira de canal não rende igual para todos ---------- */
R.rfvArqPorVendedor=function(ctx){
  const L=ctx&&ctx.linhas; if(!L||L.length<2) return null;
  const nucleo=nucleoMaterial(L,'v',.85,2);
  if(nucleo.length<2) return null;
  const ord=[...nucleo].sort((a,b)=>b.shBons-a.shBons);
  const bom=ord[0], ruim=ord[ord.length-1];
  if(bom.shBons-ruim.shBons<.2) return null;
  return {
    id:'rfv-arq-por-vendedor', fam:'oculto',
    score:clamp(bom.shBons-ruim.shBons,0,1), tom:'note',
    anchor:{labels:[trunc(bom.d,14),trunc(ruim.d,14)]},
    verdict:`<b>${pct(bom.shBons,0)} da venda de ${esc(trunc(bom.d,22))} vem de arquitetos que continuam trazendo; `
      +`em ${esc(trunc(ruim.d,22))}, ${pct(ruim.shBons,0)}</b>.`,
    texto:`${esc(trunc(ruim.d,22))} tem ${nf(ruim.n)} arquitetos, mas ${pct(ruim.shRuins,0)} da venda dela veio de quem já parou de trazer pedido — `
      +`o histórico está lá, o movimento não. `
      +`${esc(trunc(bom.d,22))} trabalha com ${nf(bom.n)}`
      +(Math.abs(bom.pedArq-ruim.pedArq)>=.05
        ? ` e recebe ${nf(bom.pedArq,2)} pedidos de cada um, contra ${nf(ruim.pedArq,2)}`
        : ` e a diferença não está em quantos pedidos cada arquiteto traz — é em quantos deles ainda trazem`)
      +`. Duas carteiras de tamanho parecido: uma continua rendendo, a outra em boa parte parou.`,
    ev:[[trunc(bom.d,18),pct(bom.shBons,0)+' em ativos'],[trunc(ruim.d,18),pct(ruim.shBons,0)],
        ['Pedidos por arquiteto',nf(bom.pedArq,2)+' × '+nf(ruim.pedArq,2)],
        ['Valor parado em '+trunc(ruim.d,14),mi(ruim.vRuins)]],
    trigger:`${nf((bom.shBons-ruim.shBons)*100,0)} pontos entre a melhor e a pior carteira de canal (limiar 20)`,
  };
};

/* ---------- quantos pedidos cada arquiteto rende, por vendedor ---------- */
R.rfvArqQualidade=function(ctx){
  const L=ctx&&ctx.linhas; if(!L||L.length<3) return null;
  const nucleo=nucleoMaterial(L,'v',.85,3);
  if(nucleo.length<2) return null;
  const ord=[...nucleo].sort((a,b)=>b.pedArq-a.pedArq);
  const alto=ord[0], baixo=ord[ord.length-1];
  if(!baixo.pedArq||alto.pedArq/baixo.pedArq<1.4) return null;
  const razao=alto.pedArq/baixo.pedArq;
  /* quanto valeria, em pedidos, se o de menor aproveitamento chegasse ao maior */
  const pedFalta=(alto.pedArq-baixo.pedArq)*baixo.n;
  return {
    id:'rfv-arq-qualidade', fam:'divergencia', tabela:true,
    score:clamp((razao-1)/2,0,1), tom:'note',
    verdict:`Cada arquiteto rende <b>${nf(alto.pedArq,2)} pedidos com ${esc(trunc(alto.d,22))} e `
      +`${nf(baixo.pedArq,2)} com ${esc(trunc(baixo.d,22))}</b> — ${nf(razao,1)}× de diferença.`,
    texto:`Não é sobre ter mais arquitetos: ${esc(trunc(baixo.d,22))} tem ${nf(baixo.n)} e `
      +`${esc(trunc(alto.d,22))}, ${nf(alto.n)}. `
      +`A diferença está em quantas vezes cada relação se repete. `
      +`No aproveitamento de ${esc(trunc(alto.d,20))}, a carteira de ${esc(trunc(baixo.d,20))} `
      +`teria rendido ${nf(pedFalta,0)} pedidos a mais no período.`,
    ev:[[trunc(alto.d,18),nf(alto.pedArq,2)+' pedidos/arq.'],[trunc(baixo.d,18),nf(baixo.pedArq,2)],
        ['Arquitetos',nf(alto.n)+' × '+nf(baixo.n)],['Pedidos de diferença',nf(pedFalta,0)]],
    trigger:`aproveitamento por arquiteto variando ${nf(razao,1)}× entre os maiores vendedores (limiar 1,4×)`,
  };
};

/* =====================================================================
   REGRAS DE CUSTO
   ===================================================================== */

/* ---------- o custo por peça sobe quando se produz menos ---------- */
/* ctx: {meses:[[ym,mat,mod,ggf,custo,qtd],…], rotulo:'vendidas'|'produzidas'} */
R.custoUnitarioVolume=function(ctx){
  const M=(ctx&&ctx.meses||[]).filter(m=>m[5]>0&&m[4]>0);
  if(M.length<4) return null;
  const un=M.map(m=>({q:m[5], u:m[4]/m[5], lab:ctx.lab?ctx.lab(m[0]):''}));
  const ord=[...un].sort((a,b)=>b.q-a.q);
  const meio=Math.floor(ord.length/2);
  const altos=ord.slice(0,meio), baixos=ord.slice(-meio);
  if(!altos.length||!baixos.length) return null;
  const uAlto=avg(altos.map(x=>x.u)), uBaixo=avg(baixos.map(x=>x.u));
  const qAlto=avg(altos.map(x=>x.q)), qBaixo=avg(baixos.map(x=>x.q));
  if(!uAlto||!uBaixo) return null;
  const d=uBaixo/uAlto-1;
  if(d<.08) return null;
  const rot=ctx&&ctx.rotulo?ctx.rotulo:'produzidas';
  return {
    id:'custo-unitario-volume'+(ctx&&ctx.id?'-'+ctx.id:''), fam:'oculto',
    score:clamp(d*2.5,0,1), tom:'warn',
    verdict:`Nos meses de menor produção, a peça custa <b>${money(uBaixo)}</b>; nos de maior, `
      +`<b>${money(uAlto)}</b> — ${pct(d,0)} de diferença sem nada ter mudado de preço.`,
    texto:`Os meses com mais peças ${rot} fizeram em média ${nf(qAlto,0)} unidades, e cada uma custou ${money(uAlto)}. `
      +`Os meses de menor movimento fizeram ${nf(qBaixo,0)} e cada peça custou ${money(uBaixo)}. `
      +`A fábrica tem um custo que existe mesmo quando ela produz pouco — quando o volume cai, essa conta `
      +`se divide entre menos peças e cada uma fica mais cara. `
      +`Por isso um gráfico de custo por peça subindo nem sempre quer dizer que algo ficou mais caro.`,
    ev:[['Meses de maior volume',nf(qAlto,0)+' peças'],['Custo por peça',money(uAlto)],
        ['Meses de menor volume',nf(qBaixo,0)+' peças'],['Custo por peça',money(uBaixo)]],
    trigger:`custo por peça ${pct(d,0)} maior na metade dos meses de menor volume (limiar 8%)`,
  };
};

/* ---------- retrabalho e assistência: o custo que não vira produto ---------- */
/* ctx: {ret:{total,mensal,porCC}, ass:{total,porProduto}, base, lab} */
R.custoEvitavel=function(ctx){
  const R2=ctx&&ctx.ret, A=ctx&&ctx.ass, base=ctx&&ctx.base;
  if(!R2||!A||!base) return null;
  const tot=(R2.total||0)+(A.total||0);
  if(!tot||tot/base<.005) return null;
  const sh=tot/base;
  /* concentração: em quantos centros de custo (ou produtos) está a maior parte */
  const cc=(R2.porCC||[]).map(x=>({name:x[0],v:x[1]})).filter(x=>x.v>0).sort((a,b)=>b.v-a.v);
  const k=cc.length?quantosPara(cc.map(x=>x.v),.8):0;
  const prod=(A.porProduto||[]).filter(x=>x[1]>0);
  const maiorProd=prod.length?prod.reduce((b,x)=>x[1]>b[1]?x:b,prod[0]):null;
  return {
    id:'custo-evitavel'+(ctx&&ctx.id?'-'+ctx.id:''), fam:'consequencia',
    score:clamp(sh*18,0,1), tom:sh>.03?'warn':'note',
    verdict:`Refazer peça e atender defeito custou <b>${mi(tot)}</b> no período — ${pct(sh,1)} de todo o custo de produção.`,
    texto:`São ${mi(R2.total||0)} de retrabalho e ${mi(A.total||0)} de assistência técnica. `
      +(k?`O retrabalho não está espalhado: ${k} ${plural(k,'centro de custo concentra','centros de custo concentram')} 80% dele. `:'')
      +(maiorProd?`Na assistência, o produto que mais consome é ${esc(trunc(maiorProd[0],34))}, com ${mi(maiorProd[1])}. `:'')
      +`É dinheiro gasto duas vezes na mesma peça: uma para fazer e outra para consertar.`,
    ev:[['Retrabalho',mi(R2.total||0)],['Assistência técnica',mi(A.total||0)],
        ['Somados',mi(tot)],['% do custo de produção',pct(sh,1)]],
    trigger:`retrabalho e assistência somam ${pct(sh,1)} do custo de produção (limiar 0,5%)`,
  };
};

/* ---------- quanto custa a hora em cada centro de custo ---------- */
/* ctx: {cc:[[nome,mod,ggf,absCPV,horas,…,taxa]], total} */
R.taxaHoraCC=function(ctx){
  const L=(ctx&&ctx.cc||[]).map(x=>({name:x[0], v:x[3]||x[1]+x[2], horas:x[4], taxa:x[7]}))
    .filter(x=>x.horas>0&&x.taxa>0);
  if(L.length<3) return null;
  /* só compara entre os que realmente pesam: taxa alta num centro de custo que
     apontou 20 horas no período não muda decisão nenhuma */
  const nucleo=nucleoMaterial(L,'horas',.8,3);
  if(nucleo.length<2) return null;
  const ord=[...nucleo].sort((a,b)=>b.taxa-a.taxa);
  const caro=ord[0], barato=ord[ord.length-1];
  const razao=caro.taxa/barato.taxa;
  if(razao<1.4) return null;
  const horasTot=sum(nucleo.map(x=>x.horas));
  const media=sum(nucleo.map(x=>x.v))/horasTot;
  const seTodosNaMedia=horasTot*media;
  const real=sum(nucleo.map(x=>x.v));
  return {
    id:'taxa-hora-cc'+(ctx&&ctx.id?'-'+ctx.id:''), fam:'divergencia',
    score:clamp((razao-1)/2,0,1), tom:'note',
    anchor:{labels:[caro.name,barato.name]},
    verdict:`A hora de trabalho custa <b>${money(caro.taxa)} em ${esc(trunc(caro.name,26))} e ${money(barato.taxa)} `
      +`em ${esc(trunc(barato.name,26))}</b> — ${nf(razao,1)}× de diferença.`,
    texto:`Entre os centros de custo que concentram a maior parte das horas apontadas, o valor da hora varia bastante. `
      +`${esc(trunc(caro.name,26))} apontou ${nf(caro.horas,0)} horas e ${esc(trunc(barato.name,26))}, ${nf(barato.horas,0)}. `
      +`Na média desses centros, a hora sai por ${money(media)}. `
      +`Máquina, gente e estrutura diferentes fazem a hora valer coisas diferentes — o que importa é saber `
      +`quais peças passam mais tempo nos centros mais caros.`,
    ev:[[trunc(caro.name,20),money(caro.taxa)+'/h'],[trunc(barato.name,20),money(barato.taxa)+'/h'],
        ['Média do grupo',money(media)+'/h'],['Horas apontadas',nf(horasTot,0)]],
    trigger:`valor da hora variando ${nf(razao,1)}× entre os centros de custo que fazem 80% das horas (limiar 1,4×)`,
  };
};


/* ---------- o mesmo produto, de um ano para o outro ---------- */
/* Ranking nao serve aqui: sao duas ou tres curvas do mesmo item ao longo do ano.
   O que interessa e se o custo daquela peca subiu, e em quais meses. */
R.comparaAnos=function(ctx){
  const anos=(ctx&&ctx.anos)||{}, ordem=(ctx&&ctx.ordem)||[];
  if(ordem.length<2) return null;
  const serie=a=>((anos[a]||[]).map(x=>x==null?null:+x));
  const med=a=>{const v=serie(a).filter(x=>x!=null&&x>0); return v.length?sum(v)/v.length:0;};
  const A=ordem[ordem.length-2], B=ordem[ordem.length-1];
  const mA=med(A), mB=med(B);
  if(!mA||!mB) return null;
  const d=mB/mA-1;
  if(Math.abs(d)<.03) return null;
  /* em quantos meses o ano mais recente ficou acima do anterior */
  const sA=serie(A), sB=serie(B); let acima=0, comparaveis=0, maiorMes=null, maiorD=0;
  for(let i=0;i<12;i++){
    if(sA[i]==null||sB[i]==null||!sA[i]) continue;
    comparaveis++; const dd=sB[i]/sA[i]-1;
    if(dd>0) acima++;
    if(Math.abs(dd)>Math.abs(maiorD)){ maiorD=dd; maiorMes=i; }
  }
  const MESES=['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
  return {
    id:'compara-anos'+(ctx&&ctx.id?'-'+ctx.id:''), fam:'padrao',
    score:clamp(Math.abs(d)*3,0,1), tom:d>0?'warn':'ok',
    verdict:`Fazer esta peça custa <b>${money(mB,2)} em ${B}</b>, contra ${money(mA,2)} em ${A} — `
      +`${spct(d,0)}.`,
    texto:`A média do ano passou de ${money(mA,2)} para ${money(mB,2)}. `
      +(comparaveis?`Comparando mês a mês, ${B} ficou mais caro em ${acima} dos ${comparaveis} meses `
        +`que dá para comparar. `:'')
      +(maiorMes!=null?`A maior diferença foi em ${MESES[maiorMes]} (${spct(maiorD,0)}). `:'')
      +`Como é o custo de uma peça só, ele não se dilui com volume: o que muda aqui é material e processo.`,
    ev:[['Média '+A,money(mA,2)],['Média '+B,money(mB,2)],
        ['Variação',spct(d,1)],['Meses mais caros',comparaveis?acima+' de '+comparaveis:'—']],
    trigger:`custo médio por unidade ${spct(d,0)} entre ${A} e ${B} (limiar 3%)`,
  };
};

/* =====================================================================
   REGUAS DOS QUADROS QUE VIERAM DA REVISAO DO AUGUSTO
   Mesmas regras editoriais do resto do arquivo: frase curta, palavra comum,
   nada de recomendacao, e o achado tem de nomear algo que move o numero.
   ===================================================================== */

/* ---------- carteira em aberto: o valor e o tempo que ele representa ---------- */
/* ctx: {labels, carteira:[], meses:[], venda:[]} */
R.carteiraMesesCobertura=function(ctx){
  const L=ctx&&ctx.labels||[], C=ctx&&ctx.carteira||[], M=ctx&&ctx.meses||[];
  if(L.length<5||C.length!==L.length) return null;
  const i1=C.length-1;
  const c0=C[0], c1=C[i1], m0=M[0], m1=M[i1];
  if(!c0||!c1||!m0||!m1) return null;
  const dC=c1/c0-1, dM=m1/m0-1;
  /* o achado nao e a carteira subir ou descer — isso o grafico ja mostra. E as
     duas leituras do mesmo saldo andarem em ritmos diferentes: quando isso
     acontece, quem se moveu foi o faturamento que consome a carteira, e ele nao
     esta desenhado em lugar nenhum do quadro. */
  if(Math.abs(dC-dM)<.15) return null;
  /* faturamento implicito em cada ponta: saldo dividido pelos meses que ele cobre */
  const f0=c0/m0, f1=c1/m1, dF=f1/f0-1;
  const piorou=dM>dC;
  return {
    id:'carteira-meses-cobertura', fam:'oculto',
    score:clamp(Math.abs(dC-dM),0,1), tom:piorou?'warn':'ok',
    anchor:{labels:[L[i1]]},
    verdict:piorou
      ? `A carteira mal se mexeu em dinheiro (<b>${spct(dC,0)}</b>), mas o tempo para escoá-la `
        +`<b>saltou de ${nf(m0,1)} para ${nf(m1,1)} meses</b> — porque o faturamento caiu ${pct(-dF,0)}.`
      : `A carteira ${dC>=0?'subiu':'caiu'} <b>${spct(dC,0)}</b> em dinheiro e mesmo assim passou a cobrir `
        +`<b>${nf(m1,1)} meses</b>, contra ${nf(m0,1)} — porque o faturamento ${dF>=0?'subiu':'caiu'} ${pct(Math.abs(dF),0)}.`,
    texto:`"Meses de carteira" é o saldo dividido pelo que se fatura por mês. São dois números na conta, e neste `
      +`período quem se mexeu foi o de baixo. `
      +`O saldo saiu de ${mi(c0)} em ${esc(L[0])} para ${mi(c1)} em ${esc(L[i1])} — praticamente o mesmo tamanho. `
      +`O faturamento médio saiu de ${mi(f0)} para ${mi(f1)} por mês. `
      +(piorou
        ? `Por isso o mesmo bolo de pedidos passou a durar mais: não é que entrou mais pedido, é que está saindo `
          +`menos nota. Uma carteira estável com cobertura subindo é fila parada, não demanda nova.`
        : `Por isso o mesmo bolo de pedidos passou a durar menos: a fábrica está escoando mais rápido do que `
          +`a carteira se renova.`),
    ev:[['Carteira em '+L[0],mi(c0)],['Carteira em '+L[i1],mi(c1)],
        ['Faturava por mês',mi(f0)],['Fatura por mês',mi(f1)]],
    trigger:`valor ${spct(dC,0)} e cobertura ${spct(dM,0)} — ritmos distantes (limiar 15 p.p.)`,
  };
};

/* ---------- performance: distancia entre para onde vai e o que foi orcado ---------- */
/* ctx: {metas:M} */
R.projecaoDistancia=function(ctx){
  const M=ctx&&ctx.metas; if(!M||M.totProjHist==null||!M.metaAno) return null;
  const falta=M.metaAno-M.totProjHist;
  const sh=falta/M.metaAno;
  if(Math.abs(sh)<.03) return null;
  const abaixo=falta>0;
  const porMes=M.restantes?falta/M.restantes:0;
  const cagr=M.totProjCagr;
  return {
    id:'projecao-distancia', fam:'divergencia',
    score:clamp(Math.abs(sh)*2.2,0,1), tom:abaixo?'warn':'ok',
    anchor:{labels:M.idxRest&&M.idxRest.length?[MES[M.idxRest[M.idxRest.length-1]]]:null},
    verdict:abaixo
      ? `Mantido o comportamento dos anos anteriores, o ano fecha em <b>${mi(M.totProjHist)}</b> — `
        +`<b>${mi(falta)} abaixo</b> do orçamento de ${mi(M.metaAno)}.`
      : `Mantido o comportamento dos anos anteriores, o ano fecha em <b>${mi(M.totProjHist)}</b> — `
        +`<b>${mi(-falta)} acima</b> do orçamento de ${mi(M.metaAno)}.`,
    texto:`A projeção não soma o que falta para bater a meta: ela pega o que já foi vendido e pergunta que fração do ano `
      +`isso costuma ser. Até agora, os meses decorridos valem ${pct(M.frac,0)} de um ano típico. `
      +(abaixo
        ? `A diferença de ${mi(falta)} é o que precisa aparecer além do ritmo natural — ${mi(porMes)} por mês nos ${M.restantes} que restam. `
        : `A diferença de ${mi(-falta)} é a folga que o ritmo natural já daria sobre o orçamento. `)
      +(cagr!=null
        ? `Mantendo o próprio ritmo de crescimento dos últimos anos, o ano fecharia em ${mi(cagr)} — `
          +(cagr>M.metaAno?`acima do orçamento.`:`também abaixo do orçamento.`)
        : ''),
    ev:[['Para onde vai',mi(M.totProjHist)],['Orçado',mi(M.metaAno)],
        ['Diferença',mi(Math.abs(falta))],['Ritmo de crescimento',cagr!=null?mi(cagr):'—']],
    trigger:`projeção histórica ${pct(Math.abs(sh),0)} distante do orçamento (limiar 3%)`,
  };
};

/* ---------- ponto de equilibrio lido em receita bruta ---------- */
/* ctx: {rob, robEB, robRZ, meses, vol, peQ} */
R.equilibrioBruta=function(ctx){
  const c=ctx||{}; if(!c.rob||!c.robEB||!c.meses) return null;
  const faltaEB=c.robEB-c.rob, faltaRZ=c.robRZ?c.robRZ-c.rob:null;
  if(faltaEB<=0) return null;
  const mesEB=c.robEB/c.meses, mesReal=c.rob/c.meses;
  const razao=mesEB/mesReal;
  return {
    id:'equilibrio-bruta', fam:'consequencia',
    score:clamp((razao-1)/1.5,0,1), tom:'warn',
    verdict:`Para parar de dar prejuízo na operação a empresa precisa vender <b>${mi(mesEB)} por mês</b> — `
      +`hoje vende ${mi(mesReal)}. É <b>${nf(razao,2)}× o que vende hoje</b>.`,
    texto:`O número que a área comercial usa é a venda cheia, antes de imposto — é essa que aparece aqui. `
      +`No ano, seriam ${mi(c.robEB)} contra ${mi(c.rob)} realizados em ${c.meses} ${plural(c.meses,'mês','meses')}. `
      +(faltaRZ!=null&&faltaRZ>faltaEB
        ? `E isso só empata a operação. Para cobrir também os juros da dívida, o número sobe para ${mi(c.robRZ)} — `
          +`${mi(faltaRZ-faltaEB)} a mais, que é o que a dívida custa por si só. `
        : '')
      +(c.peQ&&c.vol
        ? `Em produto, são ${un(c.peQ)} contra ${un(c.vol)} vendidas.`
        : ''),
    ev:[['Vende hoje (mês)',mi(mesReal)],['Precisa vender (mês)',mi(mesEB)],
        ['Falta no período',mi(faltaEB)],['Com os juros',faltaRZ!=null?mi(c.robRZ):'—']],
    trigger:`equilíbrio a ${nf(razao,2)}× a venda atual`,
  };
};

/* ---------- custo fixo do mes: qual pacote explica a variacao ---------- */
/* ctx: {rows:[[pacote,atual,anterior,delta]], labAtual, labPrev, dim} */
R.cfPacoteVariacao=function(ctx){
  const R2=(ctx&&ctx.rows||[]).filter(r=>r[1]||r[2]);
  if(R2.length<3) return null;
  const totA=sum(R2.map(r=>r[1])), totP=sum(R2.map(r=>r[2]));
  if(!totP) return null;
  const dTot=totA-totP;
  const ord=[...R2].sort((a,b)=>Math.abs(b[3])-Math.abs(a[3]));
  const maior=ord[0];
  if(!maior||!dTot) return null;
  /* o achado e o pacote cujo movimento e maior que a variacao do total — quando
     isso acontece, ha movimentos em sentidos opostos se cancelando, e o total
     sozinho esconde os dois. */
  const domina=Math.abs(maior[3])/Math.abs(dTot);
  if(domina<1.15) return null;
  const contra=ord.filter(r=>r[3]*maior[3]<0).sort((a,b)=>Math.abs(b[3])-Math.abs(a[3]))[0];
  return {
    id:'cf-pacote-variacao', fam:'oculto',
    score:clamp((domina-1),0,1), tom:'note',
    anchor:{labels:contra?[maior[0],contra[0]]:[maior[0]]},
    verdict:`O custo fixo ${dTot>=0?'subiu':'caiu'} <b>${money(Math.abs(dTot))}</b> no mês, mas `
      +`<b>${esc(maior[0])} sozinho ${maior[3]>=0?'subiu':'caiu'} ${money(Math.abs(maior[3]))}</b>.`,
    texto:`A diferença entre os dois números não some: ela está em pacotes andando para o lado contrário. `
      +(contra
        ? `Enquanto ${esc(maior[0])} ${maior[3]>=0?'subia':'caía'}, ${esc(contra[0])} foi na direção oposta, `
          +`${contra[3]>=0?'subindo':'caindo'} ${money(Math.abs(contra[3]))} — e um cobriu parte do outro no total. `
        : `Somados, os demais pacotes andaram ${money(Math.abs(dTot-maior[3]))} no sentido inverso. `)
      +`Olhar só a linha de total do mês faz os dois movimentos desaparecerem.`,
    ev:[['Total do mês',money(totA)],['Mês anterior',money(totP)],
        [trunc(maior[0],18),(maior[3]>=0?'+':'')+money(maior[3])],
        [contra?trunc(contra[0],18):'Demais',(contra?(contra[3]>=0?'+':'')+money(contra[3]):money(dTot-maior[3]))]],
    trigger:`maior pacote move ${nf(domina,1)}× a variação do total (limiar 1,15×)`,
  };
};

/* ================= ESTUDOS · FABRICA x LOJA ================= */
/* rotulos da planilha vem sem acento e em caixa alta; normaliza p/ casar por regex */
const _norm2=t=>String(t||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase();
const _fl=()=>{
  const F=G.FABLOJA; if(!F||!F.blocos) return null;
  const bl={}; F.blocos.forEach(b=>bl[b.chave]=b);
  /* o ano em foco vem do filtro da secao; sem ele (HTML antigo, de um ano so) cai no padrao.
     Sem isso os destaques falariam de 2026 com a tela mostrando 2025. */
  const ano=G.FABLOJA_ANO||F.ano_padrao;
  const li=k=>{const B=bl[k]; if(!B) return [];
    return (B.anos&&B.anos[ano])||B.linhas||[];};
  return {F,bl,li,ano};
};

/* a margem da Fabrica no quadro nao mede desempenho: repete a regra de transferencia.
   Base = RECEITA OPERACIONAL LIQUIDA, a mesma linha "% sobre a ROL" que o quadro exibe —
   com a ROB o percentual do Modelo A bateria, mas o da leitura antiga nao, porque so
   ela tem deducoes de venda ao cliente final. */
R.fabLojaLinhas=function(){
  const X=_fl(); if(!X||!X.li('FABRICA').length) return null;
  const B=X.li('FABRICA');
  const acha=re=>B.find(l=>re.test(_norm2(l[0])));
  const rl=acha(/^\(=\)\s*RECEITA OPERACIONAL LIQUIDA/), mc=acha(/^\(=\)\s*MARGEM DE CONTRIBUICAO/);
  if(!rl||!mc||rl[2]==null||mc[2]==null||!rl[2]) return null;
  const margNova=mc[2]/rl[2];
  const margAntiga=(rl[1]&&mc[1]!=null)?mc[1]/rl[1]:null;
  if(margAntiga==null||Math.abs(margNova-margAntiga)<.05) return null;
  return {
    id:'fabloja-linhas', fam:'oculto', tabela:true,
    score:clamp(Math.abs(margAntiga-margNova)*1.5,0,1), tom:'note',
    verdict:`Os <b>${pct(margNova,1)}</b> de margem da Fábrica no quadro não são desempenho: são a `
      +`<b>regra de transferência</b>. Na leitura antiga a mesma linha dava ${pct(margAntiga,1)}.`,
    texto:`No modelo antigo a Fábrica vendia ao cliente final e a margem dela era o que sobrava do preço de mercado. `
      +`No Modelo A ela não vende: repassa para a Loja pelo custo de absorção mais um markup fixo acordado. `
      +`A margem dela vira esse markup — ${mi(mc[2])} sobre ${mi(rl[2])} transferidos. `
      +`Isso muda o que o número significa: ele para de medir se a fábrica produziu bem ou mal e passa a repetir `
      +`a regra de transferência. Comparar a coluna da Fábrica com a da Loja nesta linha, portanto, não compara duas `
      +`operações — compara uma operação com uma premissa. O que a fábrica faz de fato aparece mais abaixo, na `
      +`absorção da produção.`,
    ev:[['Margem antes (% da ROL)',pct(margAntiga,1)],['Margem depois (% da ROL)',pct(margNova,1)],
        ['Transferido no período',money(rl[2])],['Margem em R$',money(mc[2])]],
    trigger:`margem da Fábrica sobre a ROL passa de ${pct(margAntiga,1)} para ${pct(margNova,1)} (limiar 5 p.p.)`,
  };
};


/* ---------- divida: o juro de um ano contra o dinheiro novo daquele ano ---------- */
/* ctx: {anos:[{ano,liq,cor,saldo,meses}]} */
R.dividaJuroAno=function(ctx){
  const A=(ctx&&ctx.anos||[]).filter(o=>o.saldo);
  if(A.length<3) return null;
  const ult=A[A.length-1];
  const cheios=A.filter(o=>o.meses===12);
  const virada=cheios.find(o=>o.cor>o.liq);
  if(!virada) return null;
  /* quanto tempo a divida levaria para dobrar so com o juro do ultimo ano cheio */
  const ref=cheios[cheios.length-1]||ult;
  const taxa=ref.saldo?ref.cor/(ref.saldo-ref.cor||ref.saldo):0;
  const dobra=taxa>0?Math.log(2)/Math.log(1+taxa):null;
  const antes=cheios.filter(o=>o.ano<virada.ano);
  const picoLiq=antes.length?Math.max(...antes.map(o=>o.liq)):null;
  return {
    id:'divida-juro-ano', fam:'padrao',
    score:clamp(virada.cor/(virada.liq||1)/4,.3,1), tom:'warn',
    anchor:{labels:[String(virada.ano)]},
    verdict:`Em <b>${virada.ano}</b> o juro do ano (${mi(virada.cor)}) passou o dinheiro novo que entrou `
      +`(${mi(virada.liq)}) — e não voltou atrás depois disso.`,
    texto:`Até ali a dívida crescia porque o acionista colocava dinheiro. De ${virada.ano} em diante ela cresce `
      +`principalmente sozinha. `
      +(picoLiq!=null?`O aporte anual saiu de ${mi(picoLiq)} no melhor ano para ${mi(ult.liq)} no último. `:'')
      +(dobra!=null&&dobra<25
        ? `No ritmo de juro do último ano fechado, o saldo dobraria em cerca de ${nf(dobra,0)} anos sem ninguém `
          +`tomar mais um real.`
        : ''),
    ev:[['Ano da virada',String(virada.ano)],['Juro do ano',mi(virada.cor)],
        ['Dinheiro novo',mi(virada.liq)],['Saldo hoje',mi(ult.saldo)]],
    trigger:`juro do ano supera o aporte líquido a partir de ${virada.ano}`,
  };
};

/* ---------- quanto de venda cada real de custo fixo exige ---------- */
/* ctx: {rol, mc, cf, deprec, financeiro} */
R.equilibrioAlavanca=function(ctx){
  const c=ctx||{}; if(!c.rol||!c.mc||!c.cf) return null;
  const mcPct=c.mc/c.rol;
  if(mcPct<=0||mcPct>=1) return null;
  const porReal=1/mcPct;               // venda necessária para cobrir R$ 1 de custo fixo
  if(porReal<1.15) return null;
  const fin=Math.abs(c.financeiro||0), dep=Math.abs(c.deprec||0);
  return {
    id:'equilibrio-alavanca', fam:'decomposicao',
    score:clamp((porReal-1)/3,0,1), tom:'note',
    verdict:`De cada R$ 100 vendidos, sobram <b>${money(mcPct*100)}</b> depois do que varia com a venda. `
      +`É por isso que cada real de custo fixo exige <b>${money(porReal,2)} de venda</b> para se pagar.`,
    texto:`A conta do equilíbrio é essa: o que sobra de cada venda tem de cobrir tudo o que a empresa gasta `
      +`independentemente de vender. Como sobram ${pct(mcPct,0)}, o custo fixo de ${mi(c.cf)} precisa de `
      +`${mi(c.cf*porReal)} de receita só para empatar. `
      +(fin?`Somando os juros da dívida (${mi(fin)})`+(dep?` e a depreciação (${mi(dep)})`:'')
            +`, o alvo sobe para ${mi((c.cf+fin+dep)*porReal)}. `:'')
      +`Quanto menor a sobra por venda, mais receita cada despesa fixa custa — é o mesmo custo fixo pesando mais.`,
    ev:[['Sobra por venda',pct(mcPct,1)],['Venda por R$ 1 de fixo',money(porReal,2)],
        ['Custo fixo',mi(c.cf)],['Receita para empatar',mi(c.cf*porReal)]],
    trigger:`cada R$ 1 de custo fixo exige ${money(porReal,2)} de venda (limiar R$ 1,15)`,
  };
};

/* ---------- fabrica e loja: o que separa as duas ---------- */
/* ctx: {f, d, g} agregados de DRE */
R.dreFabricaLoja=function(ctx){
  const f=ctx&&ctx.f, d=ctx&&ctx.d;
  if(!f||!d||!f.receita_liquida||!d.receita_liquida) return null;
  const mf=f.margem_contrib/f.receita_liquida, md=d.margem_contrib/d.receita_liquida;
  if(!isFinite(mf)||!isFinite(md)) return null;
  const gap=Math.abs(mf-md);
  if(gap<.06) return null;
  const maior=mf>=md?{n:'Fábrica',m:mf,r:f.receita_liquida,fx:-f.despesas_op}:{n:'Loja',m:md,r:d.receita_liquida,fx:-d.despesas_op};
  const menor=mf>=md?{n:'Loja',m:md,r:d.receita_liquida,fx:-d.despesas_op}:{n:'Fábrica',m:mf,r:f.receita_liquida,fx:-f.despesas_op};
  /* o segundo grau: a que tem margem melhor pode ser a que dá o pior resultado,
     porque o custo fixo dela é maior — a margem sozinha não decide */
  const resMaior=maior.r*maior.m-maior.fx, resMenor=menor.r*menor.m-menor.fx;
  const inverte=resMaior<resMenor;
  return {
    id:'dre-fabrica-loja', fam:inverte?'oculto':'divergencia',
    score:clamp(gap*4,0,1), tom:'note',
    anchor:{labels:[maior.n,menor.n]},
    verdict:inverte
      ? `<b>${maior.n} tem a melhor margem (${pct(maior.m,0)} contra ${pct(menor.m,0)}) e ainda assim o pior resultado</b> — `
        +`o custo fixo dela é ${mi(maior.fx)}, contra ${mi(menor.fx)}.`
      : `De cada R$ 100 de receita, sobram <b>${money(maior.m*100)} na ${maior.n}</b> e ${money(menor.m*100)} na ${menor.n}, `
        +`antes das despesas fixas.`,
    texto:`Margem e resultado não são a mesma coisa. A ${maior.n} guarda ${pct(maior.m,0)} de cada venda depois do que `
      +`varia; a ${menor.n}, ${pct(menor.m,0)}. Mas cada uma carrega uma estrutura fixa diferente: `
      +`${mi(maior.fx)} contra ${mi(menor.fx)}. `
      +(inverte
        ? `Por isso a de melhor margem termina atrás: ela precisa de muito mais volume para pagar a própria estrutura.`
        : `Como as duas leituras apontam para o mesmo lado, aqui a margem já antecipa o resultado.`),
    ev:[[maior.n+' · sobra por venda',pct(maior.m,1)],[menor.n+' · sobra por venda',pct(menor.m,1)],
        [maior.n+' · custo fixo',mi(maior.fx)],[menor.n+' · custo fixo',mi(menor.fx)]],
    trigger:`margens distantes ${pct(gap,0)} entre as duas unidades (limiar 6 p.p.)`,
  };
};

/* ---------- DRE comparativo: o que explica a variação do mês ---------- */
/* ctx: {cols:[[rotulo,vals],...], linhas:DRE_LINES} */
R.dreComparativoMotor=function(ctx){
  const C=ctx&&ctx.cols, LN=ctx&&ctx.linhas;
  if(!C||C.length<4||!LN) return null;
  const val=(i,k)=>+(C[i][1][k]||0);
  /* linha de resultado no fim da estrutura; as demais sao os componentes */
  const comp=LN.filter(l=>l[2]!=='t');
  if(comp.length<3) return null;
  const dMes=comp.map(l=>({nome:l[1], d:val(1,l[0])-val(0,l[0])}));
  const dAno=comp.map(l=>({nome:l[1], d:val(3,l[0])-val(2,l[0])}));
  const topo=a=>a.slice().sort((x,y)=>Math.abs(y.d)-Math.abs(x.d))[0];
  const tm=topo(dMes), ta=topo(dAno);
  if(!tm||!ta||!tm.d||!ta.d) return null;
  const iguais=tm.nome===ta.nome;
  /* soma das variacoes que vao contra a linha campea — o que ela esconde */
  const contra=dMes.filter(x=>x.d*tm.d<0).reduce((s,x)=>s+Math.abs(x.d),0);
  return {
    id:'dre-comparativo-motor', fam:iguais?'decomposicao':'divergencia',
    score:.55, tom:'note',
    anchor:{labels:[tm.nome]},
    verdict:iguais
      ? `<b>${esc(tm.nome)}</b> é a linha que mais se mexe nos dois recortes: `
        +`${money(tm.d)} no mês e ${money(ta.d)} no acumulado do ano.`
      : `No mês quem mais se mexe é <b>${esc(tm.nome)}</b> (${money(tm.d)}); no acumulado do ano, `
        +`<b>${esc(ta.nome)}</b> (${money(ta.d)}). <b>Não é a mesma linha.</b>`,
    texto:(iguais
      ? `A mesma linha manda no mês e no ano, então o que se vê aqui não é oscilação de um mês solto. `
      : `Um mês forte numa linha não quer dizer que ela seja a que decide o ano — e é o ano que aparece no `
        +`resultado publicado. Olhar só a coluna do mês leva a conclusão diferente da que os doze meses dariam. `)
      +(contra>0
        ? `Outras linhas andaram ${money(contra)} no sentido contrário no mês, cobrindo parte do movimento — `
          +`por isso o total varia menos do que a maior linha isolada.`
        : `Neste mês as linhas andaram todas para o mesmo lado.`),
    ev:[['Mais move no mês',trunc(tm.nome,20)],['Valor',money(tm.d)],
        ['Mais move no ano',trunc(ta.nome,20)],['Valor',money(ta.d)]],
    trigger:iguais?`mesma linha domina mês e acumulado`:`linha dominante do mês difere da do acumulado`,
  };
};

/* ---------- carteira: o tamanho do pedido muda conforme o tempo de espera ---------- */
/* ctx: {aging:[[faixa,valor,pedidos]]} */
R.carteiraTicketPorEspera=function(ctx){
  const A=(ctx&&ctx.aging||[]).filter(x=>x[2]>0&&x[1]>0);
  if(A.length<3) return null;
  const it=A.map(x=>({nome:x[0], v:x[1], n:x[2], tk:x[1]/x[2]}));
  const tot=sum(it.map(x=>x.v)), nTot=sum(it.map(x=>x.n));
  const media=tot/nTot;
  const ord=it.slice().sort((a,b)=>b.tk-a.tk);
  const caro=ord[0], barato=ord[ord.length-1];
  const razao=caro.tk/barato.tk;
  if(razao<1.5) return null;
  return {
    id:'carteira-ticket-espera', fam:'oculto',
    score:clamp((razao-1)/3,0,1), tom:'note',
    anchor:{labels:[caro.nome,barato.nome]},
    verdict:`O pedido que espera em <b>${esc(caro.nome)}</b> vale ${money(caro.tk)}; o de `
      +`<b>${esc(barato.nome)}</b>, ${money(barato.tk)} — <b>${nf(razao,1)}× de diferença</b>.`,
    texto:`As barras mostram quanto dinheiro está parado em cada faixa; o que elas não mostram é o tamanho de `
      +`cada pedido dentro dela. `
      +`Em ${esc(caro.nome)} são ${nf(caro.n)} ${plural(caro.n,'pedido','pedidos')} somando ${mi(caro.v)}; `
      +`em ${esc(barato.nome)}, ${nf(barato.n)} somando ${mi(barato.v)}. `
      +`A média da carteira é ${money(media)} por pedido. `
      +`Faixa com pedido grande e faixa com pedido pequeno pesam igual no gráfico e são problemas de natureza diferente.`,
    ev:[[trunc(caro.nome,16),money(caro.tk)+'/pedido'],[trunc(barato.nome,16),money(barato.tk)+'/pedido'],
        ['Média da carteira',money(media)],['Pedidos em aberto',nf(nTot)]],
    trigger:`valor por pedido varia ${nf(razao,1)}× entre as faixas de espera (limiar 1,5×)`,
  };
};

G.INS={FAM,R,serieVendas,serieVendasPR,posicaoNaSerie,pedidosDoMes,quantosPara};

/* =====================================================================
   RUNTIME — botão discreto por figura + digest da seção
   ===================================================================== */
/* Sem teto: a regra do relatório é que todo gráfico e todo quadro tenham
   análise. A régua fechada é um botão de 30px, então cobertura total não
   adensa a página; o digest continua mostrando só os 3 mais fortes. */
const TETO_SECAO=Infinity;

function aplicaOverride(o){
  const M=G.DESTAQUES_MANUAIS||{}; const m=M[o.id]; if(!m) return o;
  if(m.oculto) return null;
  return Object.assign({},o,{verdict:m.verdict||o.verdict, texto:m.texto||o.texto, manual:true});
}

/* HTML da régua. FECHADA é só um botão — nenhum texto, nada do conteúdo.
   É o que permite abrir um a um durante a apresentação. */
function strip(o){
  if(!o) return '';
  o=aplicaOverride(o); if(!o) return '';
  const ev=(o.ev||[]).map(e=>`<div><span>${esc(e[0])}</span><strong>${e[1]}</strong></div>`).join('');
  const anchor=o.anchor?` data-anchor="${esc((o.anchor.labels||[]).join('|'))}"`:'';
  const tab=o.tabela?' data-tabela="1"':'';
  const lei=o._leitura?` data-leitura="${esc(o._leitura)}"`:'';
  return `<div class="hl${o.tom?' t-'+o.tom:''}" data-ins="${esc(o.id)}" data-score="${(o.score||0).toFixed(3)}"${anchor}${tab}${lei}>
  <button class="hl-bar" type="button" aria-expanded="false" aria-label="Ver a análise" title="Ver a análise"><span class="hl-mark">◆</span></button>
  <div class="hl-body">
    <div class="hl-fam">${esc(FAM[o.fam]||o.fam)}</div>
    <p class="hl-verdict">${o.verdict}</p>
    <p>${o.texto}</p>
    ${ev?`<div class="hl-ev">${ev}</div>`:''}
    <p class="hl-trg">Gatilho: ${esc(o.trigger||'—')}${o.manual?' · texto editado no config':''}<br><span class="hl-id" title="Use este identificador em destaques_manuais, no config_apresentacao.json">id: <code>${esc(o.id)}</code></span></p>
  </div>
</div>`;
}

/* ---------- âncora: acende no gráfico o que a frase afirma ---------- */
function casaRotulo(titulo,labels){
  const toks=String(titulo||'').split(/[·:]/).map(x=>x.trim().toUpperCase()).filter(Boolean);
  return labels.some(l=>l&&toks.includes(String(l).trim().toUpperCase()));
}
function acende(hl,ligar){
  /* A régua de um quadro não tem SVG próprio. Quando cita rótulos que o gráfico
     logo acima mostra, acende aquele gráfico. */
  let svg=null;
  const fig=hl.closest('.fig');
  if(fig) svg=fig.querySelector('svg');
  if(!svg){
    const sec=hl.closest('section');
    if(sec){ const figs=[...sec.querySelectorAll('.fig')];
      const y=hl.getBoundingClientRect().top;
      const acima=figs.filter(f=>f.getBoundingClientRect().top<y);
      const alvo=acima.length?acima[acima.length-1]:figs[0];
      if(alvo) svg=alvo.querySelector('svg'); }
  }
  if(!svg) return;
  svg.querySelectorAll('.ins-ring').forEach(e=>e.remove());
  svg.classList.remove('ins-dim');
  svg.querySelectorAll('.ins-on').forEach(e=>e.classList.remove('ins-on'));
  if(!ligar) return;
  const labels=(hl.dataset.anchor||'').split('|').filter(Boolean); if(!labels.length) return;
  const alvos=[];
  svg.querySelectorAll('rect,circle,path,polygon').forEach(el=>{
    const t=el.querySelector('title'); if(!t) return;
    if(casaRotulo(t.textContent,labels)) alvos.push(el);
  });
  if(!alvos.length) return;
  svg.classList.add('ins-dim');
  const ns='http://www.w3.org/2000/svg';
  const g=document.createElementNS(ns,'g'); g.setAttribute('class','ins-ring');
  const comAnel=alvos.length<=4;   // um anel marca um ponto; numa faixa vira ruído
  let ok=false;
  alvos.forEach(el=>{
    el.classList.add('ins-on');
    if(!comAnel) return;
    let b; try{ b=el.getBBox(); }catch(e){ return; }
    if(!b||!isFinite(b.width)) return;
    const pad=Math.max(3,Math.min(7,b.width*.12));
    const r=document.createElementNS(ns,'rect');
    r.setAttribute('x',(b.x-pad).toFixed(2)); r.setAttribute('y',(b.y-pad).toFixed(2));
    r.setAttribute('width',(b.width+pad*2).toFixed(2)); r.setAttribute('height',(b.height+pad*2).toFixed(2));
    r.setAttribute('rx','3'); r.setAttribute('fill','none');
    r.setAttribute('stroke','#92705d'); r.setAttribute('stroke-width','1.5');
    r.setAttribute('stroke-dasharray','3 3');
    g.appendChild(r); ok=true;
  });
  if(ok) svg.appendChild(g);
}

function abre(hl,estado){
  const on=estado===undefined?!hl.classList.contains('open'):estado;
  hl.classList.toggle('open',on);
  const bar=hl.querySelector('.hl-bar'); if(bar) bar.setAttribute('aria-expanded',String(on));
  acende(hl,on);
}

/* ---------- digest: os melhores da seção, no topo do capítulo ---------- */
function digest(sec){
  const hls=[...sec.querySelectorAll('.hl')];
  if(hls.length<2) return;
  const h2=sec.querySelector('.sec-head h2');
  const titulo=h2?h2.textContent.trim():'';
  const ord=[...hls].sort((a,b)=>(+b.dataset.score||0)-(+a.dataset.score||0)).slice(0,3);
  const itens=ord.map(hl=>{
    if(!hl.id) hl.id='hl-'+(sec.id||'s')+'-'+hls.indexOf(hl);
    const b=hl.querySelector('.hl-verdict');
    return {hl, txt:b?b.innerHTML:'', fonte:hl.dataset.tabela?'quadro':'gráfico'};
  });
  const box=document.createElement('div'); box.className='digest';
  box.innerHTML=`<div class="dh"><span>Destaques${titulo?' · '+esc(titulo):''}</span>`
    +`<em>${hls.length} ${plural(hls.length,'achado','achados')} nesta seção</em></div>`
    +itens.map((it,i)=>`<div class="dg"><span class="dn">${String(i+1).padStart(2,'0')}</span>`
      +`<span class="dt">${it.txt}</span>`
      +`<a href="#${it.hl.id}" data-go="${it.hl.id}">ver ${it.fonte}</a></div>`).join('');
  const head=sec.querySelector('.sec-head');
  if(head&&head.nextSibling) head.parentNode.insertBefore(box,head.nextSibling);
  else sec.insertBefore(box,sec.firstChild);
  box.querySelectorAll('a[data-go]').forEach(a=>a.addEventListener('click',ev=>{
    ev.preventDefault();
    const alvo=document.getElementById(a.dataset.go); if(!alvo) return;
    alvo.scrollIntoView({behavior:'smooth',block:'center'});
    if(!alvo.classList.contains('open')) abre(alvo,true);
    alvo.classList.add('hl-flash'); setTimeout(()=>alvo.classList.remove('hl-flash'),1400);
  }));
}

function mount(root){
  const escopo=root||document;
  const secs=escopo.matches&&escopo.matches('section')?[escopo]:[...escopo.querySelectorAll('section')];
  (secs.length?secs:[escopo]).forEach(sec=>{
    sec.querySelectorAll(':scope > .digest').forEach(e=>e.remove());
    const hls=[...sec.querySelectorAll('.hl')];
    if(!hls.length) return;
    const ord=[...hls].sort((a,b)=>(+b.dataset.score||0)-(+a.dataset.score||0));
    ord.slice(TETO_SECAO).forEach(e=>e.remove());
    /* Um grafico e o quadro do mesmo dado podem cair na mesma leitura quando as
       alternativas nao passam no gatilho. Repetir a frase e pior que nao ter:
       a segunda ocorrencia sai. */
    const vistos=new Set();
    sec.querySelectorAll('.hl').forEach(hl=>{
      const v=hl.querySelector('.hl-verdict'); if(!v) return;
      /* mesma leitura sobre a mesma origem (o quadro so acrescenta "-tab" ao id)
         conta como repeticao, ainda que a frase mude uma palavra. */
      const base=(hl.dataset.ins||'').replace(/-tab$/,'');
      const chave=(hl.dataset.leitura?hl.dataset.leitura+'@'+base:v.textContent.trim());
      if(vistos.has(chave)) hl.remove(); else vistos.add(chave);
    });
    sec.querySelectorAll('.hl').forEach(hl=>{
      if(hl.dataset.wired) return; hl.dataset.wired='1';
      hl.querySelector('.hl-bar').addEventListener('click',()=>abre(hl));
    });
    if(sec.querySelector('.sec-head')) digest(sec);
  });
}

/* Abrir/recolher todas de uma vez continua disponivel pelo console
   (INSRT.todos(true) / INSRT.todos(false)) e automaticamente na impressao,
   mas sem botao na tela: o controle e por figura. */
/* ---------- reidratar réguas clonadas (modo tela cheia) ---------- */
/* O modal de ampliação clona a figura inteira, então a régua vai junto — mas
   um clone não carrega listener, e o data-wired vem colado impedindo a
   religação. Aqui a marca é limpa e os cliques voltam a funcionar. */
function rehydrate(root){
  if(!root) return;
  root.querySelectorAll('.digest').forEach(e=>e.remove());
  root.querySelectorAll('.hl').forEach(hl=>{
    hl.removeAttribute('data-wired');
    hl.classList.remove('open');
    const bar=hl.querySelector('.hl-bar'); if(!bar) return;
    bar.setAttribute('aria-expanded','false');
    hl.dataset.wired='1';
    bar.addEventListener('click',()=>abre(hl));
  });
}

function todos(aberto){ document.querySelectorAll('.hl').forEach(hl=>abre(hl,!!aberto)); }

G.INSRT={strip,mount,abre,todos,rehydrate,TETO_SECAO};

})(typeof window!=='undefined'?window:globalThis);
