/* Custo fixo mensal — desenho de drawCustoFixoMensal/drawCustoFixoMensalAno do Kit.
   Filtros pedem os números ao servidor; a composição de um pacote vem por detalhamento. */
'use strict';
window.DESENHO=window.DESENHO||{};
window.DESENHO_POS=window.DESENHO_POS||{};
const CFM_ROT={t:{rotulo:'Terceiro',titulo:'terceiro'},c:{rotulo:'Conta contábil',titulo:'conta contábil'}};
const CFM_ENT={CONSOLIDADO:'Consolidado',FABRICA:'Fábrica',LOJA:'Loja'};

function _cfmCorpo(P){
  const A=P['custofixo_mensal.abertura'];
  if(A&&A.ausente) return call('Razão contábil (_BD2024) não encontrada no Painel de Resultado. Seção não gerada.','warn');
  if(A&&A.vazio) return call('Sem lançamentos de custo fixo na base.','warn');
  const T=P['cfm-pacotes']; if(!T) return '';
  const D=CFM_ROT[T.dim], entName=CFM_ENT[T.emp];
  let s='';
  if(T.modo==='mes'){
    s+=H3('Pacotes — '+entName+' · '+ymLab(T.ym),'vs. '+ymLab(T.prev),'cfm-pacotes');
    s+='<div class="tw"><table class="dt"><thead><tr><th class="left">Pacote</th><th class="right">'+ymLab(T.ym)+'</th><th class="right">'+ymLab(T.prev)+'</th><th class="right">Variação</th></tr></thead><tbody>'
     +T.linhas.map(r=>`<tr class="cfm-pac-row" data-p="${esc(r[0])}"><td class="left">${esc(r[0])}</td><td class="right">${money(r[1])}</td><td class="right">${money(r[2])}</td><td class="right">${deltaCost(r[2]?r[3]/r[2]:null)} ${money(r[3])}</td></tr>`).join('')
     +'</tbody><tfoot><tr><td class="left">Total</td><td class="right">'+money(T.tot[0])+'</td><td class="right">'+money(T.tot[1])+'</td><td class="right">'+money(T.tot[2])+'</td></tr></tfoot></table></div>';
    s+=cap('Clique num pacote para ver a composição por '+D.titulo+'.');
    s+='<div class="tw-ins">'+(window.INSRT?INSRT.strip(ins('cfPacoteVariacao','cf-pacote-variacao')):'')+'</div>';
  } else {
    s+=H3('Pacotes — '+entName+' · '+T.ano+' (evolutivo)','','cfm-pacotes');
    s+='<div class="tw"><table class="dt"><thead><tr><th class="left">Pacote</th>'
     +T.yms.map(y=>`<th class="right">${ymLab(y)}</th>`).join('')
     +'<th class="right">Total</th><th class="right">% do ano</th></tr></thead><tbody>'
     +T.linhas.map((r,i)=>`<tr class="cfm-pac-row" data-p="${esc(r.p)}"><td class="left">${esc(r.p)}</td>`
       +r.meses.map(v=>`<td class="right">${money(v)}</td>`).join('')
       +`<td class="right">${money(r.tot)}</td><td class="right">${pct(T.pct[i],1)}</td></tr>`).join('')
     +'</tbody><tfoot><tr><td class="left">Total</td>'
     +T.col_tot.map(v=>`<td class="right">${money(v)}</td>`).join('')
     +`<td class="right">${money(T.tot)}</td><td class="right">100,0%</td></tr></tfoot></table></div>`;
    s+=cap('Clique num pacote para ver a composição por '+D.titulo+', mês a mês em '+T.ano+'.');
  }
  s+='<div id="cfm-terceiro-body"></div>';
  return s;
}

function _cfmComposicao(R){
  const D=CFM_ROT[R.dim];
  if(R.modo==='mes'){
    const rows=R.linhas;
    return H3('Composição por '+D.titulo+' — '+R.pac, nf(rows.length)+(rows.length===1?' item':' itens'))
      +table([D.rotulo,'Mês atual','Mês anterior','Variação'],
          rows.map(r=>[esc(trunc(r[0],40)),money(r[1]),money(r[2]),money(r[1]-r[2])]),
          ['left','right','right','right'],
          ['Total',money(R.tot[0]),money(R.tot[1]),money(R.tot[0]-R.tot[1])]);
  }
  const rows=R.linhas;
  let s=H3('Composição por '+D.titulo+' — '+R.pac+' · '+R.ano, nf(rows.length)+(rows.length===1?' item':' itens'));
  s+='<div class="tw"><table class="dt"><thead><tr><th class="left">'+D.rotulo+'</th>'
   +R.yms.map(y=>`<th class="right">${ymLab(y)}</th>`).join('')
   +'<th class="right">Total</th><th class="right">% do pacote</th><th class="right">% acum.</th></tr></thead><tbody>'
   +rows.map(r=>`<tr><td class="left">${esc(trunc(r.n,40))}</td>`
     +r.meses.map(v=>`<td class="right">${money(v)}</td>`).join('')
     +`<td class="right">${money(r.tot)}</td><td class="right">${pct(r.pct,1)}</td><td class="right">${pct(r.acum,1)}</td></tr>`).join('')
   +'</tbody><tfoot><tr><td class="left">Total</td>'
   +R.col_tot.map(v=>`<td class="right">${money(v)}</td>`).join('')
   +`<td class="right">${money(R.tot)}</td><td class="right">100,0%</td><td class="right">100,0%</td></tr></tfoot></table></div>`;
  return s;
}

DESENHO.custofixo_mensal=function(P){
  const A=P['custofixo_mensal.abertura'];
  let s='';
  if(A){
    s+=`<div class="sec-head"><div class="kick">Custo fixo · detalhamento</div><h2>Custo fixo mensal</h2>
        <p class="lead">Mês a mês por pacote, direto do razão contábil — clique num pacote para ver a composição por terceiro.</p></div>
      <div class="filterbar"><div class="fb-custom">
        <span class="fb-t">Empresa:</span> <select id="cfm-emp"><option value="CONSOLIDADO">Consolidado</option><option value="FABRICA">Fábrica</option><option value="LOJA">Loja</option></select>
        <span class="fb-t">Mês:</span> <select id="cfm-mes">${A.yms?A.anos.map(a=>`<option value="Y${a}">${a}</option>`).join('')+A.yms.map(y=>`<option value="${y}">${ymLab(y)}</option>`).join(''):''}</select>
        <span class="fb-t">Detalhar por:</span> <select id="cfm-dim"><option value="t">Terceiro</option><option value="c">Conta contábil</option></select></div></div>`;
  }
  s+='<div id="cfm-body">'+_cfmCorpo(P)+'</div>';
  return s;
};

DESENHO_POS.custofixo_mensal=function(sec,ctx){
  const A=ctx.payload['custofixo_mensal.abertura']||{};
  const T0=ctx.payload['cfm-pacotes']||{};
  const f={emp:A.emp||T0.emp||'CONSOLIDADO', ym:A.ym||(T0.modo==='ano'?'Y'+T0.ano:T0.ym), dim:A.dim||T0.dim||'t'};
  let pacSel=null;
  const selEmp=document.getElementById('cfm-emp'), selMes=document.getElementById('cfm-mes'), selDim=document.getElementById('cfm-dim');
  if(selEmp) selEmp.value=f.emp; if(selMes&&f.ym) selMes.value=f.ym; if(selDim) selDim.value=f.dim;
  async function composicao(){
    const box=document.getElementById('cfm-terceiro-body'); if(!box) return;
    if(!pacSel){ box.innerHTML=''; return; }
    box.innerHTML=_cfmComposicao(await ctx.detalhe('composicao',Object.assign({pac:pacSel},f)));
    ctx.remarcar();
  }
  function ligar(){
    if(!ctx.pode('detalhar')) return;
    sec.querySelectorAll('.cfm-pac-row').forEach(tr=>{ tr.style.cursor='pointer';
      if(tr.dataset.p===pacSel) tr.style.background='rgba(146,112,93,.12)';
      tr.addEventListener('click',()=>{ pacSel=(pacSel===tr.dataset.p?null:tr.dataset.p);
        sec.querySelectorAll('.cfm-pac-row').forEach(r=>r.style.background=r.dataset.p===pacSel?'rgba(146,112,93,.12)':'');
        composicao(); }); });
  }
  /* trocar empresa/mês muda o recorte e limpa a seleção; trocar a dimensão mantém o pacote aberto */
  async function redesenha(limpa){
    if(limpa) pacSel=null;
    const P=await ctx.buscar(f);
    document.getElementById('cfm-body').innerHTML=_cfmCorpo(P);
    ligar(); ctx.remarcar(); if(pacSel) composicao();
  }
  if(selEmp) selEmp.addEventListener('change',e=>{f.emp=e.target.value; redesenha(true);});
  if(selMes) selMes.addEventListener('change',e=>{f.ym=e.target.value; redesenha(true);});
  if(selDim) selDim.addEventListener('change',e=>{f.dim=e.target.value; redesenha(false);});
  ligar();
};
