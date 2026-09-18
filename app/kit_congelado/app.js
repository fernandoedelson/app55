/* ===== +55 Design · análise interativa de vendas ===== */
'use strict';
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

/* ================= AGGREGATION ENGINE ================= */
function famName(i){return DATA.fam[i];}
function aggregate(ymMin,ymMax){
  const R=DATA.rows; let total=0,qnt=0; const peds=new Set();
  const V={},D={},A={},CL={},FM={},CLS={},VF={}; const comp={pf:0,dsr:0,prem:0,pj:0,ger:0,cur:0,rt:0,roy:0}; const monthly={};
  const gv=(o,k)=> o[k]||(o[k]={v:0,q:0,peds:new Set(),com:0,extra:0});
  for(const r of R){ const ym=r[0]; if(ym<ymMin||ym>ymMax) continue;
    const v=r[1]; total+=v; qnt+=r[2]; if(r[15]>=0) peds.add(r[15]);
    monthly[ym]=(monthly[ym]||0)+v;
    const vd=gv(V,r[3]); vd.v+=v; vd.q+=r[2]; if(r[15]>=0)vd.peds.add(r[15]); vd.com+=r[9]+r[10]+r[11]+r[12];
    FM[r[4]]=(FM[r[4]]||0)+v; CL[r[5]]=(CL[r[5]]||0)+v; CLS[r[6]]=(CLS[r[6]]||0)+v;
    (VF[r[3]]||(VF[r[3]]={}));(VF[r[3]][r[4]]=(VF[r[3]][r[4]]||0)+v);
    if(r[7]>=0){const d=gv(D,r[7]); d.v+=v; d.extra+=r[8]; if(r[15]>=0)d.peds.add(r[15]);}
    const na=r[16].length;
    for(const a of r[16]){const ar=gv(A,a[0]); ar.extra+=a[1]; ar.v+=v/na; if(r[15]>=0)ar.peds.add(r[15]);}
    comp.pf+=r[9];comp.dsr+=r[10];comp.prem+=r[11];comp.pj+=r[12];comp.ger+=r[13];comp.cur+=r[14];comp.roy+=r[8];
    for(const a of r[16]) comp.rt+=a[1];
  }
  const pedN=peds.size;
  const vend=Object.keys(V).map(k=>{const o=V[k];return{name:DATA.vd[k],idx:+k,v:o.v,q:o.q,peds:o.peds.size,com:o.com,
     ticket:o.peds.size?o.v/o.peds.size:0,titem:o.q?o.v/o.q:0,contrib:total?o.v/total:0,custop:o.v?o.com/o.v:0};}).sort((a,b)=>b.v-a.v);
  const desg=Object.keys(D).map(k=>{const o=D[k];return{name:DATA.ds[k],roy:o.extra,v:o.v,peds:o.peds.size};}).sort((a,b)=>b.roy-a.roy);
  const arqs=Object.keys(A).map(k=>{const o=A[k];return{name:DATA.arq[k],rt:o.extra,v:o.v,peds:o.peds.size};}).sort((a,b)=>b.rt-a.rt);
  const fams=Object.keys(FM).map(k=>({name:DATA.fam[k],v:FM[k]})).sort((a,b)=>b.v-a.v);
  const clis=Object.keys(CL).map(k=>({name:DATA.cl[k],idx:+k,v:CL[k]})).sort((a,b)=>b.v-a.v);
  const clss=Object.keys(CLS).map(k=>({name:DATA.cls[k],v:CLS[k]})).sort((a,b)=>b.v-a.v);
  return {total,qnt,peds:pedN,ticket:pedN?total/pedN:0,vend,desg,arqs,fams,clis,clss,comp,monthly,VF};
}
/* leitura de Pareto: quantos itens do topo de uma lista JÁ ORDENADA desc. concentram `alvo` do total.
   Percorre a lista inteira, não só o que a tabela mostra — o corte costuma cair além do top 10. */
function concentracao(lista,total,alvo){
  if(!total||total<=0||!lista.length) return null;
  let acum=0;
  for(let i=0;i<lista.length;i++){ acum+=lista[i].v;
    if(acum/total>=alvo) return {n:i+1,acum,share:acum/total}; }
  return null;
}
/* Tabela de clientes dimensionada pela leitura de Pareto: vai até alcançar `alvo` do total,
   nunca com menos de `min` linhas, e marca a linha em que o acumulado cruza o alvo.

   Montada à mão em vez de por table(): table() não tem gancho para classe no <tr>, e aqui são
   necessários dois — a linha de corte e (na versão mensal) o clique que abre os itens do cliente.
   O <div class="tw"> externo é mantido porque é dele que o zoom pendura o botão de ampliar.
   `attrs(x)` devolve atributos extras de <tr>; `rotulo` nomeia a coluna de participação. */
function tabelaClientes(clis,total,o={}){
  const {min=10,max=30,alvo=.8,attrs=null,rotulo='% do total'}=o;
  const corte=concentracao(clis,total,alvo);
  // `max` existe porque a regra dos 80% não escala igual nas duas visões: num mês o corte cai
  // em 6–21 clientes, mas num período longo a carteira é pulverizada e chega a exigir 417
  // (histórico completo). Sem teto a tabela deixaria de ser apresentável.
  const n=Math.min(clis.length,Math.max(min,Math.min(corte?corte.n:min,max)));
  const linhas=clis.slice(0,n);
  let acum=0;
  const trs=linhas.map((x,i)=>{ acum+=x.v;
    const ehCorte=corte&&i===corte.n-1;
    const extra=attrs?attrs(x):'';
    const cls=['cli-row',ehCorte?'cut':''].filter(Boolean).join(' ');
    return `<tr class="${cls}"${extra?' '+extra:''}><td class="left">${esc(x.name)}</td>`
      +`<td class="right">${money(x.v)}</td>`
      +`<td class="right">${pct(total?x.v/total:0)}</td>`
      +`<td class="right acum">${pct(total?acum/total:0)}</td></tr>`;}).join('');
  const tab='<div class="tw"><table class="dt"><thead><tr><th class="left">Cliente</th>'
    +`<th class="right">Venda</th><th class="right">${esc(rotulo)}</th><th class="right">% acumulado</th>`
    +`</tr></thead><tbody>${trs}</tbody></table></div>`;
  return {html:tab,n,corte,mostrado:acum,restantes:clis.length-n,
    truncado:!!(corte&&n<corte.n), share:total?acum/total:0};
}
/* itens comprados por um cliente num período — produto, qtd, valor e previsão de entrega */
function clienteItens(cliIdx,ymMin,ymMax){
  return DATA.rows.filter(r=>r[5]===cliIdx&&r[0]>=ymMin&&r[0]<=ymMax)
    .map(r=>[DATA.prod[r[17]],r[2],r[1],r[18]]).sort((a,b)=>b[2]-a[2]);
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
/* Chama uma regra pelo nome, isolando erro de regra individual: um destaque
   quebrado nao pode derrubar o render da secao inteira. */
const ins=(nome,ctx)=>{ try{ return (window.INS&&INS.R[nome])?INS.R[nome](ctx||{}):null; }catch(e){ console.warn('destaque '+nome+':',e); return null; } };
/* Secoes com filtro redesenham o corpo; a camada precisa ser remontada nelas
   para reaplicar o teto por secao e reconstruir o digest. */
const remount=id=>{ const el=document.getElementById(id); if(el&&window.INSRT) INSRT.mount(el); };
const cap=t=>`<p class="cap">${t}</p>`;
/* B(id, html): da nome a um trecho que nao tem H3 proprio (uma tabela solta, um par de
   KPIs), para o roteiro conseguir enderecar so aquele pedaco da secao. */
const B=(blk,html)=>`<div class="blk" data-blk="${blk}">${html}</div>`;
function ymList(a,b){const out=[];let y=Math.floor(a/100),m=a%100;while(y*100+m<=b){out.push(y*100+m);m++;if(m>12){m=1;y++;}}return out;}
const ymLab=ym=>MES[(ym%100)-1]+'/'+String(Math.floor(ym/100)).slice(2);
function ymShift(ym,delta){ let y=Math.floor(ym/100),m=(ym%100)+delta; while(m<1){m+=12;y--;} while(m>12){m-=12;y++;} return y*100+m; }
/* ================= DATAS DE REFERÊNCIA =================
   Nenhuma data do relatório é escrita à mão: tudo sai do último mês com dado de cada base.
   Quando a base de agosto entra, rótulos, presets, anos de comparação e janelas andam sozinhos.

   último mês real da DRE: vem do gerar_relatorio.py (aba _BD). Se não vier, é lido da própria
   série mensal da DRE — nunca de uma constante, que cortaria a DRE num mês velho sem avisar. */
function _ultimoMesSerieDRE(){
  if(!window.DRE) return null;
  const anos=Object.keys(DRE).map(Number).filter(Boolean).sort((a,b)=>a-b);
  for(let k=anos.length-1;k>=0;k--){ const m=(DRE[anos[k]]||{}).months||[];
    for(let i=m.length-1;i>=0;i--) if(m[i]) return anos[k]*100+i+1; }
  return null;
}
/* último mês real da base comercial — calculado a partir dos próprios dados.
   O `window.DATA &&` não é decorativo: no portal Flask os blobs são isolados por perfil, e o
   perfil Fábrica recebe só CUSTOS. Sem a guarda, esta linha de nível de módulo lançava
   ReferenceError e derrubava o app.js inteiro — a seção Custos abria em branco. */
const _MAXYM_VENDAS_BASE=(window.DATA&&DATA.rows&&DATA.rows.length)?DATA.rows.reduce((m,r)=>r[0]>m?r[0]:m,0):null;
const MAXYM_DRE=window.MAXYM_DRE||_ultimoMesSerieDRE()||_MAXYM_VENDAS_BASE;
if(!window.MAXYM_DRE&&(window.DRE||window.DPNL)) console.warn('MAXYM_DRE ausente: último mês da DRE deduzido da série ('+MAXYM_DRE+')');
const MAXYM_VENDAS=_MAXYM_VENDAS_BASE||MAXYM_DRE;
/* base de custos (CPV): começa em jan/2025 hoje, mas o início também é lido do dado */
const _CUSTOS_YMS=(window.CUSTOS&&CUSTOS.cpv&&CUSTOS.cpv.length)?CUSTOS.cpv.map(r=>r[0]):[];
const MINYM_CUSTOS=_CUSTOS_YMS.length?_CUSTOS_YMS.reduce((m,y)=>y<m?y:m,_CUSTOS_YMS[0]):null;
const MAXYM_CUSTOS=_CUSTOS_YMS.length?_CUSTOS_YMS.reduce((m,y)=>y>m?y:m,_CUSTOS_YMS[0]):null;
/* ano corrente de cada base e o anterior — a comparação "ano × ano anterior" usa estes */
const ANO_V=Math.floor((MAXYM_VENDAS||0)/100), ANO_D=Math.floor((MAXYM_DRE||0)/100), ANO_C=Math.floor((MAXYM_CUSTOS||0)/100);
/* começo da história: primeiro mês da base comercial (hoje jul/2020) e primeiro ano da DRE (2020).
   Também saem do dado — a base pode ganhar histórico antigo, e o teste de viagem no tempo
   (ferramentas/viagem_tempo.py) só passa se nem o começo estiver escrito à mão. */
const MINYM_VENDAS=(window.DATA&&DATA.rows&&DATA.rows.length)?DATA.rows.reduce((m,r)=>r[0]<m?r[0]:m,DATA.rows[0][0]):MAXYM_VENDAS;
const _ANOS_DRE=Object.keys(window.DRE||(window.DPNL&&DPNL.CONSOLIDADO)||{}).map(Number).filter(Boolean);
const MINYM_DRE=_ANOS_DRE.length?Math.min(..._ANOS_DRE)*100+1:MINYM_VENDAS;
/* primeiro ano cheio da série comercial: se a base não começa em janeiro, o ano inicial é parcial */
const ANO_INI_SERIE=Math.floor(MINYM_VENDAS/100)+((MINYM_VENDAS%100)===1?0:1);
/* "jul/2020" (mês abreviado minúsculo) e "julho/2020" (por extenso) */
const ymLabAno=ym=>MES[(ym%100)-1].toLowerCase()+'/'+Math.floor(ym/100);
const ymLabExt=ym=>['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro'][(ym%100)-1]+'/'+Math.floor(ym/100);
/* anos fechados da série: de 2021 até o ano anterior ao corrente */
const anosFechados=anoCorrente=>{ const out=[]; for(let y=ANO_INI_SERIE;y<anoCorrente;y++) out.push(y); return out; };
/* "Jan–Jul": rótulo do acumulado do ano até o mês do ym */
const ytdLab=ym=>'Jan–'+MES[(ym%100)-1];

/* ================= SAZONALIDADE E PROJEÇÃO =================
   Fonte única do "peso histórico do mês", usada tanto pela projeção do ano corrente na Evolutiva
   quanto pela meta sazonal e pelas linhas de cenário da Performance Comercial. Escrever a mesma
   conta duas vezes faria as seções divergirem e o painel mostrar dois "projetado" diferentes na
   mesma reunião. Item 1.4 da ata de 26/08/2026: distribuir pelo peso do mês, nunca linearmente. */
const ANOS_SAZ=anosFechados(ANO_V);
/* participação média de cada mês no total anual dos anos fechados informados */
function pesoMensal(monthsByYear,anos=ANOS_SAZ){
  const w=Array(12).fill(0); let n=0;
  anos.forEach(y=>{ const m=monthsByYear[y]; if(!m) return; const tot=m.reduce((a,b)=>a+b,0); if(!tot) return;
    m.forEach((v,i)=>w[i]+=v/tot); n++; });
  return n?w.map(x=>x/n):w;
}
/* venda contratada por ano -> [12 meses], direto da base comercial */
function vendaMensalPorAno(){
  const out={};
  DATA.rows.forEach(r=>{ const y=Math.floor(r[0]/100), m=(r[0]%100)-1;
    (out[y]||(out[y]=Array(12).fill(0)))[m]+=r[1]; });
  return out;
}
/* fração do ano que o histórico já esperava ter acontecido até o mês `mo` (0-based) */
const fracaoDecorrida=(peso,mo)=>peso.slice(0,mo+1).reduce((a,b)=>a+b,0);
/* distribui `total` pelos meses de `idx` conforme o peso histórico de cada um */
function distribuiSazonal(total,peso,idx){
  const soma=idx.reduce((a,m)=>a+peso[m],0);
  const out=Array(12).fill(null);
  idx.forEach(m=>{ out[m]=soma>0?total*peso[m]/soma:total/idx.length; });
  return out;
}
const cagrCalc=(val,base,n)=>(val==null||!base||n<=0)?null:Math.pow(val/base,1/n)-1;
/* frase de abertura da Evolutiva: o ano de pico sai da série; "crescimento consistente" só é dito
   se a venda anual subiu em todos os anos fechados até o pico */
function _leadPicoAnual(){
  const vy=vendaMensalPorAno(), anos=anosFechados(ANO_V).filter(y=>vy[y]);
  if(!anos.length) return '';
  const tot=y=>vy[y].reduce((a,b)=>a+b,0);
  const pico=anos.reduce((p,y)=>tot(y)>tot(p)?y:p,anos[0]);
  const ate=anos.filter(y=>y<=pico);
  const subiu=ate.every((y,i)=>i===0||tot(y)>tot(ate[i-1]));
  return subiu?'Crescimento consistente até o pico de '+pico+'.':'Pico anual em '+pico+'.';
}
/* título do 1º item da leitura executiva do Sumário, pela mesma régua */
function _tituloCrescimento(){
  const f=_leadPicoAnual(), m=f.match(/(\d{4})/);
  if(!m) return 'Evolução das vendas';
  return f.startsWith('Crescimento')?'Crescimento forte até '+m[1]:'Pico de vendas em '+m[1];
}

/* ---- Evolutiva histórica (fixed) ---- */
function renderEvolutiva(){
  const A=aggregate(200001,300000); const yms=ymList(MINYM_VENDAS,MAXYM_VENDAS);
  const vals=yms.map(y=>A.monthly[y]||0);
  let s=`<div class="sec-head"><div class="kick">Visão histórica</div><h2>Evolutiva histórica de vendas</h2>
    <p class="lead">Venda contratada mensal de ${ymLabAno(MINYM_VENDAS)} a ${ymLab(MAXYM_VENDAS)} (base comercial completa, ${nf(DATA.rows.length)} linhas). ${_leadPicoAnual()}</p></div>`;
  s+=fig(line([['Venda contratada',vals,SER[0]]],yms.map(ymLab),{valfmt:v=>mi(v,1),w:980,h:320}),
    ins('vendasPartesRelacionadas'));
  // annual venda vs faturamento DRE
  const yv={}; const vMonth={};
  yms.forEach((ym,i)=>{ const yr=Math.floor(ym/100), mo=(ym%100)-1;
    yv[yr]=(yv[yr]||0)+vals[i];
    (vMonth[yr]||(vMonth[yr]=Array(12).fill(0)))[mo]=vals[i]; });
  const years=anosFechados(ANO_V), A0=ANO_V-1, AI=ANO_INI_SERIE, NA=ANO_V-AI;
  // projeção do ano cheio corrente pela sazonalidade histórica (ver bloco SAZONALIDADE E PROJEÇÃO)
  const dreMonth={}; years.forEach(y=>dreMonth[y]=DRE[y].months);
  const pesoV=pesoMensal(vMonth,years), pesoF=pesoMensal(dreMonth,years);
  /* a DRE só conta como "ano corrente" se o último mês dela é do mesmo ano da base comercial;
     numa virada de ano em que a DRE ainda não fechou janeiro, o ano corrente dela está vazio */
  const moV=(MAXYM_VENDAS%100)-1, moF=ANO_D===ANO_V?(MAXYM_DRE%100)-1:-1;
  const cpV=fracaoDecorrida(pesoV,moV), cpF=fracaoDecorrida(pesoF,moF);
  const v26=yv[ANO_V]||0, f26=(DRE[ANO_V]||{annual:0}).annual;
  const v26proj=cpV>0?v26/cpV:null, f26proj=cpF>0?f26/cpF:null;
  const v25mesmo=(vMonth[A0]||Array(12).fill(0)).slice(0,moV+1).reduce((a,b)=>a+b,0);
  const f25mesmo=((DRE[A0]||{}).months||Array(12).fill(0)).slice(0,moF+1).reduce((a,b)=>a+b,0);
  const cagrHtml=(val,base,n)=>{const c=cagrCalc(val,base,n); return c==null?'—':deltaHtml(c);};
  s+=H3('Venda contratada × faturamento (DRE) — anual','','ev-anual');
  s+=fig(line([
     ['Venda contratada (base)',years.map(y=>yv[y]),SER[0]],
     ['Faturamento — Receita Bruta (DRE)',years.map(y=>DRE[y].annual),SER[2]],
   ],years.map(String),{valfmt:v=>mi(v,1),w:900,h:300}),
    ins('vendasEfeitoPrecoVolume'));
  const rows=years.map((y,i)=>[y,money(yv[y]||0),money(DRE[y].annual),
    i>0?deltaHtml(yv[y]/yv[years[i-1]]-1):'—',
    i>0?deltaHtml(DRE[y].annual/DRE[years[i-1]].annual-1):'—',
    cagrHtml(yv[y],yv[AI],y-AI),
    cagrHtml(DRE[y].annual,DRE[AI].annual,y-AI)]);
  rows.push([`${ANO_V} (realizado até ${ymLab(MAXYM_VENDAS)})`, money(v26), money(f26),
    v25mesmo?deltaHtml(v26/v25mesmo-1):'—', f25mesmo?deltaHtml(f26/f25mesmo-1):'—', '—', '—']);
  rows.push([`${ANO_V} (projetado, ano cheio)`,
    v26proj!=null?money(v26proj):'—', f26proj!=null?money(f26proj):'—',
    (v26proj!=null&&yv[A0])?deltaHtml(v26proj/yv[A0]-1):'—',
    (f26proj!=null&&DRE[A0]&&DRE[A0].annual)?deltaHtml(f26proj/DRE[A0].annual-1):'—',
    v26proj!=null?cagrHtml(v26proj,yv[AI],NA):'—',
    f26proj!=null?cagrHtml(f26proj,DRE[AI].annual,NA):'—']);
  s+=table(['Ano','Venda contratada','Faturamento (DRE)','Var. venda a/a','Var. faturamento a/a',`CAGR venda (desde ${AI})`,`CAGR faturamento (desde ${AI})`],
    rows,['left','right','right','right','right','right','right'],null,
    ins('vendaVsFaturamento',{vendaAnual:yv,proj:{venda:v26proj,fat:f26proj,frac:cpV}}));
  s+=cap((ANO_INI_SERIE>Math.floor(MINYM_VENDAS/100)?Math.floor(MINYM_VENDAS/100)+' (parcial, início em '+MES[(MINYM_VENDAS%100)-1].toLowerCase()+') omitido da comparação anual cheia. ':'')+ANO_V+' traz duas linhas: o <b>realizado</b> até '+ymLab(MAXYM_VENDAS)
    +' (var. a/a contra o mesmo período de '+A0+') e o <b>projetado</b> para o ano cheio — projeção obtida dividindo o realizado pela participação '
    +'histórica média de '+AI+'–'+A0+' dos meses já decorridos no total anual (sazonalidade, não distribuição linear do que falta). '
    +'CAGR = crescimento composto anual desde '+AI+'.');
  return s;
}
/* ---- YTD Jan–Jun 2025 vs 2026 (fixed) ---- */
function renderYTD(){
  const mFim=MAXYM_VENDAS%100, mLab=MES[mFim-1];
  const Y1=ANO_V, Y0=ANO_V-1, i1=Y1*100+1, i0=Y0*100+1;
  const a=aggregate(i0,MAXYM_VENDAS-100),b=aggregate(i1,MAXYM_VENDAS);
  let s=`<div class="sec-head"><div class="kick">Comparativo</div><h2>YTD Jan–${mLab} · ${Y0} vs ${Y1}</h2>
    <p class="lead">Período comparável janeiro a ${mLab.toLowerCase()}, venda contratada da base atualizada.</p></div>`;
  s+='<div class="kpis k3" data-blk="ytd-kpi">'+kpi(`Venda ${Y1} · Jan–`+mLab,mi(b.total),deltaHtml(b.total/a.total-1)+' vs '+Y0)
    +kpi(`Pedidos ${Y1}`,nf(b.peds),deltaHtml(b.peds/a.peds-1)+' vs '+Y0)
    +kpi(`Ticket médio ${Y1}`,mi(b.ticket),deltaHtml(b.ticket/a.ticket-1)+' vs '+Y0)+'</div>';
  s+=fig(line([[String(Y0),ymList(i0,MAXYM_VENDAS-100).map(y=>a.monthly[y]||0),SER[3]],[String(Y1),ymList(i1,MAXYM_VENDAS).map(y=>b.monthly[y]||0),SER[0]]],
     MES.slice(0,mFim),{valfmt:v=>mi(v,1),w:900,h:300}),
     ins('serieOscilacao',{labels:ymList(i1,MAXYM_VENDAS).map(ymLab),
       vals:ymList(i1,MAXYM_VENDAS).map(y=>b.monthly[y]||0),id:'ytd'}),'ytd-linha');
  // metrics table
  s+=B('ytd-ind',table(['Indicador',String(Y0),String(Y1),'Variação'],[
    ['Venda contratada',money(a.total),money(b.total),deltaHtml(b.total/a.total-1)],
    ['Pedidos',nf(a.peds),nf(b.peds),deltaHtml(b.peds/a.peds-1)],
    ['Quantidade',nf(a.qnt),nf(b.qnt),deltaHtml(b.qnt/a.qnt-1)],
    ['Ticket médio / pedido',money(a.ticket),money(b.ticket),deltaHtml(b.ticket/a.ticket-1)],
  ],['left','right','right','right']));
  // por vendedora (join)
  const va={}; a.vend.forEach(x=>va[x.name]=x.v); const rows=[];
  const names=new Set([...a.vend.map(x=>x.name),...b.vend.map(x=>x.name)].filter(n=>!PSEUDO_VEND.includes(n)));
  const vb={}; b.vend.forEach(x=>vb[x.name]=x.v);
  [...names].map(n=>({n,a:va[n]||0,b:vb[n]||0})).filter(x=>x.a+x.b>0).sort((x,y)=>y.b-x.b).forEach(x=>{
    rows.push([esc(x.n),money(x.a),money(x.b),`<span style="color:${x.b-x.a>=0?GOOD:BAD}">${money(x.b-x.a)}</span>`, x.a?deltaHtml(x.b/x.a-1):'<span class="mut">novo</span>']);});
  s+=H3('Variação por vendedor(a)','','ytd-vendedor');
  s+=table(['Vendedor(a)',String(Y0),String(Y1),'Variação R$','Var. %'],rows,['left','right','right','right','right'],null,
    ins('rotatividade',{a:a.vend,b:b.vend,labelA:String(Y0),labelB:String(Y1),
      escopo:'vendedor(a)',escopoPl:'vendedores',id:'vendedor-ytd',tabela:true}));
  return s;
}
/* ---- Junho 2026 (fixed) ---- */
/* ---- Análise mensal (dinâmica, com seletor de mês) ---- */
const MES_LONGO=['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
function mesLongo(ym){ return MES_LONGO[(ym%100)-1]+' / '+Math.floor(ym/100); }
let mensalYm=null;
function mesesDisponiveis(){ return [...new Set(DATA.rows.map(r=>r[0]))].sort((a,b)=>a-b); }
function buildMensalFilter(){
  const ms=mesesDisponiveis(); const last=ms[ms.length-1];
  const opts=ms.slice().reverse().map(y=>`<option value="${y}"${y===last?' selected':''}>${mesLongo(y)}</option>`).join('');
  return `<div class="filterbar"><div class="fb-custom"><span class="fb-t">Mês de referência:</span> <select id="mn-sel">${opts}</select></div><div class="fb-label" id="mn-label"></div></div>`;
}
function initMensal(){
  const ms=mesesDisponiveis(); if(!mensalYm) mensalYm=ms[ms.length-1];
  const sel=document.getElementById('mn-sel'); if(!sel) return;
  sel.value=mensalYm;
  sel.addEventListener('change',()=>{ mensalYm=+sel.value; drawMensal(); });
}
function drawMensal(){
  const body=document.getElementById('mensal-body'); if(!body) return;
  const ms=mesesDisponiveis(); if(!mensalYm) mensalYm=ms[ms.length-1];
  body.innerHTML=renderMensalBody(mensalYm);
  wireMensalClientes(mensalYm);
  const lb=document.getElementById('mn-label'); if(lb) lb.textContent='Referência: '+mesLongo(mensalYm);
  remount('mensal');
}
function renderMensalBody(ym){
  const j=aggregate(ym,ym); const pv=ymAddMonths(ym,-1); const p=aggregate(pv,pv);
  const dV=(c,o)=>o?deltaHtml(c/o-1):'';
  let s='';
  s+='<div class="kpis k4">'
    +kpi('Venda contratada',mi(j.total),p.total?dV(j.total,p.total)+' vs '+mesLongo(pv):'')
    +kpi('Pedidos',nf(j.peds),p.peds?dV(j.peds,p.peds)+' vs mês anterior':'')
    +kpi('Ticket médio',mi(j.ticket),p.ticket?dV(j.ticket,p.ticket)+' vs mês anterior':'por pedido')
    +kpi('Quantidade',nf(j.qnt),'itens vendidos')+'</div>';
  if(!j.total) return s+call('Sem vendas registradas em '+mesLongo(ym)+'.','warn');
  // evolução 12 meses até o mês selecionado
  const ini=ymAddMonths(ym,-11); const win=aggregate(ini,ym); const meses=ymList(ini,ym);
  s+=H3('Evolução — 12 meses até '+mesLongo(ym),'','mn-evol');
  s+=fig(line([['Venda contratada',meses.map(m=>win.monthly[m]||0),SER[0]]],meses.map(ymLab),{valfmt:v=>mi(v,1),w:960,h:260}),
    ins('vendasPrecoVolume',{fim:ym})||ins('mesVsAnterior',{fim:ym}));
  const _vendMes=j.vend.filter(x=>!PSEUDO_VEND.includes(x.name));
  s+='<div class="two"><div>'+H3('Top vendedoras','','mn-vend')+fig(hbar(_vendMes.slice(0,6).map(x=>[x.name,x.v]),{valfmt:v=>mi(v,1),padLeft:200,w:520}),
    ins('concentracao',{itens:_vendMes.map(x=>({name:x.name,v:x.v})),
      escopo:'vendedor(a)',escopoPl:'vendedores',universo:'da venda do mês',id:'vend-mes'})
    ||ins('auto',{itens:_vendMes.map(x=>({name:x.name,v:x.v,q:x.q,peds:x.peds})),escopo:'vendedor(a)',
        escopoPl:'vendedores',universo:'da venda do mês',id:'vend-mes-alt',preferir:['divergencia','cauda']}))+'</div>';
  const _famMes=j.fams.filter(f=>f.name!=='Frete/Serviço');
  s+='<div>'+H3('Top categorias','','mn-cat')+fig(hbar(_famMes.slice(0,6).map(x=>[x.name,x.v]),{valfmt:v=>mi(v,1),color:SER[2],padLeft:150,w:520}),
    ins('concentracao',{itens:_famMes.map(x=>({name:x.name,v:x.v})),
      escopo:'categoria',escopoPl:'categorias',universo:'da venda do mês',id:'fam-mes'}))+'</div></div>';
  const nCli=j.clis.length;
  const T=tabelaClientes(j.clis,j.total,{max:30,rotulo:'% do mês',attrs:x=>`data-c="${x.idx}"`});
  const p80=T.corte;
  s+=H3('Maiores clientes do mês',p80?(nf(p80.n)+(p80.n===1?' cliente':' clientes')+' = 80% da venda'):'','mn-cli');
  s+=T.html;
  s+=cap('Clique num cliente para ver os itens comprados no mês.'
    +(p80&&T.n>p80.n?' A linha marcada é onde o acumulado cruza os 80%.':'')
    +(T.restantes>0?' Outros '+nf(T.restantes)+' clientes compraram no mês e somam '+pct(1-T.share,1)+'.':''));
  /* a leitura de concentracao de clientes seguia como texto fixo; passa a ser
     uma regua recolhivel, no mesmo padrao de todo o resto do relatorio. */
  s+='<div class="tw-ins">'+(window.INSRT?INSRT.strip(
      ins('concentracao',{itens:j.clis.map(x=>({name:x.name,v:x.v})),
        escopo:'cliente',escopoPl:'clientes',universo:'da venda do mês',
        id:'cli-mes',limiar:.35,tabela:true})):'')+'</div>';
  s+='<div id="mn-cli-detail"></div>';
  return s;
}
function wireMensalClientes(ym){
  const body=document.getElementById('mensal-body'); if(!body) return;
  body.querySelectorAll('.cli-row').forEach(tr=>{ tr.style.cursor='pointer';
    tr.addEventListener('click',()=>{
      const det=document.getElementById('mn-cli-detail'); if(!det) return;
      const wasSel=tr.classList.contains('sel');
      body.querySelectorAll('.cli-row').forEach(r=>{r.classList.remove('sel'); r.style.background='';});
      if(wasSel){ tr.classList.remove('sel'); det.innerHTML=''; return; }
      tr.classList.add('sel'); tr.style.background='rgba(146,112,93,.12)';
      const itens=clienteItens(+tr.dataset.c,ym,ym);
      const totQ=itens.reduce((a,it)=>a+it[1],0), totV=itens.reduce((a,it)=>a+it[2],0);
      det.innerHTML=H3('Itens comprados — '+tr.children[0].textContent)
        +table(['Produto','Qtd','Valor','Previsão de entrega'],
            itens.map(it=>[esc(trunc(it[0],50)),nf(it[1]),money(it[2]),it[3]||'—']),
            ['left','right','right','right'],
            ['Total',nf(totQ),money(totV),'']);
    });
  });
}

/* ---- Sumário (fixed) — Histórico + 2026 ---- */
/* Identidade de relação = arquiteto quando a venda tem arquiteto vinculado (r[16]), senão cliente
   (r[5]). Um arquiteto costuma representar vários clientes finais, então contar só por cliente
   final subestima a recorrência real de quem de fato traz negócio repetido (item 2.7 da ata de
   26/08). Linha com mais de um arquiteto conta em cada um — evita sub-contar recorrência. */
const idsRow=r=>r[16].length?r[16].map(x=>'a'+x[0]):['c'+r[5]];
function uniqIdentidades(a,b){ const pos={};
  DATA.rows.forEach(r=>{ if(r[0]<a||r[0]>b) return;
    idsRow(r).forEach(k=>{ pos[k]=(pos[k]||0)+r[1]; });
  });
  let n=0; for(const k in pos){ if(pos[k]>0) n++; } return n; }
function renderSumario(){
  const A=aggregate(200001,300000); const rep=A.comp.pf+A.comp.dsr+A.comp.prem+A.comp.pj+A.comp.ger+A.comp.cur+A.comp.rt+A.comp.roy;
  const top10=A.clis.slice(0,10).reduce((s,x)=>s+x.v,0);
  const dtop=A.desg.slice(0,2).reduce((s,x)=>s+x.roy,0), dtot=A.desg.reduce((s,x)=>s+x.roy,0);
  const mFimV=MAXYM_VENDAS%100, mLabV=MES[mFimV-1], ymLabV=ymLab(MAXYM_VENDAS);
  const Y1=ANO_V, Y0=ANO_V-1, i1=Y1*100+1;
  const cliHist=uniqIdentidades(200001,300000), cli26=uniqIdentidades(i1,MAXYM_VENDAS);
  // novas relações no ano corrente (arquiteto, ou cliente sem arquiteto — mesma identidade de uniqIdentidades — sem compra antes de janeiro)
  const before=new Set(), in26=new Set();
  DATA.rows.forEach(r=>{ const ids=idsRow(r);
    if(r[0]<i1) ids.forEach(k=>before.add(k)); else if(r[0]<=MAXYM_VENDAS) ids.forEach(k=>in26.add(k)); });
  let novos26=0; in26.forEach(k=>{ if(!before.has(k)) novos26++; });
  // ano corrente
  const H26=aggregate(i1,MAXYM_VENDAS);
  // isolamento de dados: KPIs de DRE (DPNL) só quando o blob foi enviado ao navegador
  const hasDre=!!window.DPNL;
  /* a DRE do ano corrente vai do janeiro do ano da DRE até o último mês dela; o YTD anterior é o
     mesmo intervalo um ano antes */
  const g26=hasDre?dreAgg('CONSOLIDADO',ANO_D*100+1,MAXYM_DRE):null;
  const fat26=g26?g26.receita_bruta:0, fat25ytd=hasDre?dreAgg('CONSOLIDADO',(ANO_D-1)*100+1,MAXYM_DRE-100).receita_bruta:0;
  /* EBIT no lugar de Resultado Líquido no Sumário: os juros representam 34% da dívida total
     (ver seção Dívida) e dominam o resultado líquido, escondendo o desempenho operacional —
     EBIT = EBITDA + Depreciação/Amortização, antes do efeito financeiro (item 6.6 da ata). */
  const ebit26=g26?g26.ebitda+g26.deprec:0, rl26=g26?(g26.receita_liquida||1):1;
  // orçado vem da planilha de metas (window.METAS), a mesma fonte da seção Performance Comercial —
  // antes saía do bloco fixo config_apresentacao.json > carteira_apresentacao.orcado, congelado em jun/26,
  // o que fazia o Sumário e a nova seção mostrarem orçados diferentes na mesma página.
  const MP=metasCalc(), hasMeta=!!MP;
  const realizado=hasMeta?MP.realAteAgora:0, orcado=hasMeta?MP.metaAteAgora:0;
  let s=`<div class="sec-head"><div class="kick">+55 Design · base atualizada até ${ymLabV}</div><h2>Sumário executivo de vendas</h2>
   <p class="lead">Panorama em duas leituras: o <b>histórico completo</b> desde ${ymLabAno(MINYM_VENDAS)} e um recorte específico de <b>${Y1} (Jan–${mLabV})</b>. Base comercial de ${nf(DATA.rows.length)} linhas; faturamento e resultado pela DRE (abas REAL). Filtros de período na seção “Análise por período” e na DRE.</p></div>`;
  // ---- HISTÓRICO ----
  s+=H3('Histórico · '+ymLabExt(MINYM_VENDAS)+' – '+mLabV.toLowerCase()+'/'+Y1,'','rs-hist');
  s+='<div class="kpis">'
   +kpi('Venda contratada · total',mi(A.total),ymLabAno(MINYM_VENDAS)+'–'+ymLabV,'ok')
   +kpi('Pedidos',nf(A.peds),'ticket médio '+mi(A.ticket))
   +kpi('Relações únicas',nf(cliHist),'arquiteto, ou cliente sem arquiteto — compra líquida positiva')
   +kpi('Designers licenciados',nf(A.desg.length),'2 maiores = '+pct(dtop/dtot,0)+' dos royalties')
   +kpi('Faturamento '+(ANO_D-1)+' · DRE',(window.DRE&&DRE[ANO_D-1])?mi(DRE[ANO_D-1].annual):'—','Receita Bruta Consolidada')
   +kpi('Carteira em aberto',mi(DATA.carteira.total),'pos. '+ymLabV,'warn')
   +kpi('Repasses e comissões',mi(rep),pct(rep/A.total,1)+' das vendas')
   +kpi('Concentração Top 10',pct(top10/A.total,0),'dos clientes na venda')
   +'</div>';
  // ---- ano corrente ----
  s+=H3(Y1+' · Janeiro a '+mLabV,'','rs-ytd');
  s+='<div class="kpis">'
   +kpi('Venda contratada · '+Y1,mi(H26.total),hasMeta?deltaHtml(realizado/orcado-1)+' vs orçado':'jan–'+ymLabV)
   +(hasDre?kpi('Faturamento · DRE',mi(fat26),deltaHtml(fat26/fat25ytd-1)+' vs '+(ANO_D-1)+' YTD'):'')
   +(hasDre?kpi('EBITDA · DRE',mi(g26.ebitda),pct(g26.eb_pct,1)+' da ROL',g26.ebitda>=0?'ok':'warn'):'')
   +(hasDre?kpi('EBIT · DRE',mi(ebit26),pct(ebit26/rl26,1)+' da ROL — antes do efeito financeiro',ebit26>=0?'ok':'warn'):'')
   +kpi('Pedidos · '+Y1,nf(H26.peds),'ticket médio '+mi(H26.ticket))
   +kpi('Ticket médio · '+Y1,mi(H26.ticket),'por pedido')
   +kpi('Relações únicas · '+Y1,nf(cli26),'arquiteto, ou cliente sem arquiteto — compra líquida positiva')
   +kpi('Novas relações · '+Y1,nf(novos26),'arquiteto ou cliente, sem compra antes de '+Y1,'ok')
   +'</div>';
  // ---- leitura executiva ----
  /* numeração derivada da posição (e não fixa no dado): o item "Faturamento é consequência
     defasada", que era o nº 2, saiu por decisão da ata de 26/08/2026 (item 1.10) — com número
     fixo, tirar um item deixava buraco na sequência. */
  const prov=[
   [_tituloCrescimento(),'Venda contratada saltou de '+mi(aggregate(ANO_INI_SERIE*100+1,ANO_INI_SERIE*100+12).total)+' ('+ANO_INI_SERIE+') para '+mi(aggregate(Y0*100+1,Y0*100+12).total)+' ('+Y0+'). '+Y1+' (Jan–'+mLabV+') soma '+mi(H26.total)+(hasMeta?(realizado<orcado?', abaixo do orçado ('+mi(orcado)+').':', acima do orçado ('+mi(orcado)+').'):'.')],
   ['Concentração de design','Os dois maiores estúdios concentram '+pct(dtop/dtot,0)+' dos royalties pagos ('+mi(dtot)+' no total).'],
   ['RT a arquitetos é o maior repasse','O repasse técnico a arquitetos soma '+mi(A.comp.rt)+' ('+pct(A.comp.rt/A.total,1)+' das vendas), acima até dos royalties de designer.'],
   ['Baixa concentração de clientes','Top 10 clientes = '+pct(top10/A.total,0)+' das vendas — carteira pulverizada, com espaço para recompra e indicação.'],
  ];
  s+='<h3 data-blk="rs-leitura">Leitura executiva</h3><div class="prov">'+prov.map((p,i)=>`<div class="pv"><div class="pv-n">${i+1}</div><div><b>${esc(p[0])}</b><p>${p[1]}</p></div></div>`).join('')+'</div>';
  return s;
}

/* ---- Análise por período (DINÂMICA) ---- */
function renderPeriodo(a,label){
  let s='';
  s+='<div class="kpis k4">'+kpi('Venda contratada',mi(a.total),label)
    +kpi('Pedidos',nf(a.peds),'')+kpi('Ticket médio',mi(a.ticket),'por pedido')
    +kpi('Quantidade',nf(a.qnt),'itens')+'</div>';
  // monthly within period
  const yms=Object.keys(a.monthly).map(Number).sort((x,y)=>x-y);
  // carteira histórica no período (saldo em aberto no fim de cada mês) — item 5.1 da ata de 26/08.
  // Reconstruída no Python a partir da data do pedido e da data da NF (parse_vendas). Reúne, num
  // único gráfico: venda contratada do período (linha amarela, eixo esquerdo — antes era um
  // gráfico à parte, cancelado por ser a mesma leitura), carteira em aberto (barras, eixo
  // esquerdo) e "meses de carteira" (item 5.2: carteira ÷ faturamento médio 6m da DRE — linha
  // vermelha tracejada, eixo direito).
  const CH=DATA.carteira&&DATA.carteira.hist;
  if(CH&&CH.yms.length&&yms.length>1){
    const ymA=yms[0], ymB=yms[yms.length-1];
    const hi=CH.yms.map((y,i)=>i).filter(i=>CH.yms[i]>=ymA&&CH.yms[i]<=ymB);
    if(hi.length>1){
      const hyms=hi.map(i=>CH.yms[i]), hval=hi.map(i=>CH.valor[i]);
      const dreMonthVal=ym=>{const y=Math.floor(ym/100),m=(ym%100)-1; return (window.DRE&&DRE[y])?(DRE[y].months[m]||0):0;};
      const fat6m=ym=>{let s=0,n=0; for(let k=0;k<6;k++){const v=dreMonthVal(ymShift(ym,-k)); if(v){s+=v;n++;}} return n?s/n:0;};
      const ratio=hyms.map((y,i)=>{const f=fat6m(y); return f>0?hval[i]/f:0;});
      const vendaLine=hyms.map(y=>a.monthly[y]||0);
      s+=H3('Carteira em aberto — posição mês a mês','saldo reconstruído da data do pedido e da NF','pe-cart');
      s+='<div id="cart-hist-chart">'+fig(evolCombo(hyms.map(ymLab),[{name:'Carteira em aberto',values:hval,color:SER[0]}],ratio,
        {valfmt:v=>mi(v,1),acumfmt:v=>nf(v,1)+'x',dashName:'Meses de carteira',dashArea:false,dashColor:BAD,dashLabels:true,
         leftLine:[{name:'Venda contratada',values:vendaLine,color:'#c9a227'},
                   {name:'Média faturamento 6M',values:hyms.map(y=>fat6m(y)),color:SER[2],cls:'evolcombo-fat6m'}],
         linesHidden:true,w:980,h:320}),
        ins('carteiraMesesCobertura',{labels:hyms.map(ymLab),carteira:hval,meses:ratio,venda:vendaLine})
        ||ins('auto',{itens:hyms.map((y,i)=>({name:ymLab(y),v:hval[i]})),escopo:'mês',escopoPl:'meses',
            universo:'da carteira em aberto',id:'cart-hist',preferir:['cauda','estrutura']}))+'</div>';
      s+=cap('Barras = saldo em aberto no fim de cada mês (pedidos sem NF até aquela data — mesmo critério da foto atual de carteira). Linha amarela = venda contratada do mês (mesmo eixo, R$). Linha tracejada vermelha (eixo direito) = carteira ÷ faturamento médio dos últimos 6 meses (Receita Bruta da DRE) — quantas vezes o faturamento a carteira representa naquele mês.');
    }
  }
  // vendedoras
  const vr=a.vend.filter(x=>x.peds>=1 && !PSEUDO_VEND.includes(x.name));
  s+=H3('Desempenho por vendedor(a)','','pe-vend');
  const _vendIt=vr.map(x=>({name:x.name,v:x.v,q:x.q,peds:x.peds,extra:x.com}));
  s+=fig(hbar(vr.slice(0,10).map(x=>[x.name,x.v]),{valfmt:v=>mi(v,1),maxbars:10}),
    ins('auto',{itens:_vendIt,escopo:'vendedor(a)',escopoPl:'vendedores',
      universo:'da venda do período',id:'vend-periodo',preferir:['divergencia']}));
  s+=table(['Vendedor(a)','Venda','% contrib.','Pedidos','Ticket/pedido','Ticket/item','Custo comissão','% custo'],
    a.vend.filter(x=>x.v>0 && !PSEUDO_VEND.includes(x.name)).map(x=>[esc(x.name),money(x.v),pct(x.contrib),nf(x.peds),money(x.ticket),money(x.titem),money(x.com),pct(x.custop)]),
    ['left','right','right','right','right','right','right','right'],null,
    ins('auto',{itens:_vendIt,escopo:'vendedor(a)',escopoPl:'vendedores',
      universo:'da venda do período',rotuloExtra:'comissão',id:'vend-periodo-tab',
      tabela:true,preferir:['taxa','cauda']}));
  // categorias
  s+=H3('Categorias (famílias de produto)','','pe-cat');
  const famsSel=a.fams.filter(f=>f.name!=='Frete/Serviço');
  const famTot=famsSel.reduce((x,f)=>x+f.v,0);
  s+=fig(hbar(famsSel.slice(0,12).map(x=>[x.name,x.v]),
    {valfmt:v=>mi(v,1),color:SER[2],maxbars:12,pct:true,total:famTot}),
    ins('auto',{itens:famsSel.map(x=>({name:x.name,v:x.v})),
      escopo:'categoria',escopoPl:'categorias',universo:'da venda do período',
      id:'fam-periodo',preferir:['cauda']}));
  s+=cap('Percentuais sobre '+mi(famTot)+' — o total das categorias no período selecionado, já sem Frete/Serviço.'
    +(famsSel.length>12?' O gráfico mostra as 12 maiores das '+famsSel.length+' categorias, por isso o acumulado não fecha 100%.':''));
  // matrix vend x fam
  const topV=vr.slice(0,6).map(x=>x.name); const topF=a.fams.filter(f=>f.name!=='Frete/Serviço').slice(0,8).map(x=>x.name);
  const md={}; topV.forEach(vn=>{md[vn]={}; topF.forEach(fn=>md[vn][fn]=0);});
  Object.keys(a.VF).forEach(vi=>{const vn=DATA.vd[vi]; if(!md[vn])return; Object.keys(a.VF[vi]).forEach(fi=>{const fn=DATA.fam[fi]; if(fn in md[vn]) md[vn][fn]=a.VF[vi][fi];});});
  s+=H3('Principais categorias por vendedor(a)','R$ mil','pe-catvend');
  s+=fig(heatmap(topV,topF,md,{valfmt:v=>v>1000?nf(v/1000,0):'',padLeft:150,w:900}),
    ins('mixCruzado',{linhas:topV,colunas:topF,mat:md,escopo:'vendedor(a)',id:'vend-fam-periodo'}));
  // clientes + classe
  s+=H3('Clientes e canal','','pe-canal');
  s+='<div class="two"><div>'+fig(hbar(a.clis.slice(0,12).map(x=>[x.name,x.v]),{valfmt:v=>mi(v,1),padLeft:210,w:520,maxbars:12}),
    ins('auto',{itens:a.clis.map(x=>({name:x.name,v:x.v})),escopo:'cliente',
      escopoPl:'clientes',universo:'da venda do período',id:'cli-periodo',
      preferir:['cauda']}))+'</div>';
  const clsmap={CLIENTE:'Cliente final',SHOWROOM:'Showroom','SHOW ROOM':'Showroom','Não informado':'Não informado',BONIFICACAO:'Bonificação',CANCELADO:'Cancelado'};
  const cagg={}; a.clss.forEach(x=>{const k=clsmap[x.name]||x.name; cagg[k]=(cagg[k]||0)+x.v;});
  const cd=Object.entries(cagg).filter(e=>e[1]>0).sort((x,y)=>y[1]-x[1]).slice(0,3);
  s+='<div>'+fig(donut(cd,{valfmt:v=>mi(v,1)}),
    ins('auto',{itens:Object.keys(cagg).map(k=>({name:k,v:cagg[k]})),escopo:'canal',
      escopoPl:'canais',universo:'da venda do período',id:'canal-periodo'}))+'</div></div>';
  const TC=tabelaClientes(a.clis,a.total,{max:25});
  s+=H3('Maiores clientes do período',
    TC.truncado?(nf(TC.n)+' maiores de '+nf(a.clis.length)):
    TC.corte?(nf(TC.corte.n)+(TC.corte.n===1?' cliente':' clientes')+' = 80% da venda'):'','pe-cli');
  s+=TC.html;
  s+='<div class="tw-ins">'+(window.INSRT?INSRT.strip(
      ins('auto',{itens:a.clis.map(x=>({name:x.name,v:x.v})),escopo:'cliente',
        escopoPl:'clientes',universo:'da venda do período',id:'cli-periodo-tab',
        tabela:true,preferir:['estrutura']})):'')+'</div>';
  s+=cap(TC.truncado
    ? 'Os '+nf(TC.n)+' maiores clientes do período, que somam '+pct(TC.share,1)+' da venda. Chegar a 80% exigiria '
      +nf(TC.corte.n)+' clientes dos '+nf(a.clis.length)+' do período — quanto mais longo o período escolhido, mais espalhada fica a venda entre os clientes.'
    : (TC.corte&&TC.n>TC.corte.n?'A linha marcada é onde o acumulado cruza os 80%. ':'')
      +(TC.restantes>0?'Outros '+nf(TC.restantes)+' clientes compraram no período e somam '+pct(1-TC.share,1)+'.':'Todos os clientes do período estão na tabela.'));
  // designers
  s+=H3('Designers — royalties pagos','','pe-desig');
  const _desgIt=a.desg.map(x=>({name:x.name,v:x.v,peds:x.peds,extra:x.roy}));
  s+=fig(hbar(a.desg.slice(0,12).map(x=>[x.name,x.roy]),{valfmt:v=>money(v),color:SER[4],padLeft:240,w:760,maxbars:12}),
    ins('auto',{itens:_desgIt,escopo:'designer',escopoPl:'designers',
      universo:'dos royalties',rotuloExtra:'royalty',id:'desg-periodo',preferir:['taxa']}));
  s+=table(['Designer','Royalties pagos','Venda associada','% roy.','Pedidos'],
    a.desg.slice(0,15).map(x=>[esc(x.name),money(x.roy),money(x.v),pct(x.v?x.roy/x.v:0),nf(x.peds)]),['left','right','right','right','right'],null,
    ins('auto',{itens:_desgIt,escopo:'designer',escopoPl:'designers',
      universo:'da venda associada',id:'desg-periodo-tab',tabela:true,
      preferir:['divergencia','cauda']}));
  // arquitetos
  s+=H3('Arquitetos — RT paga','','pe-arq');
  const _arqIt=a.arqs.map(x=>({name:x.name,v:x.v,peds:x.peds,extra:x.rt}));
  s+=fig(hbar(a.arqs.slice(0,12).map(x=>[x.name,x.rt]),{valfmt:v=>money(v),color:SER[6],padLeft:240,w:760,maxbars:12}),
    ins('auto',{itens:_arqIt,escopo:'arquiteto',escopoPl:'arquitetos',
      universo:'da RT paga',rotuloExtra:'RT',id:'arq-periodo',preferir:['taxa']}));
  s+=table(['Arquiteto / escritório','RT paga','Venda associada','% RT','Pedidos'],
    a.arqs.slice(0,15).map(x=>[esc(x.name),money(x.rt),money(x.v),pct(x.v?x.rt/x.v:0),nf(x.peds)]),['left','right','right','right','right'],null,
    ins('auto',{itens:_arqIt,escopo:'arquiteto',escopoPl:'arquitetos',
      universo:'da venda associada',id:'arq-periodo-tab',tabela:true,
      preferir:['cauda','divergencia']}));
  // composição
  const C=a.comp; const comp=[['RT arquitetos',C.rt],['Royalties designers',C.roy],['Comissão vendedor(a) (PF)',C.pf],['Prêmio',C.prem],['Comissão vendedor(a) (PJ)',C.pj],['Curadoria / RP',C.cur],['DSR',C.dsr],['Comissão gerente',C.ger]].filter(x=>x[1]>0).sort((x,y)=>y[1]-x[1]);
  const rep=comp.reduce((s2,x)=>s2+x[1],0);
  s+=H3('Composição de repasses e comissões','','pe-repasses');
  const _repIt=comp.map(x=>({name:x[0],v:x[1]}));
  s+=fig(stackbar(comp,{valfmt:v=>mi(v,1)}),
    ins('auto',{itens:_repIt,escopo:'repasse',escopoPl:'tipos de repasse',
      universo:'dos repasses',id:'rep-periodo',preferir:['cauda']}));
  s+=table(['Componente','Valor pago','% das vendas'],comp.map(x=>[esc(x[0]),money(x[1]),pct(x[1]/a.total)]),['left','right','right'],
    ['Total repasses',money(rep),pct(rep/a.total)],
    ins('auto',{itens:_repIt,escopo:'repasse',escopoPl:'tipos de repasse',
      universo:'dos repasses',id:'rep-periodo-tab',tabela:true,preferir:['estrutura']}));
  return s;
}

/* ---- Carteira (fixed) ---- */
function renderCarteira(){
  const c=DATA.carteira;
  let s=`<div class="sec-head"><div class="kick">Carteira de pedidos</div><h2>Carteira em aberto</h2>
   <p class="lead">Pedidos ainda sem nota fiscal emitida, apurados na base atualizada (posição ${ymLab(MAXYM_VENDAS)}): ${mi(c.total)}.</p></div>`;
  /* status da carteira: lido da carteira dinâmica (VENDAS LOJA), na posição declarada dela —
     antes era um retrato digitado da apresentação de 17/07, que não andava com o mês */
  const CD=window.CARTDIN;
  const ST_ROT=[['ANDAMENTO','Em andamento'],['FINALIZADO','Finalizado (estoque)'],['ADIADO','Adiado p/ cliente'],['ATRASADO','Atrasado']];
  const stMap=CD?Object.fromEntries(CD.status):{};
  const stat=CD?ST_ROT.map(([k,rot])=>[rot,stMap[k]||0]):[];
  const stTot=stat.reduce((a,x)=>a+x[1],0);
  if(CD&&stTot>0){
    s+=H3('Classificação da carteira por status','carteira dinâmica · '+CD.data_base,'ce-status');
    s+=fig(pareto(stat,{valfmt:v=>mi(v,1),colors:[SER[0],GOOD,WARN,BAD]}),
      ins('auto',{itens:stat.map(x=>({name:x[0],v:x[1]})),escopo:'status',escopoPl:'status',
        universo:'da carteira',id:'cart-status',preferir:['estrutura','cauda']}));
    s+=cap('Carteira de '+mi(stTot)+' ('+nf(CD.itens)+' itens, posição '+CD.data_base+') segmentada por status. "Em andamento" concentra '+pct(stat[0][1]/stTot,0)+' do total; andamento + finalizado somam '+pct((stat[0][1]+stat[1][1])/stTot,0)+'.');
  }
  const cols=['#577c69',SER[3],WARN,'#c0885a','#a8493c','#d0c4b0'];
  s+=fig(vbars(c.aging.map(x=>[x[0],x[1]]),{valfmt:v=>mi(v,1),w:820,h:280,colors:cols}),
    ins('carteiraTicketPorEspera',{aging:c.aging})
    ||ins('auto',{itens:c.aging.map(x=>({name:x[0],v:x[1],q:x[2]})),escopo:'faixa',escopoPl:'faixas de espera',
        universo:'da carteira',id:'cart-aging',preferir:['relacao','estrutura']}));
  s+=table(['Faixa','Valor pendente','Pedidos'],c.aging.map(x=>[esc(x[0]),money(x[1]),nf(x[2])]),['left','right','right'],
    ['Total',money(c.total),nf(c.aging.reduce((a,x)=>a+x[2],0))],
    ins('auto',{itens:c.aging.map(x=>({name:x[0],v:x[1],q:x[2]})),escopo:'faixa',escopoPl:'faixas de espera',
      universo:'da carteira',id:'cart-aging-tab',tabela:true,preferir:['taxa','cauda']}));
  /* conciliação entre as duas leituras da carteira — cada uma na sua data de posição */
  if(CD&&stTot>0){
    const rotSt=stat.map(x=>x[0].split(' ')[x[0].startsWith('Em ')?1:0].toLowerCase()+' '+mi(x[1])).join(' · ');
    s+=call('<b>Conciliação de carteira.</b> Base comercial (posição '+ymLab(MAXYM_VENDAS)+'): '+mi(c.total)+'. Carteira dinâmica ('+CD.data_base+'): '+mi(stTot)+', já segmentada por status ('+rotSt+'). A diferença reflete as datas de posição distintas e o critério de cada planilha.','recon');
  }
  const _cvend=c.vend.filter(x=>!PSEUDO_VEND.includes(x[0]));
  s+='<div class="two"><div>'+H3('Carteira por vendedor(a)','','ce-vend')+table(['Vendedor(a)','Pendente','Pedidos'],_cvend.map(x=>[esc(x[0]),money(x[1]),nf(x[2])]),['left','right','right'],null,
    ins('auto',{itens:_cvend.map(x=>({name:x[0],v:x[1],q:x[2],peds:x[2]})),escopo:'vendedor(a)',escopoPl:'vendedores',
      universo:'da carteira em aberto',id:'cart-vend',tabela:true,preferir:['divergencia','estrutura']}))+'</div>';
  s+='<div>'+H3('Maiores pedidos em carteira','','ce-peds')+table(['Pedido','Cliente','Pendente'],c.peds.slice(0,12).map(x=>['FOCCO-'+esc(x[0]),esc(trunc(x[1],22)),money(x[3])]),['left','left','right'],null,
    ins('auto',{itens:c.peds.map(x=>({name:x[1]||('Pedido '+x[0]),v:x[3]})),escopo:'pedido',escopoPl:'pedidos',
      universo:'da carteira em aberto',id:'cart-peds',tabela:true,preferir:['cauda','estrutura']}))+'</div></div>';
  return s;
}
/* ---- Carteira dinâmica (fonte: VENDAS LOJA <ano>.xlsx — o nome real vem em CARTDIN.fonte) ---- */
function renderCarteiraDinamica(){
  if(!window.CARTDIN) return call('Fonte "VENDAS LOJA *.xlsx" não encontrada em fontes/. Seção não gerada.','warn');
  const C=CARTDIN;
  let s=`<div class="sec-head"><div class="kick">Carteira · fonte ${esc((C.fonte||'VENDAS LOJA').replace(/\.xlsx$/i,''))}</div><h2>Carteira dinâmica</h2>
   <p class="lead">Pedidos em carteira (excluídos cancelados, devoluções e entregues), lidos diretamente de ${esc(C.fonte||'VENDAS LOJA')} — posição ${C.data_base}.</p></div>`;
  s+='<div class="kpis">'
   +kpi('Carteira total',mi(C.total),C.itens+' itens')
   +kpi('Pedidos',nf(C.pedidos))
   +kpi('Posição',C.data_base)
   +'</div>';

  s+=H3('Classificação da carteira por status','','cd-status');
  s+=`<div class="fig" id="cartdin-status-fig">${pareto(C.status,{valfmt:v=>mi(v,1),colors:[SER[0],GOOD,WARN,BAD],clickable:true})}`
   +`${window.INSRT?INSRT.strip(ins('carteiraAtrasoConcentrado')
      ||ins('auto',{itens:C.status.map(x=>({name:x[0],v:x[1]})),escopo:'status',escopoPl:'status',
          universo:'da carteira',id:'cartdin-status',preferir:['estrutura','cauda']})):''}</div>`;
  s+=cap('Clique em uma barra para ver os pedidos daquele status.');

  s+=H3('Evolutiva mensal da carteira','por mês de venda · barras = valor do mês · área = acumulado','cd-evol');
  s+=fig(evolCombo(C.evol.yms.map(ymLab),[
    {name:'Vendas',values:C.evol.vendas,color:SER[0]},
    {name:'Atrasados',values:C.evol.atrasados,color:BAD},
  ],C.evol.acum,{valfmt:v=>mi(v,1)}),
    ins('auto',{itens:C.evol.yms.map((y,i)=>({name:ymLab(y),v:C.evol.vendas[i],q:C.evol.atrasados[i]})),
      escopo:'mês',escopoPl:'meses',universo:'da carteira',id:'cartdin-evol',preferir:['relacao','cauda']}));

  s+=H3('Carteira de pedidos adiados','evolutiva mensal · barras = valor do mês · área = acumulado','cd-adiados');
  s+=fig(evolCombo(C.evol_adiado.yms.map(ymLab),[
    {name:'Adiado',values:C.evol_adiado.valor,color:WARN},
  ],C.evol_adiado.acum,{valfmt:v=>mi(v,1)}),
    ins('carteiraAdiadoTicket'));

  s+=H3('Previsão de faturamento — pedidos em andamento','por data de entrega prevista · área = acumulado','cd-previsao');
  s+=fig(evolCombo(C.andamento_entrega.yms.map(ymLab),[
    {name:'Previsto',values:C.andamento_entrega.valor,color:SER[0]},
  ],C.andamento_entrega.acum,{valfmt:v=>mi(v,1)}),
    ins('carteiraPicoEntrega')
    ||ins('auto',{itens:C.andamento_entrega.yms.map((y,i)=>({name:ymLab(y),v:C.andamento_entrega.valor[i]})),
        escopo:'mês de entrega',escopoPl:'meses de entrega',universo:'do que está para faturar',
        id:'cartdin-entrega',preferir:['cauda','estrutura']}));

  // mesmas duas leituras da Carteira estática, agora sobre a fonte dinâmica.
  // status_pedidos é indexado por status, e 14 pedidos têm itens em mais de um bucket. Achatar
  // sem consolidar quebraria esses pedidos em linhas parciais e bagunçaria o ranking (o 542401,
  // por ex., vale 392.793 somado e sairia fatiado). Consolida por número de pedido e guarda os
  // status envolvidos.
  const _pc={};
  Object.keys(C.status_pedidos||{}).forEach(b=>C.status_pedidos[b].forEach(x=>{
    const o=_pc[x[0]]||(_pc[x[0]]={ped:x[0],cliente:x[1],valor:0,status:[]});
    o.valor+=x[2]; if(o.status.indexOf(b)<0) o.status.push(b);
    if((!o.cliente||o.cliente==='Não informado')&&x[1]) o.cliente=x[1];}));
  const pedsGlobal=Object.keys(_pc).map(k=>_pc[k]).sort((a,b)=>b.valor-a.valor);
  s+='<div class="two">';
  s+='<div>'+H3('Carteira por vendedor(a)','','cd-vend')
    +(C.vend&&C.vend.length
      ? table(['Vendedor(a)','Pendente','Pedidos'],C.vend.filter(x=>!PSEUDO_VEND.includes(x[0])).map(x=>[esc(x[0]),money(x[1]),nf(x[2])]),['left','right','right'],null,
          ins('auto',{itens:C.vend.filter(x=>!PSEUDO_VEND.includes(x[0])).map(x=>({name:x[0],v:x[1],q:x[2],peds:x[2]})),
            escopo:'vendedor(a)',escopoPl:'vendedores',universo:'da carteira em aberto',
            id:'cartdin-vend',tabela:true,preferir:['divergencia','estrutura']}))
      : call('Coluna "VENDEDORA" não encontrada nesta geração da planilha.','warn'))
    +'</div>';
  s+='<div>'+H3('Maiores pedidos em carteira','','cd-peds')
    +table(['Pedido','Cliente','Status','Pendente'],
       pedsGlobal.slice(0,12).map(x=>[esc(String(x.ped)),esc(trunc(x.cliente,22)),esc(x.status.join(' + ')),money(x.valor)]),
       ['left','left','left','right'],null,
       ins('concentracao',{itens:pedsGlobal.map(x=>({name:'FOCCO-'+x.ped,v:x.valor})),
         escopo:'pedido',escopoPl:'pedidos',universo:'da carteira',id:'ped-carteira',tabela:true}))
    +'</div></div>';
  s+=cap('Pendente = valor ainda em carteira (excluídos cancelados, devoluções e entregues). '
    +'Os 12 maiores pedidos somam todos os status: quando um pedido tem itens em situações diferentes, os dois aparecem na coluna Status.');

  s+=H3('Pedidos por status','','cd-status-tab');
  s+='<div class="filterbar"><div class="fb-custom"><span class="fb-t">Status:</span> <select id="cartdin-status-sel">'
   +C.status.map((x,idx)=>`<option value="${idx}">${esc(x[0])} · ${esc(mi(x[1],1))}</option>`).join('')
   +'</select></div></div>';
  /* o detalhe e aberto pelo pareto de status (cd-status), mas mora aqui embaixo, depois da
     tabela "Pedidos por status". Sem amarrar explicitamente, ele herdaria cd-status-tab e
     sumiria junto com ela num roteiro que mantem so o pareto. */
  s+='<div id="cartdin-status-detail" data-blk="cd-status"></div>';
  return s;
}
function initCarteiraDinamica(){
  if(!window.CARTDIN) return;
  const box=document.getElementById('cartdin-status-fig'); if(!box) return;
  const bars=box.querySelectorAll('.par-bar');
  bars.forEach(el=>el.addEventListener('click',()=>drawCartdinStatus(+el.dataset.i,bars)));
  const sel=document.getElementById('cartdin-status-sel');
  if(sel) sel.addEventListener('change',()=>drawCartdinStatus(+sel.value,bars));
  if(bars.length) drawCartdinStatus(0,bars);
}
function drawCartdinStatus(i,bars){
  bars.forEach(b=>{b.style.stroke='';b.style.strokeWidth='';});
  const el=Array.from(bars).find(b=>+b.dataset.i===i); if(el){el.style.stroke=INK;el.style.strokeWidth='2.5';}
  const sel=document.getElementById('cartdin-status-sel'); if(sel) sel.value=i;
  const C=window.CARTDIN, [bucket,total]=C.status[i], peds=C.status_pedidos[bucket]||[];
  let acc=0;
  const rows=peds.map(p=>{ acc+=p[2];
    return `<tr class="cartdin-ped-row" data-p="${esc(String(p[0]))}">`
     +`<td class="left">FOCCO-${esc(p[0])}</td><td class="left">${esc(trunc(p[1],30))}</td>`
     +`<td class="right">${nf(p[3])}</td><td class="right">${money(p[2])}</td>`
     +`<td class="right">${pct(total?p[2]/total:0,1)}</td><td class="right">${pct(total?acc/total:0,1)}</td></tr>`;}).join('');
  const box=document.getElementById('cartdin-status-detail'); if(!box) return;
  box.innerHTML = H3('Pedidos em carteira — '+bucket, mi(total)+' · '+nf(peds.length)+' pedidos')
    +`<div class="tw"><table class="dt"><thead><tr>
        <th class="left">Pedido</th><th class="left">Cliente</th><th class="right">Itens</th>
        <th class="right">Valor</th><th class="right">% do status</th><th class="right">% acumulada</th>
      </tr></thead><tbody>${rows}</tbody></table></div>`
    +'<div class="tw-ins">'+(window.INSRT?INSRT.strip(
        ins('auto',{itens:peds.map(x=>({name:x[1]||('Pedido '+x[0]),v:x[2],q:x[3]})),escopo:'pedido',
          escopoPl:'pedidos',universo:'do status '+bucket.toLowerCase(),id:'cartdin-peds-'+bucket,
          tabela:true,preferir:['cauda','estrutura']})):'')+'</div>'
    +cap('Clique num pedido para ver os itens.')
    +'<div id="cartdin-ped-detail"></div>';
  box.querySelectorAll('.cartdin-ped-row').forEach(tr=>{ tr.style.cursor='pointer';
    tr.addEventListener('click',()=>toggleCartdinPedido(tr,peds)); });
}
function toggleCartdinPedido(tr,peds){
  const detail=document.getElementById('cartdin-ped-detail'); if(!detail) return;
  const wasSel=tr.classList.contains('sel');
  tr.closest('table').querySelectorAll('.cartdin-ped-row').forEach(r=>{r.classList.remove('sel'); r.style.background='';});
  if(wasSel){ tr.classList.remove('sel'); detail.innerHTML=''; return; }
  tr.classList.add('sel'); tr.style.background='rgba(146,112,93,.12)';
  const ped=peds.find(p=>String(p[0])===tr.dataset.p); if(!ped) return;
  detail.innerHTML = H3('Itens do pedido FOCCO-'+esc(ped[0]))
    + table(['Produto','Qtd','Valor','Data venda','Data entrega'],
        ped[4].map(l=>[esc(l[0]),nf(l[1]),money(l[2]),l[3]||'—',l[4]||'—']),
        ['left','right','right','right','right']);
}
/* ---- Custos de Produção / CPV (dinâmico por período) ---- */
function custosMesLab(ym){ return MES[(ym%100)-1]+'/'+String(Math.floor(ym/100)).slice(2); }
const CUSTOS_MAT_COLORS={}; ['Metal','Couro','Pedra','Madeira','Tecido','Espuma','Outros materiais'].forEach((c,i)=>CUSTOS_MAT_COLORS[c]=SER[i%8]);
function initMatHover(){
  const root=document.getElementById('custos-body'); if(!root) return;
  root.querySelectorAll('.piewrap [data-cat]').forEach(el=>{
    const cat=el.dataset.cat; const card=root.querySelector(`.matcard[data-cat="${CSS.escape(cat)}"]`); if(!card) return;
    const col=CUSTOS_MAT_COLORS[cat]||SER[0];
    el.addEventListener('mouseenter',()=>{ card.style.borderColor=col; card.style.boxShadow='0 0 0 2px '+col+'33'; });
    el.addEventListener('mouseleave',()=>{ card.style.borderColor=''; card.style.boxShadow=''; });
  });
}
function custosPeriodLabel(a,b){ if(a<=200001&&b>=300000)return 'histórico completo ('+ymLabAno(MINYM_CUSTOS)+'–'+ymLabAno(MAXYM_CUSTOS)+')';
  if(a===b) return custosMesLab(a).replace('/','/20'); const A=Math.floor(a/100),B=Math.floor(b/100);
  if(a%100===1&&b%100===12&&A===B) return 'ano '+A; return custosMesLab(a)+' – '+custosMesLab(b);}
/* presets de custos: ano anterior (se a base o cobre), ano corrente até o último mês e 12 meses móveis */
const _PRESET_ANO_ANT_CU=(ANO_C-1)*100+12>=MINYM_CUSTOS?[[String(ANO_C-1),(ANO_C-1)*100+1,(ANO_C-1)*100+12]]:[];
const _PRESET_ANO_CU=[ANO_C+' ('+ytdLab(MAXYM_CUSTOS||101)+')',ANO_C*100+1,MAXYM_CUSTOS];
const _PRESET_12M_CU=['Últimos 12m',ymShift(MAXYM_CUSTOS||101,-11),MAXYM_CUSTOS];
const CUSTOS_PRESETS=[['Histórico completo',200001,300000],..._PRESET_ANO_ANT_CU,_PRESET_ANO_CU,_PRESET_12M_CU];
let cuMin=200001,cuMax=300000;
/* ===== Reconciliação: NDVAL666 (matéria-prima), Valorização_Ordens (centro de custo) e Razão CC
   (tipo de conta) são ledgers/recortes diferentes do total oficial (CPV_Acumulado ou, na seção
   Operacional, o novo CPP) — por isso não fecham exatamente com t.mat/t.mod/t.ggf. Para que toda
   a leitura (Executivo × CPV e Operacional × CPP) fique correlacionada ao Painel de Indicadores,
   escala cada abertura proporcionalmente (mantém os pesos relativos internos) até o total bater
   exatamente com a fonte oficial. Muta "a" in place — todo consumidor downstream (tabelas e
   drill-down) já lê os valores reconciliados. */

/* Divide a.operacionais.PRODUTIVO.itens (Razão CC) em Mão de Obra ("Pessoal") e GGF, escalando
   proporcionalmente para fechar com mod/ggf informados — usado só onde essa abertura é necessária
   (Custos Operacionais do Executivo), sem mutar "a" (mantém a.operacionais intacto p/ Apoio×Produtivo). */

function custosAgg(ymMin,ymMax,excl,src){
  /* a janela viaja junto com o agregado: as regras de destaque precisam dela
     para recortar o CPV pelo mesmo periodo que o grafico mostra */
  const C=window.CUSTOS, inR=ym=>ym>=ymMin&&ym<=ymMax;
  const cpvRows=(src==='cpp')?C.cpp:C.cpv, prodRows=(src==='cpp')?C.produtos_cpp:C.produtos;
  let mat=0,mod=0,ggf=0,custo=0,qtd=0; const grpMap={},mesMap={},volGrpMes={},cpvGrpMes={};
  for(const [ym,grp,q,rmat,rmod,rggf,rcusto] of cpvRows){ if(!inR(ym))continue; if(excl&&excl.includes(grp))continue;
    mat+=rmat; mod+=rmod; ggf+=rggf; custo+=rcusto; qtd+=q;
    const g=grpMap[grp]||(grpMap[grp]={qtd:0,mat:0,mod:0,ggf:0,custo:0}); g.qtd+=q;g.mat+=rmat;g.mod+=rmod;g.ggf+=rggf;g.custo+=rcusto;
    const m=mesMap[ym]||(mesMap[ym]={mat:0,mod:0,ggf:0,custo:0,qtd:0}); m.mat+=rmat;m.mod+=rmod;m.ggf+=rggf;m.custo+=rcusto;m.qtd+=q;
    const vg=volGrpMes[grp]||(volGrpMes[grp]={}); vg[ym]=(vg[ym]||0)+q;
    const cg=cpvGrpMes[grp]||(cpvGrpMes[grp]={}); cg[ym]=(cg[ym]||0)+rcusto;
  }
  const grupos=Object.entries(grpMap).map(([g,v])=>[g,v.qtd,v.mat,v.mod,v.ggf,v.custo]).sort((a,b)=>b[5]-a[5]);
  const prodMap={};
  for(const [ym,prod,grp,q,rmat,rmod,rggf,rcusto] of prodRows){ if(!inR(ym))continue; if(excl&&excl.includes(grp))continue;
    const k=prod+'||'+grp; const p=prodMap[k]||(prodMap[k]={prod,grp,qtd:0,mat:0,mod:0,ggf:0,custo:0});
    p.qtd+=q; p.mat+=rmat; p.mod+=rmod; p.ggf+=rggf; p.custo+=rcusto;
  }
  const produtos=Object.values(prodMap).sort((x,y)=>y.custo-x.custo);
  const mesesYm=Object.keys(mesMap).map(Number).sort((a,b)=>a-b);
  const meses=mesesYm.map(ym=>[ym,mesMap[ym].mat,mesMap[ym].mod,mesMap[ym].ggf,mesMap[ym].custo,mesMap[ym].qtd]);
  const matMap={}; for(const [ym,cat,v] of C.materiais){ if(!inR(ym))continue; matMap[cat]=(matMap[cat]||0)+v; }
  const materiais=Object.entries(matMap).map(([k,v])=>[k,v]).sort((a,b)=>b[1]-a[1]);
  const matItemMap={};
  for(const [ym,cat,item,um,qtd,custo] of C.materiais_item){ if(!inR(ym))continue;
    const c=matItemMap[cat]||(matItemMap[cat]={}); const o=c[item]||(c[item]={qtd:0,custo:0,um});
    o.qtd+=qtd; o.custo+=custo; if(um) o.um=um; }
  const materiaisTop={};
  for(const cat in matItemMap){ materiaisTop[cat]=Object.entries(matItemMap[cat]).map(([k,v])=>[k,v.custo,v.qtd,v.um]).sort((a,b)=>b[1]-a[1]).slice(0,5); }
  const ctaMap={PRODUTIVO:{},'AUXILIAR/APOIO':{}};
  for(const [ym,classif,agr,v] of C.cta){ if(!inR(ym))continue; const m=ctaMap[classif]; if(!m)continue; m[agr]=(m[agr]||0)+v; }
  const rotulo=agr=>C.rotulos_cta[agr]||agr;
  const operacionais={};
  for(const classif of ['PRODUTIVO','AUXILIAR/APOIO']){
    const itens=Object.entries(ctaMap[classif]).map(([a,v])=>[rotulo(a),v]).sort((a,b)=>b[1]-a[1]);
    operacionais[classif]={itens, total:itens.reduce((s,x)=>s+x[1],0)};
  }
  const ccMap={};
  for(const [ym,cc,rmod,rggf,rreal] of C.cc){ if(!inR(ym))continue; const o=ccMap[cc]||(ccMap[cc]={mod:0,ggf:0,real:0,horas:0}); o.mod+=rmod;o.ggf+=rggf;o.real+=rreal; }
  for(const [ym,cc,h] of C.horas){ if(!inR(ym))continue; const o=ccMap[cc]||(ccMap[cc]={mod:0,ggf:0,real:0,horas:0}); o.horas+=h; }
  const cc=Object.entries(ccMap).map(([k,v])=>[k,v.mod,v.ggf,v.real,v.horas,v.horas?v.real/v.horas:0]).sort((a,b)=>b[3]-a[3]);
  const ccTotal={horas:cc.reduce((s,x)=>s+x[4],0),custo:cc.reduce((s,x)=>s+x[3],0)}; ccTotal.taxa=ccTotal.horas?ccTotal.custo/ccTotal.horas:0;
  const retMes={},retItem={};
  for(const [ym,cc2,prod,v] of C.retrabalho){ if(!inR(ym))continue; retMes[ym]=(retMes[ym]||0)+v; const k=cc2+'||'+prod; retItem[k]=(retItem[k]||0)+v; }
  const retMensal=Object.keys(retMes).map(Number).sort((a,b)=>a-b).map(ym=>[ym,retMes[ym]]);
  const retPorItem=Object.entries(retItem).map(([k,v])=>{const i=k.indexOf('||'); return [k.slice(0,i),k.slice(i+2),v];}).sort((a,b)=>b[2]-a[2]);
  const assMes={},assProd={};
  for(const [ym,prod,v] of C.assistencia){ if(!inR(ym))continue; assMes[ym]=(assMes[ym]||0)+v; assProd[prod]=(assProd[prod]||0)+v; }
  const assMensal=Object.keys(assMes).map(Number).sort((a,b)=>a-b).map(ym=>[ym,assMes[ym]]);
  const assPorProduto=Object.entries(assProd).map(([k,v])=>[k,v]).sort((a,b)=>b[1]-a[1]).slice(0,15);
  return {ymMin,ymMax, total:{mat,mod,ggf,custo,qtd}, meses, grupos, produtos, materiais, materiaisTop, operacionais, cc, ccTotal, volGrpMes, cpvGrpMes, mesesYm,
    retrabalho:{mensal:retMensal,total:retMensal.reduce((s,x)=>s+x[1],0),porItem:retPorItem},
    assistencia:{mensal:assMensal,total:assMensal.reduce((s,x)=>s+x[1],0),porProduto:assPorProduto}};
}
function buildCustosFilter(){
  const yms=ymList(MINYM_CUSTOS,MAXYM_CUSTOS); const opts=yms.map(y=>`<option value="${y}">${ymLab(y)}</option>`).join('');
  return `<div class="filterbar"><div class="fb-presets">`
    +CUSTOS_PRESETS.map(p=>`<button class="custpreset" data-a="${p[1]}" data-b="${p[2]}">${esc(p[0])}</button>`).join('')
    +`</div><div class="fb-custom">De <select id="cu-de">${opts}</select> até <select id="cu-ate">${opts}</select>
      <button id="cu-apply">Aplicar</button></div>
      <div class="fb-custom">Comparar com: <select id="cb-de">${opts}</select> até <select id="cb-ate">${opts}</select>
      <button id="cb-apply">Comparar</button> <button id="cb-clear" style="display:none">Limpar comparação</button></div>
      <div id="custos-label" class="fb-label"></div></div>`;
}
let cbMin=null,cbMax=null;
function initCustosFilter(){
  document.querySelectorAll('.custpreset').forEach(el=>el.addEventListener('click',()=>{cuMin=+el.dataset.a;cuMax=+el.dataset.b;
    const de=document.getElementById('cu-de'),ate=document.getElementById('cu-ate');
    de.value=Math.max(MINYM_CUSTOS,cuMin===200001?MINYM_CUSTOS:cuMin); ate.value=Math.min(MAXYM_CUSTOS,cuMax===300000?MAXYM_CUSTOS:cuMax); drawCustos();}));
  document.getElementById('cu-apply').addEventListener('click',()=>{let a=+document.getElementById('cu-de').value,b=+document.getElementById('cu-ate').value;
    if(a>b){const t=a;a=b;b=t;} cuMin=a;cuMax=b; drawCustos();});
  document.getElementById('cu-de').value=MINYM_CUSTOS; document.getElementById('cu-ate').value=MAXYM_CUSTOS;
  document.getElementById('cb-apply').addEventListener('click',()=>{let a=+document.getElementById('cb-de').value,b=+document.getElementById('cb-ate').value;
    if(a>b){const t=a;a=b;b=t;} cbMin=a;cbMax=b;
    document.getElementById('cb-clear').style.display=''; drawCustos();});
  document.getElementById('cb-clear').addEventListener('click',()=>{cbMin=null;cbMax=null;
    document.getElementById('cb-clear').style.display='none'; drawCustos();});
  document.getElementById('cb-de').value=MINYM_CUSTOS; document.getElementById('cb-ate').value=Math.min(ymShift(MINYM_CUSTOS,5),MAXYM_CUSTOS);
}
let cuLastAgg=null;
function drawCustos(){
  const body=document.getElementById('custos-body');
  if(!window.CUSTOS){ body.innerHTML=call('Fontes de custo não encontradas (pasta fontes/custos). Seção não gerada.','warn'); return; }
  const a=custosAgg(cuMin,cuMax,null,'cpp');
  reconcileCustos(a);
  cuLastAgg=a; cuMatSel=null; cuGrpSel=null;
  body.innerHTML=renderCustosBody(a);
  document.getElementById('custos-label').textContent='Período: '+custosPeriodLabel(cuMin,cuMax);
  document.querySelectorAll('.custpreset').forEach(el=>el.classList.toggle('on', +el.dataset.a===cuMin && +el.dataset.b===cuMax));
  initMatHover();
  initDrill();
  initProdSearch();
  initNZ();
  initPC();
  remount('custos');
}

/* ===== drill-down: categoria de material e grupo de produto ===== */
let cuMatSel=null,cuGrpSel=null;
function drillBox(id,color,kick,title,sub,inner){
  return `<div class="drill" style="border-top-color:${color}">
    <div class="dr-head"><div><div class="dr-kick">${kick}</div><h4>${esc(title)}</h4>
    <span class="dr-sub">${sub}</span></div><button class="dr-close" type="button" data-for="${id}">Fechar &#10005;</button></div>${inner}</div>`;
}
function drawMatDetail(cat){
  const box=document.getElementById('matdetail'); if(!box) return;
  if(cuMatSel===cat){ cuMatSel=null; box.innerHTML=''; return; }
  cuMatSel=cat;
  const C=window.CUSTOS, inR=ym=>ym>=cuMin&&ym<=cuMax;
  const mes={}; for(const [ym,c,v] of C.materiais){ if(!inR(ym)||c!==cat) continue; mes[ym]=(mes[ym]||0)+v; }
  const yms=Object.keys(mes).map(Number).sort((x,y)=>x-y);
  const acc={}; for(const [ym,c,item,um,qtd,custo] of C.materiais_item){ if(!inR(ym)||c!==cat) continue;
    const o=acc[item]||(acc[item]={qtd:0,custo:0,um}); o.qtd+=qtd; o.custo+=custo; if(um) o.um=um; }
  let list=Object.entries(acc).map(([k,v])=>({item:k,qtd:v.qtd,custo:v.custo,um:v.um})).sort((x,y)=>y.custo-x.custo);
  // reconcilia com o valor já escalado da categoria (cuLastAgg.materiais), para bater com a tabela/pizza acima
  const rawTot=list.reduce((s2,x)=>s2+x.custo,0);
  const reconciledCat=(cuLastAgg.materiais.find(x=>x[0]===cat)||[cat,0])[1];
  const fRec=rawTot?reconciledCat/rawTot:0;
  list=list.map(x=>({...x,custo:x.custo*fRec}));
  const tot=list.reduce((s2,x)=>s2+x.custo,0);
  const col=CUSTOS_MAT_COLORS[cat]||SER[0];
  let inner='';
  if(yms.length>1) inner+=fig(line([[cat,yms.map(y=>mes[y]*fRec),col]],yms.map(custosMesLab),{valfmt:v=>mi(v,1),w:880,h:230}));
  const top=list.slice(0,25), rest=list.slice(25);
  const rows=top.map(x=>{const cu=x.qtd?x.custo/x.qtd:0; const u=x.um||'un.';
    return [esc(x.item),esc(u),nf(x.qtd,2),money(x.custo),money(cu,2),pct(tot?x.custo/tot:0,1)];});
  if(rest.length){const rc=rest.reduce((s2,x)=>s2+x.custo,0);
    rows.push([`<b>Demais materiais</b> <span class="mut">(${nf(rest.length)} itens)</span>`,'','',money(rc),'',pct(tot?rc/tot:0,1)]);}
  inner+='<div class="nzwide">'+table(['Material','UM','Qtde','Custo','Custo/UM','% da categoria'],rows,
    ['left','left','right','right','right','right'],['Total','','',money(tot),'','100,0%'])+'</div>';
  box.innerHTML=drillBox('matdetail',col,'Detalhe da matéria-prima',cat,
    money(tot)+' &middot; '+nf(list.length)+' materiais &middot; '+custosPeriodLabel(cuMin,cuMax),inner);
  bindDrillClose(box,()=>{cuMatSel=null;});
  box.scrollIntoView({behavior:REDUCED?'auto':'smooth',block:'nearest'});
}
function drawGrpDetail(grp){
  const box=document.getElementById('grpdetail'); if(!box||!cuLastAgg) return;
  if(cuGrpSel===grp){ cuGrpSel=null; box.innerHTML=''; return; }
  cuGrpSel=grp;
  const C=window.CUSTOS, inR=ym=>ym>=cuMin&&ym<=cuMax;
  const mes={}; for(const [ym,g,q,rmat,rmod,rggf,rcusto] of C.cpp){ if(!inR(ym)||g!==grp) continue;
    const m=mes[ym]||(mes[ym]={custo:0,qtd:0}); m.custo+=rcusto; m.qtd+=q; }
  const yms=Object.keys(mes).map(Number).sort((x,y)=>x-y);
  const prods=cuLastAgg.produtos.filter(p=>p.grp===grp);
  const tot=prods.reduce((s2,p)=>s2+p.custo,0), totQ=prods.reduce((s2,p)=>s2+p.qtd,0);
  let inner='';
  if(yms.length>1) inner+=fig(line([['CPP '+grp,yms.map(y=>mes[y].custo),SER[0]],
    ],yms.map(custosMesLab),{valfmt:v=>mi(v,1),w:880,h:230}));
  const top=prods.slice(0,30), rest=prods.slice(30);
  const rows=top.map(p=>[esc(trunc(p.prod,60)),nf(p.qtd),money(p.mat),money(p.mod),money(p.ggf),money(p.custo),money(p.qtd?p.custo/p.qtd:0)]);
  if(rest.length){const r=rest.reduce((s2,p)=>({q:s2.q+p.qtd,m:s2.m+p.mat,o:s2.o+p.mod,g:s2.g+p.ggf,c:s2.c+p.custo}),{q:0,m:0,o:0,g:0,c:0});
    rows.push([`<b>Demais produtos</b> <span class="mut">(${nf(rest.length)} itens)</span>`,nf(r.q),money(r.m),money(r.o),money(r.g),money(r.c),money(r.q?r.c/r.q:0)]);}
  inner+='<div class="nzwide">'+table(['Produto','Qtde','MAT','M.O','GGF','CPP total','CPP/un.'],rows,
    ['left','right','right','right','right','right','right'],
    ['Total',nf(totQ),'','','',money(tot),money(totQ?tot/totQ:0)])+'</div>';
  box.innerHTML=drillBox('grpdetail',SER[0],'Detalhe do grupo de produtos',grp,
    money(tot)+' &middot; '+nf(prods.length)+' produtos &middot; '+custosPeriodLabel(cuMin,cuMax),inner);
  bindDrillClose(box,()=>{cuGrpSel=null;});
  box.scrollIntoView({behavior:REDUCED?'auto':'smooth',block:'nearest'});
}
function bindDrillClose(box,onClose){
  const b=box.querySelector('.dr-close');
  if(b) b.addEventListener('click',()=>{ onClose(); box.innerHTML=''; });
}
function initDrill(){
  const root=document.getElementById('custos-body'); if(!root) return;
  root.querySelectorAll('.piewrap [data-cat], .matcard[data-cat]').forEach(el=>{
    el.classList.add('drillable');
    el.addEventListener('click',()=>drawMatDetail(el.dataset.cat));
  });
  root.querySelectorAll('#grpchart rect[data-lab]').forEach(el=>{
    el.classList.add('drillable');
    el.addEventListener('click',()=>drawGrpDetail(el.dataset.lab));
  });
  root.querySelectorAll('.op-grp-cell').forEach(el=>{
    el.addEventListener('click',()=>{
      const grp=el.dataset.grp;
      const section=document.getElementById('topprod-section');
      if(!section) return;
      section.classList.remove('hidden-section');
      const inp=document.getElementById('prodsearch');
      if(inp){ inp.value=grp; inp.dispatchEvent(new Event('input')); }
      section.scrollIntoView({behavior:REDUCED?'auto':'smooth',block:'start'});
    });
  });
}
/* ===== Custos — Visão Executiva (custosx): os pontos que importam, prontos p/ apresentação ===== */
function ymAddMonths(ym,k){ let y=Math.floor(ym/100),m=(ym%100)-1+k; y+=Math.floor(m/12); m=((m%12)+12)%12; return y*100+m+1; }
const CUSTOSX_PRESETS=[['Último mês',MAXYM_CUSTOS,MAXYM_CUSTOS],_PRESET_ANO_CU,_PRESET_12M_CU,..._PRESET_ANO_ANT_CU];
let cxMin=Math.max(ANO_C*100+1,MINYM_CUSTOS||0),cxMax=MAXYM_CUSTOS;



/* ===== Custos — Executivo: drill-down (categoria de material e grupo de produto) + tabela CPV por grupo ===== */
let cxLastA=null,cxLastPrev=null,cxLastLab=null,cxLastLabPrev=null,cxGrpExpanded=false,cxMatSel=null;
let cxgMinA=MINYM_CUSTOS,cxgMaxA=MINYM_CUSTOS&&Math.min(ymShift(MINYM_CUSTOS,5),MAXYM_CUSTOS),cxgMinB=Math.max(ANO_C*100+1,MINYM_CUSTOS||0),cxgMaxB=MAXYM_CUSTOS,cxgAggA=null,cxgAggB=null,cxgLabA='',cxgLabB='',cxgDriverSel=null;

/* ===== Filtro dinâmico Período A × B, específico da "CPV por grupo de produtos" e dos
   "Drivers de Impacto no CPV" — desacoplado do filtro global da leitura executiva (cxMin/cxMax),
   para permitir comparar quaisquer dois períodos sem alterar o resto da seção Executivo. Ao
   carregar, replica o comparativo atual (B=período corrente, A=anterior automático). ===== */



/* ===== Drivers de Impacto no CPV: decompõe a variação de CPV entre Período A e B em Mix (produto
   entrou/saiu da curva), Volume (mesma curva, quantidade mudou) e Custo (CPV unitário mudou).
   Fórmulas (conforme especificado): Mix = Δqtde × CPV unitário do período com volume > 0, só
   quando exatamente um dos dois períodos tem qtde zero; Volume = Δqtde × CPV unitário do Período B
   (base), só quando nenhum dos dois é zero; Custo = ΔCPV unitário × qtde do Período A (mês em
   comparação), só quando nenhum dos dois é zero — isso faz Mix/Volume/Custo somarem exatamente
   ΔCusto do item em todos os casos, sem sobreposição. ===== */



const cxgDMoney=v=>`<span style="color:${v<=0?GOOD:BAD};font-weight:600">${v>0?'+':''}${money(v)}</span>`;

/* seleciona de 3 a 5 produtos: sempre os 3 maiores impactos absolutos, estendendo até 5 só
   enquanto o próximo item ainda for relevante (≥15% do maior impacto do grupo). */


/* leitura de segundo grau: compara o que os destaques (top 3-5) somam contra o total do
   grupo inteiro — revela se a cauda longa (produtos pequenos demais para aparecer sozinhos)
   reforça, contradiz ou é irrelevante perto do que salta aos olhos na tabela. */
/* leitura executiva do impacto total do grupo: qual dos três efeitos (mix, volume, custo)
   domina a variação e o que isso significa em termos simples — direto do total já calculado
   para o grupo em cxgGroupDrivers(), sem depender da lista de produtos. */



document.addEventListener('click', e=>{
  const matCell=e.target.closest('#cx-mat-pie [data-cat]');
  if(matCell){ drawCxMatDetail(matCell.dataset.cat); return; }
  const toggleBtn=e.target.closest('#cx-grp-toggle');
  if(toggleBtn){ cxGrpExpanded=!cxGrpExpanded; const wrap=document.getElementById('cx-grp-wrap'); if(wrap) wrap.innerHTML=renderCxGrpTable(); return; }
  const driverCell=e.target.closest('.cxg-driver-cell');
  if(driverCell){ drawCxgDriverDetail(driverCell.dataset.grp); return; }
  const topCloseBtn=e.target.closest('#cx-topprod-close');
  if(topCloseBtn){ const section=document.getElementById('cx-topprod-section'); if(section) section.classList.add('hidden-section'); return; }
  const topCloseOp=e.target.closest('#topprod-close');
  if(topCloseOp){ const section=document.getElementById('topprod-section'); if(section) section.classList.add('hidden-section'); return; }
  const grpRowCell=e.target.closest('.cx-grp-row-cell');
  if(grpRowCell){
    const grp=grpRowCell.dataset.grp;
    const section=document.getElementById('cx-topprod-section');
    if(!section) return;
    section.classList.remove('hidden-section');
    const inp=document.getElementById('cx-prodsearch');
    if(inp){ inp.value=grp; inp.dispatchEvent(new Event('input')); }
    section.scrollIntoView({behavior:REDUCED?'auto':'smooth',block:'start'});
    return;
  }
});
/* ===== Ranking de produtos vendidos - CPV (Executivo): mesma estrutura de buildTopProdTable
   (Operacional/CPP), mas usando cxLastA (dados de CPV) e rótulos de quantidade vendida. ===== */
function buildCustosXFilter(){
  const yms=ymList(MINYM_CUSTOS,MAXYM_CUSTOS); const opts=yms.map(y=>`<option value="${y}">${ymLab(y)}</option>`).join('');
  return `<div class="filterbar"><div class="fb-presets">`
    +CUSTOSX_PRESETS.map(p=>`<button class="cxpreset" data-a="${p[1]}" data-b="${p[2]}">${esc(p[0])}</button>`).join('')
    +`</div><div class="fb-custom">Mês: de <select id="cx-de">${opts}</select> até <select id="cx-ate">${opts}</select>
      <button id="cx-apply">Aplicar</button></div><div id="custosx-label" class="fb-label"></div></div>`;
}
function initCustosXFilter(){
  const de=()=>document.getElementById('cx-de'), ate=()=>document.getElementById('cx-ate');
  document.querySelectorAll('.cxpreset').forEach(el=>el.addEventListener('click',()=>{
    cxMin=+el.dataset.a; cxMax=+el.dataset.b;
    if(de()) de().value=Math.max(MINYM_CUSTOS,cxMin); if(ate()) ate().value=Math.min(MAXYM_CUSTOS,cxMax);
    drawCustosX();}));
  const apply=document.getElementById('cx-apply');
  if(apply) apply.addEventListener('click',()=>{let a=+de().value,b=+ate().value; if(a>b){const t=a;a=b;b=t;} cxMin=a;cxMax=b; drawCustosX();});
  if(de()) de().value=cxMin; if(ate()) ate().value=cxMax;
}
function drawCustosX(){
  const body=document.getElementById('custosx-body'); if(!body) return;
  if(!window.CUSTOS){ body.innerHTML=call('Fontes de custo não encontradas.','warn'); return; }
  const a=custosAgg(cxMin,cxMax,['MATERIAIS']);
  // janela anterior de mesmo tamanho — só compara se houver dado completo (desde o início da base de custos)
  const len=(Math.floor(cxMax/100)-Math.floor(cxMin/100))*12+(cxMax%100)-(cxMin%100)+1;
  const pMax=ymAddMonths(cxMin,-1), pMin=ymAddMonths(pMax,-(len-1));
  const prev=(pMin>=MINYM_CUSTOS)?custosAgg(pMin,pMax,['MATERIAIS']):null;
  const prevOk=!!(prev&&prev.total.custo);
  body.innerHTML=renderCustosX(a,prevOk?prev:null,custosPeriodLabel(cxMin,cxMax),prevOk?custosPeriodLabel(pMin,pMax):null);
  const lb=document.getElementById('custosx-label'); if(lb) lb.textContent='Período: '+custosPeriodLabel(cxMin,cxMax);
  document.querySelectorAll('.cxpreset').forEach(el=>el.classList.toggle('on',+el.dataset.a===cxMin&&+el.dataset.b===cxMax));
  document.querySelectorAll('#cx-mat-pie [data-cat]').forEach(el=>el.classList.add('drillable'));
  initCxgFilterBar();
  initProdSearchCx();
  remount('custosx');
}
function renderCustosX(a,prev,lab,labPrev){
  const t=a.total; if(!t.custo) return call('Sem dados de custo no período.','warn');
  reconcileCustos(a); if(prev) reconcileCustos(prev);
  cxLastA=a; cxLastPrev=prev; cxLastLab=lab; cxLastLabPrev=labPrev; cxGrpExpanded=false; cxMatSel=null;
  const un=t.qtd?t.custo/t.qtd:0;
  const evit=a.retrabalho.total+a.assistencia.total;
  const evitPct=a.ccTotal.custoRaw?evit/a.ccTotal.custoRaw:0;
  const dC=(cur,old)=>prev&&old?deltaCost(cur/old-1):'';   // custo: cair=verde
  const dV=(cur,old)=>prev&&old?deltaHtml(cur/old-1):'';    // volume: subir=verde
  const pUn=prev&&prev.total.qtd?prev.total.custo/prev.total.qtd:0;
  const pEvit=prev?prev.retrabalho.total+prev.assistencia.total:0;
  let s='';

  // ===== 1) KPIs executivos (6) =====
  s+='<div class="kpis">'
   +kpi('CPV total',mi(t.custo),prev?dC(t.custo,prev.total.custo)+' vs '+labPrev:lab)
   +kpi('Volume vendido',nf(Math.round(t.qtd))+' un.',prev&&prev.total.qtd?dV(t.qtd,prev.total.qtd)+' vs '+labPrev:'base do CPV')
   +kpi('CPV médio / unidade',money(un),prev&&pUn?dC(un,pUn)+' vs '+labPrev:'CPV ÷ volume','ok')
   +kpi('Matéria-prima',pct(t.custo?t.mat/t.custo:0,0),mi(t.mat)+(prev?' · '+dC(t.mat,prev.total.mat):'')+' do CPV')
   +kpi('Mão de obra',pct(t.custo?t.mod/t.custo:0,0),mi(t.mod)+(prev?' · '+dC(t.mod,prev.total.mod):'')+' do CPV')
   +kpi('GGF',pct(t.custo?t.ggf/t.custo:0,0),mi(t.ggf)+(prev?' · '+dC(t.ggf,prev.total.ggf):'')+' do CPV')
   +kpi('Custo evitável',mi(evit),pct(evitPct,1)+' do custo de produção'+(prev&&pEvit?' · '+dC(evit,pEvit):''),evitPct>0.04?'warn':'ok')
   +kpi('Taxa média fabril',money(a.ccTotal.taxaRaw)+'/h',prev&&prev.ccTotal.taxaRaw?dC(a.ccTotal.taxaRaw,prev.ccTotal.taxaRaw)+' vs anterior':nf(Math.round(a.ccTotal.horas))+' h apontadas')
   +'</div>';

  // ===== 2) Os pontos que importam =====
  // Todas as análises abaixo desconsideram o grupo "COMPONENTES" — o impacto dele não é
  // relevante e o foco deve ser produtos acabados vendidos. Recalcula total e grupos "sem
  // Componentes" (tX/gruposX) só para esta subseção; o Painel de Indicadores acima e as
  // demais subseções continuam com o CPV cheio (incluindo Componentes).
  const compA=a.grupos.find(g=>g[0]==='COMPONENTES');
  const tX={qtd:t.qtd-(compA?compA[1]:0),mat:t.mat-(compA?compA[2]:0),mod:t.mod-(compA?compA[3]:0),
    ggf:t.ggf-(compA?compA[4]:0),custo:t.custo-(compA?compA[5]:0)};
  const gruposX=a.grupos.filter(g=>g[0]!=='COMPONENTES');
  const compPrev0=prev?prev.grupos.find(g=>g[0]==='COMPONENTES'):null;
  const prevTotalX=prev?{qtd:prev.total.qtd-(compPrev0?compPrev0[1]:0),custo:prev.total.custo-(compPrev0?compPrev0[5]:0)}:null;
  const unX=tX.qtd?tX.custo/tX.qtd:0;
  const pUnX=prev&&prevTotalX.qtd?prevTotalX.custo/prevTotalX.qtd:0;
  const compMax=[['Matéria-prima',tX.mat],['Mão de obra',tX.mod],['GGF',tX.ggf]].sort((x,y)=>y[1]-x[1])[0];
  const catPrev={}; if(prev) prev.materiais.forEach(([c,v])=>catPrev[c]=v);
  let catMove=null;
  if(prev){ const movs=a.materiais.map(([c,v])=>[c,v,catPrev[c]||0,v-(catPrev[c]||0)]).filter(x=>x[2]>0).sort((x,y)=>y[3]-x[3]);
    if(movs.length) catMove=movs[0]; }
  const catTop=a.materiais[0];
  const grpPrev={}; if(prev) prev.grupos.forEach(g=>grpPrev[g[0]]={q:g[1],c:g[5]});
  const grpTop=gruposX[0];
  let grpPress=null;
  if(prev){ const cand=gruposX.filter(g=>g[5]>tX.custo*0.05&&g[1]).map(g=>{
      const uA=g[5]/g[1], gp=grpPrev[g[0]], uB=gp&&gp.q?gp.c/gp.q:0;
      return uB?[g[0],uA,uB,uA/uB-1]:null; }).filter(Boolean).sort((x,y)=>y[3]-x[3]);
    if(cand.length) grpPress=cand[0]; }
  const retMap={}; a.retrabalho.porItem.forEach(x=>{retMap[x[1]]=(retMap[x[1]]||0)+x[2];});
  const retTopProd=Object.entries(retMap).sort((x,y)=>y[1]-x[1])[0]||null;
  const ccCaro=a.cc.filter(x=>x[7]>0).sort((x,y)=>y[7]-x[7])[0];
  const unTrend=(prev&&pUnX)?(unX>pUnX?'subiu':'caiu'):null;
  /* decomposição volume × mix × custo real: separa quanto da variação do CPV vem de
     (a) vender mais/menos no total, (b) vender uma combinação diferente de grupos
     (mix) e (c) mudança real de custo unitário dentro de cada grupo — evita atribuir
     a queda do CPV médio a "custo" quando na verdade é troca de mix. (Sem Componentes.) */
  const QA=prev?prevTotalX.qtd:0, QB=tX.qtd;
  const uAavg=QA?prevTotalX.custo/QA:0;
  const volEff=prev?(QB-QA)*uAavg:0;
  let mixEff=0, costEff=0, topMixG=null, topCostG=null;
  if(prev){
    const grpUnitA={}; prev.grupos.forEach(g=>{grpUnitA[g[0]]=g[1]?g[5]/g[1]:0;});
    const efeitos=gruposX.map(g=>{
      const qB=g[1], uB=qB?g[5]/qB:0, uA=grpUnitA[g[0]]||0;
      return [g[0], qB*(uA-uAavg), qB*(uB-uA)];
    });
    mixEff=efeitos.reduce((s2,e)=>s2+e[1],0);
    costEff=efeitos.reduce((s2,e)=>s2+e[2],0);
    topMixG=efeitos.slice().sort((x,y)=>Math.abs(y[1])-Math.abs(x[1]))[0];
    topCostG=efeitos.slice().sort((x,y)=>Math.abs(y[2])-Math.abs(x[2]))[0];
  }
  let conclusao='';
  if(prev){
    const aMix=Math.abs(mixEff), aCost=Math.abs(costEff), aVol=Math.abs(volEff);
    const opostos=(mixEff*costEff)<0;
    if(aMix>=aCost&&aMix>=aVol){
      conclusao='Ou seja, a variação do CPV médio é explicada majoritariamente por troca de mix de produtos vendidos'
        +(opostos?' — o custo unitário real dentro de cada grupo caminhou na direção oposta, mascarada pelo efeito de mix':'')
        +', e não por uma redução ou alta real de custo dentro dos grupos.';
    } else if(aCost>=aMix&&aCost>=aVol){
      conclusao='Ou seja, houve uma variação real de custo unitário dentro dos grupos de produto'
        +(opostos?', em parte compensada (ou mascarada) pelo efeito de mix':'')
        +', e não apenas troca de mix.';
    } else {
      conclusao='Ou seja, o principal fator foi o volume total vendido, com efeitos secundários de mix e de custo unitário.';
    }
  }
  const cpvNote=!prev?'Sem período anterior disponível para comparar volume, mix e custo neste recorte.'
    :'O CPV total (sem Componentes) '+(tX.custo>=prevTotalX.custo?'subiu':'caiu')+' '+spct(prevTotalX.custo?tX.custo/prevTotalX.custo-1:0)+' ('+money(tX.custo-prevTotalX.custo)+') frente a '+esc(labPrev)+'. Decompondo a variação: '
      +'volume contribuiu com '+(volEff>=0?'+':'')+mi(volEff)+' ('+(QB>=QA?'cresceu':'recuou')+' '+spct(QA?QB/QA-1:0)+' em unidades vendidas); '
      +'mix de produtos contribuiu com '+(mixEff>=0?'+':'')+mi(mixEff)+(topMixG?' (puxado por '+esc(topMixG[0])+', cujo custo unitário está '+(topMixG[1]<0?'abaixo':'acima')+' da média do período anterior)':'')+'; '
      +'custo unitário real dentro dos grupos contribuiu com '+(costEff>=0?'+':'')+mi(costEff)+(topCostG?' (maior variação em '+esc(topCostG[0])+')':'')+'. '
      +conclusao;
  const pts=[
   ['1','Onde está o custo',compMax[0]+' é o maior componente do CPV: '+pct(tX.custo?compMax[1]/tX.custo:0,0)+' ('+mi(compMax[1])+'). Composição: MAT '+pct(tX.custo?tX.mat/tX.custo:0,0)+' · M.O '+pct(tX.custo?tX.mod/tX.custo:0,0)+' · GGF '+pct(tX.custo?tX.ggf/tX.custo:0,0)+'.'],
   ['2','CPV por unidade',unTrend
      ? 'O CPV médio por peça '+unTrend+' para '+money(unX)+' ('+spct(unX/pUnX-1)+' vs '+labPrev+'). Volume de '+nf(Math.round(tX.qtd))+' un.'
      : 'CPV médio de '+money(unX)+' por peça, sobre '+nf(Math.round(tX.qtd))+' unidades no período.'],
   ['3','Material em foco',catMove
      ? esc(catMove[0])+' foi a categoria que mais subiu: '+mi(catMove[1])+' vs '+mi(catMove[2])+' antes ('+spct(catMove[2]?catMove[1]/catMove[2]-1:0)+').'
      : (catTop?esc(catTop[0])+' é a categoria de matéria-prima mais relevante: '+mi(catTop[1])+' ('+pct(t.mat?catTop[1]/t.mat:0,0)+' da MP direta).':'—')],
   ['4','Grupo pressionado',grpPress
      ? 'CPV unitário de '+esc(grpPress[0])+' subiu '+spct(grpPress[3])+': '+money(grpPress[1])+' vs '+money(grpPress[2])+' — investigar mix, material e retrabalho.'
      : (grpTop?esc(grpTop[0])+' concentra o maior CPV: '+mi(grpTop[5])+' ('+pct(tX.custo?grpTop[5]/tX.custo:0,0)+' do total), CPV/un de '+money(grpTop[1]?grpTop[5]/grpTop[1]:0)+'.':'—')],
   ['5','Custo evitável',mi(evit)+' entre retrabalho ('+mi(a.retrabalho.total)+') e assistência técnica ('+mi(a.assistencia.total)+') — '+pct(evitPct,1)+' do custo de produção.'+(retTopProd?' Maior ofensor: '+esc(trunc(retTopProd[0],38))+' ('+money(retTopProd[1])+').':'')],
   ['6','Eficiência fabril','Taxa média de '+money(a.ccTotal.taxaRaw)+'/hora'+(prev&&prev.ccTotal.taxaRaw?' ('+spct(a.ccTotal.taxaRaw/prev.ccTotal.taxaRaw-1)+' vs anterior)':'')+(ccCaro?'; centro mais caro: '+esc(ccCaro[0])+' a '+money(ccCaro[7])+'/h.':'.')],
   ['7','CPV do período',cpvNote],
  ];
  s+='<h3>Os pontos que importam'+(labPrev?' <span class="tag">vs '+esc(labPrev)+'</span>':'')+'</h3>';
  s+='<div class="prov prov3">'+pts.map((p,i)=>`<div class="pv${i===pts.length-1?' pv-wide':''}"><div class="pv-n">${p[0]}</div><div><b>${p[1]}</b><p>${p[2]}</p></div></div>`).join('')+'</div>';

  // ===== 3) CPV por grupo de produtos — comparativo Período A × B (um mês cada), filtro próprio =====
  cxgMinB=cxMax; cxgMaxB=cxMax; cxgAggB=custosAgg(cxgMinB,cxgMaxB,['MATERIAIS']); cxgLabB=custosPeriodLabel(cxgMinB,cxgMaxB);
  const cxgDefA=ymAddMonths(cxMax,-1);
  cxgMinA=(cxgDefA>=MINYM_CUSTOS)?cxgDefA:cxMax; cxgMaxA=cxgMinA;
  cxgAggA=custosAgg(cxgMinA,cxgMaxA,['MATERIAIS']); cxgLabA=custosPeriodLabel(cxgMinA,cxgMaxA);
  cxgDriverSel=null;
  s+=buildCxgFilterBar();
  s+='<div id="cx-grp-wrap">'+renderCxGrpTable()+'</div>';
  s+='<div class="tw-ins">'+(window.INSRT?INSRT.strip(
      ins('auto',{itens:a.grupos.map(g=>({name:g[0],v:g[5],q:g[1]})),escopo:'grupo',
        escopoPl:'grupos de produto',universo:'do CPV',id:'cx-grupos',tabela:true,
        preferir:['divergencia','estrutura']})):'')+'</div>';
  s+='<div id="cx-topprod-section" class="hidden-section">';
  s+='<div class="sec-head-flex">'+H3('Ranking de produtos vendidos - CPV','curva 80/20 · até 20 produtos · use a busca para achar qualquer produto da base','cx-ranking')
    +'<button id="cx-topprod-close" type="button" class="dr-close">Fechar &#10005;</button></div>';
  s+=`<div class="searchbar"><input id="cx-prodsearch" type="search" placeholder="Buscar produto na base completa (${nf(cxgAggB.produtos.length)} itens)…" autocomplete="off"></div>`;
  s+='<div id="cx-topprod">'+buildTopProdTableCx(cxgAggB.produtos,cxgAggB,'')+'</div>';
  s+='<div class="tw-ins">'+(window.INSRT?INSRT.strip(
      ins('auto',{itens:cxgAggB.produtos.map(x=>({name:x.prod,v:x.custo,q:x.qtd})),escopo:'produto',
        escopoPl:'produtos',universo:'do CPV',id:'cx-produtos',tabela:true,
        preferir:['cauda','estrutura']})):'')+'</div>';
  s+=cap('Ranking por CPV total no Período B selecionado acima, limitado aos 20 produtos de maior custo. "Demais produtos" agrupa o restante da base para fechar com o total geral.');
  s+='</div>';

  // ===== 4) Evolução mensal =====
  if(a.meses.length>1){
    s+=H3('CPV mensal — composição','matéria-prima, mão de obra e GGF · volume de vendas abaixo de cada mês','cx-mensal');
    s+=fig(stackedCols(a.meses.map(m=>custosMesLab(m[0])),[
      {name:'Matéria-prima',values:a.meses.map(m=>m[1]),color:SER[0]},
      {name:'Mão de obra',values:a.meses.map(m=>m[2]),color:SER[2]},
      {name:'GGF',values:a.meses.map(m=>m[3]),color:SER[1]},
    ],{valfmt:v=>mi(v,1),w:Math.min(980,Math.max(320,80*a.meses.length+150)),subLabels:a.meses.map(m=>nf(m[5])+' un.'),subTitle:'Vol. vendas'}),
    prev?ins('cpvMix',{custosA:[a.ymMin,a.ymMax],custosB:[prev.ymMin,prev.ymMax]}):null);
    s+='<div class="two"><div>'+H3('CPV médio por unidade','','cx-unidade')
      +fig(line([['CPV/un',a.meses.map(m=>m[5]?m[4]/m[5]:0),SER[0]]],a.meses.map(m=>custosMesLab(m[0])),{valfmt:v=>money(v,0),w:520,h:250}),
        ins('custoUnitarioVolume',{meses:a.meses,rotulo:'vendidas',id:'cpv'}))+'</div>';
    s+='<div>'+H3('Volume vendido (un.)','','cx-volume')
      +fig(line([['Volume',a.meses.map(m=>m[5]),SER[2]]],a.meses.map(m=>custosMesLab(m[0])),{valfmt:v=>nf(v,0),w:520,h:250}),
        ins('serieOscilacao',{labels:a.meses.map(m=>custosMesLab(m[0])),vals:a.meses.map(m=>m[5]),id:'cx-volume',fmt:v=>nf(Math.round(v))+' peças',verbo:'entregou'}))+'</div></div>';
  }

  // ===== 5) Onde o CPV se concentra (grupos) — gráfico e "tabela" são o mesmo elemento (SVG),
  // então a linha do grupo no rótulo, na barra e nos números é sempre a mesma linha. =====
  const grpTop8=a.grupos.slice(0,8);
  s+=H3('Onde o CPV se concentra','grupos de produto · maior custo','cx-grupos');
  s+=fig(hbar(grpTop8.map(g=>[g[0],g[5]]),{valfmt:v=>money(v),padLeft:210,w:820,rowh:32,
    extraCols:[
      {header:'% do CPV',w:55,get:(it,k)=>pct(t.custo?grpTop8[k][5]/t.custo:0,1)},
      {header:'CPV/un',w:80,get:(it,k)=>money(grpTop8[k][1]?grpTop8[k][5]/grpTop8[k][1]:0)},
    ]}),
    ins('auto',{itens:a.grupos.map(g=>({name:g[0],v:g[5],q:g[1]})),escopo:'grupo',
      escopoPl:'grupos de produto',universo:'do CPV',id:'cx-concentra',preferir:['cauda']}));
  s+=cap('Para ver os produtos de cada grupo, use a tabela "CPV por grupo de produtos" acima — clique na linha do grupo.');

  // ===== 5b) Drivers de Impacto no CPV — usa o mesmo filtro A/B da subseção 3 =====
  s+='<div id="cxg-drivers-wrap">'+driversComRegua()+'</div>';

  // ===== 6) Composição da matéria-prima =====
  // gráfico e legenda são o mesmo elemento (pie3D), então a linha da categoria na legenda e na
  // fatia nunca se desalinham — a legenda substitui a antiga tabela ao lado.
  s+=H3('Composição da matéria-prima no CPV','categorias de maior peso · clique na categoria (fatia ou legenda) para ver os principais materiais','cx-materia');
  s+='<div id="cx-mat-pie">'+fig(pie3D(a.materiais,{valfmt:v=>money(v),w:200,colorOf:nm=>CUSTOS_MAT_COLORS[nm]||SER[0],
    extraHeader:prev?('vs '+labPrev):null,
    extraCol:prev?((it)=>dC(+it[1],catPrev[it[0]]||0)):null}),
    ins('auto',{itens:a.materiais.map(x=>({name:x[0],v:x[1]})),escopo:'categoria',
      escopoPl:'categorias de material',universo:'da matéria-prima',id:'cx-materiais',
      preferir:['estrutura','cauda']}))+'</div>';
  s+=cap('Categorias escaladas proporcionalmente para fechar exatamente com o total de Matéria-prima do CPV ('+money(t.mat)+') mostrado na leitura executiva.');
  s+='<div id="cx-matdetail"></div>';

  // ===== 6b) Custos Operacionais (Mão de Obra + GGF) =====
  s+=H3('Custos Operacionais no CPV','Mão de Obra (M.O) e Gastos Gerais de Fabricação (GGF)','cx-operacionais');
  s+=cap('Componentes de transformação do CPV (fora da matéria-prima direta), a partir da absorção por centro de custo e da Razão Contábil — escalados proporcionalmente para fechar exatamente com Mão de Obra ('+money(t.mod)+') e GGF ('+money(t.ggf)+') do CPV.');
  s+=H3('Absorção por centro de custo no CPV','MOD · GGF · horas · R$/hora','cx-absorcao-cc');
  s+=table(['Centro de custo','MOD','GGF','Absorção CPV','Absorção Total','Horas apontadas','R$/hora'],
    a.cc.map(x=>[esc(x[0]),money(x[1]),money(x[2]),money(x[3]),money(x[6]),nf(Math.round(x[4])),x[7]?money(x[7]):'—']),
    ['left','right','right','right','right','right','right'],
    ['Total',money(a.cc.reduce((s2,x)=>s2+x[1],0)),money(a.cc.reduce((s2,x)=>s2+x[2],0)),money(a.ccTotal.custo),money(a.ccTotal.custoRaw),nf(Math.round(a.ccTotal.horas)),money(a.ccTotal.taxaRaw)],
    ins('taxaHoraCC',{cc:a.cc,id:'cpv'}));
  s+=cap('"Absorção CPV" é MOD+GGF escalado para fechar com o CPV Total da leitura executiva. "Absorção Total" é o valor cheio absorvido no período (mesma base da seção Custos — Operacional) — a taxa hora (R$/hora) usa este total, não o escalado ao CPV.');
  const moggfItens=moggfPorTipoDeConta(a,t.mod,t.ggf);
  const totMO=moggfItens.filter(x=>x[1]==='Mão de Obra').reduce((s2,x)=>s2+x[2],0);
  const totGGFconta=moggfItens.filter(x=>x[1]==='GGF').reduce((s2,x)=>s2+x[2],0);
  const totMoggf=totMO+totGGFconta;
  s+=H3('Absorção por tipo de conta no CPV','Produtivo · segregado entre Mão de Obra e GGF','cx-absorcao-conta');
  s+='<div class="kpis k2">'
    +kpi('Mão de Obra',mi(totMO),pct(totMoggf?totMO/totMoggf:0,0)+' do produtivo')
    +kpi('GGF',mi(totGGFconta),pct(totMoggf?totGGFconta/totMoggf:0,0)+' do produtivo')
    +'</div>';
  s+=table(['Tipo de conta','Classificação','Valor','% do total'],
    moggfItens.sort((x,y)=>y[2]-x[2]).map(x=>[esc(x[0]),x[1],money(x[2]),pct(totMoggf?x[2]/totMoggf:0,1)]),
    ['left','left','right','right'],
    ['Total','',money(totMoggf),'100,0%'],
    ins('auto',{itens:moggfItens.map(x=>({name:x[0],v:x[2]})),escopo:'tipo de conta',
      escopoPl:'tipos de conta',universo:'do custo produtivo',id:'cx-conta',tabela:true,
      preferir:['estrutura','cauda']}));
  s+=cap('Classificação por tipo de conta produtiva: "Pessoal" (salários e encargos) compõe Mão de Obra; os demais tipos de conta produtivos (materiais de consumo, terceiros, facilities, manutenção, aluguel/fretes, depreciação etc.) compõem GGF.');

  // ===== 7) Custo evitável =====
  // ===== 7) Custo evitável — mesma leitura de retrabalho/assistência da seção Operacional,
  // mas com os totais e % escalados à base do CPV (custoRaw = absorção cheia do período). =====
  const retPctX=a.ccTotal.custoRaw?a.retrabalho.total/a.ccTotal.custoRaw:0, assPctX=a.ccTotal.custoRaw?a.assistencia.total/a.ccTotal.custoRaw:0;
  s+=H3('Custo evitável — retrabalho e assistência técnica','o que não agrega valor','cx-evitavel');
  // YTD (jan do ano do fim do período até o próprio fim do período) para dar contexto ao total do
  // recorte selecionado — só calcula/mostra quando é diferente do próprio período (evita duplicar).
  const ytdMin=Math.floor(cxMax/100)*100+1, ytdMax=cxMax, ytdAno=Math.floor(cxMax/100);
  const ytdAgg=(ytdMin===cxMin&&ytdMax===cxMax)?null:custosAgg(ytdMin,ytdMax,['MATERIAIS']);
  const ytdTxt=v=>ytdAgg?' · YTD '+ytdAno+': '+mi(v):'';

  s+=H3('Custo de retrabalho','evolução mensal · operações "RET"','cx-retrabalho');
  s+='<div class="kpis k3">'+kpi('Retrabalho total',mi(a.retrabalho.total),lab+ytdTxt(ytdAgg&&ytdAgg.retrabalho.total))
    +kpi('% do custo de produção',pct(retPctX,2),'vs. custo total absorvido',retPctX>0.02?'warn':'ok')
    +kpi('Item mais afetado',a.retrabalho.porItem.length?esc(trunc(a.retrabalho.porItem[0][1],30)):'—',a.retrabalho.porItem.length?money(a.retrabalho.porItem[0][2]):'')+'</div>';
  if(a.retrabalho.mensal.length>1) s+=fig(line([['Custo de retrabalho',a.retrabalho.mensal.map(m=>m[1]),BAD]],a.retrabalho.mensal.map(m=>custosMesLab(m[0])),{valfmt:v=>money(v),w:960,h:280}),
    ins('custoEvitavel',{ret:a.retrabalho,ass:a.assistencia,base:a.ccTotal.custoRaw||a.ccTotal.custo}));
  const retCCx={}; a.retrabalho.porItem.forEach(x=>{retCCx[x[0]]=(retCCx[x[0]]||0)+x[2];});
  const retParetoX=Object.entries(retCCx).sort((x,y)=>y[1]-x[1]).slice(0,12).map(([k,v])=>[trunc(k,22),v]);
  if(retParetoX.length>2){
    s+=H3('Pareto de retrabalho por centro de custo','onde se concentra o custo evitável','cx-retrabalho-pareto');
    s+=fig(pareto(retParetoX,{valfmt:v=>money(v,0),w:900,h:300}),
      ins('auto',{itens:retParetoX.map(x=>({name:x[0],v:x[1]})),escopo:'centro de custo',
        escopoPl:'centros de custo',universo:'do retrabalho',id:'cx-retrabalho',
        preferir:['estrutura','cauda','relacao']}));
    s+=cap('A linha tracejada acumula a participação: os primeiros centros de custo concentram a maior parte do retrabalho — ponto de partida para o plano de ação da fábrica.');
  }
  s+=table(['Centro de custo','Produto retrabalhado','Custo de retrabalho','% do retrabalho total'],
    a.retrabalho.porItem.slice(0,25).map(x=>[esc(x[0]),esc(trunc(x[1],48)),money(x[2]),pct(a.retrabalho.total?x[2]/a.retrabalho.total:0)]),['left','left','right','right'],null,
    ins('auto',{itens:a.retrabalho.porItem.map(x=>({name:x[1],v:x[2]})),escopo:'produto',
      escopoPl:'produtos',universo:'do retrabalho',id:'retrab-item',tabela:true,
      preferir:['estrutura','relacao']}));

  s+=H3('Custo de assistência técnica','evolução mensal · por produto','cx-assistencia');
  s+='<div class="kpis k2">'+kpi('Assist. técnica total',mi(a.assistencia.total),lab+ytdTxt(ytdAgg&&ytdAgg.assistencia.total))
    +kpi('% do custo de produção',pct(assPctX,2),'vs. custo total absorvido',assPctX>0.03?'warn':'ok')+'</div>';
  if(a.assistencia.mensal.length>1) s+=fig(line([['Custo de assistência técnica',a.assistencia.mensal.map(m=>m[1]),WARN]],a.assistencia.mensal.map(m=>custosMesLab(m[0])),{valfmt:v=>money(v),w:960,h:280}),
    ins('serieOscilacao',{labels:a.assistencia.mensal.map(m=>custosMesLab(m[0])),
      vals:a.assistencia.mensal.map(m=>m[1]),id:'assist'}));
  s+=H3('Maiores custos de assistência técnica por produto','','cx-assistencia-prod');
  s+=table(['Produto','Custo de assistência técnica'],a.assistencia.porProduto.map(x=>[esc(trunc(x[0],60)),money(x[1])]),['left','right'],null,
    ins('auto',{itens:a.assistencia.porProduto.map(x=>({name:x[0],v:x[1]})),escopo:'produto',
      escopoPl:'produtos',universo:'da assistência técnica',id:'assist-prod',tabela:true,
      preferir:['estrutura','cauda']}));

  s+=call('Esta é a leitura executiva. O detalhamento técnico completo — absorção por centro de custo, horas apontadas e explosão de custo ao nível zero — está na seção <b>Custos — Operacional</b>.','note');
  return s;
}

/* ---- Nível Zero: custo de matéria-prima direta por produto acabado (A × B) ---- */
let nzCod=null,nzYmA=MINYM_CUSTOS,nzYmB=MAXYM_CUSTOS,nzIdA='',nzIdB='';
function buildNZFilter(){
  const C=window.CUSTOS; if(!C.nz_produtos||!C.nz_produtos.length) return call('Sem dados de nível zero disponíveis.','warn');
  const prods=C.nz_produtos.slice().sort((x,y)=>x[0].localeCompare(y[0]));
  const prodsByDesc=C.nz_produtos.slice().sort((x,y)=>x[1].localeCompare(y[1],'pt'));
  const codOpts=prods.map(p=>`<option value="${esc(p[0])}">${esc(p[0])}</option>`).join('');
  const descListOpts=prodsByDesc.map(p=>`<option value="${esc(p[1])}">`).join('');
  const yms=ymList(MINYM_CUSTOS,MAXYM_CUSTOS); const opts=yms.map(y=>`<option value="${y}">${ymLab(y)}</option>`).join('');
  return `<div class="nz-fb">
    <div class="nzf">Código do produto acabado<select id="nz-cod">${codOpts}</select></div>
    <div class="nzf">Descrição do produto acabado<input id="nz-desc" list="nz-desc-list" autocomplete="off" placeholder="Digite para buscar...">
      <datalist id="nz-desc-list">${descListOpts}</datalist></div>
    <div class="nzf">Período A (base)<select id="nz-a">${opts}</select></div>
    <div class="nzf">ID (ordem) — período A<select id="nz-ida"><option value="">Todos</option></select></div>
    <div class="nzf">Período B (comparado)<select id="nz-b">${opts}</select></div>
    <div class="nzf">ID (ordem) — período B<select id="nz-idb"><option value="">Todos</option></select></div>
    <button id="nz-apply">Comparar</button></div>`;
}
function nzCompute(cod,ymA,idA,ymB,idB){
  const C=window.CUSTOS;
  const volOf=(ym,id)=>C.nz_volume.filter(r=>r[1]===cod&&r[0]===ym&&(!id||r[2]===id)).reduce((s,r)=>s+r[3],0);
  const um={};
  const matsOf=(ym,id)=>{const m={}; C.nz_materiais.filter(r=>r[1]===cod&&r[0]===ym&&(!id||r[2]===id)).forEach(r=>{
    const o=m[r[3]]||(m[r[3]]={qtd:0,custo:0}); o.qtd+=r[5]; o.custo+=r[6]; if(r[4]&&!um[r[3]]) um[r[3]]=r[4];}); return m;};
  const volA=volOf(ymA,idA), volB=volOf(ymB,idB);
  const matsA=matsOf(ymA,idA), matsB=matsOf(ymB,idB);
  const nomes=Array.from(new Set([...Object.keys(matsA),...Object.keys(matsB)]));
  const linhas=nomes.map(nm=>{
    const qA=(matsA[nm]||{qtd:0}).qtd, cA=(matsA[nm]||{custo:0}).custo;
    const qB=(matsB[nm]||{qtd:0}).qtd, cB=(matsB[nm]||{custo:0}).custo;
    const qtdUnitA=volA?qA/volA:0, custoUnitA=qA?cA/qA:0;
    const qtdUnitB=volB?qB/volB:0, custoUnitB=qB?cB/qB:0;
    const difQtdUnit=qtdUnitB-qtdUnitA, difCustoUnit=custoUnitB-custoUnitA;
    const efeitoMix=difQtdUnit*custoUnitA, efeitoCusto=difCustoUnit*qtdUnitB;
    const impacto=efeitoMix+efeitoCusto;
    return {nm,um:um[nm]||'',qA,qtdUnitA,custoUnitA,custoTotalA:cA,qB,qtdUnitB,custoUnitB,custoTotalB:cB,difQtdUnit,difCustoUnit,efeitoMix,efeitoCusto,impacto};
  });
  const custoTotalB=linhas.reduce((s,l)=>s+l.custoTotalB,0);
  const custoUnitProdB=volB?custoTotalB/volB:0;
  linhas.forEach(l=>l.pctImpacto=custoUnitProdB?l.impacto/custoUnitProdB:0);
  linhas.sort((x,y)=>Math.abs(y.impacto)-Math.abs(x.impacto));
  const custoTotalA=linhas.reduce((s,l)=>s+l.custoTotalA,0);
  return {linhas,volA,volB,custoTotalA,custoTotalB,custoUnitProdA:volA?custoTotalA/volA:0,custoUnitProdB};
}
function nzBox(titulo,vol,custoUnit,custoTotal){
  return `<div class="nzbox"><div class="nzhead">${esc(titulo)}</div>
    <div class="nzrow"><b>Vol. Produzido</b><span>${nf(vol,1)}</span></div>
    <div class="nzrow"><b>Custo Unit. (R$/peça)</b><span>${money(custoUnit,2)}</span></div>
    <div class="nzrow"><b>Custo Total (R$)</b><span>${money(custoTotal)}</span></div></div>`;
}
function nzFillIds(sel,cod,ym,keep){
  const ids=Array.from(new Set(window.CUSTOS.nz_ordens.filter(o=>o[0]===cod&&o[1]===ym).map(o=>o[3]).filter(Boolean)));
  sel.innerHTML='<option value="">Todos</option>'+ids.map(i=>`<option value="${esc(i)}">${esc(i)}</option>`).join('');
  if(keep&&ids.includes(keep)) sel.value=keep;
}
function drawNZ(){
  const cod=document.getElementById('nz-cod').value;
  const ymA=+document.getElementById('nz-a').value, ymB=+document.getElementById('nz-b').value;
  const idSelA=document.getElementById('nz-ida'), idSelB=document.getElementById('nz-idb');
  nzFillIds(idSelA,cod,ymA,nzIdA); nzFillIds(idSelB,cod,ymB,nzIdB);
  const idA=idSelA.value, idB=idSelB.value;
  const prodAtual=window.CUSTOS.nz_produtos.find(p=>p[0]===cod);
  document.getElementById('nz-desc').value=prodAtual?prodAtual[1]:'';
  const r=nzCompute(cod,ymA,idA,ymB,idB);
  let s='<div class="two">'+nzBox('Período A ('+custosMesLab(ymA)+(idA?' · ID '+idA:'')+')',r.volA,r.custoUnitProdA,r.custoTotalA)
    +nzBox('Período B ('+custosMesLab(ymB)+(idB?' · ID '+idB:'')+')',r.volB,r.custoUnitProdB,r.custoTotalB)+'</div>';
  if(!r.linhas.length){ s+=call('Sem consumo de matéria-prima direta (TP=C) registrado para este produto nos períodos/IDs selecionados.','warn'); }
  else {
    s+='<div class="nzwide">'+table(['Material','UM','Qtd Consumida (A)','Qtd Unitária (A)','Custo Unit. (A)','Custo Total (A)',
      'Qtd Consumida (B)','Qtd Unitária (B)','Custo Unit. (B)','Custo Total (B)',
      'Dif. Qtd Unitária','Dif. Custo Unit.','Efeito Mix/Consumo (R$/Un)','Efeito Custo (R$/Un)','Impacto Total (R$/Un)','% Impacto'],
      r.linhas.map(l=>[esc(trunc(l.nm,40)),esc(l.um),nf(l.qA,2),nf(l.qtdUnitA,4),money(l.custoUnitA,2),money(l.custoTotalA),
        nf(l.qB,2),nf(l.qtdUnitB,4),money(l.custoUnitB,2),money(l.custoTotalB),
        nf(l.difQtdUnit,4),money(l.difCustoUnit,2),
        `<span style="color:${l.efeitoMix>=0?BAD:GOOD}">${money(l.efeitoMix,2)}</span>`,
        `<span style="color:${l.efeitoCusto>=0?BAD:GOOD}">${money(l.efeitoCusto,2)}</span>`,
        `<span style="color:${l.impacto>=0?BAD:GOOD};font-weight:700">${money(l.impacto,2)}</span>`,
        pct(l.pctImpacto,1)]),
      ['left','left','right','right','right','right','right','right','right','right','right','right','right','right','right','right'],
      ['Total','','','','',money(r.custoTotalA),'','','',money(r.custoTotalB),'','',
        money(r.linhas.reduce((s2,l)=>s2+l.efeitoMix,0),2),money(r.linhas.reduce((s2,l)=>s2+l.efeitoCusto,0),2),
        money(r.linhas.reduce((s2,l)=>s2+l.impacto,0),2),pct(r.custoUnitProdB?r.linhas.reduce((s2,l)=>s2+l.impacto,0)/r.custoUnitProdB:0,1)])+'</div>';
    s+=cap('Efeito Mix/Consumo (R$/Un) = (Qtd Unit. B − Qtd Unit. A) × Custo Unit. A. Efeito Custo (R$/Un) = (Custo Unit. B − Custo Unit. A) × Qtd Unit. B. Impacto Total (R$/Un) = soma dos dois efeitos, por unidade de produto acabado. % Impacto = Impacto Total (R$/Un) ÷ Custo Unitário (B) do produto.');
  }
  document.getElementById('nz-body').innerHTML=s;
}
function initNZ(){
  if(!window.CUSTOS||!window.CUSTOS.nz_produtos||!window.CUSTOS.nz_produtos.length) return;
  const codSel=document.getElementById('nz-cod'); if(!codSel) return;
  const descInp=document.getElementById('nz-desc');
  document.getElementById('nz-a').value=nzYmA; document.getElementById('nz-b').value=nzYmB;
  const prodByCod=cd=>window.CUSTOS.nz_produtos.find(p=>p[0]===cd);
  if(nzCod){ codSel.value=nzCod; const pr=prodByCod(nzCod); if(pr) descInp.value=pr[1]; }
  codSel.addEventListener('change',()=>{ nzCod=codSel.value; const pr=prodByCod(nzCod); descInp.value=pr?pr[1]:''; nzIdA=''; nzIdB=''; drawNZ(); });
  descInp.addEventListener('change',()=>{ const pr=window.CUSTOS.nz_produtos.find(p=>p[1]===descInp.value);
    if(pr){ nzCod=pr[0]; codSel.value=nzCod; nzIdA=''; nzIdB=''; drawNZ(); } });
  document.getElementById('nz-a').addEventListener('change',()=>{ nzYmA=+document.getElementById('nz-a').value; nzIdA=''; drawNZ(); });
  document.getElementById('nz-b').addEventListener('change',()=>{ nzYmB=+document.getElementById('nz-b').value; nzIdB=''; drawNZ(); });
  document.getElementById('nz-ida').addEventListener('change',()=>{ nzIdA=document.getElementById('nz-ida').value; drawNZ(); });
  document.getElementById('nz-idb').addEventListener('change',()=>{ nzIdB=document.getElementById('nz-idb').value; drawNZ(); });
  document.getElementById('nz-apply').addEventListener('click',drawNZ);
  drawNZ();
}
/* ---- Evolutivo Custo de Produção — Prod. Acab. (R$/Un.), por matéria-prima direta ---- */
let pcCod=null,pcId='',pcDe=MINYM_CUSTOS,pcAte=MAXYM_CUSTOS;
function buildPCFilter(){
  const C=window.CUSTOS; if(!C.nz_produtos||!C.nz_produtos.length) return call('Sem dados disponíveis.','warn');
  const prods=C.nz_produtos.slice().sort((x,y)=>x[0].localeCompare(y[0]));
  const prodsByDesc=C.nz_produtos.slice().sort((x,y)=>x[1].localeCompare(y[1],'pt'));
  const codOpts=prods.map(p=>`<option value="${esc(p[0])}">${esc(p[0])}</option>`).join('');
  const descListOpts=prodsByDesc.map(p=>`<option value="${esc(p[1])}">`).join('');
  const yms=ymList(MINYM_CUSTOS,MAXYM_CUSTOS); const opts=yms.map(y=>`<option value="${y}">${ymLab(y)}</option>`).join('');
  return `<div class="nz-fb">
    <div class="nzf">Código do produto acabado<select id="pc-cod">${codOpts}</select></div>
    <div class="nzf">Descrição do produto acabado<input id="pc-desc" list="pc-desc-list" autocomplete="off" placeholder="Digite para buscar...">
      <datalist id="pc-desc-list">${descListOpts}</datalist></div>
    <div class="nzf">ID do produto acabado (ordens)<select id="pc-id"><option value="">Todos</option></select></div>
    <div class="nzf">Período — de<select id="pc-de">${opts}</select></div>
    <div class="nzf">até<select id="pc-ate">${opts}</select></div>
    <button id="pc-apply">Atualizar</button></div>`;
}
function pcMesCusto(cod,ym,id){
  const C=window.CUSTOS;
  const vol=C.nz_volume.filter(r=>r[1]===cod&&r[0]===ym&&(!id||r[2]===id)).reduce((s,r)=>s+r[3],0);
  if(!vol) return null;
  const custo=C.nz_materiais.filter(r=>r[1]===cod&&r[0]===ym&&(!id||r[2]===id)).reduce((s,r)=>s+r[6],0);
  return custo/vol;
}
function drawPC(){
  const cod=document.getElementById('pc-cod').value;
  const de=+document.getElementById('pc-de').value, ate=+document.getElementById('pc-ate').value;
  const idSel=document.getElementById('pc-id');
  const ids=Array.from(new Set(window.CUSTOS.nz_ordens.filter(o=>o[0]===cod&&o[1]>=de&&o[1]<=ate).map(o=>o[3]).filter(Boolean)));
  idSel.innerHTML='<option value="">Todos</option>'+ids.map(i=>`<option value="${esc(i)}">${esc(i)}</option>`).join('');
  if(pcId&&ids.includes(pcId)) idSel.value=pcId; else pcId='';
  const id=idSel.value;
  const prod=window.CUSTOS.nz_produtos.find(p=>p[0]===cod);
  document.getElementById('pc-desc').value=prod?prod[1]:'';

  const yms=ymList(de,ate); let last=null;
  const serie=yms.map(ym=>{ let v=pcMesCusto(cod,ym,id); if(v==null) v=last; else last=v; return [ym,v]; });
  const anos={}; serie.forEach(([ym,v])=>{ const ano=Math.floor(ym/100),mes=(ym%100)-1; (anos[ano]||(anos[ano]=Array(12).fill(null)))[mes]=v; });
  const anosOrd=Object.keys(anos).map(Number).sort((a,b)=>a-b);

  let s=`<p class="cap" style="margin:2px 0 10px">${esc((prod?prod[1]:cod))}${id?' · ID '+esc(id):''}</p>`;
  if(!serie.some(([,v])=>v!=null)){ s+=call('Sem consumo de matéria-prima direta (TP=C) registrado para este produto no período/ID selecionado.','warn'); }
  else {
    const cores=[SER[3],SER[0],SER[6],SER[2]];
    s+=fig(line(anosOrd.map((ano,i)=>[`Custo de ${ano}`,anos[ano],cores[i%cores.length]]),MES,{valfmt:v=>money(v,2),w:980,h:320,legend:true}),
      ins('comparaAnos',{anos:anos,ordem:anosOrd,id:'pc'}));
    const linhas=[];
    anosOrd.forEach(ano=>{
      const vals=anos[ano];
      linhas.push([`Custo de ${ano}`,...vals.map(v=>v==null?'—':money(v,2))]);
      const varr=vals.map((v,i)=>{ if(v==null||i===0||vals[i-1]==null) return '—'; return spct(vals[i-1]?v/vals[i-1]-1:0); });
      linhas.push(['Variação Mês',...varr.map(v=>v==='—'?v:`<span style="color:${v.startsWith('-')?BAD:GOOD}">${v}</span>`)]);
    });
    s+=table(['',...MES],linhas,['left',...MES.map(_=>'right')]);
  }
  document.getElementById('pc-body').innerHTML=s;
}
function initPC(){
  if(!window.CUSTOS||!window.CUSTOS.nz_produtos||!window.CUSTOS.nz_produtos.length) return;
  const codSel=document.getElementById('pc-cod'); if(!codSel) return;
  const descInp=document.getElementById('pc-desc');
  document.getElementById('pc-de').value=pcDe; document.getElementById('pc-ate').value=pcAte;
  const prodByCod=cd=>window.CUSTOS.nz_produtos.find(p=>p[0]===cd);
  if(pcCod){ codSel.value=pcCod; const pr=prodByCod(pcCod); if(pr) descInp.value=pr[1]; }
  codSel.addEventListener('change',()=>{ pcCod=codSel.value; const pr=prodByCod(pcCod); descInp.value=pr?pr[1]:''; pcId=''; drawPC(); });
  descInp.addEventListener('change',()=>{ const pr=window.CUSTOS.nz_produtos.find(p=>p[1]===descInp.value);
    if(pr){ pcCod=pr[0]; codSel.value=pcCod; pcId=''; drawPC(); } });
  document.getElementById('pc-id').addEventListener('change',()=>{ pcId=document.getElementById('pc-id').value; drawPC(); });
  document.getElementById('pc-apply').addEventListener('click',()=>{
    pcDe=+document.getElementById('pc-de').value; pcAte=+document.getElementById('pc-ate').value; drawPC(); });
  drawPC();
}
function buildTopProdTable(list,a,query){
  const top20=list.slice(0,20), rest=list.slice(20);
  const tQ=list.reduce((s2,p)=>s2+p.qtd,0),tM=list.reduce((s2,p)=>s2+p.mat,0),tO=list.reduce((s2,p)=>s2+p.mod,0),
    tG=list.reduce((s2,p)=>s2+p.ggf,0),tC=list.reduce((s2,p)=>s2+p.custo,0);
  if(!list.length) return call('Nenhum produto encontrado para "'+esc(query)+'" no período.','warn');
  const rows=top20.map(p=>[esc(trunc(p.prod,50)),esc(p.grp),nf(p.qtd),money(p.mat),money(p.mod),money(p.ggf),money(p.custo),money(p.qtd?p.custo/p.qtd:0)]);
  if(rest.length){const r=rest.reduce((s2,p)=>({qtd:s2.qtd+p.qtd,mat:s2.mat+p.mat,mod:s2.mod+p.mod,ggf:s2.ggf+p.ggf,custo:s2.custo+p.custo}),{qtd:0,mat:0,mod:0,ggf:0,custo:0});
    rows.push(['<b>Demais produtos</b>',`<span class="mut">${nf(rest.length)} itens</span>`,nf(r.qtd),money(r.mat),money(r.mod),money(r.ggf),money(r.custo),money(r.qtd?r.custo/r.qtd:0)]);}
  return '<div class="tbl-fit">'+table(['Produto','Grupo','Qtde produzida','MAT','M.O','GGF','CPP total','CPP/unidade'],rows,
    ['left','left','right','right','right','right','right','right'],
    ['Total',esc(list.length+' produtos'),nf(tQ),money(tM),money(tO),money(tG),money(tC),money(tQ?tC/tQ:0)])+'</div>';
}
function initProdSearch(){
  const inp=document.getElementById('prodsearch'); if(!inp||!cuLastAgg) return;
  let tmr=null;
  inp.addEventListener('input',()=>{
    clearTimeout(tmr);
    tmr=setTimeout(()=>{
      const q=inp.value.trim().toLowerCase();
      const list=q?cuLastAgg.produtos.filter(p=>p.prod.toLowerCase().includes(q)||p.grp.toLowerCase().includes(q)):cuLastAgg.produtos;
      const box=document.getElementById('topprod'); if(box) box.innerHTML=buildTopProdTable(list,cuLastAgg,q);
    },220);
  });
}
function renderCompare(a){
  if(cbMin==null) return '';
  const b=custosAgg(cbMin,cbMax,null,'cpp'); reconcileCustos(b);
  const la=custosPeriodLabel(cuMin,cuMax), lb=custosPeriodLabel(cbMin,cbMax);
  const dv=(x,y)=>y?deltaCost(x/y-1):'—';
  let s=H3('Comparativo de períodos','<b>'+esc(la)+'</b> vs '+esc(lb),'cu-comparativo');
  const ua=a.total.qtd?a.total.custo/a.total.qtd:0, ub=b.total.qtd?b.total.custo/b.total.qtd:0;
  s+=table(['Indicador',la,lb,'Variação'],[
    ['CPP total',money(a.total.custo),money(b.total.custo),dv(a.total.custo,b.total.custo)],
    ['Volume produzido',nf(Math.round(a.total.qtd)),nf(Math.round(b.total.qtd)),b.total.qtd?deltaHtml(a.total.qtd/b.total.qtd-1):'—'],
    ['CPP médio / unidade',money(ua),money(ub),dv(ua,ub)],
    ['Matéria-prima (MAT)',money(a.total.mat),money(b.total.mat),dv(a.total.mat,b.total.mat)],
    ['Mão de obra (M.O)',money(a.total.mod),money(b.total.mod),dv(a.total.mod,b.total.mod)],
    ['GGF',money(a.total.ggf),money(b.total.ggf),dv(a.total.ggf,b.total.ggf)],
    ['Retrabalho',money(a.retrabalho.total),money(b.retrabalho.total),dv(a.retrabalho.total,b.retrabalho.total)],
    ['Assistência técnica',money(a.assistencia.total),money(b.assistencia.total),dv(a.assistencia.total,b.assistencia.total)],
  ],['left','right','right','right']);
  // categorias de matéria-prima
  const catsB={}; b.materiais.forEach(([c,v])=>catsB[c]=v);
  s+='<div class="two"><div>'+H3('Matéria-prima por categoria','','cu-mp-cat')
    +table(['Categoria',la,lb,'Var.'],a.materiais.map(([c,v])=>[esc(c),money(v),money(catsB[c]||0),dv(v,catsB[c])]),
      ['left','right','right','right'])+'</div>';
  // CPV/un por grupo (10 maiores do período atual)
  const grpB={}; b.grupos.forEach(g=>grpB[g[0]]={q:g[1],c:g[5]});
  s+='<div>'+H3('CPP/unidade por grupo','','cu-cpp-grupo')
    +table(['Grupo',la,lb,'Var.'],a.grupos.slice(0,10).map(g=>{
      const uA=g[1]?g[5]/g[1]:0, gb=grpB[g[0]], uB=gb&&gb.q?gb.c/gb.q:0;
      return [esc(g[0]),money(uA),uB?money(uB):'—',uB?dv(uA,uB):'—'];
    }),['left','right','right','right'])+'</div></div>';
  s+=call('Nas linhas de custo, <b>verde = caiu</b> (bom) e <b>vermelho = subiu</b>. Volume usa a convenção inversa. Use "Limpar comparação" no filtro para fechar este bloco.','note');
  return s;
}
function renderCustosBody(a){
  const t=a.total; if(!t.custo) return call('Sem dados de custo no período selecionado.','warn');
  const retPct=a.ccTotal.custo? a.retrabalho.total/a.ccTotal.custo:0, assPct=a.ccTotal.custo? a.assistencia.total/a.ccTotal.custo:0;
  const ccCaro=a.cc.filter(x=>x[5]>0).sort((x,y)=>y[5]-x[5])[0];
  let s='';
  s+=renderCompare(a);
  // ---- Dashboard de KPIs ----
  s+=H3('Painel de indicadores — visão executiva','','cu-painel');
  const kpiCount=9+(ccCaro?1:0), kpiRem=kpiCount%4, kpiSpan=kpiRem?4-kpiRem:0;
  const leituraTxt='Leitura rápida: cada R$1 de retrabalho e assistência técnica é custo evitável — some '+mi(a.retrabalho.total+a.assistencia.total)+' ('+pct(retPct+assPct,1)+' do custo de produção interno) que não agrega valor ao produto. GGF responde por '+pct(t.custo?t.ggf/t.custo:0,0)+' do CPP — a maior alavanca de eficiência é a absorção de custo fixo fabril por unidade produzida.';
  const leituraKind=(retPct+assPct)>0.04?'warn':'note';
  const leituraHtml=call(leituraTxt,leituraKind);
  s+='<div class="kpis">'
   +kpi('CPP Total',mi(t.custo),custosPeriodLabel(cuMin,cuMax))
   +kpi('Volume Produzido',nf(Math.round(t.qtd))+' un.','base do CPP (ordens de produção)')
   +kpi('CPP Médio',money(t.qtd?t.custo/t.qtd:0),'CPP total ÷ volume produzido')
   +kpi('Matéria-prima (MAT)',pct(t.custo?t.mat/t.custo:0,0),mi(t.mat)+' do CPP')
   +kpi('Mão de obra (M.O)',pct(t.custo?t.mod/t.custo:0,0),mi(t.mod)+' do CPP')
   +kpi('Gastos Gerais Fabricação',pct(t.custo?t.ggf/t.custo:0,0),mi(t.ggf)+' do CPP')
   +kpi('Custo de retrabalho',mi(a.retrabalho.total),pct(retPct,1)+' do custo de produção',retPct>0.02?'warn':'ok')
   +kpi('Custo de assist. técnica',mi(a.assistencia.total),pct(assPct,1)+' do custo de produção',assPct>0.03?'warn':'ok')
   +kpi('Horas apontadas (produção)',nf(Math.round(a.ccTotal.horas)),'taxa média '+money(a.ccTotal.taxa)+'/h')
   +(ccCaro?kpi('Centro de custo mais caro/h',esc(ccCaro[0]),money(ccCaro[5])+'/hora','warn'):'')
   +(kpiSpan?leituraHtml.replace('<div class="callout','<div style="grid-column:span '+kpiSpan+';margin:0;height:100%;box-sizing:border-box" class="callout'):'')
   +'</div>';
  if(!kpiSpan) s+=leituraHtml;

  // ---- 1) Custo de Produção Desmembrado ----
  s+=H3('Custo de Produção Desmembrado — CPP','matéria-prima, mão de obra e GGF · mensal · volume de produção no eixo','cu-desmembrado');
  const _insAbs=ins('cpvAbsorcao',{custosA:[a.ymMin,a.ymMax]});
  if(a.meses.length>=1){
    const nMeses=a.meses.length; const wChart=Math.min(980,Math.max(220,80*nMeses+150));
    s+=fig(stackedCols(a.meses.map(m=>custosMesLab(m[0])),[
      {name:'Matéria-prima (MAT)',values:a.meses.map(m=>m[1]),color:SER[0]},
      {name:'Mão de obra (M.O)',values:a.meses.map(m=>m[2]),color:SER[2]},
      {name:'GGF',values:a.meses.map(m=>m[3]),color:SER[1]},
    ],{valfmt:v=>mi(v,1),w:wChart,subLabels:a.meses.map(m=>nf(m[5])+' un.'),subTitle:'Vol. produção'}),
    _insAbs);
  }
  s+=table(['Componente','Valor total','% do CPP'],[
    ['Matéria-prima (MAT)',money(t.mat),pct(t.custo?t.mat/t.custo:0)],
    ['Mão de obra (M.O)',money(t.mod),pct(t.custo?t.mod/t.custo:0)],
    ['Gastos Gerais de Fabricação (GGF)',money(t.ggf),pct(t.custo?t.ggf/t.custo:0)],
  ],['left','right','right'],['CPP total',money(t.custo),'100,0%'],
    ins('auto',{itens:[{name:'Matéria-prima',v:t.mat},{name:'Mão de obra',v:t.mod},
        {name:'Gastos gerais de fabricação',v:t.ggf}],escopo:'componente',escopoPl:'componentes',
      universo:'do custo de produção',id:'cpp-componentes',tabela:true,preferir:['relacao']}));

  // ---- 2) Composição do Custo de Produção ----
  s+=H3('Composição do Custo de Produção - CPP','matéria-prima direta · clique numa fatia ou na legenda para abrir o detalhe da categoria','cu-composicao');
  s+=fig(pie3D(a.materiais,{valfmt:v=>mi(v,1),colorOf:nm=>CUSTOS_MAT_COLORS[nm]||SER[0]}),
    ins('auto',{itens:a.materiais.map(x=>({name:x[0],v:x[1]})),escopo:'categoria',
      escopoPl:'categorias de material',universo:'da matéria-prima',id:'cpp-materiais',
      preferir:['estrutura','cauda']}));
  s+=cap('Considera apenas matéria-prima direta (TP=C). Componentes fabricados internamente (TP=F) ficam de fora — o custo deles (MAT+M.O+GGF) já foi contabilizado na etapa de produção em que foram fabricados, e entrar aqui de novo seria contagem em duplicidade. <b>Clique numa fatia ou na legenda para abrir os principais materiais da categoria.</b>');
  s+='<div id="matdetail"></div>';

  // ---- 3) CPP por Grupo de Produtos ----
  s+=H3('CPP por grupo de produtos','volume e desmembramento · clique numa barra ou numa linha da tabela para abrir os produtos do grupo','cu-grupos');
  s+='<div id="grpchart">'+fig(hbar(a.grupos.map(g=>[g[0],g[5]]),{valfmt:v=>mi(v,1),padLeft:220,w:820,maxbars:12}),
    ins('auto',{itens:a.grupos.map(g=>({name:g[0],v:g[5],q:g[1]})),escopo:'grupo',
      escopoPl:'grupos de produto',universo:'do custo de produção',id:'cpp-grupos',
      preferir:['divergencia','cauda']}))+'</div>';
  s+='<div id="grpdetail"></div>';
  const grpQtdTot=a.grupos.reduce((s2,g)=>s2+g[1],0), grpMatTot=a.grupos.reduce((s2,g)=>s2+g[2],0),
    grpModTot=a.grupos.reduce((s2,g)=>s2+g[3],0), grpGgfTot=a.grupos.reduce((s2,g)=>s2+g[4],0), grpCustoTot=a.grupos.reduce((s2,g)=>s2+g[5],0);
  const hasTrend=a.mesesYm.length>1;
  s+='<div class="nzwide">'+table(['Grupo de produto','Qtde produzida','MAT','M.O','GGF','CPP total','CPP/unidade'].concat(hasTrend?['Tendência']:[]),
    a.grupos.map(g=>{
      const row=[`<span class="op-grp-cell drillable" data-grp="${esc(g[0])}">${esc(g[0])}</span>`,nf(g[1]),money(g[2]),money(g[3]),money(g[4]),money(g[5]),money(g[1]?g[5]/g[1]:0)];
      if(hasTrend) row.push(spark(a.mesesYm.map(ym=>(a.cpvGrpMes[g[0]]||{})[ym]||0),SER[0]));
      return row;
    }),
    ['left','right','right','right','right','right','right'].concat(hasTrend?['right']:[]),
    ['Total',nf(grpQtdTot),money(grpMatTot),money(grpModTot),money(grpGgfTot),money(grpCustoTot),money(grpQtdTot?grpCustoTot/grpQtdTot:0)].concat(hasTrend?['']:[]),
    ins('auto',{itens:a.grupos.map(g=>({name:g[0],v:g[5],q:g[1]})),escopo:'grupo',
      escopoPl:'grupos de produto',universo:'do custo de produção',id:'cpp-grupos-tab',tabela:true,
      preferir:['estrutura','relacao']}))+'</div>';

  s+='<div id="topprod-section" class="hidden-section">';
  /* o ranking do Executivo ja tinha o botao de fechar; aqui ele faltava, entao
     o drill do Operacional so abria e nunca se desfazia */
  s+='<div class="sec-head-flex">'+H3('Ranking de produtos produzidos - CPP','curva 80/20 · até 20 produtos · use a busca para achar qualquer produto da base','cu-ranking')
    +'<button id="topprod-close" type="button" class="dr-close">Fechar &#10005;</button></div>';
  s+=`<div class="searchbar"><input id="prodsearch" type="search" placeholder="Buscar produto na base completa (${nf(a.produtos.length)} itens)…" autocomplete="off"></div>`;
  s+='<div id="topprod">'+buildTopProdTable(a.produtos,a,'')+'</div>';
  s+='<div class="tw-ins">'+(window.INSRT?INSRT.strip(
      ins('auto',{itens:a.produtos.map(x=>({name:x.prod,v:x.custo,q:x.qtd})),escopo:'produto',
        escopoPl:'produtos',universo:'do custo de produção',id:'cpp-produtos',tabela:true,
        preferir:['cauda','relacao']})):'')+'</div>';
  s+=cap('Ranking por CPP total no período selecionado, limitado aos 20 produtos de maior custo. "Demais produtos" agrupa o restante da base para fechar com o total geral — juntos, Top 20 + Demais produtos somam o mesmo total da tabela por grupo acima.');
  s+='</div>';

  // ---- 4) Volume de Produção por Grupo de Produto ----
  s+=H3('Volume de produção por grupo de produto','mensal · evolutivo','cu-volume');
  const grpOrd=a.grupos.map(g=>g[0]).filter(g=>g!=='MATERIAIS');
  if(a.mesesYm.length>1){
    const mesesLbl=a.mesesYm.map(custosMesLab);
    const hdata={}; grpOrd.forEach(g=>{ hdata[g]={}; a.mesesYm.forEach((ym,i)=>{ hdata[g][mesesLbl[i]]=(a.volGrpMes[g]||{})[ym]||0; }); });
    s+=fig(heatmap(grpOrd,mesesLbl,hdata,{valfmt:v=>v?nf(v,0):'',padLeft:190,w:900}),
      ins('mixCruzado',{linhas:grpOrd,colunas:mesesLbl,mat:hdata,escopo:'grupo',id:'cpp-vol-mes'}));
    const volTotalSemMateriais=a.mesesYm.map(ym=>grpOrd.reduce((s2,g)=>s2+((a.volGrpMes[g]||{})[ym]||0),0));
    s+=fig(line([['Volume total',volTotalSemMateriais,SER[0]]],mesesLbl,{valfmt:v=>nf(v,0),w:960,h:260}),
      ins('serieOscilacao',{labels:mesesLbl,vals:volTotalSemMateriais,id:'cpp-volume',fmt:v=>nf(Math.round(v))+' peças',verbo:'produziu'}));
    s+='<div class="nzwide">'+table(['Grupo de produto',...mesesLbl,'Total'],
      grpOrd.map(g=>{const vals=a.mesesYm.map(ym=>(a.volGrpMes[g]||{})[ym]||0); return [esc(g),...vals.map(v=>nf(v)),nf(vals.reduce((s2,v)=>s2+v,0))];}),
      ['left',...mesesLbl.map(_=>'right'),'right'],
      ['Total',...volTotalSemMateriais.map(v=>nf(v)),nf(volTotalSemMateriais.reduce((s2,v)=>s2+v,0))],
      ins('auto',{itens:grpOrd.map(g=>({name:g,v:a.mesesYm.reduce((s2,ym)=>s2+((a.volGrpMes[g]||{})[ym]||0),0)})),
        escopo:'grupo',escopoPl:'grupos de produto',universo:'do volume produzido',
        id:'cpp-vol-tab',tabela:true,preferir:['estrutura','relacao']}))+'</div>';
  } else { s+=cap('Selecione um período com mais de um mês para ver a evolutiva mensal.'); }

  // ---- 5) Custos Operacionais ----
  s+=H3('Custos operacionais — Apoio × Produtivo','Razão contábil por centro de custo','cu-operacionais');
  const totClassif=a.operacionais.PRODUTIVO.total+a.operacionais['AUXILIAR/APOIO'].total;
  s+='<div class="kpis k3">'
    +kpi('Produtivo',mi(a.operacionais.PRODUTIVO.total),pct(totClassif?a.operacionais.PRODUTIVO.total/totClassif:0,0)+' do total')
    +kpi('Apoio / Auxiliar',mi(a.operacionais['AUXILIAR/APOIO'].total),pct(totClassif?a.operacionais['AUXILIAR/APOIO'].total/totClassif:0,0)+' do total')
    +kpi('Total (Produtivo + Apoio)',mi(totClassif),'')+'</div>';
  s+='<div class="two"><div>'+H3('Produtivo — por tipo de conta','','cu-produtivo')+fig(hbar(a.operacionais.PRODUTIVO.itens.slice(0,8),{valfmt:v=>mi(v,1),color:SER[2],padLeft:190,w:520,maxbars:8}),
    ins('auto',{itens:a.operacionais.PRODUTIVO.itens.map(x=>({name:x[0],v:x[1]})),escopo:'tipo de conta',
      escopoPl:'tipos de conta',universo:'do custo produtivo',id:'cpp-produtivo',
      preferir:['estrutura','relacao']}))+'</div>';
  s+='<div>'+H3('Apoio / Auxiliar — por tipo de conta','','cu-apoio')+fig(hbar(a.operacionais['AUXILIAR/APOIO'].itens.slice(0,8),{valfmt:v=>mi(v,1),color:SER[3],padLeft:190,w:520,maxbars:8}),
    ins('auto',{itens:a.operacionais['AUXILIAR/APOIO'].itens.map(x=>({name:x[0],v:x[1]})),escopo:'tipo de conta',
      escopoPl:'tipos de conta',universo:'do custo de apoio',id:'cpp-apoio',
      preferir:['estrutura','relacao']}))+'</div></div>';
  s+=cap('Classificação por centro de custo (Produtivo = fábrica; Apoio/Auxiliar = administrativo, comercial, suporte). "Produtivo" é a base de absorção de custo no CPP; "Apoio" fica fora do CPP, tratado como despesa operacional.');
  const totP=a.operacionais.PRODUTIVO.total, totA=a.operacionais['AUXILIAR/APOIO'].total;
  const contas=Array.from(new Set([...a.operacionais.PRODUTIVO.itens.map(x=>x[0]), ...a.operacionais['AUXILIAR/APOIO'].itens.map(x=>x[0])]));
  const vP=nm=>{const f=a.operacionais.PRODUTIVO.itens.find(x=>x[0]===nm); return f?f[1]:0;};
  const vA=nm=>{const f=a.operacionais['AUXILIAR/APOIO'].itens.find(x=>x[0]===nm); return f?f[1]:0;};
  const contasOrd=contas.map(nm=>[nm,vP(nm)+vA(nm)]).sort((x,y)=>y[1]-x[1]).map(x=>x[0]);
  s+=H3('Absorção de custo por tipo de conta','Produtivo × Apoio / Auxiliar','cu-absorcao-conta');
  s+=table(['Tipo de conta','Produtivo (R$)','% Produtivo','Apoio/Auxiliar (R$)','% Apoio'],
    contasOrd.map(nm=>[esc(nm),money(vP(nm)),pct(totP?vP(nm)/totP:0),money(vA(nm)),pct(totA?vA(nm)/totA:0)]),
    ['left','right','right','right','right'],
    ['Total',money(totP),'100,0%',money(totA),'100,0%'],
    ins('auto',{itens:contasOrd.map(nm=>({name:nm,v:vP(nm)+vA(nm)})),escopo:'tipo de conta',
      escopoPl:'tipos de conta',universo:'do custo absorvido',id:'cpp-conta',tabela:true,
      preferir:['estrutura','relacao']}));

  // ---- 6) Absorção por Centro de Custo ----
  s+=H3('Absorção por centro de custo','MOD · GGF · horas · R$/hora','cu-absorcao-cc');
  s+='<div class="two"><div>'+H3('Custo total absorvido','','cu-cc-total')+fig(hbar(a.cc.map(x=>[x[0],x[3]]),{valfmt:v=>mi(v,1),color:SER[0],padLeft:170,w:520}),
    ins('auto',{itens:a.cc.map(x=>({name:x[0],v:x[3],q:x[4]})),escopo:'centro de custo',
      escopoPl:'centros de custo',universo:'do custo absorvido',id:'cpp-cc',
      preferir:['divergencia','cauda']}))+'</div>';
  s+='<div>'+H3('Taxa hora (R$/h)','','cu-cc-taxa')+fig(hbar(a.cc.map(x=>[x[0],x[5]]),{valfmt:v=>money(v),color:SER[6],padLeft:170,w:520}),
    ins('auto',{itens:a.cc.map(x=>({name:x[0],v:x[3],q:x[4]})),escopo:'centro de custo',
      escopoPl:'centros de custo',universo:'do custo por hora',id:'cpp-taxa',
      preferir:['divergencia','relacao']}))+'</div></div>';
  s+=table(['Centro de custo','MOD','GGF','Custo total','Horas apontadas','R$/hora'],
    a.cc.map(x=>[esc(x[0]),money(x[1]),money(x[2]),money(x[3]),nf(Math.round(x[4])),x[5]?money(x[5]):'—']),
    ['left','right','right','right','right','right'],
    ['Total',money(a.cc.reduce((s2,x)=>s2+x[1],0)),money(a.cc.reduce((s2,x)=>s2+x[2],0)),money(a.ccTotal.custo),nf(Math.round(a.ccTotal.horas)),money(a.ccTotal.taxa)],
    ins('taxaHoraCC',{cc:a.cc.map(x=>[x[0],x[1],x[2],x[3],x[4],x[5],x[3],x[5]]),id:'cpp-tab'})
    ||ins('auto',{itens:a.cc.map(x=>({name:x[0],v:x[3],q:x[4]})),escopo:'centro de custo',
      escopoPl:'centros de custo',universo:'do custo absorvido',id:'cpp-cc-tab',tabela:true,
      preferir:['relacao']}));
  s+=cap('Horas apontadas via NDPRO359 (centros de trabalho reagrupados nos 8 centros de custo produtivos); coluna original vem em minutos e foi convertida para horas. Taxa hora = custo total absorvido ÷ horas apontadas no período.');

  // ---- 7) Custo de Retrabalho ----
  // YTD (jan do ano do fim do período até o próprio fim) para dar contexto ao total do recorte
  // selecionado — só calcula/mostra quando é diferente do próprio período (evita duplicar).
  // cuMax usa 300000 como sentinela de "sem limite" no preset Histórico completo — precisa
  // ficar preso ao último mês real da base de custos antes de virar ano/mês de calendário.
  const cuMaxReal=Math.min(cuMax,MAXYM_CUSTOS);
  const ytdMinOp=Math.floor(cuMaxReal/100)*100+1, ytdMaxOp=cuMaxReal, ytdAnoOp=Math.floor(cuMaxReal/100);
  const ytdAggOp=(ytdMinOp===cuMin&&ytdMaxOp===cuMax)?null:custosAgg(ytdMinOp,ytdMaxOp,null,'cpp');
  const ytdTxtOp=v=>ytdAggOp?' · YTD '+ytdAnoOp+': '+mi(v):'';
  s+=H3('Custo de retrabalho','evolução mensal · operações "RET"','cu-retrabalho');
  s+='<div class="kpis k3">'+kpi('Retrabalho total',mi(a.retrabalho.total),custosPeriodLabel(cuMin,cuMax)+ytdTxtOp(ytdAggOp&&ytdAggOp.retrabalho.total))
    +kpi('% do custo de produção',pct(retPct,2),'vs. custo total absorvido',retPct>0.02?'warn':'ok')
    +kpi('Item mais afetado',a.retrabalho.porItem.length?esc(a.retrabalho.porItem[0][0]):'—',a.retrabalho.porItem.length?money(a.retrabalho.porItem[0][2]):'')+'</div>';
  if(a.retrabalho.mensal.length>1) s+=fig(line([['Custo de retrabalho',a.retrabalho.mensal.map(m=>m[1]),BAD]],a.retrabalho.mensal.map(m=>custosMesLab(m[0])),{valfmt:v=>money(v),w:960,h:280}),
    ins('custoEvitavel',{ret:a.retrabalho,ass:a.assistencia,base:a.ccTotal.custoRaw||a.ccTotal.custo}));
  // pareto: onde o retrabalho se concentra (por centro de custo)
  const retCC={}; a.retrabalho.porItem.forEach(x=>{retCC[x[0]]=(retCC[x[0]]||0)+x[2];});
  const retPareto=Object.entries(retCC).sort((x,y)=>y[1]-x[1]).slice(0,12).map(([k,v])=>[trunc(k,22),v]);
  if(retPareto.length>2){
    s+=H3('Pareto de retrabalho por centro de custo','onde se concentra o custo evitável','cu-retrabalho-pareto');
    s+=fig(pareto(retPareto,{valfmt:v=>money(v,0),w:900,h:300}),
      ins('auto',{itens:retPareto.map(x=>({name:x[0],v:x[1]})),escopo:'centro de custo',
        escopoPl:'centros de custo',universo:'do retrabalho',id:'cpp-retrabalho',
        preferir:['estrutura','cauda','relacao']}));
    s+=cap('A linha tracejada acumula a participação: os primeiros centros de custo concentram a maior parte do retrabalho — ponto de partida para o plano de ação da fábrica.');
  }
  s+=table(['Centro de custo','Produto retrabalhado','Custo de retrabalho','% do retrabalho total'],
    a.retrabalho.porItem.slice(0,25).map(x=>[esc(x[0]),esc(trunc(x[1],48)),money(x[2]),pct(a.retrabalho.total?x[2]/a.retrabalho.total:0)]),['left','left','right','right'],null,
    ins('auto',{itens:a.retrabalho.porItem.map(x=>({name:x[1],v:x[2]})),escopo:'produto',
      escopoPl:'produtos',universo:'do retrabalho',id:'retrab-item',tabela:true,
      preferir:['estrutura','relacao']}));

  // ---- 8) Custo de Assistência Técnica ----
  s+=H3('Custo de assistência técnica','evolução mensal · por produto','cu-assistencia');
  s+='<div class="kpis k2">'+kpi('Assist. técnica total',mi(a.assistencia.total),custosPeriodLabel(cuMin,cuMax)+ytdTxtOp(ytdAggOp&&ytdAggOp.assistencia.total))
    +kpi('% do custo de produção',pct(assPct,2),'vs. custo total absorvido',assPct>0.03?'warn':'ok')+'</div>';
  if(a.assistencia.mensal.length>1) s+=fig(line([['Custo de assistência técnica',a.assistencia.mensal.map(m=>m[1]),WARN]],a.assistencia.mensal.map(m=>custosMesLab(m[0])),{valfmt:v=>money(v),w:960,h:280}),
    ins('serieOscilacao',{labels:a.assistencia.mensal.map(m=>custosMesLab(m[0])),
      vals:a.assistencia.mensal.map(m=>m[1]),id:'assist'}));
  s+=H3('Maiores custos de assistência técnica por produto','','cu-assistencia-prod');
  s+=table(['Produto','Custo de assistência técnica'],a.assistencia.porProduto.map(x=>[esc(trunc(x[0],60)),money(x[1])]),['left','right'],null,
    ins('auto',{itens:a.assistencia.porProduto.map(x=>({name:x[0],v:x[1]})),escopo:'produto',
      escopoPl:'produtos',universo:'da assistência técnica',id:'assist-prod',tabela:true,
      preferir:['estrutura','cauda']}));

  // ---- 9) Abertura de Custo - Nível Zero ----
  s+=H3('Abertura de Custo — Nível Zero','matéria-prima direta por produto acabado · comparativo A × B','cu-nivelzero');
  s+=cap('Explosão de custo ao nível zero: matéria-prima direta (TP=C) consumida nas ordens de produção do item selecionado. Componentes fabricados internamente (TP=F) não entram aqui — já são custo de uma etapa de produção anterior. Escolha o produto acabado e dois períodos para comparar.');
  s+=buildNZFilter();
  s+='<div id="nz-body"></div>';

  // ---- 10) Evolutivo Custo de Produção - Prod. Acab. ----
  s+=H3('Evolutivo Custo de Produção — Prod. Acab. (R$/Un.)','matéria-prima direta · evolução mensal por ano','cu-evolutivo');
  s+=cap('Custo unitário de matéria-prima direta (TP=C) por unidade de produto acabado, mês a mês. Quando não há produção no mês, repete o custo do último mês com dado disponível (sem quedas artificiais a zero).');
  s+=buildPCFilter();
  s+='<div id="pc-body"></div>';

  s+=call('Assunções de cálculo: (1) Composição de materiais aproximada por palavra-chave na descrição técnica — itens sem palavra-chave reconhecida entram em "Outros materiais"; (2) mapeamento dos centros de trabalho do NDPRO359 para os 8 centros de custo produtivos é uma correspondência aproximada (ex.: Preparar Madeira → Marcenaria, Costura/Couro → Tapeçaria); (3) "Absorção (+CPP) por tipo de conta" considera todo custo classificado como Produtivo na Razão CC; "Custos operacionais" mostra apenas Produtivo e Apoio/Auxiliar (CPP pós-venda e Reforma de galpão ficam fora); (4) Matéria-prima, MOD/GGF por centro de custo e por tipo de conta são escalados proporcionalmente para fechar com o CPP Total do Painel de Indicadores. Ajustes finos devem ser validados com a controladoria.','note');
  return s;
}

/* ================= FILTER + INIT ================= */
const PRESETS=[
 ['Histórico completo',200001,300000],
 ...anosFechados(ANO_V).map(y=>[String(y),y*100+1,y*100+12]),
 ['YTD '+(ANO_V-1)+' ('+ytdLab(MAXYM_VENDAS)+')',(ANO_V-1)*100+1,MAXYM_VENDAS-100],
 [ANO_V+' YTD ('+ytdLab(MAXYM_VENDAS)+')',ANO_V*100+1,MAXYM_VENDAS],
 [MES_LONGO[MAXYM_VENDAS%100-1]+' '+Math.floor(MAXYM_VENDAS/100),MAXYM_VENDAS,MAXYM_VENDAS],
];
/* padrão de abertura: YTD do ano corrente da base (o preset "2026 YTD"), não o histórico completo.
   Derivado de MAXYM_VENDAS para seguir sozinho na virada de ano. */
let curMin=Math.floor(MAXYM_VENDAS/100)*100+1, curMax=MAXYM_VENDAS;
function periodLabel(a,b){ if(a<=200001&&b>=300000)return 'histórico completo ('+ymLabAno(MINYM_VENDAS)+'–'+ymLab(MAXYM_VENDAS)+')';
  if(a===b) return ymLab(a).replace('/','/20'); const A=Math.floor(a/100),B=Math.floor(b/100);
  if(a%100===1&&b%100===12&&A===B) return 'ano '+A; return ymLab(a)+' – '+ymLab(b);}
function drawPeriodo(){ const a=aggregate(curMin,curMax); const lab=periodLabel(curMin,curMax);
  document.getElementById('periodo-body').innerHTML=renderPeriodo(a,lab);
  document.getElementById('periodo-label').textContent='Período: '+lab;
  document.querySelectorAll('.preset').forEach(el=>{el.classList.toggle('on', +el.dataset.a===curMin && +el.dataset.b===curMax);});
  remount('periodo');}
function buildFilter(){
  const allYm=ymList(MINYM_VENDAS,MAXYM_VENDAS);
  const opts=allYm.map(y=>`<option value="${y}">${ymLab(y)}</option>`).join('');
  return `<div class="filterbar"><div class="fb-presets">`
    +PRESETS.map((p,i)=>`<button class="preset" data-a="${p[1]}" data-b="${p[2]}">${esc(p[0])}</button>`).join('')
    +`</div><div class="fb-custom">De <select id="f-de">${opts}</select> até <select id="f-ate">${opts}</select>
      <button id="f-apply">Aplicar</button></div><div id="periodo-label" class="fb-label"></div></div>`;
}
function initFilter(){
  document.querySelectorAll('.preset').forEach(el=>el.addEventListener('click',()=>{curMin=+el.dataset.a;curMax=+el.dataset.b;
    const de=document.getElementById('f-de'),ate=document.getElementById('f-ate');
    de.value=Math.max(MINYM_VENDAS,curMin===200001?MINYM_VENDAS:curMin); ate.value=Math.min(MAXYM_VENDAS,curMax===300000?MAXYM_VENDAS:curMax); drawPeriodo();}));
  document.getElementById('f-apply').addEventListener('click',()=>{let a=+document.getElementById('f-de').value,b=+document.getElementById('f-ate').value;
    if(a>b){const t=a;a=b;b=t;} curMin=a;curMax=b; drawPeriodo();});
  document.getElementById('f-de').value=curMin; document.getElementById('f-ate').value=curMax;
}
/* ===== Performance Comercial: meta (planilha) × realizado (base comercial) =====
   Corte do realizado = MAXYM_VENDAS, o mesmo que YTD, Carteira e Sumário usam.

   Três cenários para os meses que faltam, todos distribuídos pelo PESO HISTÓRICO do mês e nunca
   em partes iguais (item 1.4 da ata de 26/08/2026 — "onde historicamente se vende dois, não
   adianta somar três"; dezembro é pico baixo e o segundo semestre concentra):
     projHist  — para onde a empresa vai, mantido o comportamento histórico;
     metaSaz   — o que falta para fechar o orçamento (substitui a antiga distribuição linear);
     projCagr  — onde estaria mantendo o próprio CAGR de venda contratada.
   A leitura das três juntas é o item 1.6. */
function metasCalc(){
  if(!window.METAS||!METAS.yms||!METAS.yms.length) return null;
  const yms=METAS.yms, meta=METAS.meta, ano=Math.floor(yms[0]/100);
  const fim=Math.min(MAXYM_VENDAS,yms[yms.length-1]);
  const real={}; DATA.rows.forEach(r=>{ if(r[0]>=yms[0]&&r[0]<=fim) real[r[0]]=(real[r[0]]||0)+r[1]; });
  const realizado=yms.map(y=>y<=fim?(real[y]||0):null);
  const iUlt=yms.reduce((a,y,i)=>y<=fim?i:a,-1);
  if(iUlt<0) return null;
  const metaAteAgora=meta.slice(0,iUlt+1).reduce((a,b)=>a+b,0);
  const realAteAgora=realizado.slice(0,iUlt+1).reduce((a,b)=>a+(b||0),0);
  const gapAcum=metaAteAgora-realAteAgora, restantes=yms.length-1-iUlt;
  const metaAno=meta.reduce((x,y)=>x+y,0);
  // sazonalidade da venda contratada nos anos fechados
  const vMes=vendaMensalPorAno();
  const anosFech=ANOS_SAZ.filter(y=>vMes[y]&&vMes[y].some(v=>v>0));
  const peso=pesoMensal(vMes,anosFech);
  const mesFim=(yms[iUlt]%100)-1;
  const idxRest=[]; for(let i=iUlt+1;i<yms.length;i++) idxRest.push((yms[i]%100)-1);
  const frac=fracaoDecorrida(peso,mesFim);
  // (1) projeção histórica: o realizado já representa `frac` do ano típico
  const totProjHist=frac>0?realAteAgora/frac:null;
  const distHist=totProjHist!=null?distribuiSazonal(totProjHist-realAteAgora,peso,idxRest):null;
  // (2) meta sazonal: o que falta para o orçamento, pelo peso de cada mês restante
  const distMeta=distribuiSazonal(metaAno-realAteAgora,peso,idxRest);
  // (3) ritmo CAGR: ano anterior corrigido pelo CAGR da venda contratada
  const anoAnt=ano-1, base=ANOS_SAZ[0];
  const cagrV=(vMes[anoAnt]&&vMes[base])?cagrCalc(vMes[anoAnt].reduce((a,b)=>a+b,0),
                 vMes[base].reduce((a,b)=>a+b,0),anoAnt-base):null;
  const totProjCagr=(cagrV!=null&&vMes[anoAnt])?vMes[anoAnt].reduce((a,b)=>a+b,0)*(1+cagrV):null;
  const distCagr=totProjCagr!=null?distribuiSazonal(totProjCagr-realAteAgora,peso,idxRest):null;
  const serie=dist=>yms.map((y,i)=>{ if(i<=iUlt) return realizado[i];
    const v=dist?dist[(y%100)-1]:null; return v==null?null:Math.max(0,v); });
  const projHist=serie(distHist), metaSaz=serie(distMeta), projCagr=serie(distCagr);
  const gap=yms.map((y,i)=>i<=iUlt?meta[i]-realizado[i]:null);
  let a=0,b=0;
  const metaAcum=meta.map(v=>a+=v);
  const realAcum=realizado.map(v=>v==null?null:(b+=v));
  return {yms,labels:yms.map(ymLab),meta,realizado,metaAtual:metaSaz,projHist,metaSaz,projCagr,
    gap,metaAcum,realAcum,peso,frac,idxRest,
    totProjHist,totProjCagr,cagrV,
    iUlt,fim,ano,gapAcum,restantes,metaAno,metaAteAgora,realAteAgora,
    aRealizar:metaAno-realAteAgora};
}
function renderPerformance(){
  const M=metasCalc();
  if(!M) return `<div class="sec-head"><h2>Performance Comercial</h2></div>`
    +call('Fonte "Metas Vendas '+ANO_V+'.xlsx" não encontrada em fontes/. Seção não gerada.','warn');
  const atg=M.metaAteAgora?M.realAteAgora/M.metaAteAgora:0;
  const mediaRest=M.restantes?(M.metaAno-M.realAteAgora)/M.restantes:0;
  const mediaReal=M.realAteAgora/(M.iUlt+1);
  let s=`<div class="sec-head"><div class="kick">Meta × realizado · ${M.ano}</div><h2>Performance Comercial</h2>
   <p class="lead">Venda contratada contra a meta de ${M.ano}, mês a mês e no acumulado. A meta vem de <b>Metas Vendas ${M.ano}.xlsx</b>; o realizado é apurado na base comercial até <b>${ymLab(M.fim)}</b>. A <b>meta sazonal</b> redistribui o gap acumulado pelos ${M.restantes} meses que restam <b>conforme o peso histórico de cada mês</b> — é o ritmo necessário para fechar o ano no orçado, cobrando mais de quem historicamente entrega mais.</p></div>`;
  s+='<div class="kpis k4">'
   +kpi('Realizado · acumulado',mi(M.realAteAgora),ymLab(M.yms[0])+'–'+ymLab(M.fim))
   +kpi('Meta · mesmo período',mi(M.metaAteAgora),M.iUlt+1+' meses')
   +kpi('Gap acumulado',mi(M.gapAcum),spct(atg-1)+' vs meta',M.gapAcum>0?'warn':'ok')
   +kpi('Atingimento',pct(atg,1),'do orçado no período',atg>=1?'ok':'warn')
   +'</div>';
  s+='<div class="kpis k3">'
   +kpi('Meta do ano',mi(M.metaAno),M.yms.length+' meses')
   +kpi('A realizar',mi(M.aRealizar),'em '+M.restantes+' meses')
   +kpi('Ritmo necessário',mi(mediaRest),'por mês · média realizada '+mi(mediaReal),mediaRest>mediaReal?'warn':'ok')
   +'</div>';
  s+=H3('Vendas realizadas vs. orçamento '+M.ano,'acumulado','perf-acum');
  s+=fig(areaCum(M.labels,[
    {name:'Acumulado Orçamento',values:M.metaAcum,color:GOOD},
    {name:'Vendas Realizadas Acum.',values:M.realAcum,color:SER[2],abaixo:true}],{w:980,h:360}),
    ins('metaRitmo',{metas:M}));
  s+=cap('Valores em R$ mil. A área verde é a meta acumulada do ano; a azul, o realizado acumulado, que se encerra em '+ymLab(M.fim)+' — último mês da base comercial.');
  s+=H3('Vendas realizadas vs. orçamento '+M.ano,'mês a mês · cenários no zoom','perf-mes');
  const proxMes=ymLab(M.yms[M.iUlt+1]||M.fim);
  s+='<div id="perf-cenarios">'+fig(comboMeta(M.labels,{
    bars:M.gap.map(v=>v==null?null:Math.max(0,v)),
    lines:[{name:'Vendas Previstas',values:M.meta,color:GOOD},
           {name:'Realizado | Meta sazonal',values:M.metaSaz,color:SER[5],dashFrom:M.iUlt},
           {name:'Projeção histórica',values:M.projHist,color:SER[2],dashFrom:M.iUlt,
            cls:'perf-projhist',oculta:true,semLabel:true},
           {name:'Ritmo CAGR'+(M.cagrV!=null?' ('+spct(M.cagrV)+' a.a.)':''),values:M.projCagr,color:'#8c6bb1',
            dashFrom:M.iUlt,cls:'perf-projcagr',oculta:true,semLabel:true}],
    barName:'GAP',w:980,h:430}),
    ins('projecaoDistancia',{metas:M}))+'</div>';
  s+=cap('Valores em R$ mil, todos na mesma escala. As barras cinza são o gap do mês contra a meta. '
    +'A linha âmbar é <b>sólida no realizado</b> e <b>tracejada na projeção</b>: de '+proxMes+' em diante ela mostra a '
    +'<b>meta sazonal</b> — o que falta para o orçamento, distribuído pelo <b>peso histórico de cada mês</b> ('+ANOS_SAZ[0]+'–'+(M.ano-1)+') '
    +'e não em partes iguais, porque o segundo semestre concentra e dezembro é pico baixo. '
    +'Ao ampliar o gráfico, dois cenários adicionais podem ser ligados: <b>projeção histórica</b> (para onde a empresa vai, '
    +'mantido o comportamento dos anos anteriores) e <b>ritmo CAGR</b> (onde estaria mantendo o próprio passo de crescimento).');
  s+=call('<b>Como ler os três cenários.</b> Projeção histórica: <b>'+mi(M.totProjHist)+'</b> no ano — é para onde a empresa vai, '
    +'aplicando ao realizado a fração do ano que o histórico já esperava ter acontecido ('+pct(M.frac,1)+' até '+ymLab(M.fim)+'). '
    +'Orçamento: <b>'+mi(M.metaAno)+'</b> — o esforço adicional é a distância entre as duas. '
    +(M.totProjCagr!=null?'Ritmo CAGR: <b>'+mi(M.totProjCagr)+'</b>, mantido o crescimento composto de '+spct(M.cagrV)+' ao ano desde '+ANOS_SAZ[0]+'. ':'')
    +'<b>Ressalva:</b> a curva histórica pressupõe um time em ritmo normal — vindo de performance ruim, um segundo semestre '
    +'historicamente forte não se confirma sozinho.','note');
  const linhas=M.yms.map((y,i)=>{
    const r=M.realizado[i], g=M.gap[i], fut=i>M.iUlt;
    return [ymLab(y),money(M.meta[i]),r==null?'—':money(r),
      g==null?'—':`<span style="color:${g>0?BAD:GOOD};font-weight:600">${money(-g)}</span>`,
      r==null?'—':pct(r/M.meta[i],1),
      fut?pct(M.peso[(y%100)-1],1):'—',
      fut?money(M.metaSaz[i]):'—',
      fut&&M.projHist[i]!=null?money(M.projHist[i]):'—'];});
  s+=table(['Mês','Meta','Realizado','Gap (real. − meta)','Atingimento','Peso histórico','Meta sazonal','Projeção histórica'],linhas,
    ['left','right','right','right','right','right','right','right'],
    ['Ano',money(M.metaAno),money(M.realAteAgora),
     `<span style="color:${M.gapAcum>0?BAD:GOOD};font-weight:600">${money(-M.gapAcum)}</span>`,
     pct(atg,1),'—',money(M.aRealizar),M.totProjHist!=null?money(M.totProjHist):'—'],
    ins('metaDispersao',{metas:M}));
  // ritmo médio é leitura de apoio; o compromisso mês a mês é a coluna "meta sazonal" da tabela
  const mesPico=M.idxRest.length?M.idxRest.reduce((a,b)=>M.peso[a]>=M.peso[b]?a:b):null;
  s+=call('Para fechar '+M.ano+' no orçado faltam <b>'+mi(M.aRealizar)+'</b> em '+M.restantes+' meses — média de <b>'
    +mi(mediaRest)+' por mês</b> contra <b>'+mi(mediaReal)+'</b> realizados nos '+(M.iUlt+1)+' primeiros. '
    +(mesPico!=null?'Distribuído pela sazonalidade, o mês mais exigido é <b>'+MES[mesPico]+'</b> ('+money(M.metaSaz[M.yms.findIndex(y=>(y%100)-1===mesPico)])+'), não todos por igual.':''),
    mediaRest>mediaReal?'warn':'ok');
  return s;
}
/* ================= ANÁLISE DE VENDAS · gestão comercial =================
   Seção nova, montada sobre a base comercial (DATA.rows). Três perguntas:

   1. O que a líder faz diferente — e quanto do time chegaria lá.
   2. Quem é a carteira de clientes, por RFV (recência, frequência, valor).
   3. Onde está o valor que já existe e não está sendo colhido: recompra,
      cliente parado, ticket abaixo do padrão da casa.

   Tudo recalculado da base a cada geração; nada congelado.
   ====================================================================== */

/* linhas que não são venda de mercado e sujariam qualquer leitura comercial */
const CLS_FORA=['CANCELADO','BONIFICACAO','PERMUTA','SHOWROOM','SHOW ROOM'];
/* Revenda e exportação são outro tipo de venda — não passam pelo mesmo funil,
   não têm o mesmo ticket nem a mesma recompra. Misturá-las na comparação entre
   vendedores compara coisas que não concorrem entre si. Padrões, e não nomes
   exatos, para pegar as variações de cadastro ("CARLA - REVENDA" e afins). */
const VEND_FORA=['TROCA','BONIFICACAO','EXPORTACAO','REVENDA','NAO INFORMADO','NÃO INFORMADO'];
function _linhaComercial(r){
  const cls=(DATA.cls[r[6]]||'').toUpperCase();
  if(CLS_FORA.some(c=>cls.indexOf(c)>=0)) return false;
  const vn=(DATA.vd[r[3]]||'').toUpperCase();
  if(VEND_FORA.some(p=>vn.indexOf(p)>=0)) return false;
  return r[1]>0;
}

/* ---------- retrato do time no recorte ---------- */
function comercialAgg(ymMin,ymMax){
  const V={};
  const gv=k=>V[k]||(V[k]={v:0,q:0,peds:new Set(),clis:new Set(),com:0,fam:{},meses:{}});
  for(const r of DATA.rows){
    if(r[0]<ymMin||r[0]>ymMax||!_linhaComercial(r)) continue;
    const o=gv(r[3]);
    o.v+=r[1]; o.q+=r[2];
    if(r[15]>=0) o.peds.add(r[15]);
    o.clis.add(r[5]);
    o.com+=r[9]+r[10]+r[11]+r[12];
    const fn=DATA.fam[r[4]]; o.fam[fn]=(o.fam[fn]||0)+r[1];
    o.meses[r[0]]=(o.meses[r[0]]||0)+r[1];
  }
  const vend=Object.keys(V).map(k=>{const o=V[k];
    const peds=o.peds.size, clis=o.clis.size;
    return {name:DATA.vd[k], idx:+k, v:o.v, q:o.q, peds, clis, com:o.com, fam:o.fam, meses:o.meses,
      ticket:peds?o.v/peds:0, titem:o.q?o.v/o.q:0,
      itensPed:peds?o.q/peds:0, pedCli:clis?peds/clis:0, vCli:clis?o.v/clis:0,
      custop:o.v?o.com/o.v:0};
  }).filter(x=>x.v>0).sort((a,b)=>b.v-a.v);
  const tot=vend.reduce((s,x)=>s+x.v,0);
  vend.forEach(x=>x.share=tot?x.v/tot:0);
  return {vend, total:tot};
}

/* ---------- RFV: recência, frequência e valor por cliente ----------
   A base guarda o mês da venda, não o dia — a recência é medida em meses, que
   é a granularidade certa para um ciclo de venda de móvel sob projeto. */
function rfvClientes(ymMax,meses){
  const ini=ymAddMonths(ymMax,-(meses-1));
  const C={};
  for(const r of DATA.rows){
    if(r[0]<ini||r[0]>ymMax||!_linhaComercial(r)) continue;
    const o=C[r[5]]||(C[r[5]]={v:0,peds:new Set(),ult:0,prim:999999,vend:{}});
    o.v+=r[1]; if(r[15]>=0) o.peds.add(r[15]);
    if(r[0]>o.ult) o.ult=r[0];
    if(r[0]<o.prim) o.prim=r[0];
    const vn=DATA.vd[r[3]]; o.vend[vn]=(o.vend[vn]||0)+r[1];
  }
  const difMeses=(a,b)=>(Math.floor(b/100)-Math.floor(a/100))*12+(b%100)-(a%100);
  const cli=Object.keys(C).map(k=>{const o=C[k];
    const dono=Object.keys(o.vend).sort((x,y)=>o.vend[y]-o.vend[x])[0];
    return {idx:+k, name:DATA.cl[k], v:o.v, f:o.peds.size,
      r:difMeses(o.ult,ymMax), vida:difMeses(o.prim,o.ult), dono};
  }).filter(x=>x.v>0);
  if(!cli.length) return null;
  /* score 1..5 por quintil de posição no ranking — robusto a valores extremos,
     que numa carteira de projeto são a regra e não a exceção */
  const quintil=(arr,campo,inverso)=>{
    const ord=[...arr].sort((a,b)=>inverso?a[campo]-b[campo]:b[campo]-a[campo]);
    const n=ord.length;
    ord.forEach((x,i)=>{ x['s'+campo]=5-Math.min(4,Math.floor(i/(n/5))); });
  };
  quintil(cli,'v'); quintil(cli,'f'); quintil(cli,'r',true);
  cli.forEach(x=>{
    const R=x.sr, F=x.sf, Vs=x.sv;
    x.seg = (R>=4&&F>=4&&Vs>=4) ? 'Campeões'
          : (R>=3&&F>=3)        ? 'Fiéis'
          : (R<=2&&Vs>=4)       ? 'Em risco'
          : (R<=2&&F>=3)        ? 'Hibernando'
          : (R>=4&&F<=2)        ? 'Novos / únicos'
          : (R<=2)              ? 'Perdidos'
          :                       'Ocasionais';
  });
  const ORDEM=['Campeões','Fiéis','Em risco','Novos / únicos','Ocasionais','Hibernando','Perdidos'];
  const segs={}; ORDEM.forEach(s=>segs[s]={n:0,v:0,f:0,r:0,rMin:999,rMax:0});
  cli.forEach(x=>{const s=segs[x.seg]; s.n++; s.v+=x.v; s.f+=x.f; s.r+=x.r;
    if(x.r<s.rMin) s.rMin=x.r; if(x.r>s.rMax) s.rMax=x.r;});
  /* rMin/rMax: o intervalo de recência dentro de cada segmento. A média sozinha
     não responde "pararam há quanto tempo" — quem pergunta isso quer a faixa. */
  const lista=ORDEM.filter(s=>segs[s].n).map(s=>({seg:s, n:segs[s].n, v:segs[s].v,
    f:segs[s].f/segs[s].n, r:segs[s].r/segs[s].n,
    rMin:segs[s].rMin===999?0:segs[s].rMin, rMax:segs[s].rMax}));
  return {cli, segs:lista, total:cli.reduce((s,x)=>s+x.v,0), meses, ini, fim:ymMax};
}

/* ---------- seção ---------- */
let avMeses=12;
/* o RFV da última renderização fica acessível ao clique do segmento —
   sem isso o drill teria de recalcular a segmentação inteira a cada clique */
let avRFV=null, avSegSel=null;
function buildVendasFilter(){
  const op=[[12,'Últimos 12 meses'],[6,'Últimos 6 meses'],[24,'Últimos 24 meses']];
  return '<div class="filterbar"><div class="fb-custom"><span class="fb-t">Janela:</span> '
    +'<select id="av-janela">'+op.map(o=>`<option value="${o[0]}"${o[0]===avMeses?' selected':''}>${o[1]}</option>`).join('')
    +'</select></div><div class="fb-lab" id="av-label"></div></div>';
}
function initAnaliseVendas(){
  const sel=document.getElementById('av-janela'); if(!sel) return;
  sel.addEventListener('change',e=>{ avMeses=+e.target.value; drawAnaliseVendas(); });
  drawAnaliseVendas();
}
function drawAnaliseVendas(){
  const box=document.getElementById('av-body'); if(!box) return;
  avSegSel=null;
  box.innerHTML=renderAnaliseVendas();
  const lb=document.getElementById('av-label');
  if(lb) lb.textContent=avMeses+' meses até '+ymLab(MAXYM_VENDAS);
  wireRFV();
  remount('vendas');
}
/* ---- drill do RFV: clicar num segmento abre os clientes dele ---- */
/* o gráfico de segmentos é a primeira figura DEPOIS do título do bloco av-rfv. Antes se pegava a
   primeira figura da seção inteira — a de "o que separa a líder" —, então o clique na barra do RFV
   nunca foi ligado. Procura pelo título em todo o documento porque a versão em atos move o bloco. */
function figRFV(){
  let el=document.querySelector('h3[data-blk="av-rfv"]');
  while(el&&(el=el.nextElementSibling)){ if(el.matches('h3[data-blk]')) return null; if(el.matches('.fig')) return el.querySelector('svg'); }
  return null;
}
function wireRFV(){
  const box=document.getElementById('av-body'); if(!box||!avRFV) return;
  box.querySelectorAll('.rfv-seg-row').forEach(tr=>{
    tr.style.cursor='pointer';
    tr.addEventListener('click',()=>drawRFVSegmento(tr.dataset.seg));
  });
  // a barra do gráfico abre o mesmo detalhe
  const fig=figRFV();
  if(fig) fig.querySelectorAll('rect[data-lab]').forEach(r=>{
    r.style.cursor='pointer';
    r.addEventListener('click',()=>drawRFVSegmento(r.dataset.lab));
  });
}
function drawRFVSegmento(seg){
  const det=document.getElementById('rfv-detalhe'); if(!det||!avRFV) return;
  if(avSegSel===seg){ avSegSel=null; det.innerHTML=''; marcaSeg(); return; }
  avSegSel=seg; marcaSeg();
  const lista=avRFV.cli.filter(x=>x.seg===seg).sort((a,b)=>b.v-a.v);
  if(!lista.length){ det.innerHTML=''; return; }
  const tot=lista.reduce((s2,x)=>s2+x.v,0);
  let acc=0;
  const linhas=lista.map(x=>{ acc+=x.v;
    return [esc(trunc(x.name,38)), money(x.v), nf(x.f),
      `<span style="color:${x.r>=6?BAD:(x.r>=3?WARN:GOOD)};font-weight:600">${nf(x.r)}</span>`,
      x.vida?nf(x.vida)+' meses':'—', esc(trunc(x.dono||'—',20)),
      pct(tot?acc/tot:0,1)];});
  det.innerHTML=H3('Clientes em “'+esc(seg)+'”', nf(lista.length)+' · '+mi(tot))
    +table(['Cliente','Valor no período','Pedidos','Meses sem comprar','Tempo de relação','Vendedor(a)','% acumulada'],
       linhas,['left','right','right','right','right','left','right'])
    +cap('“Meses sem comprar” é a recência; “tempo de relação” é a distância entre a primeira e a última compra '
      +'dentro da janela. Clique de novo no segmento para fechar.');
  det.scrollIntoView({behavior:'smooth',block:'nearest'});
}
function marcaSeg(){
  const box=document.getElementById('av-body'); if(!box) return;
  box.querySelectorAll('.rfv-seg-row').forEach(tr=>{
    tr.style.background=(tr.dataset.seg===avSegSel)?'rgba(146,112,93,.12)':'';
  });
  const fig=figRFV();
  if(fig) fig.querySelectorAll('rect[data-lab]').forEach(r=>{
    const on=r.dataset.lab===avSegSel;
    r.style.stroke=on?INK:''; r.style.strokeWidth=on?'2':'';
  });
}

function renderAnaliseVendas(){
  const fim=MAXYM_VENDAS, ini=ymAddMonths(fim,-(avMeses-1));
  const A=comercialAgg(ini,fim);
  if(!A.vend.length) return call('Sem venda comercial na janela selecionada.','warn');
  const lider=A.vend[0], demais=A.vend.slice(1);
  const totDemais=demais.reduce((s,x)=>s+x.v,0);
  const medDemais={
    v: demais.length?totDemais/demais.length:0,
    ticket: demais.reduce((s,x)=>s+x.peds,0)?totDemais/demais.reduce((s,x)=>s+x.peds,0):0,
    titem: demais.reduce((s,x)=>s+x.q,0)?totDemais/demais.reduce((s,x)=>s+x.q,0):0,
    itensPed: demais.reduce((s,x)=>s+x.peds,0)?demais.reduce((s,x)=>s+x.q,0)/demais.reduce((s,x)=>s+x.peds,0):0,
    pedCli: demais.reduce((s,x)=>s+x.clis,0)?demais.reduce((s,x)=>s+x.peds,0)/demais.reduce((s,x)=>s+x.clis,0):0,
    vCli: demais.reduce((s,x)=>s+x.clis,0)?totDemais/demais.reduce((s,x)=>s+x.clis,0):0,
    custop: totDemais?demais.reduce((s,x)=>s+x.com,0)/totDemais:0,
  };
  let s='';

  /* ---- 1. o time ---- */
  s+=H3('O time no período','janela de '+avMeses+' meses até '+ymLab(fim),'av-time');
  s+='<div class="kpis k4">'
   +kpi('Venda do time',mi(A.total),nf(A.vend.length)+' vendedores ativos')
   +kpi('Líder',esc(trunc(lider.name,20)),pct(lider.share,1)+' da venda','ok')
   +kpi('Ticket médio do time',money(A.total/A.vend.reduce((s2,x)=>s2+x.peds,0)),'por pedido')
   +kpi('Custo de comissão',pct(A.vend.reduce((s2,x)=>s2+x.com,0)/A.total,1),'sobre a venda')
   +'</div>';

  /* ---- 2. o retrato da líder ---- */
  s+=H3('Retrato de '+esc(lider.name),'o que a distingue do resto do time','av-lider');
  const linha=(rot,vl,vd,fmt,melhorMaior)=>{
    const r=vd?vl/vd-1:0;
    const bom=melhorMaior===false?r<0:r>0;
    return [rot,fmt(vl),fmt(vd),
      `<span style="color:${bom?GOOD:BAD};font-weight:600">${spct(r,0)}</span>`];
  };
  s+=table(['Indicador',esc(trunc(lider.name,22)),'Média dos demais','Diferença'],[
    linha('Venda no período',lider.v,medDemais.v,v=>mi(v)),
    linha('Valor médio do pedido',lider.ticket,medDemais.ticket,v=>money(v)),
    linha('Preço por peça',lider.titem,medDemais.titem,v=>money(v)),
    linha('Peças por pedido',lider.itensPed,medDemais.itensPed,v=>nf(v,1)),
    linha('Pedidos por cliente',lider.pedCli,medDemais.pedCli,v=>nf(v,2)),
    linha('Venda por cliente',lider.vCli,medDemais.vCli,v=>money(v)),
    linha('Custo de comissão',lider.custop,medDemais.custop,v=>pct(v,1),false),
  ],['left','right','right','right'],null,
    ins('lider',{lider,demais,medDemais,total:A.total}));

  /* ---- 3. de onde vem a diferença ---- */
  /* decomposição: a venda de cada um é clientes × pedidos por cliente × ticket.
     Comparar só o total esconde qual dos três fatores explica a distância. */
  s+=H3('De onde vem a diferença','clientes × pedidos por cliente × ticket','av-diferenca');
  const fatores=[
    {nome:'Clientes atendidos',l:lider.clis,d:demais.length?demais.reduce((s2,x)=>s2+x.clis,0)/demais.length:0,f:v=>nf(v,0)},
    {nome:'Pedidos por cliente',l:lider.pedCli,d:medDemais.pedCli,f:v=>nf(v,2)},
    {nome:'Valor médio do pedido',l:lider.ticket,d:medDemais.ticket,f:v=>money(v)},
  ];
  s+=fig(hbar(fatores.map(x=>[x.nome,x.d?x.l/x.d-1:0]),
    {valfmt:v=>spct(v,0),padLeft:200,w:760,color:SER[0]}),
    ins('fatoresLider',{fatores,lider,medDemais}));
  s+=cap('Quanto a líder está acima (ou abaixo) da média dos outros vendedores em cada um dos três fatores. '
    +'A venda de qualquer pessoa do time nasce da multiplicação deles: atender mais clientes, '
    +'fazer cada cliente comprar mais vezes, ou vender pedidos maiores.');

  /* ---- 4. o mix ---- */
  s+=H3('O que cada um vende','participação de cada categoria na venda de cada vendedor','av-mix');
  const topV=A.vend.slice(0,7).map(x=>x.name);
  const famTot={}; A.vend.forEach(x=>Object.keys(x.fam).forEach(f=>famTot[f]=(famTot[f]||0)+x.fam[f]));
  const topF=Object.keys(famTot).filter(f=>f!=='Frete/Serviço')
    .sort((a,b)=>famTot[b]-famTot[a]).slice(0,8);
  const md={}; topV.forEach(vn=>{ md[vn]={};
    const o=A.vend.find(x=>x.name===vn);
    topF.forEach(fn=>md[vn][fn]=(o&&o.fam[fn])||0); });
  s+=fig(heatmap(topV,topF,md,{valfmt:v=>v>1000?nf(v/1000,0):'',padLeft:170,w:900}),
    ins('mixCruzado',{linhas:topV,colunas:topF,mat:md,escopo:'vendedor(a)',id:'vendas-mix'}));
  s+=cap('Valores em R$ mil. Duas pessoas com a mesma venda podem ter chegado lá por categorias '
    +'completamente diferentes — e o caminho de uma nem sempre é replicável pela outra.');

  /* ---- 5. quanto vale fechar a distância ---- */
  s+=H3('O que está em jogo','simulações sobre a base do período, sem premissa nova','av-jogo');
  const cen=[];
  demais.forEach(x=>{
    const porTicket=x.peds*lider.ticket-x.v;
    const porFreq=(x.clis*lider.pedCli*x.ticket)-x.v;
    cen.push({name:x.name, v:x.v, porTicket:Math.max(0,porTicket), porFreq:Math.max(0,porFreq)});
  });
  const ganhoTicket=cen.reduce((s2,x)=>s2+x.porTicket,0);
  const ganhoFreq=cen.reduce((s2,x)=>s2+x.porFreq,0);
  s+='<div class="kpis k3">'
   +kpi('Se todos tivessem o ticket da líder',mi(ganhoTicket),'a mais no período','ok')
   +kpi('Se todos tivessem a recompra da líder',mi(ganhoFreq),'a mais no período','ok')
   +kpi('Venda atual dos demais',mi(totDemais),nf(demais.length)+' vendedores')
   +'</div>';
  s+=table(['Vendedor(a)','Venda no período','Valor médio hoje','No valor médio da líder','Diferença'],
    cen.sort((a,b)=>b.porTicket-a.porTicket).map(x=>{
      const o=A.vend.find(y=>y.name===x.name);
      return [esc(x.name),money(x.v),money(o.ticket),money(o.peds*lider.ticket),
        `<span style="color:${x.porTicket>0?GOOD:MUT};font-weight:600">${x.porTicket>0?'+'+money(x.porTicket):'—'}</span>`];
    }),['left','right','right','right','right'],null,
    ins('potencialTicket',{cen,lider,ganhoTicket,totDemais}));
  s+=cap('A coluna “No valor médio da líder” mantém a mesma quantidade de pedidos de cada pessoa e só '
    +'troca o valor médio de cada pedido pelo de '+esc(trunc(lider.name,20))+'. Não é meta: é uma forma de '
    +'medir quanto da distância do time vem apenas do tamanho dos pedidos.');

  /* ---- 6. RFV ---- */
  const RF=rfvClientes(fim,Math.max(avMeses,12));
  avRFV=RF;
  if(RF){
    s+=H3('Carteira de clientes · RFV','recência, frequência e valor — '+RF.meses+' meses até '+ymLab(fim),'av-rfv');
    s+=call('<b>Como ler:</b> cada cliente recebe uma nota de 1 a 5 em recência (há quanto tempo comprou), '
      +'frequência (quantos pedidos fez) e valor (quanto somou). Os segmentos abaixo saem da combinação das três. '
      +'A base registra o mês da venda, não o dia, então a recência é contada em meses.');
    const segCores={'Campeões':GOOD,'Fiéis':SER[0],'Em risco':BAD,'Novos / únicos':SER[2],
      'Ocasionais':BASE,'Hibernando':WARN,'Perdidos':MUT};
    s+=fig(hbar(RF.segs.map(x=>[x.seg,x.v]),
      {valfmt:v=>mi(v,1),padLeft:170,w:820,color:SER[0]}),
      ins('rfvSegmentos',{segs:RF.segs,total:RF.total,cli:RF.cli}));
    /* montada à mão (e não pelo table()) para as linhas carregarem o segmento
       e virarem alvo de clique */
    const alinha=['left','right','right','right','right','right','right'];
    const cab=['Segmento','Clientes','% dos clientes','Valor','% do valor','Pedidos/cliente','Meses sem comprar'];
    s+='<div class="tw"><table class="dt"><thead><tr>'
      +cab.map((h,i)=>`<th class="${alinha[i]}">${h}</th>`).join('')+'</tr></thead><tbody>'
      +RF.segs.map(x=>`<tr class="rfv-seg-row" data-seg="${esc(x.seg)}">`
        +`<td class="left"><span style="color:${segCores[x.seg]||INK};font-weight:600">${esc(x.seg)}</span></td>`
        +`<td class="right">${nf(x.n)}</td><td class="right">${pct(x.n/RF.cli.length,1)}</td>`
        +`<td class="right">${money(x.v)}</td><td class="right">${pct(x.v/RF.total,1)}</td>`
        +`<td class="right">${nf(x.f,2)}</td><td class="right">${nf(x.r,1)}</td></tr>`).join('')
      +'</tbody><tfoot><tr><td class="left">Total</td>'
      +`<td class="right">${nf(RF.cli.length)}</td><td class="right">100,0%</td>`
      +`<td class="right">${money(RF.total)}</td><td class="right">100,0%</td>`
      +`<td class="right">${nf(RF.cli.reduce((s2,x)=>s2+x.f,0)/RF.cli.length,2)}</td>`
      +`<td class="right">${nf(RF.cli.reduce((s2,x)=>s2+x.r,0)/RF.cli.length,1)}</td></tr></tfoot></table></div>`;
    s+=cap('Clique num segmento para ver os clientes que estão nele.');
    s+='<div class="tw-ins">'+(window.INSRT?INSRT.strip(
        ins('rfvTabela',{segs:RF.segs,cli:RF.cli,total:RF.total})):'')+'</div>';
    s+='<div id="rfv-detalhe"></div>';

    /* clientes de maior valor parados */
    const risco=RF.cli.filter(x=>x.seg==='Em risco'||x.seg==='Hibernando')
      .sort((a,b)=>b.v-a.v).slice(0,15);
    if(risco.length){
      s+=H3('Clientes de valor que pararam de comprar','maior valor entre os que estão há mais tempo sem pedido','av-parados');
      s+=table(['Cliente','Valor no período','Pedidos','Meses sem comprar','Vendedor(a)'],
        risco.map(x=>[esc(trunc(x.name,34)),money(x.v),nf(x.f),
          `<span style="color:${x.r>=6?BAD:WARN};font-weight:600">${nf(x.r)}</span>`,
          esc(trunc(x.dono||'—',20))]),
        ['left','right','right','right','left'],null,
        ins('rfvRisco',{risco,total:RF.total,cli:RF.cli}));
      s+=cap('Ordenado por valor, não por tempo parado: o cliente que mais vale entre os que sumiram '
        +'é onde a conversa de retomada rende mais.');
    }

    /* RFV por vendedor */
    s+=H3('Qualidade da carteira por vendedor(a)','quantos clientes de cada segmento cada um carrega','av-qualidade');
    const donos=[...new Set(RF.cli.map(x=>x.dono).filter(Boolean))]
      .map(d=>{const meus=RF.cli.filter(x=>x.dono===d);
        const camp=meus.filter(x=>x.seg==='Campeões'||x.seg==='Fiéis');
        const perd=meus.filter(x=>x.seg==='Em risco'||x.seg==='Hibernando'||x.seg==='Perdidos');
        return {d, n:meus.length, v:meus.reduce((s2,x)=>s2+x.v,0),
          camp:camp.length, vcamp:camp.reduce((s2,x)=>s2+x.v,0),
          perd:perd.length, vperd:perd.reduce((s2,x)=>s2+x.v,0),
          rec:meus.reduce((s2,x)=>s2+x.f,0)/meus.length};
      }).filter(x=>x.n>=3).sort((a,b)=>b.v-a.v);
    s+=table(['Vendedor(a)','Clientes','Valor','Campeões + Fiéis','% do valor dele','Em risco / parados','Pedidos por cliente'],
      donos.map(x=>[esc(trunc(x.d,22)),nf(x.n),money(x.v),
        nf(x.camp),pct(x.v?x.vcamp/x.v:0,0),
        `<span style="color:${x.perd/x.n>.3?BAD:MUT}">${nf(x.perd)}</span>`,nf(x.rec,2)]),
      ['left','right','right','right','right','right','right'],null,
      ins('rfvPorVendedor',{donos}));
    s+=cap('Um vendedor pode ter a mesma venda que outro com uma carteira muito diferente por baixo: '
      +'muitos clientes de uma compra só, ou poucos clientes que voltam sempre.');
  }
  return s;
}

/* ================= VENDEDOR × ARQUITETO · o canal de venda =================
   Na maior parte dos projetos quem especifica e traz o cliente é o arquiteto.
   Isso faz do par vendedor × arquiteto o canal real da venda — e nenhuma das
   outras seções olha para ele.

   Uma linha de venda pode ter até quatro arquitetos. O valor é rateado entre
   eles (mesma convenção do resto do relatório), e a RT é a que cada um recebeu.
   ========================================================================= */
let arqMeses=12;

function arqAgg(ymMin,ymMax){
  const ARQ={}, VEND={}, MAT={};
  const gA=k=>ARQ[k]||(ARQ[k]={v:0,rt:0,peds:new Set(),vend:{},clis:new Set(),ult:0,prim:999999});
  const gV=k=>VEND[k]||(VEND[k]={v:0,vArq:0,pedsT:new Set(),pedsA:new Set(),arqs:{},rt:0,qA:0,qT:0});
  for(const r of DATA.rows){
    if(r[0]<ymMin||r[0]>ymMax||!_linhaComercial(r)) continue;
    const vn=DATA.vd[r[3]], V=gV(vn);
    V.v+=r[1]; V.qT+=r[2]; if(r[15]>=0) V.pedsT.add(r[15]);
    const lista=r[16]||[];
    if(!lista.length) continue;
    const cota=r[1]/lista.length;
    V.vArq+=r[1]; V.qA+=r[2]; if(r[15]>=0) V.pedsA.add(r[15]);
    for(const [ai,rt] of lista){
      const an=DATA.arq[ai], A=gA(an);
      A.v+=cota; A.rt+=rt; A.clis.add(r[5]);
      if(r[15]>=0) A.peds.add(r[15]);
      A.vend[vn]=(A.vend[vn]||0)+cota;
      if(r[0]>A.ult) A.ult=r[0];
      if(r[0]<A.prim) A.prim=r[0];
      V.arqs[an]=(V.arqs[an]||0)+cota; V.rt+=rt;
      (MAT[vn]||(MAT[vn]={}))[an]=(MAT[vn][an]||0)+cota;
    }
  }
  const difMeses=(a,b)=>(Math.floor(b/100)-Math.floor(a/100))*12+(b%100)-(a%100);
  const arqs=Object.keys(ARQ).map(k=>{const o=ARQ[k];
    const donos=Object.keys(o.vend).sort((a,b)=>o.vend[b]-o.vend[a]);
    const shDono=o.v?o.vend[donos[0]]/o.v:0;
    return {name:k, v:o.v, rt:o.rt, peds:o.peds.size, clis:o.clis.size,
      nVend:donos.length, dono:donos[0], shDono, exclusivo:donos.length===1,
      taxa:o.v?o.rt/o.v:0, ticket:o.peds.size?o.v/o.peds.size:0,
      r:difMeses(o.ult,ymMax), vida:difMeses(o.prim,o.ult)};
  }).filter(x=>x.v>0).sort((a,b)=>b.v-a.v);
  const vend=Object.keys(VEND).map(k=>{const o=VEND[k];
    const arqOrd=Object.keys(o.arqs).map(a=>({a,v:o.arqs[a]})).sort((x,y)=>y.v-x.v);
    const vals=arqOrd.map(x=>x.v);
    return {name:k, v:o.v, vArq:o.vArq, vSem:o.v-o.vArq,
      share:o.v?o.vArq/o.v:0, nArq:arqOrd.length,
      k50:quantosParaLocal(vals,.5), topArq:arqOrd[0]?arqOrd[0].a:null,
      shTop:o.vArq&&arqOrd[0]?arqOrd[0].v/o.vArq:0,
      pedsT:o.pedsT.size, pedsA:o.pedsA.size,
      ticketA:o.pedsA.size?o.vArq/o.pedsA.size:0,
      ticketS:(o.pedsT.size-o.pedsA.size)?(o.v-o.vArq)/(o.pedsT.size-o.pedsA.size):0,
      rt:o.rt, taxa:o.vArq?o.rt/o.vArq:0};
  }).filter(x=>x.v>0).sort((a,b)=>b.v-a.v);
  const totV=vend.reduce((s,x)=>s+x.v,0), totA=vend.reduce((s,x)=>s+x.vArq,0);
  return {arqs, vend, mat:MAT, totV, totA, share:totV?totA/totV:0};
}
function quantosParaLocal(vals,fatia){
  const tot=vals.reduce((a,b)=>a+b,0); if(!tot) return 0;
  let acc=0,k=0; for(const v of vals){ acc+=v; k++; if(acc>=tot*fatia) break; }
  return k;
}

function buildArqFilter(){
  const op=[[12,'Últimos 12 meses'],[6,'Últimos 6 meses'],[24,'Últimos 24 meses']];
  return '<div class="filterbar"><div class="fb-custom"><span class="fb-t">Janela:</span> '
    +'<select id="aq-janela">'+op.map(o=>`<option value="${o[0]}"${o[0]===arqMeses?' selected':''}>${o[1]}</option>`).join('')
    +'</select></div><div class="fb-lab" id="aq-label"></div></div>';
}
function initArquitetos(){
  const sel=document.getElementById('aq-janela'); if(!sel) return;
  sel.addEventListener('change',e=>{ arqMeses=+e.target.value; drawArquitetos(); });
  drawArquitetos();
}
let aqSel=null, aqA=null;
function drawArquitetos(){
  const box=document.getElementById('aq-body'); if(!box) return;
  aqSel=null;
  box.innerHTML=renderArquitetos();
  const lb=document.getElementById('aq-label');
  if(lb) lb.textContent=arqMeses+' meses até '+ymLab(MAXYM_VENDAS);
  wireArq(); wireRfvArq();
  remount('arquitetos');
}
function wireArq(){
  const box=document.getElementById('aq-body'); if(!box||!aqA) return;
  box.querySelectorAll('.aq-vend-row').forEach(tr=>{ tr.style.cursor='pointer';
    tr.addEventListener('click',()=>drawArqDetalhe(tr.dataset.v)); });
}
function drawArqDetalhe(vn){
  const det=document.getElementById('aq-detalhe'); if(!det||!aqA) return;
  if(aqSel===vn){ aqSel=null; det.innerHTML=''; marcaArq(); return; }
  aqSel=vn; marcaArq();
  const m=aqA.mat[vn]||{};
  const lista=Object.keys(m).map(a=>{const o=aqA.arqs.find(x=>x.name===a);
    return {a, v:m[a], exclusivo:o&&o.exclusivo, nVend:o?o.nVend:1, taxa:o?o.taxa:0, r:o?o.r:null};
  }).sort((x,y)=>y.v-x.v);
  if(!lista.length){ det.innerHTML=call('Sem venda com arquiteto para '+esc(vn)+' na janela.','warn'); return; }
  const tot=lista.reduce((s,x)=>s+x.v,0); let acc=0;
  det.innerHTML=H3('Arquitetos de '+esc(vn), nf(lista.length)+' · '+mi(tot))
    +table(['Arquiteto / escritório','Venda atribuída','% do vendedor','% acumulada','Exclusivo?','RT efetiva','Meses sem trazer'],
      lista.map(x=>{ acc+=x.v;
        return [esc(trunc(x.a,34)), money(x.v), pct(tot?x.v/tot:0,1), pct(tot?acc/tot:0,1),
          x.exclusivo?'<span style="color:'+WARN+'">só com '+esc(trunc(vn,14))+'</span>'
                     :'<span class="mut">com '+nf(x.nVend)+' vendedores</span>',
          pct(x.taxa,1),
          x.r==null?'—':`<span style="color:${x.r>=6?BAD:(x.r>=3?WARN:GOOD)};font-weight:600">${nf(x.r)}</span>`];}),
      ['left','right','right','right','left','right','right'])
    +cap('“Exclusivo” marca o arquiteto que só trouxe negócio para este vendedor na janela — a relação é '
      +'pessoal, e some junto com ele. Clique de novo na linha para fechar.');
  det.scrollIntoView({behavior:'smooth',block:'nearest'});
}
function marcaArq(){
  const box=document.getElementById('aq-body'); if(!box) return;
  box.querySelectorAll('.aq-vend-row').forEach(tr=>{
    tr.style.background=(tr.dataset.v===aqSel)?'rgba(146,112,93,.12)':''; });
}

/* ---------- RFV genérico ----------
   A mesma segmentação usada nos clientes, aplicada a qualquer lista que traga
   valor, frequência e recência. Score 1..5 por quintil de POSIÇÃO no ranking
   (e não por faixa de valor), que é o que aguenta as caudas longas típicas de
   venda sob projeto. */
function segmentaRFV(itens){
  const L=itens.filter(x=>x.v>0);
  if(L.length<5) return null;
  const quintil=(campo,alvo,inverso)=>{
    const ord=[...L].sort((a,b)=>inverso?a[campo]-b[campo]:b[campo]-a[campo]);
    const n=ord.length;
    ord.forEach((x,i)=>{ x[alvo]=5-Math.min(4,Math.floor(i/(n/5))); });
  };
  quintil('v','sv'); quintil('f','sf'); quintil('r','sr',true);
  L.forEach(x=>{
    const R=x.sr, F=x.sf, V=x.sv;
    x.seg = (R>=4&&F>=4&&V>=4) ? 'Campeões'
          : (R>=3&&F>=3)       ? 'Fiéis'
          : (R<=2&&V>=4)       ? 'Em risco'
          : (R<=2&&F>=3)       ? 'Hibernando'
          : (R>=4&&F<=2)       ? 'Novos / únicos'
          : (R<=2)             ? 'Perdidos'
          :                      'Ocasionais';
  });
  const ORDEM=['Campeões','Fiéis','Em risco','Novos / únicos','Ocasionais','Hibernando','Perdidos'];
  const agg={}; ORDEM.forEach(s=>agg[s]={n:0,v:0,f:0,r:0,rMin:999,rMax:0});
  L.forEach(x=>{const a=agg[x.seg]; a.n++; a.v+=x.v; a.f+=x.f; a.r+=x.r;
    if(x.r<a.rMin) a.rMin=x.r; if(x.r>a.rMax) a.rMax=x.r;});
  const segs=ORDEM.filter(s=>agg[s].n).map(s=>({seg:s, n:agg[s].n, v:agg[s].v,
    f:agg[s].f/agg[s].n, r:agg[s].r/agg[s].n,
    rMin:agg[s].rMin===999?0:agg[s].rMin, rMax:agg[s].rMax}));
  return {itens:L, segs, total:L.reduce((s,x)=>s+x.v,0)};
}

/* ---------- bloco RFV de arquitetos, dentro da seção do canal ---------- */
let aqSegSel=null, aqRFV=null;
function blocoRfvArquitetos(A){
  const R=segmentaRFV(A.arqs.map(x=>({...x, f:x.peds})));
  if(!R) return '';
  aqRFV=R;
  const segCores={'Campeões':GOOD,'Fiéis':SER[0],'Em risco':BAD,'Novos / únicos':SER[2],
    'Ocasionais':BASE,'Hibernando':WARN,'Perdidos':MUT};
  let s='';
  s+=H3('Carteira de arquitetos · RFV','o mesmo corte da carteira de clientes, aplicado ao canal','aq-rfv');
  s+=call('Cada arquiteto recebe nota de 1 a 5 em <b>recência</b> (há quantos meses trouxe o último pedido), '
    +'<b>frequência</b> (quantos pedidos trouxe) e <b>valor</b> (quanto somou). Os segmentos saem da combinação '
    +'das três — e valem para o canal como valem para o cliente final: um arquiteto que parou de especificar '
    +'não avisa, só some da lista.');
  s+=fig(hbar(R.segs.map(x=>[x.seg,x.v]),{valfmt:v=>mi(v,1),padLeft:170,w:820,color:SER[6]}),
    ins('rfvArqSegmentos',{segs:R.segs,total:R.total,itens:R.itens,arqs:A.arqs}));

  const al=['left','right','right','right','right','right','right'];
  const cb=['Segmento','Arquitetos','% do canal (nº)','Venda atribuída','% do valor','Pedidos/arquiteto','Meses sem trazer'];
  s+='<div class="tw"><table class="dt"><thead><tr>'
    +cb.map((h,i)=>`<th class="${al[i]}">${h}</th>`).join('')+'</tr></thead><tbody>'
    +R.segs.map(x=>`<tr class="aqrfv-row" data-seg="${esc(x.seg)}">`
      +`<td class="left"><span style="color:${segCores[x.seg]||INK};font-weight:600">${esc(x.seg)}</span></td>`
      +`<td class="right">${nf(x.n)}</td><td class="right">${pct(x.n/R.itens.length,1)}</td>`
      +`<td class="right">${money(x.v)}</td><td class="right">${pct(x.v/R.total,1)}</td>`
      +`<td class="right">${nf(x.f,2)}</td><td class="right">${nf(x.r,1)}</td></tr>`).join('')
    +'</tbody><tfoot><tr><td class="left">Total</td>'
    +`<td class="right">${nf(R.itens.length)}</td><td class="right">100,0%</td>`
    +`<td class="right">${money(R.total)}</td><td class="right">100,0%</td>`
    +`<td class="right">${nf(R.itens.reduce((s2,x)=>s2+x.f,0)/R.itens.length,2)}</td>`
    +`<td class="right">${nf(R.itens.reduce((s2,x)=>s2+x.r,0)/R.itens.length,1)}</td></tr></tfoot></table></div>`;
  s+=cap('Clique num segmento para ver os arquitetos que estão nele, com o vendedor responsável.');
  s+='<div class="tw-ins">'+(window.INSRT?INSRT.strip(
      ins('rfvArqTabela',{segs:R.segs,itens:R.itens,total:R.total})):'')+'</div>';
  s+='<div id="aqrfv-detalhe"></div>';

  /* ---- o cruzamento: como cada vendedor se sai com a carteira que tem ---- */
  s+=H3('Performance do vendedor com o arquiteto','de que qualidade é a carteira de canal de cada um','aq-perf');
  const SEG_BONS=['Campeões','Fiéis'], SEG_RUINS=['Em risco','Hibernando','Perdidos'];
  const porVend={};
  R.itens.forEach(x=>{ const d=x.dono; if(!d) return;
    const o=porVend[d]||(porVend[d]={n:0,v:0,bons:0,vBons:0,ruins:0,vRuins:0,peds:0,r:0});
    o.n++; o.v+=x.v; o.peds+=x.f; o.r+=x.r;
    if(SEG_BONS.includes(x.seg)){ o.bons++; o.vBons+=x.v; }
    if(SEG_RUINS.includes(x.seg)){ o.ruins++; o.vRuins+=x.v; }
  });
  const linhas=Object.keys(porVend).map(d=>{const o=porVend[d];
    return {d, n:o.n, v:o.v, bons:o.bons, vBons:o.vBons, ruins:o.ruins, vRuins:o.vRuins,
      shBons:o.v?o.vBons/o.v:0, shRuins:o.v?o.vRuins/o.v:0,
      pedArq:o.n?o.peds/o.n:0, rMed:o.n?o.r/o.n:0,
      ticket:o.peds?o.v/o.peds:0};
  }).filter(x=>x.n>=2).sort((a,b)=>b.v-a.v);
  if(linhas.length){
    s+=fig(stackedCols(linhas.map(x=>trunc(x.d,14)),[
        {name:'Campeões e fiéis',values:linhas.map(x=>x.vBons),color:GOOD},
        {name:'Ocasionais / novos',values:linhas.map(x=>x.v-x.vBons-x.vRuins),color:BASE},
        {name:'Em risco / parados',values:linhas.map(x=>x.vRuins),color:BAD},
      ],{valfmt:v=>mi(v,1),w:960,subLabels:linhas.map(x=>pct(x.shBons,0)),subTitle:'% em fiéis'}),
      ins('rfvArqPorVendedor',{linhas,total:R.total}));
    s+=table(['Vendedor(a)','Arquitetos','Venda pelo canal','Campeões + fiéis','% do valor dele',
              'Em risco / parados','% do valor','Pedidos por arquiteto','Ticket'],
      linhas.map(x=>[esc(trunc(x.d,22)),nf(x.n),money(x.v),
        nf(x.bons),`<span style="color:${GOOD};font-weight:600">${pct(x.shBons,0)}</span>`,
        nf(x.ruins),`<span style="color:${x.shRuins>.4?BAD:MUT};font-weight:600">${pct(x.shRuins,0)}</span>`,
        nf(x.pedArq,2),money(x.ticket)]),
      ['left','right','right','right','right','right','right','right','right'],null,
      ins('rfvArqQualidade',{linhas}));
    s+=cap('A mesma carteira de arquitetos pode render de formas muito diferentes: o que separa não é '
      +'quantos arquitetos alguém tem, e sim quantos deles continuam trazendo pedido.');
  }
  return s;
}
function wireRfvArq(){
  const box=document.getElementById('aq-body'); if(!box||!aqRFV) return;
  box.querySelectorAll('.aqrfv-row').forEach(tr=>{ tr.style.cursor='pointer';
    tr.addEventListener('click',()=>drawAqRfvSeg(tr.dataset.seg)); });
}
function drawAqRfvSeg(seg){
  const det=document.getElementById('aqrfv-detalhe'); if(!det||!aqRFV) return;
  if(aqSegSel===seg){ aqSegSel=null; det.innerHTML=''; marcaAqSeg(); return; }
  aqSegSel=seg; marcaAqSeg();
  const lista=aqRFV.itens.filter(x=>x.seg===seg).sort((a,b)=>b.v-a.v);
  if(!lista.length){ det.innerHTML=''; return; }
  const tot=lista.reduce((s2,x)=>s2+x.v,0); let acc=0;
  det.innerHTML=H3('Arquitetos em “'+esc(seg)+'”', nf(lista.length)+' · '+mi(tot))
    +table(['Arquiteto / escritório','Venda atribuída','Pedidos','Meses sem trazer','RT efetiva',
            'Vendedor principal','Exclusivo?','% acumulada'],
      lista.map(x=>{ acc+=x.v;
        return [esc(trunc(x.name,32)),money(x.v),nf(x.f),
          `<span style="color:${x.r>=6?BAD:(x.r>=3?WARN:GOOD)};font-weight:600">${nf(x.r)}</span>`,
          pct(x.taxa,1), esc(trunc(x.dono||'—',20)),
          x.exclusivo?'<span style="color:'+WARN+'">sim</span>':'<span class="mut">não</span>',
          pct(tot?acc/tot:0,1)];}),
      ['left','right','right','right','right','left','left','right'])
    +cap('Clique de novo no segmento para fechar.');
  det.scrollIntoView({behavior:'smooth',block:'nearest'});
}
function marcaAqSeg(){
  const box=document.getElementById('aq-body'); if(!box) return;
  box.querySelectorAll('.aqrfv-row').forEach(tr=>{
    tr.style.background=(tr.dataset.seg===aqSegSel)?'rgba(146,112,93,.12)':''; });
}

function renderArquitetos(){
  const fim=MAXYM_VENDAS, ini=ymAddMonths(fim,-(arqMeses-1));
  const A=arqAgg(ini,fim); aqA=A;
  if(!A.arqs.length) return call('Sem venda com arquiteto na janela selecionada.','warn');
  let s='';

  /* ---- 1. o peso do canal ---- */
  const exclusivos=A.arqs.filter(x=>x.exclusivo);
  s+=H3('O peso do canal','janela de '+arqMeses+' meses até '+ymLab(fim),'aq-peso');
  s+='<div class="kpis k4">'
   +kpi('Venda com arquiteto',mi(A.totA),pct(A.share,1)+' de toda a venda')
   +kpi('Arquitetos ativos',nf(A.arqs.length),'com ao menos um pedido')
   +kpi('RT paga',mi(A.arqs.reduce((s2,x)=>s2+x.rt,0)),
        pct(A.totA?A.arqs.reduce((s2,x)=>s2+x.rt,0)/A.totA:0,1)+' da venda com arquiteto')
   +kpi('Exclusivos de um vendedor',pct(A.arqs.length?exclusivos.length/A.arqs.length:0,0),
        nf(exclusivos.length)+' de '+nf(A.arqs.length),'warn')
   +'</div>';

  /* ---- 2. quem vende por arquiteto e quem vende direto ---- */
  s+=H3('Quanto cada vendedor depende do canal','venda com arquiteto × venda direta','aq-dependencia');
  s+=fig(stackedCols(A.vend.map(x=>trunc(x.name,14)),[
      {name:'Com arquiteto',values:A.vend.map(x=>x.vArq),color:SER[0]},
      {name:'Venda direta',values:A.vend.map(x=>x.vSem),color:BASE},
    ],{valfmt:v=>mi(v,1),w:960,subLabels:A.vend.map(x=>pct(x.share,0)),subTitle:'% via arquiteto'}),
    ins('arqCanal',{vend:A.vend,share:A.share,totA:A.totA,totV:A.totV}));
  s+=cap('A linha de baixo é a fatia da venda de cada um que passou por um arquiteto. '
    +'Dois vendedores com a mesma venda podem estar em negócios completamente diferentes.');

  /* ---- 3. dependência: de quantos arquitetos cada um vive ---- */
  s+=H3('De quantos arquitetos cada vendedor vive','clique numa linha para ver a carteira dele','aq-quantos');
  const alinha=['left','right','right','right','right','right','right','right'];
  const cab=['Vendedor(a)','Venda total','% via arquiteto','Arquitetos','Bastam p/ 50%','Maior arquiteto',
             'Ticket c/ arq.','Ticket direto'];
  s+='<div class="tw"><table class="dt"><thead><tr>'
    +cab.map((h,i)=>`<th class="${alinha[i]}">${h}</th>`).join('')+'</tr></thead><tbody>'
    +A.vend.map(x=>`<tr class="aq-vend-row" data-v="${esc(x.name)}">`
      +`<td class="left">${esc(trunc(x.name,24))}</td>`
      +`<td class="right">${money(x.v)}</td>`
      +`<td class="right">${pct(x.share,0)}</td>`
      +`<td class="right">${nf(x.nArq)}</td>`
      +`<td class="right"><b>${x.nArq?nf(x.k50):'—'}</b></td>`
      +`<td class="right">${x.nArq?pct(x.shTop,0):'—'}</td>`
      +`<td class="right">${x.pedsA?money(x.ticketA):'—'}</td>`
      +`<td class="right">${(x.pedsT-x.pedsA)>0?money(x.ticketS):'—'}</td></tr>`).join('')
    +'</tbody></table></div>';
  s+=cap('<b>Bastam p/ 50%</b>: quantos arquitetos, somados do maior para o menor, já chegam à metade da '
    +'venda que aquele vendedor faz pelo canal. Se o número é <b>2</b>, dois arquitetos respondem por metade '
    +'de tudo — e a coluna ao lado mostra quantos existem no total. Quanto mais distantes esses dois números, '
    +'mais distribuída a agenda; quanto mais próximos, mais ela depende de poucas relações.');
  s+='<div class="tw-ins">'+(window.INSRT?INSRT.strip(
      ins('arqDependencia',{vend:A.vend,arqs:A.arqs})):'')+'</div>';
  s+='<div id="aq-detalhe"></div>';

  /* ---- 4. a matriz ---- */
  const topV=A.vend.filter(x=>x.vArq>0).slice(0,7).map(x=>x.name);
  const topA=A.arqs.slice(0,7).map(x=>x.name);
  const md={}; topV.forEach(vn=>{ md[vn]={};
    topA.forEach(an=>md[vn][an]=(A.mat[vn]&&A.mat[vn][an])||0); });
  s+=H3('Quem trabalha com quem','R$ mil · maiores arquitetos × maiores vendedores','aq-matriz');
  /* nomes completos: o heatmap trunca pela largura da célula e mantém o nome
     inteiro no hover */
  s+=fig(heatmap(topV,topA,md,{valfmt:v=>v>1000?nf(v/1000,0):'',padLeft:150,w:940}),
    ins('arqMatriz',{mat:md,linhas:topV,colunas:topA,arqs:A.arqs}));
  s+=cap('Célula vazia é par que nunca trabalhou junto. Uma coluna concentrada numa linha só é um '
    +'arquiteto que pertence a um vendedor; espalhada, é um arquiteto da casa.');

  /* ---- 5. os arquitetos ---- */
  s+=H3('Os arquitetos','ordenados por venda atribuída na janela','aq-lista');
  s+=fig(hbar(A.arqs.slice(0,14).map(x=>[x.name,x.v]),
      {valfmt:v=>mi(v,1),padLeft:250,w:820,color:SER[6],maxbars:14,pct:true,
       total:A.arqs.reduce((s2,x)=>s2+x.v,0)}),
    ins('auto',{itens:A.arqs.map(x=>({name:x.name,v:x.v,peds:x.peds,extra:x.rt})),
      escopo:'arquiteto',escopoPl:'arquitetos',universo:'da venda pelo canal',
      rotuloExtra:'RT',id:'arq-canal',preferir:['taxa','divergencia']}));
  s+=table(['Arquiteto / escritório','Venda atribuída','RT paga','RT efetiva','Pedidos','Clientes',
            'Vendedor principal','% com ele','Meses sem trazer'],
    A.arqs.slice(0,20).map(x=>[esc(trunc(x.name,30)),money(x.v),money(x.rt),pct(x.taxa,1),
      nf(x.peds),nf(x.clis),esc(trunc(x.dono||'—',18)),
      `<span style="color:${x.shDono>=.9?WARN:MUT}">${pct(x.shDono,0)}</span>`,
      `<span style="color:${x.r>=6?BAD:(x.r>=3?WARN:GOOD)};font-weight:600">${nf(x.r)}</span>`]),
    ['left','right','right','right','right','right','left','right','right'],null,
    ins('arqExclusividade',{arqs:A.arqs,vend:A.vend}));
  s+=cap('“% com ele” é quanto da venda daquele arquiteto passou pelo vendedor principal. '
    +'Perto de 100% significa relação exclusiva — o arquiteto é do vendedor, não da casa.');

  /* ---- 6. arquitetos que pararam ---- */
  const parados=A.arqs.filter(x=>x.r>=6).sort((a,b)=>b.v-a.v).slice(0,12);
  if(parados.length){
    s+=H3('Arquitetos que pararam de trazer','sem nenhum pedido há seis meses ou mais','aq-parados');
    s+=table(['Arquiteto / escritório','Venda na janela','Pedidos','Meses sem trazer','Vendedor principal'],
      parados.map(x=>[esc(trunc(x.name,32)),money(x.v),nf(x.peds),
        `<span style="color:${BAD};font-weight:600">${nf(x.r)}</span>`,esc(trunc(x.dono||'—',20))]),
      ['left','right','right','right','left'],null,
      ins('arqParados',{parados,arqs:A.arqs,totA:A.totA}));
  }
  s+=blocoRfvArquitetos(A);
  return s;
}


/* ===== Custos: trabalho feito em paralelo (merge de 28/08) ===== */
function applyCxgFilter(){
  const a1=+document.getElementById('cxg-a').value, b1=+document.getElementById('cxg-b').value;
  cxgMinA=a1; cxgMaxA=a1; cxgMinB=b1; cxgMaxB=b1;
  cxgAggA=custosAgg(cxgMinA,cxgMaxA,['MATERIAIS']); cxgAggB=custosAgg(cxgMinB,cxgMaxB,['MATERIAIS']);
  cxgLabA=custosPeriodLabel(cxgMinA,cxgMaxA); cxgLabB=custosPeriodLabel(cxgMinB,cxgMaxB);
  cxgDriverSel=null;
  const wrap=document.getElementById('cx-grp-wrap'); if(wrap) wrap.innerHTML=renderCxGrpTable();
  const dwrap=document.getElementById('cxg-drivers-wrap'); if(dwrap) dwrap.innerHTML=driversComRegua();
  const lbl=document.getElementById('cxg-compare-label'); if(lbl) lbl.textContent='Comparando '+cxgLabB+' (B) vs '+cxgLabA+' (A)';
  const section=document.getElementById('cx-topprod-section'); if(section) section.classList.add('hidden-section');
  const inp=document.getElementById('cx-prodsearch');
  if(inp){ inp.value=''; inp.placeholder='Buscar produto na base completa ('+nf(cxgAggB.produtos.length)+' itens)…'; }
  const box=document.getElementById('cx-topprod'); if(box) box.innerHTML=buildTopProdTableCx(cxgAggB.produtos,cxgAggB,'');
  remount('custosx');
}
/* Drivers de Impacto + a régua de destaque deles, sempre juntos: o filtro A/B redesenha os dois.
   Antes a régua ficava fora do contêiner e continuava descrevendo o par A/B da abertura depois
   que o usuário escolhia outro. */
function driversComRegua(){
  return renderCxgDrivers()+'<div class="tw-ins">'+(window.INSRT?INSRT.strip(
      ins('auto',{itens:cxgGroupDrivers().map(g=>({name:g.grp,v:Math.abs(g.total)})),
        escopo:'grupo',escopoPl:'grupos de produto',universo:'da variação do CPV',
        id:'cx-drivers',tabela:true,preferir:['estrutura','cauda']})):'')+'</div>';
}
function buildCxgFilterBar(){
  const yms=ymList(MINYM_CUSTOS,MAXYM_CUSTOS); const opts=yms.map(y=>`<option value="${y}">${ymLab(y)}</option>`).join('');
  return `<div class="filterbar">
    <div class="fb-custom">Período A (comparação): <select id="cxg-a">${opts}</select></div>
    <div class="fb-custom">Período B (base): <select id="cxg-b">${opts}</select></div>
    <button id="cxg-apply" type="button">Comparar</button>
    <div id="cxg-compare-label" class="fb-label"></div>
  </div>`;
}
function buildTopProdTableCx(list,a,query){
  const top20=list.slice(0,20), rest=list.slice(20);
  const tQ=list.reduce((s2,p)=>s2+p.qtd,0),tM=list.reduce((s2,p)=>s2+p.mat,0),tO=list.reduce((s2,p)=>s2+p.mod,0),
    tG=list.reduce((s2,p)=>s2+p.ggf,0),tC=list.reduce((s2,p)=>s2+p.custo,0);
  if(!list.length) return call('Nenhum produto encontrado para "'+esc(query)+'" no período.','warn');
  const rows=top20.map(p=>[esc(trunc(p.prod,50)),esc(p.grp),nf(p.qtd),money(p.mat),money(p.mod),money(p.ggf),money(p.custo),money(p.qtd?p.custo/p.qtd:0)]);
  if(rest.length){const r=rest.reduce((s2,p)=>({qtd:s2.qtd+p.qtd,mat:s2.mat+p.mat,mod:s2.mod+p.mod,ggf:s2.ggf+p.ggf,custo:s2.custo+p.custo}),{qtd:0,mat:0,mod:0,ggf:0,custo:0});
    rows.push(['<b>Demais produtos</b>',`<span class="mut">${nf(rest.length)} itens</span>`,nf(r.qtd),money(r.mat),money(r.mod),money(r.ggf),money(r.custo),money(r.qtd?r.custo/r.qtd:0)]);}
  return '<div class="tbl-fit">'+table(['Produto','Grupo','Qtde vendida','MAT','M.O','GGF','CPV total','CPV/unidade'],rows,
    ['left','left','right','right','right','right','right','right'],
    ['Total',esc(list.length+' produtos'),nf(tQ),money(tM),money(tO),money(tG),money(tC),money(tQ?tC/tQ:0)])+'</div>';
}
function cxgDesvio(p){
  if(p.qtyA===0&&p.qtyB>0) return 'produto novo na curva — '+nf(p.qtyB)+' un. vendidas';
  if(p.qtyA>0&&p.qtyB===0) return 'saiu da curva — vendia '+nf(p.qtyA)+' un.';
  const dq=p.qtyB-p.qtyA, du=(p.qtyB?p.custoB/p.qtyB:0)-(p.qtyA?p.custoA/p.qtyA:0);
  const parts=[];
  if(dq) parts.push((dq>0?'+':'')+nf(dq)+' un.');
  if(Math.abs(du)>0.5) parts.push('CPV/un '+(du>0?'+':'')+money(du,0));
  return parts.length?parts.join(' · '):'sem variação relevante';
}
function cxgExecutiveInsight(g){
  const aMix=Math.abs(g.mix), aVol=Math.abs(g.vol), aCst=Math.abs(g.cst);
  const clr=v=>`<span style="color:${v<=0?GOOD:BAD};font-weight:600">${money(Math.abs(v))}</span>`;
  const clause=(nome,v)=>Math.abs(v)<1?(nome+' não teve efeito relevante'):(nome+' '+(v<=0?'aliviou':'pressionou')+' o CPV em '+clr(v));
  let headline;
  if(aMix>=aVol&&aMix>=aCst){
    headline='O impacto em '+esc(g.grp)+' foi dominado por <b>Mix</b>: produtos entraram ou saíram da curva de vendas — não é vender mais ou menos dos mesmos itens, nem mudança no CPV unitário deles.';
  } else if(aVol>=aMix&&aVol>=aCst){
    headline='O impacto em '+esc(g.grp)+' foi dominado por <b>Volume</b>: os mesmos produtos venderam mais ou menos — o CPV unitário deles não mudou de forma relevante, e a curva de produtos é praticamente a mesma.';
  } else {
    headline='O impacto em '+esc(g.grp)+' foi dominado por <b>Custo</b>: o CPV unitário dos mesmos produtos mudou — a quantidade vendida e a curva de produtos seguem parecidas.';
  }
  const detail=clause('Mix',g.mix)+'; '+clause('Volume',g.vol)+'; '+clause('Custo',g.cst)+' — juntos, o grupo '+(g.total<=0?'aliviou':'pressionou')+' o CPV total em '+clr(g.total)+' ('+esc(cxgLabB)+' vs '+esc(cxgLabA)+').';
  return {kind:g.total>0?'warn':'ok',txt:headline+' '+detail};
}
function cxgGroupDrivers(){
  const merged=cxgMergeProdutos(cxgAggA,cxgAggB);
  const grpMap={};
  merged.forEach(p=>{
    const im=cxgImpact(p.qtyA,p.custoA,p.qtyB,p.custoB);
    const g=grpMap[p.grp]||(grpMap[p.grp]={grp:p.grp,mix:0,vol:0,cst:0,total:0,custoA:0,custoB:0});
    g.mix+=im.mix; g.vol+=im.vol; g.cst+=im.cst; g.total+=im.total; g.custoA+=p.custoA; g.custoB+=p.custoB;
  });
  return Object.values(grpMap).sort((x,y)=>Math.abs(y.total)-Math.abs(x.total));
}
function cxgImpact(qtyA,custoA,qtyB,custoB){
  const uA=qtyA?custoA/qtyA:0, uB=qtyB?custoB/qtyB:0;
  const oneZero=(qtyA===0)!==(qtyB===0), bothPos=qtyA>0&&qtyB>0;
  const mix=oneZero?(qtyB-qtyA)*(qtyB>0?uB:uA):0;
  const vol=bothPos?(qtyB-qtyA)*uB:0;
  const cst=bothPos?(uB-uA)*qtyA:0;
  return {mix,vol,cst,total:mix+vol+cst};
}
function cxgMergeProdutos(aggA,aggB){
  const map={};
  const add=(list,side)=>{ (list||[]).forEach(p=>{ const k=p.prod+'||'+p.grp;
    const o=map[k]||(map[k]={prod:p.prod,grp:p.grp,qtyA:0,custoA:0,qtyB:0,custoB:0}); map[k]=o;
    if(side==='A'){ o.qtyA+=p.qtd; o.custoA+=p.custo; } else { o.qtyB+=p.qtd; o.custoB+=p.custo; } }); };
  add(aggA&&aggA.produtos,'A'); add(aggB&&aggB.produtos,'B');
  return Object.values(map);
}
function cxgPickTop(list){
  const n=Math.min(5,list.length);
  if(n<=3) return list.slice(0,n);
  const topAbs=Math.abs(list[0].total)||1;
  let cut=3;
  for(let i=3;i<n;i++){ if(Math.abs(list[i].total)>=0.15*topAbs) cut=i+1; else break; }
  return list.slice(0,cut);
}
function drawCxMatDetail(cat){
  const box=document.getElementById('cx-matdetail'); if(!box||!cxLastA) return;
  if(cxMatSel===cat){ cxMatSel=null; box.innerHTML=''; return; }
  cxMatSel=cat;
  const top=cxLastA.materiaisTop[cat]||[];
  const catTot=(cxLastA.materiais.find(x=>x[0]===cat)||[cat,0])[1];
  const col=CUSTOS_MAT_COLORS[cat]||SER[0];
  const rows=top.map(([nome,custo,qtd,um])=>{const u=um||'un.'; const cu=qtd?custo/qtd:0;
    return [esc(nome),esc(u),nf(qtd,2),money(custo),money(cu,2),pct(catTot?custo/catTot:0,1)];});
  const topSum=top.reduce((s2,[,custo])=>s2+custo,0), demais=catTot-topSum;
  if(demais>0.5) rows.push(['<b>Demais materiais</b>','','',money(demais),'',pct(catTot?demais/catTot:0,1)]);
  const inner='<div class="nzwide">'+table(['Material','UM','Qtde','Custo','Custo/UM','% da categoria'],rows,
    ['left','left','right','right','right','right'])+'</div>';
  box.innerHTML=drillBox('cx-matdetail',col,'Principais materiais por tipo',cat,
    money(catTot)+' · top '+nf(top.length)+' materiais · '+esc(cxLastLab),inner);
  bindDrillClose(box,()=>{cxMatSel=null;});
  box.scrollIntoView({behavior:REDUCED?'auto':'smooth',block:'nearest'});
}
function drawCxgDriverDetail(grp){
  const box=document.getElementById('cxg-driver-detail'); if(!box) return;
  if(cxgDriverSel===grp){ cxgDriverSel=null; box.innerHTML=''; return; }
  cxgDriverSel=grp;
  const merged=cxgMergeProdutos(cxgAggA,cxgAggB).filter(p=>p.grp===grp)
    .map(p=>({...p,...cxgImpact(p.qtyA,p.custoA,p.qtyB,p.custoB)}))
    .sort((x,y)=>Math.abs(y.total)-Math.abs(x.total));
  const top=cxgPickTop(merged);
  const rows=top.map(p=>[esc(trunc(p.prod,46)),cxgDesvio(p),cxgDMoney(p.mix),cxgDMoney(p.vol),cxgDMoney(p.cst),cxgDMoney(p.total)]);
  const groupRow=cxgGroupDrivers().find(g=>g.grp===grp);
  const insight=groupRow?cxgExecutiveInsight(groupRow):null;
  let inner=insight?call(insight.txt,insight.kind):'';
  inner+='<div class="nzwide">'+table(['Produto','Desvio','Mix','Volume','Custo','Impacto total'],rows,
    ['left','left','right','right','right','right'])+'</div>';
  box.innerHTML=drillBox('cxg-driver-detail',SER[0],'Maiores impactos financeiros no CPV',grp,
    nf(top.length)+' de '+nf(merged.length)+' produtos comparáveis · '+esc(cxgLabB)+' (B) vs '+esc(cxgLabA)+' (A)',inner);
  bindDrillClose(box,()=>{cxgDriverSel=null;});
  box.scrollIntoView({behavior:REDUCED?'auto':'smooth',block:'nearest'});
}
function initCxgFilterBar(){
  const set=(id,v)=>{const el=document.getElementById(id); if(el) el.value=v;};
  set('cxg-a',cxgMinA); set('cxg-b',cxgMinB);
  const btn=document.getElementById('cxg-apply'); if(btn) btn.addEventListener('click',applyCxgFilter);
  const lbl=document.getElementById('cxg-compare-label');
  if(lbl) lbl.textContent='Comparando '+cxgLabB+' (B) vs '+cxgLabA+' (A)';
}
function initProdSearchCx(){
  const inp=document.getElementById('cx-prodsearch'); if(!inp||!cxgAggB) return;
  let tmr=null;
  inp.addEventListener('input',()=>{
    clearTimeout(tmr);
    tmr=setTimeout(()=>{
      const q=inp.value.trim().toLowerCase();
      const list=q?cxgAggB.produtos.filter(p=>p.prod.toLowerCase().includes(q)||p.grp.toLowerCase().includes(q)):cxgAggB.produtos;
      const box=document.getElementById('cx-topprod'); if(box) box.innerHTML=buildTopProdTableCx(list,cxgAggB,q);
    },220);
  });
}
function moggfPorTipoDeConta(a,mod,ggf){
  const itens=a.operacionais.PRODUTIVO.itens;
  const moRaw=itens.filter(([r])=>/PESSOAL/i.test(r)).reduce((s,[,v])=>s+v,0);
  const ggfRaw=itens.reduce((s,[,v])=>s+v,0)-moRaw;
  const fMo=moRaw?mod/moRaw:0, fGgf=ggfRaw?ggf/ggfRaw:0;
  return itens.map(([r,v])=>[r,/PESSOAL/i.test(r)?'Mão de Obra':'GGF',v*(/PESSOAL/i.test(r)?fMo:fGgf)]);
}
function reconcileCustos(a){
  /* idempotente: a reconciliação muda "a" no lugar e transforma cc de 6 em 8 colunas — uma
     segunda chamada no mesmo agregado reescalaria de novo e trocaria as colunas de lugar */
  if(!a||a._reconciliado) return a;
  a._reconciliado=true;
  const t=a.total;
  const matRaw=a.materiais.reduce((s,x)=>s+x[1],0);
  const fMat=matRaw?t.mat/matRaw:0;
  a.materiais=a.materiais.map(([c,v])=>[c,v*fMat]);
  const matTopNew={};
  for(const cat in a.materiaisTop){ matTopNew[cat]=a.materiaisTop[cat].map(([nome,custo,qtd,um])=>[nome,custo*fMat,qtd,um]); }
  a.materiaisTop=matTopNew;
  const modRaw=a.cc.reduce((s,x)=>s+x[1],0), ggfRaw=a.cc.reduce((s,x)=>s+x[2],0);
  const fMod=modRaw?t.mod/modRaw:0, fGgf=ggfRaw?t.ggf/ggfRaw:0;
  a.cc=a.cc.map(x=>{ const mod=x[1]*fMod, ggf=x[2]*fGgf, custo=mod+ggf;
    const custoRaw=x[1]+x[2], taxaRaw=x[4]?custoRaw/x[4]:0;
    // [cc,MOD(CPV),GGF(CPV),Absorção CPV,horas,R$/h(CPV), Absorção Total(bruta),R$/h(bruta)]
    return [x[0],mod,ggf,custo,x[4],x[4]?custo/x[4]:0,custoRaw,taxaRaw]; });
  a.ccTotal={horas:a.ccTotal.horas, custo:t.mod+t.ggf, taxa:a.ccTotal.horas?(t.mod+t.ggf)/a.ccTotal.horas:0,
    custoRaw:modRaw+ggfRaw, taxaRaw:a.ccTotal.horas?(modRaw+ggfRaw)/a.ccTotal.horas:0};
  // Nota: a.operacionais (Produtivo × Apoio/Auxiliar, Razão CC) NÃO é escalado aqui — é um ledger
  // independente que já reconcilia sozinho (Produtivo + Apoio = MOD + GGF da Valorização_Ordens);
  // forçar Produtivo=t.mod+t.ggf duplicava o Apoio no total da seção "Apoio × Produtivo".
  return a;
}
function renderCxGrpTable(){
  const a=cxgAggB,prev=cxgAggA,lab=cxgLabB+' (B)',labPrev=cxgLabA+' (A)';
  if(!a||!prev) return cap('Selecione o Período A e o Período B no filtro acima para ver o comparativo por grupo.');
  const grpPrevMap={}; prev.grupos.forEach(g=>grpPrevMap[g[0]]={qtd:g[1],mat:g[2],mod:g[3],ggf:g[4],custo:g[5]});
  const grupos=a.grupos;
  const dQ=(cur,old)=>old?deltaHtml(cur/old-1):'—';
  const dC2=(cur,old)=>old?deltaCost(cur/old-1):'—';
  const metricLabels=['Qtde'].concat(cxGrpExpanded?['MAT','M.O','GGF']:[]).concat(['CPV Total','CPV/Un']);
  const rows=grupos.map(g=>{
    const [nome,qtd,mat,mod,ggf,custo]=g;
    const gp=grpPrevMap[nome]||{qtd:0,mat:0,mod:0,ggf:0,custo:0};
    const un=qtd?custo/qtd:0, unP=gp.qtd?gp.custo/gp.qtd:0;
    let row=[`<span class="cx-grp-row-cell drillable" data-grp="${esc(nome)}">${esc(nome)}</span>`,nf(qtd)];
    if(cxGrpExpanded) row=row.concat([money(mat),money(mod),money(ggf)]);
    row=row.concat([money(custo),money(un),nf(gp.qtd)]);
    if(cxGrpExpanded) row=row.concat([money(gp.mat),money(gp.mod),money(gp.ggf)]);
    row=row.concat([money(gp.custo),gp.qtd?money(unP):'—',dQ(qtd,gp.qtd),dC2(custo,gp.custo)]);
    return row;
  });
  const sum=(arr,i)=>arr.reduce((s2,g)=>s2+g[i],0);
  const totQtd=sum(grupos,1),totMat=sum(grupos,2),totMod=sum(grupos,3),totGgf=sum(grupos,4),totCusto=sum(grupos,5);
  const totQtdP=sum(prev.grupos,1),totMatP=sum(prev.grupos,2),totModP=sum(prev.grupos,3),totGgfP=sum(prev.grupos,4),totCustoP=sum(prev.grupos,5);
  let foot=['Total',nf(totQtd)];
  if(cxGrpExpanded) foot=foot.concat([money(totMat),money(totMod),money(totGgf)]);
  foot=foot.concat([money(totCusto),money(totQtd?totCusto/totQtd:0),nf(totQtdP)]);
  if(cxGrpExpanded) foot=foot.concat([money(totMatP),money(totModP),money(totGgfP)]);
  foot=foot.concat([money(totCustoP),totQtdP?money(totCustoP/totQtdP):'—',dQ(totQtd,totQtdP),dC2(totCusto,totCustoP)]);
  const td=(v,cls)=>'<td class="'+(cls||'right')+'">'+(v==null?'':v)+'</td>';
  const rowHtml=r=>'<tr>'+td(r[0],'left')+r.slice(1).map(c=>td(c)).join('')+'</tr>';
  const thead='<thead><tr>'
    +'<th class="left" rowspan="2">Grupo</th>'
    +'<th class="right" colspan="'+metricLabels.length+'">'+esc(lab)+'</th>'
    +'<th class="right" colspan="'+metricLabels.length+'">'+esc(labPrev)+'</th>'
    +'<th class="right" rowspan="2">Var. Qtde</th>'
    +'<th class="right" rowspan="2">Var. CPV</th>'
    +'</tr><tr>'
    +metricLabels.map(h=>'<th class="right">'+esc(h)+'</th>').join('')
    +metricLabels.map(h=>'<th class="right">'+esc(h)+'</th>').join('')
    +'</tr></thead>';
  const tableHtml='<table class="dt">'+thead+'<tbody>'+rows.map(rowHtml).join('')+'</tbody><tfoot>'+rowHtml(foot)+'</tfoot></table>';
  let s=H3('CPV por grupo de produtos','comparativo entre períodos · '+esc(lab)+' vs '+esc(labPrev),'cx-grp');
  s+='<button id="cx-grp-toggle" type="button" class="cxgrp-toggle">'+(cxGrpExpanded?'Agrupar CPV (ocultar MAT/M.O/GGF)':'Desagrupar CPV (ver MAT/M.O/GGF)')+'</button>';
  s+='<div class="cxgrp-table '+(cxGrpExpanded?'nzwide':'tbl-fit')+'"><div class="tw">'+tableHtml+'</div></div>';
  s+=cap('Em CPV, <b style="color:'+GOOD+'">verde = caiu</b> (bom) e <b style="color:'+BAD+'">vermelho = subiu</b>. Volume usa a convenção inversa.');
  return s;
}
function renderCxgDrivers(){
  if(!cxgAggA||!cxgAggB) return '';
  const groups=cxgGroupDrivers();
  let s=H3('Drivers de Impacto no CPV','onde o CPV está sendo impactado · '+esc(cxgLabB)+' (B) vs '+esc(cxgLabA)+' (A) · clique no grupo para ver os produtos','cx-drivers');
  s+=cap('Decompõe a variação de CPV de cada grupo em três efeitos: <b>Mix</b> (produto entrou ou saiu da curva de vendas), <b>Volume</b> (vendeu mais ou menos do mesmo produto) e <b>Custo</b> (o CPV unitário mudou). <b style="color:'+BAD+'">Vermelho</b> pressiona o CPV para cima; <b style="color:'+GOOD+'">verde</b> alivia. Inclui todos os grupos (Componentes incluso) — a soma fecha com o CPV total do período. Usa o mesmo filtro Período A/B da tabela "CPV por grupo de produtos" acima.');
  if(!groups.length) return s+cap('Sem produtos comparáveis entre os dois períodos selecionados.');
  const rows=groups.map(g=>[
    `<span class="cxg-driver-cell drillable" data-grp="${esc(g.grp)}">${esc(g.grp)}</span>`,
    money(g.custoA),money(g.custoB),cxgDMoney(g.mix),cxgDMoney(g.vol),cxgDMoney(g.cst),cxgDMoney(g.total)]);
  const sum=k=>groups.reduce((s2,g)=>s2+g[k],0);
  s+=table(['Grupo','CPV '+esc(cxgLabA)+' (A)','CPV '+esc(cxgLabB)+' (B)','Mix','Volume','Custo','Impacto total'],
    rows,['left','right','right','right','right','right','right'],
    ['Total',money(sum('custoA')),money(sum('custoB')),cxgDMoney(sum('mix')),cxgDMoney(sum('vol')),cxgDMoney(sum('cst')),cxgDMoney(sum('total'))]);
  s+='<div id="cxg-driver-detail"></div>';
  return s;
}

/* ===== Estudos e Análises — modelo gerencial Fábrica × Loja (item 7 da ata de 26/08/2026) =====
   Leitura executiva da aba 12 do Modelo_Gerencial_Fabrica_Loja.xlsx: o que muda do DRE ANTIGO
   (por entidade jurídica, como o Painel reporta) para o Modelo A (por função industrial ×
   comercial), e a prova de que o resultado consolidado não se altera (item 7.6). */
/* A planilha do modelo grava os rótulos sem acento ("MARGEM DE CONTRIBUICAO"). Aqui é camada de
   apresentação: restaura o acento só na exibição, preservando a caixa original. Palavra fora do
   mapa passa intacta, então renomear uma linha na planilha nunca quebra nada. */
const ACENTOS_DRE={LIQUIDA:'LÍQUIDA',LIQUIDO:'LÍQUIDO',CONTRIBUICAO:'CONTRIBUIÇÃO',ABSORCAO:'ABSORÇÃO',
  PRODUCAO:'PRODUÇÃO',DEDUCOES:'DEDUÇÕES',DEPRECIACAO:'DEPRECIAÇÃO',AMORTIZACAO:'AMORTIZAÇÃO',
  NAO:'NÃO',VARIAVEL:'VARIÁVEL',VARIAVEIS:'VARIÁVEIS',OPERACAO:'OPERAÇÃO',SERVICOS:'SERVIÇOS',
  TRANSFERENCIA:'TRANSFERÊNCIA',FABRICA:'FÁBRICA',INDUSTRIAIS:'INDUSTRIAIS',PERIODO:'PERÍODO'};
function acentuaDre(txt){
  return String(txt).replace(/[A-Za-zÀ-ÿ]+/g,w=>{
    const k=w.toUpperCase(), a=ACENTOS_DRE[k];
    if(!a) return w;
    if(w===k) return a;                                                   // TUDO MAIÚSCULO
    if(w[0]===w[0].toUpperCase()) return a.charAt(0)+a.slice(1).toLowerCase();  // Capitalizado
    return a.toLowerCase();
  });
}
/* Estado da seção: só o abre/fecha dos 16 subgrupos de despesa.
   A seção foi reduzida a um único quadro — o DRE por unidade, do topo até o EBIT — e fixada
   em 2026 YTD, o período em discussão. O filtro de ano saiu junto com as tabelas comparativas:
   sem duas leituras lado a lado não sobrou nada para o ano reger. */
let estAno=null, estAberto=false;
const EST_ANO_FOCO=String(ANO_D); /* o estudo abre no ano corrente da DRE, se o modelo o conciliou */
const EST_EBITDA=/^\(=\)\s*EBITDA/i, EST_DEPREC=/^\(-\)\s*Deprecia[cç][aã]o/i;
const EST_ROL=/^\(=\)\s*RECEITA OPERACIONAL LIQUIDA/i;
function renderEstudos(){
  const F=window.FABLOJA;
  let s=`<div class="sec-head"><div class="kick">Estudos e análises</div><h2>Modelo gerencial Fábrica × Loja</h2>
   <p class="lead">O resultado repartido entre <b>fábrica industrial</b> e <b>loja comercial</b>, do topo do DRE até o <b>EBIT</b>. A fábrica deixa de vender ao cliente final e passa a transferir para a loja; despesa e depreciação ficam na entidade que as registrou, sem rateio.</p></div>`;
  if(!F) return s+call('Planilha "Modelo_Gerencial_Fabrica_Loja.xlsx" não encontrada (ou sem conciliação válida). Seção não gerada — rode <code>python Modelo_Gerencial_Fabrica_Loja/modelo_gerencial_fabrica_loja.py</code> e regere o relatório.','warn');
  return s+'<div id="estudos-body"></div>';
}
function renderEstudosBody(){
  const F=window.FABLOJA, ano=estAno;
  const per=(F.periodos&&F.periodos[ano])||F.periodo||ano;
  const bl={}; F.blocos.forEach(b=>bl[b.chave]=b);
  /* as linhas do ano em foco; o fallback para .linhas mantém a seção viva se o HTML
     tiver sido gerado por uma versão antiga do gerador, que só publicava um ano */
  const li=k=>(bl[k]&&bl[k].anos&&bl[k].anos[ano])||(bl[k]&&bl[k].linhas)||[];
  const CH=['FABRICA','LOJA','CONSOLIDADO'];
  const base=li('FABRICA');                 // os três blocos têm a mesma grade de linhas
  const val=(k,i,c)=>{const l=li(k)[i]||[]; return l[c==null?2:c];};
  /* O quadro para no EBIT. A depreciação entra — é custo de operar, ainda que sem caixa —
     e o pacote financeiro sai: neste modelo os juros vão 100% para a Loja por premissa, então
     abaixo do EBIT a comparação entre as duas unidades deixaria de falar de operação e passaria
     a falar de onde a dívida foi parar. O EBIT não existe na planilha: é linha sintética,
     EBITDA depois da depreciação, calculada aqui. */
  const iEB=base.findIndex(l=>EST_EBITDA.test(l[0]));
  const iDep=base.findIndex(l=>EST_DEPREC.test(l[0]));
  const iROL=base.findIndex(l=>EST_ROL.test(l[0]));
  const corte=iDep>=0?iDep+1:base.length;   // tudo abaixo da depreciação some do quadro
  const ebit=(k,c)=>{ if(iEB<0||iDep<0) return null;
    const a=val(k,iEB,c), b=val(k,iDep,c);
    return (a==null||b==null)?null:a+b; };
  const efab=ebit('FABRICA'), eloj=ebit('LOJA'), econ=ebit('CONSOLIDADO');
  let s='<div class="kpis k4">'
   +kpi('Loja · EBIT no modelo antigo',mi(ebit('LOJA',1)),'entidade jurídica','warn')
   +kpi('Loja · EBIT no Modelo A',mi(eloj),'operação comercial',eloj>=0?'ok':'warn')
   +kpi('Fábrica · EBIT no Modelo A',mi(efab),'operação industrial',efab>=0?'ok':'warn')
   +kpi('Consolidado · EBIT',mi(econ),'Modelo A · '+esc(per),econ>=0?'ok':'warn')
   +'</div>';
  const cel=v=>v==null?'<span class="mut">—</span>':(v<0?`<span style="color:${BAD}">${money(v)}</span>`:money(v));
  /* Percentuais sobre a receita líquida do PRÓPRIO bloco: na Fábrica a ROL é receita de
     transferência, não venda ao cliente final — o percentual dela mede a regra de markup,
     não preço de mercado. O Consolidado usa a receita ao cliente final. */
  const sobreROL=(k,v)=>{ if(v==null||iROL<0) return null;
    const rol=val(k,iROL); return (rol==null||!rol)?null:v/rol; };
  const celPct=v=>v==null?'<span class="mut">—</span>'
    :`<span class="mut" style="font-weight:600">${pct(v,1)}</span>`;
  const rotPct=t=>`<span class="mut" style="padding-left:20px">${esc(t)}</span>`;
  const PCT_ROL=[[/^\(=\)\s*MARGEM DE CONTRIBUICAO/i,'% Margem de contribuição sobre a ROL']];
  const SUB=/^\(=\)/;  // fallback de destaque quando o nível não veio (HTML antigo)
  /* Fábrica × Loja × Consolidado, só no Modelo A. A coluna Consolidado vem da própria
     planilha, não da soma das duas: somar contaria a transferência interna duas vezes
     (receita na Fábrica, custo na Loja) e inflaria a receita bruta. */
  const rows=[];
  base.slice(0,corte).forEach((b0,i)=>{
    if(!estAberto&&b0[3]===2) return;
    /* O EBITDA sai do quadro, mas continua sendo a base do EBIT calculado no fim.
       A coluna não perde o fecho: margem − despesas + absorção − depreciação = EBIT. */
    if(EST_EBITDA.test(b0[0])) return;
    const forte=(b0[3]!=null)?b0[3]===0:SUB.test(b0[0]), w=x=>forte?`<b>${x}</b>`:x;
    const nome=esc(acentuaDre(b0[0]));
    rows.push([b0[3]===2?`<span style="padding-left:20px" class="mut">${nome}</span>`:w(nome)]
      .concat(CH.map(k=>w(cel(val(k,i))))));
    const mp=PCT_ROL.find(x=>x[0].test(b0[0]));
    if(mp) rows.push([rotPct(mp[1])].concat(CH.map(k=>celPct(sobreROL(k,val(k,i))))));
  });
  rows.push(['<b>(=) EBIT</b>'].concat(CH.map(k=>`<b>${cel(ebit(k))}</b>`)));
  rows.push([rotPct('% EBIT sobre a ROL')].concat(CH.map(k=>celPct(sobreROL(k,ebit(k))))));
  s+='<button id="est-grp-toggle" type="button" class="cxgrp-toggle">'
    +(estAberto?'Recolher os subgrupos de despesa':'Abrir os 16 subgrupos de despesa')+'</button>';
  s+=H3('O DRE por unidade','Modelo A · até o EBIT · '+esc(per),'est-dre');
  s+=table(['Linha do DRE','Fábrica','Loja','Consolidado'],rows,
    ['left','right','right','right'],null,ins('fabLojaLinhas'));
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
  s+='<div class="sources"><b>Fonte:</b> Modelo_Gerencial_Fabrica_Loja.xlsx, aba <code>12_DRE_Antigo_x_Mudanca</code>, apurada em '+esc(F.apurado)+'. '
    +'Período em tela: '+esc(per)+'. Premissas: base = tudo vendido ao cliente final · fábrica por absorção · transferência a custo de absorção '
    +'+ markup de '+(F.markup!=null?pct(F.markup,3):'—')+' · sem imposto na transferência interna · despesa e depreciação por entidade, sem rateio. '
    +'O markup é premissa calibrada (01_Premissas), não os 10% originais do item 7.1: está ajustado para a Fábrica '
    +'fechar '+esc(String(estAno))+' YTD com EBIT de 10% da receita de transferência.</div>';
  return s;
}
function drawEstudos(){
  const body=document.getElementById('estudos-body'); if(!body) return;
  window.FABLOJA_ANO=estAno;                       // os destaques automáticos leem daqui
  body.innerHTML=renderEstudosBody();
  remount('estudos');
}
function initEstudos(){
  const F=window.FABLOJA; if(!F) return;
  /* seção fixada no ano corrente; se o ano não conciliou na geração, cai no padrão em vez de sumir */
  const anos=F.anos||[];
  estAno=anos.indexOf(EST_ANO_FOCO)>=0?EST_ANO_FOCO:(F.ano_padrao||anos[anos.length-1]);
  /* o botão dos subgrupos é redesenhado a cada draw — o clique fica delegado no corpo da
     seção, que sobrevive, em vez de religado no botão */
  const body=document.getElementById('estudos-body');
  if(body) body.addEventListener('click',ev=>{
    if(ev.target.closest('#est-grp-toggle')){ estAberto=!estAberto; drawEstudos(); }});
}
const _ALL_SECTIONS=[['resumo','Sumário',renderSumario],['evolutiva','Evolutiva histórica',renderEvolutiva],
 ['ytd','Comparativo YTD',renderYTD],['mensal','Análise mensal',null],['periodo','Análise por período',null],
 ['performance','Performance Comercial',renderPerformance],
 ['vendas','Análise de Vendas',null],
 ['arquitetos','Vendedor × Arquiteto',null],
 ['carteira','Carteira',renderCarteira],
 ['carteira_dinamica','Carteira dinâmica',renderCarteiraDinamica],
 ['dre','DRE — Resultado',null],['custofixo','Custo Fixo',null],['custofixo_mensal','Custo Fixo — Mensal',null],['divida','Dívida e endividamento',renderDivida],
 ['custosx','Custos — Executivo',null],['custos','Custos — Operacional',null],
 ['estudos','Estudos e Análises',renderEstudos]];
/* Filtro de permissão: o servidor (app Flask) injeta window.ALLOWED com os ids liberados.
   Ausente (HTML standalone) => mostra tudo, comportamento original. */
const _ALLOWED=(typeof window!=='undefined'&&Array.isArray(window.ALLOWED))?window.ALLOWED:null;
const SECTIONS=_ALLOWED?_ALL_SECTIONS.filter(s=>_ALLOWED.includes(s[0])):_ALL_SECTIONS;
const _has=id=>SECTIONS.some(s=>s[0]===id);
/* ================= ROTEIROS DE APRESENTAÇÃO =================
   Um roteiro é uma sequência de PARADAS. Cada parada aponta para uma seção — ou para uma
   âncora dentro dela — e diz quais BLOCOS daquela seção entram. "Bloco" é o pedaço que vive
   sob um <h3 data-blk>: um gráfico, uma tabela, um par de indicadores. Sem roteiro ativo
   ("Completo") nada muda: o relatório sai inteiro e Apresentar navega seção a seção.

   O roteiro é ponto de partida, não trava. Escolher um roteiro escreve na seleção editável
   (seções + blocos + ordem das paradas); dali em diante o painel manda, e "Salvar como…"
   congela a seleção atual num roteiro seu. */
const ROTEIROS=[{
  id:'executiva',
  nome:'Reunião Executiva',
  desc:'Diretoria e acionistas · 50–60 min',
  atos:[
    {nome:'De onde viemos',paradas:[
      {sec:'resumo'},
      {sec:'evolutiva'}]},
    {nome:'Como o time entrega',paradas:[
      {sec:'performance'},
      {sec:'ytd',blocos:['__abre','ytd-linha','ytd-vendedor']},
      {sec:'mensal',blocos:['__abre','mn-evol','mn-vend']}]},
    {nome:'Análises e pontos de atenção',paradas:[
      {sec:'vendas',blocos:['__abre','av-time','av-diferenca','av-jogo','av-parados']},
      {sec:'arquitetos',blocos:['__abre','aq-peso','aq-dependencia','aq-parados']},
      {sec:'periodo',opcional:true,blocos:['__abre','pe-repasses']}]},
    {nome:'O que já está vendido',paradas:[
      {sec:'carteira_dinamica',blocos:['__abre','cd-status','cd-evol','cd-adiados','cd-previsao']}]},
    {nome:'O resultado',paradas:[
      {sec:'dre',blocos:['__abre','dre-ponte','dre-tabela']},
      {sec:'dre',ancora:'dre-breakeven',blocos:['dre-breakeven','dre-minidre','dre-evol']},
      {sec:'dre',ancora:'dresnap-body',blocos:['dre-snap']}]},
    {nome:'Custo',paradas:[
      {sec:'custofixo'},
      {sec:'custofixo_mensal'},
      {sec:'custosx',blocos:['__abre','cx-mensal','cx-unidade','cx-volume']},
      {sec:'custosx',ancora:'cx-evitavel',blocos:['cx-evitavel','cx-retrabalho',
        'cx-retrabalho-pareto','cx-assistencia','cx-assistencia-prod']},
      {sec:'custos',opcional:true,blocos:['__abre','cu-painel','cu-desmembrado','cu-grupos']},
      {sec:'custos',opcional:true,ancora:'cu-operacionais',
        blocos:['cu-operacionais','cu-produtivo','cu-apoio','cu-cc-taxa']}]}
  ]}];

/* rótulos dos blocos que não têm <h3> próprio (KPIs do topo, figura solta) */
const BLK_LABEL={'__abre':'Abertura — título e indicadores','ytd-kpi':'Indicadores do topo',
  'ytd-linha':ANO_V+' × '+(ANO_V-1)+' — a curva mês a mês','ytd-ind':'Tabela de indicadores'};

/* ---- Admin: seleção de itens do menu ---- */
const ADMIN_KEY='kit55AdminSel';
const ROTEIRO_KEY='kit55Roteiro';
function loadAdminSel(){
  try{ const raw=localStorage.getItem(ADMIN_KEY); if(raw){const o=JSON.parse(raw); const ok=SECTIONS.every(s=>s[0] in o); if(ok) return o;} }catch(e){}
  const o={}; SECTIONS.forEach(s=>o[s[0]]=true); return o;
}
function saveAdminSel(sel){ try{ localStorage.setItem(ADMIN_KEY, JSON.stringify(sel)); }catch(e){} }
let adminSel=_ALLOWED?{}:loadAdminSel();

/* estado editável da apresentação, uma camada acima da seleção de seções:
   blocoSel[secao] = '*' (seção inteira) ou lista de ids de bloco
   paradaOrdem     = ordem das paradas (null = ordem natural do relatório) */
let blocoSel={}, paradaOrdem=null, roteiroAtivo='completo', roteirosSalvos=[];
SECTIONS.forEach(function(s){ blocoSel[s[0]]='*'; });

function salvarRoteiro(){
  try{ localStorage.setItem(ROTEIRO_KEY,JSON.stringify(
    {ativo:roteiroAtivo,blocos:blocoSel,ordem:paradaOrdem,custom:roteirosSalvos})); }catch(e){}
}
function carregarRoteiro(){
  try{ const raw=localStorage.getItem(ROTEIRO_KEY); if(!raw) return;
    const o=JSON.parse(raw);
    roteirosSalvos=Array.isArray(o.custom)?o.custom:[];
    roteiroAtivo=o.ativo||'completo';
    if(o.blocos) SECTIONS.forEach(function(s){ if(o.blocos[s[0]]!==undefined) blocoSel[s[0]]=o.blocos[s[0]]; });
    paradaOrdem=Array.isArray(o.ordem)?o.ordem:null;
  }catch(e){}
}
const roteiroPorId=id=>ROTEIROS.concat(roteirosSalvos).filter(r=>r.id===id)[0]||null;

/* aplica um roteiro: escreve seções, blocos e ordem no estado editável */
function aplicarRoteiro(id){
  roteiroAtivo=id;
  const r=roteiroPorId(id);
  if(!r){ SECTIONS.forEach(function(s){ adminSel[s[0]]=true; blocoSel[s[0]]='*'; }); paradaOrdem=null; }
  else if(r.snapshot){                        /* roteiro salvo pelo usuário */
    SECTIONS.forEach(function(s){ const k=s[0];
      adminSel[k]=!!r.snapshot.sel[k];
      blocoSel[k]=r.snapshot.blocos[k]===undefined?'*':r.snapshot.blocos[k]; });
    paradaOrdem=r.snapshot.ordem?r.snapshot.ordem.map(o=>Object.assign({},o)):null;
  } else {                                    /* roteiro declarado em código */
    const acc={}, ord=[];
    SECTIONS.forEach(function(s){ adminSel[s[0]]=false; });
    r.atos.forEach(a=>a.paradas.forEach(function(p){
      if(!_has(p.sec)) return;
      adminSel[p.sec]=true;
      if(!p.blocos) acc[p.sec]='*';
      else if(acc[p.sec]!=='*'){ const cur=acc[p.sec]||[];
        p.blocos.forEach(function(b){ if(cur.indexOf(b)<0) cur.push(b); }); acc[p.sec]=cur; }
      ord.push({sec:p.sec,ancora:p.ancora||null,ato:a.nome,opcional:!!p.opcional});
    }));
    SECTIONS.forEach(function(s){ blocoSel[s[0]]=acc[s[0]]||'*'; });
    paradaOrdem=ord;
  }
  saveAdminSel(adminSel); salvarRoteiro(); aplicarTudo();
}

/* ===== marcação dos blocos =====
   Mesma convenção de nearestFigTitle(): o <h3> abre o bloco e tudo que vem depois pertence
   a ele, até o próximo <h3>. Um container com UM <h3> (o par de uma .two, o corpo do
   dashboard mensal do DRE) é ele próprio um bloco; um com vários (#dre-body, #custosx-body)
   é percorrido por dentro. Só carimba atributos — não reestrutura nada, então os filtros que
   reescrevem o corpo da seção continuam funcionando como antes. */
function marcarBlocos(){
  document.querySelectorAll('main > section').forEach(function(sec){ marcarEm(sec,{k:'__abre'}); });
}
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
/* liga .blk-off no que está fora da seleção; container que ficou vazio some junto */
function aplicarBlocos(){
  document.querySelectorAll('main > section').forEach(function(sec){
    const perm=blocoSel[sec.id]===undefined?'*':blocoSel[sec.id];
    const tudo=(perm==='*');
    sec.querySelectorAll('[data-blk-of]').forEach(function(el){
      el.classList.toggle('blk-off',!tudo&&perm.indexOf(el.dataset.blkOf)<0); });
    /* .two com um filho só passa a ocupar a linha inteira, senão sobra meia página vazia */
    sec.querySelectorAll('.two').forEach(function(tw){
      const vis=[...tw.children].filter(c=>!c.classList.contains('blk-off'));
      tw.classList.toggle('blk-solo',vis.length===1);
      tw.classList.toggle('blk-off',vis.length===0&&tw.children.length>0); });
    sec.querySelectorAll('[data-blkbox]').forEach(function(bx){
      const vis=[...bx.children].filter(c=>!c.classList.contains('blk-off'));
      bx.classList.toggle('blk-off',vis.length===0&&bx.children.length>0); });
  });
}
function applyAdminSel(){
  SECTIONS.forEach(function(s){
    const id=s[0], on=adminSel[id]!==false;
    const sec=document.getElementById(id); if(sec) sec.classList.toggle('admin-hidden',!on);
    const nv=document.querySelector('#nav a[data-t="'+id+'"]'); if(nv) nv.classList.toggle('admin-hidden',!on);
  });
}
/* a numeração dos capítulos acompanha o que está de fato na apresentação */
function renumerarCapitulos(){
  let i=0;
  document.querySelectorAll('main > section').forEach(function(s){
    const n=s.querySelector('.chap-num'); if(!n) return;
    if(s.classList.contains('admin-hidden')){ n.textContent=''; return; }
    i++; n.textContent=String(i).padStart(2,'0');
  });
}
function aplicarTudo(){
  marcarBlocos(); applyAdminSel(); aplicarBlocos(); renumerarCapitulos();
  atualizarResumoPainel();
}

/* ===== paradas: a sequência que o modo apresentação percorre ===== */
function paradasAtivas(){
  if(paradaOrdem&&paradaOrdem.length){
    const out=[];
    paradaOrdem.forEach(function(o){
      const sec=document.getElementById(o.sec);
      if(!sec||sec.classList.contains('admin-hidden')) return;
      /* a ancora pode ser um id de elemento (#dresnap-body) ou um id de bloco — assim uma
         secao longa rende duas paradas, sem precisar ser partida em duas <section> */
      const el=o.ancora?(sec.querySelector('[data-blk="'+o.ancora+'"]')||document.getElementById(o.ancora)):sec;
      if(!el||el.classList.contains('blk-off')) return;
      out.push({el:el,sec:o.sec,ato:o.ato||''});
    });
    if(out.length) return out;
  }
  return [...document.querySelectorAll('main > section')]
    .filter(s=>!s.classList.contains('admin-hidden'))
    .map(s=>({el:s,sec:s.id,ato:''}));
}

/* ===== painel: escolher o roteiro e editar bloco a bloco ===== */
/* blocos existentes numa seção, na ordem em que aparecem, com o rótulo do <h3> */
function blocosDaSecao(sec){
  const vistos={}, out=[];
  sec.querySelectorAll('[data-blk-of]').forEach(function(el){
    const k=el.dataset.blkOf; if(!k||vistos[k]) return; vistos[k]=1;
    let lab=BLK_LABEL[k];
    if(!lab){ const h=sec.querySelector('h3[data-blk="'+k+'"]');
      if(h){ const c=h.cloneNode(true); const tg=c.querySelector('.tag'); if(tg) tg.remove();
        lab=c.textContent.trim(); } }
    out.push({id:k,label:lab||k});
  });
  return out;
}
const blocoLigado=function(sid,bid){ const p=blocoSel[sid];
  return p==='*'||p===undefined||p.indexOf(bid)>=0; };
function ligarBloco(sid,bid,on){
  const sec=document.getElementById(sid); if(!sec) return;
  const todos=blocosDaSecao(sec);
  let p=blocoSel[sid];
  p=(p==='*'||p===undefined)?todos.map(b=>b.id):p.slice();
  const i=p.indexOf(bid);
  if(on&&i<0) p.push(bid); else if(!on&&i>=0) p.splice(i,1);
  blocoSel[sid]=(p.length===todos.length)?'*':p;
  if(p.length===0) adminSel[sid]=false;
}
/* quantas paradas e quanto tempo — para saber se cabe na reunião antes de entrar */
function atualizarResumoPainel(){
  const el=document.getElementById('admin-resumo'); if(!el) return;
  const n=paradasAtivas().length;
  let vis=0;
  document.querySelectorAll('main > section:not(.admin-hidden)').forEach(function(s){
    s.querySelectorAll('.fig,.tw').forEach(function(f){ if(!f.closest('.blk-off')) vis++; }); });
  /* cada parada custa ~2 min so de entrar e situar; cada visão a mais dentro dela, ~0,4 */
  const min=Math.max(5,Math.round((n*2+vis*0.4)/5)*5);
  el.innerHTML='<b>'+n+'</b> parada'+(n===1?'':'s')+' &middot; <b>'+vis+'</b> visões &middot; ~'+min+' min';
}
function buildAdminPanel(){
  const lista=document.getElementById('admin-list'); if(!lista) return;
  const chips=document.getElementById('admin-roteiros');
  const panel=document.getElementById('adminpanel');

  const desenhaChips=function(){
    if(!chips) return;
    const todos=[{id:'completo',nome:'Completo',desc:'o relatório inteiro'}]
      .concat(ROTEIROS).concat(roteirosSalvos);
    chips.innerHTML=todos.map(function(r){
      return '<button class="rt-chip'+(r.id===roteiroAtivo?' on':'')+'" data-r="'+esc(r.id)+'" '
        +'title="'+esc(r.desc||'')+'">'+esc(r.nome)
        +(r.snapshot?'<span class="rt-x" data-del="'+esc(r.id)+'" title="Excluir">✕</span>':'')
        +'</button>'; }).join('');
  };
  const desenhaLista=function(){
    lista.innerHTML=SECTIONS.map(function(s){
      const id=s[0], title=s[1];
      const sec=document.getElementById(id);
      const bs=sec?blocosDaSecao(sec):[];
      const on=adminSel[id]!==false;
      const nOn=bs.filter(b=>blocoLigado(id,b.id)).length;
      return '<div class="ad-sec'+(on?'':' off')+'" data-sec="'+id+'">'
        +'<label class="ad-head"><input type="checkbox" data-id="'+id+'" '+(on?'checked':'')+'>'
        +'<span class="ad-nome">'+esc(title)+'</span>'
        +'<span class="ad-cont">'+(on?(nOn===bs.length?'tudo':nOn+'/'+bs.length):'fora')+'</span>'
        +'<button class="ad-exp" type="button" data-exp="'+id+'" aria-label="Ver blocos">▾</button></label>'
        +'<div class="ad-blocos hidden">'+(bs.map(function(b){
            return '<label><input type="checkbox" data-sec2="'+id+'" data-blk="'+esc(b.id)+'" '
              +(blocoLigado(id,b.id)?'checked':'')+'>'+esc(b.label)+'</label>'; }).join('')
          ||'<p class="ad-vazio">Sem blocos — a seção não gerou conteúdo.</p>')
        +'</div></div>';
    }).join('');
  };
  const redesenha=function(){ desenhaChips(); desenhaLista(); atualizarResumoPainel(); };

  lista.addEventListener('change',function(ev){
    const cb=ev.target;
    if(cb.dataset.id){ adminSel[cb.dataset.id]=cb.checked; }
    else if(cb.dataset.sec2){ ligarBloco(cb.dataset.sec2,cb.dataset.blk,cb.checked);
      if(cb.checked) adminSel[cb.dataset.sec2]=true; }
    else return;
    saveAdminSel(adminSel); salvarRoteiro(); aplicarTudo(); redesenha();
  });
  lista.addEventListener('click',function(ev){
    const b=ev.target.closest('.ad-exp'); if(!b) return;
    ev.preventDefault(); ev.stopPropagation();
    const box=b.closest('.ad-sec').querySelector('.ad-blocos');
    box.classList.toggle('hidden');
    b.textContent=box.classList.contains('hidden')?'▾':'▴';
  });
  if(chips) chips.addEventListener('click',function(ev){
    const x=ev.target.closest('.rt-x');
    if(x){ ev.preventDefault(); ev.stopPropagation();
      roteirosSalvos=roteirosSalvos.filter(r=>r.id!==x.dataset.del);
      if(roteiroAtivo===x.dataset.del) aplicarRoteiro('completo');
      salvarRoteiro(); redesenha(); return; }
    const c=ev.target.closest('.rt-chip'); if(!c) return;
    aplicarRoteiro(c.dataset.r); redesenha();
  });

  document.getElementById('admin-all').addEventListener('click',function(){
    SECTIONS.forEach(function(s){ adminSel[s[0]]=true; blocoSel[s[0]]='*'; });
    roteiroAtivo='completo'; paradaOrdem=null;
    saveAdminSel(adminSel); salvarRoteiro(); aplicarTudo(); redesenha();
  });
  document.getElementById('admin-none').addEventListener('click',function(){
    SECTIONS.forEach(function(s){ adminSel[s[0]]=false; });
    saveAdminSel(adminSel); salvarRoteiro(); aplicarTudo(); redesenha();
  });
  /* descarta os ajustes e recarrega o roteiro ativo — inclusive o "Completo" */
  const btVoltar=document.getElementById('admin-voltar');
  if(btVoltar) btVoltar.addEventListener('click',function(){
    aplicarRoteiro(roteiroAtivo); redesenha();
  });
  const btSalvar=document.getElementById('admin-salvar');
  if(btSalvar) btSalvar.addEventListener('click',function(){
    const nome=prompt('Nome desta seleção (ex.: Conselho · novembro):','');
    if(!nome) return;
    const id='u'+Date.now().toString(36);
    roteirosSalvos.push({id:id,nome:nome.trim(),desc:'seleção salva neste navegador',
      snapshot:{sel:Object.assign({},adminSel),blocos:JSON.parse(JSON.stringify(blocoSel)),
        ordem:paradaOrdem?paradaOrdem.map(o=>Object.assign({},o)):null}});
    roteiroAtivo=id; salvarRoteiro(); redesenha();
  });
  const btExp=document.getElementById('admin-exportar');
  if(btExp) btExp.addEventListener('click',function(e){
    e.preventDefault();
    const txt=JSON.stringify({ativo:roteiroAtivo,blocos:blocoSel,ordem:paradaOrdem,custom:roteirosSalvos});
    if(navigator.clipboard&&navigator.clipboard.writeText)
      navigator.clipboard.writeText(txt).then(
        function(){ alert('Seleção copiada. No outro computador, use Importar e cole.'); },
        function(){ prompt('Copie o texto abaixo:',txt); });
    else prompt('Copie o texto abaixo:',txt);
  });
  const btImp=document.getElementById('admin-importar');
  if(btImp) btImp.addEventListener('click',function(e){
    e.preventDefault();
    const txt=prompt('Cole aqui a seleção exportada:',''); if(!txt) return;
    try{ const o=JSON.parse(txt);
      if(Array.isArray(o.custom)) roteirosSalvos=o.custom;
      if(o.blocos) SECTIONS.forEach(function(s){ if(o.blocos[s[0]]!==undefined) blocoSel[s[0]]=o.blocos[s[0]]; });
      paradaOrdem=Array.isArray(o.ordem)?o.ordem:null;
      roteiroAtivo=o.ativo||'completo';
      SECTIONS.forEach(function(s){ const p=blocoSel[s[0]];
        adminSel[s[0]]=!(Array.isArray(p)&&p.length===0); });
      saveAdminSel(adminSel); salvarRoteiro(); aplicarTudo(); redesenha();
    }catch(err){ alert('Não consegui ler essa seleção.'); }
  });

  document.getElementById('admintoggle').addEventListener('click',function(e){
    e.preventDefault(); redesenha(); panel.classList.remove('hidden'); });
  document.getElementById('admin-close').addEventListener('click',function(){ panel.classList.add('hidden'); });

  /* o link "Reunião Executiva" da barra: aplica o roteiro e já entra na apresentação */
  const bt=document.getElementById('roteirobtn');
  if(bt) bt.addEventListener('click',function(e){
    e.preventDefault();
    aplicarRoteiro('executiva'); redesenha();
    const ps=paradasAtivas();
    if(ps.length) ps[0].el.scrollIntoView({behavior:'instant',block:'start'});
    if(window.entrarApresentacao) window.entrarApresentacao();
  });
  redesenha();
}

/* ===== Direção de arte: acervo de fotos do showroom (img/) =====
   A cada visita o portal sorteia as peças — hero, capítulos e vitrine da sidebar.
   Cada acesso é uma exposição diferente. */
const ART_SRC=n=>(window.ART_MAP&&window.ART_MAP[n])||((window.ART_BASE||'img/')+n);
const ART_POOL=Array.from({length:19},(_,i)=>ART_SRC('p'+(i+1)+'.jpg'));
const ART=(()=>{const a=[...ART_POOL];for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;})();
const artAt=i=>ART[i%ART.length];

/* hero editorial no topo do relatório */
function buildHero(){
  return `<div id="pagehero"><div class="ph-img" style="background-image:url('${artAt(0)}')"></div><div class="ph-inner">
    <img class="ph-logo" src="${ART_SRC('logo.png')}" alt="+55 Design" onerror="this.style.display='none'">
    <div class="ph-kick">Portal de resultados</div>
    <h1>A leitura completa de <em>vendas, resultado e produção</em></h1>
    <p class="ph-sub">Feito por brasileiros, agora para o mundo — os números da +55 Design com a elegância das nossas peças.</p>
  </div></div>`;
}
/* abertura de capítulo: faixa de foto + numeral serif, no topo de cada seção */
function injectChapters(){
  const secs=[...document.querySelectorAll('main > section')];
  secs.forEach((s,i)=>{
    const chap=document.createElement('div'); chap.className='chap';
    chap.innerHTML=`<div class="chap-img" style="background-image:url('${artAt(i+1)}')"></div>
      <div class="chap-scrim"></div><span class="chap-num">${String(i+1).padStart(2,'0')}</span>`;
    s.prepend(chap);
  });
}
/* momento de marca: citação em faixa espresso após a 2ª seção */
function injectQuote(){
  const secs=document.querySelectorAll('main > section');
  if(secs.length<2) return;
  const q=document.createElement('div'); q.className='quoteband';
  q.innerHTML=`<div class="qb-img" style="background-image:url('${artAt(secs.length+1)}')"></div>
    <div class="qb-inner"><span class="qb-mark">&ldquo;</span>
    <p>Nossos sofás têm <em>sotaque</em> e <em>exclusividade</em>.</p>
    <span class="qb-src">+55 Design &middot; São Paulo — Boca Raton</span></div>`;
  secs[1].after(q);
}
/* vitrine na sidebar: peça em exposição (muda a cada visita) */
function injectSideArt(){
  const side=document.getElementById('side'); if(!side) return;
  const d=document.createElement('div'); d.className='side-art';
  d.innerHTML=`<div class="sa-img" style="background-image:url('${artAt(ART.length-1)}')"></div>
    <span>Em exposição &middot; showroom +55</span>`;
  const anchor=side.querySelector('.side-user')||side.querySelector('.side-foot');
  side.insertBefore(d, anchor||null);
}
/* ===== experiências de luxo: contadores, cortina, apresentação, cursor, leitura ===== */
const REDUCED=window.matchMedia&&matchMedia('(prefers-reduced-motion: reduce)').matches;

/* contadores: os números dos KPIs sobem até o valor quando entram em cena */
function animateVal(el){
  if(el.children.length) return;
  const full=el.textContent;
  const m=full.match(/-?\d{1,3}(?:\.\d{3})*(?:,\d+)?/);
  if(!m) return;
  const numStr=m[0];
  const target=parseFloat(numStr.replace(/\./g,'').replace(',','.'));
  if(!isFinite(target)||target===0) return;
  const decimals=(numStr.split(',')[1]||'').length;
  const pre=full.slice(0,m.index), post=full.slice(m.index+numStr.length);
  const fmt=v=>{
    let s=Math.abs(v).toFixed(decimals).replace('.',',');
    const parts=s.split(','); parts[0]=parts[0].replace(/\B(?=(\d{3})+(?!\d))/g,'.');
    return (v<0?'-':'')+parts[0]+(parts[1]?','+parts[1]:'');
  };
  const t0=performance.now(), dur=1300, ease=x=>1-Math.pow(1-x,4);
  requestAnimationFrame(function step(now){
    const p=Math.min(1,(now-t0)/dur);
    el.textContent=pre+fmt(target*ease(p))+post;
    if(p<1) requestAnimationFrame(step);
  });
}
function setupCounters(){
  if(REDUCED||!('IntersectionObserver' in window)) return;
  const io=new IntersectionObserver(es=>es.forEach(en=>{
    if(!en.isIntersecting) return;
    io.unobserve(en.target);
    if(en.target.dataset.counted) return;
    en.target.dataset.counted='1'; animateVal(en.target);
  }),{threshold:.5});
  const scan=()=>document.querySelectorAll('.kpi-v:not([data-counted])').forEach(el=>io.observe(el));
  scan();
  const mo=new MutationObserver(muts=>{ if(muts.some(m=>m.addedNodes.length)) scan(); });
  mo.observe(document.getElementById('main'),{childList:true,subtree:true});
}

/* cortina espresso — só na volta ao Sumário (as demais seções navegam direto) */
function setupCurtain(){
  if(REDUCED) return;
  const c=document.createElement('div'); c.id='curtain';
  c.innerHTML=`<img src="${ART_SRC('logo.png')}" alt="" onerror="this.style.display='none'">`;
  document.body.appendChild(c);
  document.querySelectorAll('#nav a').forEach(a=>{
    if(a.dataset.t!=='resumo') return;
    a.addEventListener('click',e=>{
      const sec=document.getElementById('resumo'); if(!sec) return;
      e.preventDefault();
      document.body.classList.add('curtain-on');
      setTimeout(()=>{
        window.scrollTo({top:0,behavior:'instant'});
        history.replaceState(null,'','#resumo');
        setTimeout(()=>document.body.classList.remove('curtain-on'),80);
      },430);
    });
  });
}

/* modo apresentação: tela cheia, navegação por setas, posição 03/11 */
function setupPresent(){
  /* o link vive no rodape da barra lateral; so cria um botao proprio se o
     markup nao trouxer o elemento (compatibilidade com paginas antigas). */
  let btn=document.getElementById('presentbtn');
  if(!btn){ btn=document.createElement('button'); btn.id='presentbtn'; btn.type='button';
    btn.textContent='Apresentar'; document.body.appendChild(btn); }
  btn.title='Modo apresentação — navegue com as setas, Esc para sair';
  btn.addEventListener('click',e=>e.preventDefault());
  const pos=document.createElement('div'); pos.id='presentpos'; document.body.appendChild(pos);
  /* No modo apresentação a barra sai da tela, e sem ela só dá para andar de
     seção em seção pelas setas. Esta faixa fina na borda esquerda traz o menu
     de volta quando o ponteiro encosta nela, e o esconde ao sair. */
  const hot=document.createElement('div'); hot.id='side-hot'; document.body.appendChild(hot);
  const espia=on=>document.body.classList.toggle('side-peek',!!on);
  hot.addEventListener('mouseenter',()=>espia(true));
  let sai=null;
  const side=document.getElementById('side');
  if(side){
    side.addEventListener('mouseenter',()=>{ if(sai){clearTimeout(sai); sai=null;} espia(true); });
    side.addEventListener('mouseleave',()=>{ sai=setTimeout(()=>espia(false),180); });
  }
  let idx=0;
  /* A sequência da apresentação são as PARADAS do roteiro ativo. Sem roteiro, paradasAtivas()
     devolve as seções visíveis na ordem do relatório — o comportamento de sempre. */
  const secs=()=>paradasAtivas();
  const upd=()=>{const ps=secs(), n=ps.length, ato=(ps[idx]&&ps[idx].ato)?ps[idx].ato:'';
    pos.innerHTML=`${String(idx+1).padStart(2,'0')} / ${String(n).padStart(2,'0')}`
      +(ato?` &nbsp;·&nbsp; ${esc(ato)}`:'')
      +` &nbsp;·&nbsp; ← → navegar &nbsp;·&nbsp; Esc sair`;};
  const go=i=>{const ss=secs(); if(!ss.length) return;
    idx=Math.max(0,Math.min(ss.length-1,i));
    ss[idx].el.scrollIntoView({behavior:REDUCED?'instant':'smooth',block:'start'}); upd();};
  const on=()=>{document.body.classList.add('present'); btn.textContent='Sair';
    if(document.documentElement.requestFullscreen) document.documentElement.requestFullscreen().catch(()=>{});
    const y=scrollY+140; idx=0; secs().forEach((p,i)=>{if(p.el.offsetTop<=y) idx=i;}); upd();};
  const off=()=>{document.body.classList.remove('present'); document.body.classList.remove('side-peek');
    btn.textContent='Apresentar';
    if(document.fullscreenElement) document.exitFullscreen().catch(()=>{});};
  btn.addEventListener('click',()=>document.body.classList.contains('present')?off():on());
  window.entrarApresentacao=()=>{ if(!document.body.classList.contains('present')) on(); };
  /* clicar no menu durante a apresentação precisa acertar o contador de slides,
     senão a seta seguinte volta para onde a leitura estava antes */
  document.querySelectorAll('#nav a').forEach(a=>a.addEventListener('click',()=>{
    if(!document.body.classList.contains('present')) return;
    const i=secs().findIndex(p=>p.sec===a.dataset.t);
    if(i>=0){ idx=i; upd(); }
    espia(false);
  }));
  document.addEventListener('fullscreenchange',()=>{ if(!document.fullscreenElement&&document.body.classList.contains('present')){document.body.classList.remove('present');btn.textContent='Apresentar';} });
  document.addEventListener('keydown',e=>{
    if(!document.body.classList.contains('present')) return;
    if(document.getElementById('chartzoom')?.classList.contains('on')) return; // Esc trata o zoom primeiro
    if(e.key==='Escape') off();
    else if(['ArrowRight','ArrowDown','PageDown',' '].includes(e.key)){e.preventDefault();go(idx+1);}
    else if(['ArrowLeft','ArrowUp','PageUp'].includes(e.key)){e.preventDefault();go(idx-1);}
  });
}

/* Os filtros (mês, entidade, período) reescrevem o corpo das seções por innerHTML, e com
   isso os blocos recém-criados nascem sem marcação. Mesmo padrão de decorateTables():
   observa childList e remarca fora do ciclo, sem realimentar o loop (só mexemos em
   atributos e classes, que este observador não escuta). */
function setupBlocos(){
  const main=document.getElementById('main'); if(!main) return;
  let pend=false;
  new MutationObserver(()=>{ if(pend) return; pend=true;
    setTimeout(()=>{ pend=false; marcarBlocos(); aplicarBlocos(); },0);
  }).observe(main,{childList:true,subtree:true});
}

/* ponteiro laser (estilo PowerPoint): automático no modo apresentação, ligável a qualquer
   momento pela tecla L ou pelo botão da camada de zoom (para apontar células de tabela) */
function setupLaser(){
  const dot=document.createElement('div'); dot.id='laserdot'; document.body.appendChild(dot);
  document.addEventListener('mousemove',e=>{ dot.style.left=e.clientX+'px'; dot.style.top=e.clientY+'px'; });
  window.setLaser=on=>{ document.body.classList.toggle('laser-on',!!on);
    const b=document.getElementById('chartzoom-laser'); if(b) b.classList.toggle('on',!!on); };
  window.toggleLaser=()=>window.setLaser(!document.body.classList.contains('laser-on'));
  document.addEventListener('keydown',e=>{
    if(e.key!=='l'&&e.key!=='L') return;
    if(e.ctrlKey||e.metaKey||e.altKey) return;
    const t=e.target; if(t&&/^(INPUT|SELECT|TEXTAREA)$/.test(t.tagName)) return;
    e.preventDefault(); window.toggleLaser();
  });
}

/* último <h3> antes do bloco, dentro da mesma seção — é o título que acompanha aquele gráfico/tabela */
function nearestFigTitle(el0){
  const section=el0.closest('section'); if(!section) return null;
  let title=null;
  for(const el of section.querySelectorAll('h3,.fig,.twz')){ if(el===el0) break; if(el.tagName==='H3') title=el; }
  return title;
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

/* fio de leitura: hairline dourada no topo mostra o progresso na página */
function setupProgress(){
  const b=document.createElement('div'); b.id='readbar'; document.body.appendChild(b);
  const u=()=>{const h=document.documentElement.scrollHeight-innerHeight; b.style.transform='scaleX('+(h>0?Math.min(1,scrollY/h):0)+')';};
  addEventListener('scroll',u,{passive:true}); addEventListener('resize',u,{passive:true}); u();
}

/* reveal suave ao rolar (uma vez, só nos elementos do primeiro render) */
function setupReveal(){
  if(window.matchMedia&&matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  if(!('IntersectionObserver' in window)) return;
  const els=[...document.querySelectorAll('section')];
  els.forEach(e=>e.classList.add('rv'));
  // threshold em fracao NAO serve aqui: 6% de uma secao alta pode exceder a propria janela.
  // A secao Custos tem ~14.500px -> 6% = 870px; num viewport de 821px a intersecao maxima e
  // ~755px (ja descontado o rootMargin), o gatilho nunca dispara e a secao fica em opacity:0
  // para sempre. Com threshold 0 a revelacao depende so de entrar na janela, e o rootMargin
  // de -8% preserva o mesmo atraso suave de antes, para qualquer altura de secao.
  const io=new IntersectionObserver(entries=>entries.forEach(en=>{
    if(en.isIntersecting){en.target.classList.add('vis');io.unobserve(en.target);}
  }),{threshold:0,rootMargin:'0px 0px -8% 0px'});
  els.forEach(e=>io.observe(e));
}
function init(){
  const main=document.getElementById('main');
  let html=buildHero();
  for(const [id,title,fn] of SECTIONS){
    if(id==='mensal'){ html+=`<section id="mensal"><div class="sec-head"><div class="kick">Fechamento do mês</div><h2>Análise mensal</h2>
      <p class="lead">Escolha o mês de referência para ver o fechamento comercial: venda, pedidos, ticket, evolução dos últimos 12 meses, vendedoras, categorias e clientes — com comparação ao mês anterior. Atualiza automaticamente a cada nova base.</p></div>
      ${buildMensalFilter()}<div id="mensal-body"></div></section>`;
    } else if(id==='periodo'){ html+=`<section id="periodo"><div class="sec-head"><div class="kick">Exploração</div><h2>Análise por período</h2>
      <p class="lead">Selecione um período para recalcular todas as análises abaixo (vendedoras, categorias, clientes, designers, arquitetos e repasses).</p></div>
      ${buildFilter()}<div id="periodo-body"></div></section>`;
    } else if(id==='vendas'){ html+=`<section id="vendas"><div class="sec-head"><div class="kick">Gestão comercial</div><h2>Análise de Vendas</h2>
      <p class="lead">O que a líder faz diferente do resto do time, decomposto em clientes, recompra e tamanho de pedido — e a carteira de clientes lida por RFV (recência, frequência e valor). Tudo apurado da base comercial, sem premissa externa.</p></div>
      ${buildVendasFilter()}<div id="av-body"></div></section>`;
    } else if(id==='arquitetos'){ html+=`<section id="arquitetos"><div class="sec-head"><div class="kick">Canal de venda</div><h2>Vendedor × Arquiteto</h2>
      <p class="lead">Na maior parte dos projetos quem especifica e traz o cliente é o arquiteto — o que faz do par vendedor × arquiteto o canal real da venda. Quanto cada vendedor depende dele, de quantas relações vive, quais arquitetos são da casa e quais são de uma pessoa só.</p></div>
      ${buildArqFilter()}<div id="aq-body"></div></section>`;
    } else if(id==='dre'){ html+=`<section id="dre"><div class="sec-head"><div class="kick">Resultado · DRE</div><h2>DRE — indicadores e resultado</h2>
      <p class="lead">Demonstração de resultado por entidade — Consolidado, Fábrica e Loja — com filtros de período, no espírito da apresentação de resultados. Receita, margens, EBITDA e resultado a partir do Painel de Resultado (abas REAL). Percentuais sobre a Receita Operacional Líquida (ROL).</p></div>
      ${buildDreFilter()}<div id="dre-body"></div>
      <div class="sec-head" style="margin-top:10px"><div class="kick">DRE · dashboard mensal</div><h2>DRE — Comparativo mensal</h2>
        <p class="lead">Mês selecionado × mês anterior × acumulado do ano (YTD) × mesmo acumulado do ano anterior.</p></div>
      <div class="filterbar"><div class="fb-custom">
        <span class="fb-t">Empresa:</span> <select id="dresnap-emp"><option value="CONSOLIDADO">Consolidado</option><option value="FABRICA">Fábrica</option><option value="DESIGN">Loja</option></select>
        <span class="fb-t">Mês:</span> <select id="dresnap-mes"></select></div></div>
      <div id="dresnap-body"></div></section>`;
    } else if(id==='custofixo'){ html+=`<section id="custofixo"><div class="sec-head"><div class="kick">Custo fixo</div><h2>Custo fixo — composição</h2>
      <p class="lead">Abertura do custo fixo por categoria e entidade nos últimos 12 meses (${_cfJanela()}), no estilo dos slides de custo fixo da apresentação.</p></div>
      <div class="filterbar"><div class="fb-ent"><span class="fb-t">Entidade:</span>
        <button class="cfb" data-e="CONSOLIDADO">Consolidado</button><button class="cfb" data-e="FABRICA">Fábrica</button><button class="cfb" data-e="DESIGN">Loja</button></div></div>
      <div id="cf-body"></div></section>`;
    } else if(id==='custofixo_mensal'){ html+=`<section id="custofixo_mensal"><div class="sec-head"><div class="kick">Custo fixo · detalhamento</div><h2>Custo fixo mensal</h2>
        <p class="lead">Mês a mês por pacote, direto do razão contábil — clique num pacote para ver a composição por terceiro.</p></div>
      <div class="filterbar"><div class="fb-custom">
        <span class="fb-t">Empresa:</span> <select id="cfm-emp"><option value="CONSOLIDADO">Consolidado</option><option value="FABRICA">Fábrica</option><option value="LOJA">Loja</option></select>
        <span class="fb-t">Mês:</span> <select id="cfm-mes"></select>
        <span class="fb-t">Detalhar por:</span> <select id="cfm-dim"><option value="t">Terceiro</option><option value="c">Conta contábil</option></select></div></div>
      <div id="cfm-body"></div></section>`;
    } else if(id==='custosx'){ html+=`<section id="custosx"><div class="sec-head"><div class="kick">Custos · Visão executiva</div><h2>Custo do Produto Vendido - CPV</h2>
      <p class="lead">A leitura executiva do custo do produto vendido (CPV), pronta para apresentação: os pontos que merecem atenção da diretoria, com comparação automática ao período anterior. O detalhamento operacional vive na seção “Custos — Operacional”.</p></div>
      ${window.CUSTOS?buildCustosXFilter():''}<div id="custosx-body"></div></section>`;
    } else if(id==='custos'){ html+=`<section id="custos"><div class="sec-head"><div class="kick">Fábrica · +55 Fábrica</div><h2>Custo de Produção - CPP</h2>
      <p class="lead">Custo de produção (CPP) desmembrado em Matéria-prima, Mão de obra e Gastos Gerais de Fabricação, absorção por centro de custo, retrabalho e assistência técnica — apurados a partir das ordens de fabricação do ERP fabril (Valorização_Ordens, NDVAL666 e NDPRO359), pelo volume produzido no período.</p></div>
      ${window.CUSTOS?buildCustosFilter():''}<div id="custos-body"></div></section>`;
    } else { html+=`<section id="${id}">${fn()}</section>`; }
  }
  main.innerHTML=html;
  // nav
  document.getElementById('nav').innerHTML=SECTIONS.map(s=>`<a href="#${s[0]}" data-t="${s[0]}">${esc(s[1])}</a>`).join('');
  if(_has('mensal')){ initMensal(); drawMensal(); }
  if(_has('periodo')){ initFilter(); drawPeriodo(); }
  if(_has('dre')){ initDreFilter(); drawDre(); initDreSnap(); }
  if(_has('custofixo')){ initCustoFixo(); drawCustoFixo(); }
  if(_has('custofixo_mensal')) initCustoFixoMensal();
  if(_has('custos')){ if(window.CUSTOS){ initCustosFilter(); drawCustos(); } else { const cb=document.getElementById('custos-body'); if(cb) cb.innerHTML=call('Fontes de custo não encontradas (pasta fontes/custos). Seção não gerada.','warn'); } }
  if(_has('custosx')){ if(window.CUSTOS){ initCustosXFilter(); drawCustosX(); } else { const cb=document.getElementById('custosx-body'); if(cb) cb.innerHTML=call('Fontes de custo não encontradas (pasta fontes/custos). Seção não gerada.','warn'); } }
  if(_has('vendas')) initAnaliseVendas();
  if(_has('arquitetos')) initArquitetos();
  if(_has('carteira_dinamica')) initCarteiraDinamica();
  if(_has('estudos')&&window.FABLOJA){ initEstudos(); drawEstudos(); }
  if(window.INSRT) INSRT.mount();
  /* a vitrine de fotos na barra lateral empurrava o menu para fora da tela e
     obrigava a rolar para chegar nas ultimas secoes — saiu de proposito */
  injectChapters(); injectQuote();
  /* o roteiro guardado no navegador entra antes do painel, para o painel já nascer com
     as caixas certas marcadas */
  carregarRoteiro(); aplicarTudo();
  buildAdminPanel(); setupReveal(); setupBlocos();
  setupCounters(); setupCurtain(); setupPresent(); setupProgress(); setupTableTools(); setupChartZoom(); setupLaser(); setupTableZoom();
  // scrollspy
  const links=[...document.querySelectorAll('#nav a')], secs=links.map(a=>document.getElementById(a.dataset.t));
  const spy=()=>{const y=scrollY+130;let c=0;secs.forEach((s,i)=>{if(s&&s.offsetTop<=y&&!s.classList.contains('admin-hidden'))c=i;});links.forEach((a,i)=>a.classList.toggle('active',i===c));};
  addEventListener('scroll',spy,{passive:true}); spy();
  const tog=document.getElementById('navtoggle'); if(tog) tog.addEventListener('click',()=>document.getElementById('side').classList.toggle('open'));
  links.forEach(a=>a.addEventListener('click',()=>document.getElementById('side').classList.remove('open')));
}
document.addEventListener('DOMContentLoaded',init);

/* ================= DRE (P&L) MODULE ================= */
const DRE_LINES=[
 ['receita_bruta','Receita Operacional Bruta','h'],
 ['deducoes','(−) Deduções das Receitas','n'],
 ['receita_liquida','= Receita Operacional Líquida','t'],
 ['custos_var','(−) Custos Variáveis','n'],
 ['margem_contrib','= Margem de Contribuição','t'],
 ['despesas_op','(−) Custo Fixo (Despesas Operacionais)','n'],
 ['ebitda','= EBITDA','t'],
 ['deprec','(−) Depreciação e Amortização','n'],
 ['financeiro','(−) Resultado Financeiro','n'],
 ['ajuste','(+) Efeito absorção e não operacional','p'],
 ['result_liq','= Resultado Líquido','t'],
];
function dreAgg(ent,ymMin,ymMax){
  const E=DPNL[ent]||{}; const sums={}; DRE_LINES.forEach(l=>sums[l[0]]=0);
  ['volume','cpv','gvv','endividamento','juros_passivos'].forEach(k=>sums[k]=0);
  for(const yr in E){ const y=+yr; for(let m=0;m<12;m++){ const ym=y*100+(m+1); if(ym<ymMin||ym>ymMax)continue;
    for(const l of DRE_LINES){ const k=l[0]; if(k==='ajuste')continue; const arr=E[yr][k]; if(arr) sums[k]+=arr[m]||0; }
    ['volume','cpv','gvv','endividamento','juros_passivos'].forEach(k=>{sums[k]+=(E[yr][k]&&E[yr][k][m])||0;}); } }
  sums.ajuste = sums.result_liq - sums.ebitda - sums.deprec - sums.financeiro;
  const rl=sums.receita_liquida||1;
  sums.mc_pct=sums.margem_contrib/rl; sums.eb_pct=sums.ebitda/rl; sums.rl_pct=sums.result_liq/rl;
  sums.cf_pct=sums.despesas_op/rl;
  const vol=sums.volume||0;
  sums.ticket_prod=vol?sums.receita_bruta/vol:0;
  sums.rol_prod=vol?sums.receita_liquida/vol:0;
  sums.custo_prod=vol?sums.cpv/vol:0;
  sums.gvv_prod=vol?sums.gvv/vol:0;
  sums.mc_prod=vol?sums.margem_contrib/vol:0;
  sums.margem_prod=sums.ticket_prod+sums.custo_prod;
  return sums;
}
function dreYears(ent){ const E=DPNL[ent]||{}; return Object.keys(E).map(Number).sort(); }
function dreMonthly(ent,ymMin,ymMax,key){ const E=DPNL[ent]||{}; const out=[];
  for(const yr in E){ const y=+yr; for(let m=0;m<12;m++){ const ym=y*100+(m+1); if(ym<ymMin||ym>ymMax)continue;
    out.push([ym, E[yr][key]?(E[yr][key][m]||0):0]); } }
  out.sort((a,b)=>a[0]-b[0]); return out; }

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

function renderDreBody(ent,a,b,label){
  const g=dreAgg(ent,a,b); let s='';
  /* Janela anterior de mesmo tamanho, imediatamente antes do periodo selecionado.
     E a base de comparacao das regras de destaque que olham variacao (margem x
     volume, custo fixo x receita) — sem ela essas regras nao rodam. */
  const _mesesJanela=(Math.floor(b/100)-Math.floor(a/100))*12+(b%100)-(a%100)+1;
  const _pB=ymShift(a,-1), _pA=ymShift(_pB,-(_mesesJanela-1));
  const _gPrev=dreAgg(ent,_pA,_pB);
  const _dctx={dre:g,drePrev:_gPrev.receita_liquida?_gPrev:null};
  const entName={CONSOLIDADO:'Consolidado',FABRICA:'Fábrica (+55 Fábrica)',DESIGN:'Loja (+55 Design)'}[ent];
  s+='<div class="kpis">'
   +kpi('Receita Bruta',mi(g.receita_bruta),entName)
   +kpi('Receita Líquida',mi(g.receita_liquida),'')
   +kpi('Margem de Contribuição',mi(g.margem_contrib),pct(g.mc_pct,1)+' da ROL','ok')
   +kpi('Custo Fixo',mi(-g.despesas_op),pct(-g.cf_pct,1)+' da ROL','warn')
   +kpi('EBITDA',mi(g.ebitda),pct(g.eb_pct,1)+' da ROL',g.ebitda>=0?'ok':'warn')
   +kpi('Resultado Líquido',mi(g.result_liq),pct(g.rl_pct,1)+' da ROL',g.result_liq>=0?'ok':'warn')
   +'</div>';
  // waterfall
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
  ],{valfmt:v=>mi(v,1)}),
  ins('dreCustoFixoNivel',_dctx));
  // P&L table
  s+=H3('Demonstração de resultado (DRE)','','dre-tabela');
  const rows=DRE_LINES.map(l=>{const v=l[0]==='ajuste'?g.ajuste:g[l[0]]; const av=g.receita_liquida?v/g.receita_liquida:0;
    const cls=l[2]==='t'?' style="font-weight:700;background:#efe9dc"':(l[2]==='h'?' style="font-weight:600"':'');
    const vcol=v<0?`<span style="color:${BAD}">${money(v)}</span>`:money(v);
    return [`<span${cls.includes('style')?'':''}>${esc(l[1])}</span>`, vcol, pct(av,1)];
  });
  s+=table(['Linha','Valor','% ROL'],rows.map((r,i)=>{const t=DRE_LINES[i][2];
      const st=t==='t'?'font-weight:700':(t==='h'?'font-weight:600':''); 
      return [`<span style="${st}">${esc(DRE_LINES[i][1])}</span>`, (DRE_LINES[i][0]==='ajuste'?g.ajuste:g[DRE_LINES[i][0]])<0?`<span style="color:${BAD}">${money(DRE_LINES[i][0]==='ajuste'?g.ajuste:g[DRE_LINES[i][0]])}</span>`:money(DRE_LINES[i][0]==='ajuste'?g.ajuste:g[DRE_LINES[i][0]]), pct((DRE_LINES[i][0]==='ajuste'?g.ajuste:g[DRE_LINES[i][0]])/(g.receita_liquida||1),1)];
    }),['left','right','right'],null,
    ins('dreLinhaQueMudou',_dctx));
  // ---- Ponto de equilíbrio ----
  s+=H3('Ponto de equilíbrio — '+entName,'','dre-breakeven');
  const rolv=g.receita_liquida, mc=g.margem_contrib, cf=-g.despesas_op, vol=g.volume;
  const mcPct=rolv>0?mc/rolv:0, mcUnit=vol>0?mc/vol:0;
  if(mcPct>0 && cf>0){
    const peV=cf/mcPct, peQ=mcUnit>0?cf/mcUnit:0;
    const fixoRes=cf+(-g.deprec)+(-g.financeiro)-g.ajuste;
    const peVR=fixoRes/mcPct, peQR=mcUnit>0?fixoRes/mcUnit:0;
    const margSeg=rolv>0?(rolv-peV)/rolv:0;
    s+='<div class="kpis">'
     +kpi('Margem de contribuição',pct(mcPct,1),'da Receita Líquida')
     +kpi('PE operacional · valor',mi(peV),'Rec. Líquida p/ EBITDA 0','warn')
     +kpi('PE operacional · quantidade',nf(Math.round(peQ))+' un.','produtos p/ EBITDA 0','warn')
     +kpi('Margem de segurança',pct(margSeg,0),(margSeg>=0?'acima':'abaixo')+' do equilíbrio',margSeg>=0?'ok':'warn')
     +'</div>';
    const precoU=vol>0?rolv/vol:0, cvU=vol>0?(rolv-mc)/vol:0;
    const qMax=Math.max(vol,peQ)*1.35, N=8, qs=[]; for(let i=0;i<=N;i++) qs.push(qMax*i/N);
    s+=fig(line([['Receita Líquida',qs.map(q=>precoU*q),SER[0]],['Custo total (fixo + variável)',qs.map(q=>cf+cvU*q),SER[1]]],qs.map(q=>nf(Math.round(q))),{valfmt:v=>mi(v,1),w:980,h:300}),
      ins('equilibrioBruta',{rob:g.receita_bruta,robEB:(g.receita_bruta&&g.deducoes)?peV/(1+g.deducoes/g.receita_bruta):peV,
        robRZ:(g.receita_bruta&&g.deducoes)?peVR/(1+g.deducoes/g.receita_bruta):peVR,
        meses:(Math.floor(b/100)-Math.floor(a/100))*12+(b%100)-(a%100)+1,vol:vol,peQ:peQ}));
    s+=cap('Quantidade de produtos no eixo. O cruzamento das linhas é o equilíbrio operacional: <b>'+nf(Math.round(peQ))+' produtos</b> / <b>'+mi(peV)+'</b> de receita líquida (real: '+nf(Math.round(vol))+' produtos / '+mi(rolv)+'). Preço médio líq. R$ '+nf(precoU,0)+' · custo variável R$ '+nf(cvU,0)+' · custo fixo '+mi(cf)+'.');
    /* a Mini-DRE segue o período do filtro da seção (antes ficava presa ao YTD do ano corrente,
       enquanto o resto da seção obedecia ao filtro). "Histórico" é recortado à série real. */
    const y26a=Math.max(a,MINYM_DRE), y26b=Math.min(b,MAXYM_DRE);
    const perMini=ymLab(y26a)+'–'+ymLab(y26b);
    s+=H3('Mini-DRE — comprovação do ponto de equilíbrio ('+perMini+')','','dre-minidre');
    const g26=dreAgg(ent,y26a,y26b);
    const mesesYTD=Math.max(1,(Math.floor(y26b/100)-Math.floor(y26a/100))*12+(y26b%100)-(y26a%100)+1);
    const mcPct26=g26.receita_liquida?g26.margem_contrib/g26.receita_liquida:0;
    const vol26=g26.volume, mcUnit26=vol26>0?g26.margem_contrib/vol26:0, cf26=-g26.despesas_op;
    if(mcPct26>0 && cf26>0){
      const peV26=cf26/mcPct26, peQ26=mcUnit26>0?cf26/mcUnit26:0;
      /* ROB no equilíbrio: o modelo é construído sobre a Receita Líquida (margem de
         contribuição); a Receita Bruta correspondente aplica o % de deduções real do
         período YTD (assume deduções proporcionais à receita — item 6.4 da ata de 26/08). */
      const dedPct26=g26.receita_bruta?g26.deducoes/g26.receita_bruta:0;
      const robEB26=(1+dedPct26)?peV26/(1+dedPct26):peV26, dedEB26=peV26-robEB26;
      const mcEB26=peV26*mcPct26, ebitdaEB26=mcEB26-cf26;
      /* 6 colunas de valor, em 2 grupos: YTD (Real/Equilíbrio/Variação) e Visão mensal —
         média (Realizado/Equilíbrio/Variação). Variação = Real − Equilíbrio no par
         correspondente (YTD com YTD, mensal com mensal) — mesma cor vermelha usada no
         resto da tabela para valor negativo, sem juízo de "bom/ruim" por linha. */
      const mrow6=(lab,real,eq,bold)=>{const st=bold?'font-weight:700':''; const c=v=>v<0?`<span style="color:${BAD}">${money(v)}</span>`:money(v);
        const wrap=v=>bold?`<b>${c(v)}</b>`:c(v); const realM=real/mesesYTD, eqM=eq/mesesYTD;
        return [`<span style="${st}">${esc(lab)}</span>`, wrap(real), wrap(eq), wrap(real-eq), wrap(realM), wrap(eqM), wrap(realM-eqM)];};
      const qrow6=(lab,r,e)=>{const un=v=>nf(Math.round(v))+' un.'; const rM=r/mesesYTD, eM=e/mesesYTD;
        return [`<span>${esc(lab)}</span>`, un(r), un(e), un(r-e), un(rM), un(eM), un(rM-eM)];};
      const rows6=[
        mrow6('Receita Operacional Bruta',g26.receita_bruta,robEB26),
        mrow6('(−) Deduções de Receita',g26.deducoes,dedEB26),
        mrow6('Receita Líquida',g26.receita_liquida,peV26,true),
        qrow6('Quantidade (produtos)',vol26,peQ26),
        mrow6('(−) Custos Variáveis',g26.custos_var,-peV26*(1-mcPct26)),
        mrow6('= Margem de Contribuição',g26.margem_contrib,mcEB26,true),
        mrow6('(−) Custo Fixo',-cf26,-cf26),
        mrow6('= EBITDA',g26.ebitda,ebitdaEB26,true),
      ];
      s+='<div class="tw"><table class="dt"><thead>'
       +'<tr><th class="left" rowspan="2">Linha</th>'
       +'<th class="right" colspan="3">Período ('+perMini+')</th>'
       +'<th class="right" colspan="3">Visão mensal · média (÷ '+mesesYTD+' '+(mesesYTD===1?'mês':'meses')+')</th></tr>'
       +'<tr><th class="right">Real</th><th class="right">Equilíbrio</th><th class="right">Variação</th>'
       +'<th class="right">Realizado</th><th class="right">Equilíbrio</th><th class="right">Variação</th></tr>'
       +'</thead><tbody>'
       +rows6.map(r=>'<tr>'+r.map((c,i)=>`<td class="${i===0?'left':'right'}">${c}</td>`).join('')+'</tr>').join('')
       +'</tbody></table></div>';
      s+='<div class="tw-ins">'+(window.INSRT?INSRT.strip(
        ins('equilibrioAlavanca',{rol:g26.receita_liquida,mc:g26.margem_contrib,cf:cf26,deprec:g26.deprec,financeiro:g26.financeiro})
      ):'')+'</div>';
      const margSeg26=g26.receita_liquida>0?(g26.receita_liquida-peV26)/g26.receita_liquida:0;
      s+=call('No <b>equilíbrio operacional</b> do período ('+perMini+', '+mesesYTD+' '+(mesesYTD===1?'mês':'meses')+') a margem de contribuição iguala o custo fixo ('+mi(cf26)+') e o EBITDA zera — exigindo '+mi(peV26)+' de receita líquida ('+nf(Math.round(peQ26))+' produtos), equivalente a '+mi(robEB26)+' de receita bruta, contra '+mi(g26.receita_liquida)+' de líquida ('+mi(g26.receita_bruta)+' de bruta) realizados. Em média mensal, isso é '+mi(peV26/mesesYTD)+' de receita líquida por mês, contra '+mi(g26.receita_liquida/mesesYTD)+' realizados por mês. Receita bruta no equilíbrio estimada aplicando o % de deduções real do período ('+pct(-dedPct26,1)+') — assume deduções proporcionais à receita.',margSeg26>=0?'ok':'warn');
    } else {
      s+=call('No período ('+perMini+') a margem de contribuição não é positiva para este recorte — a Mini-DRE de equilíbrio não é aplicável. Selecione o Consolidado ou outro período para ver o equilíbrio operacional.','warn');
    }
  } else {
    s+=call('No período/entidade selecionado a margem de contribuição não é positiva — o ponto de equilíbrio não é aplicável. Selecione o Consolidado e um período com margem de contribuição positiva.','warn');
  }
  // monthly evolution (receita liquida + ebitda) if range spans >1 month
  const rlM=dreMonthly(ent,a,b,'receita_liquida'), ebM=dreMonthly(ent,a,b,'ebitda');
  if(rlM.length>1){ s+=H3('Evolução mensal — receita líquida e EBITDA','','dre-evol');
    s+=fig(line([['Receita Líquida',rlM.map(x=>x[1]),SER[0]],['EBITDA',ebM.map(x=>x[1]),SER[2]]],rlM.map(x=>ymLab(x[0])),{valfmt:v=>mi(v,1),w:980,h:300}),
    ins('dreJurosEbitda',_dctx)); }
  // ---- ticket médio e custo por produto (histórico) ----
  s+=H3('Ticket médio, custo e margem por produto','','dre-produto');
  s+='<div class="kpis k3">'
   +kpi('Quantidade faturada',nf(Math.round(g.volume)),'produtos · '+entName)
   +kpi('Ticket médio / produto',money(g.ticket_prod),'Receita Bruta ÷ qtd')
   +kpi('ROL / produto',money(g.rol_prod),'Receita Líquida ÷ qtd')
   +kpi('Custo médio / produto',money(-g.custo_prod),'CPV ÷ qtd','warn')
   +kpi('GVV / produto',money(-g.gvv_prod),'Gastos var. c/ vendas ÷ qtd','warn')
   +kpi('Margem contrib. / produto',money(g.mc_prod),(g.rol_prod?pct(g.mc_prod/g.rol_prod,0):'')+' da ROL','ok')
   +'</div>';
  const volM=dreMonthly(ent,a,b,'volume'),rbM=dreMonthly(ent,a,b,'receita_bruta'),cpvM=dreMonthly(ent,a,b,'cpv'),rlM2=dreMonthly(ent,a,b,'receita_liquida'),gvvM=dreMonthly(ent,a,b,'gvv');
  const tickM=volM.map((x,i)=>x[1]>0?rbM[i][1]/x[1]:null), rolM=volM.map((x,i)=>x[1]>0?rlM2[i][1]/x[1]:null), custM=volM.map((x,i)=>x[1]>0?Math.abs(cpvM[i][1])/x[1]:null);
  if(volM.length>1){ s+=fig(line([['Ticket médio (ROB) / produto',tickM,SER[0]],['ROL / produto',rolM,SER[2]],['Custo médio (CPV) / produto',custM,SER[1]]],volM.map(x=>ymLab(x[0])),{valfmt:v=>money(v),w:980,h:300}),
    ins('dreMargemVolume',_dctx)
    ||ins('auto',{itens:volM.map((x,i)=>({name:ymLab(x[0]),v:tickM[i]||0,q:x[1]})),escopo:'mês',
        escopoPl:'meses',universo:'do ticket por produto',id:'dre-ticket',preferir:['relacao','cauda']}));
    s+=cap('Ticket médio = Receita Bruta ÷ qtd faturada · ROL/produto = Receita Líquida ÷ qtd · Custo médio = Custo do Produto Vendido ÷ qtd. GVV/produto (comissões, royalties, RT, fretes) e margem de contribuição por produto no quadro anual abaixo.'); }
  s+=H3('Histórico anual — indicadores por produto','todos os anos','dre-produto-ano');
  const yrsE=dreYears(ent).map(y=>({y,gg:dreAgg(ent,y*100+1,y*100+12)})).filter(o=>o.gg.volume>0);
  s+=table(['Ano','Qtd faturada','Ticket (ROB)/prod','ROL/prod','Custo (CPV)/prod','GVV/prod','Margem contrib./prod','Margem %'],
    yrsE.map(({y,gg})=>[y,nf(Math.round(gg.volume)),money(gg.ticket_prod),money(gg.rol_prod),money(-gg.custo_prod),money(-gg.gvv_prod),money(gg.mc_prod),pct(gg.rol_prod?gg.mc_prod/gg.rol_prod:0,1)]),
    ['left','right','right','right','right','right','right','right'],null,
    ins('auto',{itens:yrsE.map(({y,gg})=>({name:String(y),v:gg.ticket_prod,q:gg.volume,extra:-gg.custo_prod})),
      escopo:'ano',escopoPl:'anos',universo:'do preço por produto',rotuloExtra:'custo',
      id:'dre-hist-prod',tabela:true,preferir:['relacao','divergencia']}));
  // Fábrica vs Loja comparison (only in consolidado view)
  if(ent==='CONSOLIDADO'){ const f=dreAgg('FABRICA',a,b),d=dreAgg('DESIGN',a,b);
    s+=H3('Segregação Fábrica × Loja no período','','dre-fabloja');
    s+=table(['Indicador','Fábrica','Loja','Consolidado'],[
      ['Receita Bruta',money(f.receita_bruta),money(d.receita_bruta),money(g.receita_bruta)],
      ['Receita Líquida',money(f.receita_liquida),money(d.receita_liquida),money(g.receita_liquida)],
      ['Margem de Contribuição',money(f.margem_contrib),money(d.margem_contrib),money(g.margem_contrib)],
      ['&nbsp;&nbsp;<span class="mut">% da ROL</span>',`<span class="mut">${pct(f.mc_pct,1)}</span>`,`<span class="mut">${pct(d.mc_pct,1)}</span>`,`<span class="mut">${pct(g.mc_pct,1)}</span>`],
      ['Custo Fixo',money(-f.despesas_op),money(-d.despesas_op),money(-g.despesas_op)],
      ['EBITDA',`<span style="color:${f.ebitda<0?BAD:GOOD}">${money(f.ebitda)}</span>`,`<span style="color:${d.ebitda<0?BAD:GOOD}">${money(d.ebitda)}</span>`,`<span style="color:${g.ebitda<0?BAD:GOOD}">${money(g.ebitda)}</span>`],
      ['Resultado Líquido',`<span style="color:${f.result_liq<0?BAD:GOOD}">${money(f.result_liq)}</span>`,`<span style="color:${d.result_liq<0?BAD:GOOD}">${money(d.result_liq)}</span>`,`<span style="color:${g.result_liq<0?BAD:GOOD}">${money(g.result_liq)}</span>`],
    ],['left','right','right','right'],null,
    ins('dreFabricaLoja',{f:f,d:d,g:g})
    ||ins('auto',{itens:[{name:'Fábrica',v:f.receita_liquida,q:f.volume,extra:f.margem_contrib},
                         {name:'Loja',v:d.receita_liquida,q:d.volume,extra:d.margem_contrib}],
        escopo:'unidade',escopoPl:'unidades',universo:'da receita do período',rotuloExtra:'margem',
        id:'dre-fabloja',tabela:true,preferir:['taxa','divergencia']}));
    s+=fig(line([['Receita Líq. Fábrica',dreMonthly('FABRICA',a,b,'receita_liquida').map(x=>x[1]),SER[0]],
                 ['Receita Líq. Loja',dreMonthly('DESIGN',a,b,'receita_liquida').map(x=>x[1]),SER[1]]],
                 rlM.map(x=>ymLab(x[0])),{valfmt:v=>mi(v,1),w:980,h:280}),
                 ins('dreCustoFixoRol',_dctx));
  }
  return s;
}

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

const MILHAR=v=>nf(v/1000,0);
const eixoY=(x,ymid,txt)=>`<text x="${x}" y="${W(ymid)}" transform="rotate(-90 ${x} ${W(ymid)})" text-anchor="middle" font-size="10" fill="${MUT}">${esc(txt)}</text>`;

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

const CFCOLORS={Pessoal:SER[0],Facilities:SER[1],Consumo:SER[2],Marketing:SER[3],Terceiros:SER[4],Outros:SER[6]};
function renderCustoFixoBody(ent){
  const catObj = ent==='FABRICA'?CF.cat_fabrica : ent==='DESIGN'?CF.cat_loja : CF.categoria;
  const cats=['Pessoal','Facilities','Consumo','Marketing','Terceiros','Outros'];
  const series=cats.map(c=>({name:c,values:catObj[c],color:CFCOLORS[c]}));
  const tot=cats.reduce((a,c)=>a+catObj[c].reduce((x,y)=>x+y,0),0);
  const nM=CF.meses.length||12;
  let s=H3('Custo fixo por categoria — '+({CONSOLIDADO:'Consolidado',FABRICA:'Fábrica',DESIGN:'Loja'}[ent])+' (últimos 12 meses)',_cfJanela(),'cf-cat');
  /* Pessoal + Facilities sobre o custo fixo do mês: as duas maiores categorias juntas, para
     ver se a concentração se move ao longo do ano ou é estrutural. Entra como linha ligável
     na tela de zoom — no gráfico da página as barras já ocupam a leitura. */
  const pesFac=CF.meses.map((_,i)=>{ const t=cats.reduce((a,c)=>a+(catObj[c][i]||0),0);
    return t?((catObj.Pessoal[i]||0)+(catObj.Facilities[i]||0))/t:0; });
  s+='<div id="cf-cat-chart">'+fig(stackedCols(CF.meses,series,{valfmt:v=>mi(v,1),
      linhaPct:{name:'Pessoal + Facilities',values:pesFac,color:'#c9a227',cls:'cf-pesfac'}}),
    ins('cfCategoriaContraFluxo',{cats:catObj,entidade:ent}))+'</div>';
  s+=table(['Categoria','Total '+nM+'m','% do custo fixo','Média/mês'],
    cats.map(c=>{const t=catObj[c].reduce((x,y)=>x+y,0);return [c,money(t),pct(t/tot,1),money(t/nM)];}),
    ['left','right','right','right'],['Custo fixo total',money(tot),'100,0%',money(tot/nM)],
    ins('cfConcentracao',{cats:catObj,entidade:ent}));
  /* item mais volátil: maior desvio-padrão relativo à média mensal, calculado — não escrito.
     Só entre categorias com pelo menos 5% do custo fixo: uma categoria residual oscila por ruído */
  const vol=cats.filter(c=>tot&&catObj[c].reduce((x,y)=>x+y,0)/tot>=.05).map(c=>{ const v=catObj[c], m=v.reduce((a,b)=>a+b,0)/(v.length||1);
    const sd=Math.sqrt(v.reduce((a,x)=>a+(x-m)*(x-m),0)/(v.length||1)); return [c,m>0?sd/m:0]; })
    .sort((a,b)=>b[1]-a[1])[0]||['—',0];
  s+=call('<b>Pessoal e Facilities</b> concentram '+pct((catObj.Pessoal.reduce((a,b)=>a+b,0)+catObj.Facilities.reduce((a,b)=>a+b,0))/tot,0)+' do custo fixo dos últimos '+nM+' meses. '+esc(vol[0])+' é o item mais volátil mês a mês (oscila '+pct(vol[1],0)+' em torno da média).');
  const orig=CF.origem||[], nApr=orig.filter(o=>o!=='razão').length;
  s+=cap('Total de cada mês e entidade igual à despesa operacional da DRE. Abertura por categoria: '
    +(nApr?nApr+' '+(nApr===1?'mês':'meses')+' com a divisão da apresentação de resultados ajustada ao total da DRE ('+CF.meses.filter((_,i)=>orig[i]!=='razão').join(', ')+') e ':'')
    +(nM-nApr)+' '+((nM-nApr)===1?'mês':'meses')+' pelo razão contábil (aba _BD).');
  return s;
}
function renderCustoFixoEntidade(){
  // entity totals comparison (stacked/lines)
  const ent={'Consolidado':CF.entidade.Consolidado,'Fábrica':CF.entidade['Fábrica'],'Loja':CF.entidade.Loja};
  let s=H3('Custo fixo total por entidade — Fábrica × Loja','','cf-ent');
  s+=fig(line([['Fábrica',ent['Fábrica'],SER[0]],['Loja',ent.Loja,SER[1]]],CF.meses,{valfmt:v=>mi(v,1),w:980,h:270}),
    ins('cfComposicao')
    ||ins('auto',{itens:CF.meses.map((m,i)=>({name:m,v:ent['Fábrica'][i]||0,q:ent.Loja[i]||0})),
        escopo:'mês',escopoPl:'meses',universo:'do custo fixo',id:'cf-ent',
        preferir:['relacao','divergencia']}));
  const tf=ent['Fábrica'].reduce((a,b)=>a+b,0),tl=ent.Loja.reduce((a,b)=>a+b,0);
  const nE=CF.meses.length||12;
  s+=table(['Entidade','Custo fixo '+nE+'m','Média/mês','% do total'],[
    ['Fábrica',money(tf),money(tf/nE),pct(tf/(tf+tl),1)],
    ['Loja',money(tl),money(tl/nE),pct(tl/(tf+tl),1)],
  ],['left','right','right','right'],['Consolidado',money(tf+tl),money((tf+tl)/nE),'100,0%']);
  s+=cap('Comparação entre as duas entidades: este quadro não muda com o filtro de entidade da seção.');
  return s;
}

/* ---- DRE filter state + controller ---- */
const DRE_PRESETS=[...anosFechados(ANO_D).map(y=>[String(y),y*100+1,y*100+12]),
 [ANO_D+' ('+ytdLab(MAXYM_DRE)+')',ANO_D*100+1,MAXYM_DRE],
 ['Últimos 12m',ymShift(MAXYM_DRE,-11),MAXYM_DRE],['Histórico',200001,300000]];
/* abre no acumulado do ano corrente da DRE (jan até o último mês fechado) */
let dEnt='CONSOLIDADO',dMin=ANO_D*100+1,dMax=MAXYM_DRE,cfEnt='CONSOLIDADO';
function buildDreFilter(){
  const yms=ymList(MINYM_DRE,MAXYM_DRE); const opts=yms.map(y=>`<option value="${y}">${ymLab(y)}</option>`).join('');
  return `<div class="filterbar dre-fb">
   <div class="fb-ent"><span class="fb-t">Entidade:</span>
     <button class="entb" data-e="CONSOLIDADO">Consolidado</button>
     <button class="entb" data-e="FABRICA">Fábrica</button>
     <button class="entb" data-e="DESIGN">Loja</button></div>
   <div class="fb-presets">`+DRE_PRESETS.map(p=>`<button class="dpreset" data-a="${p[1]}" data-b="${p[2]}">${esc(p[0])}</button>`).join('')+`</div>
   <div class="fb-custom">De <select id="d-de">${opts}</select> até <select id="d-ate">${opts}</select><button id="d-apply">Aplicar</button></div>
   <div id="dre-label" class="fb-label"></div></div>`;
}
function drawDre(){ document.getElementById('dre-body').innerHTML=renderDreBody(dEnt,dMin,dMax,'');
  document.getElementById('dre-label').textContent='Período: '+periodLabel(dMin,dMax);
  document.querySelectorAll('.entb').forEach(e=>e.classList.toggle('on',e.dataset.e===dEnt));
  document.querySelectorAll('.dpreset').forEach(e=>e.classList.toggle('on',+e.dataset.a===dMin&&+e.dataset.b===dMax));
  remount('dre');
}
function initDreFilter(){
  document.querySelectorAll('.entb').forEach(e=>e.addEventListener('click',()=>{dEnt=e.dataset.e;drawDre();}));
  document.querySelectorAll('.dpreset').forEach(e=>e.addEventListener('click',()=>{dMin=+e.dataset.a;dMax=+e.dataset.b;
    document.getElementById('d-de').value=Math.max(MINYM_DRE,dMin===200001?MINYM_DRE:dMin);document.getElementById('d-ate').value=Math.min(MAXYM_DRE,dMax===300000?MAXYM_DRE:dMax);drawDre();}));
  document.getElementById('d-apply').addEventListener('click',()=>{let a=+document.getElementById('d-de').value,b=+document.getElementById('d-ate').value;if(a>b){const t=a;a=b;b=t;}dMin=a;dMax=b;drawDre();});
  document.getElementById('d-de').value=dMin;document.getElementById('d-ate').value=dMax;
}

/* ---- DRE — dashboard mensal (independente do filtro/entidade acima) ---- */
let dreSnapEmp='CONSOLIDADO', dreSnapYm=null;
function initDreSnap(){
  const selMes=document.getElementById('dresnap-mes'), selEmp=document.getElementById('dresnap-emp');
  if(!selMes||!selEmp) return;
  const anoAtual=Math.floor(MAXYM_DRE/100), mesAtual=MAXYM_DRE%100;
  const yms=[]; for(let m=1;m<=mesAtual;m++) yms.push(anoAtual*100+m);
  selMes.innerHTML=yms.map(y=>`<option value="${y}">${ymLab(y)}</option>`).join('');
  dreSnapYm=MAXYM_DRE; selMes.value=dreSnapYm;
  selEmp.value=dreSnapEmp;
  selEmp.addEventListener('change',()=>{dreSnapEmp=selEmp.value; drawDreSnap();});
  selMes.addEventListener('change',()=>{dreSnapYm=+selMes.value; drawDreSnap();});
  drawDreSnap();
}
/* Variação percentual entre duas células da DRE.

   Duas armadilhas tratadas aqui:
   1) linhas de custo vêm negativas, então "cur/prev-1" negativo significa custo MENOR — bom.
      A regra que vale para toda a DRE é `cur > prev` = melhorou (custo menos negativo, ou
      resultado maior), e é ela que decide a cor, independente do sinal exibido.
   2) quando o valor troca de sinal (EBITDA que era positivo e virou negativo), a razão entre
      os dois não tem leitura possível — devolve "—" em vez de um percentual sem sentido. */
function dreVar(cur,prev){
  const mudo=v=>`<span style="color:${MUT}">—</span>`;
  if(cur==null||prev==null||!isFinite(cur)||!isFinite(prev)||prev===0) return mudo();
  if((cur<0)!==(prev<0)) return `<span style="color:${MUT}" title="Mudança de sinal entre os períodos — variação percentual não comparável">—</span>`;
  const bom=cur>prev;
  return `<span style="color:${bom?GOOD:BAD};font-weight:600" title="${bom?'melhorou':'piorou'}">${spct(cur/prev-1)}</span>`;
}
function drawDreSnap(){
  const box=document.getElementById('dresnap-body'); if(!box||!dreSnapYm) return;
  const ym=dreSnapYm, ymPrev=ymShift(ym,-1), ano=Math.floor(ym/100);
  const gM=dreAgg(dreSnapEmp,ym,ym), gMPrev=dreAgg(dreSnapEmp,ymPrev,ymPrev);
  const gYtd=dreAgg(dreSnapEmp,ano*100+1,ym), gYtdPrev=dreAgg(dreSnapEmp,(ano-1)*100+1,ym-100);
  const cols=[[ymLab(ym),gM],[ymLab(ymPrev),gMPrev],['YTD '+ano,gYtd],['YTD '+(ano-1),gYtdPrev]];
  const entName={CONSOLIDADO:'Consolidado',FABRICA:'Fábrica',DESIGN:'Loja'}[dreSnapEmp];
  let s=H3('Demonstração de resultado — comparativo',entName,'dre-snap');
  const headers=['Linha',cols[0][0],cols[1][0],'Var. mês',cols[2][0],cols[3][0],'Var. YTD'];
  const aligns=['left','right','right','right','right','right','right'];
  const rows=DRE_LINES.map(l=>{
    const st=l[2]==='t'?'font-weight:700':(l[2]==='h'?'font-weight:600':'');
    const val=i=>cols[i][1][l[0]];
    const cel=v=>v<0?`<span style="color:${BAD}">${money(v)}</span>`:money(v);
    return [`<span style="${st}">${esc(l[1])}</span>`,
      cel(val(0)),cel(val(1)),dreVar(val(0),val(1)),
      cel(val(2)),cel(val(3)),dreVar(val(2),val(3))];
  });
  box.innerHTML=s+table(headers,rows,aligns,null,
    ins('dreComparativoMotor',{cols:cols,linhas:DRE_LINES})
    ||ins('dreLinhaQueMudou',{cols:cols,linhas:DRE_LINES})
    ||ins('auto',{itens:DRE_LINES.filter(l=>cols[0][1][l[0]]).map(l=>({name:l[1],v:Math.abs(cols[0][1][l[0]]),q:Math.abs(cols[1][1][l[0]]||0)})),
        escopo:'linha',escopoPl:'linhas do resultado',universo:'do resultado do mês',
        id:'dre-comparativo',tabela:true,preferir:['divergencia','estrutura']}))
    +cap('A variação mostra quanto a própria linha mudou. A <b>cor</b> segue o efeito no resultado, não o sinal do número: '
      +'verde quando melhorou, vermelho quando piorou. Numa linha de custo isso se inverte — deduções caindo aparecem em '
      +'verde com percentual negativo. Onde o valor trocou de sinal entre os dois períodos, a variação percentual não é '
      +'comparável e sai como “—”.');
}
function drawCustoFixo(){ document.getElementById('cf-body').innerHTML=renderCustoFixoBody(cfEnt)+renderCustoFixoEntidade();
  document.querySelectorAll('.cfb').forEach(e=>e.classList.toggle('on',e.dataset.e===cfEnt));
  remount('custofixo'); }
function initCustoFixo(){ document.querySelectorAll('.cfb').forEach(e=>e.addEventListener('click',()=>{cfEnt=e.dataset.e;drawCustoFixo();})); }

/* ---- Custo fixo mensal (razão contábil, _BD2024) ---- */
const PACOTES_CF=['PESSOAL','FACILITIES','CONSUMO','MARKETING','TERCEIROS','OUTROS'];
let cfmEmp='CONSOLIDADO', cfmYm=null, cfmPacSel=null, cfmDim='t';
/* dimensões de detalhe disponíveis; a linha de CFMENSAL carrega o índice das duas */
const CFM_DIMS={t:{pos:3,lista:'terceiros',rotulo:'Terceiro',titulo:'terceiro'},
                c:{pos:4,lista:'contas',   rotulo:'Conta contábil',titulo:'conta contábil'}};
function cfmYmPrev(ym){ let y=Math.floor(ym/100),m=ym%100-1; if(m<1){m=12;y--;} return y*100+m; }
function cfmAgg(empresa,ym,dim){
  const C=window.CFMENSAL, emps=empresa==='CONSOLIDADO'?['FABRICA','LOJA']:[empresa];
  const D=CFM_DIMS[dim||cfmDim], nomes=C[D.lista]||[];
  const porPacote={}, porPacoteDim={};
  for(const row of C.rows){
    const emp=row[0], y=row[1], pac=row[2], v=row[row.length-1];
    if(y!==ym||!emps.includes(emp)) continue;
    porPacote[pac]=(porPacote[pac]||0)+v;
    const m=porPacoteDim[pac]||(porPacoteDim[pac]={});
    const nome=nomes[row[D.pos]]; m[nome]=(m[nome]||0)+v;
  }
  return {porPacote,porPacoteDim};
}
function initCustoFixoMensal(){
  const box=document.getElementById('cfm-body'); if(!box) return;
  if(!window.CFMENSAL){ box.innerHTML=call('Razão contábil (_BD2024) não encontrada no Painel de Resultado. Seção não gerada.','warn'); return; }
  const C=window.CFMENSAL; if(!C.yms.length){ box.innerHTML=call('Sem lançamentos de custo fixo na base.','warn'); return; }
  const sel=document.getElementById('cfm-mes');
  const cfmAnos=[...new Set(C.yms.map(y=>Math.floor(y/100)))];
  sel.innerHTML=cfmAnos.map(a=>`<option value="Y${a}">${a}</option>`).join('')
    +C.yms.map(y=>`<option value="${y}">${ymLab(y)}</option>`).join('');
  cfmYm=C.yms[C.yms.length-1]; sel.value=cfmYm;
  document.getElementById('cfm-emp').value=cfmEmp;
  document.getElementById('cfm-emp').addEventListener('change',e=>{cfmEmp=e.target.value; cfmPacSel=null; drawCustoFixoMensal();});
  sel.addEventListener('change',e=>{const v=e.target.value; cfmYm=(v[0]==='Y')?v:+v; cfmPacSel=null; drawCustoFixoMensal();});
  const selDim=document.getElementById('cfm-dim');
  if(selDim){ selDim.value=cfmDim;
    // trocar a dimensão mantém o pacote aberto — é a mesma pergunta vista por outro ângulo,
    // ao contrário de trocar empresa/mês, que muda o recorte e limpa a seleção
    selDim.addEventListener('change',e=>{cfmDim=e.target.value; drawCustoFixoMensal();}); }
  drawCustoFixoMensal();
}
function drawCustoFixoMensal(){
  const box=document.getElementById('cfm-body'); if(!box||!window.CFMENSAL||!cfmYm) return;
  if(typeof cfmYm==='string'&&cfmYm[0]==='Y'){ drawCustoFixoMensalAno(+cfmYm.slice(1)); return; }
  const ymPrev=cfmYmPrev(cfmYm);
  const cur=cfmAgg(cfmEmp,cfmYm,cfmDim), prev=cfmAgg(cfmEmp,ymPrev,cfmDim);
  const rows=PACOTES_CF.map(p=>{const v=cur.porPacote[p]||0,pv=prev.porPacote[p]||0; return [p,v,pv,v-pv];});
  const totCur=rows.reduce((a,r)=>a+r[1],0), totPrev=rows.reduce((a,r)=>a+r[2],0);
  const entName={CONSOLIDADO:'Consolidado',FABRICA:'Fábrica',LOJA:'Loja'}[cfmEmp];
  let s=H3('Pacotes — '+entName+' · '+ymLab(cfmYm),'vs. '+ymLab(ymPrev),'cfm-pacotes');
  s+='<div class="tw"><table class="dt"><thead><tr><th class="left">Pacote</th><th class="right">'+ymLab(cfmYm)+'</th><th class="right">'+ymLab(ymPrev)+'</th><th class="right">Variação</th></tr></thead><tbody>'
   +rows.map(r=>`<tr class="cfm-pac-row" data-p="${esc(r[0])}"><td class="left">${esc(r[0])}</td><td class="right">${money(r[1])}</td><td class="right">${money(r[2])}</td><td class="right">${deltaCost(r[2]?r[3]/r[2]:null)} ${money(r[3])}</td></tr>`).join('')
   +'</tbody><tfoot><tr><td class="left">Total</td><td class="right">'+money(totCur)+'</td><td class="right">'+money(totPrev)+'</td><td class="right">'+money(totCur-totPrev)+'</td></tr></tfoot></table></div>';
  s+=cap('Clique num pacote para ver a composição por '+CFM_DIMS[cfmDim].titulo+'.');
  s+='<div class="tw-ins">'+(window.INSRT?INSRT.strip(
      ins('cfPacoteVariacao',{rows:rows,labAtual:ymLab(cfmYm),labPrev:ymLab(ymPrev),dim:cfmDim})
      ||ins('auto',{itens:rows.map(r=>({name:r[0],v:r[1]})),escopo:'pacote',escopoPl:'pacotes',
          universo:'do custo fixo do mês',id:'cfm-pacotes',tabela:true,preferir:['estrutura','cauda']})):'')+'</div>';
  s+='<div id="cfm-terceiro-body"></div>';
  box.innerHTML=s;
  box.querySelectorAll('.cfm-pac-row').forEach(tr=>{ tr.style.cursor='pointer';
    if(tr.dataset.p===cfmPacSel) tr.style.background='rgba(146,112,93,.12)';
    tr.addEventListener('click',()=>{ cfmPacSel=(cfmPacSel===tr.dataset.p?null:tr.dataset.p); drawCustoFixoMensal(); });});
  if(cfmPacSel) drawCfmDetalhe(cur,prev,cfmPacSel);
}
function drawCfmDetalhe(cur,prev,pac){
  const box=document.getElementById('cfm-terceiro-body'); if(!box) return;
  const D=CFM_DIMS[cfmDim];
  const curT=cur.porPacoteDim[pac]||{}, prevT=prev.porPacoteDim[pac]||{};
  const names=new Set([...Object.keys(curT),...Object.keys(prevT)]);
  const rows=[...names].map(n=>[n,curT[n]||0,prevT[n]||0]).sort((a,b)=>(b[1]-b[2])-(a[1]-a[2]));
  const tot=rows.reduce((a,r)=>[0,a[1]+r[1],a[2]+r[2]],[0,0,0]);
  box.innerHTML=H3('Composição por '+D.titulo+' — '+pac, nf(rows.length)+(rows.length===1?' item':' itens'))
    +table([D.rotulo,'Mês atual','Mês anterior','Variação'],
        rows.map(r=>[esc(trunc(r[0],40)),money(r[1]),money(r[2]),money(r[1]-r[2])]),
        ['left','right','right','right'],
        ['Total',money(tot[1]),money(tot[2]),money(tot[1]-tot[2])]);
}
/* agregação anual: mesmos pacotes, mas aberto mês a mês na coluna (evolutivo), com
   Total e % do ano no final — usada pela opção "202X" do seletor de mês. */
function cfmAggAno(empresa,ano,dim){
  const C=window.CFMENSAL, emps=empresa==='CONSOLIDADO'?['FABRICA','LOJA']:[empresa];
  const D=CFM_DIMS[dim||cfmDim], nomes=C[D.lista]||[];
  const anoYms=C.yms.filter(y=>Math.floor(y/100)===ano);
  const porPacoteMes={}, porPacoteDimMes={};
  for(const row of C.rows){
    const emp=row[0], y=row[1], pac=row[2], v=row[row.length-1];
    if(Math.floor(y/100)!==ano||!emps.includes(emp)) continue;
    const pm=porPacoteMes[pac]||(porPacoteMes[pac]={}); pm[y]=(pm[y]||0)+v;
    const nome=nomes[row[D.pos]];
    const pd=porPacoteDimMes[pac]||(porPacoteDimMes[pac]={});
    const nd=pd[nome]||(pd[nome]={}); nd[y]=(nd[y]||0)+v;
  }
  return {anoYms,porPacoteMes,porPacoteDimMes};
}
function drawCustoFixoMensalAno(ano){
  const box=document.getElementById('cfm-body'); if(!box) return;
  const {anoYms,porPacoteMes}=cfmAggAno(cfmEmp,ano,cfmDim);
  const entName={CONSOLIDADO:'Consolidado',FABRICA:'Fábrica',LOJA:'Loja'}[cfmEmp];
  const rows=PACOTES_CF.map(p=>{const mesesV=anoYms.map(y=>(porPacoteMes[p]||{})[y]||0);
    return {p,mesesV,tot:mesesV.reduce((a,v)=>a+v,0)};});
  const totGeral=rows.reduce((a,r)=>a+r.tot,0);
  let s=H3('Pacotes — '+entName+' · '+ano+' (evolutivo)','','cfm-pacotes');
  s+='<div class="tw"><table class="dt"><thead><tr><th class="left">Pacote</th>'
   +anoYms.map(y=>`<th class="right">${ymLab(y)}</th>`).join('')
   +'<th class="right">Total</th><th class="right">% do ano</th></tr></thead><tbody>'
   +rows.map(r=>`<tr class="cfm-pac-row" data-p="${esc(r.p)}"><td class="left">${esc(r.p)}</td>`
     +r.mesesV.map(v=>`<td class="right">${money(v)}</td>`).join('')
     +`<td class="right">${money(r.tot)}</td><td class="right">${pct(totGeral?r.tot/totGeral:0,1)}</td></tr>`).join('')
   +'</tbody><tfoot><tr><td class="left">Total</td>'
   +anoYms.map((y,i)=>`<td class="right">${money(rows.reduce((a,r)=>a+r.mesesV[i],0))}</td>`).join('')
   +`<td class="right">${money(totGeral)}</td><td class="right">100,0%</td></tr></tfoot></table></div>`;
  s+=cap('Clique num pacote para ver a composição por '+CFM_DIMS[cfmDim].titulo+', mês a mês em '+ano+'.');
  s+='<div id="cfm-terceiro-body"></div>';
  box.innerHTML=s;
  box.querySelectorAll('.cfm-pac-row').forEach(tr=>{ tr.style.cursor='pointer';
    if(tr.dataset.p===cfmPacSel) tr.style.background='rgba(146,112,93,.12)';
    tr.addEventListener('click',()=>{ cfmPacSel=(cfmPacSel===tr.dataset.p?null:tr.dataset.p); drawCustoFixoMensal(); });});
  if(cfmPacSel) drawCfmDetalheAno(ano,cfmPacSel);
}
function drawCfmDetalheAno(ano,pac){
  const box=document.getElementById('cfm-terceiro-body'); if(!box) return;
  const D=CFM_DIMS[cfmDim];
  const {anoYms,porPacoteDimMes}=cfmAggAno(cfmEmp,ano,cfmDim);
  const dimData=porPacoteDimMes[pac]||{};
  const rows=Object.keys(dimData).map(n=>{const mesesV=anoYms.map(y=>dimData[n][y]||0);
    return {n,mesesV,tot:mesesV.reduce((a,v)=>a+v,0)};}).sort((a,b)=>b.tot-a.tot);
  const totPac=rows.reduce((a,r)=>a+r.tot,0);
  let acc=0;
  const rowsAcc=rows.map(r=>{const pctPac=totPac?r.tot/totPac:0; acc+=pctPac; return {...r,pctPac,pctAcum:acc};});
  let s=H3('Composição por '+D.titulo+' — '+pac+' · '+ano, nf(rows.length)+(rows.length===1?' item':' itens'));
  s+='<div class="tw"><table class="dt"><thead><tr><th class="left">'+D.rotulo+'</th>'
   +anoYms.map(y=>`<th class="right">${ymLab(y)}</th>`).join('')
   +'<th class="right">Total</th><th class="right">% do pacote</th><th class="right">% acum.</th></tr></thead><tbody>'
   +rowsAcc.map(r=>`<tr><td class="left">${esc(trunc(r.n,40))}</td>`
     +r.mesesV.map(v=>`<td class="right">${money(v)}</td>`).join('')
     +`<td class="right">${money(r.tot)}</td><td class="right">${pct(r.pctPac,1)}</td><td class="right">${pct(r.pctAcum,1)}</td></tr>`).join('')
   +'</tbody><tfoot><tr><td class="left">Total</td>'
   +anoYms.map((y,i)=>`<td class="right">${money(rows.reduce((a,r)=>a+r.mesesV[i],0))}</td>`).join('')
   +`<td class="right">${money(totPac)}</td><td class="right">100,0%</td><td class="right">100,0%</td></tr></tfoot></table></div>`;
  box.innerHTML=s;
}

/* janela exibida do custo fixo por categoria: primeiro e último mês que o blob CF traz */
function _cfJanela(){ const m=(window.CF&&CF.meses)||[]; return m.length?(m[0]+'–'+m[m.length-1]).toLowerCase():''; }

/* ---- Dívida e endividamento (consolidado) ---- */
function renderDivida(){
  const E=DPNL.CONSOLIDADO; const yms=[],endv=[],jur=[];
  /* janela: ano fechado anterior + ano corrente da DRE, até o último mês real */
  const D1=ANO_D, D0=ANO_D-1;
  [D0,D1].forEach(y=>{const yr=String(y); if(!E[yr])return; for(let m=0;m<12;m++){ if(y===D1&&m>(MAXYM_DRE%100)-1)break;
    yms.push(y*100+m+1); endv.push((E[yr].endividamento&&E[yr].endividamento[m])||0); jur.push((E[yr].juros_passivos&&E[yr].juros_passivos[m])||0);}});
  const ger=endv.map(v=>-v);            // geração de endividamento (positivo = gera dívida)
  let acc=0; const cum=ger.map(v=>{acc+=v;return acc;});
  const jurAbs=jur.map(v=>Math.abs(v));
  const g25=dreAgg('CONSOLIDADO',D0*100+1,D0*100+12), g26=dreAgg('CONSOLIDADO',D1*100+1,MAXYM_DRE);
  const j23=dreAgg('CONSOLIDADO',(D0-2)*100+1,(D0-2)*100+12), j24=dreAgg('CONSOLIDADO',(D0-1)*100+1,(D0-1)*100+12);
  const ano26lab=D1+' ('+ytdLab(MAXYM_DRE)+')';
  const AP=window.APORTES;
  let s=`<div class="sec-head"><div class="kick">Estrutura financeira</div><h2>Dívida e fluxo de endividamento</h2>
   <p class="lead">Saldo real da dívida com o acionista${AP?' (corrigido por 100% do CDI)':''}, e a leitura de geração de endividamento e custo financeiro a partir da DRE. Geração de endividamento = (Venda Líquida × margem equalizada) − Custo Fixo; valores positivos indicam consumo de caixa financiado por dívida.</p></div>`;
  if(AP){
    s+='<div class="kpis">'
     +kpi('Saldo atual da dívida',mi(AP.saldo_atual),ymLab(AP.yms[AP.yms.length-1])+' · aporte + correção','warn')
     +kpi('Aporte líquido acumulado',mi(AP.aporte[AP.aporte.length-1]),'total aportado '+mi(AP.total_remessas)+' − devolvido '+mi(Math.abs(AP.total_recebimentos)))
     +kpi('Correção/juros acumulados',mi(AP.total_correcao),'100% CDI, desde '+ymLab(AP.yms[0]),'warn')
     +kpi('% do saldo que é correção',pct(AP.total_correcao/AP.saldo_atual,0),'sobre o saldo atual','warn')
     +'</div>';
    s+=H3('Saldo da dívida com o acionista','área empilhada — aporte líquido acumulado + correção (100% CDI) acumulada','dv-saldo');
    s+=fig(stackedArea(AP.yms.map(ymLab),[
      {name:'Aporte líquido acumulado',values:AP.aporte,color:SER[0]},
      {name:'Correção/juros acumulados',values:AP.correcao,color:WARN},
    ],{valfmt:v=>mi(v,1)}),
    ins('dividaCorrecao'));
    s+=cap('O saldo cresce majoritariamente por correção monetária, não por novos aportes: '+mi(AP.total_remessas)+' aportados historicamente (com '+mi(Math.abs(AP.total_recebimentos))+' devolvidos) já viraram '+mi(AP.saldo_atual)+' corrigidos — '+mi(AP.total_correcao)+' de juros/correção acumulados ('+pct(AP.total_correcao/AP.saldo_atual,0)+' do saldo atual).');

    /* ---- evolutivo ano a ano ----
       APORTES traz aporte/correcao ACUMULADOS e remessas/recebimentos do MES, entao o ano a ano
       sai daqui mesmo, sem nada novo no gerador. Usa-se aporte LIQUIDO (remessas + recebimentos,
       que ja vem negativo) e nao remessas brutas: e o que faz `liquido + correcao` fechar
       exatamente com o degrau do saldo, mantendo as barras reconciliadas com a area. */
    const ultIdx={}, mesesAno={};
    AP.yms.forEach((y,i)=>{const a=Math.floor(y/100); ultIdx[a]=i; mesesAno[a]=(mesesAno[a]||0)+1;});
    const anos=Object.keys(ultIdx).map(Number).sort((x,y)=>x-y);
    let saldoAnt=0, corAnt=0;
    const anoRows=anos.map(a=>{
      const li=ultIdx[a], saldo=AP.aporte[li]+AP.correcao[li], cor=AP.correcao[li]-corAnt;
      let rem=0, rec=0;
      AP.yms.forEach((y,i)=>{ if(Math.floor(y/100)!==a) return; rem+=AP.remessas[i]; rec+=AP.recebimentos[i]; });
      const ini=saldoAnt, liq=rem+rec;
      const o={ano:a,meses:mesesAno[a],ini,rem,rec,liq,cor,saldo};
      saldoAnt=saldo; corAnt=AP.correcao[li];
      return o;});
    const rotAno=o=>o.meses===12?String(o.ano):o.ano+' ('+o.meses+'m)';
    const virada=anoRows.find(o=>o.cor>o.liq), ult=anoRows[anoRows.length-1];
    s+=H3('Evolução ano a ano','quanto do crescimento foi dinheiro novo e quanto foi correção','dv-ano');
    s+=fig(evolCombo(anoRows.map(rotAno),[
      {name:'Aporte líquido',values:anoRows.map(o=>o.liq),color:SER[0]},
      {name:'Correção do ano',values:anoRows.map(o=>o.cor),color:WARN}],
      anoRows.map(o=>o.saldo),{valfmt:v=>mi(v,1)}),
      ins('dividaJuroAno',{anos:anoRows}));
    s+=table(['Ano','Saldo inicial','Aporte novo','Devolvido','Correção do ano','Saldo final'],
      anoRows.map(o=>[rotAno(o),money(o.ini),money(o.rem),o.rec?money(o.rec):'—',
        `<span style="color:${WARN};font-weight:600">${money(o.cor)}</span>`,money(o.saldo)]),
      ['left','right','right','right','right','right'],
      ['Total','—',money(AP.total_remessas),money(AP.total_recebimentos),money(AP.total_correcao),money(AP.saldo_atual)],
      ins('auto',{itens:anoRows.map(o=>({name:rotAno(o),v:o.cor,q:o.liq})),escopo:'ano',escopoPl:'anos',
        universo:'da correção da dívida',id:'divida-anos',tabela:true,preferir:['relacao','cauda']}));
    s+=cap('Aporte líquido = remessas menos devoluções; somado à correção, é exatamente a variação do saldo no ano — por isso as barras fecham com o degrau da área.');
    if(virada) s+=call('<b>'+virada.ano+' foi o ano em que a dívida passou a crescer mais por juro do que por dinheiro novo</b> — '
      +mi(virada.cor)+' de correção contra '+mi(virada.liq)+' de aporte líquido. O aporte caiu de '
      +mi(Math.max(...anoRows.map(o=>o.liq)))+' no pico para '+mi(ult.liq)+' em '+rotAno(ult)
      +', enquanto a correção seguiu subindo.','warn');
  }
  s+='<div class="kpis">'
   +kpi('Endividamento gerado · '+D0,mi(-g25.endividamento),'no ano','warn')
   +kpi('Endividamento gerado · '+D1,mi(-g26.endividamento),ytdLab(MAXYM_DRE),'warn')
   +kpi('Endividamento acum. (desde '+ymLab(D0*100+1).toLowerCase()+')',mi(cum[cum.length-1]),'geração acumulada','warn')
   +kpi('Juros passivos a terceiros · '+D0,mi(Math.abs(g25.juros_passivos)),'custo da dívida','warn')
   +'</div>';
  s+=H3('Endividamento gerado — acumulado desde '+ymLabAno(D0*100+1),'','dv-endiv');
  s+=fig(line([['Endividamento acumulado',cum,SER[7]]],yms.map(ymLab),{valfmt:v=>mi(v,1),w:980,h:290}),
    ins('serieOscilacao',{labels:yms.map(ymLab),vals:cum,id:'endiv-acum'})
    ||ins('auto',{itens:yms.map((y,i)=>({name:ymLab(y),v:Math.abs(cum[i]||0)})),escopo:'mês',
        escopoPl:'meses',universo:'do endividamento acumulado',id:'endiv-acum',
        preferir:['cauda','estrutura']}));
  s+=cap('Acumulado da geração mensal de endividamento (consumo de caixa coberto por dívida) — proxy extraída da DRE, não é o saldo real da dívida'+(AP?' (esse já aparece acima, a partir do saldo diário do acionista)':' com o acionista')+'.');
  s+=H3('Custo financeiro — juros passivos a terceiros','','dv-juros');
  s+=fig(line([['Juros passivos a terceiros (mês)',jurAbs,SER[1]]],yms.map(ymLab),{valfmt:v=>mi(v,1),w:980,h:270}),
    ins('serieOscilacao',{labels:yms.map(ymLab),vals:jurAbs,id:'juros-terceiros'})
    ||ins('auto',{itens:yms.map((y,i)=>({name:ymLab(y),v:jurAbs[i]||0})),escopo:'mês',
        escopoPl:'meses',universo:'dos juros pagos a bancos',id:'juros-terceiros',
        preferir:['cauda','estrutura']}));
  let apPorAno={}; if(AP){ const correcaoFimAno={};
    AP.yms.forEach((y,i)=>{ const ano=Math.floor(y/100);
      correcaoFimAno[ano]=AP.correcao[i];
      const o=apPorAno[ano]||(apPorAno[ano]={aporte:0}); o.aporte+=AP.remessas[i]+AP.recebimentos[i]; });
    Object.keys(correcaoFimAno).forEach(ano=>{ apPorAno[ano]=apPorAno[ano]||{aporte:0};
      apPorAno[ano].correcao=correcaoFimAno[ano]-(correcaoFimAno[+ano-1]||0); });
  }
  const apCell=(ano,key)=>{ if(!AP||!apPorAno[ano]) return '<span class="mut">—</span>';
    const v=apPorAno[ano][key]; return v?money(v):'<span class="mut">—</span>'; };
  s+=table(['Ano','Juros passivos a terceiros','Endividamento gerado','Aporte no ano (acionista)','Correção/juros no ano (acionista)'],[
     [String(D0-2),`<span style="color:${BAD}">${money(Math.abs(j23.juros_passivos))}</span>`,'<span class="mut">—</span>',apCell(D0-2,'aporte'),apCell(D0-2,'correcao')],
     [String(D0-1),`<span style="color:${BAD}">${money(Math.abs(j24.juros_passivos))}</span>`,'<span class="mut">—</span>',apCell(D0-1,'aporte'),apCell(D0-1,'correcao')],
     [String(D0),`<span style="color:${BAD}">${money(Math.abs(g25.juros_passivos))}</span>`,`<span style="color:${BAD}">${money(-g25.endividamento)}</span>`,apCell(D0,'aporte'),apCell(D0,'correcao')],
     [ano26lab,`<span style="color:${BAD}">${money(Math.abs(g26.juros_passivos))}</span>`,`<span style="color:${BAD}">${money(-g26.endividamento)}</span>`,apCell(D1,'aporte'),apCell(D1,'correcao')],
   ],['left','right','right','right','right']);
  s+=H3('Geração de endividamento mês a mês',D0+'–'+D1,'dv-geracao');
  s+=table(['Mês','Endividamento gerado','Endividamento acumulado','Juros passivos'],
    yms.map((ym,i)=>[ymLab(ym),
      (ger[i]>=0?`<span style="color:${BAD}">${money(ger[i])}</span>`:`<span style="color:${GOOD}">${money(ger[i])}</span>`),
      money(cum[i]), money(jurAbs[i])]),
    ['left','right','right','right'],null,
    ins('auto',{itens:yms.map((y,i)=>({name:ymLab(y),v:Math.abs(ger[i]||0),q:jurAbs[i]||0})),
      escopo:'mês',escopoPl:'meses',universo:'do endividamento gerado',
      id:'endiv-mes',tabela:true,preferir:['relacao','cauda']}));
  const jA=Math.abs(j24.juros_passivos), jB=Math.abs(g25.juros_passivos);
  const verboJuros=jB>jA*1.2?'saltou':(jB>=jA?'subiu':'caiu');
  s+=call('O custo financeiro (juros a terceiros) '+verboJuros+' de '+mi(jA)+' em '+(D0-1)+' para '+mi(jB)+' em '+D0+(jB>=jA?' — é o principal vetor do resultado líquido negativo':'')+'. A geração de endividamento operacional (consumo de caixa) somou '+mi(-g25.endividamento)+' em '+D0+' e '+mi(-g26.endividamento)+' em '+ano26lab+'.','warn');
  s+='<div class="sources"><b>Nota:</b> '+(AP?'saldo da Dívida com o Acionista extraído do razão diário (Aportes.xlsx), já corrigido por 100% do CDI.':'saldo da Dívida com o Acionista (corrigido por 100% do CDI) não encontrado nesta geração — consta apenas na apresentação de resultados como material específico.')+' Geração de endividamento e custo financeiro extraídos da DRE.</div>';
  return s;
}
