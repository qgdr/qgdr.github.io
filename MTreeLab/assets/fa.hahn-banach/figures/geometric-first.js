/* Original geometric construction. © 2026 qgdr; project noncommercial license. */
(()=>{'use strict';
const $=id=>document.getElementById(id),svg=$('plane'),canvas=$('surface'),ctx=canvas.getContext('2d');
const colors={ink:'#243e43',muted:'#6b7b7c',line:'#c8d3cd',a:'#188a7a',b:'#527dc2',c:'#bc7636',f:'#527dc2',g:'#cf8737',gauge:'#238e83',purple:'#8968a8',red:'#b95149'};
const n=[Math.sqrt(3)/2,.5],tangent=[-.5,Math.sqrt(3)/2],beta=1.2,eta=.35;
const state={step:1,progress:1,playing:false,touching:false,alphaMix:.5,az:-.55,el:.53};
let frame=0,drawFrame=0,W=0,H=0;
const add=(a,b)=>a.map((v,i)=>v+b[i]),scale=(a,t)=>a.map(v=>v*t),dot=(a,b)=>a.reduce((v,x,i)=>v+x*b[i],0),mix=(a,b,t)=>a.map((v,i)=>v+(b[i]-v)*t),clamp=t=>Math.max(0,Math.min(1,t));
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const line=(x1,y1,x2,y2,attr='')=>`<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" ${attr}/>`;
const text=(x,y,value,attr='')=>`<text x="${x}" y="${y}" ${attr}>${esc(value)}</text>`;
const color=(hex,opacity)=>{const v=parseInt(hex.slice(1),16);return `rgba(${v>>16},${v>>8&255},${v&255},${opacity})`;};
function model(){
 const gap=state.touching?0:.6,d=1+gap/2,c=scale(n,-2*d),z0=scale(n,2*d),coefficients=scale(n,1/(2*d));
 const A={center:add(scale(n,beta-d),scale(tangent,eta)),radius:1,open:true};
 const B={center:add(scale(n,beta+d),scale(tangent,eta)),radius:1,open:false};
 const C={center:c,radius:2,open:true},D={center:[0,0],radius:2,open:true};
 const a=add(A.center,add(scale(n,.5),scale(tangent,.3))),b=add(B.center,add(scale(n,-.4),scale(tangent,-.2))),z=add(a,scale(b,-1));
 const f=x=>dot(coefficients,x),pD=x=>Math.hypot(...x)/2;
 const fA=[(beta-d-1)/(2*d),(beta-d+1)/(2*d)],fB=[(beta+d-1)/(2*d),(beta+d+1)/(2*d)],fC=[-1-1/d,-1+1/d];
 const lower=fA[1],upper=fB[0],alpha=lower+(upper-lower)*state.alphaMix;
 const back=state.step===4,progress=state.progress;
 const movingCenter=back?scale(c,progress):scale(c,1-progress),movingExternal=back?scale(z0,1-progress):scale(z0,progress);
 const movingLevel=back?1-progress:progress;
 return {gap,d,beta,eta,n:[...n],tangent:[...tangent],c,z0,coefficients,A,B,C,D,a,b,z,fA,fB,fC,lower,upper,alpha,movingCenter,movingExternal,movingLevel,planeLevel:state.step===6?progress*alpha:0,f_a:f(a),f_b:f(b),f_z:f(z),f,pD};
}
const mapAt=(ox,oy,s)=>p=>[ox+s*p[0],oy-s*p[1]];
function path(points,attr=''){return `<path d="${points.map((p,i)=>(i?'L':'M')+p.join(' ')).join(' ')}" fill="none" ${attr}/>`;}
function point(map,p,label,ink,dx=8,dy=-10,open=false){const [x,y]=map(p);return `<circle cx="${x}" cy="${y}" r="4.7" fill="${open?'#fffefb':ink}" stroke="${open?ink:'#fffefb'}" stroke-width="1.7"/>`+text(x+dx,y+dy,label,`class="outlined math-label" style="fill:${ink}"`);}
function disk(map,center,r,ink,label,open=true,opacity=1,labelInside=false){const [x,y]=map(center),s=Math.hypot(...add(map([1,0]),scale(map([0,0]),-1)));return `<g opacity="${opacity}"><circle cx="${x}" cy="${y}" r="${s*r}" fill="${ink}" fill-opacity=".10" stroke="${ink}" stroke-width="2" ${open?'stroke-dasharray="6 4"':''}/>${text(x,y+(labelInside?-s*r*.57:-s*r-10),label,`class="set-name outlined" text-anchor="middle" style="fill:${ink}"`)}</g>`;}
function axes(map,bounds,originLabel=false){const [xmin,xmax,ymin,ymax]=bounds,a=map([xmin,0]),b=map([xmax,0]),c=map([0,ymin]),d=map([0,ymax]);let s=line(...a,...b,'class="axis"')+line(...c,...d,'class="axis"');if(originLabel)s+=point(map,[0,0],'0',colors.muted,7,17);return s;}
function vector(map,a,b,ink,opacity=1){const p=map(a),q=map(b),dx=q[0]-p[0],dy=q[1]-p[1],len=Math.hypot(dx,dy);if(len<.1)return '';const ux=dx/len,uy=dy/len;return `<g opacity="${opacity}">`+line(...p,...q,`stroke="${ink}" stroke-width="2"`)+`<path d="M${q[0]} ${q[1]} L${q[0]-9*ux+4*uy} ${q[1]-9*uy-4*ux} L${q[0]-9*ux-4*uy} ${q[1]-9*uy+4*ux} Z" fill="${ink}"/></g>`;}
function levelLine(map,m,level,ink,label,dashed=false,bounds=[-5,4,-3.8,3.2],labelSide=1){
 const [xmin,xmax,ymin,ymax]=bounds,[a,b]=m.coefficients,points=[];
 for(const x of [xmin,xmax]){const y=(level-a*x)/b;if(y>=ymin&&y<=ymax)points.push([x,y]);}
 for(const y of [ymin,ymax]){const x=(level-b*y)/a;if(x>=xmin&&x<=xmax)points.push([x,y]);}
 if(points.length<2)return '';
 const pp=points.sort((a,b)=>a[1]-b[1]),start=map(pp[0]),end=map(pp.at(-1));
 let s=line(...start,...end,`stroke="${ink}" stroke-width="${dashed?1.7:2.6}" ${dashed?'stroke-dasharray="6 5"':''}`);
 if(label){const p=labelSide>0?mix(start,end,.84):mix(start,end,.15);s+=text(p[0]+10,p[1]-6,label,`class="outlined math-label" style="fill:${ink}"`);}return s;
}
function valueAxis(m,y,showSeparator){
 const valueX=value=>80+(value+.8)/2.45*730,zero=valueX(0),alpha=valueX(m.alpha),level=state.step===6?m.planeLevel:0;
 let s=line(58,y,850,y,`stroke="${colors.line}" stroke-width="1.5"`)+text(850,y+25,'取值数轴 ℝ','text-anchor="end" class="small"');
 s+=line(zero,y-5,zero,y+5,`stroke="${colors.muted}"`)+text(zero,y+24,'0','text-anchor="middle" class="small"');
 for(const [range,ink,open,label] of [[m.fA,colors.a,true,'f(A)'],[m.fB,colors.b,false,'f(B)']]){
  const x1=valueX(range[0]),x2=valueX(range[1]);s+=line(x1,y,x2,y,`stroke="${ink}" stroke-width="7" opacity=".75"`);
  for(const x of [x1,x2])s+=`<circle cx="${x}" cy="${y}" r="4.6" fill="${open?'#fffefb':ink}" stroke="${ink}" stroke-width="1.8"/>`;
  s+=text((x1+x2)/2,y-15,label,`class="value-name" text-anchor="middle" style="fill:${ink}"`);
 }
 s+=text(valueX(m.lower)-5,y+45,'sup f(A)','text-anchor="end" class="small"')+text(valueX(m.upper)+5,y+45,'inf f(B)','text-anchor="start" class="small"');
 if(showSeparator){
  const x=valueX(level),feasible=level>=m.lower-1e-10&&level<=m.upper+1e-10,ink=feasible?colors.f:colors.red;
  s+=`<rect x="${valueX(m.lower)}" y="${y-7}" width="${Math.max(.8,valueX(m.upper)-valueX(m.lower))}" height="14" fill="${colors.f}" fill-opacity=".11"/>`;
  s+=line(x,y-34,x,y+9,`stroke="${ink}" stroke-width="2"`)+text(x,y-39,state.progress>.999?'α':'平移中','text-anchor="middle" class="outlined small"');
 }return {html:s,valueX};
}
function differenceScene(m){
 const left=mapAt(175,202,51),right=mapAt(802,173,49);
 let s=text(22,28,'原来的两个集合','class="caption"')+text(500,28,'把每一个差收集成 C','class="caption"');
 s+=line(455,42,455,425,'stroke="#e0e6df"')+axes(left,[-2.2,4.7,-2.1,3.2],true)+axes(right,[-5,1,-4.2,2.1],true);
 s+=disk(left,m.A.center,1,colors.a,'A',true,1,true)+disk(left,m.B.center,1,colors.b,'B',false,1,true);
 s+=point(left,m.a,'a',colors.a,-18,20)+point(left,m.b,'b',colors.b,8,-12)+vector(left,m.b,m.a,colors.c);
 const reveal=.18+.82*state.progress;s+=disk(right,m.C.center,2,colors.c,'C = A − B',true,reveal);
 s+=vector(right,[0,0],m.z,colors.c,reveal)+point(right,m.z,'a − b',colors.c,-45,23);
 s+=text(230,397,'从 b 指向 a 的向量','text-anchor="middle" class="small"')+text(690,397,'平移到原点，向量没有改变','text-anchor="middle" class="small"');
 s+=text(450,447,'A ∩ B = ∅　⇔　0 ∉ C','text-anchor="middle" class="math-label"');
 return s;
}
function translateForGauge(m){
 const map=mapAt(245,165,43),q=state.progress;
 let s=axes(map,[-5.2,4,-4.3,3.1]);
 if(q>.03)s+=disk(map,m.C.center,2,colors.line,'',true,.5);
 s+=disk(map,m.movingCenter,2,q<.98?colors.c:colors.gauge,q<.98?'C 正在平移':'D = C − c',true);
 s+=point(map,m.movingCenter,q<.98?'c → 0':'0',colors.gauge,7,20);
 s+=point(map,m.movingExternal,q<.02?'原来的 0':q>.98?'z₀ = −c':'0 → z₀',colors.ink,8,-12);
 if(q<.98)s+=vector(map,m.movingCenter,[0,0],colors.purple,.6);
 else{
  const y=add(scale(n,.95),scale(tangent,.45));s+=vector(map,[0,0],y,colors.gauge,.8)+point(map,y,'y',colors.gauge,9,-8);
 }
 s+=text(225,373,q<.98?'连同外点一起平移；相对位置不变。':'D 含原点，z₀ 不在 D 内。','text-anchor="middle" class="small"');return s;
}
function sliceScene(m){
 const map=mapAt(198,220,56),q=state.progress;
 let s=axes(map,[-3.1,4.0,-2.5,3.5]);
 s+=disk(map,[0,0],2,colors.gauge,'D',true,1,true)+point(map,[0,0],'0',colors.muted,-16,20)+point(map,m.z0,'z₀',colors.ink,9,21);
 s+=vector(map,[0,0],m.z0,colors.g,.8);
 if(q>.01){s+=`<g opacity="${q}">`+levelLine(map,m,1,colors.f,'f = 1',false,[-3.1,3.8,-2.4,3.1],1)+text(225,367,'D 中每一点的高度都小于 1','text-anchor="middle" class="small"')+'</g>';}
 else s+=text(225,367,'先在 z₀ 的直线上规定 g(z₀) = 1','text-anchor="middle" class="small"');
 return s;
}
function shiftBackScene(m){
 const map=mapAt(558,172,63),q=state.progress;
 let s=axes(map,[-7.3,4.5,-3.9,2.3]);
 s+=levelLine(map,m,0,colors.line,'',true,[-6.4,4,-3.8,2]);
 if(q>.02)s+=disk(map,[0,0],2,colors.line,'',true,.6);
 s+=disk(map,m.movingCenter,2,colors.c,q<.02?'D':q>.98?'C':'D 正在移回 C',true);
 s+=levelLine(map,m,m.movingLevel,colors.f,q<.02?'f = 1':q>.98?'f = 0':'同一 f 的等值线',false,[-6.4,4,-3.8,2]);
 s+=point(map,m.movingExternal,q>.98?'0':'z₀ → 0',colors.ink,10,20);
 s+=point(map,m.movingCenter,q>.98?'c':'0 → c',colors.c,9,21);
 if(q<.98)s+=vector(map,m.movingExternal,[0,0],colors.purple,.65);
 s+=text(450,445,'方向保持不变：原来 f = 1 的直线，现在成为 f = 0。','text-anchor="middle" class="small"');
 return s;
}
function restoreScene(m){
 const map=mapAt(345,205,70),q=state.progress,final=state.step===6;
 let s=axes(map,[-3.1,4.7,-1.45,2.6]);
 s+=disk(map,m.A.center,1,colors.a,'A',true,1,true)+disk(map,m.B.center,1,colors.b,'B',false,1,true);
 s+=levelLine(map,m,0,colors.muted,'f = 0',true,[-2.3,4.9,-1.3,2.4],-1);
 if(final){const feasible=m.planeLevel>=m.lower-1e-10&&m.planeLevel<=m.upper+1e-10;s+=levelLine(map,m,m.planeLevel,feasible?colors.f:colors.red,q>.999?'f = α':'平移中的等值线',false,[-2.3,4.9,-1.3,2.4],1);}
 s+=point(map,m.a,'a',colors.a,-17,20)+point(map,m.b,'b',colors.b,8,-10);
 const axis=valueAxis(m,390,final);s+=axis.html;
 const opacity=final?1:q;
 for(const [p,value,ink,label] of [[m.a,m.f_a,colors.a,'f(a)'],[m.b,m.f_b,colors.b,'f(b)']]){
  const start=map(p),end=[axis.valueX(value),390];
  const pathD=`M${start[0]} ${start[1]+7} C${start[0]} 315 ${end[0]} 315 ${end[0]} 383`;
  s+=`<path d="${pathD}" fill="none" stroke="${ink}" stroke-width="1.4" stroke-dasharray="4 5" opacity="${.65*opacity}"/>`;
  s+=`<circle cx="${end[0]}" cy="390" r="3.2" fill="${ink}" opacity="${opacity}"/>`;
  s+=text(end[0],350,label,`text-anchor="middle" class="small outlined" style="fill:${ink};opacity:${opacity}"`);
 }
 s+=text(759,165,'同一个 f','text-anchor="middle" class="caption"')+text(759,191,'E → ℝ','text-anchor="middle" class="math-label"')+text(759,215,'把每一点映成一个数','text-anchor="middle" class="small"');
 if(final)s+=text(759,268,'同一个方向','text-anchor="middle" class="small"')+text(759,292,'不同的等值线','text-anchor="middle" class="small"');
 return s;
}
function renderPlanar(m){
 const split=state.step===2||state.step===3;
 svg.setAttribute('viewBox',split?'0 0 450 390':'0 0 900 470');
 svg.innerHTML=state.step===1?differenceScene(m):state.step===2?translateForGauge(m):state.step===3?sliceScene(m):state.step===4?shiftBackScene(m):restoreScene(m);
}
// Every vertex below is a point of the actual cone p_D or the actual plane f.
// Partial stages reveal a subset of that geometry; they never deform p_D.
function render3D(m){
 if(state.step!==2&&state.step!==3)return;
 const rect=canvas.getBoundingClientRect(),dpr=Math.min(2,devicePixelRatio||1);W=rect.width;H=rect.height;if(!W||!H)return;
 canvas.width=Math.round(W*dpr);canvas.height=Math.round(H*dpr);ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,W,H);
 const commands=[],labels=[],ca=Math.cos(state.az),sa=Math.sin(state.az),ce=Math.cos(state.el),se=Math.sin(state.el);
 const project=v=>{const p=[v[0],v[1],v[2]-.5],depth=p[0]*ce*ca+p[1]*ce*sa+p[2]*se;return {x:-sa*p[0]+ca*p[1],y:se*ca*p[0]+se*sa*p[1]-ce*p[2],depth};};
 const polygon=(points,ink,opacity)=>{const p=points.map(project);commands.push({type:'poly',p,depth:p.reduce((s,p)=>s+p.depth,0)/p.length,ink,opacity});};
 const segment=(a,b,ink,width=1.3,dash=[],highlight=false)=>{const p=[project(a),project(b)];commands.push({type:'line',p,depth:(p[0].depth+p[1].depth)/2+(highlight?20:0),ink,width,dash});};
 const curve=(p,ink,width=1.3,dash=[],highlight=false)=>{for(let i=1;i<p.length;i++)segment(p[i-1],p[i],ink,width,dash,highlight);};
 const mark=(p,ink,r=4)=>commands.push({type:'dot',p:[project(p)],depth:project(p).depth+20,ink,r});
 const label=(p,value,ink,dx=6,dy=-8)=>labels.push({p:project(p),value,ink,dx,dy});
 const circle=(r,z,N=64)=>Array.from({length:N+1},(_,i)=>[r*Math.cos(i*2*Math.PI/N),r*Math.sin(i*2*Math.PI/N),z]);
 segment([-3.2,0,0],[3.5,0,0],colors.line);segment([0,-3.2,0],[0,3.5,0],colors.line);segment([0,0,-.9],[0,0,1.9],colors.line);
 label([0,0,1.9],'函数值',colors.muted,7,-2);label([3.3,0,0],'x₁',colors.muted);label([0,3.3,0],'x₂',colors.muted);
 polygon(circle(2,0).slice(0,-1),colors.gauge,.10);curve(circle(2,0),colors.gauge,1.8,[5,4]);label([-1.4,-1.3,0],'D',colors.gauge,-12,15);
 const reveal=state.step===2?clamp((state.progress-.30)/.70):1,upper=1.55*reveal,segments=56,layers=12;
 for(let j=0;j<layers;j++)for(let i=0;i<segments;i++){
  const lo=upper*j/layers,hi=upper*(j+1)/layers,a=2*Math.PI*i/56,b=2*Math.PI*(i+1)/56;
  polygon([[2*lo*Math.cos(a),2*lo*Math.sin(a),lo],[2*hi*Math.cos(a),2*hi*Math.sin(a),hi],[2*hi*Math.cos(b),2*hi*Math.sin(b),hi],[2*lo*Math.cos(b),2*lo*Math.sin(b),lo]],colors.gauge,.15);
 }
 if(reveal>.01){
  for(const angle of [0,Math.PI/2,Math.PI,3*Math.PI/2])segment([0,0,0],[2*upper*Math.cos(angle),2*upper*Math.sin(angle),upper],color(colors.gauge,.48),1);
  const level=state.step===2&&reveal<.999?upper:1;
  curve(circle(2*level,level),colors.gauge,2.0);
  if(state.step===2){label([-2*level,0,level],reveal<.999?'λD 的边界，高度 λ':'高度 1：D 的边界',colors.gauge,-46,-10);}
  else label([-1.9,.4,1.1],'p_D 的曲面',colors.gauge,-54,-8);
 }
 if(state.step===3){
  const extent=2.6*state.progress,point=(u,v)=>{const base=add(scale(n,u),scale(tangent,v));return [...base,u/(2*m.d)];};
  if(state.progress>.05){
   const patch=[[-2.3,-2.5],[3,-2.5],[3,2.5],[-2.3,2.5]].map(([u,v])=>[...add(scale(n,u),scale(tangent,v)),1]);
   polygon(patch,colors.purple,.055);curve([...patch,patch[0]],color(colors.purple,.45),1,[4,5]);label(patch[0],'高度 1 的水平面',colors.purple,-45,-6);
  }
  if(extent>.001){
   for(let i=0;i<10;i++)for(let j=0;j<8;j++){
    const u=-2.7+5.7*i/10,v=-extent+2*extent*j/8,u1=-2.7+5.7*(i+1)/10,v1=-extent+2*extent*(j+1)/8;
    polygon([point(u,v),point(u1,v),point(u1,v1),point(u,v1)],colors.f,.21);
   }
   curve([point(-2.7,-extent),point(3,-extent),point(3,extent),point(-2.7,extent),point(-2.7,-extent)],colors.f,1.2);
   label(point(.9,-extent),'延拓平面 f',colors.f,8,18);
  }
  curve([point(-2.7,0),point(3,0)],colors.g,3.3,[],true);label(point(-2.3,0),'原来的 g',colors.g,-48,9);
  const gPoint=[...m.z0,1];mark(gPoint,colors.f);mark([...m.z0,0],colors.ink);segment([...m.z0,0],gPoint,colors.f,1.4,[3,4],true);label(gPoint,'f(z₀) = 1',colors.f,9,-6);label([...m.z0,0],'z₀',colors.ink,9,15);
  if(state.progress>.05){const e=2.1*state.progress,p1=add(m.z0,scale(tangent,-e)),p2=add(m.z0,scale(tangent,e));segment([...p1,1],[...p2,1],colors.purple,3.0,[],true);segment([...p1,0],[...p2,0],colors.f,2.1,[4,3],true);for(const p of [p1,p2])segment([...p,0],[...p,1],colors.purple,1,[3,5]);label([...p2,1],'交线',colors.purple,8,-9);label([...p1,0],'投影：f = 1',colors.f,5,18);}
 }else if(reveal>.99){label([1.4,-1,1],'D = {p_D < 1}',colors.gauge,8,18);}
 // Use the same final geometric bounds at every animation progress value.
 const referenceWorld=[...circle(3.1,1.55),[-3.2,0,0],[3.5,0,0],[0,-3.2,0],[0,3.5,0],[0,0,-.9],[0,0,1.9]];
 for(const u of [-2.7,3])for(const v of [-2.6,2.6])referenceWorld.push([...add(scale(n,u),scale(tangent,v)),u/(2*m.d)]);
 for(const u of [-2.3,3])for(const v of [-2.5,2.5])referenceWorld.push([...add(scale(n,u),scale(tangent,v)),1]);
 const refs=referenceWorld.map(project),xs=refs.map(p=>p.x),ys=refs.map(p=>p.y),cx=(Math.min(...xs)+Math.max(...xs))/2,cy=(Math.min(...ys)+Math.max(...ys))/2,fit=Math.min((W-80)/(Math.max(...xs)-Math.min(...xs)),(H-62)/(Math.max(...ys)-Math.min(...ys)));
 const screen=p=>[W/2+(p.x-cx)*fit,H/2+(p.y-cy)*fit];
 commands.sort((a,b)=>a.depth-b.depth);
 for(const item of commands){ctx.save();const p=item.p.map(screen);ctx.beginPath();ctx.moveTo(...p[0]);if(item.type==='poly'){for(let i=1;i<p.length;i++)ctx.lineTo(...p[i]);ctx.closePath();ctx.fillStyle=color(item.ink,item.opacity);ctx.fill();}else if(item.type==='line'){ctx.lineTo(...p[1]);ctx.strokeStyle=item.ink;ctx.lineWidth=item.width;ctx.setLineDash(item.dash);ctx.stroke();}else{ctx.arc(...p[0],item.r,0,2*Math.PI);ctx.fillStyle=item.ink;ctx.fill();ctx.strokeStyle='#fffefb';ctx.lineWidth=1.5;ctx.stroke();}ctx.restore();}
 ctx.font='12px "Segoe UI","Microsoft YaHei",sans-serif';for(const item of labels){const p=screen(item.p),x=Math.max(7,Math.min(W-ctx.measureText(item.value).width-7,p[0]+item.dx)),y=Math.max(17,Math.min(H-10,p[1]+item.dy));ctx.lineWidth=4;ctx.strokeStyle='#fffefbe8';ctx.strokeText(item.value,x,y);ctx.fillStyle=item.ink;ctx.fillText(item.value,x,y);}
}
const formulas={
 1:'<span class="orange">C = A − B</span><span>A ∩ B = ∅　⇔　0 ∉ C</span>',
 2:'<span>D = C − c，z₀ = −c</span><span class="teal">p<sub>D</sub>(y) = inf {λ &gt; 0 : y ∈ λD}</span>',
 3:'<span class="blue">f ≤ p<sub>D</sub>，f(z₀) = 1</span><span>y ∈ D　⇒　f(y) &lt; 1</span>',
 4:'<span>z ∈ C　⇒　f(z − c) &lt; 1</span><span class="blue">f(z − c) = f(z) + 1　⇒　f(z) &lt; 0</span>',
 5:'<span class="blue">f(a − b) = f(a) − f(b) &lt; 0</span><span>f(a) &lt; f(b)</span>',
 6:'<span>sup f(A) ≤ α ≤ inf f(B)</span><span class="blue">H = {x : f(x) = α}</span>'
};
const titles={1:'先把“两集合不相交”变成“原点不在差集中”',2:'把 C 的一个内点 c 移到原点',3:'同一条高度 1 的交线：三维图与底面相对应',4:'连同集合、外点和分离线一起移回去',5:'保留刚构造的 f，回到 A 和 B',6:'固定 f 的方向，选取两段取值之间的 α'};
const notes={
 1:'<strong>先处理 C 与原点。</strong> 右边每一个点都是左边某一对点的差；两个集合没有公共点，差集就不含原点。',
 2:'<strong>重复 Minkowski 泛函的构造。</strong> 平移后的 D 含原点。把 λD 的边界放在高度 λ，这些边界连成 p_D 的曲面；高度 1 的圆圈对应 D 的边界。',
 3:'<strong>从 g 延拓出同一个 f。</strong> 先指定 g(z₀)=1，再把橙线展开为不超过 p_D 的蓝平面。平面在高度 1 的交线投到底面，就是把 D 与 z₀ 分开的 f=1。',
 4:'<strong>构造出来的 f 保持不变。</strong> 因为 f(−c)=1，平移回去后 C 的取值全小于 0；于是直线 f=0 将 C 与原点分开。',
 5:'<strong>现在看 f 的取值。</strong> C 中每个差都满足 f(a−b)&lt;0，所以 A 的所有取值都在 B 的所有取值左边。虚线曲线只表示映射到取值数轴，不是重新选择投影方向。',
 6:'<strong>这就是所求的分离线。</strong> 在两段取值之间选 α，再把 f=0 平行移动成 f=α。A 与 B 落在它的两侧，f 的方向始终没变。'
};
function render(){
 const m=model(),split=state.step===2||state.step===3;
 $('diagram-row').classList.toggle('split',split);document.querySelector('.surface-host').hidden=!split;
 document.querySelector('.surface-host').style.order=state.step===3?'0':'1';document.querySelector('.planar-host').style.order=state.step===3?'1':'0';
 $('planar-title').textContent=titles[state.step];$('surface-title').textContent=state.step===2?'D 的 Minkowski 泛函':'保留 g，延拓成 f';$('formula').innerHTML=formulas[state.step];$('explanation').innerHTML=state.step===6&&state.progress<.999?'<strong>保持方向，把等值线移向两集合之间。</strong> 红色表示尚未分离，蓝色表示已进入两段取值之间；最终停在所选的 α 处。':notes[state.step];
 $('note').textContent=state.touching?'接触时 A 仍不含边界：两段取值的端点相同，仍可选 α，但没有统一正间隔。':'这是一个开圆盘与闭圆盘的二维模型。虚线边界不属于开集；泛函的构造和一般证明使用同一条路线。';
 $('alpha-control').hidden=state.step!==6;$('alpha-choice').disabled=state.touching;$('alpha-choice').value=state.alphaMix;$('alpha-note').textContent=state.touching?'两端重合，此时 α 只有一个选择':'方向不变，只改变分隔值';
 $('progress').value=state.progress;$('play').textContent=state.playing?'暂停':'播放本步';$('play').setAttribute('aria-pressed',String(state.playing));$('next').textContent=state.step===6?'回到作差 ↺':'下一步 →';
 document.querySelectorAll('[data-step]').forEach(b=>{if(+b.dataset.step===state.step)b.setAttribute('aria-current','step');else b.removeAttribute('aria-current');});
 renderPlanar(m);render3D(m);document.documentElement.dataset.figureReady='true';
}
function request(){if(!drawFrame)drawFrame=requestAnimationFrame(()=>{drawFrame=0;render();});}
function stop(){if(frame)cancelAnimationFrame(frame);frame=0;state.playing=false;}
function play(){if(state.playing){stop();render();return;}state.playing=true;if(state.progress>.999)state.progress=0;const initial=state.progress,started=performance.now(),duration=state.step===3?6000:4800;const tick=now=>{state.progress=Math.min(1,initial+(now-started)/duration);render();if(state.progress<1&&state.playing)frame=requestAnimationFrame(tick);else{frame=0;state.playing=false;render();}};frame=requestAnimationFrame(tick);render();}
function selectStep(step){stop();state.step=step;state.progress=1;render();}
document.querySelectorAll('[data-step]').forEach(b=>b.addEventListener('click',()=>selectStep(+b.dataset.step)));
$('play').addEventListener('click',play);$('next').addEventListener('click',()=>selectStep(state.step%6+1));
$('progress').addEventListener('input',e=>{stop();state.progress=+e.target.value;render();});
$('alpha-choice').addEventListener('input',e=>{stop();state.alphaMix=+e.target.value;state.progress=1;render();});
$('touching').addEventListener('change',e=>{stop();state.touching=e.target.checked;render();});
$('reset-view').addEventListener('click',()=>{state.az=-.55;state.el=.53;render();});
let pointer=null;canvas.addEventListener('pointerdown',e=>{pointer={id:e.pointerId,x:e.clientX,y:e.clientY};canvas.setPointerCapture(e.pointerId);});canvas.addEventListener('pointermove',e=>{if(!pointer||pointer.id!==e.pointerId)return;state.az-=(e.clientX-pointer.x)*.008;state.el=Math.max(.08,Math.min(1.43,state.el+(e.clientY-pointer.y)*.008));pointer.x=e.clientX;pointer.y=e.clientY;request();});canvas.addEventListener('pointerup',()=>pointer=null);canvas.addEventListener('pointercancel',()=>pointer=null);
canvas.addEventListener('keydown',e=>{if(e.key==='ArrowLeft')state.az+=.12;else if(e.key==='ArrowRight')state.az-=.12;else if(e.key==='ArrowUp')state.el=Math.min(1.43,state.el+.1);else if(e.key==='ArrowDown')state.el=Math.max(.08,state.el-.1);else return;e.preventDefault();request();});
window.hbFirstGeometricState=()=>JSON.parse(JSON.stringify(state));
window.hbFirstGeometricMath=()=>{const m=model();return {...m,f:undefined,pD:undefined};};
window.hbFirstGeometricEvaluate=p=>{const m=model();return {f:m.f(p),pD:m.pD(p)};};
window.addEventListener('pagehide',stop);window.addEventListener('resize',request);
new ResizeObserver(()=>{if(parent!==window)parent.postMessage({type:'mtree:figure-height',height:document.body.getBoundingClientRect().height+2},'*');}).observe(document.body);
render();
})();
