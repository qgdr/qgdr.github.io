/* Original coordinate-based interactive figures. © 2026 qgdr; project noncommercial license. */
(() => {
'use strict';
const host=document.getElementById('figure'), mode=host.dataset.mode;
const C={ink:'#243e43',muted:'#718083',line:'#ccd8d3',cone:'#238d83',plane:'#537bc2',given:'#cb7928',violet:'#995b9e',invalid:'#c34743'};
const a=1.6,b=1;
const isAnalytic=mode==='extension'||mode==='one-direction';
const U=[Math.sqrt(3)/2,.5], V=[-.5,Math.sqrt(3)/2], GIVEN_SLOPE=3/5, ALPHA_BOUND=4/5;
const state={mode,step:mode==='extension'?5:1,az:isAnalytic?-.3:-2.25,el:isAnalytic?.68:.49,zoom:1,rho:mode==='point-separation'?1.35:1.4,alpha:isAnalytic?.4:1.8,theta:36,surface:true,epi:false,section:true,base:true,gline:false,scanning:false,scanProgress:0};
const titles={extension:['把斜向直线延拓成平面','Hahn–Banach: extension'],gauge:['凸集的刻度：Minkowski 函数','Gauge and epigraph'], 'point-separation':['分离直线从哪里来？','Lemma 1.3: extension → separation'], 'one-direction':['增加一个方向：平面怎样选？','One-direction extension']};
if(isAnalytic)host.classList.add('direction-family');
const steps=['1 上界曲面 p','2 子空间 G','3 已知直线 g','4 延拓平面 f','5 两个条件'];
const directionSteps=['1 固定旧值','2 两侧给界','3 选择平面'];
const num=x=>Number(x).toFixed(2).replace(/\.00$/,'');
function checkbox(key,text){return `<label><input type="checkbox" data-key="${key}" ${state[key]?'checked':''}>${text}</label>`;}
function slider(key,text,min,max,step){return `<label>${text}<input type="range" data-key="${key}" min="${min}" max="${max}" step="${step}" value="${state[key]}" aria-label="${text}"><output data-output="${key}">${num(state[key])}</output></label>`;}
let controls='';
if(mode==='extension') controls=`<nav class="steps" aria-label="逐步显示">${steps.map((s,i)=>`<button data-step="${i+1}" aria-pressed="${i+1===state.step}">${s}</button>`).join('')}<button class="next" id="next-step">回到开头 ↺</button></nav>`;
if(mode==='one-direction')controls=`<nav class="steps" aria-label="延拓的三个步骤">${directionSteps.map((s,i)=>`<button data-step="${i+1}" aria-pressed="${i+1===state.step}">${s}</button>`).join('')}</nav><div class="direction-controls"><div class="alpha-row"><label>改变 α<input type="range" data-key="alpha" min="-1.4" max="1.4" step=".01" value=".4" aria-label="旋转候选平面，改变参数 α"></label><button id="scan-candidates">转动候选平面</button><button id="choose-feasible">选择可行平面</button></div><div class="feasible-scale" aria-label="绿色部分表示 L 到 U 的可行参数区间"><div class="feasible-band"></div><i class="alpha-marker"></i><span class="bound-label lower" style="left:21.428571%">L</span><span class="alpha-caption">α</span><span class="bound-label upper" style="left:78.571429%">U</span></div><div class="scan-meta"><span>负方向给下界 L　｜　正方向给上界 U</span><output id="scan-progress">所有候选都保留 g</output></div></div>`;
if(mode==='gauge') controls=`<div class="controls">${checkbox('surface','曲面 p_C')}${checkbox('epi','上图集（截断示意）')}${checkbox('section','z = 1 闭截面')}${checkbox('base','原开凸集 C')}</div><div class="controls">${slider('rho','点 v 的刻度 ρ',.25,1.85,.05)}${slider('alpha','缩放分母 λ',.2,2.4,.05)}</div>`;
if(mode==='point-separation') controls=`<div class="controls">${slider('theta','外点方向 θ',-160,180,1)}${slider('rho','外点刻度 ρ',1,1.85,.05)}${checkbox('gline','原直线 g')}${checkbox('section','z = 1 与投影')}</div>`;
const intro={extension:'把函数值画成高度：先保留 g，再把它延拓成不超过 p 的平面。',gauge:'固定开椭圆 C：x²/a² + y²/b² < 1，a = 1.6，b = 1。', 'point-separation':'选择椭圆外或边界上的 x₀，先在 ℝx₀ 上规定 g(tx₀) = t。', 'one-direction':'固定 g，改变新方向的值 α；候选平面绕同一条橙线转动。'}[mode];
host.innerHTML=`<h1>${titles[mode][0]}<small>${titles[mode][1]}</small></h1><p class="intro">${intro}</p>${controls}<div class="scene-wrap"><div class="world-tools"><button data-view="default">复位视角</button><button data-view="top">俯视</button><button data-view="side">侧视</button></div><div class="scene-grid ${isAnalytic?'single':''}"><canvas class="world" tabindex="0" aria-label="可拖动旋转的三维图；方向键旋转，Home复位"></canvas>${!isAnalytic?'<canvas class="planar" aria-label="与三维图使用同一坐标数据的二维视图"></canvas>':''}</div><span class="world-hint">拖动旋转 · 方向键转动 · 双击复位</span></div><div class="legend"></div><p class="readout" aria-live="${mode==='one-direction'?'off':'polite'}"></p><p class="note"></p>`;
const canvas=host.querySelector('.world'), plan=host.querySelector('.planar');
const ctx=canvas.getContext('2d'), pc=plan?.getContext('2d');
let W=0,H=0,PW=0,PH=0,commands=[],labels=[],animation=0,scanFrame=0;
let viewportFit=null;
function vec(x,y,z){return [x,y,z];}
function rgba(hex,alpha){const n=parseInt(hex.slice(1),16);return `rgba(${n>>16},${n>>8&255},${n&255},${alpha})`;}
function transform(v){
 const q=[v[0],v[1],v[2]-.38], ca=Math.cos(state.az),sa=Math.sin(state.az),ce=Math.cos(state.el),se=Math.sin(state.el);
 const depth=q[0]*ce*ca+q[1]*ce*sa+q[2]*se;
 const scale=Math.min(W*.205,H*.285)*state.zoom*8/(8-depth);
 return {x:W*.5+(-sa*q[0]+ca*q[1])*scale,y:H*.55-(-se*ca*q[0]-se*sa*q[1]+ce*q[2])*scale,depth};
}
function poly(points,color,alpha=.2,stroke=null){const p=points.map(transform);commands.push({type:'poly',p,depth:p.reduce((s,v)=>s+v.depth,0)/p.length,color:rgba(color,alpha),stroke});}
function segment(start,end,color,width=1.3,dash=[],highlight=false){
 const n=highlight?1:7;
 for(let i=0;i<n;i++){let u=i/n,v=(i+1)/n;const q=t=>start.map((x,j)=>x+(end[j]-x)*t),p=[transform(q(u)),transform(q(v))];commands.push({type:'line',p,depth:(p[0].depth+p[1].depth)/2+(highlight?20:0),color,width,dash,highlight});}
}
function curve(points,color,width=1.5,dash=[],highlight=false){for(let i=1;i<points.length;i++)segment(points[i-1],points[i],color,width,dash,highlight);}
function dot(p,color,r=4,hollow=false){const q=transform(p);commands.push({type:'dot',p:[q],depth:q.depth+20,color,r,hollow});}
function label(p,text,color=C.ink,dx=0,dy=0){labels.push({p:transform(p),text,color,dx,dy});}
function circle(z,ra,rb,N=64){return Array.from({length:N+1},(_,i)=>vec(ra*Math.cos(2*Math.PI*i/N),rb*Math.sin(2*Math.PI*i/N),z));}
function cone(aa=1,bb=1,opacity=.14,upper=2.15){
 const N=48,R=9;
 for(let j=0;j<R;j++)for(let i=0;i<N;i++){
  const lo=upper*j/R,hi=upper*(j+1)/R,t=2*Math.PI*i/N,u=2*Math.PI*(i+1)/N;
  poly([vec(aa*lo*Math.cos(t),bb*lo*Math.sin(t),lo),vec(aa*hi*Math.cos(t),bb*hi*Math.sin(t),hi),vec(aa*hi*Math.cos(u),bb*hi*Math.sin(u),hi),vec(aa*lo*Math.cos(u),bb*lo*Math.sin(u),lo)],C.cone,opacity);
 }
 curve(circle(upper,aa*upper,bb*upper),rgba(C.cone,.45),1.1);
 for(const angle of [0,Math.PI/2,Math.PI,3*Math.PI/2])segment(vec(0,0,0),vec(aa*upper*Math.cos(angle),bb*upper*Math.sin(angle),upper),rgba(C.cone,.45),1);
}
function plane(fn,alpha=.14,xr=2.1,yr=1.6){
 const n=9;
 for(let i=0;i<n;i++)for(let j=0;j<n;j++){
  const x=-xr+2*xr*i/n,u=-xr+2*xr*(i+1)/n,y=-yr+2*yr*j/n,v=-yr+2*yr*(j+1)/n;
  poly([vec(x,y,fn(x,y)),vec(u,y,fn(u,y)),vec(u,v,fn(u,v)),vec(x,v,fn(x,v))],C.plane,alpha);
 }
 const corners=[[-xr,-yr],[xr,-yr],[xr,yr],[-xr,yr],[-xr,-yr]].map(p=>vec(...p,fn(...p)));
 curve(corners,rgba(C.plane,.65),1.1);
}
function disk(z,ra,rb,color,alpha=.15,dashed=false){
 const pts=circle(z,ra,rb);poly(pts.slice(0,-1),color,alpha);curve(pts,color,1.5,dashed?[4,4]:[]);
}
function axes(){
 const ends=[vec(2.7,0,0),vec(0,2.15,0),vec(0,0,2.6)];
 for(let i=0;i<3;i++){let start=i===0?vec(-2.65,0,0):i===1?vec(0,-2.1,0):vec(0,0,-1.8);segment(start,ends[i],rgba(C.ink,.4),1);label(ends[i],['x','y','z'][i],C.ink,4,-4);}
 dot(vec(0,0,0),C.ink,2.5);label(vec(0,0,0),'0',C.muted,-10,13);
}
function uv(t,s=0){return [t*U[0]+s*V[0],t*U[1]+s*V[1]];}
function analyticMath(){
 const coefficients=U.map((x,i)=>GIVEN_SLOPE*x+state.alpha*V[i]);
 const t=(x,y)=>x*U[0]+y*U[1],s=(x,y)=>x*V[0]+y*V[1];
 const p=(x,y)=>GIVEN_SLOPE*t(x,y)+ALPHA_BOUND*Math.abs(s(x,y));
 const f=(x,y)=>coefficients[0]*x+coefficients[1]*y;
 const feasible=Math.abs(state.alpha)<=ALPHA_BOUND+1e-12;
 const point=V.map(x=>x*(state.alpha>=0?1:-1));
 return {model:'oblique-convex-fold',u:[...U],v:[...V],givenSlope:GIVEN_SLOPE,alpha:state.alpha,
  coefficients,feasible,bounds:[-ALPHA_BOUND,ALPHA_BOUND],
  violationPoint:{point,p:p(...point),f:f(...point),gap:f(...point)-p(...point),violates:!feasible},
  contactOnG:true,fOnU:GIVEN_SLOPE,fOnV:state.alpha,p,f};
}
function math(){
 if(isAnalytic)return analyticMath();
 const theta=state.theta*Math.PI/180,cs=Math.cos(theta),sn=Math.sin(theta);
 const x0=[state.rho*a*cs,state.rho*b*sn],coeff=[cs/(a*state.rho),sn/(b*state.rho)];
 return {a,b,rho:state.rho,alpha:state.alpha,theta,point:x0,coefficients:coeff,p:(x,y)=>Math.hypot(x/a,y/b),f:(x,y)=>coeff[0]*x+coeff[1]*y,ellipseLevel:1,fAtPoint:coeff[0]*x0[0]+coeff[1]*x0[1],functionalSupremumOnC:1/state.rho};
}
function lineEnds(A,B,level,xr=3.0,yr=2.15){
 const pts=[];
 if(Math.abs(B)>1e-9)for(const x of [-xr,xr]){let y=(level-A*x)/B;if(Math.abs(y)<=yr+1e-8)pts.push([x,y]);}
 if(Math.abs(A)>1e-9)for(const y of [-yr,yr]){let x=(level-B*y)/A;if(Math.abs(x)<=xr+1e-8)pts.push([x,y]);}
 return pts.length>=2?[pts[0],pts.at(-1)]:[];
}
// The folded surface is the maximum of two linear functions. It is
// sublinear, agrees with g along G, and exposes both one-step constraints.
// Coefficients remain internal: the teaching view is geometric.
function foldedSurface(opacity=.19){
 const T=1.72,S=1.38,N=8;
 const point=(t,s)=>vec(...uv(t,s),GIVEN_SLOPE*t+ALPHA_BOUND*Math.abs(s));
 for(const side of [-1,1]){
  for(let i=0;i<N;i++)for(let j=0;j<N;j++){
   const t=-T+2*T*i/N,q=-T+2*T*(i+1)/N,s=side*S*j/N,r=side*S*(j+1)/N;
   poly([point(t,s),point(q,s),point(q,r),point(t,r)],C.cone,opacity);
  }
  curve([point(-T,0),point(-T,side*S),point(T,side*S),point(T,0)],rgba(C.cone,.65),1.4);
 }
 label(point(-1.48,1.22),'上界曲面 p',C.cone,-56,-12);
}
function givenGeometry(showLine=true){
 const lo=uv(-2.0),hi=uv(2.0);
 segment(vec(...lo,0),vec(...hi,0),C.violet,3.0,[],true);
 label(vec(...uv(-1.9),0),'G',C.violet,-10,18);
 if(showLine){
  const t=1.5;
  segment(vec(...uv(-t),-GIVEN_SLOPE*t),vec(...uv(t),GIVEN_SLOPE*t),C.given,4.1,[],true);
  label(vec(...uv(1.5),GIVEN_SLOPE*1.5),'固定的 g',C.given,9,-8);
 }
}
function candidatePlane(m){
 const N=9,T=1.5,S=1.15,color=m.feasible?C.plane:C.invalid;
 const point=(t,s)=>vec(...uv(t,s),GIVEN_SLOPE*t+state.alpha*s);
 for(let i=0;i<N;i++)for(let j=0;j<N;j++){
  const t=-T+2*T*i/N,q=-T+2*T*(i+1)/N,s=-S+2*S*j/N,r=-S+2*S*(j+1)/N;
  poly([point(t,s),point(q,s),point(q,r),point(t,r)],color,.25);
 }
 curve([point(-T,-S),point(T,-S),point(T,S),point(-T,S),point(-T,-S)],rgba(color,.85),1.5);
 label(point(1.3,-1.05),'候选平面 f',color,10,17);
}
function extension(){
 const m=analyticMath();foldedSurface();
 if(state.step>=4)candidatePlane(m);
 if(state.step>=2)givenGeometry(state.step>=3);
 if(state.step===5){const point=uv(.3,.9),f=m.f(...point),p=m.p(...point);segment(vec(...point,f),vec(...point,p),C.ink,1.4,[3,3],true);dot(vec(...point,f),C.plane);dot(vec(...point,p),C.cone);label(vec(...point,(f+p)/2),'f ≤ p',C.ink,7,0);}
 host.querySelector('.legend').innerHTML=`<span class="green"><i class="swatch"></i>凸函数 p 的曲面</span>${state.step>=2?'<span class="violet"><i class="swatch"></i>定义域内的直线 G</span>':''}${state.step>=3?'<span class="orange"><i class="swatch"></i>g 的图像</span>':''}${state.step>=4?'<span class="blue"><i class="swatch"></i>f 的图像</span>':''}`;
 const texts=['绿色曲面给出不能超过的高度。','紫色斜直线 G 是已经定义 g 的地方。','橙线给出 g 的高度。本图选择它沿着曲面接触的情形。','蓝平面包含整条橙线，保留 G 上的所有旧值。','蓝平面沿 g 与曲面接触，其余位置不超过曲面：同时满足 f|G=g 与 f≤p。'];
 host.querySelector('.readout').innerHTML=texts[state.step-1];
 host.querySelector('.note').textContent='二维定义域、三维图像。接触情形便于观察；定理只要求 g≤p，不要求 g 处处接触 p。';
}
function oneDirection(){
 const m=analyticMath(),color=m.feasible?C.plane:C.invalid;
 foldedSurface(.20);if(state.step>=2)candidatePlane(m);givenGeometry(true);
 if(state.step>=2){
  for(const side of [-1,1]){
   const point=V.map(x=>side*x),height=m.p(...point),chosen=m.f(...point);
   segment(vec(...point,0),vec(...point,height),rgba(C.cone,.65),1.4,[3,3],true);
   segment(vec(...point,height),vec(...point,chosen),color,3,[],true);
   dot(vec(...point,height),C.cone,4.0);dot(vec(...point,chosen),color,4.0);
  }
  const v=V.map(x=>x*1.85),nv=v.map(x=>-x);
  segment(vec(0,0,0),vec(...v,0),C.violet,2.0,[3,4],true);
  segment(vec(0,0,0),vec(...nv,0),C.violet,2.0,[3,4],true);
  label(vec(...v,0),'正方向 v',C.violet,13,-10);
  label(vec(...nv,0),'负方向 −v',C.violet,-76,16);
 }
 host.querySelector('.legend').innerHTML='<span class="green"><i class="swatch"></i>上界 p</span><span class="orange"><i class="swatch"></i>始终固定的 g</span><span class="blue"><i class="swatch"></i>候选 f</span>';
 const status=m.feasible?'两侧都不越界：这个平面可行':state.alpha>ALPHA_BOUND?'正方向越界：α 不能超过上界 U':'负方向越界：α 不能低于下界 L';
 const texts=[
  '旧值 g 已固定；新增一个方向，只需选定 α，整个平面就随之确定。',
  `<strong class="${m.feasible?'feasible-text':'invalid-text'}">${status}</strong><br>增大 α，一侧抬高、另一侧降低；两侧分别给出上界 U 和下界 L。`,
  '<strong class="feasible-text">为什么有得选？次可加性保证每一个下界都不超过每一个上界。</strong><br>因此 L≤U，在两界之间选 α，平面既保留 g，也不超过 p。'
 ];
 host.querySelector('.readout').innerHTML=texts[state.step-1];
 host.querySelector('.note').textContent='图中接触沿 g 保持不动；可行参数不一定唯一，一般情形也允许 L=U。';updateDirectionControls();
}
function fixedAnalyticReference(){
 const points=[vec(-2.65,0,0),vec(2.7,0,0),vec(0,-2.1,0),vec(0,2.15,0),vec(0,0,-1.8),vec(0,0,2.6),vec(0,0,0)];
 for(const t of [-1.72,1.72])for(const s of [-1.38,0,1.38])points.push(vec(...uv(t,s),GIVEN_SLOPE*t+ALPHA_BOUND*Math.abs(s)));
 for(const t of [-1.5,1.5])for(const s of [-1.15,1.15])for(const alpha of [-1.4,1.4])points.push(vec(...uv(t,s),GIVEN_SLOPE*t+alpha*s));
 for(const t of [-2.25,2.25])points.push(vec(...uv(t),0));return points.map(transform);
}
function gauge(){
 if(state.base)disk(0,a,b,C.cone,.12,true);
 if(state.epi){cone(a,b,state.surface?.065:.12,1.9);for(const z of [.45,.75,1.35,1.9])disk(z,a*z,b*z,C.cone,.055,false);}
 if(state.surface)cone(a,b,.13,1.9);
 if(state.section){
  poly([vec(-2.2,-1.45,1),vec(2.2,-1.45,1),vec(2.2,1.45,1),vec(-2.2,1.45,1)],C.plane,.035);
  disk(1,a,b,C.plane,.19);
  for(const angle of [0,Math.PI/2,Math.PI,3*Math.PI/2])segment(vec(a*Math.cos(angle),b*Math.sin(angle),0),vec(a*Math.cos(angle),b*Math.sin(angle),1),rgba(C.plane,.55),1,[3,3]);
  label(vec(-a,0,1),'z=1：p_C≤1',C.plane,-40,-12);
 }
 const theta=.62,v=[state.rho*a*Math.cos(theta),state.rho*b*Math.sin(theta)],scaled=v.map(x=>x/state.alpha);
 segment(vec(0,0,0),vec(...v,0),rgba(C.given,.65),1.3,[],true);
 segment(vec(...v,0),vec(...v,state.rho),C.given,1.4,[3,3],true);
 dot(vec(...v,0),C.given,4.3);dot(vec(...v,state.rho),C.given,4.1);label(vec(...v,state.rho),'p_C(v)',C.given,8,-5);
 dot(vec(...scaled,0),C.violet,4.5);label(vec(...scaled,0),'v/λ',C.violet,8,14);
 label(vec(-2.2,-.6,1.9),'z=p_C(x,y)',C.cone,-20,-10);
 host.querySelector('.legend').innerHTML='<span class="green"><i class="swatch"></i>原开凸集 C / 曲面 p<sub>C</sub></span><span class="blue"><i class="swatch"></i>闭截面 p<sub>C</sub>≤1</span><span class="orange"><i class="swatch"></i>点 v</span><span class="violet"><i class="swatch"></i>缩放后的 v/λ</span>';
 const level=state.rho/state.alpha,on=Math.abs(level-1)<1e-8;
 const where=on?'在边界上，<strong>不属于开集 C</strong>':level<1?'进入开集 C':'仍在 C 外';
 host.querySelector('.readout').innerHTML=`<span class="formula">p_C(v)=${num(state.rho)}；p_C(v/λ)=${num(level)}</span>。缩放后的点${where}。`;
 host.querySelector('.note').textContent=`λ>p_C(v) 时 v/λ 才进入 C；λ=p_C(v) 时落在边界。${state.epi?'上图集向上无界；此图只显示 0≤z≤1.9 内的部分。':'z=1 的闭截面含边界；基面上虚线圈内的 C 不含边界。'}`;
 drawPlanarGauge(v,scaled);
}
function pointSeparation(){
 const m=math(),v=m.point;
 disk(0,a,b,C.cone,.12,true);cone(a,b,.14,1.85);
 plane(m.f,.17,2.25,1.65);
 if(state.section){
  poly([vec(-2.8,-1.7,1),vec(2.8,-1.7,1),vec(2.8,1.7,1),vec(-2.8,1.7,1)],C.plane,.045);
  const ends=lineEnds(...m.coefficients,1,2.8,1.7);
  if(ends.length){segment(vec(...ends[0],1),vec(...ends[1],1),C.plane,3,[],true);segment(vec(...ends[0],0),vec(...ends[1],0),C.plane,2,[5,4],true);for(const p of ends)segment(vec(...p,0),vec(...p,1),rgba(C.plane,.5),1,[3,3]);}
  label(vec(-1.4,-1.2,1),'z=1',C.plane,-15,-10);
 }
 if(state.gline){const t=.82;segment(vec(-t*v[0],-t*v[1],-t),vec(1.18*v[0],1.18*v[1],1.18),C.given,2.8,[],true);label(vec(.5*v[0],.5*v[1],.5),'g(tx₀)=t',C.given,5,-7);}
 segment(vec(...v,0),vec(...v,1),C.given,1.5,[4,3],true);dot(vec(...v,0),C.given,4.6);dot(vec(...v,1),C.given,4.3);label(vec(...v,0),'x₀',C.given,7,15);label(vec(...v,1),'f(x₀)=1',C.given,7,-9);
 label(vec(-1.6,.45,m.f(-1.6,.45)),'z=f(x,y)',C.plane,-12,-12);
 label(vec(-1.5,-.7,m.p(-1.5,-.7)),'z=p_C(x,y)',C.cone,-40,-11);
 host.querySelector('.legend').innerHTML='<span class="green"><i class="swatch"></i>开凸集 C / p_C 曲面</span><span class="blue"><i class="swatch"></i>延拓平面 z=f / 分离直线 f=1</span><span class="orange"><i class="swatch"></i>外点 x₀</span>';
 host.querySelector('.readout').innerHTML='<span class="formula">f(x,y)=(cosθ·x/a+sinθ·y/b)/ρ</span>；<strong>f≤p_C，f(x₀)=1</strong>，而 C 内每点都满足 <strong>f&lt;1</strong>。';
 host.querySelector('.note').textContent=state.rho<=1.0001?'ρ=1：x₀ 在边界上，不属于开集 C；逐点 f<1，但不能给所有点保留同一个正间隔。':'ρ>1：分离线经过 x₀，不必贴住 C。本椭圆例子有正间隔；一般 Lemma 1.3 只保证逐点严格不等式。';
 drawPlanarSeparation(m);
}
function paint(){
 ctx.clearRect(0,0,W,H);commands=[];labels=[];axes();
 if(mode==='extension')extension();else if(mode==='one-direction')oneDirection();else if(mode==='gauge')gauge();else pointSeparation();
 // Fit the complete projected geometry in the frame, without altering the
 // world coordinates or the relative x/y/z scales. The same camera is used
 // by every surface, graph, section and marked point.
 const points=commands.flatMap(cmd=>cmd.p);
 if(points.length){
  const reference=isAnalytic?fixedAnalyticReference():points;
  const xs=reference.map(p=>p.x),ys=reference.map(p=>p.y),loX=Math.min(...xs),hiX=Math.max(...xs),loY=Math.min(...ys),hiY=Math.max(...ys);
  const fit=Math.min((W-66)/Math.max(1,hiX-loX),(H-54)/Math.max(1,hiY-loY));
  viewportFit={scale:fit,cx:(loX+hiX)/2,cy:(loY+hiY)/2};
  const map=p=>{p.x=W/2+(p.x-(loX+hiX)/2)*fit;p.y=H/2+(p.y-(loY+hiY)/2)*fit;};
  points.forEach(map);labels.forEach(o=>map(o.p));
 }
 commands.sort((u,v)=>u.depth-v.depth);
 for(const cmd of commands){
  ctx.save();ctx.beginPath();const p=cmd.p;ctx.moveTo(p[0].x,p[0].y);
  if(cmd.type==='poly'){
   for(let i=1;i<p.length;i++)ctx.lineTo(p[i].x,p[i].y);ctx.closePath();ctx.fillStyle=cmd.color;ctx.fill();if(cmd.stroke){ctx.strokeStyle=cmd.stroke;ctx.stroke();}
  }else if(cmd.type==='line'){
   ctx.lineTo(p[1].x,p[1].y);ctx.setLineDash(cmd.dash);ctx.lineWidth=cmd.width;ctx.lineCap='round';
   if(cmd.highlight&&cmd.width>2){ctx.strokeStyle='rgba(255,254,251,.72)';ctx.lineWidth=cmd.width+2;ctx.stroke();ctx.lineWidth=cmd.width;}
   ctx.strokeStyle=cmd.color;ctx.stroke();
  }else{
   ctx.arc(p[0].x,p[0].y,cmd.r,0,2*Math.PI);ctx.fillStyle=cmd.hollow?'#fffefb':cmd.color;ctx.fill();ctx.strokeStyle=cmd.hollow?cmd.color:'#fffefb';ctx.lineWidth=1.4;ctx.stroke();
  }ctx.restore();
 }
 for(const o of labels){
  ctx.font='12px "Segoe UI","Microsoft YaHei",sans-serif';
  const x=Math.max(8,Math.min(W-ctx.measureText(o.text).width-8,o.p.x+o.dx)),y=Math.max(17,Math.min(H-20,o.p.y+o.dy));
  ctx.lineWidth=3.4;ctx.strokeStyle='rgba(255,254,251,.9)';ctx.strokeText(o.text,x,y);ctx.fillStyle=o.color;ctx.fillText(o.text,x,y);
 }
}
function planarSetup(extent=1){
 pc.clearRect(0,0,PW,PH);const sx=Math.min((PW-32)/(6.6*extent),(PH-68)/(4.4*extent)),cx=PW/2,cy=PH*.53;
 const map=([x,y])=>[cx+x*sx,cy-y*sx];
 pc.strokeStyle=rgba(C.ink,.26);pc.lineWidth=1;pc.beginPath();pc.moveTo(12,cy);pc.lineTo(PW-12,cy);pc.moveTo(cx,30);pc.lineTo(cx,PH-27);pc.stroke();
 ptext([PW-19,cy-7],'x');ptext([cx+7,37],'y');ptext([cx+4,cy+13],'0',C.muted,10);ptext([12,17],'二维定义域 E = ℝ²',C.ink,11);
 return {map,sx,cx,cy};
}
function ptext(p,text,color=C.ink,size=11){pc.font=`${size}px "Segoe UI","Microsoft YaHei",sans-serif`;pc.lineWidth=3;pc.strokeStyle='rgba(247,248,242,.95)';pc.strokeText(text,p[0],p[1]);pc.fillStyle=color;pc.fillText(text,p[0],p[1]);}
function ppoint(p,color,r=4.5,hollow=false){pc.beginPath();pc.arc(...p,r,0,2*Math.PI);pc.fillStyle=hollow?'#f7f8f2':color;pc.fill();pc.lineWidth=1.5;pc.strokeStyle=hollow?color:'#f7f8f2';pc.stroke();}
function pellipse(map,color=C.cone){
 pc.beginPath();for(let i=0;i<=120;i++){const t=2*Math.PI*i/120,p=map([a*Math.cos(t),b*Math.sin(t)]);i?pc.lineTo(...p):pc.moveTo(...p);}pc.fillStyle=rgba(color,.13);pc.fill();pc.strokeStyle=color;pc.lineWidth=1.4;pc.setLineDash([4,3]);pc.stroke();pc.setLineDash([]);
}
function drawPlanarGauge(v,scaled){
 if(!pc)return;const extent=Math.max(1,Math.abs(scaled[0])/2.8,Math.abs(scaled[1])/1.7);const {map}=planarSetup(extent);if(state.base)pellipse(map);ptext([13,PH-10],'虚线边界不属于 C',C.muted,10);
 const O=map([0,0]),V=map(v),S=map(scaled);pc.beginPath();pc.moveTo(...O);pc.lineTo(...map(v.map(x=>x*1.12)));pc.strokeStyle=rgba(C.given,.6);pc.lineWidth=1.2;pc.stroke();
 ppoint(V,C.given);ptext([V[0]+6,V[1]-6],'v',C.given);ppoint(S,C.violet,4.6,Math.abs(state.rho/state.alpha-1)<1e-8);ptext([S[0]+6,S[1]+14],'v/λ',C.violet);
 ptext(map([-1.0,-.7]),'C',C.cone,14);
}
function drawPlanarSeparation(m){
 if(!pc)return;const {map}=planarSetup();pellipse(map);const ends=lineEnds(...m.coefficients,1,3.3,2.1);
 if(ends.length){pc.beginPath();pc.moveTo(...map(ends[0]));pc.lineTo(...map(ends[1]));pc.strokeStyle=C.plane;pc.lineWidth=2;pc.stroke();const q=map(ends[1]);ptext([Math.max(10,Math.min(PW-45,q[0]+5)),Math.max(45,Math.min(PH-40,q[1]-8))],'f = 1',C.plane);}
 const p=map(m.point);ppoint(p,C.given);ptext([Math.min(PW-24,p[0]+6),Math.max(35,p[1]-8)],'x₀',C.given);ptext(map([-.8,-.7]),'C',C.cone,14);
 ptext([11,PH-24],`sup f(C) = 1/ρ = ${num(1/state.rho)}`,C.ink,10);ptext([11,PH-9],'x₀ 不属于开集 C',C.muted,10);
}
function resize(){
 const dpr=Math.min(2.5,window.devicePixelRatio||1),r=canvas.getBoundingClientRect();W=r.width;H=r.height;canvas.width=Math.round(W*dpr);canvas.height=Math.round(H*dpr);ctx.setTransform(dpr,0,0,dpr,0,0);
 if(plan){const r=plan.getBoundingClientRect();PW=r.width;PH=r.height;plan.width=Math.round(PW*dpr);plan.height=Math.round(PH*dpr);pc.setTransform(dpr,0,0,dpr,0,0);}paint();
}
function request(){if(!animation)animation=requestAnimationFrame(()=>{animation=0;paint();});}
function reset(){state.az=isAnalytic?-.3:-2.25;state.el=isAnalytic?.68:.49;state.zoom=1;request();}
function updateDirectionControls(){
 if(mode!=='one-direction')return;
 const control=host.querySelector('input[data-key="alpha"]');
 control.value=state.alpha;
 const marker=host.querySelector('.alpha-marker');marker.style.left=`${(state.alpha+1.4)/2.8*100}%`;
 marker.style.background=analyticMath().feasible?C.plane:C.invalid;
 const caption=host.querySelector('.alpha-caption');caption.style.left=marker.style.left;
 host.querySelector('.feasible-scale').classList.toggle('bounds-visible',state.step>=2);
 host.querySelector('#scan-candidates').textContent=state.scanning?'暂停转动':'转动候选平面';
 host.querySelector('#scan-candidates').setAttribute('aria-pressed',String(state.scanning));
 host.querySelector('#scan-progress').value=state.scanning?'保持 g，连续转动平面':state.scanProgress>=1?'两界之间的平面都可行':'所有候选都保留 g';
}
function stopScan(){if(scanFrame)cancelAnimationFrame(scanFrame);scanFrame=0;state.scanning=false;updateDirectionControls();}
host.querySelector('#scan-candidates')?.addEventListener('click',()=>{
 if(state.scanning){stopScan();return;}
 setStep(2);state.scanning=true;state.scanProgress=0;const started=performance.now();
 const tick=now=>{state.scanProgress=Math.min(1,(now-started)/8000);state.alpha=-1.3+2.6*state.scanProgress;paint();
  if(state.scanProgress<1&&state.scanning)scanFrame=requestAnimationFrame(tick);else{scanFrame=0;state.scanning=false;updateDirectionControls();}};
 scanFrame=requestAnimationFrame(tick);
});
host.querySelector('#choose-feasible')?.addEventListener('click',()=>{stopScan();state.alpha=.4;setStep(3);request();});
window.addEventListener('pagehide',stopScan);
for(const control of host.querySelectorAll('input[data-key]'))control.addEventListener('input',()=>{const key=control.dataset.key,value=control.type==='checkbox'?control.checked:Number(control.value);if(mode==='one-direction'){stopScan();setStep(2);}state[key]=value;const output=host.querySelector(`[data-output="${key}"]`);if(output)output.value=key==='theta'?`${Math.round(state[key])}°`:num(state[key]);request();});
function setStep(step){if(mode==='one-direction'){stopScan();if(step===3)state.alpha=.4;}state.step=step;host.querySelectorAll('[data-step]').forEach(button=>button.setAttribute('aria-pressed',String(Number(button.dataset.step)===step)));const next=host.querySelector('#next-step');if(next)next.textContent=step===5?'回到开头 ↺':'下一步 →';request();}
host.querySelectorAll('[data-step]').forEach(button=>button.addEventListener('click',()=>setStep(Number(button.dataset.step))));host.querySelector('#next-step')?.addEventListener('click',()=>setStep(state.step%5+1));
host.querySelectorAll('[data-view]').forEach(button=>button.addEventListener('click',()=>{if(button.dataset.view==='top'){state.az=-Math.PI/2;state.el=1.49;}else if(button.dataset.view==='side'){state.az=-Math.PI/2;state.el=.06;}else{reset();return;}request();}));
let pointer=null;
canvas.addEventListener('pointerdown',event=>{pointer={id:event.pointerId,x:event.clientX,y:event.clientY};canvas.setPointerCapture(event.pointerId);canvas.classList.add('dragging');});
canvas.addEventListener('pointermove',event=>{if(!pointer||pointer.id!==event.pointerId)return;state.az-=(event.clientX-pointer.x)*.009;state.el=Math.max(-.2,Math.min(1.49,state.el+(event.clientY-pointer.y)*.008));pointer.x=event.clientX;pointer.y=event.clientY;request();});
const release=()=>{pointer=null;canvas.classList.remove('dragging');};canvas.addEventListener('pointerup',release);canvas.addEventListener('pointercancel',release);canvas.addEventListener('dblclick',reset);
canvas.addEventListener('keydown',event=>{let used=true;if(event.key==='ArrowLeft')state.az+=.12;else if(event.key==='ArrowRight')state.az-=.12;else if(event.key==='ArrowUp')state.el=Math.min(1.49,state.el+.1);else if(event.key==='ArrowDown')state.el=Math.max(-.2,state.el-.1);else if(event.key==='Home')reset();else used=false;if(used){event.preventDefault();request();}});
new ResizeObserver(resize).observe(host.querySelector('.scene-wrap'));window.addEventListener('resize',resize);
window.hbFigureState=()=>JSON.parse(JSON.stringify({...state,viewportFit}));window.hbFigureMath=()=>{const m=math();return {...m,p:undefined,f:undefined};};
window.hbEvaluate=(x,y)=>({p:math().p(x,y),f:math().f(x,y)});
// Keep the full diagram and its explanation visible in the article frame.
const reportHeight=()=>{if(parent!==window)parent.postMessage({type:'mtree:figure-height',height:document.body.getBoundingClientRect().height+2},'*');};
new ResizeObserver(reportHeight).observe(document.body);
resize();
})();
