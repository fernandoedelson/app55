/* ===== +55 · desenho do relatório =====
   GERADO por ferramentas/extrair_desenho.py a partir do app.js do Kit na tag gabarito-v1.
   Não editar à mão: é o mesmo código que desenhou o gabarito. O cálculo vem do servidor.
   ====================================================================== */
'use strict';
/* destaques chegam na fase 4: por ora nenhuma régua */
const ins=()=>null;
const remount=()=>{};

const SER=['#92705d','#577c69','#27455c','#b08e78','#8c9a6b','#a8763e','#6e8ca0','#7a5c48'];

const INK='#2a211b',INK2='#6b5d52',MUT='#9c8e80',GRID='#e2d9c8',BASE='#d0c4b0';

const GOOD='#577c69',BAD='#a8493c',WARN='#b4802e';

const RAMP=['#f3eee4','#e7dbc9','#d8c4a9','#c4a784','#ae8a64','#96704f','#79573b','#5c4029'];

const MES=['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];

/* pseudo-vendedor(a): canais/ajustes contábeis lançados na coluna de vendedor, não pessoas —
   excluídos de toda listagem/gráfico por vendedor(a). */
const PSEUDO_VEND=['TROCA','BONIFICACAO-','Não informado'];

/* ---- format (pt-BR) ---- */
const nf=(v,d=0)=> (v==null||isNaN(v))?'':Number(v).toLocaleString('pt-BR',{minimumFractionDigits:d,maximumFractionDigits:d});

const money=(v,d=0)=> (v==null||v==='')?'':'R$ '+nf(v,d);

function mi(v,d=1){ if(v==null)return''; v=+v; const a=Math.abs(v);
  if(a>=1e6) return 'R$ '+nf(v/1e6,d)+' mi';
  if(a>=1e3) return 'R$ '+nf(v/1e3,0)+' mil'; return 'R$ '+nf(v,0);}

const pct=(v,d=1)=> (v==null||v==='')?'':nf(v*100,d)+'%';

const spct=(v,d=1)=>{ if(v==null||v==='')return''; v=+v; return (v>0?'+':'')+nf(v*100,d)+'%';};

const esc=s=> (s==null?'':String(s).replace(/[&<>]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[c])));

const trunc=(s,n)=>{s=String(s); return s.length<=n?s:s.slice(0,n-1).trimEnd()+'…';};

const W=v=>(+v).toFixed(2);

/* ---- charts (SVG strings) ---- */
function hbar(items,o={}){ const {valfmt=money,color=SER[0],w=780,rowh=30,padLeft=210,maxbars=null,
    pct:comPct=false,total=null,extraCols=null}=o;
  if(maxbars) items=items.slice(0,maxbars);
  // com percentuais (ou colunas extra), colunas alinhadas à direita + uma faixa de cabeçalho, para
  // essas leituras não virarem números soltos ao lado da barra.
  const topo=(comPct||extraCols)?20:0, n=items.length, h=n*rowh+16+topo;
  const vmax=Math.max(...items.map(i=>Math.abs(+i[1])),1);
  // total explícito quando o gráfico corta a lista (maxbars): assim o acumulado mostra a
  // cobertura real do que está no gráfico, em vez de fechar 100% escondendo o que ficou de fora.
  const tot=total!=null?total:items.reduce((a,i)=>a+ +i[1],0);
  // colunas extra (ex.: "% do total", "custo/un"): reservam espaço à direita, alinhadas por coluna,
  // com a MESMA linha de base (y) da barra — garante que tabela e gráfico nunca se desalinhem,
  // porque passam a ser o mesmo elemento em vez de dois blocos posicionados por CSS.
  const extraW=extraCols?extraCols.reduce((s2,c)=>s2+c.w+14,0):0;
  const extraX=[]; if(extraCols){ let cur=w-8; for(let i=extraCols.length-1;i>=0;i--){ extraX[i]=cur; cur-=(extraCols[i].w+14); } }
  const barw=w-padLeft-(comPct?250:150)-extraW, maxch=Math.floor((padLeft-14)/6.6);
  const xPct=w-92-extraW, xAcum=w-8-extraW;
  let s=`<svg viewBox="0 0 ${w} ${h}" class="chart" style="max-width:100%;height:auto">`;
  if(comPct){
    s+=`<text x="${xPct}" y="12" text-anchor="end" font-size="9.5" fill="${MUT}" letter-spacing=".08em">% DO TOTAL</text>`;
    s+=`<text x="${xAcum}" y="12" text-anchor="end" font-size="9.5" fill="${MUT}" letter-spacing=".08em">% ACUM.</text>`;}
  if(extraCols) extraCols.forEach((c,i)=>{ s+=`<text x="${extraX[i]}" y="12" text-anchor="end" font-size="9.5" fill="${MUT}" letter-spacing=".08em">${esc(c.header.toUpperCase())}</text>`; });
  let acum=0;
  items.forEach((it,k)=>{const lab=it[0],val=+it[1],y=8+topo+k*rowh; const bw=Math.max(2,barw*Math.abs(val)/vmax);
    const col=val>=0?color:BAD; acum+=val;
    s+=`<text x="${padLeft-8}" y="${y+rowh/2+4}" text-anchor="end" font-size="12.5" fill="${INK2}">${esc(trunc(lab,maxch))}<title>${esc(lab)}</title></text>`;
    s+=`<rect x="${padLeft}" y="${y+5}" width="${W(bw)}" height="${rowh-14}" rx="3" fill="${col}" data-lab="${esc(lab)}"><title>${esc(lab)}: ${esc(valfmt(val))}${comPct?' · '+pct(val/tot,1)+' do total':''}</title></rect>`;
    s+=`<text x="${padLeft+bw+6}" y="${y+rowh/2+4}" font-size="12" font-weight="600" fill="${INK}">${esc(valfmt(val))}</text>`;
    if(comPct){
      s+=`<text x="${xPct}" y="${y+rowh/2+4}" text-anchor="end" font-size="11.5" fill="${INK}" font-weight="600">${pct(val/tot,1)}</text>`;
      s+=`<text x="${xAcum}" y="${y+rowh/2+4}" text-anchor="end" font-size="11.5" fill="${INK2}">${pct(acum/tot,1)}</text>`;}
    if(extraCols) extraCols.forEach((c,i)=>{ s+=`<text x="${extraX[i]}" y="${y+rowh/2+4}" text-anchor="end" font-size="11.5" fill="${INK2}">${esc(c.get(it,k))}</text>`; });
  });
  return s+'</svg>';}

function vbars(items,o={}){ const {valfmt=mi,w=820,h=300,color=SER[0],colors=null,highlight=null}=o;
  const pt=24,pr=16,pb=40,pl=64,pw=w-pl-pr,ph=h-pt-pb; const vals=items.map(i=>+i[1]),vmax=Math.max(...vals,1);
  const n=items.length,gap=10,bw=(pw-gap*(n-1))/n; let s=`<svg viewBox="0 0 ${w} ${h}" class="chart" style="max-width:100%;height:auto">`;
  for(let g=0;g<5;g++){const yv=vmax*g/4,yy=pt+ph-ph*g/4;
    s+=`<line x1="${pl}" y1="${W(yy)}" x2="${pl+pw}" y2="${W(yy)}" stroke="${GRID}"/>`;
    s+=`<text x="${pl-8}" y="${W(yy+4)}" text-anchor="end" font-size="11" fill="${MUT}">${esc(valfmt(yv))}</text>`;}
  items.forEach((it,i)=>{const v=+it[1],x=pl+i*(bw+gap),bh=ph*v/vmax,y=pt+ph-bh;
    const col=colors?colors[i]:(highlight&&highlight.includes(it[0])?SER[1]:color);
    s+=`<rect x="${W(x)}" y="${W(y)}" width="${W(bw)}" height="${W(bh)}" rx="4" fill="${col}"><title>${esc(it[0])}: ${esc(valfmt(v))}</title></rect>`;
    s+=`<text x="${W(x+bw/2)}" y="${W(y-6)}" text-anchor="middle" font-size="11" font-weight="600" fill="${INK}">${esc(valfmt(v))}</text>`;
    s+=`<text x="${W(x+bw/2)}" y="${h-pb+18}" text-anchor="middle" font-size="11" fill="${INK2}">${esc(it[0])}</text>`;});
  return s+'</svg>';}

function line(series,xlabels,o={}){ const {valfmt=mi,w=860,h=340}=o; const pt=18,pr=18,pb=46,pl=64,pw=w-pl-pr,ph=h-pt-pb;
  const all=[].concat(...series.map(s=>s[1].filter(v=>v!=null))); const ymax=Math.max(...all,1),ymn=0,n=xlabels.length;
  const X=i=> pl+(n>1?pw*i/(n-1):pw/2), Y=v=> pt+ph-(ymax>ymn?ph*(v-ymn)/(ymax-ymn):0);
  let s=`<svg viewBox="0 0 ${w} ${h}" class="chart" style="max-width:100%;height:auto">`;
  for(let g=0;g<5;g++){const yv=ymn+(ymax-ymn)*g/4,yy=Y(yv);
    s+=`<line x1="${pl}" y1="${W(yy)}" x2="${pl+pw}" y2="${W(yy)}" stroke="${GRID}"/>`;
    s+=`<text x="${pl-8}" y="${W(yy+4)}" text-anchor="end" font-size="11" fill="${MUT}">${esc(valfmt(yv))}</text>`;}
  const step=Math.max(1,Math.floor(n/12));
  xlabels.forEach((xl,i)=>{ if(i%step===0||i===n-1) s+=`<text x="${W(X(i))}" y="${h-pb+18}" text-anchor="middle" font-size="10.5" fill="${MUT}">${esc(xl)}</text>`;});
  series.forEach(([nm,vals,col])=>{ let pts=[]; vals.forEach((v,i)=>{if(v!=null)pts.push(W(X(i))+','+W(Y(v)));});
    if(pts.length) s+=`<polyline points="${pts.join(' ')}" fill="none" stroke="${col}" stroke-width="2.4" stroke-linejoin="round" stroke-linecap="round"/>`;
    vals.forEach((v,i)=>{if(v!=null) s+=`<circle cx="${W(X(i))}" cy="${W(Y(v))}" r="3" fill="${col}"><title>${esc(xlabels[i])} · ${esc(nm)}: ${esc(valfmt(v))}</title></circle>`;});});
  let leg = series.length>1||o.legend ? '<div class="legend">'+series.map(([nm,,c])=>`<span class="lg"><i style="background:${c}"></i>${esc(nm)}</span>`).join('')+'</div>':'';
  return leg+s+'</svg>';}

function heatmap(rows,cols,data,o={}){ const {valfmt=(v=>nf(v/1000,0)),padLeft=60,w=880,cellh=30}=o; const padTop=26;
  const ncol=cols.length,cellw=(w-padLeft-10)/ncol,h=padTop+rows.length*cellh+6;
  const all=[]; rows.forEach(r=>cols.forEach(c=>all.push((data[r]&&data[r][c])||0))); const vmax=Math.max(...all,1);
  const ramp=v=>{const t=Math.pow(v/vmax,0.7); return RAMP[Math.min(RAMP.length-1,Math.floor(t*(RAMP.length-1)+.001))];};
  const maxch=Math.floor((padLeft-12)/6.4);
  /* o rótulo de coluna era escrito inteiro e colidia com o vizinho sempre que o
     nome passava da largura da célula — trunca pela largura real e guarda o
     nome cheio no hover. */
  const maxcol=Math.max(4,Math.floor((cellw-10)/6.6));
  let s=`<svg viewBox="0 0 ${w} ${h}" class="chart" style="max-width:100%;height:auto">`;
  cols.forEach((c,j)=>{s+=`<text x="${W(padLeft+j*cellw+cellw/2)}" y="${padTop-8}" text-anchor="middle" font-size="10.5" fill="${MUT}">${esc(trunc(c,maxcol))}<title>${esc(c)}</title></text>`;});
  rows.forEach((r,i)=>{const y=padTop+i*cellh;
    s+=`<text x="${padLeft-8}" y="${W(y+cellh/2+4)}" text-anchor="end" font-size="11.5" fill="${INK2}">${esc(trunc(r,maxch))}<title>${esc(r)}</title></text>`;
    cols.forEach((c,j)=>{const v=(data[r]&&data[r][c])||0,x=padLeft+j*cellw,col=ramp(v),tc=v>vmax*.55?'#fff':INK;
      s+=`<rect x="${W(x+1)}" y="${W(y+1)}" width="${W(cellw-2)}" height="${cellh-2}" rx="2" fill="${col}"><title>${esc(r)} · ${esc(c)}: ${esc(money(v))}</title></rect>`;
      if(v>0) s+=`<text x="${W(x+cellw/2)}" y="${W(y+cellh/2+4)}" text-anchor="middle" font-size="10" fill="${tc}">${esc(valfmt(v))}</text>`;});});
  return s+'</svg>';}

function stackbar(items,o={}){ const {valfmt=mi,w=820}=o; const tot=items.reduce((a,i)=>a+ +i[1],0)||1; let x=0,bx=8,bw=w-16,y=8,bh=30;
  let s=`<svg viewBox="0 0 ${w} 64" class="chart" style="max-width:100%;height:auto">`;
  items.forEach((it,i)=>{const seg=bw*(+it[1])/tot,col=SER[i%8];
    s+=`<rect x="${W(bx+x)}" y="${y}" width="${W(Math.max(seg-2,0))}" height="${bh}" rx="2" fill="${col}"><title>${esc(it[0])}: ${esc(valfmt(+it[1]))}</title></rect>`;
    if(seg>44) s+=`<text x="${W(bx+x+seg/2)}" y="${y+bh/2+4}" text-anchor="middle" font-size="10.5" fill="#fff" font-weight="600">${pct((+it[1])/tot,0)}</text>`;
    x+=seg;});
  s+='</svg>'; s+='<div class="legend">'+items.map((it,i)=>`<span class="lg"><i style="background:${SER[i%8]}"></i>${esc(it[0])} · ${esc(valfmt(+it[1]))}</span>`).join('')+'</div>';
  return s;}

function donut(items,o={}){ const {valfmt=mi,w=240}=o; const tot=items.reduce((a,i)=>a+ +i[1],0)||1; const cx=w/2,cy=w/2,r=w/2-8,ir=r*.58;
  let a0=-Math.PI/2,s=`<svg viewBox="0 0 ${w} ${w}" class="chart" style="max-width:240px;height:auto">`;
  items.forEach((it,i)=>{const fr=(+it[1])/tot,a1=a0+fr*2*Math.PI,lg=fr>.5?1:0;
    const x0=cx+r*Math.cos(a0),y0=cy+r*Math.sin(a0),x1=cx+r*Math.cos(a1),y1=cy+r*Math.sin(a1);
    const xi0=cx+ir*Math.cos(a1),yi0=cy+ir*Math.sin(a1),xi1=cx+ir*Math.cos(a0),yi1=cy+ir*Math.sin(a0);
    s+=`<path d="M${W(x0)},${W(y0)} A${W(r)},${W(r)} 0 ${lg} 1 ${W(x1)},${W(y1)} L${W(xi0)},${W(yi0)} A${W(ir)},${W(ir)} 0 ${lg} 0 ${W(xi1)},${W(yi1)} Z" fill="${SER[i%8]}"><title>${esc(it[0])}: ${esc(valfmt(+it[1]))}</title></path>`; a0=a1;});
  s+='</svg>'; s+='<div class="legend" style="justify-content:center">'+items.map((it,i)=>`<span class="lg"><i style="background:${SER[i%8]}"></i>${esc(it[0])} · ${pct((+it[1])/tot,1)}</span>`).join('')+'</div>';
  return s;}

function pareto(items,o={}){ const {valfmt=v=>mi(v,1),w=880,h=320,colors=null,clickable=false}=o;
  const pt=24,pr=54,pb=40,pl=70,pw=w-pl-pr,ph=h-pt-pb;
  const vals=items.map(i=>+i[1]); const total=vals.reduce((a,b)=>a+b,0)||1; const vmax=Math.max(...vals,1)*1.12;
  const n=items.length,gap=18,bw=(pw-gap*(n-1))/n;
  let acc=0; const cum=vals.map(v=>{acc+=v; return acc/total;});
  const X=i=>pl+i*(bw+gap), Ybar=v=>pt+ph-ph*v/vmax, Ypct=p=>pt+ph-ph*p;
  let s=`<svg viewBox="0 0 ${w} ${h}" class="chart" style="max-width:100%;height:auto">`;
  for(let g=0;g<=4;g++){const yv=vmax*g/4,yy=pt+ph-ph*g/4;
    s+=`<line x1="${pl}" y1="${W(yy)}" x2="${pl+pw}" y2="${W(yy)}" stroke="${GRID}"/>`;
    s+=`<text x="${pl-8}" y="${W(yy+4)}" text-anchor="end" font-size="10.5" fill="${MUT}">${esc(valfmt(yv))}</text>`;
    s+=`<text x="${W(pl+pw+10)}" y="${W(yy+4)}" font-size="10.5" fill="${MUT}">${nf(100*g/4,0)}%</text>`;}
  items.forEach((it,i)=>{const v=+it[1],x=X(i),y=Ybar(v),bh=pt+ph-y,col=colors?colors[i%colors.length]:SER[0];
    s+=`<rect x="${W(x)}" y="${W(y)}" width="${W(bw)}" height="${W(bh)}" rx="4" fill="${col}"${clickable?` class="par-bar" data-i="${i}" style="cursor:pointer"`:''}><title>${esc(it[0])}: ${esc(valfmt(v))}</title></rect>`;
    s+=`<text x="${W(x+bw/2)}" y="${W(y-8)}" text-anchor="middle" font-size="11.5" font-weight="600" fill="${INK}">${esc(valfmt(v))}</text>`;
    s+=`<text x="${W(x+bw/2)}" y="${h-pb+18}" text-anchor="middle" font-size="11.5" fill="${INK2}">${esc(it[0])}</text>`;});
  const pts=cum.map((p,i)=>W(X(i)+bw/2)+','+W(Ypct(p)));
  s+=`<polyline points="${pts.join(' ')}" fill="none" stroke="${GOOD}" stroke-width="2.2" stroke-dasharray="6 4" stroke-linejoin="round" stroke-linecap="round"/>`;
  cum.forEach((p,i)=>{const cx=X(i)+bw/2,cy=Ypct(p),lbl=pct(p,1),lw=lbl.length*6.6+12,bx=cx-lw/2,by=cy-26;
    s+=`<rect x="${W(bx)}" y="${W(by)}" width="${W(lw)}" height="17" rx="3" fill="#fff" stroke="${GOOD}"/>`;
    s+=`<text x="${W(cx)}" y="${W(by+12)}" text-anchor="middle" font-size="10.5" font-weight="600" fill="${GOOD}">${lbl}</text>`;
    s+=`<circle cx="${W(cx)}" cy="${W(cy)}" r="3.5" fill="${GOOD}"><title>${esc(items[i][0])} · acumulado: ${lbl}</title></circle>`;});
  s+='</svg>'; s+='<div class="legend">'+`<span class="lg"><i style="background:${SER[0]}"></i>Valor</span>`
    +`<span class="lg" style="color:${GOOD}"><i style="background:${GOOD}"></i>% acumulado</span>`+'</div>';
  return s;}

function shade(hex,f){ hex=hex.replace('#',''); const n=parseInt(hex,16);
  const r=Math.round(((n>>16)&255)*f),g=Math.round(((n>>8)&255)*f),b=Math.round((n&255)*f);
  return '#'+[r,g,b].map(v=>Math.max(0,Math.min(255,v)).toString(16).padStart(2,'0')).join('');}

function pie3D(items,o={}){ const {valfmt=mi,w=260,colorOf=null,extraHeader=null,extraCol=null}=o; const pad=6,rx=w/2-pad,ry=rx*0.55,depth=ry*0.85;
  const cx=w/2,cy=pad+ry+2,h=cy+ry+depth+pad; const tot=items.reduce((a,i)=>a+ +i[1],0)||1;
  const col=(nm,i)=>colorOf?colorOf(nm,i):SER[i%8];
  const pt=(ang,cyy)=>[cx+rx*Math.cos(ang),cyy+ry*Math.sin(ang)];
  let a0=-Math.PI/2; const slices=items.map((it,i)=>{const fr=(+it[1])/tot,a1=a0+fr*2*Math.PI,s={a0,a1,i,it}; a0=a1; return s;});
  let svg=`<svg viewBox="0 0 ${w} ${h}" class="chart" style="max-width:${w}px;height:auto;flex:0 0 auto">`;
  slices.forEach(s=>{ if(Math.sin((s.a0+s.a1)/2)<=-0.02) return; // paredes só das fatias voltadas para a frente
    const lg=(s.a1-s.a0)>Math.PI?1:0; const [x0,y0]=pt(s.a0,cy),[x1,y1]=pt(s.a1,cy);
    svg+=`<path d="M${W(x0)},${W(y0)} L${W(x0)},${W(y0+depth)} A${W(rx)},${W(ry)} 0 ${lg} 1 ${W(x1)},${W(y1+depth)} L${W(x1)},${W(y1)} A${W(rx)},${W(ry)} 0 ${lg} 0 ${W(x0)},${W(y0)} Z" fill="${shade(col(s.it[0],s.i),0.6)}" data-cat="${esc(s.it[0])}"/>`;});
  slices.forEach(s=>{ const lg=(s.a1-s.a0)>Math.PI?1:0; const [x0,y0]=pt(s.a0,cy),[x1,y1]=pt(s.a1,cy);
    svg+=`<path d="M${W(cx)},${W(cy)} L${W(x0)},${W(y0)} A${W(rx)},${W(ry)} 0 ${lg} 1 ${W(x1)},${W(y1)} Z" fill="${col(s.it[0],s.i)}" stroke="#fff" stroke-width="1.4" data-cat="${esc(s.it[0])}"><title>${esc(s.it[0])}: ${esc(valfmt(+s.it[1]))}</title></path>`;});
  svg+='</svg>';
  const legend='<div class="pielegend'+(extraCol?' with-extra':'')+'">'
    +(extraHeader?`<div class="pl-row pl-head"><i></i><span class="pl-name"></span><span class="pl-pct"></span><span class="pl-val"></span><span class="pl-extra">${esc(extraHeader)}</span></div>`:'')
    +items.map((it,i)=>`<div class="pl-row" data-cat="${esc(it[0])}"><i style="background:${col(it[0],i)}"></i><span class="pl-name">${esc(it[0])}</span><span class="pl-pct">${pct((+it[1])/tot,1)}</span><span class="pl-val">${esc(valfmt(+it[1]))}</span>${extraCol?`<span class="pl-extra">${extraCol(it,i)}</span>`:''}</div>`).join('')+'</div>';
  return `<div class="piewrap">${svg}${legend}</div>`;}

/* table(headers, rows, aligns, foot, ins): `ins` e um destaque de insights.js
   (ou null). A regua entra logo abaixo do quadro, do mesmo jeito que num grafico. */
function table(headers,rows,aligns,foot,ins){ aligns=aligns||['left'].concat(headers.slice(1).map(_=>'right'));
  let s='<div class="tw"><table class="dt"><thead><tr>'+headers.map((h,i)=>`<th class="${aligns[i]}">${h}</th>`).join('')+'</tr></thead><tbody>';
  s+=rows.map(r=>'<tr>'+r.map((c,i)=>`<td class="${aligns[i]}">${c==null?'':c}</td>`).join('')+'</tr>').join('');
  s+='</tbody>'; if(foot) s+='<tfoot><tr>'+foot.map((c,i)=>`<td class="${aligns[i]}">${c==null?'':c}</td>`).join('')+'</tr></tfoot>';
  s+='</table></div>';
  if(ins&&window.INSRT) s+='<div class="tw-ins">'+INSRT.strip(ins)+'</div>';
  return s;}

function deltaHtml(v){ if(v==null||v==='')return''; v=+v; return `<span style="color:${v>=0?GOOD:BAD};font-weight:600">${spct(v)}</span>`;}

/* delta de CUSTO: subir é ruim (vermelho), cair é bom (verde) */
function deltaCost(v){ if(v==null||!isFinite(v))return'—'; v=+v; return `<span style="color:${v<=0?GOOD:BAD};font-weight:600">${spct(v)}</span>`;}

/* sparkline: tendência em miniatura para células de tabela */
function spark(vals,color){ const w=92,h=26,n=vals.length; if(n<2) return '';
  const mx=Math.max(...vals),mn=Math.min(...vals); const span=(mx-mn)||1;
  const X=i=>3+i*(w-8)/(n-1), Y=v=>h-4-(h-8)*((v-mn)/span);
  const pts=vals.map((v,i)=>`${W(X(i))},${W(Y(v))}`).join(' ');
  return `<svg viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" style="vertical-align:middle;display:inline-block">
    <polyline points="${pts}" fill="none" stroke="${color}" stroke-width="1.6" stroke-linejoin="round" stroke-linecap="round"/>
    <circle cx="${W(X(n-1))}" cy="${W(Y(vals[n-1]))}" r="2.4" fill="${color}"/></svg>`;}

/* ===== ferramentas de tabela: ordenar pelo cabeçalho + exportar CSV ===== */
function _cellNum(t){
  t=t.replace(/ /g,' ').trim();
  if(!/\d/.test(t)) return null;
  if(/\d{2}\/\d{2}\/\d{4}/.test(t)) return null; // datas ordenam como texto
  const n=parseFloat(t.replace(/[R$\s%]/g,'').replace(/\./g,'').replace(',','.'));
  return isNaN(n)?null:n;
}

function setupTableTools(){
  // ordenar: clique no cabeçalho (delegado — funciona em tabelas re-renderizadas)
  document.addEventListener('click',e=>{
    const th=e.target.closest('#main table.dt thead th'); if(!th) return;
    const tableEl=th.closest('table'); const tb=tableEl.tBodies[0];
    if(!tb||tb.rows.length<2) return;
    const idx=[...th.parentNode.children].indexOf(th);
    const dir=th.dataset.dir==='asc'?'desc':'asc';
    tableEl.querySelectorAll('thead th').forEach(h=>{delete h.dataset.dir;h.classList.remove('s-asc','s-desc');});
    th.dataset.dir=dir; th.classList.add(dir==='asc'?'s-asc':'s-desc');
    const rows=[...tb.rows];
    rows.sort((r1,r2)=>{
      const a=r1.cells[idx],b=r2.cells[idx]; if(!a||!b) return 0;
      const na=_cellNum(a.textContent),nb=_cellNum(b.textContent); let c;
      if(na!=null&&nb!=null) c=na-nb;
      else c=a.textContent.trim().localeCompare(b.textContent.trim(),'pt-BR');
      return dir==='asc'?c:-c;
    });
    rows.forEach(r=>tb.appendChild(r));
  });
  // chip CSV em cada tabela (inclusive as re-renderizadas por filtros)
  addCsvChips();
  new MutationObserver(muts=>{ if(muts.some(m=>m.addedNodes.length)) addCsvChips(); })
    .observe(document.getElementById('main'),{childList:true,subtree:true});
}

function addCsvChips(){
  document.querySelectorAll('#main .tw:not([data-tools])').forEach(tw=>{
    tw.dataset.tools='1';
    const b=document.createElement('button'); b.className='csvbtn'; b.type='button';
    b.textContent='CSV'; b.title='Exportar esta tabela (abre no Excel)';
    b.addEventListener('click',()=>exportCsv(tw));
    tw.appendChild(b);
  });
}

function exportCsv(tw){
  const t=tw.querySelector('table'); if(!t) return;
  const cell=s=>{s=s.replace(/ /g,' ').replace(/\s+/g,' ').trim();
    return /[;"\n]/.test(s)?'"'+s.replace(/"/g,'""')+'"':s;};
  const lines=[...t.rows].map(r=>[...r.cells].map(c=>cell(c.textContent)).join(';'));
  const sec=tw.closest('section');
  const name=((sec&&sec.querySelector('h2'))?sec.querySelector('h2').textContent:'tabela')
    .toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/[^a-z0-9]+/g,'_').replace(/^_|_$/g,'').slice(0,40);
  const blob=new Blob(['﻿'+lines.join('\r\n')],{type:'text/csv;charset=utf-8'});
  const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download='55design_'+(name||'tabela')+'.csv';
  document.body.appendChild(a); a.click();
  setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove();},150);
}

/* ================= RENDER HELPERS ================= */
const kpi=(l,v,s='',t='')=>`<div class="kpi${t?' '+t:''}"><div class="kpi-l">${l}</div><div class="kpi-v">${v}</div><div class="kpi-s">${s}</div></div>`;

const call=(t,k='note')=>{const ic={note:'ℹ',ok:'✓',warn:'▲',recon:'⇄'}[k]||'ℹ'; return `<div class="callout ${k}"><span class="ci">${ic}</span><div>${t}</div></div>`;};

/* H3(titulo, tag, blk): `blk` e o identificador do bloco — o roteiro da apresentacao
   liga/desliga o conteudo por esse id (ver marcarBlocos). Sem `blk` nada muda. */
const H3=(t,tag='',blk='')=>`<h3${blk?` data-blk="${blk}"`:''}>${esc(t)}${tag?`<span class="tag">${tag}</span>`:''}</h3>`;

/* fig(html, ins): `ins` e um destaque calculado por insights.js (ou null).
   A regua entra no pe da figura; sem destaque a figura sai como antes. */
const fig=(h,ins,blk)=>`<div class="fig"${blk?` data-blk="${blk}"`:''}>${h}<button class="figzoom" type="button" aria-label="Ampliar gráfico" title="Ampliar para apresentação">⤢</button>${(ins&&window.INSRT)?INSRT.strip(ins):''}</div>`;

const cap=t=>`<p class="cap">${t}</p>`;

/* B(id, html): da nome a um trecho que nao tem H3 proprio (uma tabela solta, um par de
   KPIs), para o roteiro conseguir enderecar so aquele pedaco da secao. */
const B=(blk,html)=>`<div class="blk" data-blk="${blk}">${html}</div>`;

function ymList(a,b){const out=[];let y=Math.floor(a/100),m=a%100;while(y*100+m<=b){out.push(y*100+m);m++;if(m>12){m=1;y++;}}return out;}

const ymLab=ym=>MES[(ym%100)-1]+'/'+String(Math.floor(ym/100)).slice(2);

function ymShift(ym,delta){ let y=Math.floor(ym/100),m=(ym%100)+delta; while(m<1){m+=12;y--;} while(m>12){m-=12;y++;} return y*100+m; }

/* ---- Junho 2026 (fixed) ---- */
/* ---- Análise mensal (dinâmica, com seletor de mês) ---- */
const MES_LONGO=['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];

function mesLongo(ym){ return MES_LONGO[(ym%100)-1]+' / '+Math.floor(ym/100); }

/* ---- Custos de Produção / CPV (dinâmico por período) ---- */
function custosMesLab(ym){ return MES[(ym%100)-1]+'/'+String(Math.floor(ym/100)).slice(2); }

/* ===== Custos — Visão Executiva (custosx): os pontos que importam, prontos p/ apresentação ===== */
function ymAddMonths(ym,k){ let y=Math.floor(ym/100),m=(ym%100)-1+k; y+=Math.floor(m/12); m=((m%12)+12)%12; return y*100+m+1; }

function marcarEm(raiz,st){
  const filhos=[...raiz.children];
  for(const el of filhos){
    if(el.classList.contains('chap')) continue;
    if(el.dataset.blk){ st.k=el.dataset.blk; el.dataset.blkOf=st.k; continue; }
    const hs=el.querySelectorAll?el.querySelectorAll('h3[data-blk]'):[];
    if(hs.length===1){ st.k=hs[0].dataset.blk; el.dataset.blkOf=st.k; continue; }
    if(hs.length>1){ el.dataset.blkbox='1'; delete el.dataset.blkOf; marcarEm(el,st); continue; }
    el.dataset.blkOf=st.k;
  }
}

/* ===== zoom nas tabelas: envolve cada .tw num .twz e pendura o botão ⤢, igual aos gráficos.
   Feito por observador porque as tabelas são re-renderizadas pelos filtros. ===== */
function decorateTables(){
  document.querySelectorAll('#main .tw').forEach(tw=>{
    const par=tw.parentElement; if(!par||par.classList.contains('twz')) return;
    const box=document.createElement('div'); box.className='twz';
    par.insertBefore(box,tw); box.appendChild(tw);
    const b=document.createElement('button'); b.type='button'; b.className='twzoom';
    b.setAttribute('aria-label','Ampliar tabela'); b.title='Ampliar para apresentação — zoom e laser';
    b.textContent='⤢'; box.appendChild(b);
  });
}

function setupTableZoom(){
  const main=document.getElementById('main'); if(!main) return;
  decorateTables();
  // setTimeout (e não requestAnimationFrame): rAF não dispara com a aba em segundo plano,
  // e as tabelas re-renderizadas ficariam sem o botão até a aba voltar ao primeiro plano.
  let pend=false;
  new MutationObserver(()=>{ if(pend) return; pend=true;
    setTimeout(()=>{ pend=false; decorateTables(); },0); }).observe(main,{childList:true,subtree:true});
}

/* clique no ⤢ de qualquer gráfico OU tabela amplia numa camada, para leitura em apresentação.
   Em tabela a camada ganha controle de corpo (A− / A+) e o ponteiro laser. */
function setupChartZoom(){
  const modal=document.createElement('div'); modal.id='chartzoom';
  modal.innerHTML='<button id="chartzoom-close" type="button" aria-label="Fechar">✕</button>'
    +'<div id="chartzoom-tools">'
    +'<button class="cz-t" data-z="out" type="button" title="Diminuir (tecla −)">A−</button>'
    +'<span id="chartzoom-lvl">100%</span>'
    +'<button class="cz-t" data-z="in" type="button" title="Aumentar (tecla +)">A+</button>'
    +'<button class="cz-t" id="chartzoom-laser" type="button" title="Ponteiro laser (tecla L)">● Laser</button>'
    +'<button class="cz-t cz-linebtn" id="chartzoom-venda-toggle" type="button" style="display:none" data-alvo="evolcombo-leftline" data-fig="cart-hist-chart" title="Mostrar/ocultar venda contratada">Venda contratada</button>'
    +'<button class="cz-t cz-linebtn" id="chartzoom-cart-toggle" type="button" style="display:none" data-alvo="evolcombo-dash" data-fig="cart-hist-chart" title="Mostrar/ocultar meses de carteira">Meses de carteira</button>'
    +'<button class="cz-t cz-linebtn" id="chartzoom-fat6m-toggle" type="button" style="display:none" data-alvo="evolcombo-fat6m" data-fig="cart-hist-chart" title="Faturamento médio dos últimos 6 meses (DRE) — denominador dos meses de carteira">Média faturamento 6M</button>'
    +'<button class="cz-t cz-linebtn" id="chartzoom-pesfac-toggle" type="button" style="display:none" data-alvo="cf-pesfac" data-fig="cf-cat-chart" title="Quanto Pessoal + Facilities representam do custo fixo do mês">Pessoal + Facilities (%)</button>'
    +'<button class="cz-t cz-linebtn" id="chartzoom-projhist-toggle" type="button" style="display:none" data-alvo="perf-projhist" data-fig="perf-cenarios" title="Para onde a empresa vai, mantido o comportamento histórico">Projeção histórica</button>'
    +'<button class="cz-t cz-linebtn" id="chartzoom-projcagr-toggle" type="button" style="display:none" data-alvo="perf-projcagr" data-fig="perf-cenarios" title="Onde estaria mantendo o próprio CAGR">Ritmo CAGR</button>'
    +'</div><div id="chartzoom-body"></div>';
  document.body.appendChild(modal);
  const body=modal.querySelector('#chartzoom-body'), lvl=modal.querySelector('#chartzoom-lvl');
  const PASSOS=[13,15,17,20,23,27,32,38], BASE=13; let zi=2, laserAntes=false;
  const aplicaZ=()=>{ body.style.setProperty('--tz',PASSOS[zi]+'px');
    lvl.textContent=Math.round(PASSOS[zi]/BASE*100)+'%'; };
  const passo=d=>{ zi=Math.max(0,Math.min(PASSOS.length-1,zi+d)); aplicaZ(); };
  const close=()=>{ modal.classList.remove('on'); body.innerHTML='';
    window.setLaser&&window.setLaser(laserAntes); };
  modal.querySelector('#chartzoom-close').addEventListener('click',close);
  modal.addEventListener('click',e=>{ if(e.target===modal) close(); });
  modal.querySelectorAll('.cz-t[data-z]').forEach(b=>
    b.addEventListener('click',()=>passo(b.dataset.z==='in'?1:-1)));
  modal.querySelector('#chartzoom-laser').addEventListener('click',()=>window.toggleLaser&&window.toggleLaser());
  // um botão por linha sobreposta (venda contratada · meses de carteira): só aparecem quando o
  // gráfico ampliado é o de Carteira em aberto/período; operam sobre o clone dentro do modal.
  const lineBtns=[...modal.querySelectorAll('.cz-linebtn')];
  lineBtns.forEach(b=>b.addEventListener('click',()=>{
    const on=b.classList.toggle('on');
    body.querySelectorAll('.'+b.dataset.alvo).forEach(g=>{g.style.display=on?'':'none';});
  }));
  document.addEventListener('keydown',e=>{
    if(!modal.classList.contains('on')) return;
    if(e.key==='Escape'){ close(); return; }
    if(!modal.classList.contains('mode-table')) return;
    if(e.key==='+'||e.key==='='){ e.preventDefault(); passo(1); }
    else if(e.key==='-'||e.key==='_'){ e.preventDefault(); passo(-1); }
  });
  document.getElementById('main').addEventListener('click',e=>{
    const tb=e.target.closest('.twzoom'), fb=tb?null:e.target.closest('.figzoom');
    if(!tb&&!fb) return;
    const anchor=tb?tb.closest('.twz'):fb.closest('.fig');
    const src=tb?(anchor&&anchor.querySelector('.tw')):anchor;
    if(!src) return;
    body.innerHTML='';
    modal.classList.toggle('mode-table',!!tb);
    const titulo=nearestFigTitle(anchor); if(titulo) body.appendChild(titulo.cloneNode(true));
    if(tb){
      // .nzwide carrega a 1ª coluna congelada e o corpo compacto — preservar na camada ampliada
      const holder=document.createElement('div');
      holder.className='cz-table'+(src.closest('.nzwide')?' nzwide':'');
      holder.appendChild(src.cloneNode(true)); body.appendChild(holder);
      // a régua do quadro fica FORA do .twz (que embrulha só a .tw): é o irmão
      // seguinte do wrapper. Sem buscar ali, a tabela ampliada sai sem análise.
      const prox=anchor&&anchor.nextElementSibling;
      const reg=(prox&&prox.classList.contains('tw-ins'))?prox:(anchor&&anchor.querySelector('.tw-ins'));
      if(reg) body.appendChild(reg.cloneNode(true));
      zi=2; aplicaZ();
    } else {
      const clone=src.cloneNode(true); const zb=clone.querySelector('.figzoom'); if(zb) zb.remove();
      body.appendChild(clone);
    }
    // cada botão de linha declara (data-fig) a qual gráfico pertence e só aparece quando é esse
    // o gráfico ampliado. Começam desligados, como na página: o gráfico abre limpo e cada camada
    // entra quando o apresentador clica no seu botão.
    lineBtns.forEach(b=>{
      const meu=!!(anchor&&b.dataset.fig&&anchor.closest('#'+b.dataset.fig));
      b.style.display=meu?'':'none';
      if(meu){ b.classList.remove('on');
        body.querySelectorAll('.'+b.dataset.alvo).forEach(g=>{g.style.display='none';}); } });
    // o laser acende sozinho ao ampliar — ampliar é justamente o momento de apontar.
    // O botão ● Laser (ou a tecla L) desliga; ao fechar, volta ao estado anterior.
    // as réguas clonadas chegam sem eventos; religa os cliques na cópia
    if(window.INSRT&&INSRT.rehydrate) INSRT.rehydrate(body);
    laserAntes=document.body.classList.contains('laser-on');
    window.setLaser&&window.setLaser(true);
    modal.classList.add('on');
  });
}

/* waterfall (supports negatives) */
function waterfall(steps,o={}){ const {valfmt=v=>mi(v,1),w=940,h=380}=o; const pt=20,pr=16,pb=64,pl=68,pw=w-pl-pr,ph=h-pt-pb;
  let run=0; const bars=[];
  for(const s of steps){ if(s.type==='t'){ bars.push({label:s.label,lo:Math.min(0,s.value),hi:Math.max(0,s.value),val:s.value,c:SER[0]}); run=s.value; }
    else { const nv=run+s.value; bars.push({label:s.label,lo:Math.min(run,nv),hi:Math.max(run,nv),val:s.value,c:s.value>=0?GOOD:BAD}); run=nv; } }
  const lo=Math.min(0,...bars.map(b=>b.lo)),hi=Math.max(...bars.map(b=>b.hi)); const span=(hi-lo)||1;
  const Y=v=>pt+ph-ph*(v-lo)/span; const n=bars.length,gap=10,bw=(pw-gap*(n-1))/n;
  let s=`<svg viewBox="0 0 ${w} ${h}" class="chart" style="max-width:100%;height:auto">`;
  // zero line + grid
  for(let g=0;g<=4;g++){const yv=lo+span*g/4,yy=Y(yv); s+=`<line x1="${pl}" y1="${W(yy)}" x2="${pl+pw}" y2="${W(yy)}" stroke="${GRID}"/>`;
    s+=`<text x="${pl-8}" y="${W(yy+4)}" text-anchor="end" font-size="10.5" fill="${MUT}">${esc(valfmt(yv))}</text>`;}
  s+=`<line x1="${pl}" y1="${W(Y(0))}" x2="${pl+pw}" y2="${W(Y(0))}" stroke="${BASE}" stroke-width="1.5"/>`;
  bars.forEach((b,i)=>{const x=pl+i*(bw+gap),yhi=Y(b.hi),yl=Y(b.lo),bh=Math.max(1,yl-yhi);
    s+=`<rect x="${W(x)}" y="${W(yhi)}" width="${W(bw)}" height="${W(bh)}" rx="3" fill="${b.c}"><title>${esc(b.label)}: ${esc(valfmt(b.val))}</title></rect>`;
    s+=`<text x="${W(x+bw/2)}" y="${W(yhi-5)}" text-anchor="middle" font-size="10" font-weight="600" fill="${INK}">${esc(valfmt(b.val))}</text>`;
    // wrapped label
    const words=b.label.split(' '); let ln=[],lines=[];
    words.forEach(wd=>{ if((ln.join(' ')+' '+wd).length>13){lines.push(ln.join(' '));ln=[wd];}else ln.push(wd);}); if(ln.length)lines.push(ln.join(' '));
    lines.slice(0,3).forEach((L,li)=> s+=`<text x="${W(x+bw/2)}" y="${h-pb+14+li*11}" text-anchor="middle" font-size="9.5" fill="${INK2}">${esc(L)}</text>`);
  });
  return s+'</svg>';}

/* stacked columns (monthly) */
/* linhaPct: {name, values (fracoes 0..1), color, cls} — linha tracejada num eixo proprio de
   0 a 100% a direita, desenhada por cima das barras e ESCONDIDA por padrao. O grupo recebe a
   classe 'cls' para que o botao da tela de zoom a ligue e desligue, igual as linhas do
   Carteira em aberto. Os rotulos ficam ACIMA do ponto (dy negativo em boxLabel). */
function stackedCols(labels,series,o={}){ const {valfmt=v=>mi(v,1),w=980,h=320,subLabels=null,subTitle=null,linhaPct=null}=o;
  const pb=subLabels?54:40; const pt=18,pr=linhaPct?54:14,pl=64,pw=w-pl-pr,ph=h-pt-pb;
  const n=labels.length; const totals=labels.map((_,i)=>series.reduce((a,s)=>a+(s.values[i]||0),0)); const vmax=Math.max(...totals,1);
  const gap=8,bw=(pw-gap*(n-1))/n; let s=`<svg viewBox="0 0 ${w} ${h}" class="chart" style="max-width:${w}px;width:100%;height:auto">`;
  for(let g=0;g<5;g++){const yv=vmax*g/4,yy=pt+ph-ph*g/4; s+=`<line x1="${pl}" y1="${W(yy)}" x2="${pl+pw}" y2="${W(yy)}" stroke="${GRID}"/>`;
    s+=`<text x="${pl-8}" y="${W(yy+4)}" text-anchor="end" font-size="10.5" fill="${MUT}">${esc(valfmt(yv))}</text>`;}
  labels.forEach((lb,i)=>{let acc=0; const x=pl+i*(bw+gap);
    series.forEach((se,si)=>{const v=se.values[i]||0; const bh=ph*v/vmax; const y=pt+ph-ph*(acc+v)/vmax;
      s+=`<rect x="${W(x)}" y="${W(y)}" width="${W(bw)}" height="${W(bh)}" fill="${se.color}"><title>${esc(lb)} · ${esc(se.name)}: ${esc(valfmt(v))} (${pct(totals[i]?v/totals[i]:0,1)} do período)</title></rect>`;
      // valor dentro do proprio pacote, como no evolCombo. Faixa baixa demais nao recebe
      // rotulo: o texto sairia por cima do pacote vizinho em vez de identificar o seu.
      if(v>0&&bh>13) s+=`<text x="${W(x+bw/2)}" y="${W(y+bh/2+3.5)}" text-anchor="middle" font-size="9" font-weight="600" fill="#fff">${esc(valfmt(v))}</text>`;
      acc+=v;});
    /* sem total no topo da barra: o espaco acima e onde ficam os rotulos da linha de %
       (Pessoal + Facilities), e os dois se sobrepunham em 5 dos 12 meses. */
    s+=`<text x="${W(x+bw/2)}" y="${h-pb+16}" text-anchor="middle" font-size="9.5" fill="${MUT}">${esc(lb)}</text>`;
    if(subLabels) s+=`<text x="${W(x+bw/2)}" y="${h-pb+30}" text-anchor="middle" font-size="9" font-weight="600" fill="${INK2}">${esc(subLabels[i])}</text>`;});
  if(subTitle) s+=`<text x="${W(pl-8)}" y="${h-pb+30}" text-anchor="end" font-size="9" fill="${MUT}">${esc(subTitle)}</text>`;
  if(linhaPct){
    const Xc=i=>pl+i*(bw+gap)+bw/2, Yp=v=>pt+ph-ph*Math.max(0,Math.min(1,v));
    s+=`<g class="${esc(linhaPct.cls)}" style="display:none">`;
    for(let g=0;g<=4;g++){ const fv=g/4;
      s+=`<text x="${W(pl+pw+10)}" y="${W(Yp(fv)+4)}" font-size="10" fill="${MUT}">${pct(fv,0)}</text>`; }
    s+=`<polyline points="${labels.map((_,i)=>`${W(Xc(i))},${W(Yp(linhaPct.values[i]||0))}`).join(' ')}" fill="none" stroke="${linhaPct.color}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" stroke-dasharray="7 5"/>`;
    labels.forEach((lb,i)=>{ const v=linhaPct.values[i]||0;
      s+=`<circle cx="${W(Xc(i))}" cy="${W(Yp(v))}" r="2.8" fill="${linhaPct.color}"><title>${esc(lb)} · ${esc(linhaPct.name)}: ${pct(v,1)}</title></circle>`; });
    labels.forEach((_,i)=>{ s+=boxLabel(Xc(i),Yp(linhaPct.values[i]||0),pct(linhaPct.values[i]||0,0),linhaPct.color,-12,w); });
    s+='</g>';
  }
  s+='</svg>'; s+='<div class="legend">'+series.map(se=>`<span class="lg"><i style="background:${se.color}"></i>${esc(se.name)}</span>`).join('')
    +(linhaPct?`<span class="lg" data-linha="${esc(linhaPct.cls)}"><i style="background:${linhaPct.color}"></i>${esc(linhaPct.name)} (eixo dir., tracejada)</span>`:'')+'</div>';
  return s;}

/* Barras empilhadas (eixo esq.) + área sombreada do acumulado (eixo dir., atrás das barras), com labels de valor. */
function evolCombo(labels,series,acum,o={}){ const {valfmt=v=>mi(v,1),acumfmt=valfmt,w=980,h=340,dashName='Acumulado',dashArea=true,dashColor=MUT,dashLabels=false,leftLine=null,linesHidden=false}=o;
  /* leftLine aceita uma linha ou varias: cada uma ganha seu proprio <g class=cls> para que a
     tela de zoom ligue e desligue uma de cada vez. cls default mantem o nome antigo, para o
     botao "Venda contratada" que ja existia continuar achando o grupo. */
  const LL=(leftLine?(Array.isArray(leftLine)?leftLine:[leftLine]):[])
    .map((l,i)=>Object.assign({cls:i?'evolcombo-leftline'+i:'evolcombo-leftline'},l));
  const pt=34,pr=64,pb=40,pl=64,pw=w-pl-pr,ph=h-pt-pb;
  const n=labels.length; const totals=labels.map((_,i)=>series.reduce((a,se)=>a+(se.values[i]||0),0));
  const vmax=Math.max(...totals,...[].concat(...LL.map(l=>l.values)),1)*1.18, amax=Math.max(...acum,1)*1.05;
  const gap=8,bw=(pw-gap*(n-1))/n;
  const X=i=>pl+i*(bw+gap)+bw/2, Ya=v=>pt+ph-ph*v/amax, YB=v=>pt+ph-ph*v/vmax;
  // "poluído": pouco espaço horizontal por ponto para caber a caixinha de valor (~46px) sem colidir
  const apertado=(bw+gap)<46;
  let s=`<svg viewBox="0 0 ${w} ${h}" class="chart" style="max-width:${w}px;width:100%;height:auto">`;
  for(let g=0;g<5;g++){const yv=vmax*g/4,yy=pt+ph-ph*g/4; s+=`<line x1="${pl}" y1="${W(yy)}" x2="${pl+pw}" y2="${W(yy)}" stroke="${GRID}"/>`;
    s+=`<text x="${pl-8}" y="${W(yy+4)}" text-anchor="end" font-size="10.5" fill="${MUT}">${esc(valfmt(yv))}</text>`;}
  /* grupo "evolcombo-dash": eixo direito + linha (com ou sem área) do acumulado — agrupados
     para poder ser escondidos de uma vez por um botão de toggle (ex.: Carteira em aberto/
     período). Com dashArea=false a linha some da área preenchida e passa a ser tracejada na cor
     dashColor, desenhada DEPOIS das barras (na frente), em vez de atrás. dashLabels acrescenta a
     etiqueta de valor em cada ponto, só quando o espaço por mês permite (ver `apertado`) — evita
     poluir o gráfico em períodos longos. */
  const dashSvg=()=>{ let d=`<g class="evolcombo-dash"${linesHidden?' style="display:none"':''}>`;
    for(let g=0;g<=4;g++){const av=amax*g/4; d+=`<text x="${W(pl+pw+10)}" y="${W(Ya(av)+4)}" font-size="10" fill="${MUT}">${esc(acumfmt(av))}</text>`;}
    if(dashArea){ const areaPts=[`${W(pl)},${W(pt+ph)}`].concat(labels.map((_,i)=>`${W(X(i))},${W(Ya(acum[i]))}`)).concat([`${W(pl+pw)},${W(pt+ph)}`]);
      d+=`<polygon points="${areaPts.join(' ')}" fill="${GRID}"/>`; }
    d+=`<polyline points="${labels.map((_,i)=>`${W(X(i))},${W(Ya(acum[i]))}`).join(' ')}" fill="none" stroke="${dashColor}" stroke-width="${dashArea?1.4:2.2}" stroke-linecap="round" stroke-dasharray="${dashArea?'3 3':'7 5'}"/>`;
    if(dashLabels&&!apertado) labels.forEach((_,i)=>{ d+=boxLabel(X(i),Ya(acum[i]),acumfmt(acum[i]),dashColor,-12,w); });
    return d+'</g>'; };
  if(dashArea) s+=dashSvg();
  labels.forEach((lb,i)=>{let acc=0; const x=pl+i*(bw+gap);
    series.forEach(se=>{const v=se.values[i]||0; const bh=Math.max(0,ph*v/vmax); const y=pt+ph-ph*(acc+Math.max(0,v))/vmax;
      s+=`<rect x="${W(x)}" y="${W(y)}" width="${W(bw)}" height="${W(bh)}" fill="${se.color}"><title>${esc(lb)} · ${esc(se.name)}: ${esc(valfmt(v))}${se===series[series.length-1]?' · '+esc(dashName)+': '+esc(acumfmt(acum[i])):''}</title></rect>`;
      if(v>0 && bh>13) s+=`<text x="${W(x+bw/2)}" y="${W(y+bh/2+3.5)}" text-anchor="middle" font-size="9" font-weight="600" fill="#fff">${esc(valfmt(v))}</text>`;
      acc+=v;});
    if(acc>0) s+=`<text x="${W(x+bw/2)}" y="${W(pt+ph-ph*acc/vmax-8)}" text-anchor="middle" font-size="10" font-weight="700" fill="${INK}">${esc(valfmt(acc))}</text>`;
    s+=`<text x="${W(x+bw/2)}" y="${h-pb+16}" text-anchor="middle" font-size="9.5" fill="${MUT}">${esc(lb)}</text>`;});
  /* linha adicional no eixo esquerdo (mesma escala das barras) — ex.: venda contratada ao lado
     da carteira em aberto, para comparar as duas leituras num gráfico só. */
  /* "evolcombo-leftline" tem a mesma função do "evolcombo-dash" — só existe como grupo próprio
     para que o botão de liga/desliga da tela de zoom controle as duas linhas juntas. */
  /* Rotulo SEMPRE acima do ponto. Quando duas linhas quase se tocam, a segunda sobe mais um
     degrau em vez de descer para baixo do ponto: o empilhamento preserva a regra e evita a
     sobreposicao. Como cada linha liga/desliga sozinha, o degrau e calculado como se todas
     estivessem visiveis - no pior caso um rotulo fica um pouco mais alto que o necessario. */
  const ALT=19, dyLL=LL.map(()=>[]), usados=labels.map(()=>[]);
  LL.forEach((L,li)=>labels.forEach((_,i)=>{
    let dy=-12, by=YB(L.values[i]||0)+dy-9, n2=0;
    while(usados[i].some(u=>Math.abs(u-by)<17) && n2<6){ dy-=ALT; by-=ALT; n2++; }
    usados[i].push(by); dyLL[li][i]=dy; }));
  LL.forEach((L,li)=>{ s+=`<g class="${esc(L.cls)}"${linesHidden?' style="display:none"':''}>`;
    const pts=labels.map((_,i)=>`${W(X(i))},${W(YB(L.values[i]||0))}`).join(' ');
    s+=`<polyline points="${pts}" fill="none" stroke="${L.color}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" stroke-dasharray="7 5"/>`;
    labels.forEach((lb,i)=>{ const v=L.values[i]||0;
      s+=`<circle cx="${W(X(i))}" cy="${W(YB(v))}" r="2.8" fill="${L.color}"><title>${esc(lb)} · ${esc(L.name)}: ${esc(valfmt(v))}</title></circle>`; });
    // rotulo SEMPRE acima do ponto (dy negativo), como nas demais linhas do relatorio
    if(!apertado) labels.forEach((_,i)=>{ s+=boxLabel(X(i),YB(L.values[i]||0),valfmt(L.values[i]||0),L.color,dyLL[li][i],w); });
    s+='</g>'; });
  if(!dashArea) s+=dashSvg();
  s+='</svg>'; s+='<div class="legend">'+series.map(se=>`<span class="lg"><i style="background:${se.color}"></i>${esc(se.name)}</span>`).join('')
    +LL.map(L=>`<span class="lg" data-linha="${esc(L.cls)}"><i style="background:${L.color}"></i>${esc(L.name)}</span>`).join('')
    +(dashArea?`<span class="lg"><i style="background:${GRID};border:1px solid ${BASE}"></i>${esc(dashName)} (eixo dir.)</span>`
      :`<span class="lg"><i style="background:${dashColor}"></i>${esc(dashName)} (eixo dir., tracejada)</span>`)+'</div>';
  return s;}

/* área empilhada: cada série já é uma sequência acumulada; empilha em camadas (série1 = base, série2 por cima, ...) */
function stackedArea(labels,series,o={}){ const {valfmt=v=>mi(v,1),w=980,h=340}=o;
  const pt=20,pr=18,pb=40,pl=68,pw=w-pl-pr,ph=h-pt-pb; const n=labels.length;
  const totals=labels.map((_,i)=>series.reduce((a,se)=>a+(se.values[i]||0),0));
  const vmax=Math.max(...totals,1)*1.08;
  const X=i=>pl+(n>1?pw*i/(n-1):pw/2), Y=v=>pt+ph-ph*v/vmax;
  let s=`<svg viewBox="0 0 ${w} ${h}" class="chart" style="max-width:100%;height:auto">`;
  for(let g=0;g<5;g++){const yv=vmax*g/4,yy=Y(yv);
    s+=`<line x1="${pl}" y1="${W(yy)}" x2="${pl+pw}" y2="${W(yy)}" stroke="${GRID}"/>`;
    s+=`<text x="${pl-8}" y="${W(yy+4)}" text-anchor="end" font-size="10.5" fill="${MUT}">${esc(valfmt(yv))}</text>`;}
  const step=Math.max(1,Math.floor(n/12));
  labels.forEach((lb,i)=>{ if(i%step===0||i===n-1) s+=`<text x="${W(X(i))}" y="${h-pb+18}" text-anchor="middle" font-size="10" fill="${MUT}">${esc(lb)}</text>`;});
  let base=labels.map(_=>0);
  series.forEach(se=>{ const top=base.map((b,i)=>b+(se.values[i]||0));
    const topPts=labels.map((_,i)=>`${W(X(i))},${W(Y(top[i]))}`).join(' ');
    const botPts=labels.map((_,i)=>`${W(X(n-1-i))},${W(Y(base[n-1-i]))}`).join(' ');
    s+=`<polygon points="${topPts} ${botPts}" fill="${se.color}" opacity=".85"><title>${esc(se.name)}</title></polygon>`;
    base=top;});
  s+='</svg>'; s+='<div class="legend">'+series.map(se=>`<span class="lg"><i style="background:${se.color}"></i>${esc(se.name)}</span>`).join('')+'</div>';
  return s;}

/* etiqueta em caixinha (fundo branco, borda na cor da série) — mesmo visual que pareto já usa,
   extraído aqui porque areaCum e comboMeta também precisam dele. dy<0 põe acima do ponto. */
function boxLabel(cx,cy,txt,color,dy,wmax){ txt=String(txt); dy=dy==null?-12:dy;
  const lw=txt.length*6.3+12;
  // clampa dentro da área: no primeiro e no último ponto a caixa passaria da borda do SVG
  let bx=cx-lw/2; if(wmax){ bx=Math.max(2,Math.min(bx,wmax-lw-2)); }
  const by=cy+dy-(dy<0?9:-1);
  return `<rect x="${W(bx)}" y="${W(by)}" width="${W(lw)}" height="17" rx="3" fill="#fff" stroke="${color}"/>`
    +`<text x="${W(bx+lw/2)}" y="${W(by+12)}" text-anchor="middle" font-size="10.5" font-weight="600" fill="${color}">${esc(txt)}</text>`;}

/* áreas sobrepostas a partir do zero (NÃO empilhadas) com etiqueta em cada ponto.
   stackedArea não serve aqui: o realizado vive dentro do orçamento, e empilhar somaria os dois. */
function areaCum(labels,series,o={}){ const {valfmt=MILHAR,w=980,h=360,unidade='Milhares'}=o;
  const pt=34,pr=20,pb=46,pl=72,pw=w-pl-pr,ph=h-pt-pb, n=labels.length;
  const all=[].concat(...series.map(se=>se.values.filter(v=>v!=null)));
  const vmax=Math.max(...all,1)*1.12;
  const X=i=>pl+(n>1?pw*i/(n-1):pw/2), Y=v=>pt+ph-ph*v/vmax;
  let s=`<svg viewBox="0 0 ${w} ${h}" class="chart" style="max-width:100%;height:auto">`;
  for(let g=0;g<6;g++){const yv=vmax*g/5,yy=Y(yv);
    s+=`<line x1="${pl}" y1="${W(yy)}" x2="${pl+pw}" y2="${W(yy)}" stroke="${GRID}"/>`;
    s+=`<text x="${pl-8}" y="${W(yy+4)}" text-anchor="end" font-size="10.5" fill="${MUT}">${esc(valfmt(yv))}</text>`;}
  s+=eixoY(14,pt+ph/2,unidade);
  labels.forEach((lb,i)=>{ s+=`<text x="${W(X(i))}" y="${h-pb+18}" text-anchor="middle" font-size="10" fill="${MUT}">${esc(lb)}</text>`;});
  // na ordem recebida: a primeira série fica atrás
  series.forEach(se=>{ const pts=[]; let last=-1;
    se.values.forEach((v,i)=>{ if(v==null) return; pts.push(`${W(X(i))},${W(Y(v))}`); last=i; });
    if(!pts.length) return;
    s+=`<polygon points="${W(X(0))},${W(Y(0))} ${pts.join(' ')} ${W(X(last))},${W(Y(0))}" fill="${se.color}" opacity="${se.opacity==null?.42:se.opacity}"/>`;
    s+=`<polyline points="${pts.join(' ')}" fill="none" stroke="${se.color}" stroke-width="1.8" stroke-linejoin="round"/>`;});
  // etiquetas depois de todas as áreas, para nenhuma ficar soterrada
  series.forEach(se=>{ se.values.forEach((v,i)=>{ if(v==null) return;
    s+=`<circle cx="${W(X(i))}" cy="${W(Y(v))}" r="2.6" fill="${se.color}"><title>${esc(labels[i])} · ${esc(se.name)}: ${esc(mi(v,1))}</title></circle>`;
    s+=boxLabel(X(i),Y(v),valfmt(v),se.color,se.abaixo?16:-12,w);});});
  s+='</svg>';
  return s+'<div class="legend">'+series.map(se=>`<span class="lg"><i style="background:${se.color}"></i>${esc(se.name)}</span>`).join('')+'</div>';}

/* barras num eixo (direita) + linhas noutro (esquerda). Mesmo esqueleto do pareto, que já resolve
   eixo secundário, polyline tracejada e etiqueta em caixinha. */
function comboMeta(labels,o={}){
  const {bars,lines,w=980,h=430,valfmt=MILHAR,barName='GAP',barColor='#ddd5c6',unidade='Milhares'}=o;
  const pt=42,pr=22,pb=58,pl=72,pw=w-pl-pr,ph=h-pt-pb, n=labels.length;
  // eixo unico: barras e linhas na mesma escala. Com dois eixos uma barra de gap de 951
  // ocupava a mesma altura de uma linha de 3.000 e exagerava o tamanho do gap.
  const lmax=Math.max(...[].concat(...lines.map(l=>l.values.filter(v=>v!=null)),
                                   bars.filter(v=>v!=null)),1)*1.18;
  const slot=pw/n, bw=Math.min(52,slot*.52), Xc=i=>pl+slot*i+slot/2;
  const YL=v=>pt+ph-ph*v/lmax;
  let s=`<svg viewBox="0 0 ${w} ${h}" class="chart" style="max-width:100%;height:auto">`;
  for(let g=0;g<6;g++){const yy=pt+ph-ph*g/5;
    s+=`<line x1="${pl}" y1="${W(yy)}" x2="${pl+pw}" y2="${W(yy)}" stroke="${GRID}"/>`;
    s+=`<text x="${pl-8}" y="${W(yy+4)}" text-anchor="end" font-size="10.5" fill="${MUT}">${esc(valfmt(lmax*g/5))}</text>`;}
  s+=eixoY(14,pt+ph/2,unidade);
  labels.forEach((lb,i)=>{ s+=`<text x="${W(Xc(i))}" y="${h-pb+18}" text-anchor="middle" font-size="10" fill="${MUT}">${esc(lb)}</text>`;});
  // barras atrás das linhas
  bars.forEach((v,i)=>{ if(v==null||v<=0) return;
    const y=YL(v),bh=Math.max(2,pt+ph-y),x=Xc(i)-bw/2;
    s+=`<rect x="${W(x)}" y="${W(y)}" width="${W(bw)}" height="${W(bh)}" rx="2" fill="${barColor}"><title>${esc(labels[i])} · ${esc(barName)}: ${esc(mi(v,1))}</title></rect>`;
    const dentro=bh>=24;
    s+=`<text x="${W(Xc(i))}" y="${W(dentro?y+16:y-6)}" text-anchor="middle" font-size="10.5" fill="${INK2}">${esc(valfmt(v))}</text>`;});
  // segmento a segmento (e não uma polyline só): assim dashFrom pode virar o traço no meio da
  // série — sólido no que já aconteceu, tracejado na projeção — sem partir em duas séries.
  /* cada linha sai num <g> próprio quando tem `cls`: é o que permite ligá-la/desligá-la por
     botão (cenários de projeção da Performance Comercial) sem redesenhar o gráfico. A etiqueta
     de valor entra no mesmo grupo, senão ficaria órfã flutuando com a linha escondida. */
  const linhaSvg=l=>{ let d=l.cls?`<g class="${l.cls}"${l.oculta?' style="display:none"':''}>`:'';
    const pts=[]; l.values.forEach((v,i)=>{ if(v!=null) pts.push([i,v]); });
    for(let k=0;k<pts.length-1;k++){ const [i0,v0]=pts[k],[i1,v1]=pts[k+1];
      const dash=l.dash||(l.dashFrom!=null&&i1>l.dashFrom);
      d+=`<line x1="${W(Xc(i0))}" y1="${W(YL(v0))}" x2="${W(Xc(i1))}" y2="${W(YL(v1))}" stroke="${l.color}" stroke-width="2.2" stroke-linecap="round"${dash?' stroke-dasharray="7 5"':''}/>`;}
    pts.forEach(([i,v])=>{ d+=`<circle cx="${W(Xc(i))}" cy="${W(YL(v))}" r="3" fill="${l.color}"><title>${esc(labels[i])} · ${esc(l.name)}: ${esc(mi(v,1))}</title></circle>`;});
    // etiqueta: no mês, o maior valor vai acima e os demais abaixo, para as caixas não colidirem
    if(l.semLabel!==true) pts.forEach(([i,v])=>{
      const viv=lines.map(x=>x.values[i]).filter(x=>x!=null);
      const alto=viv.length>1?Math.max(...viv):null;
      d+=boxLabel(Xc(i),YL(v),valfmt(v),l.color,(alto==null||v===alto)?-12:18,w);});
    return d+(l.cls?'</g>':''); };
  lines.forEach(l=>{ s+=linhaSvg(l); });
  s+='</svg>';
  return s+'<div class="legend">'+`<span class="lg"><i style="background:${barColor}"></i>${esc(barName)}</span>`
    +lines.map(l=>`<span class="lg"${l.cls?` data-linha="${l.cls}"`:''}><i style="background:${l.color}"></i>${esc(l.name)}</span>`).join('')+'</div>';}
