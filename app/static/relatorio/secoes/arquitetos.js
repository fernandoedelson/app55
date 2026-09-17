/* Vendedor × Arquiteto — desenho de buildArqFilter/renderArquitetos/blocoRfvArquitetos do Kit.
   A janela pede os números ao servidor; a carteira de um vendedor e os arquitetos de um segmento
   do RFV vêm por detalhamento. */
'use strict';
window.DESENHO=window.DESENHO||{};
window.DESENHO_POS=window.DESENHO_POS||{};
const AQ_SEG_CORES=()=>({'Campeões':GOOD,'Fiéis':SER[0],'Em risco':BAD,'Novos / únicos':SER[2],
  'Ocasionais':BASE,'Hibernando':WARN,'Perdidos':MUT});

/* ---------- primitiva: dispersão com quadrantes (porte literal de bolhas(), atos_ajustes.js) ----------
   O relatório não tinha gráfico de dispersão. Área (não raio) proporcional ao valor: raio
   proporcional exagera o maior em ~3x e mente sobre a diferença. */
function _aqBolhas(pts,o){
  o=o||{};
  const w=o.w||980, h=o.h||400, pt=30, pr=26, pb=54, pl=78, pw=w-pl-pr, ph=h-pt-pb;
  const cor=o.cor||SER[0], rmax=o.rmax||46, rmin=11;
  const xf=o.xfmt||(v=>nf(v,2)), yf=o.yfmt||(v=>mi(v,0));
  const xs=pts.map(p=>p.x), ys=pts.map(p=>p.y);
  let x0=Math.min(...xs), x1=Math.max(...xs), y0=Math.min(...ys), y1=Math.max(...ys);
  const dx=(x1-x0)||1, dy=(y1-y0)||1;
  x0-=dx*0.22; x1+=dx*0.22; y0-=dy*0.26; y1+=dy*0.26;
  /* folga arredondada: sem isto o eixo sai com 0,85 / 1,42 / 1,99, que ninguém lê */
  const passo=r=>{ const e=Math.pow(10,Math.floor(Math.log(r/4)/Math.LN10)); const n=(r/4)/e;
    return e*(n<1.5?1:(n<3?2:(n<7?5:10))); };
  const px=passo(x1-x0), py=passo(y1-y0);
  x0=Math.floor(x0/px)*px; x1=Math.ceil(x1/px)*px;
  y0=Math.floor(y0/py)*py; y1=Math.ceil(y1/py)*py;
  const X=v=>pl+pw*(v-x0)/(x1-x0), Y=v=>pt+ph-ph*(v-y0)/(y1-y0);
  const vmax=Math.max(...pts.map(p=>p.r||0),1);
  const R=v=>rmin+(rmax-rmin)*Math.sqrt((v||0)/vmax);
  let s='<svg viewBox="0 0 '+w+' '+h+'" class="chart" style="max-width:100%;height:auto">';
  for(let yv=y0;yv<=y1+py*0.001;yv+=py){ const yy=Y(yv);
    s+='<line x1="'+pl+'" y1="'+W(yy)+'" x2="'+(pl+pw)+'" y2="'+W(yy)+'" stroke="'+GRID+'"/>';
    s+='<text x="'+(pl-9)+'" y="'+W(yy+4)+'" text-anchor="end" font-size="11" fill="'+MUT+'">'+esc(yf(yv))+'</text>';
  }
  for(let xv=x0;xv<=x1+px*0.001;xv+=px){ const xx=X(xv);
    s+='<text x="'+W(xx)+'" y="'+(h-pb+20)+'" text-anchor="middle" font-size="10.5" fill="'+MUT+'">'+esc(xf(xv))+'</text>';
  }
  /* as médias do time são a moldura da leitura: é o cruzamento delas que separa
     "vende caro" de "vende com frequência" */
  if(o.medX!=null) s+='<line x1="'+W(X(o.medX))+'" y1="'+pt+'" x2="'+W(X(o.medX))+'" y2="'+(pt+ph)
      +'" stroke="'+INK+'" stroke-opacity=".3" stroke-dasharray="5 4"/>';
  if(o.medY!=null) s+='<line x1="'+pl+'" y1="'+W(Y(o.medY))+'" x2="'+(pl+pw)+'" y2="'+W(Y(o.medY))
      +'" stroke="'+INK+'" stroke-opacity=".3" stroke-dasharray="5 4"/>';
  const quad=o.quad||{};
  const canto=(txt,x,y,anc)=>txt?('<text x="'+W(x)+'" y="'+W(y)+'" text-anchor="'+anc+'" font-size="9.5" fill="'+MUT
      +'" letter-spacing=".1em">'+esc(txt.toUpperCase())+'</text>'):'';
  s+=canto(quad.ne,pl+pw-6,pt+14,'end');
  s+=canto(quad.no,pl+8,pt+14,'start');
  s+=canto(quad.se,pl+pw-6,pt+ph-8,'end');
  s+=canto(quad.so,pl+8,pt+ph-8,'start');
  pts.forEach(p=>{
    const cx=X(p.x), cy=Y(p.y), r=R(p.r);
    s+='<circle cx="'+W(cx)+'" cy="'+W(cy)+'" r="'+W(r)+'" fill="'+cor+'" fill-opacity=".18" stroke="'+cor
      +'" stroke-width="2" data-lab="'+esc(p.nome)+'"><title>'+esc(p.nome)+' · '+esc(xf(p.x))+' · '
      +esc(yf(p.y))+(p.rlab?' · '+esc(p.rlab):'')+'</title></circle>';
    /* nome no mesmo tratamento do resto do documento: corpo 12,5, peso normal, tinta secundária.
       Negrito aqui é reservado a valor — era o que fazia estes nomes destoarem de todos os outros. */
    s+='<text x="'+W(cx)+'" y="'+W(cy-r-9)+'" text-anchor="middle" font-size="12.5" fill="'+INK2+'">'+esc(p.nome)+'</text>';
  });
  s+='<text x="'+(pl+pw/2)+'" y="'+(h-8)+'" text-anchor="middle" font-size="10.5" fill="'+MUT+'">'+esc(o.xlab||'')+'</text>';
  s+='<text x="16" y="'+W(pt+ph/2)+'" transform="rotate(-90 16 '+W(pt+ph/2)+')" text-anchor="middle" '
    +'font-size="10.5" fill="'+MUT+'">'+esc(o.ylab||'')+'</text>';
  s+='</svg>';
  const leg='<div class="legend"><span class="lg"><i style="background:'+cor+';opacity:.5"></i>'
    +esc(o.rlab||'tamanho do círculo = valor')+'</span>'
    +'<span class="lg"><i style="background:'+INK+';opacity:.35;height:2px;border-radius:0"></i>linhas tracejadas = média do time</span></div>';
  return leg+s;
}

/* ---------- primitiva: barra empilhada horizontal (porte de barrasEmpH) ----------
   O stackedCols é vertical e reserva o rótulo de volume embaixo de cada coluna. Aqui o eixo é o
   nome do vendedor e a leitura é de composição: a barra deitada lê melhor e o rótulo cabe dentro. */
function _aqBarrasEmpH(linhas,o){
  o=o||{};
  const w=o.w||980, padLeft=o.padLeft||196, rowh=o.rowh||36, topo=o.topo||10, dirW=o.dirW||104;
  const ser=o.series||[];
  const soma=l=>l.valores.reduce((a,b)=>a+(b||0),0);
  const h=topo+linhas.length*rowh+14;
  const maxTot=Math.max(...linhas.map(soma),1), barw=w-padLeft-dirW;
  let s='<svg viewBox="0 0 '+w+' '+h+'" class="chart" style="max-width:100%;height:auto">';
  linhas.forEach((l,k)=>{
    const y=topo+k*rowh, tot=soma(l); let x=padLeft;
    s+='<text x="'+(padLeft-10)+'" y="'+(y+rowh/2+4)+'" text-anchor="end" font-size="12.5" fill="'+INK2+'">'
      +esc(trunc(l.nome,28))+'<title>'+esc(l.nome)+'</title></text>';
    l.valores.forEach((v,i)=>{
      if(!v) return;
      const seg=barw*v/maxTot;
      s+='<rect x="'+W(x)+'" y="'+(y+7)+'" width="'+W(seg)+'" height="'+(rowh-18)+'" fill="'+ser[i].color
        +'"><title>'+esc(l.nome)+' · '+esc(ser[i].name)+': '+nf(v)+'</title></rect>';
      /* rótulo dentro do segmento só quando cabe — número espremido não se lê */
      if(seg>=22) s+='<text x="'+W(x+seg/2)+'" y="'+(y+rowh/2+3)+'" text-anchor="middle" font-size="11" '
        +'font-weight="600" fill="#fff">'+nf(v)+'</text>';
      x+=seg;
    });
    s+='<text x="'+W(x+9)+'" y="'+(y+rowh/2+4)+'" font-size="12" font-weight="600" fill="'+INK+'">'
      +nf(tot)+(o.unidade?' '+esc(o.unidade):'')+'</text>';
  });
  s+='</svg>';
  const leg='<div class="legend">'+ser.map(c=>'<span class="lg"><i style="background:'+c.color+'"></i>'+esc(c.name)+'</span>').join('')+'</div>';
  return leg+s;
}

/* ---------- os dois blocos do canal (porte de blocoEsforco/blocoRecorrencia) ----------
   Só existem na reunião: o servidor só manda estes payloads para a apresentação. */
function _aqCanal(P){
  let s='';
  const E=P['aq-esforco'];
  if(E){
    const lab='janela de '+E.janela+' meses até '+ymLab(E.fim);
    s+=H3('O esforço comercial de cada um','frequência × ticket no canal · '+lab,'aq-esforco');
    s+=fig(_aqBolhas(E.pontos.map(p=>({nome:trunc(p.nome.split(' ')[0],12),x:p.x,y:p.y,r:p.r,rlab:mi(p.r)})),
      {w:980,h:400,medX:E.medX,medY:E.medY,
       xlab:'pedidos por arquiteto',ylab:'ticket médio do canal',
       xfmt:v=>nf(v,2), yfmt:v=>mi(v,0),
       rlab:'tamanho do círculo = venda pelo canal',
       quad:{no:'vende caro, mas raro',ne:'caro e frequente',
             so:'atenção',se:'gira muito, ticket baixo'}}),ins('arqCanal','arq-canal'));
    s+=cap('Cada bolha é um vendedor. À direita, quem faz o mesmo arquiteto voltar mais vezes; acima, quem '
      +'vende pedidos maiores. As tracejadas são as médias do time — <b>'+nf(E.medX,2)+' pedidos por arquiteto</b> '
      +'e <b>'+money(E.medY)+' de ticket</b>. Só venda com arquiteto vinculado entra na conta.');
    /* a decomposição é o que faz a bolha virar conclusão: os três fatores multiplicados
       dão exatamente a venda pelo canal */
    s+=table(['Vendedor(a)','Arquitetos','× Pedidos por arquiteto','× Ticket do canal','= Venda pelo canal','% da venda dele(a)'],
      E.linhas.map(x=>['<span class="aqesf-nome">'+esc(x[0])+'</span>',nf(x[1]),nf(x[2],2),money(x[3]),money(x[4]),pct(x[5],0)]),
      ['left','right','right','right','right','right'],
      ['<b>Time</b>','<b>'+nf(E.arqsT)+'</b>','<b>'+nf(E.medX,2)+'</b>','<b>'+money(E.medY)+'</b>',
       '<b>'+money(E.totA)+'</b>','<b>'+pct(E.share,0)+'</b>']);
    s+='<div id="aq-esforco-detalhe"></div>';
    s+=cap('<b>Clique num vendedor</b> para ver os dez maiores arquitetos da carteira dele, com a frequência de cada um. '
      +'A venda pelo canal é o produto exato das três colunas: <b>quantos arquitetos</b> a pessoa tem, '
      +'<b>quantas vezes cada um volta</b> e <b>quanto vale cada pedido</b>. É onde se vê que dois vendedores '
      +'com a mesma venda podem estar fazendo trabalhos completamente diferentes. '
      +'O total do time em "arquitetos" soma as carteiras — alguns profissionais atendem mais de um vendedor '
      +'e por isso aparecem em mais de uma.');
  }
  const R=P['aq-recorrencia'];
  if(R){
    const lab='janela de '+R.janela+' meses até '+ymLab(R.fim);
    const SERIES=[{name:'1 pedido · ainda recente',color:SER[3]},{name:'1 pedido · esfriou',color:BAD},
                  {name:'2 pedidos',color:WARN},{name:'3 ou mais',color:GOOD}];
    s+=H3('Quanto da carteira de arquitetos repete','arquitetos por número de pedidos · '+lab,'aq-recorrencia');
    s+=fig(_aqBarrasEmpH(R.linhas.map(g=>({nome:g.nome,valores:g.n})),{series:SERIES,w:980,unidade:'arquitetos'}),
      ins('arqExclusividade','arq-exclusividade'));
    s+=cap('Um pedido só não quer dizer relação perdida: quem trouxe o primeiro pedido nos últimos '
      +R.recente+' meses ainda não teve tempo de repetir. Por isso a faixa é dividida — '
      +'<b>ainda recente</b> é carteira em construção, <b>esfriou</b> é relação que parou. '
      +'Metade da carteira ter um pedido só é o normal da casa; o que diferencia é o peso disso na venda.');
    const T=R.total;
    s+=table(['Vendedor(a)','Arquitetos','Esfriaram (1 pedido)','Repetiram (2+)','% da venda deles','Venda pelo canal'],
      R.linhas.map(g=>{ const repete=g.n[2]+g.n[3], vRep=g.v[2]+g.v[3];
        return [esc(g.nome),nf(g.tot),
          nf(g.n[1])+(g.n[0]?' <span class="mut">(+'+nf(g.n[0])+' recentes)</span>':''),
          nf(repete),pct(g.totV?vRep/g.totV:0,0),money(g.totV)]; }),
      ['left','right','right','right','right','right'],
      ['<b>Time</b>','<b>'+nf(T.tot)+'</b>',
       '<b>'+nf(T.frio)+'</b> <span class="mut">(+'+nf(T.rec)+' recentes)</span>',
       '<b>'+nf(T.rep)+'</b>','<b>'+pct(T.v?T.vRep/T.v:0,0)+'</b>','<b>'+money(T.v)+'</b>']);
  }
  return s;
}

function _aqCorpo(P){
  const A=P['arquitetos.abertura'];
  if(A&&A.vazio) return call('Sem venda com arquiteto na janela selecionada.','warn');
  let s='';
  const K=P['aq-peso'];
  if(K){
    s+=H3('O peso do canal','janela de '+K.janela+' meses até '+ymLab(K.fim),'aq-peso');
    s+='<div class="kpis k4">'
     +kpi('Venda com arquiteto',mi(K.totA),pct(K.share,1)+' de toda a venda')
     +kpi('Arquitetos ativos',nf(K.n),'com ao menos um pedido')
     +kpi('RT paga',mi(K.rt),pct(K.rt_pct,1)+' da venda com arquiteto')
     +kpi('Exclusivos de um vendedor',pct(K.excl_pct,0),nf(K.excl)+' de '+nf(K.n),'warn')
     +'</div>';
  }
  const D=P['aq-dependencia'];
  if(D){
    s+=H3('Quanto cada vendedor depende do canal','venda com arquiteto × venda direta','aq-dependencia');
    s+=fig(stackedCols(D.nomes.map(n=>trunc(n,14)),[
        {name:'Com arquiteto',values:D.arq,color:SER[0]},
        {name:'Venda direta',values:D.sem,color:BASE},
      ],{valfmt:v=>mi(v,1),w:960,subLabels:D.share.map(v=>pct(v,0)),subTitle:'% via arquiteto'}),ins('arqCanal','arq-canal'));
    s+=cap('A linha de baixo é a fatia da venda de cada um que passou por um arquiteto. '
      +'Dois vendedores com a mesma venda podem estar em negócios completamente diferentes.');
  }
  const Q=P['aq-quantos'];
  if(Q){
    s+=H3('De quantos arquitetos cada vendedor vive','clique numa linha para ver a carteira dele','aq-quantos');
    const alinha=['left','right','right','right','right','right','right','right'];
    const cab=['Vendedor(a)','Venda total','% via arquiteto','Arquitetos','Bastam p/ 50%','Maior arquiteto',
               'Ticket c/ arq.','Ticket direto'];
    s+='<div class="tw"><table class="dt"><thead><tr>'
      +cab.map((h,i)=>`<th class="${alinha[i]}">${h}</th>`).join('')+'</tr></thead><tbody>'
      +Q.linhas.map(x=>`<tr class="aq-vend-row" data-v="${esc(x[0])}">`
        +`<td class="left">${esc(trunc(x[0],24))}</td>`
        +`<td class="right">${money(x[1])}</td>`
        +`<td class="right">${pct(x[2],0)}</td>`
        +`<td class="right">${nf(x[3])}</td>`
        +`<td class="right"><b>${x[3]?nf(x[4]):'—'}</b></td>`
        +`<td class="right">${x[3]?pct(x[5],0):'—'}</td>`
        +`<td class="right">${x[6]!=null?money(x[6]):'—'}</td>`
        +`<td class="right">${x[7]!=null?money(x[7]):'—'}</td></tr>`).join('')
      +'</tbody></table></div>';
    s+=cap('<b>Bastam p/ 50%</b>: quantos arquitetos, somados do maior para o menor, já chegam à metade da '
      +'venda que aquele vendedor faz pelo canal. Se o número é <b>2</b>, dois arquitetos respondem por metade '
      +'de tudo — e a coluna ao lado mostra quantos existem no total. Quanto mais distantes esses dois números, '
      +'mais distribuída a agenda; quanto mais próximos, mais ela depende de poucas relações.');
    s+='<div class="tw-ins">'+(window.INSRT?INSRT.strip(ins('arqDependencia','arq-dependencia')):'')+'</div>';
    s+='<div id="aq-detalhe"></div>';
  }
  const M=P['aq-matriz'];
  if(M){ const md={}; M.linhas.forEach((vn,i)=>{md[vn]={}; M.colunas.forEach((an,j)=>md[vn][an]=M.mat[i][j]);});
    s+=H3('Quem trabalha com quem','R$ mil · maiores arquitetos × maiores vendedores','aq-matriz');
    s+=fig(heatmap(M.linhas,M.colunas,md,{valfmt:v=>v>1000?nf(v/1000,0):'',padLeft:150,w:940}),ins('arqMatriz','arq-matriz'));
    s+=cap('Célula vazia é par que nunca trabalhou junto. Uma coluna concentrada numa linha só é um '
      +'arquiteto que pertence a um vendedor; espalhada, é um arquiteto da casa.');
  }
  const L=P['aq-lista'];
  if(L){
    s+=H3('Os arquitetos','ordenados por venda atribuída na janela','aq-lista');
    s+=fig(hbar(L.top,{valfmt:v=>mi(v,1),padLeft:250,w:820,color:SER[6],maxbars:14,pct:true,total:L.total}),ins('auto','auto-arq-canal'));
    s+=table(['Arquiteto / escritório','Venda atribuída','RT paga','RT efetiva','Pedidos','Clientes',
              'Vendedor principal','% com ele','Meses sem trazer'],
      L.linhas.map(x=>[esc(trunc(x[0],30)),money(x[1]),money(x[2]),pct(x[3],1),nf(x[4]),nf(x[5]),
        esc(trunc(x[6]||'—',18)),
        `<span style="color:${x[7]>=.9?WARN:MUT}">${pct(x[7],0)}</span>`,
        `<span style="color:${x[8]>=6?BAD:(x[8]>=3?WARN:GOOD)};font-weight:600">${nf(x[8])}</span>`]),
      ['left','right','right','right','right','right','left','right','right'],null,ins('arqExclusividade','arq-exclusividade'));
    s+=cap('“% com ele” é quanto da venda daquele arquiteto passou pelo vendedor principal. '
      +'Perto de 100% significa relação exclusiva — o arquiteto é do vendedor, não da casa.');
  }
  const PA=P['aq-parados'];
  if(PA){
    s+=H3('Arquitetos que pararam de trazer','sem nenhum pedido há seis meses ou mais','aq-parados');
    s+=table(['Arquiteto / escritório','Venda na janela','Pedidos','Meses sem trazer','Vendedor principal'],
      PA.linhas.map(x=>[esc(trunc(x[0],32)),money(x[1]),nf(x[2]),
        `<span style="color:${BAD};font-weight:600">${nf(x[3])}</span>`,esc(trunc(x[4]||'—',20))]),
      ['left','right','right','right','left'],null,ins('arqParados','arq-parados'));
  }
  const R=P['aq-rfv'];
  if(R){ const segCores=AQ_SEG_CORES();
    s+=H3('Carteira de arquitetos · RFV','o mesmo corte da carteira de clientes, aplicado ao canal','aq-rfv');
    s+=call('Cada arquiteto recebe nota de 1 a 5 em <b>recência</b> (há quantos meses trouxe o último pedido), '
      +'<b>frequência</b> (quantos pedidos trouxe) e <b>valor</b> (quanto somou). Os segmentos saem da combinação '
      +'das três — e valem para o canal como valem para o cliente final: um arquiteto que parou de especificar '
      +'não avisa, só some da lista.');
    s+=fig(hbar(R.segs.map(x=>[x[0],x[3]]),{valfmt:v=>mi(v,1),padLeft:170,w:820,color:SER[6]}),ins('rfvArqSegmentos','rfv-arq-segmentos'));
    const al=['left','right','right','right','right','right','right'];
    const cb=['Segmento','Arquitetos','% do canal (nº)','Venda atribuída','% do valor','Pedidos/arquiteto','Meses sem trazer'];
    s+='<div class="tw"><table class="dt"><thead><tr>'
      +cb.map((h,i)=>`<th class="${al[i]}">${h}</th>`).join('')+'</tr></thead><tbody>'
      +R.segs.map(x=>`<tr class="aqrfv-row" data-seg="${esc(x[0])}">`
        +`<td class="left"><span style="color:${segCores[x[0]]||INK};font-weight:600">${esc(x[0])}</span></td>`
        +`<td class="right">${nf(x[1])}</td><td class="right">${pct(x[2],1)}</td>`
        +`<td class="right">${money(x[3])}</td><td class="right">${pct(x[4],1)}</td>`
        +`<td class="right">${nf(x[5],2)}</td><td class="right">${nf(x[6],1)}</td></tr>`).join('')
      +'</tbody><tfoot><tr><td class="left">Total</td>'
      +`<td class="right">${nf(R.n)}</td><td class="right">100,0%</td>`
      +`<td class="right">${money(R.total)}</td><td class="right">100,0%</td>`
      +`<td class="right">${nf(R.f_medio,2)}</td>`
      +`<td class="right">${nf(R.r_medio,1)}</td></tr></tfoot></table></div>`;
    s+=cap('Clique num segmento para ver os arquitetos que estão nele, com o vendedor responsável.');
    s+='<div class="tw-ins">'+(window.INSRT?INSRT.strip(ins('rfvArqTabela','rfv-arq-recompra')):'')+'</div>';
    s+='<div id="aqrfv-detalhe"></div>';
  }
  s+=_aqCanal(P);            /* os dois blocos do canal, que só a reunião pede */
  const PF=P['aq-perf'];
  if(PF){
    s+=H3('Performance do vendedor com o arquiteto','de que qualidade é a carteira de canal de cada um','aq-perf');
    s+=fig(stackedCols(PF.nomes.map(n=>trunc(n,14)),[
        {name:'Campeões e fiéis',values:PF.bons,color:GOOD},
        {name:'Ocasionais / novos',values:PF.meio,color:BASE},
        {name:'Em risco / parados',values:PF.ruins,color:BAD},
      ],{valfmt:v=>mi(v,1),w:960,subLabels:PF.sub.map(v=>pct(v,0)),subTitle:'% em fiéis'}),ins('rfvArqPorVendedor','rfv-arq-por-vendedor'));
    s+=table(['Vendedor(a)','Arquitetos','Venda pelo canal','Campeões + fiéis','% do valor dele',
              'Em risco / parados','% do valor','Pedidos por arquiteto','Ticket'],
      PF.linhas.map(x=>[esc(trunc(x[0],22)),nf(x[1]),money(x[2]),
        nf(x[3]),`<span style="color:${GOOD};font-weight:600">${pct(x[4],0)}</span>`,
        nf(x[5]),`<span style="color:${x[6]>.4?BAD:MUT};font-weight:600">${pct(x[6],0)}</span>`,
        nf(x[7],2),money(x[8])]),
      ['left','right','right','right','right','right','right','right','right'],null,ins('rfvArqQualidade','rfv-arq-qualidade'));
    s+=cap('A mesma carteira de arquitetos pode render de formas muito diferentes: o que separa não é '
      +'quantos arquitetos alguém tem, e sim quantos deles continuam trazendo pedido.');
  }
  return s;
}

DESENHO.arquitetos=function(P){
  const A=P['arquitetos.abertura'];
  let s='';
  if(A){
    const op=[[12,'Últimos 12 meses'],[6,'Últimos 6 meses'],[24,'Últimos 24 meses']];
    s+=`<div class="sec-head"><div class="kick">Canal de venda</div><h2>Vendedor × Arquiteto</h2>
      <p class="lead">Na maior parte dos projetos quem especifica e traz o cliente é o arquiteto — o que faz do par vendedor × arquiteto o canal real da venda. Quanto cada vendedor depende dele, de quantas relações vive, quais arquitetos são da casa e quais são de uma pessoa só.</p></div>`
      +'<div class="filterbar"><div class="fb-custom"><span class="fb-t">Janela:</span> '
      +'<select id="aq-janela">'+op.map(o=>`<option value="${o[0]}"${o[0]===12?' selected':''}>${o[1]}</option>`).join('')
      +`</select></div><div class="fb-lab" id="aq-label">${A.janela} meses até ${ymLab(A.fim)}</div></div>`;
  }
  s+='<div id="aq-body">'+_aqCorpo(P)+'</div>';
  return s;
};

DESENHO_POS.arquitetos=function(sec,ctx){
  const A=ctx.payload['arquitetos.abertura']||{};
  let janela=A.janela||12, vendSel=null, segSel=null;
  const sel=document.getElementById('aq-janela'); if(sel) sel.value=janela;
  /* na reunião os blocos são MOVIDOS da seção para o ato: quando isso já aconteceu, as linhas
     não estão mais sob `sec` — a busca então cai para o documento, onde só existe uma cópia */
  const todos=sel=>{ const a=sec.querySelectorAll(sel); return a.length?[...a]:[...document.querySelectorAll(sel)]; };
  const marcaVend=()=>todos('.aq-vend-row').forEach(tr=>{
    tr.style.background=(tr.dataset.v===vendSel)?'rgba(146,112,93,.12)':''; });
  const marcaSeg=()=>todos('.aqrfv-row').forEach(tr=>{
    tr.style.background=(tr.dataset.seg===segSel)?'rgba(146,112,93,.12)':''; });
  async function carteira(vn){
    const det=document.getElementById('aq-detalhe'); if(!det) return;
    if(vendSel===vn){ vendSel=null; det.innerHTML=''; marcaVend(); return; }
    vendSel=vn; marcaVend();
    const R=await ctx.detalhe('vendedor',{janela,vend:vn});
    if(!R.linhas.length){ det.innerHTML=call('Sem venda com arquiteto para '+esc(vn)+' na janela.','warn'); return; }
    det.innerHTML=H3('Arquitetos de '+esc(vn), nf(R.linhas.length)+' · '+mi(R.total))
      +table(['Arquiteto / escritório','Venda atribuída','% do vendedor','% acumulada','Exclusivo?','RT efetiva','Meses sem trazer'],
        R.linhas.map(x=>[esc(trunc(x[0],34)),money(x[1]),pct(x[2],1),pct(x[3],1),
          x[4]?'<span style="color:'+WARN+'">só com '+esc(trunc(vn,14))+'</span>'
              :'<span class="mut">com '+nf(x[5])+' vendedores</span>',
          pct(x[6],1),
          x[7]==null?'—':`<span style="color:${x[7]>=6?BAD:(x[7]>=3?WARN:GOOD)};font-weight:600">${nf(x[7])}</span>`]),
        ['left','right','right','right','left','right','right'])
      +cap('“Exclusivo” marca o arquiteto que só trouxe negócio para este vendedor na janela — a relação é '
        +'pessoal, e some junto com ele. Clique de novo na linha para fechar.');
    ctx.remarcar();
    det.scrollIntoView({behavior:'smooth',block:'nearest'});
  }
  async function segmento(seg){
    const det=document.getElementById('aqrfv-detalhe'); if(!det) return;
    if(segSel===seg){ segSel=null; det.innerHTML=''; marcaSeg(); return; }
    segSel=seg; marcaSeg();
    const R=await ctx.detalhe('segmento',{janela,seg});
    if(!R.linhas.length){ det.innerHTML=''; return; }
    det.innerHTML=H3('Arquitetos em “'+esc(seg)+'”', nf(R.linhas.length)+' · '+mi(R.total))
      +table(['Arquiteto / escritório','Venda atribuída','Pedidos','Meses sem trazer','RT efetiva',
              'Vendedor principal','Exclusivo?','% acumulada'],
        R.linhas.map(x=>[esc(trunc(x[0],32)),money(x[1]),nf(x[2]),
          `<span style="color:${x[3]>=6?BAD:(x[3]>=3?WARN:GOOD)};font-weight:600">${nf(x[3])}</span>`,
          pct(x[4],1),esc(trunc(x[5]||'—',20)),
          x[6]?'<span style="color:'+WARN+'">sim</span>':'<span class="mut">não</span>',
          pct(x[7],1)]),
        ['left','right','right','right','right','left','left','right'])
      +cap('Clique de novo no segmento para fechar.');
    ctx.remarcar();
    det.scrollIntoView({behavior:'smooth',block:'nearest'});
  }
  /* o canal só aparece na reunião; lá a tabela do esforço abre a carteira de canal do vendedor */
  let esfSel=null;
  const marcaEsf=()=>todos('.aqesf-nome').forEach(n=>{
    const tr=n.closest('tr'); if(tr) tr.style.background=(n.textContent.trim()===esfSel)?'rgba(146,112,93,.12)':''; });
  async function carteiraCanal(vn){
    const det=document.getElementById('aq-esforco-detalhe'); if(!det) return;
    if(esfSel===vn){ esfSel=null; det.innerHTML=''; marcaEsf(); return; }
    esfSel=vn; marcaEsf();
    const R=await ctx.detalhe('canal',{janela,vend:vn});
    if(!R.linhas.length){ det.innerHTML=''; return; }
    det.innerHTML=H3('A carteira de canal de '+esc(vn), nf(R.n)+' arquitetos · '+mi(R.total))
      +table(['Arquiteto / escritório','Venda atribuída','Pedidos','Meses sem trazer'],
        R.linhas.map(x=>[esc(trunc(x[0],34)),money(x[1]),nf(x[2]),
          `<span style="color:${x[3]>=6?BAD:(x[3]>=3?WARN:GOOD)};font-weight:600">${nf(x[3])}</span>`]),
        ['left','right','right','right'])
      +cap('Os dez maiores da carteira dele(a) na janela. Clique de novo no nome para fechar.');
    ctx.marcar();
    det.scrollIntoView({behavior:'smooth',block:'nearest'});
  }
  function ligar(){
    if(!ctx.pode('detalhar')) return;
    todos('.aqesf-nome').forEach(n=>{ const tr=n.closest('tr'); if(!tr) return;
      tr.style.cursor='pointer'; tr.addEventListener('click',()=>carteiraCanal(n.textContent.trim())); });
    todos('.aq-vend-row').forEach(tr=>{ tr.style.cursor='pointer'; tr.addEventListener('click',()=>carteira(tr.dataset.v)); });
    todos('.aqrfv-row').forEach(tr=>{ tr.style.cursor='pointer'; tr.addEventListener('click',()=>segmento(tr.dataset.seg)); });
  }
  if(sel) sel.addEventListener('change',async e=>{
    janela=+e.target.value; vendSel=null; segSel=null;
    const P=await ctx.buscar({janela});
    document.getElementById('aq-body').innerHTML=_aqCorpo(P);
    const lb=document.getElementById('aq-label'); if(lb) lb.textContent=janela+' meses até '+ymLab((P['arquitetos.abertura']||A).fim);
    ligar(); ctx.remarcar();
  });
  ligar();
};
