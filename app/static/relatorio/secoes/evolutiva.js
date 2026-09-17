/* Evolutiva histórica — desenho de renderEvolutiva() do Kit, alimentado pelo servidor. */
'use strict';
window.DESENHO=window.DESENHO||{};
DESENHO.evolutiva=function(P){
  let s='';
  const A=P['evolutiva.abertura'];
  if(A){
    s+=`<div class="sec-head"><div class="kick">Visão histórica</div><h2>Evolutiva histórica de vendas</h2>
    <p class="lead">Venda contratada mensal de ${ymLabAno(A.minym)} a ${ymLab(A.maxym)} (base comercial completa, ${nf(A.n_linhas)} linhas). ${A.lead_pico}</p></div>`;
    s+=fig(line([['Venda contratada',A.serie,SER[0]]],A.labels.map(ymLab),{valfmt:v=>mi(v,1),w:980,h:320}),
      ins('vendasPartesRelacionadas'));
  }
  const E=P['ev-anual'];
  if(E){
    const d=v=>v==null?'—':deltaHtml(v);
    s+=H3('Venda contratada × faturamento (DRE) — anual','','ev-anual');
    s+=fig(line([
       ['Venda contratada (base)',E.linhas.map(l=>l.venda),SER[0]],
       ['Faturamento — Receita Bruta (DRE)',E.linhas.map(l=>l.fat),SER[2]],
     ],E.anos.map(String),{valfmt:v=>mi(v,1),w:900,h:300}),
      ins('vendasEfeitoPrecoVolume'));
    const rows=E.linhas.map((l,i)=>[l.ano,money(l.venda||0),money(l.fat),
      i>0?deltaHtml(l.var_v):'—', i>0?deltaHtml(l.var_f):'—', d(l.cagr_v), d(l.cagr_f)]);
    const R=E.realizado, J=E.projetado;
    rows.push([`${E.ano_v} (realizado até ${ymLab(E.maxym)})`, money(R.venda), money(R.fat),
      R.var_v!=null?deltaHtml(R.var_v):'—', R.var_f!=null?deltaHtml(R.var_f):'—', '—', '—']);
    rows.push([`${E.ano_v} (projetado, ano cheio)`,
      J.venda!=null?money(J.venda):'—', J.fat!=null?money(J.fat):'—',
      J.var_v!=null?deltaHtml(J.var_v):'—', J.var_f!=null?deltaHtml(J.var_f):'—',
      J.venda!=null?d(J.cagr_v):'—', J.fat!=null?d(J.cagr_f):'—']);
    s+=table(['Ano','Venda contratada','Faturamento (DRE)','Var. venda a/a','Var. faturamento a/a',`CAGR venda (desde ${E.ai})`,`CAGR faturamento (desde ${E.ai})`],
      rows,['left','right','right','right','right','right','right'],null,ins('vendaVsFaturamento'));
    s+=cap((E.parcial?E.parcial.ano+' (parcial, início em '+E.parcial.mes+') omitido da comparação anual cheia. ':'')+E.ano_v+' traz duas linhas: o <b>realizado</b> até '+ymLab(E.maxym)
      +' (var. a/a contra o mesmo período de '+E.a0+') e o <b>projetado</b> para o ano cheio — projeção obtida dividindo o realizado pela participação '
      +'histórica média de '+E.ai+'–'+E.a0+' dos meses já decorridos no total anual (sazonalidade, não distribuição linear do que falta). '
      +'CAGR = crescimento composto anual desde '+E.ai+'.');
  }
  return s;
};
