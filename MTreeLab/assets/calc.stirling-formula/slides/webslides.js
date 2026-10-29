/* Copyright (c) 2026 qgdr. Project interim noncommercial LICENSE applies. */
(function(){
'use strict';
const slides=[...document.querySelectorAll('.slide')],stage=document.getElementById('stage'),viewport=document.getElementById('viewport');
const selector=document.getElementById('page-select'),allInput=document.getElementById('show-all');
const model=window.GammaModel;
let page=0,step=0,scale=1,all=false;
window.webslidesMathErrors=[];
for(const equation of document.querySelectorAll('.equation')){
 try{katex.render(equation.dataset.latex,equation,{displayMode:true,throwOnError:true,strict:'ignore',trust:false});}
 catch(error){equation.classList.add('math-error');equation.textContent=String(error);window.webslidesMathErrors.push({latex:equation.dataset.latex,error:String(error)});}
}
function maxStep(index=page){return Math.max(0,Number(slides[index].dataset.count)-1)}
function fit(){
 scale=Math.min(viewport.clientWidth/1920,viewport.clientHeight/1080);
 stage.style.transform='scale('+scale+')';
 stage.style.left=((viewport.clientWidth-1920*scale)/2)+'px';stage.style.top=((viewport.clientHeight-1080*scale)/2)+'px';
 for(const slide of slides){
  const copy=slide.querySelector('.copy'),eqs=slide.querySelector('.equations'),visual=slide.querySelector('.visual');
  if(slide.classList.contains('raw-peaks')){
   eqs.style.top='355px';eqs.style.gap='22px';
   for(const eq of eqs.children){eq.style.fontSize='46px';const rendered=eq.querySelector('.katex');if(rendered){const width=rendered.getBoundingClientRect().width/scale;if(width>655)eq.style.fontSize=(46*655/width)+'px';}}
   const available=610,height=eqs.offsetHeight;if(height>available){const ratio=available/height;for(const eq of eqs.children)eq.style.fontSize=(parseFloat(eq.style.fontSize)*ratio)+'px';eqs.style.gap=(22*ratio)+'px';}
   visual.style.top='350px';visual.style.height='625px';continue;
  }
  if(slide.classList.contains('envelope-layout')){
   const top=242+copy.offsetHeight+23;eqs.style.top=top+'px';eqs.style.gap='38px';
   for(const eq of eqs.children){eq.style.fontSize='45px';const rendered=eq.querySelector('.katex');if(rendered){const width=rendered.getBoundingClientRect().width/scale;if(width>930)eq.style.fontSize=(45*930/width)+'px';}}
   const available=955-top,height=eqs.offsetHeight;if(height>available){const ratio=available/height;for(const eq of eqs.children)eq.style.fontSize=(parseFloat(eq.style.fontSize)*ratio)+'px';eqs.style.gap=(38*ratio)+'px';}
   visual.style.top='385px';visual.style.height='565px';continue;
  }
  const top=242+copy.offsetHeight+23;eqs.style.top=top+'px';
  const bottom=visual?640:960;
  for(const eq of eqs.children){eq.style.fontSize='58px';const rendered=eq.querySelector('.katex');if(rendered){const width=rendered.getBoundingClientRect().width/scale;if(width>1640)eq.style.fontSize=(58*1640/width)+'px';}}
  let height=eqs.offsetHeight;
  if(height>bottom-top){const ratio=(bottom-top)/height;for(const eq of eqs.children)eq.style.fontSize=(parseFloat(eq.style.fontSize)*ratio)+'px';eqs.style.gap=(22*ratio)+'px';}
  else eqs.style.gap='22px';
  if(visual){const y=Math.max(635,top+eqs.offsetHeight+18);visual.style.top=y+'px';visual.style.height=(985-y)+'px';}
 }
 drawInteractive();
}
function updateHash(){const next='#slide='+(page+1)+'&step='+(step+1);if(location.hash!==next)history.replaceState(null,'',next)}
function show(index,nextStep=0,write=true){
 page=Math.max(0,Math.min(slides.length-1,index));step=Math.max(0,Math.min(maxStep(),nextStep));
 slides.forEach((slide,i)=>{slide.classList.toggle('active',i===page);slide.setAttribute('aria-hidden',i===page?'false':'true');for(const eq of slide.querySelectorAll('.equation'))eq.classList.toggle('revealed',Number(eq.dataset.fragment)<=step);});
 document.body.classList.toggle('all-revealed',all);selector.value=String(page);
 document.getElementById('step-status').textContent=(page+1)+' / '+slides.length+' · '+(all?'全部':(step+1)+' / '+(maxStep()+1));
 document.querySelector('#progress div').style.width=(100*(page+1)/slides.length)+'%';
 if(write)updateHash();drawInteractive();
 window.webslidesState={page:page+1,step:step+1,slideId:slides[page].dataset.id,slideCount:slides.length,all,scale};
}
function next(){if(!all&&step<maxStep())show(page,step+1);else if(page<slides.length-1)show(page+1,0)}
function previous(){if(!all&&step>0)show(page,step-1);else if(page>0)show(page-1,all?0:maxStep(page-1))}
function hash(){const m=location.hash.match(/^#\/(\d+)/);if(m)return show(Number(m[1])-1,0,false);const params=new URLSearchParams(location.hash.replace(/^#/,''));show((Number(params.get('slide'))||1)-1,(Number(params.get('step'))||1)-1,false)}
document.getElementById('next').addEventListener('click',next);document.getElementById('previous').addEventListener('click',previous);
selector.addEventListener('change',()=>show(Number(selector.value),0));allInput.addEventListener('change',()=>{all=allInput.checked;show(page,step)});
document.getElementById('fullscreen').addEventListener('click',()=>{if(document.fullscreenElement)document.exitFullscreen();else document.documentElement.requestFullscreen().catch(()=>{});});
document.addEventListener('keydown',event=>{
 if(event.ctrlKey||event.altKey||event.metaKey)return;
 if(event.target.closest('input,select,textarea'))return;
 if(event.target.closest('button')&&[' ','Enter'].includes(event.key))return;
 if(['ArrowRight','ArrowDown',' ','PageDown'].includes(event.key)){event.preventDefault();next();}
 else if(['ArrowLeft','ArrowUp','PageUp'].includes(event.key)){event.preventDefault();previous();}
 else if(event.key==='Home'){event.preventDefault();show(0,0)}
 else if(event.key==='End'){event.preventDefault();show(slides.length-1,maxStep(slides.length-1))}
 else if(event.key.toLowerCase()==='f')document.getElementById('fullscreen').click();
});
stage.addEventListener('click',event=>{if(!event.target.closest('.interactive,a,button,input,select'))next()});
window.addEventListener('hashchange',hash);window.addEventListener('resize',()=>{fit();show(page,step)});
document.addEventListener('fullscreenchange',()=>{document.getElementById('fullscreen').textContent=document.fullscreenElement?'退出全屏':'全屏';setTimeout(()=>{fit();show(page,step)},50)});
const interactiveStates=new Map();
for(const el of document.querySelectorAll('.interactive')){
 const raw=el.dataset.kind==='raw_peaks',state={N:raw?2:1,playing:false,last:0};interactiveStates.set(el,state);
 const input=el.querySelector('.curve-scale'),button=el.querySelector('.curve-play');
 input.addEventListener('input',()=>{state.N=raw?Number(input.value):2**Number(input.value);state.playing=false;button.textContent=raw?'播放 n 增大':'播放放缩';drawInteractive()});
 button.addEventListener('click',()=>{state.playing=!state.playing;if(state.playing&&state.N>=(raw?12:256)){state.N=raw?2:1;input.value=raw?'2':'0';}state.last=0;button.textContent=state.playing?(raw?'暂停动画':'暂停放缩'):(raw?'播放 n 增大':'播放放缩');drawInteractive()});
}
function drawRawPeaks(el,n){
 const canvas=el.querySelector('.raw'),w=canvas.clientWidth,h=canvas.clientHeight,dpr=Math.max(1,devicePixelRatio||1);
 canvas.width=Math.round(w*dpr);canvas.height=Math.round(h*dpr);const ctx=canvas.getContext('2d');ctx.scale(dpr,dpr);
 const fn=(a,x)=>x>0?Math.exp(a*Math.log(x)-x):0;
 const xmax=n+4*Math.sqrt(n),ymax=1.22*fn(n,n),exponent=Math.floor(Math.log10(ymax)),unit=exponent>=4?10**exponent:1;
 const l=86,r=25,top=82,bottom=h-54,pw=w-l-r,ph=bottom-top,X=x=>l+x/xmax*pw,Y=y=>bottom-y/ymax*ph;
 const niceStep=value=>{const power=10**Math.floor(Math.log10(value)),ratio=value/power;return(ratio<=1?1:ratio<=2?2:ratio<=5?5:10)*power};
 const tick=value=>Number(value.toPrecision(3)).toString();
 ctx.strokeStyle='#6b6676';ctx.fillStyle='#6b6676';ctx.lineWidth=1.6;ctx.font='22px KaiTi,serif';ctx.beginPath();ctx.moveTo(l,top);ctx.lineTo(l,bottom);ctx.lineTo(w-r,bottom);ctx.stroke();
 ctx.textAlign='center';for(let x=0,step=niceStep(xmax/6);x<=xmax+1e-8;x+=step){ctx.beginPath();ctx.moveTo(X(x),bottom);ctx.lineTo(X(x),bottom+6);ctx.stroke();ctx.fillText(tick(x),X(x),bottom+28);}
 ctx.textAlign='right';for(let y=0,step=niceStep(ymax/4);y<=ymax+1e-8;y+=step){ctx.beginPath();ctx.moveTo(l-6,Y(y));ctx.lineTo(l,Y(y));ctx.stroke();ctx.fillText(tick(y/unit),l-12,Y(y)+7);}
 ctx.fillText('x',w-r,h-5);ctx.textAlign='left';ctx.fillStyle='#2a2833';ctx.font='28px KaiTi,serif';ctx.fillText('被积函数 f_n(x)',l,29);
 ctx.font='21px KaiTi,serif';ctx.fillStyle='#6b6676';ctx.fillText(unit===1?'纵轴：f_n(x)':'纵轴：f_n(x)，刻度 × 10^'+exponent,l,60);
 const previous=[2,4,8,12].filter(a=>a<n-.03);
 ctx.save();ctx.beginPath();ctx.rect(l,top,pw,ph);ctx.clip();
 function curve(a,color,width){ctx.strokeStyle=color;ctx.lineWidth=width;ctx.beginPath();for(let i=0;i<=900;i++){const x=xmax*i/900;if(i===0)ctx.moveTo(X(x),Y(fn(a,x)));else ctx.lineTo(X(x),Y(fn(a,x)));}ctx.stroke();}
 for(const a of previous)curve(a,'#9e98a6',2.1);curve(n,'#2F7FE0',4.2);ctx.restore();
 const legend=previous.map(a=>({text:'n = '+a,color:'#9e98a6'})).concat({text:'n = '+tick(n),color:'#2F7FE0'});
 let lx=w-r-legend.length*114;ctx.font='23px KaiTi,serif';for(const item of legend){ctx.strokeStyle=item.color;ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(lx,25);ctx.lineTo(lx+23,25);ctx.stroke();ctx.fillStyle=item.color;ctx.fillText(item.text,lx+30,32);lx+=114;}
 window.webslidesInteractiveState={slide:page+1,kind:'raw_peaks',n,xmax,ymax,yAxisUnit:unit,peak:{x:n,y:fn(n,n)},retained:previous};
}
function chart(canvas,xmax,ymax,xticks,yticks,label,xmin=-xmax){
 const w=canvas.clientWidth,h=canvas.clientHeight,dpr=Math.max(1,devicePixelRatio||1);canvas.width=Math.round(w*dpr);canvas.height=Math.round(h*dpr);
 const ctx=canvas.getContext('2d');ctx.scale(dpr,dpr);const l=60,r=20,top=30,b=43,pw=w-l-r,ph=h-top-b;
 const X=x=>l+(x-xmin)/(xmax-xmin)*pw,Y=y=>h-b-y/ymax*ph;
 ctx.font='21px KaiTi,serif';ctx.fillStyle='#6b6676';ctx.strokeStyle='#6b6676';ctx.lineWidth=1.6;ctx.beginPath();ctx.moveTo(l,top);ctx.lineTo(l,h-b);ctx.lineTo(w-r,h-b);ctx.stroke();
 ctx.textAlign='center';for(const x of xticks){ctx.beginPath();ctx.moveTo(X(x),h-b);ctx.lineTo(X(x),h-b+6);ctx.stroke();ctx.fillText(String(x),X(x),h-b+27)}
 ctx.textAlign='right';for(const y of yticks){ctx.beginPath();ctx.moveTo(l-5,Y(y));ctx.lineTo(l,Y(y));ctx.stroke();ctx.fillText(String(y),l-10,Y(y)+6)}ctx.fillText(label,w-r,h-2);
 const clip=fn=>{ctx.save();ctx.beginPath();ctx.rect(l,top,pw,ph);ctx.clip();fn();ctx.restore()};
 return{ctx,X,Y,xmin,xmax,ymax,clip,
  shade(a,b){clip(()=>{ctx.fillStyle='#1e9e5e13';ctx.fillRect(X(a),top,X(b)-X(a),ph)})},
  vertical(x){clip(()=>{ctx.strokeStyle='#1E9E5E';ctx.lineWidth=1.7;ctx.setLineDash([8,7]);ctx.beginPath();ctx.moveTo(X(x),top);ctx.lineTo(X(x),h-b);ctx.stroke();ctx.setLineDash([])})},
  curve(fn,color,dashed=false){clip(()=>{ctx.strokeStyle=color;ctx.lineWidth=3.8;ctx.setLineDash(dashed?[10,8]:[]);ctx.beginPath();let connected=false;for(let k=0;k<=1000;k++){const x=xmin+(xmax-xmin)*k/1000,y=fn(x);if(!Number.isFinite(y)){connected=false;continue}if(connected)ctx.lineTo(X(x),Y(y));else ctx.moveTo(X(x),Y(y));connected=true}ctx.stroke();ctx.setLineDash([])})},
  title(text){ctx.font='26px KaiTi,serif';ctx.fillStyle='#2a2833';ctx.textAlign='left';ctx.fillText(text,l,23)},
  point(x,y,text,color){if(!Number.isFinite(x)||!Number.isFinite(y)||x<xmin||x>xmax||y<0||y>ymax)return false;ctx.fillStyle=color;ctx.beginPath();ctx.arc(X(x),Y(y),5,0,Math.PI*2);ctx.fill();ctx.font='24px KaiTi,serif';ctx.textAlign=X(x)>w-r-35?'right':'left';ctx.fillText(text,X(x)+(ctx.textAlign==='right'?-8:8),Y(y)+(Y(y)<top+30?29:-10));return true}
 }
}
function drawInteractive(){
 const el=slides[page]&&slides[page].querySelector('.interactive');if(!el)return;
 const state=interactiveStates.get(el),n=state.N,r=Math.sqrt(n),kind=el.dataset.kind;
 if(kind==='raw_peaks'){el.querySelector('.curve-output').textContent=Math.abs(n-Math.round(n))<1e-8?'n = '+Math.round(n):'n ≈ '+n.toFixed(2);drawRawPeaks(el,n);return;}
 if(!model)return;
 el.querySelector('.curve-output').textContent=Math.abs(n-Math.round(n))<1e-8?'n = '+Math.round(n):'n ≈ '+n.toFixed(2);
 if(kind==='q_zoom'){
  const a=chart(el.querySelector('.first'),3,4.7,[0,.5,1,1.5,2,2.5,3],[0,2,4],'s',0);a.title('原 q(s)，虚线为 (s−1)²/2');a.shade(Math.max(0,1-2/r),1+2/r);a.curve(model.q,'#2F7FE0');a.curve(s=>(s-1)*(s-1)/2,'#2a2833',true);
  const z=chart(el.querySelector('.second'),4,8.5,[-4,-2,0,2,4],[0,4,8],'t');z.title('q_n(t) 随 n 变化，虚线为 t²/2');z.curve(t=>model.qN(n,t),'#2F7FE0');z.curve(t=>t*t/2,'#2a2833',true);
  const points=[];
  for(const p of [{s:.7,id:'A',color:'#EE8516'},{s:1.4,id:'B',color:'#8A6FE8'}]){const t=r*(p.s-1),y=n*model.q(p.s);a.point(p.s,model.q(p.s),p.id,p.color);const visible=z.point(t,y,p.id,p.color);points.push({id:p.id,s:p.s,t,y,visible})}
  window.webslidesInteractiveState={slide:page+1,kind,n,N:n,sourceWindow:[Math.max(0,1-2/r),1+2/r],domainLower:-r,domainOpen:true,points,model:model.id};
 }
}
function frame(time){
 const el=slides[page]&&slides[page].querySelector('.interactive'),state=el&&interactiveStates.get(el);
 if(state&&state.playing){if(state.last){const raw=el.dataset.kind==='raw_peaks',limit=raw?12:8,value=Math.min(limit,(raw?state.N:Math.log2(state.N))+(time-state.last)/(raw?1400:1900));state.N=raw?value:2**value;el.querySelector('.curve-scale').value=String(value);if(value>=limit){state.playing=false;el.querySelector('.curve-play').textContent=raw?'重播动画':'重播放缩';}}state.last=time;drawInteractive()}
 for(const [target,s] of interactiveStates)if(target!==el)s.last=0;
 requestAnimationFrame(frame);
}
hash();fit();show(page,step,false);document.fonts.ready.then(()=>{fit();show(page,step,false);document.documentElement.dataset.slidesReady='true';});requestAnimationFrame(frame);
window.webslidesAPI={go:(slide,nextStep=1)=>show(slide-1,nextStep-1),next,previous,fit};
})();
