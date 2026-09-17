/* Estudos e Análises — desenho de renderEstudos/renderEstudosBody do Kit.
   Abrir os subgrupos de despesa pede o quadro ao servidor (ctx.buscar). */
'use strict';
window.DESENHO=window.DESENHO||{};
window.DESENHO_POS=window.DESENHO_POS||{};

function _estCorpo(P){
  const E=P['est-dre']; if(!E) return '';
  const K=E.kpis;
  const cel=v=>v==null?'<span class="mut">—</span>':(v<0?`<span style="color:${BAD}">${money(v)}</span>`:money(v));
  const celPct=v=>v==null?'<span class="mut">—</span>':`<span class="mut" style="font-weight:600">${pct(v,1)}</span>`;
  const rotPct=t=>`<span class="mut" style="padding-left:20px">${esc(t)}</span>`;
  let s='<div class="kpis k4">'
   +kpi('Loja · EBIT no modelo antigo',mi(K.loja_antigo),'entidade jurídica','warn')
   +kpi('Loja · EBIT no Modelo A',mi(K.loja),'operação comercial',K.loja>=0?'ok':'warn')
   +kpi('Fábrica · EBIT no Modelo A',mi(K.fabrica),'operação industrial',K.fabrica>=0?'ok':'warn')
   +kpi('Consolidado · EBIT',mi(K.consolidado),'Modelo A · '+esc(E.periodo),K.consolidado>=0?'ok':'warn')
   +'</div>';
  const rows=E.linhas.map(l=>{
    if(l.tipo==='pct') return [rotPct(l.rot)].concat(l.v.map(celPct));
    if(l.tipo==='ebit') return ['<b>(=) EBIT</b>'].concat(l.v.map(v=>`<b>${cel(v)}</b>`));
    const w=x=>l.forte?`<b>${x}</b>`:x, nome=esc(acentuaDre(l.nome));
    return [l.nivel===2?`<span style="padding-left:20px" class="mut">${nome}</span>`:w(nome)].concat(l.v.map(v=>w(cel(v))));
  });
  s+='<button id="est-grp-toggle" type="button" class="cxgrp-toggle">'
    +(E.aberto?'Recolher os subgrupos de despesa':'Abrir os 16 subgrupos de despesa')+'</button>';
  s+=H3('O DRE por unidade','Modelo A · até o EBIT · '+esc(E.periodo),'est-dre');
  s+=table(['Linha do DRE','Fábrica','Loja','Consolidado'],rows,['left','right','right','right'],null,ins('fabLojaLinhas','fabloja-linhas'));
  s+=cap('<b>Sem rateio.</b> Despesa operacional e depreciação vão direto para a entidade que as registrou: '
    +'o que é da 55 Fábrica fica na Fábrica, o que é da 55 Design fica na Loja. Essas linhas batem, ao centavo, '
    +'com as abas <code>REAL — 55 FÁBRICA</code> e <code>REAL — 55 DESIGN</code> do Painel. '
    +'As áreas de suporte — Administrativo, Tesouraria, Presidência, TI, RH, Contabilidade, Facilities — ficam onde a '
    +'entidade que as pagou as registrou, em sua maior parte na Fábrica; não há redistribuição por centro de custo.');
  s+=cap('O quadro para no <b>EBIT</b>: a depreciação entra, o pacote financeiro sai — os juros vão integralmente para a '
    +'Loja por premissa e diriam mais sobre onde está a dívida do que sobre a operação. Vale a ressalva de que no EBIT os '
    +'dois modelos ainda não se encontram: o antigo reconhece a absorção abaixo do resultado operacional e o Modelo A a '
    +'reconhece acima do EBITDA. A diferença some no resultado líquido, que é idêntico nos dois — a conciliação do item 7.6 '
    +'da ata fecha lá, não aqui.');
  s+='<div class="sources"><b>Fonte:</b> Modelo_Gerencial_Fabrica_Loja.xlsx, aba <code>12_DRE_Antigo_x_Mudanca</code>, apurada em '+esc(E.apurado)+'. '
    +'Período em tela: '+esc(E.periodo)+'. Premissas: base = tudo vendido ao cliente final · fábrica por absorção · transferência a custo de absorção '
    +'+ markup de '+(E.markup!=null?pct(E.markup,3):'—')+' · sem imposto na transferência interna · despesa e depreciação por entidade, sem rateio. '
    +'O markup é premissa calibrada (01_Premissas), não os 10% originais do item 7.1: está ajustado para a Fábrica '
    +'fechar '+esc(String(E.ano))+' YTD com EBIT de 10% da receita de transferência.</div>';
  return s;
}

DESENHO.estudos=function(P){
  const A=P['estudos.abertura'];
  let s='';
  if(A){
    s+=`<div class="sec-head"><div class="kick">Estudos e análises</div><h2>Modelo gerencial Fábrica × Loja</h2>
   <p class="lead">O resultado repartido entre <b>fábrica industrial</b> e <b>loja comercial</b>, do topo do DRE até o <b>EBIT</b>. A fábrica deixa de vender ao cliente final e passa a transferir para a loja; despesa e depreciação ficam na entidade que as registrou, sem rateio.</p></div>`;
    if(!A.tem) return s+call('Planilha "Modelo_Gerencial_Fabrica_Loja.xlsx" não encontrada (ou sem conciliação válida). Seção não gerada — rode <code>python Modelo_Gerencial_Fabrica_Loja/modelo_gerencial_fabrica_loja.py</code> e regere o relatório.','warn');
  }
  s+='<div id="estudos-body">'+_estCorpo(P)+'</div>';
  return s;
};

DESENHO_POS.estudos=function(sec,ctx){
  const body=document.getElementById('estudos-body'); if(!body) return;
  let aberto=(ctx.payload['est-dre']||{}).aberto?1:0;
  body.addEventListener('click',async ev=>{
    if(!ev.target.closest('#est-grp-toggle')) return;
    aberto=aberto?0:1;
    const P=await ctx.buscar({grp:aberto});
    body.innerHTML=_estCorpo(P);
    ctx.remarcar();
  });
};
