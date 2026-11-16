/* Original mathematical figure. © 2026 qgdr; project noncommercial license. */
(()=>{'use strict';
const $=id=>document.getElementById(id),
  colors={a:'#138a78',b:'#3a6fa8',c:'#b3622b',ink:'#223b3e',muted:'#6c7b76',ball:'#7a66a0'},
  state={step:4,mode:'strict',gap:.8,thetaA:-32,thetaB:146},S=39,Y=111;
const fmt=x=>Math.abs(x)<1e-9?'0':Number(x.toFixed(2)).toString();
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const line=(x1,y1,x2,y2,attrs='')=>`<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" ${attrs}/>`;
const text=(x,y,t,attrs='')=>`<text x="${x}" y="${y}" ${attrs}>${esc(t)}</text>`;
function model(){
  const d=1+state.gap/2,ta=state.thetaA*Math.PI/180,tb=state.thetaB*Math.PI/180;
  const a=[-d+.74*Math.cos(ta),.74*Math.sin(ta)],b=[d+.68*Math.cos(tb),.68*Math.sin(tb)],z=[a[0]-b[0],a[1]-b[1]];
  return {d,a,b,z,A:{center:[-d,0],radius:1,open:state.mode==='ordinary'},
    B:{center:[d,0],radius:1,open:false},C:{center:[-2*d,0],radius:2,open:state.mode==='ordinary'},
    fA:[-d-1,-d+1],fB:[d-1,d+1],fC:[-2*d-2,-2*d+2],
    epsilon:state.gap/2,r:state.gap,alpha:0,uniformGap:state.gap>0,
    f_a:a[0],f_b:b[0],f_z:z[0]};
}
function axes(ox,original=true){
  let s=line(22,Y,480,Y,'class="axis"')+line(ox,18,ox,198,'class="axis"');
  s+=text(477,Y-8,'x₁','text-anchor="end" class="axis-label"')+text(ox+8,23,'x₂','class="axis-label"');
  s+=text(ox+5,Y+15,'0','class="axis-label"');
  for(const x of (original?[-3,-2,-1,1,2,3]:[-8,-6,-4,-2])){
    const px=ox+S*x;if(px>24&&px<475)s+=line(px,Y-3,px,Y+3,'stroke="#aebbb5"')+text(px,Y+16,String(x),'text-anchor="middle" class="axis-label"');
  }
  return s;
}
function disk(ox,c,r,color,open,label){
  const cx=ox+S*c[0],cy=Y-S*c[1];
  return `<circle cx="${cx}" cy="${cy}" r="${S*r}" fill="${color}" fill-opacity=".12" stroke="${color}" stroke-width="2"${open?' stroke-dasharray="6 4"':''}/>`+
    text(cx,cy-S*r-8,label,`class="set-label" text-anchor="middle" style="fill:${color}"`);
}
function point(ox,p,label,color,dx=8,dy=-9){
  const x=ox+S*p[0],y=Y-S*p[1];return `<circle cx="${x}" cy="${y}" r="4.5" fill="${color}" stroke="#faf8f2" stroke-width="1.3"/>`+text(x+dx,y+dy,label,`class="point-label" text-anchor="${dx<0?'end':'start'}" style="fill:${color}"`);
}
function interval(ox,range,y,color,open,label,side=0){
  const l=ox+S*range[0],r=ox+S*range[1];
  let s=line(22,y,480,y,'stroke="#d7ded7" stroke-width="1"');
  s+=line(l,y,r,y,`stroke="${color}" stroke-width="6" stroke-linecap="round" opacity=".7"`);
  for(const x of [l,r])s+=`<circle cx="${x}" cy="${y}" r="4.2" fill="${open?'#faf8f2':color}" stroke="${color}" stroke-width="1.8"/>`;
  const tx=side<0?l-5:side>0?r+5:(l+r)/2;
  s+=text(tx,y-9,label,`class="projection-label" text-anchor="${side<0?'end':side>0?'start':'middle'}" style="fill:${color}"`);
  return s;
}
function arrow(x1,y1,x2,y2,color){
  const dx=x2-x1,dy=y2-y1,len=Math.hypot(dx,dy);if(len<1e-6)return '';
  const ux=dx/len,uy=dy/len,ex=x2-5*ux,ey=y2-5*uy;
  return line(x1,y1,ex,ey,`stroke="${color}" stroke-width="1.7" opacity=".9"`)+`<path d="M ${x2} ${y2} L ${ex-3.2*uy-2*ux} ${ey+3.2*ux-2*uy} L ${ex+3.2*uy-2*ux} ${ey-3.2*ux-2*uy} Z" fill="${color}"/>`;
}
function original(m){
  const ox=250;let s=axes(ox)+disk(ox,m.A.center,1,colors.a,m.A.open,'A')+disk(ox,m.B.center,1,colors.b,false,'B');
  if(state.step>=4){
    s+=line(ox,16,ox,199,`stroke="${colors.ink}" stroke-width="2" stroke-dasharray="5 4"`)+text(ox+11,35,'f = α = 0','class="tiny"');
    if(state.gap>0){
      const left=ox-S*state.gap/2,right=ox+S*state.gap/2;
      s+=`<rect x="${left}" y="40" width="${right-left}" height="145" fill="${colors.a}" fill-opacity=".05"/>`;
    }
  }
  if(state.step>=2)s+=arrow(ox+S*m.b[0],Y-S*m.b[1],ox+S*m.a[0],Y-S*m.a[1],colors.c);
  s+=point(ox,m.a,'a',colors.a,7,13)+point(ox,m.b,'b',colors.b,7,-8);
  if(state.step>=3){
    const py=237;
    s+=interval(ox,m.fA,py,colors.a,m.A.open,'f(A)')+interval(ox,m.fB,py,colors.b,false,'f(B)');
    for(const [p,color] of [[m.a,colors.a],[m.b,colors.b]]){
      const px=ox+S*p[0];s+=line(px,Y-S*p[1]+5,px,py-5,`stroke="${color}" stroke-dasharray="3 4" opacity=".55"`)+`<circle cx="${px}" cy="${py}" r="3" fill="${color}"/>`;
    }
    s+=text(ox,265,state.gap===0?'sup f(A) = inf f(B) = 0':`sup f(A) = −${fmt(state.gap/2)}   ·   inf f(B) = ${fmt(state.gap/2)}`,'text-anchor="middle" class="tiny"');
    if(state.step>=4)s+=line(ox,219,ox,246,`stroke="${colors.ink}" stroke-width="1.5"`)+text(ox,216,'α','text-anchor="middle" class="tiny"');
  }else s+=text(250,251,state.step===1?'两个集合不相交。选择下一步，收集所有差 a − b。':'橙色向量从 b 指向 a，它的坐标正是 a − b。','text-anchor="middle" class="tiny"');
  $('original').innerHTML=s;
}
function difference(m){
  const ox=400;let s=axes(ox,false);
  if(state.step<2){
    s+=text(250,74,'C = { a − b : a ∈ A，b ∈ B }','text-anchor="middle" style="fill:#657876;font-size:15px"')+
      text(250,179,'把左图中的向量平移到原点。','text-anchor="middle" class="tiny"');
  }else{
    s+=disk(ox,m.C.center,2,colors.c,m.C.open,'C');
    if(state.mode==='strict'){
      s+=`<circle cx="${ox}" cy="${Y}" r="${S*m.r}" fill="${colors.ball}" fill-opacity=".08" stroke="${colors.ball}" stroke-dasharray="3 3"/>`;
      const labelX=ox+S*m.r+5;
      s+=text(Math.min(labelX,470),Y-7,'B(0,r)',`class="tiny" text-anchor="${labelX>470?'end':'start'}"`);
    }
    if(state.step>=4)s+=line(ox,18,ox,201,`stroke="${colors.ink}" stroke-width="1.5" stroke-dasharray="5 4"`)+text(ox+8,39,'f = 0','class="tiny"');
    s+=arrow(ox,Y,ox+S*m.z[0],Y-S*m.z[1],colors.c)+point(ox,m.z,'z = a − b',colors.c,-8,-9);
    s+=`<circle cx="${ox}" cy="${Y}" r="4" fill="${colors.ink}" stroke="#faf8f2" stroke-width="1.1"/>`;
    s+=text(ox+8,Y+25,'0 ∉ C','class="tiny"');
  }
  if(state.step>=3){
    const py=237;s+=interval(ox,m.fC,py,colors.c,m.C.open,'f(C)');
    s+=`<circle cx="${ox}" cy="${py}" r="3.3" fill="${colors.ink}"/>`+text(ox+7,py+4,'0','class="tiny"');
    const px=ox+S*m.z[0];s+=line(px,Y-S*m.z[1]+4,px,py-5,`stroke="${colors.c}" stroke-dasharray="3 4" opacity=".55"`)+`<circle cx="${px}" cy="${py}" r="3" fill="${colors.c}"/>`;
    if(state.mode==='strict'){
      const l=ox-S*m.r,r=ox+S*m.r;
      s+=line(l,py,r,py,`stroke="${colors.ball}" stroke-width="4" opacity=".55"`);
      for(const x of [l,r])s+=`<circle cx="${x}" cy="${py}" r="3" fill="#faf8f2" stroke="${colors.ball}" stroke-width="1.2"/>`;
      s+=text(ox,268,'开球投影 (−r,r)，r = δ','text-anchor="middle" class="tiny"');
    }else s+=text(265,265,state.gap===0?'f(C) = (−4,0)：所有点小于 0，但能无限接近 0。':`sup f(C) = −δ = −${fmt(state.gap)}`,'text-anchor="middle" class="tiny"');
  }else if(state.step>=2)s+=text(270,251,'0 ∈ A − B 等价于 A ∩ B 非空；这里 0 ∉ C。','text-anchor="middle" class="tiny"');
  $('difference').innerHTML=s;
}
function render(){
  const m=model();original(m);difference(m);
  $('gap').min=state.mode==='strict'?'0.2':'0';$('gap').value=state.gap;$('gap-value').value=fmt(state.gap);
  document.querySelectorAll('[data-step]').forEach(b=>{b.toggleAttribute('data-active',+b.dataset.step===state.step);if(+b.dataset.step===state.step)b.setAttribute('aria-current','step');else b.removeAttribute('aria-current');});
  document.querySelectorAll('[data-mode]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.mode===state.mode)));
  $('set-types').textContent=state.mode==='ordinary'?'A 开圆盘，B 闭圆盘':'A、B 均为闭圆盘';
  $('difference-type').textContent=state.step<2?'把所有 a − b 收集起来':state.mode==='ordinary'?'C 是开圆盘，边界不属于 C':'C 是闭圆盘，dist(0,C) = δ';
  const notes={1:'先看两个凸集。接下来不逐对比较点，而是把差 a − b 收集成一个集合 C。',2:'同一对选点在两图中同步：左边从 b 指向 a 的向量，右边从原点指向 z = a − b。',3:'泛函 f 只读取第一坐标。f(C) 位于 0 左侧，正是每一对 f(a) < f(b)。',4:'取 α = 0，直线 f = α 把 A、B 放在两侧。左图数轴上的分隔，被放回了原来的平面。'};
  $('stage-note').textContent=notes[state.step];
  $('gap-note').innerHTML=state.gap===0?'<strong>没有统一间隔。</strong> A 不含接触点，所以仍与 B 不相交；但 sup f(A) = inf f(B)。':state.mode==='strict'?`<strong>统一正间隔。</strong> 本例 f(a) ≤ −ε，f(b) ≥ ε，可取 ε = δ/2 = ${fmt(m.epsilon)}。原点与 C 之间的距离为 δ。`:'<strong>本例恰有正间隔。</strong> 它来自这里选定的 δ > 0；第一几何形式本身只保证普通分离。';
  document.documentElement.dataset.figureReady='true';
}
document.querySelectorAll('[data-step]').forEach(b=>b.addEventListener('click',()=>{state.step=+b.dataset.step;render();}));
document.querySelectorAll('[data-mode]').forEach(b=>b.addEventListener('click',()=>{state.mode=b.dataset.mode;if(state.mode==='strict')state.gap=Math.max(.8,state.gap);render();}));
$('gap').addEventListener('input',e=>{state.gap=+e.target.value;render();});
$('theta-a').addEventListener('input',e=>{state.thetaA=+e.target.value;render();});
$('theta-b').addEventListener('input',e=>{state.thetaB=+e.target.value;render();});
window.hbSeparationState=()=>JSON.parse(JSON.stringify({...state,...model()}));
const reportHeight=()=>{if(parent!==window)parent.postMessage({type:'mtree:figure-height',height:document.body.getBoundingClientRect().height+2},'*');};
new ResizeObserver(reportHeight).observe(document.body);
render();
})();
