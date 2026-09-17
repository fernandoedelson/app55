/* Dívida e endividamento — desenho de renderDivida() do Kit, alimentado pelo servidor. */
'use strict';
window.DESENHO=window.DESENHO||{};
DESENHO.divida=function(P){
  const A=P['divida.abertura'];
  const kpisEndiv=K=>'<div class="kpis">'
     +kpi('Endividamento gerado · '+K.D0,mi(K.endiv0),'no ano','warn')
     +kpi('Endividamento gerado · '+K.D1,mi(K.endiv1),ytdLab(K.maxym),'warn')
     +kpi('Endividamento acum. (desde '+ymLab(K.D0*100+1).toLowerCase()+')',mi(K.acum),'geração acumulada','warn')
     +kpi('Juros passivos a terceiros · '+K.D0,mi(K.juros0),'custo da dívida','warn')
     +'</div>';
  let s='';
  if(A){ const AP=A.ap;
    s+=`<div class="sec-head"><div class="kick">Estrutura financeira</div><h2>Dívida e fluxo de endividamento</h2>
     <p class="lead">Saldo real da dívida com o acionista${A.tem_ap?' (corrigido por 100% do CDI)':''}, e a leitura de geração de endividamento e custo financeiro a partir da DRE. Geração de endividamento = (Venda Líquida × margem equalizada) − Custo Fixo; valores positivos indicam consumo de caixa financiado por dívida.</p></div>`;
    if(AP){
      s+='<div class="kpis">'
       +kpi('Saldo atual da dívida',mi(AP.saldo_atual),ymLab(AP.ym_fim)+' · aporte + correção','warn')
       +kpi('Aporte líquido acumulado',mi(AP.aporte_fim),'total aportado '+mi(AP.total_remessas)+' − devolvido '+mi(Math.abs(AP.total_recebimentos)))
       +kpi('Correção/juros acumulados',mi(AP.total_correcao),'100% CDI, desde '+ymLab(AP.ym_ini),'warn')
       +kpi('% do saldo que é correção',pct(AP.total_correcao/AP.saldo_atual,0),'sobre o saldo atual','warn')
       +'</div>';
    }
    if(A.kpis) s+=kpisEndiv(A.kpis);
  }
  const S=P['dv-saldo'];
  if(S){
    s+=H3('Saldo da dívida com o acionista','área empilhada — aporte líquido acumulado + correção (100% CDI) acumulada','dv-saldo');
    s+=fig(stackedArea(S.yms.map(ymLab),[
      {name:'Aporte líquido acumulado',values:S.aporte,color:SER[0]},
      {name:'Correção/juros acumulados',values:S.correcao,color:WARN},
    ],{valfmt:v=>mi(v,1)}),ins('dividaCorrecao','divida-correcao'));
    s+=cap('O saldo cresce majoritariamente por correção monetária, não por novos aportes: '+mi(S.total_remessas)+' aportados historicamente (com '+mi(Math.abs(S.total_recebimentos))+' devolvidos) já viraram '+mi(S.saldo_atual)+' corrigidos — '+mi(S.total_correcao)+' de juros/correção acumulados ('+pct(S.total_correcao/S.saldo_atual,0)+' do saldo atual).');
  }
  const N=P['dv-ano'];
  if(N){ const anoRows=N.linhas, T=N.total;
    const rotAno=o=>o.meses===12?String(o.ano):o.ano+' ('+o.meses+'m)';
    const virada=N.virada, ult=anoRows[anoRows.length-1];
    s+=H3('Evolução ano a ano','quanto do crescimento foi dinheiro novo e quanto foi correção','dv-ano');
    s+=fig(evolCombo(anoRows.map(rotAno),[
      {name:'Aporte líquido',values:anoRows.map(o=>o.liq),color:SER[0]},
      {name:'Correção do ano',values:anoRows.map(o=>o.cor),color:WARN}],
      anoRows.map(o=>o.saldo),{valfmt:v=>mi(v,1)}),ins('dividaJuroAno','divida-juro-ano'));
    s+=table(['Ano','Saldo inicial','Aporte novo','Devolvido','Correção do ano','Saldo final'],
      anoRows.map(o=>[rotAno(o),money(o.ini),money(o.rem),o.rec?money(o.rec):'—',
        `<span style="color:${WARN};font-weight:600">${money(o.cor)}</span>`,money(o.saldo)]),
      ['left','right','right','right','right','right'],
      ['Total','—',money(T[0]),money(T[1]),money(T[2]),money(T[3])],ins('auto','auto-divida-anos'));
    s+=cap('Aporte líquido = remessas menos devoluções; somado à correção, é exatamente a variação do saldo no ano — por isso as barras fecham com o degrau da área.');
    if(virada) s+=call('<b>'+virada.ano+' foi o ano em que a dívida passou a crescer mais por juro do que por dinheiro novo</b> — '
      +mi(virada.cor)+' de correção contra '+mi(virada.liq)+' de aporte líquido. O aporte caiu de '
      +mi(N.pico_liq)+' no pico para '+mi(ult.liq)+' em '+rotAno(ult)
      +', enquanto a correção seguiu subindo.','warn');
    s+=kpisEndiv(N.kpis);
  }
  const D=P['dv-endiv'];
  if(D){
    s+=H3('Endividamento gerado — acumulado desde '+ymLabAno(D.D0*100+1),'','dv-endiv');
    s+=fig(line([['Endividamento acumulado',D.cum,SER[7]]],D.yms.map(ymLab),{valfmt:v=>mi(v,1),w:980,h:290}),ins('serieOscilacao','serie-oscilacao-endiv-acum')||ins('auto','auto-endiv-acum'));
    s+=cap('Acumulado da geração mensal de endividamento (consumo de caixa coberto por dívida) — proxy extraída da DRE, não é o saldo real da dívida'+(D.tem_ap?' (esse já aparece acima, a partir do saldo diário do acionista)':' com o acionista')+'.');
  }
  const J=P['dv-juros'];
  if(J){
    s+=H3('Custo financeiro — juros passivos a terceiros','','dv-juros');
    s+=fig(line([['Juros passivos a terceiros (mês)',J.juros,SER[1]]],J.yms.map(ymLab),{valfmt:v=>mi(v,1),w:980,h:270}),ins('serieOscilacao','serie-oscilacao-juros-terceiros')||ins('auto','auto-juros-terceiros'));
    const mut='<span class="mut">—</span>', ver=v=>`<span style="color:${BAD}">${money(v)}</span>`;
    s+=table(['Ano','Juros passivos a terceiros','Endividamento gerado','Aporte no ano (acionista)','Correção/juros no ano (acionista)'],
      J.linhas.map(l=>[l[0]===null?J.D1+' ('+ytdLab(J.maxym)+')':l[0],ver(l[1]),l[2]===null?mut:ver(l[2]),
        l[3]?money(l[3]):mut,l[4]?money(l[4]):mut]),
      ['left','right','right','right','right']);
  }
  const G=P['dv-geracao'];
  if(G){ const ano26lab=G.D1+' ('+ytdLab(G.maxym)+')';
    s+=H3('Geração de endividamento mês a mês',G.D0+'–'+G.D1,'dv-geracao');
    s+=table(['Mês','Endividamento gerado','Endividamento acumulado','Juros passivos'],
      G.yms.map((ym,i)=>[ymLab(ym),
        (G.ger[i]>=0?`<span style="color:${BAD}">${money(G.ger[i])}</span>`:`<span style="color:${GOOD}">${money(G.ger[i])}</span>`),
        money(G.cum[i]), money(G.juros[i])]),
      ['left','right','right','right'],null,ins('auto','auto-endiv-mes'));
    const jA=G.jA, jB=G.jB;
    const verboJuros=jB>jA*1.2?'saltou':(jB>=jA?'subiu':'caiu');
    s+=call('O custo financeiro (juros a terceiros) '+verboJuros+' de '+mi(jA)+' em '+(G.D0-1)+' para '+mi(jB)+' em '+G.D0+(jB>=jA?' — é o principal vetor do resultado líquido negativo':'')+'. A geração de endividamento operacional (consumo de caixa) somou '+mi(G.endiv0)+' em '+G.D0+' e '+mi(G.endiv1)+' em '+ano26lab+'.','warn');
    s+='<div class="sources"><b>Nota:</b> '+(G.tem_ap?'saldo da Dívida com o Acionista extraído do razão diário (Aportes.xlsx), já corrigido por 100% do CDI.':'saldo da Dívida com o Acionista (corrigido por 100% do CDI) não encontrado nesta geração — consta apenas na apresentação de resultados como material específico.')+' Geração de endividamento e custo financeiro extraídos da DRE.</div>';
  }
  return s;
};
