/* Estudos e Análises — Intercompany pela tabela de preço (Estudo_Intercompany_Modelo_A).
   O cálculo e o desenho vêm do Kit (icCalcula, icLead, icHtmlResumo, icHtmlDre); o servidor manda INTERCOMPANY e as linhas do
   Modelo A (FABLOJA) do ano do estudo, em cada bloco. */
'use strict';
window.DESENHO=window.DESENHO||{};
DESENHO.estudos=function(P){
  const X=P['estudos.abertura']||P['est-ic-resumo']||P['est-dre'];
  const D=(X&&!X.ausente)?icCalcula(X.I,X.F):null;
  let s='';
  if(P['estudos.abertura']){
    s+='<div class="sec-head"><div class="kick">Estudos e análises</div><h2>Intercompany pela tabela de preço</h2>'
      +(D?icLead(D):'<p class="lead">O DRE do <b>Modelo A</b> refeito com a receita de transferência interna trocada pelo valor apurado na tabela de preço.</p>')+'</div>';
    if(!D) s+=call('Estudo Intercompany não disponível nesta competência: envie o <code>Modelo_Gerencial_Fabrica_Loja.xlsx</code> e o <code>Analise_Intercompany_&lt;ano&gt;.xlsx</code> '
      +'(gerado por <code>estudo_intercompany.py</code>) na base "Modelo gerencial Fábrica × Loja" e processe de novo. Seção não gerada.','warn');
  }
  if(!D) return s;
  if(P['est-ic-resumo']) s+=H3('Intercompany — resumo e leitura',D.per,'est-ic-resumo')+icHtmlResumo(D);
  if(P['est-dre']) s+=H3('O DRE por unidade','Modelo A simulado · até o EBIT · '+D.ano+' · '+D.per,'est-dre')+icHtmlDre(D);
  return s;
};
