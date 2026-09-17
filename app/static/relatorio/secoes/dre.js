/* DRE — desenho de buildDreFilter/renderDreBody/drawDreSnap do Kit.
   Entidade, período e o comparativo mensal pedem os números ao servidor (ctx.buscar). */
'use strict';
window.DESENHO=window.DESENHO||{};
window.DESENHO_POS=window.DESENHO_POS||{};

function _drePeriodo(A,a,b){ if(a<=200001&&b>=300000)return 'histórico completo ('+ymLabAno(A.minym_vendas)+'–'+ymLab(A.maxym_vendas)+')';
  if(a===b) return ymLab(a).replace('/','/20'); const Y1=Math.floor(a/100),Y2=Math.floor(b/100);
  if(a%100===1&&b%100===12&&Y1===Y2) return 'ano '+Y1; return ymLab(a)+' – '+ymLab(b);}

function _dreVar(cur,prev){
  const mudo=v=>`<span style="color:${MUT}">—</span>`;
  if(cur==null||prev==null||!isFinite(cur)||!isFinite(prev)||prev===0) return mudo();
  if((cur<0)!==(prev<0)) return `<span style="color:${MUT}" title="Mudança de sinal entre os períodos — variação percentual não comparável">—</span>`;
  const bom=cur>prev;
  return `<span style="color:${bom?GOOD:BAD};font-weight:600" title="${bom?'melhorou':'piorou'}">${spct(cur/prev-1)}</span>`;
}

function _dreCorpo(P){
  let s='';
  const A=P['dre.abertura'];
  if(A){ const g=A.g;
    s+='<div class="kpis">'
     +kpi('Receita Bruta',mi(g.receita_bruta),A.nome)
     +kpi('Receita Líquida',mi(g.receita_liquida),'')
     +kpi('Margem de Contribuição',mi(g.margem_contrib),pct(g.mc_pct,1)+' da ROL','ok')
     +kpi('Custo Fixo',mi(-g.despesas_op),pct(-g.cf_pct,1)+' da ROL','warn')
     +kpi('EBITDA',mi(g.ebitda),pct(g.eb_pct,1)+' da ROL',g.ebitda>=0?'ok':'warn')
     +kpi('Resultado Líquido',mi(g.result_liq),pct(g.rl_pct,1)+' da ROL',g.result_liq>=0?'ok':'warn')
     +'</div>'; }
  const Po=P['dre-ponte'];
  if(Po){ const g=Po.g;
    s+=H3('Ponte do resultado — da receita líquida ao resultado','cascata','dre-ponte');
    s+=fig(waterfall([
      {label:'Receita Líquida',value:g.receita_liquida,type:'t'},
      {label:'(−) Custos Variáveis',value:g.custos_var},
      {label:'Margem Contribuição',value:g.margem_contrib,type:'t'},
      {label:'(−) Custo Fixo',value:g.despesas_op},
      {label:'EBITDA',value:g.ebitda,type:'t'},
      {label:'(−) Depreciação',value:g.deprec},
      {label:'(−) Financeiro',value:g.financeiro},
      {label:'(+) Absorção/ñ op.',value:g.ajuste},
      {label:'Resultado Líquido',value:g.result_liq,type:'t'},
    ],{valfmt:v=>mi(v,1)}),ins('dreCustoFixoNivel','dre-cf-nivel')); }
  const T=P['dre-tabela'];
  if(T){
    s+=H3('Demonstração de resultado (DRE)','','dre-tabela');
    s+=table(['Linha','Valor','% ROL'],T.linhas.map(l=>{const t=l[1], v=l[2];
        const st=t==='t'?'font-weight:700':(t==='h'?'font-weight:600':'');
        return [`<span style="${st}">${esc(l[0])}</span>`, v<0?`<span style="color:${BAD}">${money(v)}</span>`:money(v), pct(l[3],1)];
      }),['left','right','right'],null,ins('dreLinhaQueMudou','dre-linha-que-mudou')); }
  const BE=P['dre-breakeven'], MD=P['dre-minidre'];
  if(BE||MD){ const pe=BE?BE.pe:true;
    if(BE) s+=H3('Ponto de equilíbrio — '+BE.nome,'','dre-breakeven');
    if(pe){
      if(BE){ const e=BE.pe;
        s+='<div class="kpis">'
         +kpi('Margem de contribuição',pct(e.mc_pct,1),'da Receita Líquida')
         +kpi('PE operacional · valor',mi(e.pe_v),'Rec. Líquida p/ EBITDA 0','warn')
         +kpi('PE operacional · quantidade',nf(Math.round(e.pe_q))+' un.','produtos p/ EBITDA 0','warn')
         +kpi('Margem de segurança',pct(e.marg_seg,0),(e.marg_seg>=0?'acima':'abaixo')+' do equilíbrio',e.marg_seg>=0?'ok':'warn')
         +'</div>';
        s+=fig(line([['Receita Líquida',e.receita,SER[0]],['Custo total (fixo + variável)',e.custo,SER[1]]],e.qs.map(q=>nf(Math.round(q))),{valfmt:v=>mi(v,1),w:980,h:300}),
          ins('equilibrioBruta','equilibrio-bruta'));
        s+=cap('Quantidade de produtos no eixo. O cruzamento das linhas é o equilíbrio operacional: <b>'+nf(Math.round(e.pe_q))+' produtos</b> / <b>'+mi(e.pe_v)+'</b> de receita líquida (real: '+nf(Math.round(e.vol))+' produtos / '+mi(e.rolv)+'). Preço médio líq. R$ '+nf(e.preco_u,0)+' · custo variável R$ '+nf(e.cv_u,0)+' · custo fixo '+mi(e.cf)+'.');
      }
      if(MD){ const perMini=ymLab(MD.ini)+'–'+ymLab(MD.fim), mesesYTD=MD.meses;
        s+=H3('Mini-DRE — comprovação do ponto de equilíbrio ('+perMini+')','','dre-minidre');
        if(MD.aplicavel){
          const c=v=>v<0?`<span style="color:${BAD}">${money(v)}</span>`:money(v);
          const un=v=>nf(Math.round(v))+' un.';
          const rows6=MD.linhas.map(l=>{
            if(l.q) return [`<span>${esc(l.lab)}</span>`].concat(l.v.map(un));
            const wrap=v=>l.bold?`<b>${c(v)}</b>`:c(v);
            return [`<span style="${l.bold?'font-weight:700':''}">${esc(l.lab)}</span>`].concat(l.v.map(wrap)); });
          s+='<div class="tw"><table class="dt"><thead>'
           +'<tr><th class="left" rowspan="2">Linha</th>'
           +'<th class="right" colspan="3">Período ('+perMini+')</th>'
           +'<th class="right" colspan="3">Visão mensal · média (÷ '+mesesYTD+' '+(mesesYTD===1?'mês':'meses')+')</th></tr>'
           +'<tr><th class="right">Real</th><th class="right">Equilíbrio</th><th class="right">Variação</th>'
           +'<th class="right">Realizado</th><th class="right">Equilíbrio</th><th class="right">Variação</th></tr>'
           +'</thead><tbody>'
           +rows6.map(r=>'<tr>'+r.map((x,i)=>`<td class="${i===0?'left':'right'}">${x}</td>`).join('')+'</tr>').join('')
           +'</tbody></table></div>';
          s+='<div class="tw-ins">'+(window.INSRT?INSRT.strip(ins('equilibrioAlavanca','equilibrio-alavanca')):'')+'</div>';
          s+=call('No <b>equilíbrio operacional</b> do período ('+perMini+', '+mesesYTD+' '+(mesesYTD===1?'mês':'meses')+') a margem de contribuição iguala o custo fixo ('+mi(MD.cf)+') e o EBITDA zera — exigindo '+mi(MD.pe_v)+' de receita líquida ('+nf(Math.round(MD.pe_q))+' produtos), equivalente a '+mi(MD.rob_eb)+' de receita bruta, contra '+mi(MD.rl)+' de líquida ('+mi(MD.rb)+' de bruta) realizados. Em média mensal, isso é '+mi(MD.pe_v_mes)+' de receita líquida por mês, contra '+mi(MD.rl_mes)+' realizados por mês. Receita bruta no equilíbrio estimada aplicando o % de deduções real do período ('+pct(-MD.ded_pct,1)+') — assume deduções proporcionais à receita.',MD.marg_seg>=0?'ok':'warn');
        } else {
          s+=call('No período ('+perMini+') a margem de contribuição não é positiva para este recorte — a Mini-DRE de equilíbrio não é aplicável. Selecione o Consolidado ou outro período para ver o equilíbrio operacional.','warn');
        }
      }
    } else {
      s+=call('No período/entidade selecionado a margem de contribuição não é positiva — o ponto de equilíbrio não é aplicável. Selecione o Consolidado e um período com margem de contribuição positiva.','warn');
    }
  }
  const EV=P['dre-evol'];
  if(EV){ s+=H3('Evolução mensal — receita líquida e EBITDA','','dre-evol');
    s+=fig(line([['Receita Líquida',EV.rl,SER[0]],['EBITDA',EV.eb,SER[2]]],EV.yms.map(ymLab),{valfmt:v=>mi(v,1),w:980,h:300}),ins('dreJurosEbitda','dre-juros-ebitda')); }
  const PR=P['dre-produto'];
  if(PR){
    s+=H3('Ticket médio, custo e margem por produto','','dre-produto');
    s+='<div class="kpis k3">'
     +kpi('Quantidade faturada',nf(Math.round(PR.volume)),'produtos · '+PR.nome)
     +kpi('Ticket médio / produto',money(PR.ticket),'Receita Bruta ÷ qtd')
     +kpi('ROL / produto',money(PR.rol),'Receita Líquida ÷ qtd')
     +kpi('Custo médio / produto',money(-PR.custo),'CPV ÷ qtd','warn')
     +kpi('GVV / produto',money(-PR.gvv),'Gastos var. c/ vendas ÷ qtd','warn')
     +kpi('Margem contrib. / produto',money(PR.mc),(PR.mc_rol!=null?pct(PR.mc_rol,0):'')+' da ROL','ok')
     +'</div>';
    const S=PR.serie;
    if(S){ s+=fig(line([['Ticket médio (ROB) / produto',S.ticket,SER[0]],['ROL / produto',S.rol,SER[2]],['Custo médio (CPV) / produto',S.custo,SER[1]]],S.yms.map(ymLab),{valfmt:v=>money(v),w:980,h:300}),
      ins('dreMargemVolume','dre-margem-volume')||ins('auto','auto-dre-ticket'));
      s+=cap('Ticket médio = Receita Bruta ÷ qtd faturada · ROL/produto = Receita Líquida ÷ qtd · Custo médio = Custo do Produto Vendido ÷ qtd. GVV/produto (comissões, royalties, RT, fretes) e margem de contribuição por produto no quadro anual abaixo.'); }
  }
  const PA=P['dre-produto-ano'];
  if(PA){
    s+=H3('Histórico anual — indicadores por produto','todos os anos','dre-produto-ano');
    s+=table(['Ano','Qtd faturada','Ticket (ROB)/prod','ROL/prod','Custo (CPV)/prod','GVV/prod','Margem contrib./prod','Margem %'],
      PA.anos.map(x=>[x[0],nf(Math.round(x[1])),money(x[2]),money(x[3]),money(x[4]),money(x[5]),money(x[6]),pct(x[7],1)]),
      ['left','right','right','right','right','right','right','right'],null,ins('auto','auto-dre-hist-prod'));
  }
  const FL=P['dre-fabloja'];
  if(FL){ const f=FL.f,d=FL.d,g=FL.g;
    s+=H3('Segregação Fábrica × Loja no período','','dre-fabloja');
    s+=table(['Indicador','Fábrica','Loja','Consolidado'],[
      ['Receita Bruta',money(f.receita_bruta),money(d.receita_bruta),money(g.receita_bruta)],
      ['Receita Líquida',money(f.receita_liquida),money(d.receita_liquida),money(g.receita_liquida)],
      ['Margem de Contribuição',money(f.margem_contrib),money(d.margem_contrib),money(g.margem_contrib)],
      ['&nbsp;&nbsp;<span class="mut">% da ROL</span>',`<span class="mut">${pct(f.mc_pct,1)}</span>`,`<span class="mut">${pct(d.mc_pct,1)}</span>`,`<span class="mut">${pct(g.mc_pct,1)}</span>`],
      ['Custo Fixo',money(-f.despesas_op),money(-d.despesas_op),money(-g.despesas_op)],
      ['EBITDA',`<span style="color:${f.ebitda<0?BAD:GOOD}">${money(f.ebitda)}</span>`,`<span style="color:${d.ebitda<0?BAD:GOOD}">${money(d.ebitda)}</span>`,`<span style="color:${g.ebitda<0?BAD:GOOD}">${money(g.ebitda)}</span>`],
      ['Resultado Líquido',`<span style="color:${f.result_liq<0?BAD:GOOD}">${money(f.result_liq)}</span>`,`<span style="color:${d.result_liq<0?BAD:GOOD}">${money(d.result_liq)}</span>`,`<span style="color:${g.result_liq<0?BAD:GOOD}">${money(g.result_liq)}</span>`],
    ],['left','right','right','right'],null,ins('dreFabricaLoja','dre-fabrica-loja'));
    s+=fig(line([['Receita Líq. Fábrica',FL.rl_f,SER[0]],['Receita Líq. Loja',FL.rl_d,SER[1]]],
      FL.yms.map(ymLab),{valfmt:v=>mi(v,1),w:980,h:280}),ins('dreCustoFixoRol','dre-cf-rol'));
  }
  return s;
}

function _dreSnap(S){
  const cols=[ymLab(S.ym),ymLab(S.prev),'YTD '+S.ano,'YTD '+(S.ano-1)];
  const headers=['Linha',cols[0],cols[1],'Var. mês',cols[2],cols[3],'Var. YTD'];
  const cel=v=>v<0?`<span style="color:${BAD}">${money(v)}</span>`:money(v);
  const rows=S.linhas.map(l=>{ const st=l[1]==='t'?'font-weight:700':(l[1]==='h'?'font-weight:600':''), v=l[2];
    return [`<span style="${st}">${esc(l[0])}</span>`,cel(v[0]),cel(v[1]),_dreVar(v[0],v[1]),cel(v[2]),cel(v[3]),_dreVar(v[2],v[3])]; });
  return H3('Demonstração de resultado — comparativo',S.nome,'dre-snap')
    +table(headers,rows,['left','right','right','right','right','right','right'],null,ins('dreComparativoMotor','dre-comparativo-motor'))
    +cap('A variação mostra quanto a própria linha mudou. A <b>cor</b> segue o efeito no resultado, não o sinal do número: '
      +'verde quando melhorou, vermelho quando piorou. Numa linha de custo isso se inverte — deduções caindo aparecem em '
      +'verde com percentual negativo. Onde o valor trocou de sinal entre os dois períodos, a variação percentual não é '
      +'comparável e sai como “—”.');
}

DESENHO.dre=function(P){
  const A=P['dre.abertura'];
  let s='';
  if(A){
    const opts=ymList(A.minym,A.maxym).map(y=>`<option value="${y}">${ymLab(y)}</option>`).join('');
    const presets=A.presets.map(p=>[p[0]===null?A.ano+' ('+ytdLab(A.maxym)+')':p[0],p[1],p[2]]);
    s+=`<div class="sec-head"><div class="kick">Resultado · DRE</div><h2>DRE — indicadores e resultado</h2>
      <p class="lead">Demonstração de resultado por entidade — Consolidado, Fábrica e Loja — com filtros de período, no espírito da apresentação de resultados. Receita, margens, EBITDA e resultado a partir do Painel de Resultado (abas REAL). Percentuais sobre a Receita Operacional Líquida (ROL).</p></div>`
     +`<div class="filterbar dre-fb">
   <div class="fb-ent"><span class="fb-t">Entidade:</span>
     <button class="entb" data-e="CONSOLIDADO">Consolidado</button>
     <button class="entb" data-e="FABRICA">Fábrica</button>
     <button class="entb" data-e="DESIGN">Loja</button></div>
   <div class="fb-presets">`+presets.map(p=>`<button class="dpreset" data-a="${p[1]}" data-b="${p[2]}">${esc(p[0])}</button>`).join('')+`</div>
   <div class="fb-custom">De <select id="d-de">${opts}</select> até <select id="d-ate">${opts}</select><button id="d-apply">Aplicar</button></div>
   <div id="dre-label" class="fb-label">Período: ${_drePeriodo(A,A.a,A.b)}</div></div>`;
  }
  s+='<div id="dre-body">'+_dreCorpo(P)+'</div>';
  const S=P['dre-snap'];
  if(S){
    s+=`<div class="sec-head" style="margin-top:10px"><div class="kick">DRE · dashboard mensal</div><h2>DRE — Comparativo mensal</h2>
        <p class="lead">Mês selecionado × mês anterior × acumulado do ano (YTD) × mesmo acumulado do ano anterior.</p></div>
      <div class="filterbar"><div class="fb-custom">
        <span class="fb-t">Empresa:</span> <select id="dresnap-emp"><option value="CONSOLIDADO">Consolidado</option><option value="FABRICA">Fábrica</option><option value="DESIGN">Loja</option></select>
        <span class="fb-t">Mês:</span> <select id="dresnap-mes">${S.meses.map(y=>`<option value="${y}">${ymLab(y)}</option>`).join('')}</select></div></div>
      <div id="dresnap-body">${_dreSnap(S)}</div>`;
  }
  return s;
};

DESENHO_POS.dre=function(sec,ctx){
  const A=ctx.payload['dre.abertura'], S=ctx.payload['dre-snap'];
  const f={ent:A?A.ent:'CONSOLIDADO', de:A?A.a:null, ate:A?A.b:null, emp:S?S.emp:'CONSOLIDADO', ym:S?S.ym:null};
  const marca=()=>{
    sec.querySelectorAll('.entb').forEach(e=>e.classList.toggle('on',e.dataset.e===f.ent));
    sec.querySelectorAll('.dpreset').forEach(e=>e.classList.toggle('on',+e.dataset.a===f.de&&+e.dataset.b===f.ate));
  };
  const params=()=>{ const p={}; Object.keys(f).forEach(k=>{ if(f[k]!=null) p[k]=f[k]; }); return p; };
  async function corpo(){
    const P=await ctx.buscar(params());
    document.getElementById('dre-body').innerHTML=_dreCorpo(P);
    const lb=document.getElementById('dre-label'); if(lb&&A) lb.textContent='Período: '+_drePeriodo(A,f.de,f.ate);
    marca(); ctx.remarcar();
  }
  if(A){
    const de=document.getElementById('d-de'), ate=document.getElementById('d-ate');
    sec.querySelectorAll('.entb').forEach(e=>e.addEventListener('click',()=>{f.ent=e.dataset.e; corpo();}));
    sec.querySelectorAll('.dpreset').forEach(e=>e.addEventListener('click',()=>{f.de=+e.dataset.a; f.ate=+e.dataset.b;
      de.value=Math.max(A.minym,f.de===200001?A.minym:f.de); ate.value=Math.min(A.maxym,f.ate===300000?A.maxym:f.ate); corpo();}));
    document.getElementById('d-apply').addEventListener('click',()=>{let a=+de.value,b=+ate.value; if(a>b){const t=a;a=b;b=t;} f.de=a; f.ate=b; corpo();});
    de.value=f.de; ate.value=f.ate;
    marca();
  }
  if(S){
    const selEmp=document.getElementById('dresnap-emp'), selMes=document.getElementById('dresnap-mes');
    selEmp.value=f.emp; selMes.value=f.ym;
    const snap=async()=>{ const P=await ctx.buscar(params()); if(P['dre-snap']){ document.getElementById('dresnap-body').innerHTML=_dreSnap(P['dre-snap']); ctx.remarcar(); } };
    selEmp.addEventListener('change',()=>{f.emp=selEmp.value; snap();});
    selMes.addEventListener('change',()=>{f.ym=+selMes.value; snap();});
  }
};
