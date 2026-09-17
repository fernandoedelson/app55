/* ===== +55 · régua de destaques (runtime) =====
   GERADO por ferramentas/extrair_desenho.py a partir do insights.js do Kit na tag gabarito-v1.
   Só apresentação: quem decide se o destaque existe, com que número e para qual perfil
   é o servidor (app/destaques). Os textos são montados em destaques_texto.js.
   ====================================================================== */
'use strict';
(function(G){

const FAM={
  decomposicao:'Decomposição',
  divergencia:'Divergência',
  concentracao:'Concentração',
  padrao:'Quebra de padrão',
  consequencia:'Consequência',
  oculto:'O que o gráfico esconde',
};

const un=n=>nf(Math.round(n))+(Math.round(n)===1?' peça':' peças');

const plural=(n,s,p)=>Math.round(n)===1?s:p;

/* Artigo do escopo no plural. A lista e curta e explicita porque a terminacao nao
   resolve: 'unidades' e feminino e 'meses' e masculino, ambos terminam em 'es'.
   Escopo novo que nao esteja aqui cai no masculino, que e o caso da maioria. */
const ESCOPO_FEM=/^(categorias|faixas|linhas|unidades|contas|empresas|lojas|marcas|pecas|peças)\b/i;

const artPl=(esc0,m,f)=>ESCOPO_FEM.test(String(esc0||''))?f:m;

/* =====================================================================
   RUNTIME — botão discreto por figura + digest da seção
   ===================================================================== */
/* Sem teto: a regra do relatório é que todo gráfico e todo quadro tenham
   análise. A régua fechada é um botão de 30px, então cobertura total não
   adensa a página; o digest continua mostrando só os 3 mais fortes. */
const TETO_SECAO=Infinity;

function aplicaOverride(o){
  const M=G.DESTAQUES_MANUAIS||{}; const m=M[o.id]; if(!m) return o;
  if(m.oculto) return null;
  return Object.assign({},o,{verdict:m.verdict||o.verdict, texto:m.texto||o.texto, manual:true});
}

/* HTML da régua. FECHADA é só um botão — nenhum texto, nada do conteúdo.
   É o que permite abrir um a um durante a apresentação. */
function strip(o){
  if(!o) return '';
  o=aplicaOverride(o); if(!o) return '';
  const ev=(o.ev||[]).map(e=>`<div><span>${esc(e[0])}</span><strong>${e[1]}</strong></div>`).join('');
  const anchor=o.anchor?` data-anchor="${esc((o.anchor.labels||[]).join('|'))}"`:'';
  const tab=o.tabela?' data-tabela="1"':'';
  const lei=o._leitura?` data-leitura="${esc(o._leitura)}"`:'';
  return `<div class="hl${o.tom?' t-'+o.tom:''}" data-ins="${esc(o.id)}" data-score="${(o.score||0).toFixed(3)}"${anchor}${tab}${lei}>
  <button class="hl-bar" type="button" aria-expanded="false" aria-label="Ver a análise" title="Ver a análise"><span class="hl-mark">◆</span></button>
  <div class="hl-body">
    <div class="hl-fam">${esc(FAM[o.fam]||o.fam)}</div>
    <p class="hl-verdict">${o.verdict}</p>
    <p>${o.texto}</p>
    ${ev?`<div class="hl-ev">${ev}</div>`:''}
    <p class="hl-trg">Gatilho: ${esc(o.trigger||'—')}${o.manual?' · texto editado no config':''}<br><span class="hl-id" title="Use este identificador em destaques_manuais, no config_apresentacao.json">id: <code>${esc(o.id)}</code></span></p>
  </div>
</div>`;
}

/* ---------- âncora: acende no gráfico o que a frase afirma ---------- */
function casaRotulo(titulo,labels){
  const toks=String(titulo||'').split(/[·:]/).map(x=>x.trim().toUpperCase()).filter(Boolean);
  return labels.some(l=>l&&toks.includes(String(l).trim().toUpperCase()));
}

function acende(hl,ligar){
  /* A régua de um quadro não tem SVG próprio. Quando cita rótulos que o gráfico
     logo acima mostra, acende aquele gráfico. */
  let svg=null;
  const fig=hl.closest('.fig');
  if(fig) svg=fig.querySelector('svg');
  if(!svg){
    const sec=hl.closest('section');
    if(sec){ const figs=[...sec.querySelectorAll('.fig')];
      const y=hl.getBoundingClientRect().top;
      const acima=figs.filter(f=>f.getBoundingClientRect().top<y);
      const alvo=acima.length?acima[acima.length-1]:figs[0];
      if(alvo) svg=alvo.querySelector('svg'); }
  }
  if(!svg) return;
  svg.querySelectorAll('.ins-ring').forEach(e=>e.remove());
  svg.classList.remove('ins-dim');
  svg.querySelectorAll('.ins-on').forEach(e=>e.classList.remove('ins-on'));
  if(!ligar) return;
  const labels=(hl.dataset.anchor||'').split('|').filter(Boolean); if(!labels.length) return;
  const alvos=[];
  svg.querySelectorAll('rect,circle,path,polygon').forEach(el=>{
    const t=el.querySelector('title'); if(!t) return;
    if(casaRotulo(t.textContent,labels)) alvos.push(el);
  });
  if(!alvos.length) return;
  svg.classList.add('ins-dim');
  const ns='http://www.w3.org/2000/svg';
  const g=document.createElementNS(ns,'g'); g.setAttribute('class','ins-ring');
  const comAnel=alvos.length<=4;   // um anel marca um ponto; numa faixa vira ruído
  let ok=false;
  alvos.forEach(el=>{
    el.classList.add('ins-on');
    if(!comAnel) return;
    let b; try{ b=el.getBBox(); }catch(e){ return; }
    if(!b||!isFinite(b.width)) return;
    const pad=Math.max(3,Math.min(7,b.width*.12));
    const r=document.createElementNS(ns,'rect');
    r.setAttribute('x',(b.x-pad).toFixed(2)); r.setAttribute('y',(b.y-pad).toFixed(2));
    r.setAttribute('width',(b.width+pad*2).toFixed(2)); r.setAttribute('height',(b.height+pad*2).toFixed(2));
    r.setAttribute('rx','3'); r.setAttribute('fill','none');
    r.setAttribute('stroke','#92705d'); r.setAttribute('stroke-width','1.5');
    r.setAttribute('stroke-dasharray','3 3');
    g.appendChild(r); ok=true;
  });
  if(ok) svg.appendChild(g);
}

function abre(hl,estado){
  const on=estado===undefined?!hl.classList.contains('open'):estado;
  hl.classList.toggle('open',on);
  const bar=hl.querySelector('.hl-bar'); if(bar) bar.setAttribute('aria-expanded',String(on));
  acende(hl,on);
}

/* ---------- digest: os melhores da seção, no topo do capítulo ---------- */
function digest(sec){
  const hls=[...sec.querySelectorAll('.hl')];
  if(hls.length<2) return;
  const h2=sec.querySelector('.sec-head h2');
  const titulo=h2?h2.textContent.trim():'';
  const ord=[...hls].sort((a,b)=>(+b.dataset.score||0)-(+a.dataset.score||0)).slice(0,3);
  const itens=ord.map(hl=>{
    if(!hl.id) hl.id='hl-'+(sec.id||'s')+'-'+hls.indexOf(hl);
    const b=hl.querySelector('.hl-verdict');
    return {hl, txt:b?b.innerHTML:'', fonte:hl.dataset.tabela?'quadro':'gráfico'};
  });
  const box=document.createElement('div'); box.className='digest';
  box.innerHTML=`<div class="dh"><span>Destaques${titulo?' · '+esc(titulo):''}</span>`
    +`<em>${hls.length} ${plural(hls.length,'achado','achados')} nesta seção</em></div>`
    +itens.map((it,i)=>`<div class="dg"><span class="dn">${String(i+1).padStart(2,'0')}</span>`
      +`<span class="dt">${it.txt}</span>`
      +`<a href="#${it.hl.id}" data-go="${it.hl.id}">ver ${it.fonte}</a></div>`).join('');
  const head=sec.querySelector('.sec-head');
  if(head&&head.nextSibling) head.parentNode.insertBefore(box,head.nextSibling);
  else sec.insertBefore(box,sec.firstChild);
  box.querySelectorAll('a[data-go]').forEach(a=>a.addEventListener('click',ev=>{
    ev.preventDefault();
    const alvo=document.getElementById(a.dataset.go); if(!alvo) return;
    alvo.scrollIntoView({behavior:'smooth',block:'center'});
    if(!alvo.classList.contains('open')) abre(alvo,true);
    alvo.classList.add('hl-flash'); setTimeout(()=>alvo.classList.remove('hl-flash'),1400);
  }));
}

function mount(root){
  const escopo=root||document;
  const secs=escopo.matches&&escopo.matches('section')?[escopo]:[...escopo.querySelectorAll('section')];
  (secs.length?secs:[escopo]).forEach(sec=>{
    sec.querySelectorAll(':scope > .digest').forEach(e=>e.remove());
    const hls=[...sec.querySelectorAll('.hl')];
    if(!hls.length) return;
    const ord=[...hls].sort((a,b)=>(+b.dataset.score||0)-(+a.dataset.score||0));
    ord.slice(TETO_SECAO).forEach(e=>e.remove());
    /* Um grafico e o quadro do mesmo dado podem cair na mesma leitura quando as
       alternativas nao passam no gatilho. Repetir a frase e pior que nao ter:
       a segunda ocorrencia sai. */
    const vistos=new Set();
    sec.querySelectorAll('.hl').forEach(hl=>{
      const v=hl.querySelector('.hl-verdict'); if(!v) return;
      /* mesma leitura sobre a mesma origem (o quadro so acrescenta "-tab" ao id)
         conta como repeticao, ainda que a frase mude uma palavra. */
      const base=(hl.dataset.ins||'').replace(/-tab$/,'');
      const chave=(hl.dataset.leitura?hl.dataset.leitura+'@'+base:v.textContent.trim());
      if(vistos.has(chave)) hl.remove(); else vistos.add(chave);
    });
    sec.querySelectorAll('.hl').forEach(hl=>{
      if(hl.dataset.wired) return; hl.dataset.wired='1';
      hl.querySelector('.hl-bar').addEventListener('click',()=>abre(hl));
    });
    if(sec.querySelector('.sec-head')) digest(sec);
  });
}

/* Abrir/recolher todas de uma vez continua disponivel pelo console
   (INSRT.todos(true) / INSRT.todos(false)) e automaticamente na impressao,
   mas sem botao na tela: o controle e por figura. */
/* ---------- reidratar réguas clonadas (modo tela cheia) ---------- */
/* O modal de ampliação clona a figura inteira, então a régua vai junto — mas
   um clone não carrega listener, e o data-wired vem colado impedindo a
   religação. Aqui a marca é limpa e os cliques voltam a funcionar. */
function rehydrate(root){
  if(!root) return;
  root.querySelectorAll('.digest').forEach(e=>e.remove());
  root.querySelectorAll('.hl').forEach(hl=>{
    hl.removeAttribute('data-wired');
    hl.classList.remove('open');
    const bar=hl.querySelector('.hl-bar'); if(!bar) return;
    bar.setAttribute('aria-expanded','false');
    hl.dataset.wired='1';
    bar.addEventListener('click',()=>abre(hl));
  });
}

function todos(aberto){ document.querySelectorAll('.hl').forEach(hl=>abre(hl,!!aberto)); }

G.INSRT={strip,mount,abre,todos,rehydrate,TETO_SECAO,plural,artPl,un};

})(window);
