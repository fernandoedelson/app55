/* Performance Comercial — desenho de renderPerformance() do Kit; o metasCalc vem do servidor. */
'use strict';
window.DESENHO=window.DESENHO||{};
DESENHO.performance=function(P){
  const base=P['performance.abertura']||P['perf-acum']||P['perf-mes'];
  if(!base) return '';
  const M=base.M;
  let s='';
  if(!M){
    if(P['performance.abertura']) s+=`<div class="sec-head"><h2>Performance Comercial</h2></div>`
      +call('Fonte "Metas Vendas '+base.anoV+'.xlsx" não encontrada em fontes/. Seção não gerada.','warn');
    return s;
  }
  const atg=M.metaAteAgora?M.realAteAgora/M.metaAteAgora:0;
  const mediaRest=M.restantes?(M.metaAno-M.realAteAgora)/M.restantes:0;
  const mediaReal=M.realAteAgora/(M.iUlt+1);
  if(P['performance.abertura']){
    s+=`<div class="sec-head"><div class="kick">Meta × realizado · ${M.ano}</div><h2>Performance Comercial</h2>
     <p class="lead">Venda contratada contra a meta de ${M.ano}, mês a mês e no acumulado. A meta vem de <b>Metas Vendas ${M.ano}.xlsx</b>; o realizado é apurado na base comercial até <b>${ymLab(M.fim)}</b>. A <b>meta sazonal</b> redistribui o gap acumulado pelos ${M.restantes} meses que restam <b>conforme o peso histórico de cada mês</b> — é o ritmo necessário para fechar o ano no orçado, cobrando mais de quem historicamente entrega mais.</p></div>`;
    s+='<div class="kpis k4">'
     +kpi('Realizado · acumulado',mi(M.realAteAgora),ymLab(M.yms[0])+'–'+ymLab(M.fim))
     +kpi('Meta · mesmo período',mi(M.metaAteAgora),M.iUlt+1+' meses')
     +kpi('Gap acumulado',mi(M.gapAcum),spct(atg-1)+' vs meta',M.gapAcum>0?'warn':'ok')
     +kpi('Atingimento',pct(atg,1),'do orçado no período',atg>=1?'ok':'warn')
     +'</div>';
    s+='<div class="kpis k3">'
     +kpi('Meta do ano',mi(M.metaAno),M.yms.length+' meses')
     +kpi('A realizar',mi(M.aRealizar),'em '+M.restantes+' meses')
     +kpi('Ritmo necessário',mi(mediaRest),'por mês · média realizada '+mi(mediaReal),mediaRest>mediaReal?'warn':'ok')
     +'</div>';
  }
  if(P['perf-acum']){
    s+=H3('Vendas realizadas vs. orçamento '+M.ano,'acumulado','perf-acum');
    s+=fig(areaCum(M.labels,[
      {name:'Acumulado Orçamento',values:M.metaAcum,color:GOOD},
      {name:'Vendas Realizadas Acum.',values:M.realAcum,color:SER[2],abaixo:true}],{w:980,h:360}),
      ins('metaRitmo'));
    s+=cap('Valores em R$ mil. A área verde é a meta acumulada do ano; a azul, o realizado acumulado, que se encerra em '+ymLab(M.fim)+' — último mês da base comercial.');
  }
  if(P['perf-mes']){
    s+=H3('Vendas realizadas vs. orçamento '+M.ano,'mês a mês · cenários no zoom','perf-mes');
    const proxMes=ymLab(M.yms[M.iUlt+1]||M.fim);
    s+='<div id="perf-cenarios">'+fig(comboMeta(M.labels,{
      bars:M.gap.map(v=>v==null?null:Math.max(0,v)),
      lines:[{name:'Vendas Previstas',values:M.meta,color:GOOD},
             {name:'Realizado | Meta sazonal',values:M.metaSaz,color:SER[5],dashFrom:M.iUlt},
             {name:'Projeção histórica',values:M.projHist,color:SER[2],dashFrom:M.iUlt,
              cls:'perf-projhist',oculta:true,semLabel:true},
             {name:'Ritmo CAGR'+(M.cagrV!=null?' ('+spct(M.cagrV)+' a.a.)':''),values:M.projCagr,color:'#8c6bb1',
              dashFrom:M.iUlt,cls:'perf-projcagr',oculta:true,semLabel:true}],
      barName:'GAP',w:980,h:430}),
      ins('projecaoDistancia'))+'</div>';
    s+=cap('Valores em R$ mil, todos na mesma escala. As barras cinza são o gap do mês contra a meta. '
      +'A linha âmbar é <b>sólida no realizado</b> e <b>tracejada na projeção</b>: de '+proxMes+' em diante ela mostra a '
      +'<b>meta sazonal</b> — o que falta para o orçamento, distribuído pelo <b>peso histórico de cada mês</b> ('+base.anosSaz0+'–'+(M.ano-1)+') '
      +'e não em partes iguais, porque o segundo semestre concentra e dezembro é pico baixo. '
      +'Ao ampliar o gráfico, dois cenários adicionais podem ser ligados: <b>projeção histórica</b> (para onde a empresa vai, '
      +'mantido o comportamento dos anos anteriores) e <b>ritmo CAGR</b> (onde estaria mantendo o próprio passo de crescimento).');
    s+=call('<b>Como ler os três cenários.</b> Projeção histórica: <b>'+mi(M.totProjHist)+'</b> no ano — é para onde a empresa vai, '
      +'aplicando ao realizado a fração do ano que o histórico já esperava ter acontecido ('+pct(M.frac,1)+' até '+ymLab(M.fim)+'). '
      +'Orçamento: <b>'+mi(M.metaAno)+'</b> — o esforço adicional é a distância entre as duas. '
      +(M.totProjCagr!=null?'Ritmo CAGR: <b>'+mi(M.totProjCagr)+'</b>, mantido o crescimento composto de '+spct(M.cagrV)+' ao ano desde '+base.anosSaz0+'. ':'')
      +'<b>Ressalva:</b> a curva histórica pressupõe um time em ritmo normal — vindo de performance ruim, um segundo semestre '
      +'historicamente forte não se confirma sozinho.','note');
    const linhas=M.yms.map((y,i)=>{
      const r=M.realizado[i], g=M.gap[i], fut=i>M.iUlt;
      return [ymLab(y),money(M.meta[i]),r==null?'—':money(r),
        g==null?'—':`<span style="color:${g>0?BAD:GOOD};font-weight:600">${money(-g)}</span>`,
        r==null?'—':pct(r/M.meta[i],1),
        fut?pct(M.peso[(y%100)-1],1):'—',
        fut?money(M.metaSaz[i]):'—',
        fut&&M.projHist[i]!=null?money(M.projHist[i]):'—'];});
    s+=table(['Mês','Meta','Realizado','Gap (real. − meta)','Atingimento','Peso histórico','Meta sazonal','Projeção histórica'],linhas,
      ['left','right','right','right','right','right','right','right'],
      ['Ano',money(M.metaAno),money(M.realAteAgora),
       `<span style="color:${M.gapAcum>0?BAD:GOOD};font-weight:600">${money(-M.gapAcum)}</span>`,
       pct(atg,1),'—',money(M.aRealizar),M.totProjHist!=null?money(M.totProjHist):'—'],
      ins('metaDispersao'));
    const mesPico=M.idxRest.length?M.idxRest.reduce((a,b)=>M.peso[a]>=M.peso[b]?a:b):null;
    s+=call('Para fechar '+M.ano+' no orçado faltam <b>'+mi(M.aRealizar)+'</b> em '+M.restantes+' meses — média de <b>'
      +mi(mediaRest)+' por mês</b> contra <b>'+mi(mediaReal)+'</b> realizados nos '+(M.iUlt+1)+' primeiros. '
      +(mesPico!=null?'Distribuído pela sazonalidade, o mês mais exigido é <b>'+MES[mesPico]+'</b> ('+money(M.metaSaz[M.yms.findIndex(y=>(y%100)-1===mesPico)])+'), não todos por igual.':''),
      mediaRest>mediaReal?'warn':'ok');
  }
  return s;
};
