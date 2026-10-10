/* A continuous, editorial depth map. Geometry never invents prerequisites. */
(function (global) {
  'use strict';
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const clamp = (value,min,max) => Math.min(max,Math.max(min,value));
  const stageRanks = {foundation:0,connections:1,methods:2,synthesis:3};
  const bandRanks = {foundations:0,core:1,advanced:2};
  // Uneven lateral currents, not rows or columns. Depth is computed from metadata.
  const currents = [.34,.67,.22,.76,.47,.25,.72,.43,.24,.77,.48,.30,.68];
  const mobileCurrents = [.36,.70,.32,.68,.40,.72,.32,.64,.35,.70,.39,.67,.34];
  function layout(subjects, options = {}) {
    const metadata = options.metadata || {};
    const ranks = Object.fromEntries((metadata.stages || []).map((stage,index)=>[stage.id,Number(stage.rank ?? index)]));
    const bands = Object.fromEntries((metadata.subject_bands || []).map((band,index)=>[band.id,Number(band.rank ?? index)]));
    const items = subjects.map(subject=>{
      const settings = {...subject,...metadata.subjects?.[subject.id]};
      const stage = ranks[settings.stage] ?? stageRanks[settings.stage] ?? 0;
      const band = bands[settings.band] ?? bandRanks[settings.band] ?? 0;
      const difficulty = clamp(Number(settings.difficulty)||1,1,3);
      const complexity = clamp(Number(settings.complexity)||1,1,3);
      return {...settings,depth:band*1.25+stage*.85+(difficulty-1)*.5+(complexity-1)*.3};
    }).sort((a,b)=>a.depth-b.depth || (Number(a.order)||0)-(Number(b.order)||0) || a.id.localeCompare(b.id));
    const maxDepth = Math.max(1,...items.map(item=>item.depth));
    const height = Math.max(950,items.length*113+220);
    const mobileHeight = Math.max(1050,items.length*151+230);
    const last = Math.max(1,items.length-1);
    items.forEach((item,index)=>{
      // A little rank spacing makes equal scores readable without pretending to
      // distinguish their mathematical difficulty. No random layout on refresh.
      const progress = .65*item.depth/maxDepth+.35*index/last;
      item.x = currents[index%currents.length];
      item.mx = mobileCurrents[index%mobileCurrents.length];
      item.y = 125+progress*(height-310);
      item.my = 128+progress*(mobileHeight-320);
      item.index = index;
      item.tone = clamp(item.depth/maxDepth,0,1);
      // Resolve neighbouring geometry by opening the water between concepts.
      // Their order remains the same, including on compact displays.
      const previous = items.slice(0,index);
      for (const other of previous) {
        if (Math.abs(other.x-item.x)<.25 && item.y-other.y<155) item.y=other.y+155;
        if (Math.abs(other.mx-item.mx)<.47 && item.my-other.my<149) item.my=other.my+149;
      }
      if(index) item.y=Math.max(item.y,items[index-1].y+24);
    });
    return {items,height:Math.max(height,...items.map(item=>item.y+185)),mobileHeight:Math.max(mobileHeight,...items.map(item=>item.my+190))};
  }
  function connections(nodes = [], edges = [], items = []) {
    const valid = new Map(nodes.filter(node=>node.kind!=='exercise').map(node=>[node.id,node]));
    const subjects = new Set(items.map(item=>item.id));
    const found = new Map();
    const recorded = new Set();
    const add = (source,target) => {
      const key=`${source}\0${target}`;
      if(recorded.has(key))return;recorded.add(key);
      const a=valid.get(source)?.subject,b=valid.get(target)?.subject;
      if(!a||!b||a===b||!subjects.has(a)||!subjects.has(b))return;
      const pair=`${a}\0${b}`;
      const entry=found.get(pair)||{source:a,target:b,count:0};
      entry.count++;found.set(pair,entry);
    };
    edges.filter(edge=>edge.type==='prerequisite').forEach(edge=>add(edge.source,edge.target));
    valid.forEach(node=>(node.prerequisites || []).forEach(source=>add(source,node.id)));
    return [...found.values()];
  }
  function connectionSVG(result, links, mobile) {
    const width=mobile?360:1000,height=mobile?result.mobileHeight:result.height;
    const byId=new Map(result.items.map(item=>[item.id,item]));
    return `<svg class="ocean-relationships ${mobile?'ocean-relationships-mobile':'ocean-relationships-desktop'}" viewBox="0 0 ${width} ${height}" preserveAspectRatio="none" aria-hidden="true">${links.map(link=>{
      const a=byId.get(link.source),b=byId.get(link.target);
      const ax=(mobile?a.mx:a.x)*width,ay=mobile?a.my:a.y,bx=(mobile?b.mx:b.x)*width,by=mobile?b.my:b.y;
      const bend=Math.max(90,Math.abs(by-ay)*.4);
      const direction=by>=ay?1:-1;
      return `<path data-ocean-source="${esc(a.id)}" data-ocean-target="${esc(b.id)}" d="M${ax.toFixed(1)} ${ay.toFixed(1)} C${ax.toFixed(1)} ${(ay+direction*bend).toFixed(1)},${bx.toFixed(1)} ${(by-direction*bend).toFixed(1)},${bx.toFixed(1)} ${by.toFixed(1)}" vector-effect="non-scaling-stroke"/>`;
    }).join('')}</svg>`;
  }
  function contours() {
    return `<svg class="ocean-isobaths" viewBox="0 0 1000 1700" preserveAspectRatio="none" aria-hidden="true"><g><path d="M-180 290 C180 40 260 380 560 190 S980 110 1190 390"/><path d="M-180 310 C180 60 260 400 560 210 S980 130 1190 410"/><path d="M-180 338 C180 88 260 428 560 238 S980 158 1190 438"/><path d="M-160 680 C170 900 390 470 660 660 S980 820 1160 660"/><path d="M-160 705 C170 925 390 495 660 685 S980 845 1160 685"/><path d="M-160 738 C170 958 390 528 660 718 S980 878 1160 718"/><path d="M-120 1120 C110 920 420 1340 690 1100 S1030 1070 1160 1230"/><path d="M-120 1150 C110 950 420 1370 690 1130 S1030 1100 1160 1260"/><path d="M-120 1188 C110 988 420 1408 690 1168 S1030 1138 1160 1298"/><path d="M-120 1520 C240 1660 380 1400 660 1510 S940 1600 1170 1430"/></g></svg>`;
  }
  function render(subjects, options = {}) {
    const result=layout(subjects,options);
    const links=connections(options.nodes,options.edges,result.items);
    const connected = id => [...new Set(links.filter(link=>link.source===id||link.target===id).map(link=>link.source===id?link.target:link.source))];
    return `<div class="depth-ocean" role="group" aria-label="数学深海图 Mathematical depth map" style="--ocean-height:${result.height.toFixed(1)}px;--ocean-mobile-height:${result.mobileHeight.toFixed(1)}px">${contours()}${connectionSVG(result,links,false)}${connectionSVG(result,links,true)}<p class="ocean-surface-label">从熟悉的概念，向更深处 <span>Explore at your own depth</span></p>${result.items.map(item=>{
      const English=item.english||item.english_title||'';
      const relationIds=connected(item.id);
      const relatedTitles=result.items.filter(other=>relationIds.includes(other.id)).map(other=>other.title);
      const count=Number(item.count)||0;
      return `<button type="button" class="ocean-island ocean-island-${item.index%4} ${item.id==='linear-algebra'?'ocean-island-featured':''} ${item.role==='toolbox'?'ocean-island-toolbox':''}" data-course="${esc(item.id)}" data-ocean-related="${esc(relationIds.join(' '))}" data-depth="${item.depth.toFixed(2)}" style="--island-x:${(item.x*100).toFixed(2)}%;--island-y:${item.y.toFixed(1)}px;--island-mobile-x:${(item.mx*100).toFixed(2)}%;--island-mobile-y:${item.my.toFixed(1)}px;--island-depth:${item.tone.toFixed(3)}" aria-label="${esc(item.title)} / ${esc(English)}，${count} 个知识节点${relatedTitles.length?`，与${esc(relatedTitles.join('、'))}有节点先修联系`:''}"><span class="ocean-island-title">${esc(item.title)}</span><small class="ocean-island-english" lang="en">${esc(English)}</small><em>${item.role==='toolbox'?'伴随学习 · Toolbox':`${count} 个知识节点`}</em><span class="ocean-island-arrow" aria-hidden="true">↗</span></button>`;
    }).join('')}<p class="ocean-depth-note">越往深处，概念越抽象、联系越丰富。<br><span>高度参考学习阶段、难度与复杂度；先修以具体节点为准。</span>${links.length?'<span class="ocean-connection-note">悬停或聚焦海域，查看现有内容的跨学科先修联系。</span>':''}</p></div>`;
  }
  function highlight(button) {
    const root=button.closest('.depth-ocean');if(!root)return;
    root.classList.add('ocean-is-focused');
    const id=button.dataset.course, related=new Set((button.dataset.oceanRelated||'').split(' '));
    root.querySelectorAll('.ocean-island').forEach(island=>{
      island.classList.toggle('ocean-is-current',island===button);
      island.classList.toggle('ocean-is-related',related.has(island.dataset.course));
    });
    root.querySelectorAll('[data-ocean-source]').forEach(path=>path.classList.toggle('ocean-link-active',path.dataset.oceanSource===id||path.dataset.oceanTarget===id));
  }
  function reset(root) {
    const focused=root.querySelector('.ocean-island:focus-visible');
    if(focused){highlight(focused);return;}
    root.classList.remove('ocean-is-focused');
    root.querySelectorAll('.ocean-is-current,.ocean-is-related,.ocean-link-active').forEach(element=>element.classList.remove('ocean-is-current','ocean-is-related','ocean-link-active'));
  }
  if(typeof document!=='undefined') {
    document.addEventListener('pointerover',event=>{const button=event.target.closest?.('.ocean-island');if(button)highlight(button);});
    document.addEventListener('pointerout',event=>{
      const button=event.target.closest?.('.ocean-island');
      if(button&&!button.contains(event.relatedTarget))reset(button.closest('.depth-ocean'));
    });
    document.addEventListener('focusin',event=>{const button=event.target.closest?.('.ocean-island');if(button)highlight(button);});
    document.addEventListener('focusout',event=>{
      const button=event.target.closest?.('.ocean-island');
      if(button)queueMicrotask(()=>{if(button.isConnected)reset(button.closest('.depth-ocean'));});
    });
  }
  global.MTreeOceanMap={render,layout,connections};
})(typeof window==='undefined'?globalThis:window);
