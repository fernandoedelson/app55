/* Mapa de vendas — receita bruta por UF do cliente (aba MPP DB do Painel) e, como camada, os escritórios de arquitetura das carteiras.
   Vendas: o servidor manda as linhas [aaaamm, UF, pedido, cliente, produto, peças, receita bruta]; o período, a soma por UF, o top 10 e a
   abertura dos pedidos são feitos aqui. Arquitetos: o servidor manda os escritórios já localizados por cidade (só nome, vendedor e cidade);
   cada cidade vira um ponto e clicar nele lista os escritórios. O desenho do Brasil vem de mapa_br.js (divisas do IBGE, sem internet).
   Clicar numa bolha, num estado ou numa linha do top 10 abre os pedidos da UF; clicar no pedido abre, logo abaixo, os produtos.
   Parte relacionada (PR) aparece no nome do cliente. */
'use strict';
window.DESENHO=window.DESENHO||{};
window.DESENHO_POS=window.DESENHO_POS||{};
(function(){
const UFN={AC:'Acre',AL:'Alagoas',AP:'Amapá',AM:'Amazonas',BA:'Bahia',CE:'Ceará',DF:'Distrito Federal',ES:'Espírito Santo',GO:'Goiás',MA:'Maranhão',
  MT:'Mato Grosso',MS:'Mato Grosso do Sul',MG:'Minas Gerais',PA:'Pará',PB:'Paraíba',PR:'Paraná',PE:'Pernambuco',PI:'Piauí',RJ:'Rio de Janeiro',
  RN:'Rio Grande do Norte',RS:'Rio Grande do Sul',RO:'Rondônia',RR:'Roraima',SC:'Santa Catarina',SP:'São Paulo',SE:'Sergipe',TO:'Tocantins',
  EX:'Exterior',ND:'Sem UF no cadastro'};
const MEDIDAS={rob:{rot:'Receita bruta',curto:'receita bruta'},q:{rot:'Peças',curto:'peças'},ped:{rot:'Pedidos',curto:'pedidos'}};
const IQ=5, IR=6;                                   // posições de peças e receita bruta em cada linha
const COR_ARQ='#27455c';                            // escritórios de arquitetura: azul, para não se confundir com as bolhas de venda
const bonito=s=>String(s||'').toLowerCase().replace(/(^|\s)\S/g,c=>c.toUpperCase());

(function estilo(){
  if(document.getElementById('mp-estilo')) return;
  const st=document.createElement('style'); st.id='mp-estilo';
  st.textContent='.mp-grid{display:grid;grid-template-columns:minmax(0,1.12fr) minmax(0,1fr);gap:24px;align-items:stretch;margin:6px 0 4px}'
   +'.mp-card{background:var(--surface);border:1px solid var(--border);border-radius:3px;padding:16px 18px;display:flex;flex-direction:column;min-width:0}'
   +'.mp-card .mp-k{font-size:10.5px;letter-spacing:.22em;text-transform:uppercase;color:var(--blue);font-weight:600;margin-bottom:8px}'
   +'.mp-svg{width:100%;height:auto;display:block}'
   +'.mp-uf{fill:#e9e1d2;stroke:#c4b8a5;stroke-width:.55;stroke-linejoin:round;cursor:pointer}.mp-uf:hover{fill:#e0d5c2}'
   +'.mp-uf.sel{fill:#dccfba}'
   +'.mp-bol{fill:#92705d;fill-opacity:.58;stroke:#614b3e;stroke-width:1.2;cursor:pointer}.mp-bol:hover{fill-opacity:.75}.mp-bol.sel{stroke:var(--ink);stroke-width:3}'
   +'.mp-bol.fundo{fill-opacity:.32}'
   +'.mp-arq{fill:'+COR_ARQ+';fill-opacity:.78;stroke:#fff;stroke-width:1;cursor:pointer}.mp-arq:hover{fill-opacity:1}.mp-arq.sel{stroke:var(--ink);stroke-width:2.5}'
   +'.mp-top table{width:100%}.mp-top tr[data-uf],.mp-top tr[data-cid]{cursor:pointer}.mp-top tr[data-uf]:hover td,.mp-top tr[data-cid]:hover td{background:var(--cream)}'
   +'.mp-top tr.sel td{background:var(--cream)}'
   +'.mp-rod{margin-top:auto;padding-top:14px;font-size:12.5px;line-height:1.5;color:var(--muted)}'
   +'.mp-fora{color:var(--ink);text-decoration:underline dotted}'
   +'.mp-leg{display:flex;gap:16px;flex-wrap:wrap;font-size:12px;color:var(--ink2);margin-top:8px}.mp-leg i{display:inline-block;width:11px;height:11px;border-radius:50%;margin-right:5px;vertical-align:-1px}'
   +'.mp-bar{display:flex;flex-wrap:wrap;gap:8px 14px;align-items:center}'
   +'@media(max-width:900px){.mp-grid{grid-template-columns:1fr}}';
  document.head.appendChild(st);
})();

const mesesDe=rows=>[...new Set(rows.map(r=>r[0]))].sort((a,b)=>a-b);

DESENHO.mapa=function(P){
  const A=P['mapa.abertura'], K=P['mapa-uf'];
  let s='<div class="sec-head"><div class="kick">Comercial · receita bruta por estado do cliente</div><h2>Mapa de vendas</h2>'
    +'<p class="lead" id="mp-lead">'+(K&&!K.ausente?'Onde estão as vendas: a receita bruta faturada por UF do cliente, lida da aba MPP DB do Painel de Resultado.':'')+'</p></div>';
  if(!K||K.ausente||!K.rows||!K.rows.length)
    return s+call('Mapa de vendas não disponível nesta competência: ele sai da aba MPP DB do Painel de Resultado. Processe a competência de novo para gerar.','warn');
  if(!window.MAPA_BR) return s+call('O desenho do mapa (mapa_br.js) não foi carregado.','warn');
  s+=H3('Onde estão as vendas','receita bruta por UF do cliente','mapa-uf');
  const yms=mesesDe(K.rows), opt=(sel)=>yms.map(y=>`<option value="${y}"${y===sel?' selected':''}>${esc(ymLab(y))}</option>`).join('');
  const ate=yms[yms.length-1], de=Math.max(yms[0],Math.floor(ate/100)*100+1);
  const vends=K.arq?[...new Set(K.arq.escritorios.map(e=>e[1]))].sort():[];
  s+='<div class="filterbar"><div class="fb-custom mp-bar">'
    +(K.arq?'<span class="fb-t">Mostrar</span> <select id="mp-cam"><option value="vendas">Vendas por UF</option><option value="ambas">Vendas + arquitetos</option>'
      +'<option value="arq">Arquitetos (escritórios)</option></select> <span class="fb-t">Vendedor</span> <select id="mp-vend"><option value="">Todos</option>'
      +vends.map(v=>`<option value="${esc(v)}">${esc(bonito(v))}</option>`).join('')+'</select> ':'')
    +'<span class="fb-t">De</span> <select id="mp-de">'+opt(de)+'</select> '
    +'<span class="fb-t">até</span> <select id="mp-ate">'+opt(ate)+'</select> '
    +'<span class="fb-t">Medida</span> <select id="mp-med">'+Object.keys(MEDIDAS).map(k=>`<option value="${k}">${MEDIDAS[k].rot}</option>`).join('')+'</select> '
    +'<button type="button" class="preset" data-p="ano">Ano até aqui</button><button type="button" class="preset" data-p="12m">Últimos 12 meses</button>'
    +'<button type="button" class="preset" data-p="tudo">Tudo</button></div></div>';
  s+='<div id="mp-corpo"></div><div id="mp-det"></div>';
  return s;
};

DESENHO_POS.mapa=function(sec,ctx){
  const K=ctx.payload['mapa-uf']; if(!K||K.ausente||!K.rows||!K.rows.length||!window.MAPA_BR) return;
  window.PARTES_RELACIONADAS=K.pr_padroes||[];
  const rows=K.rows, yms=mesesDe(rows), corpo=document.getElementById('mp-corpo'), det=document.getElementById('mp-det');
  const selDe=document.getElementById('mp-de'), selAte=document.getElementById('mp-ate'), selMed=document.getElementById('mp-med');
  const selCam=document.getElementById('mp-cam'), selVend=document.getElementById('mp-vend');
  const ARQ=K.arq||null;
  let ufSel=null, cidSel=null;

  const periodo=()=>{ let a=+selDe.value, b=+selAte.value; if(a>b){ const t=a; a=b; b=t; } return [a,b]; };
  const rotPeriodo=(a,b)=>a===b?ymLab(a):ymLab(a)+' a '+ymLab(b);
  const modo=()=>selCam?selCam.value:'vendas';
  function agrega(a,b){
    const m={}; rows.forEach(r=>{ if(r[0]<a||r[0]>b) return;
      const o=m[r[1]]||(m[r[1]]={rob:0,q:0,ped:new Set()}); o.rob+=r[IR]; o.q+=r[IQ]; o.ped.add(r[2]); });
    return Object.keys(m).map(uf=>({uf:uf,rob:m[uf].rob,q:m[uf].q,ped:m[uf].ped.size}));
  }
  const valor=(o,med)=>med==='ped'?o.ped:o[med];
  const fmt=(v,med)=>med==='rob'?money(v):nf(v,0);

  /* escritórios por cidade (filtrados pelo vendedor): só o que está localizado vira ponto */
  function cidadesArq(){
    if(!ARQ) return {pts:[],semCidade:0,total:0};
    const v=selVend?selVend.value:'', por={}; let sem=0, tot=0;
    ARQ.escritorios.forEach(e=>{ if(v&&e[1]!==v) return; tot++;
      if(!e[2]){ sem++; return; } (por[e[2]]||(por[e[2]]=[])).push(e); });
    const pts=Object.keys(por).map(id=>({id:id,nome:ARQ.cidades[id][0],uf:ARQ.cidades[id][1],lat:ARQ.cidades[id][2],lon:ARQ.cidades[id][3],n:por[id].length,esc:por[id]}))
      .sort((x,y)=>y.n-x.n);
    return {pts:pts,semCidade:sem,total:tot};
  }

  function desenhaCorpo(){
    const m=modo(), [a,b]=periodo(), med=selMed.value, mp=window.MAPA_BR;
    const comVendas=m!=='arq', comArq=m!=='vendas'&&!!ARQ;
    [selDe,selAte,selMed].forEach(el=>{ el.disabled=!comVendas; });
    sec.querySelectorAll('.preset[data-p]').forEach(bt=>{ bt.disabled=!comVendas; });
    if(selVend) selVend.disabled=!comArq;
    const dados=agrega(a,b).filter(o=>valor(o,med)>0), vmax=Math.max(...dados.map(o=>valor(o,med)),1);
    const total={rob:0,q:0}, pedTodos=new Set();
    rows.forEach(r=>{ if(r[0]>=a&&r[0]<=b){ total.rob+=r[IR]; total.q+=r[IQ]; pedTodos.add(r[2]); } });
    dados.sort((x,y)=>valor(y,med)-valor(x,med));
    const arq=cidadesArq(), nmax=Math.max(...arq.pts.map(p=>p.n),1);
    const X=lon=>(lon-mp.proj[0])/(mp.proj[1]-mp.proj[0])*mp.w, Y=lat=>(mp.proj[3]-lat)/(mp.proj[3]-mp.proj[2])*mp.h;

    let bolhas='', rot='';
    if(comVendas) dados.forEach(o=>{ const c=mp.centros[o.uf]; if(!c) return;
      const r=5+46*Math.sqrt(valor(o,med)/vmax);
      bolhas+=`<circle class="mp-bol${o.uf===ufSel?' sel':''}${comArq?' fundo':''}" data-uf="${o.uf}" cx="${c[0]}" cy="${c[1]}" r="${r.toFixed(1)}"><title>${esc(UFN[o.uf]||o.uf)} · ${esc(fmt(valor(o,med),med))}</title></circle>`;
      if(!comArq) rot+=r>14?`<text x="${c[0]}" y="${c[1]+4}" text-anchor="middle" font-size="11" font-weight="700" fill="#fff" pointer-events="none">${o.uf}</text>`
               :`<text x="${c[0]+(o.uf==='GO'?-r-3:r+3)}" y="${c[1]+3}" ${o.uf==='GO'?'text-anchor="end" ':''}font-size="10" font-weight="600" fill="${INK}" pointer-events="none">${o.uf}</text>`; });
    let pontos='';
    if(comArq){ arq.pts.slice().reverse().forEach(p=>{ const r=3+11*Math.sqrt(p.n/nmax);          // os maiores por baixo, os pequenos clicáveis por cima
        pontos+=`<circle class="mp-arq${p.id===cidSel?' sel':''}" data-cid="${esc(p.id)}" cx="${X(p.lon).toFixed(1)}" cy="${Y(p.lat).toFixed(1)}" r="${r.toFixed(1)}"><title>${esc(p.nome)}/${p.uf} · ${nf(p.n)} escritório${p.n>1?'s':''}</title></circle>`; });
      /* rótulo das maiores cidades, sem pôr um em cima do outro: o que colidiria com um já posto fica sem nome (o título do ponto continua) */
      const caixas=[];
      arq.pts.slice(0,m==='arq'?14:6).forEach(p=>{ const x=X(p.lon)+3+11*Math.sqrt(p.n/nmax)+3, y=Y(p.lat)+3, w=p.nome.length*6.8+6;
        if(caixas.some(c=>x<c[0]+c[2]&&x+w>c[0]&&Math.abs(y-c[1])<12)) return; caixas.push([x,y,w]);
        rot+=`<text x="${x.toFixed(1)}" y="${y.toFixed(1)}" font-size="10" font-weight="600" fill="${COR_ARQ}" pointer-events="none">${esc(p.nome)}</text>`; }); }
    const ufs=Object.keys(mp.ufs).map(u=>`<path class="mp-uf${u===ufSel?' sel':''}" data-uf="${u}" d="${mp.ufs[u]}"><title>${esc(UFN[u]||u)}</title></path>`).join('');
    const svg=`<svg class="mp-svg" viewBox="0 0 ${mp.w} ${mp.h}"><path d="${mp.vizinhos}" fill="#f1ece1" stroke="#dcd3c2" stroke-width=".7"/>${ufs}${bolhas}${pontos}${rot}</svg>`;
    const leg='<div class="mp-leg">'+(comVendas?'<span><i style="background:#92705d;opacity:.6"></i>Vendas ('+MEDIDAS[med].curto+') por UF</span>':'')
      +(comArq?'<span><i style="background:'+COR_ARQ+'"></i>Escritórios de arquitetura por cidade</span>':'')+'</div>';
    const rod1=(comVendas?'Bolha de venda = '+MEDIDAS[med].curto+' · posição = centro do estado. ':'')+(comArq?'Ponto azul = escritórios das carteiras dos vendedores, por cidade (o período não se aplica). ':'')
      +'Clique numa bolha, num ponto, num estado ou numa linha do top 10 para ver a lista. Divisas: IBGE.';

    let cardTop='';
    if(m==='arq'){
      const top=arq.pts.slice(0,10), vt=arq.pts.reduce((x,p)=>x+p.n,0);
      const linhas=top.map((p,i)=>`<tr data-cid="${esc(p.id)}"${p.id===cidSel?' class="sel"':''}><td class="left muted">${i+1}</td><td class="left"><b>${esc(p.nome)}</b> <span class="muted">${p.uf}</span></td>`
        +`<td class="right">${nf(p.n)}</td><td class="right">${pct(vt?p.n/vt:0,0)}</td></tr>`).join('');
      cardTop='<div class="mp-card mp-top"><div class="mp-k">Top 10 cidades · escritórios</div><div class="tw"><table class="dt"><thead><tr><th class="left">#</th><th class="left">Cidade</th><th class="right">Escritórios</th><th class="right">%</th></tr></thead><tbody>'+linhas+'</tbody></table></div>'
        +(arq.semCidade?'<div class="mp-k" style="margin-top:18px">Fora do mapa</div><div style="font-size:13.5px">'+nf(arq.semCidade)+' escritório'+(arq.semCidade>1?'s':'')+' sem cidade válida no cadastro.</div><div class="muted" style="font-size:12px;margin-top:2px">Cidade vazia, só a sigla do estado, ou nome que não existe naquela UF. Em geral são nomes da Carteira B, ainda sem endereço.</div>':'')
        +'<div class="mp-rod">'+nf(arq.total)+' escritórios'+(selVend&&selVend.value?' de '+esc(bonito(selVend.value)):' nas carteiras')+' · '+nf(arq.pts.length)+' cidades localizadas · fonte: '+esc((ARQ.fonte||[]).length)+' arquivo'+((ARQ.fonte||[]).length>1?'s':'')+' de carteira.</div></div>';
    } else {
      const top=dados.slice(0,10), vt=dados.reduce((x,o)=>x+valor(o,med),0);
      const linhas=top.map((o,i)=>`<tr data-uf="${o.uf}"${o.uf===ufSel?' class="sel"':''}><td class="left muted">${i+1}</td><td class="left"><b>${o.uf}</b> <span class="muted">${esc(UFN[o.uf]||'')}</span></td>`
        +`<td class="right">${fmt(valor(o,med),med)}</td><td class="right">${pct(vt?valor(o,med)/vt:0,0)}</td></tr>`).join('');
      const semMapa=dados.filter(o=>!mp.centros[o.uf]);
      const nota=semMapa.length?'<div class="mp-k" style="margin-top:18px">Fora do mapa</div><div style="font-size:13.5px">'+semMapa.map(o=>`<a href="#" class="mp-fora" data-uf="${o.uf}"><b>${o.uf}</b> ${esc(UFN[o.uf]||'')}</a> · ${esc(fmt(valor(o,med),med))}`).join('<br>')
        +'</div><div class="muted" style="font-size:12px;margin-top:2px">O cadastro não traz o país nem a cidade: essas linhas ficam no top 10 e na lista de pedidos, mas não viram bolha.</div>':'';
      cardTop='<div class="mp-card mp-top"><div class="mp-k">Top 10 UF · '+MEDIDAS[med].curto+'</div><div class="tw"><table class="dt"><thead><tr><th class="left">#</th><th class="left">UF</th><th class="right">'+MEDIDAS[med].rot+'</th><th class="right">%</th></tr></thead><tbody>'+linhas
        +'</tbody></table></div>'+nota+'<div class="mp-rod">'+esc(rotPeriodo(a,b))+' · total: <b>'+money(total.rob)+'</b> · '+nf(total.q,0)+' peças · '+nf(pedTodos.size)+' pedidos.'
        +(comArq?' Escritórios nas carteiras: <b>'+nf(arq.total)+'</b> em '+nf(arq.pts.length)+' cidades.':'')+'</div></div>';
    }
    corpo.innerHTML='<div class="mp-grid"><div class="mp-card"><div class="mp-k">Mapa · '+(m==='arq'?'arquitetos':m==='ambas'?'vendas e arquitetos':MEDIDAS[med].curto)+'</div>'+svg+leg
      +'<div class="mp-rod">'+rod1+'</div></div>'+cardTop+'</div>';
    const lead=document.getElementById('mp-lead');
    if(lead) lead.textContent=m==='arq'?'Onde estão os escritórios de arquitetura das carteiras dos vendedores, por cidade.'
      :'Receita bruta faturada por UF do cliente · '+rotPeriodo(a,b)+' · fonte: aba MPP DB do Painel de Resultado.';
    const th=document.querySelector('[data-blk="mapa-uf"] .tag');
    if(th) th.textContent=m==='arq'?'escritórios das carteiras por cidade':MEDIDAS[med].curto+' por UF do cliente · '+rotPeriodo(a,b);
    corpo.querySelectorAll('[data-uf]').forEach(el=>el.addEventListener('click',ev=>{ ev.preventDefault(); abre(el.getAttribute('data-uf')); }));
    corpo.querySelectorAll('[data-cid]').forEach(el=>el.addEventListener('click',ev=>{ ev.preventDefault(); abreCidade(el.getAttribute('data-cid')); }));
    ctx.marcar();
  }

  /* os escritórios de uma cidade: nome e vendedor da carteira */
  function abreCidade(id){
    if(cidSel===id){ cidSel=null; det.innerHTML=''; desenhaCorpo(); return; }
    cidSel=id; ufSel=null; desenhaCorpo();
    const c=cidadesArq().pts.find(p=>p.id===id); if(!c){ det.innerHTML=''; return; }
    const lista=c.esc.slice().sort((x,y)=>x[0].localeCompare(y[0],'pt-BR')), CAP=300;
    const trs=lista.slice(0,CAP).map(e=>`<tr><td class="left">${esc(e[0])}</td><td class="left">${esc(bonito(e[1]))}</td></tr>`).join('');
    det.innerHTML=H3('Escritórios — '+c.nome+'/'+c.uf, nf(c.esc.length)+' escritório'+(c.esc.length>1?'s':''))
      +`<div class="tw"><table class="dt"><thead><tr><th class="left">Escritório</th><th class="left">Vendedor(a) da carteira</th></tr></thead><tbody>${trs}</tbody></table></div>`
      +cap('Lista das carteiras dos vendedores. Um escritório que está em mais de uma carteira aparece uma vez por vendedor.'+(lista.length>CAP?' Mostrando '+CAP+' de '+nf(lista.length)+'.':''));
    ctx.marcar(); det.scrollIntoView({behavior:'smooth',block:'nearest'});
  }

  /* os pedidos da UF no período: cada pedido com o cliente (e PR) ao lado; clicar abre os produtos logo abaixo */
  function abre(uf){
    if(ufSel===uf){ ufSel=null; det.innerHTML=''; desenhaCorpo(); return; }
    ufSel=uf; cidSel=null; desenhaCorpo();
    const [a,b]=periodo(), pm={};
    rows.forEach(r=>{ if(r[1]!==uf||r[0]<a||r[0]>b) return; const k=r[2]+'|'+r[3];
      const o=pm[k]||(pm[k]={ped:r[2],cliente:r[3],q:0,rob:0,yms:new Set(),itens:{}}); o.q+=r[IQ]; o.rob+=r[IR]; o.yms.add(r[0]);
      const it=o.itens[r[4]]||(o.itens[r[4]]=[0,0]); it[0]+=r[IQ]; it[1]+=r[IR]; });
    const peds=Object.keys(pm).map(k=>pm[k]).sort((x,y)=>y.rob-x.rob), tv=peds.reduce((x,p)=>x+p.rob,0), tq=peds.reduce((x,p)=>x+p.q,0), CAP=300;
    const mesesDoPedido=p=>{ const m=[...p.yms].sort((x,y)=>x-y); return m.length===1?ymLab(m[0]):ymLab(m[0])+' a '+ymLab(m[m.length-1]); };
    let acc=0;
    const trs=peds.slice(0,CAP).map((p,i)=>{ acc+=p.rob;
      return `<tr class="mp-ped" data-i="${i}" style="cursor:pointer"><td class="left"><span class="cdm-sin">▸</span> ${esc(p.ped||'—')}</td><td class="left">${esc(trunc(p.cliente,38))}${prTag(p.cliente)}</td>`
        +`<td class="right">${esc(mesesDoPedido(p))}</td><td class="right">${nf(p.q,0)}</td><td class="right">${money(p.rob)}</td><td class="right">${pct(tv?p.rob/tv:0,1)}</td><td class="right">${pct(tv?acc/tv:0,1)}</td></tr>`; }).join('');
    det.innerHTML=H3('Pedidos — '+(UFN[uf]||uf)+' ('+uf+')', nf(tq,0)+' peças · '+mi(tv,1)+' · '+nf(peds.length)+' pedidos · '+rotPeriodo(a,b))
      +`<div class="tw"><table class="dt"><thead><tr><th class="left">Pedido</th><th class="left">Cliente</th><th class="right">Faturado em</th><th class="right">Peças</th>`
      +`<th class="right">Receita bruta</th><th class="right">% da UF</th><th class="right">% acumulada</th></tr></thead><tbody>${trs}</tbody></table></div>`
      +prLegenda()+cap('Clique num pedido para abrir, logo abaixo dele, os produtos faturados.'+(peds.length>CAP?' Mostrando os '+CAP+' maiores de '+nf(peds.length)+' pedidos.':''));
    det.querySelectorAll('.mp-ped').forEach(tr=>tr.addEventListener('click',()=>{
      const p=peds[+tr.dataset.i], prox=tr.nextElementSibling, sin=tr.querySelector('.cdm-sin');
      if(prox&&prox.classList.contains('cdm-itens')){ prox.remove(); tr.classList.remove('sel'); sin.textContent='▸'; return; }
      const d=document.createElement('tr'); d.className='cdm-itens';
      const its=Object.keys(p.itens).map(n=>[n,p.itens[n][0],p.itens[n][1]]).sort((x,y)=>y[2]-x[2]);
      d.innerHTML='<td colspan="7">'+table(['Produto','Peças','Receita bruta'],its.map(l=>[esc(l[0]),nf(l[1],0),money(l[2])]),['left','right','right'])+'</td>';
      tr.after(d); tr.classList.add('sel'); sin.textContent='▾'; ctx.marcar(); }));
    ctx.marcar();
    det.scrollIntoView({behavior:'smooth',block:'nearest'});
  }

  function preset(p){
    const fim=yms[yms.length-1];
    if(p==='ano'){ selDe.value=String(Math.max(yms[0],Math.floor(fim/100)*100+1)); selAte.value=String(fim); }
    else if(p==='12m'){ const i=Math.max(0,yms.length-12); selDe.value=String(yms[i]); selAte.value=String(fim); }
    else { selDe.value=String(yms[0]); selAte.value=String(fim); }
  }
  const refaz=()=>{ det.innerHTML=''; ufSel=null; cidSel=null; desenhaCorpo(); };
  [selDe,selAte,selMed,selCam,selVend].forEach(el=>{ if(el) el.addEventListener('change',refaz); });
  sec.querySelectorAll('.preset[data-p]').forEach(bt=>bt.addEventListener('click',()=>{ preset(bt.dataset.p); refaz(); }));
  desenhaCorpo();
};
})();
