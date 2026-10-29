/* Add a small set of concepts without moving the learner's existing landmarks. */
(() => {
  'use strict';
  const spacing=.8,GAP=205*spacing,UPSTREAM_GAP=Math.max(GAP,76+102+12);
  const noise=(id,salt=0)=>{
    let value=2166136261;
    for(const char of `${id}:${salt}`){value^=char.codePointAt(0);value=Math.imul(value,16777619);}
    return (value>>>0)/4294967296;
  };
  const bounds=(x,y)=>({left:x-107,right:x+107,top:y-76,bottom:y+102});
  const intersects=(a,b)=>a.left<b.right+8&&a.right+8>b.left&&a.top<b.bottom+12&&a.bottom+12>b.top;
  const position=point=>Array.isArray(point)?{x:point[0],y:point[1]}:point;
  function extend(previous,inputNodes,inputEdges,options={}){
    const nodes=inputNodes.filter(node=>node.kind!=='exercise'),ids=new Set(nodes.map(node=>node.id));
    const metadata=MTreeLearningMap.configuration(options.metadata||previous?.metadata);
    const width=Math.max(440,Number(previous?.width||options.width)||1160);
    const anchorId=options.focusId||previous?.focusId||previous?.points?.keys().next().value;
    const full=reason=>{
      const result=MTreeLearningMap.layout(nodes,inputEdges,{metadata,width,focusId:anchorId});
      const oldAnchor=previous?.points?.get(anchorId),newAnchor=result.points.get(anchorId);
      const oldPosition=oldAnchor?position(oldAnchor):null;
      const anchorDelta=oldPosition&&newAnchor?{x:newAnchor.x-oldPosition.x,y:newAnchor.y-oldPosition.y}:{x:0,y:0};
      return {...result,focusId:anchorId,shiftY:reason?anchorDelta.y:0,anchorDelta,
        addedIds:nodes.filter(node=>!previous?.points?.has(node.id)).map(node=>node.id),
        stableIds:[],reflowed:!!reason,reflowReason:reason||null,
        warnings:[...result.warnings,...(reason?['Intermediate prerequisites need more room; the local arrangement was adjusted.']:[])]};
    };
    if(!previous?.points?.size)return full(null);
    const byId=new Map(nodes.map(node=>[node.id,node]));
    const parents=new Map(nodes.map(node=>[node.id,new Set()])),children=new Map(nodes.map(node=>[node.id,new Set()])),neighbours=new Map(nodes.map(node=>[node.id,new Set()]));
    const add=(source,target,prerequisite)=>{
      if(source===target||!ids.has(source)||!ids.has(target))return;
      neighbours.get(source).add(target);neighbours.get(target).add(source);
      if(prerequisite){parents.get(target).add(source);children.get(source).add(target);}
    };
    inputEdges.forEach(edge=>add(edge.source,edge.target,edge.type==='prerequisite'));
    nodes.forEach(node=>(node.prerequisites||[]).forEach(source=>add(source,node.id,true)));
    const info=new Map(nodes.map(node=>[node.id,{stage:metadata.stages[0].id,difficulty:1,complexity:1,order:100,...metadata.subjects[node.subject],...metadata.nodes[node.id],...node.learning}]));
    const stageRank=new Map(metadata.stages.map((stage,index)=>[stage.id,index]));
    const compare=(a,b)=>(stageRank.get(info.get(a).stage)||0)-(stageRank.get(info.get(b).stage)||0)||info.get(a).difficulty-info.get(b).difficulty||info.get(a).complexity-info.get(b).complexity||a.localeCompare(b);
    const pending=new Map(nodes.map(node=>[node.id,parents.get(node.id).size]));
    const ready=nodes.filter(node=>!pending.get(node.id)).map(node=>node.id).sort(compare),order=[];
    while(ready.length){
      const id=ready.shift();order.push(id);
      children.get(id).forEach(child=>{pending.set(child,pending.get(child)-1);if(!pending.get(child)){ready.push(child);ready.sort(compare);}});
    }
    if(order.length!==nodes.length)throw new Error('The concept exploration contains a prerequisite cycle.');
    const points=new Map(),oldIds=[];
    previous.points.forEach((raw,id)=>{
      if(!ids.has(id))return;
      const old=position(raw);
      points.set(id,{...old,bounds:bounds(old.x,old.y)});oldIds.push(id);
    });
    if(!oldIds.length)return full(null);
    const oldSet=new Set(oldIds),lower=new Map(),upper=new Map();
    let conflict=false;
    // An unseen chain between two old nodes can leave no legal insertion interval.
    // Detect it before placing anything; never silently reverse a prerequisite.
    order.forEach(id=>{
      const floor=Math.max(-Infinity,...[...parents.get(id)].map(parent=>lower.get(parent)+GAP));
      if(oldSet.has(id)){
        if(points.get(id).y<floor-.01)conflict=true;
        lower.set(id,points.get(id).y);
      }else lower.set(id,floor);
    });
    [...order].reverse().forEach(id=>{
      // Reserve the full label clearance for unseen ancestors. A deep chain
      // placed from its earliest node must not consume the space by a fixed child.
      const gap=oldSet.has(id)?GAP:UPSTREAM_GAP;
      const ceiling=Math.min(Infinity,...[...children.get(id)].map(child=>upper.get(child)-gap));
      if(oldSet.has(id)){
        if(points.get(id).y>ceiling+.01)conflict=true;
        upper.set(id,points.get(id).y);
      }else upper.set(id,ceiling);
      if(lower.get(id)>upper.get(id)+.01)conflict=true;
    });
    if(conflict)return full('bridge-space');
    const left=118,right=width-118,span=right-left,clamp=x=>Math.max(left,Math.min(right,x));
    if(oldIds.some(id=>points.get(id).bounds.left<0||points.get(id).bounds.right>width))return full('canvas-width');
    const occupied=oldIds.map(id=>points.get(id).bounds),addedIds=[];
    for(const id of order){
      if(oldSet.has(id))continue;
      const data=info.get(id),parentPoints=[...parents.get(id)].map(parent=>points.get(parent)).filter(Boolean);
      const childPoints=[...children.get(id)].map(child=>points.get(child)).filter(Boolean);
      const neighbourPoints=[...neighbours.get(id)].map(neighbour=>points.get(neighbour)).filter(Boolean);
      const focus=points.get(anchorId),anchors=[...parentPoints,...childPoints];
      const reference=anchors.length?anchors:neighbourPoints.length?neighbourPoints:focus?[focus]:[];
      const centreX=reference.length?reference.reduce((sum,p)=>sum+p.x,0)/reference.length:left+span*noise(id,1);
      const preferredX=clamp(centreX+(noise(id,2)-.5)*Math.min(span*.75,300)*spacing);
      const minimum=Math.max(lower.get(id),...parentPoints.map(p=>p.y+GAP));
      const maximum=upper.get(id);
      if(minimum>maximum+.01)return full('bridge-space');
      let preferredY;
      if(parentPoints.length&&childPoints.length)preferredY=(Math.max(...parentPoints.map(p=>p.y))+Math.min(...childPoints.map(p=>p.y)))/2;
      else if(parentPoints.length)preferredY=Math.max(...parentPoints.map(p=>p.y))+(235+noise(id,3)*45)*spacing;
      else if(childPoints.length)preferredY=Math.min(...childPoints.map(p=>p.y))-(235+noise(id,3)*45)*spacing;
      else if(Number.isFinite(maximum))preferredY=maximum-(25+noise(id,4)*35)*spacing;
      else if(Number.isFinite(minimum))preferredY=minimum+(25+noise(id,4)*35)*spacing;
      else preferredY=(reference.length?reference.reduce((sum,p)=>sum+p.y,0)/reference.length:200)+(noise(id,5)-.5)*240*spacing;
      preferredY=Math.max(minimum,Math.min(maximum,preferredY));
      const xCandidates=[preferredX,left+noise(id,6)*12,right-noise(id,7)*12];
      for(let sample=0;sample<28;sample++)xCandidates.push(left+span*((noise(id,8)+sample*.61803398875)%1));
      const yCandidates=new Set([preferredY]);
      if(Number.isFinite(minimum))yCandidates.add(minimum);
      if(Number.isFinite(maximum))yCandidates.add(maximum);
      for(let step=1;step<Math.max(80,nodes.length*3);step++){
        const distance=(step*43+noise(id,step+20)*19)*spacing;
        if(preferredY-distance>=minimum)yCandidates.add(preferredY-distance);
        if(preferredY+distance<=maximum)yCandidates.add(preferredY+distance);
      }
      let best=null;
      const candidates=[...yCandidates].sort((a,b)=>Math.abs(a-preferredY)-Math.abs(b-preferredY)||a-b);
      for(const y of candidates){
        if(best&&Math.abs(y-preferredY)>best.score)break;
        for(const x of xCandidates){
          const box=bounds(x,y);
          if(occupied.some(other=>intersects(box,other)))continue;
          const score=Math.abs(y-preferredY)+Math.abs(x-preferredX)*.22;
          if(!best||score<best.score)best={x,y,score};
        }
      }
      if(!best)return full('collision-space');
      const x=Math.round(best.x*100)/100,y=Math.round(best.y*100)/100;
      const stageIndex=Math.max(stageRank.get(data.stage)||0,...parentPoints.map(p=>stageRank.get(p.stage)||0));
      const p={x,y,bounds:bounds(x,y),stage:metadata.stages[stageIndex]?.id||data.stage,
        difficulty:data.difficulty,complexity:data.complexity,depth:Math.max(-1,...parentPoints.map(parent=>parent.depth||0))+1,row:null,column:null};
      points.set(id,p);occupied.push(p.bounds);addedIds.push(id);
    }
    // Rounding must not move a tight insertion just across the dependency constraint.
    if(order.some(id=>[...parents.get(id)].some(parent=>points.get(parent).y+GAP>points.get(id).y+.015)))return full('rounding-space');
    const shiftY=Math.max(0,100-Math.min(...[...points.values()].map(p=>p.bounds.top)));
    if(shiftY)points.forEach((p,id)=>points.set(id,{...p,y:p.y+shiftY,bounds:bounds(p.x,p.y+shiftY)}));
    const height=Math.max(360,previous.height+shiftY,...[...points.values()].map(p=>p.bounds.bottom+55));
    const bands=metadata.stages.map((stage,index)=>{
      const group=[...points.values()].filter(p=>p.stage===stage.id);
      if(!group.length)return null;
      return {...stage,index,x:0,y:Math.max(35,Math.min(...group.map(p=>p.y))-120),width,height:0,count:group.length,rows:group.length};
    }).filter(Boolean).sort((a,b)=>a.y-b.y||a.index-b.index);
    for(let index=1;index<bands.length;index++)bands[index].y=Math.max(bands[index].y,bands[index-1].y+65);
    return {points,width,height,bands,metadata,focusId:anchorId,shiftY,anchorDelta:{x:0,y:shiftY},
      addedIds,stableIds:oldIds,reflowed:false,reflowReason:null,warnings:[]};
  }
  window.MTreeExplorationLayout=Object.freeze({extend});
})();
