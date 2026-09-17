/* Custo fixo — desenho de renderCustoFixoBody/renderCustoFixoEntidade do Kit.
   O filtro de entidade pede os números ao servidor (ctx.buscar). */
'use strict';
window.DESENHO=window.DESENHO||{};
window.DESENHO_POS=window.DESENHO_POS||{};
const CFCOLORS={Pessoal:SER[0],Facilities:SER[1],Consumo:SER[2],Marketing:SER[3],Terceiros:SER[4],Outros:SER[6]};

function _cfCorpo(P){
  let s='';
  const K=P['cf-cat'];
  if(K){ const cats=Object.keys(K.cats), nM=K.nM;
    s+=H3('Custo fixo por categoria — '+({CONSOLIDADO:'Consolidado',FABRICA:'Fábrica',DESIGN:'Loja'}[K.ent])+' (últimos 12 meses)',K.janela,'cf-cat');
    const series=cats.map(c=>({name:c,values:K.cats[c],color:CFCOLORS[c]}));
    s+='<div id="cf-cat-chart">'+fig(stackedCols(K.meses,series,{valfmt:v=>mi(v,1),
        linhaPct:{name:'Pessoal + Facilities',values:K.pesfac,color:'#c9a227',cls:'cf-pesfac'}}),
      ins('cfCategoriaContraFluxo','cf-categoria-contrafluxo')||ins('cfCategoriaContraFluxo','cf-categoria-contrafluxo-fabrica')||ins('cfCategoriaContraFluxo','cf-categoria-contrafluxo-design'))+'</div>';
    s+=table(['Categoria','Total '+nM+'m','% do custo fixo','Média/mês'],
      K.linhas.map(l=>[l[0],money(l[1]),pct(l[2],1),money(l[3])]),
      ['left','right','right','right'],['Custo fixo total',money(K.tot),'100,0%',money(K.media)],
      ins('cfConcentracao','cf-concentracao')||ins('cfConcentracao','cf-concentracao-fabrica')||ins('cfConcentracao','cf-concentracao-design'));
    s+=call('<b>Pessoal e Facilities</b> concentram '+pct(K.conc,0)+' do custo fixo dos últimos '+nM+' meses. '+esc(K.vol[0])+' é o item mais volátil mês a mês (oscila '+pct(K.vol[1],0)+' em torno da média).');
    const nApr=K.n_apr;
    s+=cap('Total de cada mês e entidade igual à despesa operacional da DRE. Abertura por categoria: '
      +(nApr?nApr+' '+(nApr===1?'mês':'meses')+' com a divisão da apresentação de resultados ajustada ao total da DRE ('+K.meses_apr.join(', ')+') e ':'')
      +(nM-nApr)+' '+((nM-nApr)===1?'mês':'meses')+' pelo razão contábil (aba _BD).');
  }
  const E=P['cf-ent'];
  if(E){ const nE=E.nE;
    s+=H3('Custo fixo total por entidade — Fábrica × Loja','','cf-ent');
    s+=fig(line([['Fábrica',E.fabrica,SER[0]],['Loja',E.loja,SER[1]]],E.meses,{valfmt:v=>mi(v,1),w:980,h:270}),ins('cfComposicao','cf-composicao'));
    s+=table(['Entidade','Custo fixo '+nE+'m','Média/mês','% do total'],
      E.linhas.map(l=>[l[0],money(l[1]),money(l[2]),pct(l[3],1)]),
      ['left','right','right','right'],['Consolidado',money(E.total[0]),money(E.total[1]),'100,0%']);
    s+=cap('Comparação entre as duas entidades: este quadro não muda com o filtro de entidade da seção.');
  }
  return s;
}

DESENHO.custofixo=function(P){
  const A=P['custofixo.abertura'];
  let s='';
  if(A){
    s+=`<div class="sec-head"><div class="kick">Custo fixo</div><h2>Custo fixo — composição</h2>
      <p class="lead">Abertura do custo fixo por categoria e entidade nos últimos 12 meses (${A.janela}), no estilo dos slides de custo fixo da apresentação.</p></div>
      <div class="filterbar"><div class="fb-ent"><span class="fb-t">Entidade:</span>
        <button class="cfb" data-e="CONSOLIDADO">Consolidado</button><button class="cfb" data-e="FABRICA">Fábrica</button><button class="cfb" data-e="DESIGN">Loja</button></div></div>`;
  }
  s+='<div id="cf-body">'+_cfCorpo(P)+'</div>';
  return s;
};

DESENHO_POS.custofixo=function(sec,ctx){
  const A=ctx.payload['custofixo.abertura'];
  const marca=e=>sec.querySelectorAll('.cfb').forEach(b=>b.classList.toggle('on',b.dataset.e===e));
  marca(A?A.ent:'CONSOLIDADO');
  sec.querySelectorAll('.cfb').forEach(b=>b.addEventListener('click',async()=>{
    const P=await ctx.buscar({ent:b.dataset.e});
    document.getElementById('cf-body').innerHTML=_cfCorpo(P);
    marca(b.dataset.e); ctx.remarcar();
  }));
};
