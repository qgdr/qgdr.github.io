/* Stable ocean-depth layout. Content metadata lives in learning-layout.toml. */
(function (global) {
  'use strict';
  const escape = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const fallbackStages = [
    {id:'foundation',rank:0,title:'基本概念',english_title:'Foundations',description:'先认识对象与语言'},
    {id:'connections',rank:1,title:'结构与联系',english_title:'Connections',description:'把基本概念连起来'},
    {id:'methods',rank:2,title:'方法与定理',english_title:'Methods',description:'建立推理与计算方法'},
    {id:'synthesis',rank:3,title:'综合与应用',english_title:'Synthesis',description:'组合已有方法解决问题'}
  ];
  const fallbackBands = [
    {id:'foundations',rank:0,title:'基础语言',english_title:'Mathematical foundations',description:'从熟悉的运算、变化与空间开始'},
    {id:'core',rank:1,title:'本科核心',english_title:'Undergraduate core',description:'走向严谨的分析、结构与随机性'},
    {id:'advanced',rank:2,title:'进阶与应用',english_title:'Advanced connections',description:'组合多个学科，研究方程与算法'}
  ];
  function configuration(metadata = {}) {
    const stages = (metadata.stages?.length ? metadata.stages : fallbackStages).slice().sort((a,b)=>a.rank-b.rank);
    const subjectBands = (metadata.subject_bands?.length ? metadata.subject_bands : fallbackBands).slice().sort((a,b)=>a.rank-b.rank);
    return {...metadata,stages,subject_bands:subjectBands,subjects:metadata.subjects || {},nodes:metadata.nodes || {}};
  }
  function learning(node, metadata) {
    return {stage:metadata.stages[0].id,difficulty:1,complexity:1,order:100,...metadata.subjects[node.subject],...metadata.nodes[node.id],...node.learning};
  }
  function orderedSteps(steps = []) {
    return [...new Set(steps.map(step=>typeof step==='string'?step:step.node || step.node_id).filter(Boolean))];
  }
  function layout(inputNodes, inputEdges, options = {}) {
    const metadata = configuration(options.metadata);
    const nodes = inputNodes.filter(node=>node.kind!=='exercise');
    const byId = new Map(nodes.map(node=>[node.id,node]));
    const ids = new Set(byId.keys());
    const parent = new Map(nodes.map(node=>[node.id,new Set()]));
    const child = new Map(nodes.map(node=>[node.id,new Set()]));
    const details = new Map(nodes.map(node=>[node.id,learning(node,metadata)]));
    const route = orderedSteps(options.routeSteps || []);
    const routeIndex = new Map(route.map((id,index)=>[id,index]));
    const warnings = [];
    function add(source,target) {
      if(source!==target && ids.has(source) && ids.has(target)) {
        parent.get(target).add(source);child.get(source).add(target);
      }
    }
    inputEdges.filter(edge=>edge.type==='prerequisite').forEach(edge=>add(edge.source,edge.target));
    nodes.forEach(node=>(node.prerequisites || []).forEach(source=>add(source,node.id)));
    function reaches(source,target,seen = new Set()) {
      if(source===target)return true;
      if(seen.has(source))return false;
      seen.add(source);
      return [...(child.get(source) || [])].some(next=>reaches(next,target,seen));
    }
    const visibleRoute = route.filter(id=>ids.has(id));
    visibleRoute.slice(1).forEach((target,index)=>{
      const source=visibleRoute[index];
      if(reaches(target,source))warnings.push(`Route order ${source} → ${target} conflicts with a prerequisite; prerequisites take precedence.`);
      else add(source,target);
    });
    const rank = new Map(metadata.stages.map((stage,index)=>[stage.id,index]));
    const compare = (a,b) => {
      const aa=details.get(a),bb=details.get(b);
      return (routeIndex.get(a) ?? Number.MAX_SAFE_INTEGER)-(routeIndex.get(b) ?? Number.MAX_SAFE_INTEGER)
        || (rank.get(aa.stage) ?? 0)-(rank.get(bb.stage) ?? 0)
        || aa.difficulty-bb.difficulty || aa.complexity-bb.complexity || aa.order-bb.order || a.localeCompare(b);
    };
    const pending = new Map(nodes.map(node=>[node.id,parent.get(node.id).size]));
    const ready=nodes.filter(node=>!pending.get(node.id)).map(node=>node.id).sort(compare);
    const topological=[];
    while(ready.length) {
      const id=ready.shift();topological.push(id);
      child.get(id).forEach(next=>{
        pending.set(next,pending.get(next)-1);
        if(!pending.get(next)){ready.push(next);ready.sort(compare);}
      });
    }
    if(topological.length!==nodes.length)throw new Error('The learning map contains a prerequisite cycle. Fix the content graph before displaying it.');
    const effectiveStage=new Map(),depth=new Map();
    topological.forEach(id=>{
      const requested=rank.get(details.get(id).stage) ?? 0;
      const stage=Math.max(requested,...[...parent.get(id)].map(source=>effectiveStage.get(source)));
      effectiveStage.set(id,stage);
      depth.set(id,Math.max(-1,...[...parent.get(id)].filter(source=>effectiveStage.get(source)===stage).map(source=>depth.get(source)))+1);
    });
    const width=Math.max(440,Number(options.width)||1160);
    const left=118,right=width-118,span=right-left;
    const points=new Map(),bands=[],occupied=[];
    const noise=(id,salt=0)=>{
      let value=2166136261;
      for(const char of `${id}:${salt}`){value^=char.codePointAt(0);value=Math.imul(value,16777619);}
      return (value>>>0)/4294967296;
    };
    const bounds=(x,y)=>({left:x-107,right:x+107,top:y-76,bottom:y+102});
    const intersects=(a,b)=>a.left<b.right+8&&a.right+8>b.left&&a.top<b.bottom+12&&a.bottom+12>b.top;
    const clamp=x=>Math.max(left,Math.min(right,x));
    let cursor=45;
    metadata.stages.forEach((stage,stageIndex)=>{
      const group=topological.filter(id=>effectiveStage.get(id)===stageIndex);
      if(!group.length)return;
      const bandStart=cursor;
      group.forEach((id,index)=>{
        const info=details.get(id),parents=[...parent.get(id)].map(source=>points.get(source)).filter(Boolean);
        const parentX=parents.length?parents.reduce((sum,p)=>sum+p.x,0)/parents.length:null;
        const rootX=left+span*((noise(id,1)+index*.61803398875)%1);
        const preferredX=parentX===null?rootX:clamp(parentX+(noise(id,2)-.5)*Math.min(400,span*.95));
        const minimumY=Math.max(bandStart+108+noise(id,3)*88,...parents.map(p=>p.y+205+noise(id,4)*65));
        const preferredY=Math.max(minimumY,bandStart+162+(info.difficulty-1)*104+(info.complexity-1)*58+depth.get(id)*74+(noise(id,5)-.5)*120);
        let best=null;
        // Search continuous positions, not fixed rows/columns. Collision boxes include English labels.
        for(let descent=0;descent<Math.max(180,nodes.length*5);descent++){
          const y=preferredY+descent*51+(descent?noise(id,descent+20)*29:0);
          if(best&&y-preferredY>best.score)break;
          const candidates=[preferredX,left+noise(id,8)*16,right-noise(id,9)*16];
          for(let sample=0;sample<24;sample++)candidates.push(left+span*((noise(id,7)+sample*.61803398875)%1));
          for(const x of candidates){
            const box=bounds(x,y);
            if(occupied.some(other=>intersects(box,other)))continue;
            const score=(y-preferredY)+Math.abs(x-preferredX)*.22;
            if(!best||score<best.score)best={x,y,box,score};
          }
        }
        if(!best)throw new Error(`Cannot place learning node ${id} without overlapping its label.`);
        const x=Math.round(best.x*100)/100,y=Math.round(best.y*100)/100,box=bounds(x,y);
        points.set(id,{x,y,stage:stage.id,depth:depth.get(id),row:index,column:null,
          difficulty:info.difficulty,complexity:info.complexity,bounds:box});
        occupied.push(box);
      });
      cursor=Math.max(...group.map(id=>points.get(id).y))+140;
      bands.push({...stage,index:stageIndex,x:0,y:bandStart,width,height:cursor-bandStart,count:group.length,rows:group.length});
    });
    return {points,width,height:Math.max(360,cursor+45),bands,warnings,metadata};
  }
  function bandsSVG(result) {
    const w=result.width,h=result.height;
    const contours=Array.from({length:Math.max(5,Math.ceil(h/360))},(_,i)=>{
      const y=120+i*330;
      return `<path d="M-80 ${y+50} C${w*.22} ${y-130},${w*.51} ${y+150},${w+80} ${y-60}"/>`;
    }).join('');
    return `<g class="learning-bands ocean-depth" aria-hidden="true"><defs><linearGradient id="knowledge-water" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#e7f3f0"/><stop offset=".32" stop-color="#dfedf1"/><stop offset=".7" stop-color="#d7e3ee"/><stop offset="1" stop-color="#ccd8e7"/></linearGradient><radialGradient id="surface-light"><stop stop-color="#fff" stop-opacity=".72"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient></defs><rect class="continuous-water" width="${w}" height="${h}" fill="url(#knowledge-water)"/><ellipse cx="${w*.42}" cy="0" rx="${w*.83}" ry="680" fill="url(#surface-light)"/><g class="depth-contours">${contours}</g></g>`;
  }
  function oceanData(subjects, options = {}) {
    const metadata=configuration(options.metadata);
    const bands=metadata.subject_bands.map(band=>({...band,subjects:[]}));
    subjects.forEach(subject=>{
      const item={...subject,...metadata.subjects[subject.id]};
      const band=bands.find(b=>b.id===item.band) || bands[0];
      band.subjects.push(item);
    });
    bands.forEach(band=>band.subjects.sort((a,b)=>(a.order ?? 100)-(b.order ?? 100)||a.id.localeCompare(b.id)));
    return bands.filter(band=>band.subjects.length);
  }
  function ocean(subjects,options = {}) {
    return `<div class="curriculum-ocean">${oceanData(subjects,options).map((band,index)=>`<section class="ocean-band" data-learning-band="${escape(band.id)}"><header class="ocean-band-heading"><span class="ocean-band-number">${String(index+1).padStart(2,'0')}</span><div><h3>${escape(band.title)} <small>${escape(band.english_title)}</small></h3><p>${escape(band.description)}</p></div></header><div class="ocean-band-subjects">${band.subjects.map(subject=>`<button class="subject-bubble ${subject.id==='linear-algebra'?'active':''} ${subject.role==='toolbox'?'toolbox-subject':''}" data-course="${escape(subject.id)}"><span>${escape(subject.title)}</span><small>${escape(subject.english || subject.english_title || '')}</small><em>${subject.role==='toolbox'?'伴随学习 · Toolbox':`${Number(subject.count)||0} 个知识节点`}</em></button>`).join('')}</div></section>`).join('')}<p class="ocean-order-note">从上往下，逐步连接更复杂的问题。分区表示常见学习阶段；具体学习顺序以节点的先修关系为准。</p></div>`;
  }
  global.MTreeLearningMap={layout,bandsSVG,ocean,oceanData,configuration};
})(typeof window==='undefined'?globalThis:window);
