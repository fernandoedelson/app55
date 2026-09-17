/* ===== +55 · textos dos destaques =====
   As frases são as do insights.js do Kit, palavra por palavra; os NÚMEROS vêm do servidor
   (app/destaques), que também decide se a regra dispara, com que score e para qual perfil.
   Um texto editado pela Controladoria chega em `o.editado` com marcadores {nome}, preenchidos
   com os mesmos números daqui.
   ====================================================================== */
'use strict';
(function(G){
const {plural,artPl,un}=G.INSRT;
const FMT={mi:v=>mi(v), pecas:v=>nf(Math.round(v))+' peças'};

const TXT={};

/* ---------- G1. concentração de um ranking ---------- */
TXT.concentracao=d=>({
  verdict:`Bastam <b>${d.k50} de ${nf(d.n)} ${esc(d.escopoPl||d.escopo||'itens')}</b> para somar metade ${esc(d.universo||'do total')} — ${mi(d.metade)}.`,
  texto:`Só ${esc(trunc(d.nome1,34))} já responde por ${pct(d.p1,1)} (${mi(d.maior)}). `
    +`Até 80% do valor cabem em ${d.k80} ${plural(d.k80,esc(d.escopo||'item'),esc(d.escopoPl||'itens'))}. `
    +(d.cauda>0?`O resto da lista — ${nf(d.cauda)} ${plural(d.cauda,esc(d.escopo||'item'),esc(d.escopoPl||'itens'))} — `
      +`soma ${mi(d.v_cauda)}, ${pct(d.v_cauda/d.tot,1)} do total.`:''),
  ev:[[(d.escopoPl||'Itens'),nf(d.n)],['Bastam para 50%',nf(d.k50)],
      ['Bastam para 80%',nf(d.k80)],['Maior isolado',pct(d.p1,1)]],
  trigger:`${pct(d.sh,0)} ${artPl(d.escopoPl,'dos','das')} ${esc(d.escopoPl||'itens')} concentram metade do valor (limiar ${pct(d.lim,0)})`,
});

/* ---------- G2. rotatividade entre dois recortes ---------- */
TXT.rotatividade=d=>({
  verdict:`O total ${d.d_tot<0?'caiu':'subiu'} ${mi(Math.abs(d.d_tot))} de ${esc(d.labelA)} para ${esc(d.labelB)}, mas <b>${mi(d.movido)} trocaram de mão</b> por dentro.`,
  texto:`Quem cresceu somou ${mi(d.ganho)}; quem caiu, ${mi(d.perda)}. `
    +`A diferença entre os dois é o que aparece na linha do total — e ela esconde que ${pct(d.movido/d.tot_a,0)} do valor mudou de mãos por dentro. `
    +(d.novos?`Entraram ${nf(d.novos)} ${plural(d.novos,esc(d.escopo||'item'),esc(d.escopoPl||'itens'))} `
      +`sem histórico em ${esc(d.labelA)}, ${plural(d.novos,'com','o maior com')} ${mi(d.maior_novo)}. `:'')
    +(d.saidas?`Outros ${nf(d.saidas)} zeraram, somando ${mi(d.v_saidas)}.`:''),
  ev:[['Cresceram',mi(d.ganho)],['Caíram',mi(d.perda)],
      ['Variação do total',mi(d.d_tot)],['Trocaram de mão',mi(d.movido)]],
  trigger:`movimento interno de ${mi(d.movido)} contra variação líquida de ${mi(d.d_tot)}`,
});

/* ---------- G3. oscilação de uma série mensal ---------- */
TXT.serieOscilacao=d=>{
  const F=FMT[d.fmt]||FMT.mi, VB=d.verbo;
  return {
    verdict:`Entre o melhor e o pior mês há <b>${F(d.max-d.min)} de diferença</b> — ${esc(d.labMin||'')} fez ${F(d.min)} e ${esc(d.labMax||'')}, ${F(d.max)}.`,
    texto:`O melhor mês ${VB} ${pct(d.amp,0)} mais que o pior, dentro do mesmo período. `
      +`${d.abaixo} dos ${d.n} meses ficaram abaixo da média de ${F(d.media)} — ou seja, a média está acima do que a maioria dos meses de fato ${VB}. `
      +(d.queda<0?`A maior queda de um mês para o outro foi de ${F(Math.abs(d.queda))}, em ${esc(d.labQueda||'')}.`:''),
    ev:[['Melhor mês · '+(d.labMax||''),F(d.max)],['Pior mês · '+(d.labMin||''),F(d.min)],
        ['Média do período',F(d.media)],['Meses abaixo da média',d.abaixo+' de '+d.n]],
    trigger:`diferença de ${pct(d.amp,0)} entre o melhor e o pior mês (limiar 40%)`,
  };
};

/* ---------- Vendas · quanto é venda para o próprio grupo ---------- */
TXT.vendasPartesRelacionadas=d=>({
  verdict:`<b>${mi(d.totalPR)} da venda dos últimos 12 meses veio de empresas do próprio grupo</b> — ${pct(d.totalPR/d.total,1)} do total.`,
  texto:`Esse valor não entra espalhado: ${pct(d.conc,0)} dele está em apenas 3 meses, com pico em ${d.labMaiorPR} (${mi(d.maiorPR)}). `
    +(d.mudou?`Tirando o grupo, o pior mês da série deixa de ser ${d.labPiorCom} e passa a ser ${d.labPiorEx}, com ${mi(d.piorEx)}. `:'')
    +`Sem o grupo, a venda dos 12 meses é ${mi(d.semGrupo)}.`,
  ev:[['Venda ao grupo',mi(d.totalPR)],['% do total',pct(d.totalPR/d.total,1)],
      ['Concentrado em 3 meses',pct(d.conc,0)],['Venda sem o grupo',mi(d.semGrupo)]],
  trigger:d.mudou?'tirar a venda ao grupo troca qual foi o pior mês da série':`${pct(d.conc,0)} da venda ao grupo em 3 meses`,
});

/* ---------- Vendas · quanto foi preço, quanto foi quantidade (ano) ---------- */
TXT.vendasEfeitoPrecoVolume=d=>({
  verdict:`Vendemos <b>${mi(Math.abs(d.dTot))} ${d.dTot<0?'a menos':'a mais'} que em ${d.ano-1}</b>, mas cada peça saiu <b>${money(Math.abs(d.P1-d.P0))} ${d.P1>d.P0?'mais cara':'mais barata'}</b>.`,
  texto:`O preço por peça foi de ${money(d.P0)} para ${money(d.P1)} e ${d.efP>0?'trouxe':'tirou'} ${mi(Math.abs(d.efP))}. `
    +`A quantidade foi de ${nf(Math.round(d.Q0))} para ${nf(Math.round(d.Q1))} peças e ${d.efQ>0?'trouxe':'tirou'} ${mi(Math.abs(d.efQ))}. `
    +`No preço de hoje, a diferença equivale a ${un(d.pecasFalta)} — cerca de ${nf(d.porMes)} por mês.`,
  ev:[['Preço por peça',money(d.P0)+' → '+money(d.P1)],['Peças',nf(Math.round(d.Q0))+' → '+nf(Math.round(d.Q1))],
      ['Efeito do preço',mi(d.efP)],['Efeito da quantidade',mi(d.efQ)]],
  trigger:`preço e quantidade em direções opostas, e o menor efeito vale ${nf(d.menor/d.maior,2)}× o maior`,
});

/* ---------- Vendas · pedido assinado × nota emitida ---------- */
TXT.vendaVsFaturamento=d=>({
  verdict:`Em ${d.ano} a empresa vendeu <b>${mi(Math.abs(d.dif))} ${d.dif>0?'a mais do que faturou':'a menos do que faturou'}</b> — ${pct(d.pct,0)} de diferença.`,
  texto:`As duas colunas medem coisas diferentes: a venda é o pedido assinado, o faturamento é a nota emitida. `
    +`Entre um e outro passa a produção, e o pedido de um ano vira nota no seguinte. `
    +`Somando ${d.ini} a ${d.ult}, foram vendidos ${mi(d.acum)} ${d.acum>0?'além':'aquém'} do que já virou nota. `
    +`O contratado em ${d.ultAno} foi ${mi(d.ultVenda)}.`,
  ev:[['Venda contratada '+d.ano,mi(d.venda)],['Faturamento '+d.ano,mi(d.fat)],
      ['Diferença',mi(d.dif)],['Acumulado '+d.ini+'–'+d.ult,mi(d.acum)]],
  trigger:`diferença de ${pct(d.pct,0)} entre pedido e nota em ${d.ano} (limiar 12%)`,
});

/* ---------- Vendas · o mês veio de poucas peças ---------- */
TXT.vendasPrecoVolume=d=>({
  verdict:`${d.lab} vendeu <b>${un(d.qnt)}</b>, ${pct(d.dQ,0)} menos que a média do período, <b>a ${money(d.pm)} cada</b> — ${pct(d.dPm,0)} acima.`,
  texto:`O valor do mês não chama atenção: ${mi(d.val)}, ${pct(Math.abs(d.dV),0)} ${d.dV<0?'abaixo':'acima'} da média. `
    +`Mas ele veio de quase metade das peças, a um preço bem maior. `
    +(d.peds?`Foram ${nf(d.peds)} pedidos no mês, e ${d.metade} deles já somam metade do valor — `
      +`o maior sozinho vale ${pct(d.shMaior,0)} do mês.`:''),
  ev:[['Peças · '+d.lab,nf(Math.round(d.qnt))],['Média do período',nf(d.qMed,1)],
      ['Preço por peça',money(d.pm)],['Média do período',money(d.pmMed)]],
  trigger:`no mesmo mês, preço por peça no topo da série de ${d.n} meses e quantidade no fundo`,
});

/* ---------- Vendas · o mês contra o anterior, por dentro ---------- */
TXT.mesVsAnterior=d=>({
  verdict:`${d.lab} vendeu <b>${mi(Math.abs(d.dTot))} ${d.dTot>0?'a mais':'a menos'} que ${d.labAnt}</b>, `
    +`com <b>${un(Math.abs(d.Q1-d.Q0))} ${d.Q1>d.Q0?'a mais':'a menos'}</b> a um preço ${d.P1>d.P0?'maior':'menor'}.`,
  texto:`A quantidade foi de ${un(d.Q0)} para ${un(d.Q1)} e ${d.efQ>0?'somou':'tirou'} ${mi(Math.abs(d.efQ))}; `
    +`o preço por peça foi de ${money(d.P0)} para ${money(d.P1)} e ${d.efP>0?'somou':'tirou'} ${mi(Math.abs(d.efP))}. `
    +`Um efeito quase cancelou o outro, e a diferença que sobrou foi ${mi(d.dTot)} — `
    +`quem mandou no mês foi ${d.dominante}. `
    +`O preço de ${d.lab} (${money(d.P1)}) está ${d.P1>d.pmMed?'acima':'abaixo'} da média dos meses anteriores (${money(d.pmMed)}).`,
  ev:[['Peças',nf(Math.round(d.Q0))+' → '+nf(Math.round(d.Q1))],['Preço por peça',money(d.P0)+' → '+money(d.P1)],
      ['Efeito da quantidade',mi(d.efQ)],['Efeito do preço',mi(d.efP)]],
  trigger:`preço e quantidade em direções opostas entre ${d.labAnt} e ${d.lab}, com o menor efeito valendo ${nf(d.razao,2)}× o maior`,
});

/* ---------- matriz cruzada: por onde os dois maiores chegaram ao topo ---------- */
TXT.mixCruzado=d=>({
  verdict:d.mesma
    ? `Os dois maiores fazem ${pct(d.juntos,0)} da venda e <b>ambos se apoiam em ${esc(d.forte1)}</b> — `
      +`${pct(d.sh1,0)} e ${pct(d.shForte2Mesma,0)}, contra ${pct(d.casa1,0)} da casa.`
    : `<b>${esc(trunc(d.nome1,26))} chega ao topo por ${esc(d.forte1)}; ${esc(trunc(d.nome2,26))}, por ${esc(d.forte2)}</b> — `
      +`os dois maiores não vendem a mesma coisa.`,
  texto:`${esc(trunc(d.nome1,26))} lidera com ${mi(d.tl1)}, e ${pct(d.sh1,0)} disso é ${esc(d.forte1)} `
    +`— a casa vende ${pct(d.casa1,0)}. `
    +(d.mesma
      ? `${esc(trunc(d.nome2,26))} repete a receita: ${pct(d.shForte2Mesma,0)} em ${esc(d.forte1)}. `
        +`A categoria que sustenta o topo é a mesma, e o que separa os dois é volume, não mix.`
      : `${esc(trunc(d.nome2,26))} vem logo atrás com ${mi(d.tl2)}, mas apoiado em ${esc(d.forte2)}: `
        +`${pct(d.sh2,0)} contra ${pct(d.casa2,0)} da casa. `
        +`São dois caminhos diferentes para chegar ao mesmo lugar, e isso não aparece olhando o mapa.`)
    +(d.fraco1?` A categoria em que ${esc(trunc(d.nome1,20))} vende menos que a casa é ${esc(d.fraco1)}: `
      +`${pct(d.shFraco1,0)} contra ${pct(d.casaFraco1,0)}.`:''),
  ev:[['Líder',esc(trunc(d.nome1,20))],['Apoia-se em',esc(d.forte1)+' · '+pct(d.sh1,0)],
      ['2º lugar',esc(trunc(d.nome2,20))],['Apoia-se em',esc(d.forte2)+' · '+pct(d.sh2,0)]],
  trigger:`perfil dos dois maiores (${pct(d.juntos,0)} do valor), não do mais destoante`,
});

/* ---------- carteira: valor parado × tempo para escoar ---------- */
TXT.carteiraMesesCobertura=d=>({
  verdict:d.piorou
    ? `A carteira mal se mexeu em dinheiro (<b>${spct(d.dC,0)}</b>), mas o tempo para escoá-la `
      +`<b>saltou de ${nf(d.m0,1)} para ${nf(d.m1,1)} meses</b> — porque o faturamento caiu ${pct(-d.dF,0)}.`
    : `A carteira ${d.dC>=0?'subiu':'caiu'} <b>${spct(d.dC,0)}</b> em dinheiro e mesmo assim passou a cobrir `
      +`<b>${nf(d.m1,1)} meses</b>, contra ${nf(d.m0,1)} — porque o faturamento ${d.dF>=0?'subiu':'caiu'} ${pct(Math.abs(d.dF),0)}.`,
  texto:`"Meses de carteira" é o saldo dividido pelo que se fatura por mês. São dois números na conta, e neste `
    +`período quem se mexeu foi o de baixo. `
    +`O saldo saiu de ${mi(d.c0)} em ${esc(d.lab0)} para ${mi(d.c1)} em ${esc(d.lab1)} — praticamente o mesmo tamanho. `
    +`O faturamento médio saiu de ${mi(d.f0)} para ${mi(d.f1)} por mês. `
    +(d.piorou
      ? `Por isso o mesmo bolo de pedidos passou a durar mais: não é que entrou mais pedido, é que está saindo `
        +`menos nota. Uma carteira estável com cobertura subindo é fila parada, não demanda nova.`
      : `Por isso o mesmo bolo de pedidos passou a durar menos: a fábrica está escoando mais rápido do que `
        +`a carteira se renova.`),
  ev:[['Carteira em '+d.lab0,mi(d.c0)],['Carteira em '+d.lab1,mi(d.c1)],
      ['Faturava por mês',mi(d.f0)],['Fatura por mês',mi(d.f1)]],
  trigger:`valor ${spct(d.dC,0)} e cobertura ${spct(d.dM,0)} — ritmos distantes (limiar 15 p.p.)`,
});

TXT.carteiraTicketPorEspera=d=>({
  verdict:`O pedido que espera em <b>${esc(d.caro)}</b> vale ${money(d.tkCaro)}; o de `
    +`<b>${esc(d.barato)}</b>, ${money(d.tkBarato)} — <b>${nf(d.razao,1)}× de diferença</b>.`,
  texto:`As barras mostram quanto dinheiro está parado em cada faixa; o que elas não mostram é o tamanho de `
    +`cada pedido dentro dela. `
    +`Em ${esc(d.caro)} são ${nf(d.nCaro)} ${plural(d.nCaro,'pedido','pedidos')} somando ${mi(d.vCaro)}; `
    +`em ${esc(d.barato)}, ${nf(d.nBarato)} somando ${mi(d.vBarato)}. `
    +`A média da carteira é ${money(d.media)} por pedido. `
    +`Faixa com pedido grande e faixa com pedido pequeno pesam igual no gráfico e são problemas de natureza diferente.`,
  ev:[[trunc(d.caro,16),money(d.tkCaro)+'/pedido'],[trunc(d.barato,16),money(d.tkBarato)+'/pedido'],
      ['Média da carteira',money(d.media)],['Pedidos em aberto',nf(d.nTot)]],
  trigger:`valor por pedido varia ${nf(d.razao,1)}× entre as faixas de espera (limiar 1,5×)`,
});

TXT.carteiraAtrasoConcentrado=d=>({
  verdict:`<b>${pct(d.sh,0)} do atraso é de um cliente só</b> — ${esc(trunc(d.cliente,34))}, ${mi(d.valor)} de ${mi(d.tot)}.`,
  texto:`São ${nf(d.nCli)} clientes no bucket, mas o valor está quase todo em um. `
    +`Sem ele, o atraso da carteira cai para ${mi(d.sem)}.`,
  ev:[['Atraso total',mi(d.tot)],['Maior cliente',mi(d.valor)],
      ['% do atraso',pct(d.sh,0)],['Sem ele',mi(d.sem)]],
  trigger:`maior cliente com ${pct(d.sh,0)} do bucket de atraso (limiar 35%)`,
});

TXT.carteiraPicoEntrega=d=>({
  verdict:`A carteira promete <b>${mi(d.pico)} de entrega em ${d.lab}</b> — ${nf(d.razao,1)}× o que a fábrica costuma faturar num mês.`,
  texto:`${pct(d.pico/d.total,0)} de tudo que está em produção está marcado para esse único mês. `
    +`Nos últimos ${d.nFat} meses a média faturada foi ${mi(d.medFat)}, com máximo de ${mi(d.maxFat)}. `
    +`As datas são preenchidas pedido a pedido, sem ninguém somar o total do mês.`,
  ev:[['Prometido em '+d.lab,mi(d.pico)],['Média faturada',mi(d.medFat)],
      ['Melhor mês já faturado',mi(d.maxFat)],['Acima da média',mi(d.acima)]],
  trigger:`mês de pico em ${nf(d.razao,1)}× o faturamento mensal médio (limiar 1,2×)`,
});

TXT.carteiraAdiadoTicket=d=>({
  verdict:`Os itens adiados pelo cliente custam <b>${money(d.tAd)} cada, ${pct(Math.abs(d.d),0)} ${d.d<0?'menos':'mais'} que a média da carteira</b> (${money(d.tGeral)}).`,
  texto:`São ${mi(d.valAd)} parados em ${nf(d.itAd)} itens, ${pct(d.shValor,0)} do valor da carteira. `
    +(d.d<0
      ? `O que fica para depois é o item pequeno — o complemento, o acessório. O projeto principal seguiu. `
      : `O que fica para depois é justamente a peça cara. Não é o acessório que trava, é o projeto grande. `)
    +(d.meses?`O valor parado equivale a ${nf(d.meses,1)} ${plural(Math.round(d.meses),'mês','meses')} de faturamento.`:''),
  ev:[['Valor adiado',mi(d.valAd)],['Itens',nf(d.itAd)],
      ['Preço por item',money(d.tAd)],['Média da carteira',money(d.tGeral)]],
  trigger:`preço por item do bucket ${pct(Math.abs(d.d),0)} ${d.d<0?'abaixo':'acima'} do da carteira (limiar 18%)`,
});

/* ---------- performance comercial: meta × realizado ---------- */
TXT.metaRitmo=d=>({
  verdict:`Faltam <b>${mi(d.falta)} em ${d.restantes} ${plural(d.restantes,'mês','meses')}</b>: ${mi(d.necessario)} por mês, contra ${mi(d.media)} de média no ano.`,
  texto:`Esse patamar de ${mi(d.necessario)} aconteceu ${d.quantos} ${plural(d.quantos,'vez','vezes')} nos últimos ${d.n} meses. `
    +`O melhor mês da série foi ${d.labMax}, com ${mi(d.maxReal)}.`
    +(d.nunca?` Ou seja: nunca foi atingido.`:'')
    +` Mantida a média do ano, ${d.ano} fecha em ${mi(d.projetado)} — ${mi(d.abaixo)} abaixo do orçado.`,
  ev:[['Falta vender',mi(d.falta)],['Por mês',mi(d.necessario)],
      ['Média do ano',mi(d.media)],['Fecha em',mi(d.projetado)]],
  trigger:d.nunca?'ritmo necessário acima do melhor mês da série':`ritmo necessário atingido em ${d.quantos} de ${d.n} meses`,
});

TXT.metaDispersao=d=>({
  verdict:`A distância para a meta varia muito: <b>${pct(1-d.atBom,0)} em ${d.labBom} e ${pct(1-d.atRuim,0)} em ${d.labRuim}</b>.`,
  texto:`Não é uma diferença fixa mês a mês. ${d.labBom} chegou perto: vendeu ${mi(d.realBom)} `
    +`contra ${mi(d.metaBom)} de meta. ${d.labRuim} ficou ${mi(d.atrasoRuim)} atrás. `
    +`Se os ${d.n} meses tivessem repetido ${d.labBom}, o buraco do período seria ${mi(d.gapSeBom)} em vez de ${mi(d.gap)}.`,
  ev:[['Melhor mês · '+d.labBom,pct(d.atBom,0)+' da meta'],['Pior mês · '+d.labRuim,pct(d.atRuim,0)+' da meta'],
      ['Buraco no período',mi(d.gap)],['Se todos fossem como o melhor',mi(d.gapSeBom)]],
  trigger:`${nf(d.amp*100,0)} pontos entre o melhor e o pior mês de atingimento (limiar 15)`,
});

TXT.projecaoDistancia=d=>({
  verdict:d.abaixo
    ? `Mantido o comportamento dos anos anteriores, o ano fecha em <b>${mi(d.projHist)}</b> — `
      +`<b>${mi(d.falta)} abaixo</b> do orçamento de ${mi(d.metaAno)}.`
    : `Mantido o comportamento dos anos anteriores, o ano fecha em <b>${mi(d.projHist)}</b> — `
      +`<b>${mi(-d.falta)} acima</b> do orçamento de ${mi(d.metaAno)}.`,
  texto:`A projeção não soma o que falta para bater a meta: ela pega o que já foi vendido e pergunta que fração do ano `
    +`isso costuma ser. Até agora, os meses decorridos valem ${pct(d.frac,0)} de um ano típico. `
    +(d.abaixo
      ? `A diferença de ${mi(d.falta)} é o que precisa aparecer além do ritmo natural — ${mi(d.porMes)} por mês nos ${d.restantes} que restam. `
      : `A diferença de ${mi(-d.falta)} é a folga que o ritmo natural já daria sobre o orçamento. `)
    +(d.cagr!=null
      ? `Mantendo o próprio ritmo de crescimento dos últimos anos, o ano fecharia em ${mi(d.cagr)} — `
        +(d.cagr>d.metaAno?`acima do orçamento.`:`também abaixo do orçamento.`)
      : ''),
  ev:[['Para onde vai',mi(d.projHist)],['Orçado',mi(d.metaAno)],
      ['Diferença',mi(Math.abs(d.falta))],['Ritmo de crescimento',d.cagr!=null?mi(d.cagr):'—']],
  trigger:`projeção histórica ${pct(Math.abs(d.sh),0)} distante do orçamento (limiar 3%)`,
});

/* ---------- Análise de Vendas: a líder e a carteira por RFV ---------- */
const FMT_FATOR={mi:v=>mi(v),nf0:v=>nf(v,0),nf1:v=>nf(v,1),nf2:v=>nf(v,2),money:v=>money(v),pct1:v=>pct(v,1)};

TXT.lider=d=>({
  verdict:`${esc(trunc(d.nome,26))} vende <b>${nf(d.razao,1)}× a média do time</b>, e a vantagem `
    +`não está espalhada: está em <b>${esc(d.forte)}</b> (${nf(d.rForte,1)}×).`,
  texto:`A venda de qualquer vendedor vem de três coisas multiplicadas: quantos clientes atende, `
    +`quantas vezes cada um compra e quanto vale cada pedido. `
    +`Se a vantagem fosse igual nos três, cada um seria ${nf(d.esperado,2)}× a média. `
    +`Não é o caso: ${esc(d.forte)} está em ${nf(d.rForte,1)}× e ${esc(d.fraco)}, em ${nf(d.rFraco,2)}×. `
    +`É um fator só puxando o resultado — e é nele que está o que ela faz de diferente.`,
  ev:[['Venda vs média do time',nf(d.razao,1)+'×'],['Maior vantagem',esc(d.forte)+' · '+nf(d.rForte,1)+'×'],
      ['Menor vantagem',esc(d.fraco)+' · '+nf(d.rFraco,2)+'×'],['Se fosse parelho',nf(d.esperado,2)+'× em cada']],
  trigger:`líder a ${nf(d.razao,1)}× a média, com os três fatores muito diferentes entre si (limiar 1,3×)`,
});

TXT.fatoresLider=d=>{
  const f=x=>(FMT_FATOR[x.fmt]||FMT_FATOR.mi);
  return {
    verdict:d.abaixo
      ? `A líder está <b>${spct(d.rMaior,0)} em ${esc(d.maior.toLowerCase())}</b>, mas `
        +`<b>${spct(d.abaixo.r,0)} em ${esc(d.abaixo.nome.toLowerCase())}</b>.`
      : `A líder está acima da média nos três fatores, com <b>${spct(d.rMaior,0)} em ${esc(d.maior.toLowerCase())}</b>.`,
    texto:d.fatores.map(x=>`${esc(x.nome)}: ${f(x)(x.l)} contra ${f(x)(x.d)} da média (${spct(x.r,0)})`).join('. ')+'. '
      +(d.abaixo
        ? `Ou seja: ela não faz tudo melhor que os outros. Onde está atrás, há espaço para melhorar o `
          +`resultado dela também — e onde está muito à frente é o que vale entender e tentar repetir com o time.`
        : `A vantagem aparece nos três, o que costuma indicar carteira diferente, não técnica diferente.`),
    ev:d.fatores.map(x=>[x.nome,f(x)(x.l)+' × '+f(x)(x.d)]),
    trigger:`maior fator a ${spct(d.rMaior,0)} da média do time`,
  };
};

TXT.potencialTicket=d=>({
  verdict:`Só o tamanho do pedido explica <b>${mi(d.ganho)}</b> de distância — ${pct(d.sh,0)} da venda `
    +`atual dos demais, com a mesma quantidade de pedidos.`,
  texto:`A conta mantém o número de pedidos de cada um e troca só o valor médio do pedido pelo de `
    +`${esc(trunc(d.nome,24))} (${money(d.ticket)}). `
    +`${pct(d.shTop2,0)} de toda essa diferença está em duas pessoas: `
    +`${d.top2.map(x=>esc(trunc(x.name,20))+' ('+mi(x.v)+')').join(' e ')}. `
    +`Não é um problema do time inteiro — está em quem vende pedidos bem menores que a média da casa.`,
  ev:[['Distância total',mi(d.ganho)],['% da venda dos demais',pct(d.sh,0)],
      ['Valor médio do pedido dela',money(d.ticket)],['Concentrado em 2 pessoas',pct(d.shTop2,0)]],
  trigger:`diferença de ticket vale ${pct(d.sh,0)} da venda dos demais`,
});

TXT.rfvSegmentos=d=>({
  verdict:`<b>${nf(d.nF)} clientes que voltam</b> (${pct(d.nF/d.N,0)} da carteira) valem ${mi(d.vF)}; `
    +`<b>${nf(d.nR)} que pararam</b> valem ${mi(d.vR)}.`,
  texto:`Campeões e fiéis são ${pct(d.nF/d.N,0)} dos clientes e ${pct(d.vF/d.tot,0)} do valor — `
    +`compram ${nf(d.fMedia,2)} vezes cada, em média. `
    +`Do outro lado, quem está em risco ou hibernando soma ${pct(d.vR/d.tot,0)} do valor já realizado `
    +`e está há ${nf(d.rMedia,1)} meses sem comprar. `
    +`É valor que a casa já provou saber vender, parado.`,
  ev:[['Campeões + fiéis',nf(d.nF)+' · '+mi(d.vF)],['% do valor',pct(d.vF/d.tot,0)],
      ['Em risco + hibernando',nf(d.nR)+' · '+mi(d.vR)],['% do valor',pct(d.vR/d.tot,0)]],
  trigger:`segmentação RFV sobre ${nf(d.N)} clientes da janela`,
});

const RFV_DEF={
  'Campeões':'compraram há pouco, várias vezes e entre os que mais gastam',
  'Fiéis':'voltam com regularidade e continuam comprando',
  'Em risco':'estão entre os de maior valor, mas pararam de comprar',
  'Novos / únicos':'chegaram há pouco e ainda só fizeram um ou dois pedidos',
  'Ocasionais':'compram de vez em quando, sem padrão de retorno',
  'Hibernando':'já foram frequentes e hoje estão parados',
  'Perdidos':'sem compra há muito tempo e com valor baixo',
};

TXT.rfvTabela=d=>({
  verdict:`<b>${pct(d.shUma,0)} dos clientes compraram uma vez só</b> — e valem ${pct(d.vUma,0)} do total.`,
  texto:`Quem volta é minoria: ${nf(d.nRepete)} clientes de ${nf(d.n)}. `
    +`Mas cada um deles vale ${money(d.vMedioRep)} contra ${money(d.vMedioUma)} de quem comprou uma vez — `
    +`${nf(d.vMedioRep/Math.max(d.vMedioUma,1),1)}× mais. `
    +`A diferença entre os dois grupos não é o tamanho do primeiro pedido: é o que vem depois dele.`
    +(d.segs&&d.segs.length?`</p><div class="hl-defs"><b>O que é cada segmento</b>`
      +d.segs.map(x=>{
        const faixa=(x.rMax==null||x.rMin==null)?''
          :(x.rMin===x.rMax?`${nf(x.rMin)} ${plural(x.rMin,'mês','meses')} sem comprar`
            :`${nf(x.rMin)} a ${nf(x.rMax)} meses sem comprar, ${nf(x.r,1)} em média`);
        return `<span><i>${esc(x.seg)}</i> — ${esc(RFV_DEF[x.seg]||'')} `
          +`<em>${nf(x.n)} ${plural(x.n,'cliente','clientes')} · ${mi(x.v)}`
          +(faixa?` · ${faixa}`:'')+`</em></span>`;
      }).join('')
      +`</div><p>`:''),
  ev:[['Compraram uma vez',nf(d.nUma)+' · '+pct(d.shUma,0)],['Valem',pct(d.vUma,0)+' do total'],
      ['Valor médio · uma compra',money(d.vMedioUma)],['Valor médio · recompra',money(d.vMedioRep)]],
  trigger:`${pct(d.shUma,0)} da carteira com uma única compra no período`,
});

TXT.rfvRisco=d=>({
  verdict:`Os ${nf(d.n)} maiores clientes parados somam <b>${mi(d.v)}</b> de compra já realizada, `
    +`com ${nf(d.mesesMed,1)} meses em média sem pedido.`,
  texto:`São clientes que já compraram antes — não é procurar cliente novo, é reaproximar quem já foi cliente. `
    +(d.dono?`${esc(trunc(d.dono,24))} responde por ${pct(d.shDono,0)} desse valor `
      +`(${mi(d.vDono)}), o que torna a conversa de retomada concentrada em poucas mãos. `:'')
    +`O maior deles sozinho vale ${mi(d.maior)}.`,
  ev:[['Valor parado',mi(d.v)],['Clientes',nf(d.n)],
      ['Meses sem comprar',nf(d.mesesMed,1)],['Maior isolado',mi(d.maior)]],
  trigger:`clientes de alto valor com recência no quintil mais baixo`,
});

TXT.rfvPorVendedor=d=>({
  verdict:`Carteiras muito diferentes por baixo: <b>${pct(d.shMelhor,0)} da venda de `
    +`${esc(trunc(d.melhor,20))} vem de clientes que voltam, contra ${pct(d.shPior,0)} de ${esc(trunc(d.pior,20))}</b>.`,
  texto:`${esc(trunc(d.melhor,20))} atende ${nf(d.nMelhor)} clientes com ${nf(d.recMelhor,2)} pedidos cada; `
    +`${esc(trunc(d.pior,20))}, ${nf(d.nPior)} clientes com ${nf(d.recPior,2)}. `
    +`Quem lidera em venda é ${esc(trunc(d.maiorVenda,20))}, com ${pct(d.shMaiorVenda,0)} vindo de clientes fiéis. `
    +`Duas pessoas com venda parecida podem ter uma carteira que se sustenta e outra que precisa ser refeita todo mês.`,
  ev:[[esc(trunc(d.melhor,18)),pct(d.shMelhor,0)+' de fiéis'],[esc(trunc(d.pior,18)),pct(d.shPior,0)+' de fiéis'],
      ['Pedidos/cliente · melhor',nf(d.recMelhor,2)],['Pedidos/cliente · pior',nf(d.recPior,2)]],
  trigger:`${nf(d.amp*100,0)} pontos entre a melhor e a pior carteira (limiar 20)`,
});

/* ---------- Vendedor × Arquiteto ---------- */
TXT.arqCanal=d=>({
  verdict:d.uniforme
    ? `<b>${pct(d.geral,0)} de toda a venda entra por um arquiteto</b>, e isso vale para o time inteiro — `
      +`de ${pct(d.shBaixo,0)} a ${pct(d.shAlto,0)} entre os maiores vendedores.`
    : `<b>${esc(trunc(d.alto,24))} faz ${pct(d.shAlto,0)} da venda por arquiteto; `
      +`${esc(trunc(d.baixo,24))}, ${pct(d.shBaixo,0)}</b> — não são o mesmo trabalho.`,
  texto:(d.uniforme
    ? `Não é um vendedor ou outro: praticamente toda venda da casa nasce da indicação de um arquiteto. `
      +`O que se vende direto ao cliente é o que sobra. `
      +`Isso muda a pergunta: o resultado do vendedor depende menos de quem atende no showroom e mais `
      +`de quais arquitetos indicam a marca — e avaliar o time sem olhar isso mede a coisa errada. `
    : `Entre os maiores vendedores, a dependência do canal vai de ${pct(d.shBaixo,0)} a ${pct(d.shAlto,0)}. `)
    +(d.razao?`E o canal não muda só o volume: o pedido que vem por arquiteto vale ${money(d.tA)} `
      +`contra ${money(d.tS)} do que vem direto — ${nf(d.razao,1)}× ${d.razao>1?'maior':'menor'}. `:'')
    +(d.uniforme?'':`Comparar a venda de quem vive de especificação com a de quem vende no balcão é comparar `
      +`dois processos diferentes com o mesmo número.`),
  ev:[[trunc(d.alto,18),pct(d.shAlto,0)+' via arquiteto'],[trunc(d.baixo,18),pct(d.shBaixo,0)],
      ['Pedido médio com arquiteto',money(d.tA)],['Pedido médio direto',money(d.tS)]],
  trigger:d.uniforme
    ? `${pct(d.geral,0)} da venda vem de arquiteto, e a diferença entre os vendedores é de só ${nf(d.dispersao*100,0)} pontos`
    : `${nf(d.dispersao*100,0)} pontos de diferença entre quem mais e quem menos vende por arquiteto (limiar 20)`,
});

TXT.arqDependencia=d=>({
  verdict:`A agenda de <b>${esc(trunc(d.nome,26))} depende de ${d.k50} `
    +`${plural(d.k50,'arquiteto','arquitetos')}</b> de ${nf(d.nArq)} — `
    +`bastam ${plural(d.k50,'ele','eles')} para somar metade da venda pelo canal.`,
  texto:`O maior sozinho responde por ${pct(d.shTop,0)} (${esc(trunc(d.topArq||'—',26))}). `
    +(d.nExcl?`Além disso, ${nf(d.nExcl)} ${plural(d.nExcl,'arquiteto trabalha','arquitetos trabalham')} `
      +`exclusivamente com ${esc(trunc(d.nome,22))}, somando ${mi(d.vExcl)} — `
      +`relação pessoal, que sai junto com quem a construiu. `:'')
    +`Ter muitos arquitetos cadastrados não é o mesmo que ter a venda distribuída entre eles.`,
  ev:[['Arquitetos ativos',nf(d.nArq)],['Bastam para 50%',nf(d.k50)],
      ['Maior deles',pct(d.shTop,0)],['Exclusivos dele',nf(d.nExcl)+' · '+mi(d.vExcl)]],
  trigger:`${pct(d.conc,0)} dos arquitetos concentram metade da venda do canal (limiar 25%)`,
});

TXT.arqExclusividade=d=>({
  verdict:`Entre os arquitetos que fazem 80% do canal, <b>${nf(d.nExcl)} trabalham com um único vendedor</b> — `
    +`${pct(d.sh,0)} da venda desse grupo.`,
  texto:`São ${mi(d.vExcl)} presos a uma relação pessoal: se o vendedor sai, o arquiteto não fica com a casa. `
    +(d.nCompart
      ? (d.nCompart===1
          ? `Só um circula entre vendedores, movimentando ${mi(d.vCompart)}`
          : `Os ${nf(d.nCompart)} que circulam entre vendedores movimentam ${mi(d.vCompart)}`)
        +(d.tkE&&d.tkC?`, com pedido médio de ${money(d.tkC)} contra ${money(d.tkE)} dos exclusivos`:'')+`. `
      :'')
    +`A diferença entre um cadastro de arquitetos e uma carteira de arquitetos está exatamente nisso.`,
  ev:[['Exclusivos',nf(d.nExcl)+' · '+mi(d.vExcl)],['% do canal',pct(d.sh,0)],
      ['Circulam entre vendedores',nf(d.nCompart)],['Pedido médio: exclusivo × compartilhado',
        (d.tkE?money(d.tkE):'—')+' × '+(d.tkC?money(d.tkC):'—')]],
  trigger:`${pct(d.sh,0)} do canal em arquitetos com 90%+ da venda num único vendedor (limiar 30%)`,
});

TXT.arqMatriz=d=>({
  verdict:`De todas as combinações possíveis entre vendedor e arquiteto, <b>só ${pct(d.dens,0)} existem</b> — `
    +(d.todosPresos
      ? `<b>todos os ${nf(d.nCol)} maiores arquitetos</b> trabalham com um único vendedor.`
      : `${nf(d.nPresos)} dos ${nf(d.nCol)} maiores arquitetos trabalham com um único vendedor.`),
  texto:`O mapa tem muito espaço vazio, e não é acaso: cada arquiteto trabalha com um vendedor só. `
    +(d.qCircula>1
      ? `${esc(trunc(d.circula,26))} é a exceção — circula por ${nf(d.qCircula)} vendedores, somando ${mi(d.vCircula)}. `
      : `Nenhum dos maiores é exceção: não há um único arquiteto atendido por mais de um vendedor no período. `)
    +`Quando a coluna tem uma célula só, o relacionamento é da pessoa, não da empresa.`,
  ev:[['Pares que existem',pct(d.dens,0)],['Arquitetos presos a um',nf(d.nPresos)],
      ['Mais circula',esc(trunc(d.circula,20))],['Com quantos vendedores',nf(d.qCircula)]],
  trigger:`densidade de ${pct(d.dens,0)} na matriz vendedor × arquiteto (limiar 50%)`,
});

TXT.arqParados=d=>({
  verdict:`<b>${nf(d.n)} arquitetos que trouxeram ${mi(d.v)}</b> não mandam pedido há ${nf(d.mesesMed,1)} meses em média.`,
  texto:`É ${pct(d.sh,0)} de tudo que veio por arquiteto no período, hoje parado. `
    +`Do outro lado, ${nf(d.ativos)} arquitetos seguem trazendo pedido. `
    +(d.dono?`A maior parte desse valor parado estava com ${esc(trunc(d.dono,24))} `
      +`(${mi(d.vDono)}, ${pct(d.shDono,0)} do total). `:'')
    +`Arquiteto não cancela cadastro: ele apenas para de especificar, e isso não aparece em lugar nenhum `
    +`até alguém contar os meses.`,
  ev:[['Arquitetos parados',nf(d.n)],['Valor que traziam',mi(d.v)],
      ['% do canal',pct(d.sh,0)],['Meses sem trazer',nf(d.mesesMed,1)]],
  trigger:`arquitetos sem pedido há 6 meses ou mais, somando ${pct(d.sh,0)} do canal`,
});

const RFV_DEF_ARQ={
  'Campeões':'trouxeram pedido há pouco, várias vezes e entre os que mais somam',
  'Fiéis':'especificam com regularidade e seguem trazendo',
  'Em risco':'estão entre os que mais trouxeram, mas pararam',
  'Novos / únicos':'chegaram há pouco e trouxeram um ou dois pedidos',
  'Ocasionais':'aparecem de vez em quando, sem regularidade',
  'Hibernando':'já foram frequentes e hoje não trazem nada',
  'Perdidos':'sem pedido há muito tempo e com valor baixo',
};

TXT.rfvArqSegmentos=d=>({
  verdict:`<b>${nf(d.nB)} arquitetos ainda trazem pedido</b> (${pct(d.nB/d.N,0)} do cadastro) e valem ${mi(d.vB)}; `
    +`<b>${nf(d.nM)} já pararam</b>, com ${mi(d.vM)} de histórico.`,
  texto:`O canal tem duas metades muito diferentes. Quem segue ativo traz `
    +`${nf(d.fB,1)} pedidos por arquiteto; quem parou está há `
    +`${nf(d.rM,1)} meses sem especificar nada. `
    +`A diferença entre um cadastro de arquitetos e uma carteira viva é essa — e ela não aparece `
    +`em nenhum ranking por faturamento, porque o histórico de quem sumiu continua somando lá.`,
  ev:[['Ativos (campeões + fiéis)',nf(d.nB)+' · '+mi(d.vB)],['% do valor',pct(d.vB/d.tot,0)],
      ['Parados',nf(d.nM)+' · '+mi(d.vM)],['Meses sem trazer',nf(d.rM,1)]],
  trigger:`segmentação RFV sobre ${nf(d.N)} arquitetos da janela`,
});

TXT.rfvArqTabela=d=>({
  verdict:`<b>${pct(d.shUma,0)} dos arquitetos trouxeram um pedido só</b> — e respondem por ${pct(d.vUma,0)} do canal.`,
  texto:`Especificar uma vez é fácil; virar recorrente é outra coisa. `
    +`Os ${nf(d.nRepete)} que voltaram valem ${money(d.mRep)} cada, contra ${money(d.mUma)} de quem veio uma vez — `
    +`${nf(d.mRep/Math.max(d.mUma,1),1)}× mais. `
    +`O tamanho do cadastro não diz nada sobre o tamanho do canal.`
    +(d.segs&&d.segs.length?`</p><div class="hl-defs"><b>O que é cada segmento</b>`
      +d.segs.map(x=>{
        const faixa=x.rMin===x.rMax
          ?`${nf(x.rMin)} ${plural(x.rMin,'mês','meses')} sem trazer`
          :`${nf(x.rMin)} a ${nf(x.rMax)} meses sem trazer, ${nf(x.r,1)} em média`;
        return `<span><i>${esc(x.seg)}</i> — ${esc(RFV_DEF_ARQ[x.seg]||'')} `
          +`<em>${nf(x.n)} ${plural(x.n,'arquiteto','arquitetos')} · ${mi(x.v)} · ${faixa}</em></span>`;
      }).join('')+`</div><p>`:''),
  ev:[['Trouxeram uma vez',nf(d.nUma)+' · '+pct(d.shUma,0)],['Valem',pct(d.vUma,0)+' do canal'],
      ['Valor médio · uma vez',money(d.mUma)],['Valor médio · recorrente',money(d.mRep)]],
  trigger:`${pct(d.shUma,0)} do cadastro com um único pedido no período`,
});

TXT.rfvArqPorVendedor=d=>({
  verdict:`<b>${pct(d.shBom,0)} da venda de ${esc(trunc(d.bom,22))} vem de arquitetos que continuam trazendo; `
    +`em ${esc(trunc(d.ruim,22))}, ${pct(d.shRuim,0)}</b>.`,
  texto:`${esc(trunc(d.ruim,22))} tem ${nf(d.nRuim)} arquitetos, mas ${pct(d.shRuins,0)} da venda dela veio de quem já parou de trazer pedido — `
    +`o histórico está lá, o movimento não. `
    +`${esc(trunc(d.bom,22))} trabalha com ${nf(d.nBom)}`
    +(Math.abs(d.pedBom-d.pedRuim)>=.05
      ? ` e recebe ${nf(d.pedBom,2)} pedidos de cada um, contra ${nf(d.pedRuim,2)}`
      : ` e a diferença não está em quantos pedidos cada arquiteto traz — é em quantos deles ainda trazem`)
    +`. Duas carteiras de tamanho parecido: uma continua rendendo, a outra em boa parte parou.`,
  ev:[[trunc(d.bom,18),pct(d.shBom,0)+' em ativos'],[trunc(d.ruim,18),pct(d.shRuim,0)],
      ['Pedidos por arquiteto',nf(d.pedBom,2)+' × '+nf(d.pedRuim,2)],
      ['Valor parado em '+trunc(d.ruim,14),mi(d.vRuins)]],
  trigger:`${nf(d.amp*100,0)} pontos entre a melhor e a pior carteira de canal (limiar 20)`,
});

TXT.rfvArqQualidade=d=>({
  verdict:`Cada arquiteto rende <b>${nf(d.pedAlto,2)} pedidos com ${esc(trunc(d.alto,22))} e `
    +`${nf(d.pedBaixo,2)} com ${esc(trunc(d.baixo,22))}</b> — ${nf(d.razao,1)}× de diferença.`,
  texto:`Não é sobre ter mais arquitetos: ${esc(trunc(d.baixo,22))} tem ${nf(d.nBaixo)} e `
    +`${esc(trunc(d.alto,22))}, ${nf(d.nAlto)}. `
    +`A diferença está em quantas vezes cada relação se repete. `
    +`No aproveitamento de ${esc(trunc(d.alto,20))}, a carteira de ${esc(trunc(d.baixo,20))} `
    +`teria rendido ${nf(d.pedFalta,0)} pedidos a mais no período.`,
  ev:[[trunc(d.alto,18),nf(d.pedAlto,2)+' pedidos/arq.'],[trunc(d.baixo,18),nf(d.pedBaixo,2)],
      ['Arquitetos',nf(d.nAlto)+' × '+nf(d.nBaixo)],['Pedidos de diferença',nf(d.pedFalta,0)]],
  trigger:`aproveitamento por arquiteto variando ${nf(d.razao,1)}× entre os maiores vendedores (limiar 1,4×)`,
});

/* ---------- motor automático: uma função por leitura ---------- */
const AUTO={};

AUTO.divergencia=d=>({
  verdict:`Quem mais vende em dinheiro não é quem mais vende em ${d.rotulo}: `
    +`<b>${esc(trunc(d.nomeV,30))} lidera em valor, ${esc(trunc(d.nomeQ,30))} em ${d.rotulo}</b>.`,
  texto:`${esc(trunc(d.nomeV,30))} fez ${mi(d.vV)} em ${nf(d.qV)} ${d.rotulo} — ${money(d.tkV)} cada. `
    +`${esc(trunc(d.nomeQ,30))} fez ${nf(d.qQ)} ${d.rotulo} para ${mi(d.vQ)}, ${money(d.tkQ)} cada. `
    +`Cada negócio de ${esc(trunc(d.nomeV,24))} vale ${nf(d.razao,1)}× o de ${esc(trunc(d.nomeQ,24))}. `
    +`Quem traz mais dinheiro e quem fecha mais negócios são pessoas diferentes.`,
  ev:[['Líder em valor',esc(trunc(d.nomeV,22))],['Valor por '+d.rotulo.replace(/s$/,''),money(d.tkV)],
      ['Líder em '+d.rotulo,esc(trunc(d.nomeQ,22))],['Valor por '+d.rotulo.replace(/s$/,''),money(d.tkQ)]],
  trigger:`o primeiro de cada lista é uma pessoa diferente, com ${nf(d.razao,2)}× de diferença no valor médio do pedido`,
});

AUTO.taxa=d=>({
  verdict:`Entre ${artPl(d.escopoPl,'os','as')} ${d.n} ${esc(d.escopoPl||'itens')} que concentram ${pct(d.peso,0)} ${esc(d.universo||'do total')}, `
    +`a taxa de ${esc(d.rotuloExtra||'repasse')} vai de <b>${pct(d.tBaixa,1)} a ${pct(d.tAlta,1)}</b>.`,
  texto:`${esc(trunc(d.nomeAlta,30))} fica com ${pct(d.tAlta,1)} do que vende, e `
    +`${esc(trunc(d.nomeBaixa,30))}, com ${pct(d.tBaixa,1)} — mesmo tipo de acordo, ${nf(d.razao,1)}× de diferença. `
    +`Na média, o grupo fica com ${pct(d.media,1)}. `
    +`Sobre os ${mi(d.vNucleo)} que esse grupo movimenta, a distância entre o maior e o menor vale ${mi(d.custoDaDiferenca)}.`,
  ev:[[esc(trunc(d.nomeAlta,20)),pct(d.tAlta,1)],[esc(trunc(d.nomeBaixa,20)),pct(d.tBaixa,1)],
      ['Média do conjunto',pct(d.media,1)],['Vale a diferença',mi(d.custoDaDiferenca)]],
  trigger:`entre ${artPl(d.escopoPl,'os','as')} ${esc(d.escopoPl||'itens')} que fazem 80% do valor, taxa variando ${nf(d.razao,2)}× (limiar 1,25×)`,
});

AUTO.cauda=d=>({
  verdict:`Fora ${artPl(d.escopoPl,'dos','das')} ${d.topo} maiores, ${artPl(d.escopoPl,'os outros','as outras')} ${nf(d.nCauda)} ${esc(d.escopoPl||'itens')} somam `
    +`<b>${mi(d.vCauda)} — ${pct(d.vCauda/d.tot,0)}</b> ${esc(d.universo||'do total')}.`,
  texto:`Quem lê um ranking costuma parar nos primeiros nomes, mas aqui o resto da lista não é sobra: `
    +`são ${pct(d.nCauda/d.n,0)} ${artPl(d.escopoPl,'dos','das')} ${esc(d.escopoPl||'itens')}, e ${artPl(d.escopoPl,'juntos valem','juntas valem')} ${pct(d.vCauda/d.tot,0)} do total. `
    +`Cada um vale ${money(d.medioCauda)} em média, contra ${money(d.medioTopo)} de quem está no topo.`,
  ev:[['Fora do top '+d.topo,mi(d.vCauda)],['% do total',pct(d.vCauda/d.tot,0)],
      ['Média do resto da lista',money(d.medioCauda)],['Média do topo',money(d.medioTopo)]],
  trigger:`o resto da lista soma ${pct(d.vCauda/d.tot,0)} do valor (limiar 35%)`,
});

AUTO.estrutura=d=>({
  verdict:`O primeiro vale <b>${money(d.primeiro)}</b>; o ${d.k50+1}º já cai para <b>${money(d.corte)}</b> — e daí para baixo a lista quase não muda.`,
  texto:`A diferença grande está no começo da lista, não no fim. `
    +`Do primeiro para o ${d.k50+1}º a queda é de ${pct(d.queda1,0)}; do ${d.k50+1}º para o ${d.i80+1}º, só ${pct(d.queda2,0)}. `
    +`Do ${d.i80+1}º em diante, cada um vale em média ${money(d.medioResto)}. `
    +`Metade ${esc(d.universo||'do total')} está em ${d.k50} de ${nf(d.n)} ${esc(d.escopoPl||'itens')}.`,
  ev:[[(d.escopoPl||'Itens'),nf(d.n)],['Bastam para 50%',nf(d.k50)],
      ['Bastam para 80%',nf(d.k80)],['Maior isolado',pct(d.p1,1)]],
  trigger:`leitura de estrutura do ranking (sem métrica cruzada disponível)`,
});

AUTO.relacao=d=>({
  verdict:`${esc(trunc(d.nome,30))} vale <b>${nf(d.razao,1)}× a média</b> ${esc(d.universo||'do grupo')} `
    +`— ${money(d.maior)} contra ${money(d.media)}.`,
  texto:`São ${nf(d.n)} ${esc(d.escopoPl||'itens')} no período, somando ${mi(d.tot)}. `
    +(d.segundo?`Do primeiro para o segundo já cai ${pct(1-d.segundo/d.maior,0)}. `:'')
    +`${d.abaixo} deles ficam abaixo da média de ${money(d.media)} — ou seja, a média não descreve o grupo: `
    +`ela é puxada para cima por poucos.`,
  ev:[[(d.escopoPl||'Itens'),nf(d.n)],['Maior',money(d.maior)],
      ['Média',money(d.media)],['Abaixo da média',nf(d.abaixo)+' de '+nf(d.n)]],
  trigger:`leitura de referência do ranking (as demais não passaram no gatilho)`,
});

TXT.auto=(d,o)=>(AUTO[o.leitura]||AUTO.relacao)(d);

/* Texto editado pela Controladoria: marcadores {nome} trocados pelos mesmos números do destaque,
   formatados como a régua formata (dinheiro em milhões, percentual, contagem). */
function preencher(modelo,d){
  return String(modelo).replace(/\{(\w+)(?::(mi|money|pct|nf))?\}/g,(m,k,f)=>{
    const v=d[k];
    if(v==null) return m;
    return f==='money'?money(v):f==='pct'?pct(v,1):f==='nf'?nf(v):typeof v==='number'?mi(v):esc(String(v));
  });
}

/* Do objeto que veio do servidor para o objeto que a régua sabe desenhar. */
function montar(o){
  const f=TXT[o.regra];
  if(!f) return null;
  const t=f(o.d,o);
  const out=Object.assign({},o,t);
  if(o.editado){
    if(o.editado.verdict) out.verdict=preencher(o.editado.verdict,o.d);
    if(o.editado.texto) out.texto=preencher(o.editado.texto,o.d);
    out.manual=true;
  }
  if(o.leitura) out._leitura=o.leitura;
  return out;
}

/* Mapa slot -> destaque desenhável, do payload do servidor. */
function carregar(payloads){
  const mapa={};
  Object.keys(payloads||{}).forEach(bloco=>{
    const p=payloads[bloco];
    if(!p||!p._ins) return;
    Object.keys(p._ins).forEach(slot=>{ const o=montar(p._ins[slot]); if(o) mapa[slot]=o; });
  });
  return mapa;
}

G.DESTAQUES_TEXTO={TXT,montar,carregar,preencher};
})(window);
