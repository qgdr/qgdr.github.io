/* Exact 2D contribution rectangles from the author's drawing. © 2026 qgdr. */
(function () {
  'use strict';
  const data = JSON.parse(document.getElementById('sketch-blocks-data').textContent);
  const canvas = document.getElementById('board'), ctx = canvas.getContext('2d');
  const slider = document.getElementById('progress'), play = document.getElementById('play');
  const focus = document.getElementById('focus'), status = document.getElementById('status');
  const templateButton = document.getElementById('template');
  const copyControl = document.getElementById('copy-control'), copySelect = document.getElementById('copy');
  const {D, S, d, side} = data.spacing;
  let u = 0, playing = false, last = 0, focused = null;
  let templateMode = false, templateCopy = null;
  const W = 1440, H = 900, scale = 112;
  canvas.style.aspectRatio = `${W}/${H}`;
  const xy = (x, y) => [W / 2 + scale * x, 315 - scale * y];
  function position(c, progress = u) {
    return [data.origin[0] + D * c.r + d * c.a,
      data.origin[1] - S * c.j + S * progress * c.r - d * c.b];
  }
  function label(x, y, text, size = 24, color = '#64758A', align = 'center') {
    const [X,Y] = xy(x,y); ctx.fillStyle = color; ctx.font = `${size}px "Microsoft YaHei", sans-serif`;
    ctx.textAlign = align; ctx.textBaseline = 'middle'; ctx.fillText(text,X,Y);
  }
  function pixelLabel(x, y, text, size = 22, color = '#64758A', align = 'center') {
    ctx.fillStyle = color; ctx.font = `${size}px "Microsoft YaHei", sans-serif`;
    ctx.textAlign = align; ctx.textBaseline = 'middle'; ctx.fillText(text,x,y);
  }
  const subscripts = ['₀','₁','₂','₃','₄'];
  const copyNames = ['','一份 f','两份 f','三份 f'];
  function updateCopyControl() {
    copyControl.hidden = !templateMode;
    templateButton.classList.toggle('primary', templateMode);
    templateButton.setAttribute('aria-pressed', String(templateMode));
    templateButton.textContent = templateMode ? '收起 f 模板' : '看 f 模板';
    if (!templateMode) return;
    copySelect.replaceChildren();
    const all = document.createElement('option'); all.value=''; all.textContent='全部'; copySelect.append(all);
    for (let a=0;a<data.h[focused];a++) {
      const option=document.createElement('option'); option.value=String(a); option.textContent=`第 ${a+1} 份`;
      copySelect.append(option);
    }
    copySelect.value=templateCopy===null?'':String(templateCopy);
  }
  function drawTemplate() {
    pixelLabel(W/2,680,'同样的四组，构成一份 f 模板',22,'#223247');
    const start=486, row=730, unit=side*scale;
    data.f.forEach((count,j)=>{
      const X=start+D*scale*j;
      for(let b=0;b<count;b++) {
        const Y=row+d*scale*b;
        ctx.fillStyle=data.colors[j];ctx.fillRect(X-unit/2,Y-unit/2,unit,unit);
        ctx.strokeStyle='#F7F8F5';ctx.lineWidth=1;ctx.strokeRect(X-unit/2,Y-unit/2,unit,unit);
      }
      pixelLabel(X,817,String(j),19);
    });
    pixelLabel(W/2,855,'f = (1, 2, 1, 3)',24,'#367CC2');
    pixelLabel(1130,741,`h${subscripts[focused]} = ${data.h[focused]}`,26,'#C87510');
    pixelLabel(1130,780,templateCopy===null?copyNames[data.h[focused]]:`第 ${templateCopy+1} 份 f`,23,'#223247');
  }
  function draw() {
    const ratio = Math.max(1, window.devicePixelRatio || 1), width = canvas.clientWidth;
    const desiredW = Math.round(width * ratio), desiredH = Math.round(width * H / W * ratio);
    if (canvas.width !== desiredW || canvas.height !== desiredH) { canvas.width = desiredW; canvas.height = desiredH; }
    ctx.setTransform(canvas.width/W,0,0,canvas.height/H,0,0);
    ctx.clearRect(0,0,W,H); ctx.fillStyle = '#F7F8F5'; ctx.fillRect(0,0,W,H);
    ctx.strokeStyle = '#B4BCC4'; ctx.lineWidth = 1.2; ctx.beginPath();
    let p = xy(-5.45,2.18); ctx.moveTo(...p);ctx.lineTo(...xy(5.05,2.18));
    ctx.moveTo(...p);ctx.lineTo(...xy(-5.45,-2.9));ctx.stroke();
    for (let r=0;r<8;r++) label(data.origin[0]+D*r,2.34,String(r),23);
    label(5.27,2.34,'r',25);
    if (u < .001) {
      data.f.forEach((_,j)=>label(-5.77,data.origin[1]-S*j,String(j),23)); label(-6.12,-1.4,'j',25);
    } else if (u > .999) {
      data.h.forEach((_,k)=>label(-5.77,data.origin[1]+S*k,String(k),23)); label(-6.12,.7,'k',25);
    }
    data.cells.forEach(c => {
      const [X,Y] = xy(...position(c)); const s=side*scale;
      const selected=focused===null||c.k===focused;
      const selectedCopy=!templateMode||templateCopy===null||c.a===templateCopy;
      ctx.globalAlpha = templateMode ? (selected&&selectedCopy?1:.15) : (selected?1:.36);
      ctx.fillStyle = data.colors[c.j]; ctx.fillRect(X-s/2,Y-s/2,s,s);
      ctx.strokeStyle = '#F7F8F5';ctx.lineWidth=1;ctx.strokeRect(X-s/2,Y-s/2,s,s);
      if (focused !== null && c.k === focused && selectedCopy) { ctx.strokeStyle=templateMode?'#223247':'#C87510';ctx.lineWidth=templateMode?1.9:1.6;ctx.strokeRect(X-s/2,Y-s/2,s,s); }
    });
    ctx.globalAlpha=1;
    if (templateMode) drawTemplate();
    slider.value=String(u);
    status.textContent=templateMode?`第 k = ${focused} 排：把 f 模板向右移 ${focused} 格，放 ${copyNames[data.h[focused]]}，所以也是 h ∗ f。`:u<.001?'按输入 j 向下分排：矩形宽 hₖ，高 fⱼ':u>.999?'按模板 k 向上分排：同 k 的斜线成为水平排':'每列同时向上平移：右侧移动更多，原点固定';
  }
  function stop() { playing=false;play.textContent='播放 / Play'; }
  function leaveTemplate() {templateMode=false;templateCopy=null;updateCopyControl();}
  function seek(value) {stop();leaveTemplate();u=Math.max(0,Math.min(1,Number(value)));draw();}
  function setTemplate(enabled, copy=null) {
    stop();templateMode=Boolean(enabled);templateCopy=copy===null?null:Math.max(0,Math.floor(Number(copy)));
    if(templateMode) {
      u=1;if(focused===null)focused=0;focus.value=String(focused);
      if(templateCopy>=data.h[focused])templateCopy=null;
    }
    updateCopyControl();draw();
  }
  function tick(t) { if(!playing)return; if(last)u=Math.min(1,u+(t-last)/10000);last=t;draw();if(u>=1){stop();return;}requestAnimationFrame(tick); }
  play.addEventListener('click',()=>{if(playing){stop();return;}leaveTemplate();if(u>=1)u=0;playing=true;last=0;play.textContent='暂停 / Pause';requestAnimationFrame(tick);});
  slider.addEventListener('input',()=>seek(slider.value));
  document.getElementById('initial').addEventListener('click',()=>seek(0));
  document.getElementById('final').addEventListener('click',()=>seek(1));
  focus.addEventListener('change',()=>{focused=focus.value===''?null:Number(focus.value);if(templateMode){if(focused===null){leaveTemplate();}else{templateCopy=null;updateCopyControl();}}draw();});
  templateButton.addEventListener('click',()=>setTemplate(!templateMode));
  copySelect.addEventListener('change',()=>{templateCopy=copySelect.value===''?null:Number(copySelect.value);draw();});
  new ResizeObserver(draw).observe(canvas);
  window.SketchBlocks={seek,position,setTemplate,getState:()=>({progress:u,playing,focused,templateMode,templateCopy,unitCount:data.cells.length,
    f:[...data.f],h:[...data.h],positions:data.cells.map(c=>({...c,position:position(c)}))})};
  draw();
})();
