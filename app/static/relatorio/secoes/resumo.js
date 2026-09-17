/* Sumário executivo — desenho de renderSumario() do Kit, alimentado pelo servidor. */
'use strict';
window.DESENHO=window.DESENHO||{};
DESENHO.resumo=function(P){
  let s='';
  const ymLabExt=ym=>['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro'][(ym%100)-1]+'/'+Math.floor(ym/100);
  const base=P['resumo.abertura']||P['rs-hist']||P['rs-ytd']||P['rs-leitura'];
  if(!base) return s;
  const mLabV=MES[(base.maxym%100)-1], ymLabV=ymLab(base.maxym), Y1=base.Y1, Y0=base.Y0;
  const A=P['resumo.abertura'];
  if(A) s+=`<div class="sec-head"><div class="kick">+55 Design · base atualizada até ${ymLabV}</div><h2>Sumário executivo de vendas</h2>
   <p class="lead">Panorama em duas leituras: o <b>histórico completo</b> desde ${ymLabAno(A.minym)} e um recorte específico de <b>${Y1} (Jan–${mLabV})</b>. Base comercial de ${nf(A.n_linhas)} linhas; faturamento e resultado pela DRE (abas REAL). Filtros de período na seção “Análise por período” e na DRE.</p></div>`;
  const H=P['rs-hist'];
  if(H){
    s+=H3('Histórico · '+ymLabExt(H.minym)+' – '+mLabV.toLowerCase()+'/'+Y1,'','rs-hist');
    s+='<div class="kpis">'
     +kpi('Venda contratada · total',mi(H.total),ymLabAno(H.minym)+'–'+ymLabV,'ok')
     +kpi('Pedidos',nf(H.peds),'ticket médio '+mi(H.ticket))
     +kpi('Relações únicas',nf(H.rel_unicas),'arquiteto, ou cliente sem arquiteto — compra líquida positiva')
     +kpi('Designers licenciados',nf(H.n_designers),'2 maiores = '+pct(H.dtop/H.dtot,0)+' dos royalties')
     +kpi('Faturamento '+H.ano_d_ant+' · DRE',H.fat_ano_ant!=null?mi(H.fat_ano_ant):'—','Receita Bruta Consolidada')
     +kpi('Carteira em aberto',mi(H.carteira),'pos. '+ymLabV,'warn')
     +kpi('Repasses e comissões',mi(H.rep),pct(H.rep/H.total,1)+' das vendas')
     +kpi('Concentração Top 10',pct(H.top10/H.total,0),'dos clientes na venda')
     +'</div>';
  }
  const Y=P['rs-ytd'];
  if(Y){
    const hasMeta=Y.orcado!=null, D=Y.dre;
    s+=H3(Y1+' · Janeiro a '+mLabV,'','rs-ytd');
    s+='<div class="kpis">'
     +kpi('Venda contratada · '+Y1,mi(Y.total),hasMeta?deltaHtml(Y.realizado/Y.orcado-1)+' vs orçado':'jan–'+ymLabV)
     +(D?kpi('Faturamento · DRE',mi(D.fat),deltaHtml(D.fat/D.fat_ant-1)+' vs '+D.ano_d_ant+' YTD'):'')
     +(D?kpi('EBITDA · DRE',mi(D.ebitda),pct(D.eb_pct,1)+' da ROL',D.ebitda>=0?'ok':'warn'):'')
     +(D?kpi('EBIT · DRE',mi(D.ebit),pct(D.ebit/D.rl,1)+' da ROL — antes do efeito financeiro',D.ebit>=0?'ok':'warn'):'')
     +kpi('Pedidos · '+Y1,nf(Y.peds),'ticket médio '+mi(Y.ticket))
     +kpi('Ticket médio · '+Y1,mi(Y.ticket),'por pedido')
     +kpi('Relações únicas · '+Y1,nf(Y.rel_unicas),'arquiteto, ou cliente sem arquiteto — compra líquida positiva')
     +kpi('Novas relações · '+Y1,nf(Y.novos),'arquiteto ou cliente, sem compra antes de '+Y1,'ok')
     +'</div>';
  }
  const L=P['rs-leitura'];
  if(L){
    const hasMeta=L.orcado!=null;
    const prov=[
     [L.titulo,'Venda contratada saltou de '+mi(L.venda_ini)+' ('+L.ano_ini+') para '+mi(L.venda_ant)+' ('+Y0+'). '+Y1+' (Jan–'+mLabV+') soma '+mi(L.venda_ano)+(hasMeta?(L.realizado<L.orcado?', abaixo do orçado ('+mi(L.orcado)+').':', acima do orçado ('+mi(L.orcado)+').'):'.')],
     ['Concentração de design','Os dois maiores estúdios concentram '+pct(L.dtop/L.dtot,0)+' dos royalties pagos ('+mi(L.dtot)+' no total).'],
     ['RT a arquitetos é o maior repasse','O repasse técnico a arquitetos soma '+mi(L.rt)+' ('+pct(L.rt/L.total,1)+' das vendas), acima até dos royalties de designer.'],
     ['Baixa concentração de clientes','Top 10 clientes = '+pct(L.top10/L.total,0)+' das vendas — carteira pulverizada, com espaço para recompra e indicação.'],
    ];
    s+='<h3 data-blk="rs-leitura">Leitura executiva</h3><div class="prov">'+prov.map((p,i)=>`<div class="pv"><div class="pv-n">${i+1}</div><div><b>${esc(p[0])}</b><p>${p[1]}</p></div></div>`).join('')+'</div>';
  }
  return s;
};
