/* Typed, direct knowledge relations. Layout height remains a separate concern. */
(() => {
  'use strict';
  const types = Object.freeze({
    prerequisite: {title:'强依赖',english:'Prerequisite',rank:0,marker:'prerequisite'},
    related: {title:'相关节点',english:'Related',rank:1},
    contains: {title:'主题包含',english:'Contains',rank:2,marker:'contains'},
    requires: {title:'习题需要',english:'Requires',rank:3,marker:'requires'}
  });
  const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const pairKey=(source,target)=>JSON.stringify([source,target].sort());
  function unique(edges) {
    const found=new Set(),result=[];
    for(const edge of edges||[]){
      if(!edge.source||!edge.target||edge.source===edge.target)continue;
      const type=edge.type||'related';
      const [source,target]=type==='related'?[edge.source,edge.target].sort():[edge.source,edge.target];
      const key=JSON.stringify([type,source,target]);
      if(found.has(key))continue;
      found.add(key);result.push({...edge,type,source,target});
    }
    return result.sort((a,b)=>pairKey(a.source,a.target).localeCompare(pairKey(b.source,b.target))||(types[a.type]?.rank??9)-(types[b.type]?.rank??9)||a.type.localeCompare(b.type)||a.source.localeCompare(b.source)||a.target.localeCompare(b.target));
  }
  const point=(points,id)=>{const value=points.get(id);return Array.isArray(value)?value:[value.x,value.y];};
  const sample=(curve,t)=>{const u=1-t;return [u*u*u*curve[0][0]+3*u*u*t*curve[1][0]+3*u*t*t*curve[2][0]+t*t*t*curve[3][0],u*u*u*curve[0][1]+3*u*u*t*curve[1][1]+3*u*t*t*curve[2][1]+t*t*t*curve[3][1]];};
  const derivative=(curve,t)=>{const u=1-t;return [3*u*u*(curve[1][0]-curve[0][0])+6*u*t*(curve[2][0]-curve[1][0])+3*t*t*(curve[3][0]-curve[2][0]),3*u*u*(curve[1][1]-curve[0][1])+6*u*t*(curve[2][1]-curve[1][1])+3*t*t*(curve[3][1]-curve[2][1])];};
  function boundary(curve,centre,radius,fromStart){
    let inside=fromStart?0:1,outside=fromStart?1:0;
    for(let step=0;step<32;step++){
      const t=(inside+outside)/2,p=sample(curve,t);
      if(Math.hypot(p[0]-centre[0],p[1]-centre[1])<radius)inside=t;else outside=t;
    }
    return (inside+outside)/2;
  }
  function pathFor(edge,points,radiusOf,offset){
    const start=point(points,edge.source),end=point(points,edge.target),dx=end[0]-start[0],dy=end[1]-start[1];
    const [first,last]=[edge.source,edge.target].sort(),a=point(points,first),b=point(points,last),length=Math.hypot(b[0]-a[0],b[1]-a[1])||1;
    const normal=[-(b[1]-a[1])/length,(b[0]-a[0])/length];
    const bend=offset+(Math.abs(dy)<90?55:0);
    const curve=[start,[start[0]+dx*.22+normal[0]*bend,start[1]+dy*.48+normal[1]*bend],[end[0]-dx*.22+normal[0]*bend,end[1]-dy*.48+normal[1]*bend],end];
    const sourceRadius=radiusOf(edge.source)+7,targetRadius=radiusOf(edge.target)+10;
    const t0=boundary(curve,start,sourceRadius,true),t1=boundary(curve,end,targetRadius,false);
    if(t0>=t1)return null;
    const p0=sample(curve,t0),p3=sample(curve,t1),d0=derivative(curve,t0),d1=derivative(curve,t1),span=(t1-t0)/3;
    const p1=[p0[0]+d0[0]*span,p0[1]+d0[1]*span],p2=[p3[0]-d1[0]*span,p3[1]-d1[1]*span];
    const coordinates=[p0,p1,p2,p3].map(p=>p.map(v=>Number(v.toFixed(3))));
    return {d:`M${coordinates[0].join(' ')} C${coordinates[1].join(' ')},${coordinates[2].join(' ')},${coordinates[3].join(' ')}`,start:coordinates[0],end:coordinates[3],sourceRadius,targetRadius,offset};
  }
  function render(nodes,rawEdges,points,{radiusOf=()=>52}={}){
    const registry=new Map(nodes.map(node=>[node.id,node]));
    const edges=unique(rawEdges).filter(edge=>registry.has(edge.source)&&registry.has(edge.target)&&points.has(edge.source)&&points.has(edge.target));
    const grouped=new Map();
    edges.forEach(edge=>{const pair=pairKey(edge.source,edge.target);if(!grouped.has(pair))grouped.set(pair,[]);grouped.get(pair).push(edge);});
    const paths=[];
    grouped.forEach(group=>group.forEach((edge,index)=>{
      const geometry=pathFor(edge,points,radiusOf,(index-(group.length-1)/2)*38);
      if(!geometry)return;
      const type=types[edge.type]||{title:edge.type,english:edge.type};
      const name=id=>{const node=registry.get(id);return `${node.title||id}${node.english_title?' / '+node.english_title:''}`;};
      const label=`${type.title} / ${type.english}: ${name(edge.source)} ${edge.type==='related'?'↔':'→'} ${name(edge.target)}`;
      paths.push({...edge,...geometry,label});
    }));
    const defs=`<defs class="relation-markers"><marker id="relation-prerequisite" viewBox="-9 -5 11 10" refX="0" refY="0" markerWidth="11" markerHeight="10" markerUnits="userSpaceOnUse" orient="auto"><path d="M-8 -4 L0 0 L-8 4"/></marker><marker id="relation-contains" viewBox="-8 -4 9 8" refX="0" refY="0" markerWidth="9" markerHeight="8" markerUnits="userSpaceOnUse" orient="auto"><path d="M0 0 L-3.5 -3 L-7 0 L-3.5 3 Z"/></marker><marker id="relation-requires" viewBox="-9 -5 11 10" refX="0" refY="0" markerWidth="11" markerHeight="10" markerUnits="userSpaceOnUse" orient="auto"><path d="M-8 -4 L0 0 L-8 4"/></marker></defs>`;
    const html=paths.map(edge=>`<path class="relation-edge ${esc(edge.type)}" data-source="${esc(edge.source)}" data-target="${esc(edge.target)}" data-edge-type="${esc(edge.type)}" d="${edge.d}" ${types[edge.type]?.marker?`marker-end="url(#relation-${types[edge.type].marker})"`:''} role="img" aria-label="${esc(edge.label)}"><title>${esc(edge.label)}</title></path>`).join('');
    return {html,defs,edges:paths};
  }
  function direct(nodeId,nodes,rawEdges,visibleIds=new Set(nodes.map(node=>node.id))){
    const registry=new Map(nodes.filter(node=>node.kind!=='exercise').map(node=>[node.id,node]));
    const edges=[...(rawEdges||[])];
    nodes.filter(node=>node.kind!=='exercise').forEach(node=>(node.prerequisites||[]).forEach(source=>edges.push({source,target:node.id,type:'prerequisite'})));
    const groups={prerequisites:[],dependents:[],related:[],contains:[],containedBy:[]};
    unique(edges).forEach(edge=>{
      if(!registry.has(edge.source)||!registry.has(edge.target))return;
      if(edge.type==='prerequisite'){
        if(edge.target===nodeId)groups.prerequisites.push(edge.source);
        if(edge.source===nodeId)groups.dependents.push(edge.target);
      }else if(edge.type==='related'){
        if(edge.source===nodeId)groups.related.push(edge.target);
        if(edge.target===nodeId)groups.related.push(edge.source);
      }else if(edge.type==='contains'){
        if(edge.source===nodeId)groups.contains.push(edge.target);
        if(edge.target===nodeId)groups.containedBy.push(edge.source);
      }
    });
    Object.keys(groups).forEach(key=>{groups[key]=[...new Set(groups[key])].map(id=>({...registry.get(id),outside:!visibleIds.has(id)})).sort((a,b)=>String(a.title||a.id).localeCompare(String(b.title||b.id),'zh-CN'));});
    return {...groups,node:registry.get(nodeId)};
  }
  function inspectorHTML(relations){
    const row=(key,title,english)=>{
      const nodes=relations[key];
      return `<div class="relation-inspector-row ${key}"><h3>${title}<span>${english} · ${nodes.length}</span></h3><p>${nodes.length?nodes.map(node=>`<button type="button" data-relation-node="${esc(node.id)}" title="${esc(node.english_title||'')}">${esc(node.title||node.id)}${node.outside?'<small>图外</small>':''}</button>`).join(''):'<span class="relation-none">暂无 / None</span>'}</p></div>`;
    };
    return `<p class="relation-inspector-heading">${esc(relations.node?.title||'')}<small>${esc(relations.node?.english_title||'')}</small></p>${row('prerequisites','直接前置','Prerequisites')}${row('dependents','后续依赖','Dependents')}${row('related','相关节点','Related')}${relations.contains.length?row('contains','主题包含','Contains'):''}${relations.containedBy.length?row('containedBy','所属主题','Contained in'):''}<p class="relation-inspector-note">仅直接关系 · 图外表示当前图谱未显示</p>`;
  }
  window.MTreeGraphRelations=Object.freeze({types,unique,render,direct,inspectorHTML});
})();
