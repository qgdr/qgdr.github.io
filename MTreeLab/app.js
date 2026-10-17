/* MTree's interface reads the file-backed registry. No generated lesson text or AI calls. */
'use strict';
const app = document.getElementById('app');
const STATIC_SITE=window.MTreeDataSource?.isStatic===true;
const writer = document.getElementById('writer');
const writerForm = document.getElementById('writer-form');
const STORAGE_KEY = 'mtree.learning.v1';
const PRIMARY_IDS = new Set(['la.determinant-area', 'la.matrix-norm', 'la.svd']);
const PLACEHOLDER_IDS = new Set(['la.linear-independence','la.basis-dimension','la.inner-product','la.eigenvalues','la.orthogonal-projection','la.rank','la.least-squares','la.vector-norm','la.orthogonal-matrix','la.invertibility']);
const SUBJECTS = {
  'linear-algebra':['线性代数','Linear Algebra'],
  'mathematical-analysis':['数学分析','Mathematical Analysis'],
  'real-analysis':['实分析','Real Analysis'],
  'signals-and-systems':['信号与系统','Signals and Systems'],
  'calculus':['微积分','Calculus'],
  'complex-analysis':['复分析','Complex Analysis'],
  'topology':['拓扑学','Topology'],
  'functional-analysis':['泛函分析','Functional Analysis'],
  'partial-differential-equations':['偏微分方程','Partial Differential Equations'],
  'finite-difference-methods':['有限差分方法','Finite Difference Methods'],
  'fractional-calculus':['分数阶微积分','Fractional Calculus'],
  'convex-optimization':['凸优化','Convex Optimization'],
  'optimization':['优化','Optimization'],
  'probability-combinatorics':['概率与组合','Probability and Combinatorics'],
  'computational-tools':['科学计算工具','Computational Tools'],
  'geometry':['几何','Geometry'],
  'discrete-mathematics':['离散数学','Discrete Mathematics'],
  'number-theory':['数论','Number Theory'],
  'differential-equations':['微分方程','Differential Equations']
};
let saved;
try { saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}'); } catch { saved = {}; }
const state = {
  graph: {nodes:[],edges:[]}, loaded:false, route:'home', subject:'linear-algebra', lesson:null, selected:null,
  read:new Set(Array.isArray(saved.read) ? saved.read : []), understood:new Set(Array.isArray(saved.understood) ? saved.understood : []), readingPositions:saved.positions || {},
  readingStack:[], pendingRestore:null, readingMapReturn:null, mapCamera:{x:0,y:0,scale:1},
  mapScroll:0, mapViews:{}, mapContextHash:null, explorations:{}, exploration:null, routeVersion:0, writerEdit:null, searchTimer:null, exerciseReturn:'#/exercises', exerciseContextHash:null, exerciseViews:{},
  bottomAt:0,lastWheel:0,touchStartY:null,touchArmed:false,saveTimer:null
};
state.articleRead=new Set(Array.isArray(saved.articleRead)?saved.articleRead:[]);
if(!Array.isArray(saved.articleRead))state.read.forEach(id=>state.articleRead.add(`${id}.main`));
state.articleSelections=saved.articleSelections&&typeof saved.articleSelections==='object'?saved.articleSelections:{};
state.articlePositions=saved.articlePositions&&typeof saved.articlePositions==='object'?saved.articlePositions:{};
state.routes=[];state.routesLoaded=false;state.currentRouteId=null;state.learningRoute=null;state.routeGraphs={};
const escapeHTML = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const byId = id => state.graph.nodes.find(node => node.id === id);
const titleOf = id => byId(id)?.title || id;
const isExercise = node => node?.kind === 'exercise';
const knowledgeNodes = () => state.graph.nodes.filter(node => !isExercise(node));
const exerciseNodes = () => state.graph.nodes.filter(isExercise);
const nodeSubjects = node => [...new Set([node?.subject,...(node?.subjects||[])].filter(Boolean))];
const belongsToSubject = (node,subject) => nodeSubjects(node).includes(subject);
const subjectForNode = (node,preferred=state.subject) => belongsToSubject(node,preferred)?preferred:node?.subject||preferred;
const directlyRequired = node => [...new Set(node?.requires || state.graph.edges.filter(edge => edge.type === 'requires' && edge.target === node?.id).map(edge => edge.source))].filter(id => byId(id) && !isExercise(byId(id)));
const progressClass = id => state.understood.has(id) ? 'understood' : state.read.has(id) ? 'read' : '';
const progressLabel = id => state.understood.has(id) ? '已理解 / Understood' : state.read.has(id) ? '已读 / Read' : '未读 / Unread';
function authorReviewApproved(node) {
  const approved=node?.approved_article_ids||[];
  if(node?.author_review_status!=='approved'||!approved.length)return false;
  const step=state.learningRoute?.steps?.find(item=>item.node_id===node.id);
  const selected=step&&(state.articleSelections[selectionKey(node.id)]||step.article_ids);
  return selected ? selected.length>0&&selected.every(id=>approved.includes(id)) : true;
}
const authorReviewClass = node => authorReviewApproved(node) ? 'author-approved' : 'author-unreviewed';
const authorReviewLabel = node => authorReviewApproved(node) ? '含已审核讲义 / Reviewed article' : '未通过作者审核 / Unreviewed';
const isPlaceholder = node => !!node.placeholder || node.content_state === 'empty' || node.content_status === 'placeholder' || node.status === 'placeholder';
function subjectInfo(subject) {
  const names = SUBJECTS[subject] || [subject, String(subject || 'Mathematics').split('-').map(word=>word ? word[0].toUpperCase()+word.slice(1) : '').join(' ')];
  return {id:subject,title:names[0],english:names[1]};
}
function availableSubjects() {
  return [...new Set(knowledgeNodes().flatMap(nodeSubjects))]
    .sort((a,b)=>a==='linear-algebra'?-1:b==='linear-algebra'?1:subjectInfo(a).title.localeCompare(subjectInfo(b).title,'zh-CN'))
    .map(subject=>({...subjectInfo(subject),count:knowledgeNodes().filter(node=>belongsToSubject(node,subject)).length}));
}
function mapHash(subject=state.subject,routeId=state.currentRouteId) { return `#/map/${encodeURIComponent(subject || 'linear-algebra')}${routeId?`?route=${encodeURIComponent(routeId)}`:''}`; }
function conceptHash(id){return `${mapHash(subjectForNode(byId(id)),null)}?focus=${encodeURIComponent(id)}`;}
function exploreConcept(id){if(isExercise(byId(id)))openLesson(id);else navigate(conceptHash(id));}
function selectionKey(nodeId,routeId=state.currentRouteId){return `${routeId||'_reading'}/${nodeId}`;}
function displayedArticles(lesson){
  if(Array.isArray(lesson.articles)&&lesson.articles.length)return lesson.articles;
  return [{...lesson,id:`${lesson.id}.main`,node_id:lesson.id}];
}
function readingKey(lesson){return `${selectionKey(lesson.id)}/${displayedArticles(lesson).map(article=>article.id).join(',')}`;}
function lessonHash(id,{anchor='',articles=null,routeId=state.currentRouteId}={}){
  const params=new URLSearchParams();if(routeId)params.set('route',routeId);if(articles?.length)params.set('articles',articles.join(','));if(anchor)params.set('anchor',anchor);
  return `#/learn/${encodeURIComponent(id)}${params.size?'?'+params:''}`;
}
function setSubject(subject) {
  state.subject=subject || 'linear-algebra';
  const link=document.getElementById('explore-link');
  if(link)link.href=mapHash();
}
function rememberMap() {
  if(state.route==='map')state.mapViews[state.mapContextHash||mapHash()]={camera:{...state.mapCamera},scroll:window.scrollY};
}
function rememberExercises() {
  if(state.route!=='exercises'||!state.exerciseContextHash)return;
  state.exerciseReturn=state.exerciseContextHash;
  state.exerciseViews[state.exerciseContextHash]={scroll:window.scrollY,query:document.getElementById('exercise-filter')?.value||''};
}
function persist() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify({read:[...state.read],understood:[...state.understood],positions:state.readingPositions,articleRead:[...state.articleRead],articleSelections:state.articleSelections,articlePositions:state.articlePositions})); }
  catch { /* Reading remains available when browser storage is disabled. */ }
}
function saveReadingPosition() {
  if (state.route === 'learn' && state.lesson) {
    state.readingPositions[state.lesson.id] = window.scrollY;
    state.articlePositions[readingKey(state.lesson)]=window.scrollY;
    persist();
  }
}
async function request(url, options = {}) {
  if(STATIC_SITE)return MTreeDataSource.request(url,options);
  const response = await fetch(url, options);
  const type = response.headers.get('content-type') || '';
  const data = type.includes('json') ? await response.json() : await response.text();
  if (!response.ok) {
    const message = typeof data === 'object' ? data.error || data.detail || data.message : data;
    throw new Error(typeof message === 'object' ? JSON.stringify(message) : message || `HTTP ${response.status}`);
  }
  return data;
}
function toast(message) {
  const el = document.getElementById('toast');
  el.textContent = message; el.hidden = false;
  clearTimeout(toast.timeout); toast.timeout = setTimeout(() => { el.hidden = true; }, 4500);
}
async function refreshGraph() {
  state.graph = await request('/api/graph');
  state.graph.nodes ||= []; state.graph.edges ||= [];
  state.loaded = true;
}
async function loadRoutes(){
  if(state.routesLoaded)return;
  const data=await request('/api/routes');state.routes=Array.isArray(data)?data:data.routes||[];state.routesLoaded=true;
}
async function activateLearningRoute(id){
  state.currentRouteId=id||null;state.learningRoute=null;
  if(!id)return;
  if(!state.routeGraphs[id])state.routeGraphs[id]=await request(`/api/graph?route=${encodeURIComponent(id)}`);
  if(state.currentRouteId!==id)return;
  state.learningRoute=state.routeGraphs[id].route||null;
  if(!state.learningRoute)throw new Error('这条保存的路线暂时不可用 / Saved route unavailable');
}
function resetBottom() { state.bottomAt = 0; state.lastWheel = 0; state.touchStartY = null; state.touchArmed = false; }
function navigate(hash) {
  saveReadingPosition();
  rememberMap();
  rememberExercises();
  if (location.hash === hash) route(); else location.hash = hash;
}
function openLesson(id, {anchor='', fromLink=false, restore=null,articles=null,routeId=state.currentRouteId} = {}) {
  if (fromLink && state.lesson && (id !== state.lesson.id || articles&&articles.join(',')!==displayedArticles(state.lesson).map(article=>article.id).join(','))) {
    state.readingStack.push({id:state.lesson.id,position:window.scrollY,hash:location.hash,routeId:state.currentRouteId});
  } else if (!fromLink && restore === null) { state.readingStack = []; }
  state.pendingRestore = restore;
  state.selected = id;
  navigate(lessonHash(id,{anchor,articles,routeId}));
}
function returnFromReading(markRead = false, forceMap = false) {
  if (markRead && state.lesson && !state.lesson.placeholder && !isEmptyLesson(state.lesson)) {
    state.read.add(state.lesson.id); persist();
    displayedArticles(state.lesson).forEach(article=>state.articleRead.add(article.id));persist();
  }
  saveReadingPosition();
  if (forceMap) state.readingStack = [];
  const previous = state.readingStack.pop();
  if (previous) {state.pendingRestore=previous.position;navigate(previous.hash||lessonHash(previous.id,{routeId:previous.routeId}));}
  else navigate(isExercise(state.lesson || byId(state.selected)) ? state.exerciseReturn : state.readingMapReturn || mapHash(state.lesson?.subject || state.subject));
}
function renderError(error) {
  app.innerHTML = `<section class="error-view page-enter"><p class="eyebrow">MTREE</p><h1>暂时无法读取内容</h1><p>${escapeHTML(error.message)}</p><button class="primary-button" id="retry-page">重新加载 / Retry</button></section>`;
  document.getElementById('retry-page').onclick = () => { state.loaded = false; route(); };
}
async function route() {
  saveReadingPosition();
  rememberMap();
  rememberExercises();
  const version = ++state.routeVersion;
  state.lesson = null;
  resetBottom();
  const path = (location.hash.replace(/^#/, '') || '/home');
  const url = new URL(path, location.origin);
  if(url.pathname.startsWith('/learn/')){
    if(state.route==='map')state.readingMapReturn=state.mapContextHash||mapHash();
    else if(state.route!=='learn')state.readingMapReturn=null;
  }else state.readingMapReturn=null;
  try {
    if (!state.loaded) await refreshGraph();
    if (version !== state.routeVersion) return;
    await activateLearningRoute(url.pathname.startsWith('/route/')?decodeURIComponent(url.pathname.slice('/route/'.length)):url.searchParams.get('route'));
    if(version!==state.routeVersion)return;
    if(url.pathname.startsWith('/route/')){
      const first=state.learningRoute?.steps?.[0]?.node_id;
      navigate(mapHash(byId(first)?.subject||state.subject));return;
    }
    if (url.pathname.startsWith('/learn/')) {
      state.route = 'learn';
      app.innerHTML = '<div class="loading">正在打开讲义 / Opening lesson…</div>';
      const id = decodeURIComponent(url.pathname.slice('/learn/'.length));
      if (state.pendingRestore === null && (state.readingStack.at(-1)?.hash===location.hash || !state.readingStack.at(-1)?.hash&&state.readingStack.at(-1)?.id === id)) {
        state.pendingRestore = state.readingStack.pop().position;
      }
      const articleIds=url.searchParams.get('articles')?.split(',').filter(Boolean)||state.articleSelections[selectionKey(id)];
      const query=new URLSearchParams();if(state.currentRouteId)query.set('route',state.currentRouteId);if(articleIds?.length)query.set('articles',articleIds.join(','));
      let lesson = await request(`/api/lessons/${encodeURIComponent(id)}${query.size?'?'+query:''}`);
      const referencedAnchor=url.searchParams.get('anchor');
      if(referencedAnchor&&!url.searchParams.has('articles')){
        const selectedOwns=displayedArticles(lesson).some(article=>(article.anchors||[]).includes(referencedAnchor));
        const owner=(lesson.available_articles||[]).find(article=>(article.anchors||[]).includes(referencedAnchor));
        if(owner&&!selectedOwns){
          query.set('articles',owner.id);
          lesson=await request(`/api/lessons/${encodeURIComponent(id)}?${query}`);
        }
      }
      if (version !== state.routeVersion) return;
      lesson.id ||= id;
      state.lesson = lesson; state.selected = id;
      setSubject(subjectForNode(lesson));
      document.title = `${lesson.title} · MTree`;
      renderLesson(lesson);
      const anchor = url.searchParams.get('anchor');
      const restore = state.pendingRestore;
      state.pendingRestore = null;
      requestAnimationFrame(() => requestAnimationFrame(() => {
        if (version !== state.routeVersion) return;
        if (anchor && (document.getElementById(anchor)||document.querySelector(`[data-original-anchor="${CSS.escape(anchor)}"]`))) scrollToAnchor(anchor,'instant');
        else window.scrollTo({top:restore ?? state.articlePositions[readingKey(lesson)] ?? state.readingPositions[id] ?? 0,behavior:'instant'});
        updateBottom();
      }));
    } else if (url.pathname === '/routes') {
      state.route='routes';state.readingStack=[];await loadRoutes();if(version!==state.routeVersion)return;
      document.title='学习路线 · Learning routes · MTree';renderRoutes();window.scrollTo({top:0,behavior:'instant'});
    } else if (url.pathname === '/exercises') {
      state.route = 'exercises'; state.readingStack = []; state.exerciseContextHash = location.hash || '#/exercises';state.exerciseReturn=state.exerciseContextHash;
      const view=state.exerciseViews[state.exerciseContextHash];
      document.title = '习题库 · Exercises · MTree';
      renderExercises(url.searchParams,view?.query||'');
      requestAnimationFrame(()=>requestAnimationFrame(()=>{
        if(version===state.routeVersion)window.scrollTo({top:view?.scroll||0,behavior:'instant'});
      }));
    } else if (url.pathname === '/workspace') {
      if(STATIC_SITE){navigate('#/home');return;}
      state.route = 'workspace'; state.readingStack = [];
      document.title = '写作空间 · Writing workspace · MTree';
      renderWorkspace(url.searchParams.get('node')); window.scrollTo({top:0,behavior:'instant'});
    } else if (url.pathname.startsWith('/map/')) {
      state.route = 'map'; state.lesson = null; state.readingStack = [];
      await loadRoutes();if(version!==state.routeVersion)return;
      const subject=decodeURIComponent(url.pathname.slice('/map/'.length));
      setSubject(availableSubjects().some(item=>item.id===subject)?subject:availableSubjects()[0]?.id || 'linear-algebra');
      const focusId=url.searchParams.get('focus');
      state.exploration=null;
      if(focusId&&byId(focusId)&&!isExercise(byId(focusId))){
        const key=`${focusId}/${innerWidth<600?'mobile':'desktop'}`;
        if(!state.explorations[key])state.explorations[key]={session:MTreeConceptExplorer.create(state.graph,focusId,{initialLimit:innerWidth<600?20:32,maxNodes:innerWidth<600?60:96,batchSize:innerWidth<600?8:12}),layout:null,autoAfter:0};
        state.exploration=state.explorations[key];
      }
      state.mapContextHash=state.exploration?conceptHash(focusId):mapHash();
      const view=state.mapViews[state.mapContextHash];
      state.mapCamera=view?.camera || {x:0,y:0,scale:1};state.mapScroll=view?.scroll || 0;
      document.title = `${subjectInfo(state.subject).title} · ${subjectInfo(state.subject).english} · MTree`;
      renderMap();
      if(state.exploration&&!view){
        requestAnimationFrame(()=>{if(version===state.routeVersion)app.querySelector('.exploration-focus')?.scrollIntoView({block:'center',behavior:'instant'});});
      }else window.scrollTo({top:state.mapScroll,behavior:'instant'});
    } else {
      state.route = 'home'; state.lesson = null; state.readingStack = [];
      document.title = 'MTree · 数学，彼此相连';
      renderHome(); window.scrollTo({top:0,behavior:'instant'});
    }
  } catch (error) { if (version === state.routeVersion) renderError(error); }
}
function renderHome() {
  const subjects=availableSubjects();
  const shortcuts=subjects.slice(0,3);
  app.innerHTML = `<section class="home-hero page-enter">
    <div class="home-inner"><p class="eyebrow">A CONNECTED WORLD OF MATHEMATICS</p>
      <h1>数学，<em>彼此相连。</em></h1><p class="hero-subtitle">从一个问题出发，找到理解它的路径。</p>
      <div class="search-box"><form class="search-form" id="search-form" role="search"><svg class="search-icon" viewBox="0 0 24 24" aria-hidden="true"><circle cx="10" cy="10" r="6.5"/><path d="m15 15 6 6"/></svg><input id="search-input" type="search" placeholder="想理解什么？例如：行列式、傅里叶变换…" aria-label="搜索数学概念 Search mathematics" autocomplete="off" aria-controls="search-results"><button class="search-submit" aria-label="搜索 Search" type="submit">→</button></form><div id="search-results" class="search-results" hidden></div></div>
      <div class="search-shortcuts">${shortcuts.map(subject=>`<button data-course="${escapeHTML(subject.id)}">${escapeHTML(subject.title)} <span>${escapeHTML(subject.english)}</span></button>`).join('')}</div>
    </div><a class="scroll-invitation" href="#ocean">向下，探索数学海图<span>↓</span></a>
  </section>
  <section id="ocean" class="ocean-section"><div class="ocean-heading"><p class="eyebrow">THE MATHEMATICAL OCEAN</p><h2>每一片海域，都通向新的理解。</h2><p>选择一门学科，展开它的知识网络。</p></div>
    ${MTreeOceanMap.render(subjects,{metadata:state.graph.learning_layout,nodes:state.graph.nodes,edges:state.graph.edges})}<p class="ocean-caption">${subjects.length} 片相连的海域 · ${knowledgeNodes().length} 个知识节点 · <a href="#/exercises">${exerciseNodes().length} 份习题</a></p>
  </section>`;
  app.querySelectorAll('[data-course]').forEach(button=>button.onclick=()=>navigate(mapHash(button.dataset.course)));
  app.querySelector('.scroll-invitation').onclick=event=>{event.preventDefault();document.getElementById('ocean').scrollIntoView({behavior:'smooth'});};
  const input=document.getElementById('search-input'),results=document.getElementById('search-results');
  const fitResults=()=>{const viewport=window.visualViewport;const bottom=viewport?viewport.offsetTop+viewport.height:innerHeight;results.style.maxHeight=`${Math.max(100,Math.min(420,bottom-results.getBoundingClientRect().top-16))}px`;};
  let searchVersion=0;
  const matchingSubjects=query=>subjects.filter(subject=>{
    const q=query.toLowerCase().replace(/\s+/g,'');
    return subject.title.toLowerCase().includes(q)||subject.english.toLowerCase().replace(/\s+/g,'').includes(q)||subject.id===query.toLowerCase();
  });
  input.addEventListener('input',()=>{
    clearTimeout(state.searchTimer);
    const query=input.value.trim(),version=++searchVersion;
    if(!query){results.hidden=true;return;}
    state.searchTimer=setTimeout(async()=>{
      try {
        const data=await request(`/api/search?q=${encodeURIComponent(query)}`);
        if(version!==searchVersion||!document.contains(results))return;
        const nodes=Array.isArray(data)?data:data.results||data.nodes||[];
        const courses=matchingSubjects(query);
        results.innerHTML=`<p class="search-count">${courses.length + nodes.length} 个结果 / Results</p>${courses.map(subject=>`<button class="search-result" data-result-course="${escapeHTML(subject.id)}"><span>${escapeHTML(subject.title)}<small>${escapeHTML(subject.english)} · 知识图谱</small></span><span class="result-arrow">→</span></button>`).join('')}${nodes.map(node=>`<button class="search-result ${isExercise(node)?'exercise-result':''}" data-result="${escapeHTML(node.id)}"><span>${escapeHTML(node.title)}<small>${escapeHTML(node.english_title||'')} · ${isExercise(node)?'习题 / Exercise':'知识 / Concept'}</small></span><span class="result-arrow">→</span></button>`).join('')}${!courses.length&&!nodes.length?'<p class="search-empty">暂未找到内容。可在本地写作空间补充。No matching content yet.</p>':''}`;
        results.hidden=false;
        results.scrollTop=0;
        fitResults();
        results.querySelectorAll('[data-result-course]').forEach(button=>button.onclick=()=>navigate(mapHash(button.dataset.resultCourse)));
        results.querySelectorAll('[data-result]').forEach(button=>button.onclick=()=>exploreConcept(button.dataset.result));
      }catch(error){results.innerHTML=`<p class="search-empty">${escapeHTML(error.message)}</p>`;results.hidden=false;fitResults();}
    },180);
  });
  document.getElementById('search-form').onsubmit=async event=>{
    event.preventDefault();
    const query=input.value.trim();
    if(!query)return document.getElementById('ocean').scrollIntoView({behavior:'smooth'});
    const courses=matchingSubjects(query);
    if(courses.length)return navigate(mapHash(courses[0].id));
    try {
      const data=await request(`/api/search?q=${encodeURIComponent(query)}`);
      const nodes=Array.isArray(data)?data:data.results||data.nodes||[];
      if(nodes.length)exploreConcept(nodes[0].id);else{results.hidden=false;results.innerHTML='<p class="search-empty">暂未找到内容。可在本地写作空间补充。</p>';}
    }catch(error){toast(error.message);}
  };
  input.onkeydown=event=>{if(event.key==='Escape')results.hidden=true;};
  // Keep wheel and touch scrolling inside the result list, including its boundaries.
  results.addEventListener('wheel',event=>{
    if(results.scrollHeight>results.clientHeight){event.preventDefault();results.scrollTop+=event.deltaY;}
    event.stopPropagation();
  },{passive:false});
}
function renderRoutes(){
  app.innerHTML=`<section class="routes-page page-enter"><header class="collection-heading"><p class="eyebrow">CHOOSE A READING PATH</p><h1>学习路线 <span>Learning routes</span></h1><p>选择已保存的阅读路径，再为每个知识节点选择合适的讲解。</p></header><div class="route-list">${state.routes.map(route=>`<article class="route-card"><h2><a href="#/route/${encodeURIComponent(route.id)}">${escapeHTML(route.title)}</a></h2><p class="route-english">${escapeHTML(route.english_title||'')}</p>${route.goal?`<p>${escapeHTML(route.goal)}</p>`:''}<p class="route-count">${route.steps?.length||0} 个知识节点 / Knowledge nodes</p><a class="route-open" href="#/route/${encodeURIComponent(route.id)}">打开路线 / Open route →</a></article>`).join('')}</div>${!state.routes.length?'<p class="exercise-empty">还没有保存的路线。可在写作环境中整理学习目标与阅读顺序后保存。</p>':''}<a class="collection-back" href="${mapHash(state.subject,null)}">← 浏览全部知识 / Explore knowledge</a></section>`;
}
function requirementDiagram(node) {
  const requires=directlyRequired(node);
  if(!requires.length)return '<p class="exercise-no-requirements">暂无直接知识关联 / No direct concepts linked yet</p>';
  return `<div class="exercise-connections" aria-label="习题的直接知识关联 Direct knowledge requirements"><p class="connection-label"><i></i>直接用到 / Direct concepts</p><div class="requirement-nodes">${requires.map(id=>`<a class="requirement-node ${progressClass(id)} ${authorReviewClass(byId(id))}" data-required-node="${escapeHTML(id)}" href="/learn/${encodeURIComponent(id)}"><span>${escapeHTML(titleOf(id))}</span><small>${escapeHTML(byId(id)?.english_title||'')}</small><em>${progressLabel(id)}</em></a>`).join('')}</div><div class="requirement-target ${authorReviewClass(node)}"><span>本题 / This exercise</span></div></div>`;
}
function renderExercises(params,query='') {
  const subject=params.get('subject')||'', concept=params.get('node')||'';
  const all=exerciseNodes();
  const subjects=[...new Set(all.map(node=>node.subject))].sort((a,b)=>subjectInfo(a).title.localeCompare(subjectInfo(b).title,'zh-CN'));
  const nodes=all.filter(node=>(!subject||node.subject===subject)&&(!concept||directlyRequired(node).includes(concept)));
  app.innerHTML=`<section class="exercise-page page-enter"><header class="collection-heading"><p class="eyebrow">PRACTICE THROUGH CONNECTIONS</p><h1>习题库 <span>Exercise library</span></h1><p>从问题回到概念。橙色连接只表示本题直接用到的知识。</p></header><div class="collection-filters"><select id="exercise-subject" aria-label="按学科筛选习题 Filter exercises by subject"><option value="">所有学科 / All subjects</option>${subjects.map(id=>`<option value="${escapeHTML(id)}" ${subject===id?'selected':''}>${escapeHTML(subjectInfo(id).title)} · ${escapeHTML(subjectInfo(id).english)}</option>`).join('')}</select><input type="search" id="exercise-filter" placeholder="搜索习题 / Find an exercise" aria-label="搜索习题 Find an exercise"></div>${concept?`<p class="concept-filter">关联知识：<a href="#/learn/${encodeURIComponent(concept)}">${escapeHTML(titleOf(concept))}</a> <a href="#/exercises${subject?`?subject=${encodeURIComponent(subject)}`:''}">显示全部 / Clear filter</a></p>`:''}<p class="collection-count"><span id="exercise-count">${nodes.length}</span> 份习题 / Exercises</p><div class="exercise-grid">${nodes.map(node=>`<article class="exercise-card" data-exercise="${escapeHTML(node.id)}"><div class="exercise-card-heading"><p class="eyebrow">${escapeHTML(subjectInfo(node.subject).title)} · EXERCISE</p><h2><button data-open-exercise="${escapeHTML(node.id)}">${escapeHTML(node.title)}</button></h2><p class="exercise-english">${escapeHTML(node.english_title||'')}</p>${node.objective?`<p class="exercise-objective">${escapeHTML(node.objective)}</p>`:''}</div>${requirementDiagram(node)}<a class="exercise-open" href="#/learn/${encodeURIComponent(node.id)}">打开习题 / Open exercise <span>→</span></a></article>`).join('')}</div><p class="exercise-empty" ${nodes.length?'hidden':''}>此筛选下暂无习题。可以继续探索知识图谱。</p><a class="collection-back" href="${mapHash(subject||state.subject)}">← 返回知识图谱 / Knowledge map</a></section>`;
  document.getElementById('exercise-subject').onchange=event=>{
    const search=new URLSearchParams();if(event.target.value)search.set('subject',event.target.value);if(concept)search.set('node',concept);
    navigate(`#/exercises${search.size?'?'+search:''}`);
  };
  const filter=document.getElementById('exercise-filter');
  const filterExercises=()=>{
    const value=filter.value.trim().toLowerCase();let visible=0;
    app.querySelectorAll('[data-exercise]').forEach(card=>{const node=byId(card.dataset.exercise);card.hidden=!!value&&!`${node.title} ${node.english_title||''} ${node.id}`.toLowerCase().includes(value);if(!card.hidden)visible++;});
    document.getElementById('exercise-count').textContent=visible;app.querySelector('.exercise-empty').hidden=!!visible;
  };
  filter.value=query;filter.oninput=filterExercises;filterExercises();
  app.querySelectorAll('[data-open-exercise]').forEach(button=>button.onclick=()=>openLesson(button.dataset.openExercise));
  app.querySelectorAll('a[href^="/learn/"]').forEach(link=>link.onclick=event=>{event.preventDefault();openLesson(decodeURIComponent(link.getAttribute('href').slice(7)));});
}
function renderWorkspace(nodeId) {
  const node=byId(nodeId);
  app.innerHTML=`<section class="workspace-page page-enter"><header class="collection-heading"><p class="eyebrow">WRITE ONCE, REUSE EVERYWHERE</p><h1>写作空间 <span>Writing workspace</span></h1><p>在本地编辑器里连续写作，再将审核后的内容转换成可复用节点。</p></header>${node?`<p class="workspace-context">当前内容：${escapeHTML(node.title)} · ${escapeHTML(node.english_title||'')}<br><code>content/nodes/${escapeHTML(node.id)}/</code></p>`:''}<div class="workspace-intro"><h2>打开本地工作空间</h2><p>在 VS Code 中打开项目根目录的 <code>Writing.code-workspace</code>。写作目录、知识节点、素材和 Manim 场景会在同一个窗口中。</p><code class="workspace-path">Writing.code-workspace</code><button class="resource-chip" id="copy-workspace">复制路径 / Copy path</button></div><ol class="workspace-steps"><li><h2>先写讲义 / Write</h2><p>在 <code>workspace/my-notes/draft.md</code> 保存 Markdown 或 Typst，图片与笔记放在同一草稿目录。可以自由组织长文，无需逐项填写网页表单。</p></li><li><h2>整理节点 / Structure</h2><p>让 AI 读取草稿并提出拆分：每个知识节点讲清一个定义、性质或定理；习题单独保存，<code>requires</code> 只列直接使用的知识。保留原讲义作为贯穿这些节点的阅读路径。</p></li><li><h2>检查并发布 / Check & publish</h2><p>在工作空间的终端或任务菜单中检查引用与节点关系，审核后发布到 <code>content/nodes/</code>。节点 ID 稳定，其他主题可引用同一个概念。</p></li><li><h2>按需制作动画 / Animate when requested</h2><p>Manim 场景、解说词和素材与草稿一起维护。只有明确要求制作视频时才运行渲染，现有视频可以反复使用。</p></li></ol><p class="workspace-help">操作说明：项目中的 <code>workspace/README.md</code> · 命令帮助：<code>uv run mtree-lab workspace --help</code></p>${node?`<a class="collection-back" href="#/learn/${encodeURIComponent(node.id)}">← 返回讲义 / Return to lesson</a>`:'<a class="collection-back" href="#/home">← 返回首页 / Home</a>'}</section>`;
  document.getElementById('copy-workspace').onclick=async()=>{
    try {await navigator.clipboard.writeText('Writing.code-workspace');toast('工作空间路径已复制 / Path copied');}
    catch {toast('请复制上方工作空间路径 / Copy the path above');}
  };
}
function splitTitle(title) {
  const tokens=String(title||'').match(/[A-Za-z][A-Za-z0-9']*[-–—]?|范数|内积|矩阵|向量|[^\s]/gu)||[];
  const lines=[];let line='',weight=0;
  for(const token of tokens){
    const size=/^[A-Za-z]/.test(token)?token.length*.55:Array.from(token).length;
    if(line&&weight+size>6){lines.push(line);line='';weight=0;}
    line+=token;weight+=size;
  }
  if(line)lines.push(line);
  return lines.length>3?[...lines.slice(0,2),lines[2]+'…']:lines;
}
function graphLayout(nodes,edges) {
  const result=MTreeLearningMap.layout(nodes,edges,{
    metadata:state.graph.learning_layout,routeSteps:state.learningRoute?.steps||[],
    width:innerWidth<600?480:innerWidth<1000?820:1160
  });
  return {...result,nodeMetadata:result.points,points:new Map([...result.points].map(([id,point])=>[id,[point.x,point.y]]))};
}
function renderMap({expanding=false}={}) {
  const exploration=state.exploration,snapshot=exploration?MTreeConceptExplorer.snapshot(exploration.session):null;
  const focus=snapshot?byId(snapshot.focusId):null;
  const subject=focus?{title:focus.title,english:focus.english_title}:state.learningRoute?{title:state.learningRoute.title,english:state.learningRoute.english_title||'Learning route'}:subjectInfo(state.subject);
  const activeGraph=state.currentRouteId?state.routeGraphs[state.currentRouteId]:state.graph;
  const nodes=snapshot?snapshot.nodes:(activeGraph?.nodes||[]).filter(node=>!isExercise(node)&&(state.learningRoute||belongsToSubject(node,state.subject)));
  const ids=new Set(nodes.map(node=>node.id));
  const edges=snapshot?snapshot.edges:(activeGraph?.edges||[]).filter(edge=>ids.has(edge.source)&&ids.has(edge.target));
  const courseIds=new Set(nodes.filter(node=>!isPlaceholder(node)).map(node=>node.id));
  const count=[...state.read].filter(id=>courseIds.has(id)).length;
  const understoodCount=[...state.understood].filter(id=>courseIds.has(id)).length;
  let layout;
  if(exploration){
    const incremental=MTreeExplorationLayout.extend(exploration.layout,nodes,edges,{metadata:state.graph.learning_layout,focusId:focus.id,width:innerWidth<600?480:innerWidth<1000?820:1160});
    exploration.layout=incremental;
    layout={...incremental,nodeMetadata:incremental.points,points:new Map([...incremental.points].map(([id,point])=>[id,Array.isArray(point)?point:[point.x,point.y]]))};
  }else layout=graphLayout(nodes,edges);
  const worldWidth=layout.width,worldHeight=layout.height;
  const point=id=>layout.points.get(id);
  const nodeRadius=id=>{
    const node=nodes.find(item=>item.id===id);
    const definition=node.content_status==='definition'||node.content_status==='definition-only';
    return (state.subject==='linear-algebra'?PRIMARY_IDS.has(id):!definition&&!isPlaceholder(node))?65:52;
  };
  const relationDrawing=MTreeGraphRelations.render(nodes,edges,layout.points,{radiusOf:nodeRadius});
  const links=relationDrawing.html;
  const circles=nodes.slice().sort((a,b)=>point(a.id)[1]-point(b.id)[1]||point(a.id)[0]-point(b.id)[0]).map(node=>{
    const [x,y]=point(node.id),placeholder=isPlaceholder(node);
    const definition=node.content_status==='definition'||node.content_status==='definition-only';
    const primary=state.subject==='linear-algebra'?PRIMARY_IDS.has(node.id):!definition&&!placeholder;
    const radius=primary?65:52,words=splitTitle(node.title);
    const english=String(node.english_title||'');
    const compactEnglish=english.length>31?english.slice(0,29)+'\u2026':english;
    const classes=['graph-node',primary?'primary':'',definition?'definition':'',placeholder?'placeholder':'',progressClass(node.id),authorReviewClass(node),state.selected===node.id?'selected':'',focus?.id===node.id?'exploration-focus':''].filter(Boolean).join(' ');
    return `<g class="${classes}" transform="translate(${x} ${y})" data-node="${escapeHTML(node.id)}" data-author-review="${authorReviewApproved(node)?'approved':'unreviewed'}" role="button" tabindex="0" aria-label="${escapeHTML(node.title)} ${escapeHTML(english)} · ${progressLabel(node.id)} · ${authorReviewLabel(node)}${placeholder?' 内容筹备中':''}" aria-pressed="${state.selected===node.id}"><title>${escapeHTML(node.title)} · ${escapeHTML(english)} · ${progressLabel(node.id)} · ${authorReviewLabel(node)}</title><circle class="relation-halo" r="${radius+7}"/><circle class="relation-halo-secondary" r="${radius+12}"/><circle class="node-disc" r="${radius}"/>${words.map((word,index)=>`<text class="${words.length===3?'node-title-small':''}" y="${(index-(words.length-1)/2)*23+6}">${escapeHTML(word)}</text>`).join('')}<text class="node-english" y="${radius+22}">${escapeHTML(compactEnglish)}</text>${state.understood.has(node.id)?`<text class="understood-check" x="${radius-7}" y="${-radius+11}">✓</text>`:state.read.has(node.id)?`<text class="read-check" x="${radius-7}" y="${-radius+11}">•</text>`:''}</g>`;
  }).join('');
  const options=availableSubjects().map(item=>`<option value="${escapeHTML(item.id)}" ${item.id===state.subject?'selected':''}>${escapeHTML(item.title)} · ${escapeHTML(item.english)}</option>`).join('');
  const clusters=MTreeLearningMap.bandsSVG(layout);
  app.innerHTML=`<section class="map-page page-enter"><div class="map-heading"><div><p class="eyebrow">YOUR LEARNING CONSTELLATION</p><h1>${escapeHTML(subject.title)}<span>${escapeHTML(subject.english)}</span></h1><p class="map-description">从熟悉的概念出发，点亮下一段理解。</p></div><div class="map-heading-tools"><select id="subject-switch" aria-label="切换学科 Change subject">${options}</select><div class="map-progress"><span class="read-dot"></span>已读 ${count}<span class="understood-dot"></span>已理解 ${understoodCount} / ${courseIds.size}</div><a class="practice-link" href="#/exercises?subject=${encodeURIComponent(state.subject)}">本学科习题 / Practice →</a></div></div><div class="graph-frame"><svg class="graph-svg" viewBox="0 0 ${worldWidth} ${worldHeight}" role="group" aria-label="${escapeHTML(subject.title)} ${escapeHTML(subject.english)} knowledge graph"><g id="graph-camera">${clusters}<g class="graph-edges">${links}</g><g class="graph-nodes">${circles}</g></g></svg><span class="graph-hint">灰色：未通过作者审核 · • 已读，✓ 已理解</span><div class="graph-tools" aria-label="图谱缩放"><button id="zoom-out" aria-label="缩小 Zoom out">−</button><button id="zoom-in" aria-label="放大 Zoom in">＋</button><button id="zoom-reset" aria-label="复位 Reset view">⌖</button></div></div><div class="map-footer"><div class="map-legend"><span><i class="legend-disc"></i>已审核 / Reviewed</span><span><i class="legend-disc author-unreviewed"></i>未通过审核 / Unreviewed</span><span><i class="legend-disc read"></i>已读 / Read</span><span><i class="legend-disc understood"></i>已理解 / Understood</span><span><i class="legend-disc placeholder"></i>筹备中 / Coming soon</span><span><i class="legend-line contains"></i>主题包含 / Contains</span></div><a href="#/home">← 回到数学海图</a></div><details class="map-directory"><summary>节点目录 / Node directory · ${nodes.length}</summary><input type="search" id="map-filter" placeholder="查找此学科的节点 / Find a node" aria-label="查找此学科的节点"><div class="map-directory-list">${nodes.slice().sort((a,b)=>a.title.localeCompare(b.title,'zh-CN')).map(node=>`<button class="${progressClass(node.id)} ${authorReviewClass(node)}" data-directory-node="${escapeHTML(node.id)}"><span>${escapeHTML(node.title)}</span><small>${escapeHTML(node.english_title||'')} · ${progressLabel(node.id)} · ${authorReviewLabel(node)}</small></button>`).join('')}</div></details></section>`;
  document.getElementById('subject-switch').onchange=event=>navigate(mapHash(event.target.value,null));
  const routeControl=document.createElement('select');routeControl.id='learning-route-switch';routeControl.setAttribute('aria-label','选择保存的学习路线 Choose a saved route');
  routeControl.innerHTML=`<option value="">全部知识图谱 / All knowledge</option>${state.routes.map(route=>`<option value="${escapeHTML(route.id)}" ${state.currentRouteId===route.id?'selected':''}>${escapeHTML(route.title)}</option>`).join('')}`;
  app.querySelector('.map-heading-tools').prepend(routeControl);
  routeControl.onchange=event=>navigate(mapHash(state.subject,event.target.value||null));
  if(state.learningRoute){
    app.querySelector('.map-description').textContent=state.learningRoute.goal||'按已保存的顺序阅读，每个节点可选择一篇或多篇讲解。';
    const steps=document.createElement('details');steps.className='route-steps';
    steps.innerHTML=`<summary>路线阅读顺序 / Reading order · ${state.learningRoute.steps?.length||0}</summary><ol>${(state.learningRoute.steps||[]).map((step,index)=>`<li><button data-route-step="${escapeHTML(step.node_id)}"><span>${String(index+1).padStart(2,'0')}</span><span>${escapeHTML(titleOf(step.node_id))}<small>${escapeHTML(byId(step.node_id)?.english_title||'')}</small></span><em>${(state.articleSelections[selectionKey(step.node_id)]||step.article_ids||[]).length} 篇讲解</em></button></li>`).join('')}</ol>`;
    app.querySelector('.graph-frame').after(steps);steps.querySelectorAll('[data-route-step]').forEach(button=>button.onclick=()=>openLesson(button.dataset.routeStep));
    app.querySelector('.map-heading .eyebrow').textContent='YOUR SAVED LEARNING ROUTE';
  }
  const directory=app.querySelector('.map-directory');
  directory.querySelectorAll('[data-directory-node]').forEach(button=>button.onclick=()=>openLesson(button.dataset.directoryNode));
  document.getElementById('map-filter').oninput=event=>{
    const query=event.target.value.trim().toLowerCase();
    directory.querySelectorAll('[data-directory-node]').forEach(button=>{const node=byId(button.dataset.directoryNode);button.hidden=!!query&&!`${node.title} ${node.english_title} ${node.id}`.toLowerCase().includes(query);});
  };
  const svg=app.querySelector('.graph-svg'),camera=document.getElementById('graph-camera');
  svg.insertAdjacentHTML('afterbegin',relationDrawing.defs);
  const relationLegend=document.createElement('div');relationLegend.className='relation-legend';
  relationLegend.innerHTML='<span><i class="legend-line prerequisite"></i>前置 → 后续 / Dependency</span><span><i class="legend-line related"></i>相关节点 / Related</span><span><i class="legend-line contains"></i>主题包含 / Contains</span><small>悬停外圈：<b class="prerequisite-key">前置</b> / <b class="related-key">相关</b> / <b class="dependent-key">后续</b></small>';
  app.querySelector('.map-legend .legend-line.contains')?.parentElement.remove();
  app.querySelector('.map-footer').after(relationLegend);
  const inspector=document.createElement('aside');inspector.id='graph-relation-inspector';inspector.className='relation-inspector';inspector.hidden=true;inspector.setAttribute('role','status');inspector.setAttribute('aria-live','polite');
  document.getElementById(inspector.id)?.remove();
  document.body.append(inspector);
  const inspectorCleanup=new MutationObserver(()=>{if(!camera.isConnected){clearTimeout(relationHideTimer);inspector.remove();inspectorCleanup.disconnect();}});
  inspectorCleanup.observe(app,{childList:true});
  app.querySelector('.graph-frame').classList.add('hierarchical-graph');
  app.querySelector('.map-description').textContent=state.learningRoute?.goal||'从浅处出发，沿着关联向深处探索。越往下，概念与推理越深入。';
  svg.style.aspectRatio=`${worldWidth} / ${worldHeight}`;
  function drawCamera(){camera.setAttribute('transform',`translate(${state.mapCamera.x} ${state.mapCamera.y}) scale(${state.mapCamera.scale})`);}
  drawCamera();
  function zoom(factor){
    const old=state.mapCamera.scale,next=Math.max(.35,Math.min(8,old*factor));
    const rect=svg.getBoundingClientRect();
    const centreX=worldWidth/2,centreY=(Math.max(0,rect.top)+Math.min(innerHeight,rect.bottom))/2;
    const visibleY=(centreY-rect.top)*worldHeight/rect.height;
    state.mapCamera.x=centreX-(centreX-state.mapCamera.x)*next/old;
    state.mapCamera.y=visibleY-(visibleY-state.mapCamera.y)*next/old;
    state.mapCamera.scale=next;drawCamera();
  }
  document.getElementById('zoom-in').onclick=()=>zoom(1.25);
  document.getElementById('zoom-out').onclick=()=>zoom(1/1.25);
  document.getElementById('zoom-reset').onclick=()=>{state.mapCamera={x:0,y:0,scale:1};drawCamera();};
  let drag=null,dragged=false;
  svg.addEventListener('pointerdown',event=>{if(event.button!==0||event.pointerType==='touch')return;drag={x:event.clientX,y:event.clientY,originX:state.mapCamera.x,originY:state.mapCamera.y};dragged=false;});
  svg.addEventListener('pointermove',event=>{
    if(!drag)return;
    const dx=event.clientX-drag.x,dy=event.clientY-drag.y;
    if(Math.abs(dx)+Math.abs(dy)>6&&!dragged){dragged=true;svg.setPointerCapture(event.pointerId);}
    if(!dragged)return;
    const rect=svg.getBoundingClientRect(),factor=Math.max(worldWidth/rect.width,worldHeight/rect.height);
    state.mapCamera.x=drag.originX+dx*factor;state.mapCamera.y=drag.originY+dy*factor;drawCamera();
  });
  const endDrag=()=>{drag=null;setTimeout(()=>{dragged=false;},0);};
  svg.addEventListener('pointerup',endDrag);svg.addEventListener('pointercancel',endDrag);
  let activeRelationId=null,relationHideTimer=null;
  function focusNode(id){
    if(!camera.isConnected)return;
    clearTimeout(relationHideTimer);activeRelationId=id;
    const relations=id?MTreeGraphRelations.direct(id,state.graph.nodes,state.graph.edges,ids):null;
    const prerequisites=new Set(relations?.prerequisites.map(node=>node.id)||[]),dependents=new Set(relations?.dependents.map(node=>node.id)||[]),related=new Set(relations?.related.map(node=>node.id)||[]);
    const contained=new Set([...(relations?.contains||[]),...(relations?.containedBy||[])].map(node=>node.id));
    const connected=new Set([id,...prerequisites,...dependents,...related,...contained]);
    app.querySelector('.graph-edges').classList.toggle('has-focus',!!id);
    app.querySelectorAll('.graph-node').forEach(node=>{
      const nodeId=node.dataset.node;
      node.classList.toggle('dim',!!id&&!connected.has(nodeId));
      node.classList.toggle('relation-current',!!id&&nodeId===id);
      node.classList.toggle('relation-prerequisite',prerequisites.has(nodeId));
      node.classList.toggle('relation-dependent',dependents.has(nodeId));
      node.classList.toggle('relation-related',related.has(nodeId)&&!prerequisites.has(nodeId)&&!dependents.has(nodeId));
      node.classList.toggle('relation-contained',contained.has(nodeId)&&!prerequisites.has(nodeId)&&!dependents.has(nodeId)&&!related.has(nodeId));
      if(nodeId===id)node.setAttribute('aria-describedby',inspector.id);else node.removeAttribute('aria-describedby');
    });
    app.querySelectorAll('.graph-edges path').forEach(path=>{
      const incoming=!!id&&path.dataset.target===id,outgoing=!!id&&path.dataset.source===id,active=incoming||outgoing;
      path.classList.toggle('focused',active);
      path.classList.toggle('incoming',active&&path.dataset.edgeType==='prerequisite'&&incoming);
      path.classList.toggle('outgoing',active&&path.dataset.edgeType==='prerequisite'&&outgoing);
    });
    inspector.hidden=!id;
    if(relations){
      inspector.innerHTML=MTreeGraphRelations.inspectorHTML(relations);
      const current=app.querySelector(`.graph-node[data-node="${CSS.escape(id)}"]`),rect=current?.getBoundingClientRect();
      inspector.classList.toggle('at-left',!!rect&&rect.left+rect.width/2>innerWidth/2);
      const atTop=!!rect&&rect.top+rect.height/2>innerHeight/2;
      inspector.classList.toggle('at-top',atTop);
      if(rect){
        const topOffset=innerWidth<=600?72:82,bottomOffset=innerWidth<=600?12:20;
        const available=atTop?rect.top-topOffset-12:innerHeight-rect.bottom-bottomOffset-12;
        inspector.style.maxHeight=`${Math.max(90,Math.min(470,innerHeight*(innerWidth<=600?.45:.57),available))}px`;
      }
      inspector.querySelectorAll('[data-relation-node]').forEach(button=>button.onclick=()=>{focusNode(null);openLesson(button.dataset.relationNode);});
    }
  }
  function leaveRelation(){
    clearTimeout(relationHideTimer);
    relationHideTimer=setTimeout(()=>{
      if(!camera.isConnected)return;
      const focused=document.activeElement;
      if(!inspector.matches(':hover')&&!inspector.contains(focused)&&!(focused?.classList.contains('graph-node')&&focused.dataset.node===activeRelationId))focusNode(null);
    },750);
  }
  inspector.addEventListener('pointerenter',()=>clearTimeout(relationHideTimer));
  inspector.addEventListener('pointerleave',leaveRelation);
  inspector.addEventListener('focusin',()=>clearTimeout(relationHideTimer));
  inspector.addEventListener('focusout',leaveRelation);
  app.querySelectorAll('.graph-node[data-node]').forEach(node=>{
    node.addEventListener('pointerenter',()=>{if(!drag)focusNode(node.dataset.node);});node.addEventListener('pointerleave',leaveRelation);
    node.addEventListener('focus',()=>focusNode(node.dataset.node));node.addEventListener('blur',leaveRelation);
    node.addEventListener('click',()=>{if(!dragged)openLesson(node.dataset.node);});
    node.addEventListener('keydown',event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();openLesson(node.dataset.node);}});
  });
  if(exploration){
    app.querySelector('.map-page').dataset.explorationFocus=focus.id;
    app.querySelector('.map-page').dataset.budget=snapshot.maxNodes;
    app.querySelector('.map-page').dataset.layoutReflowed=String(!!layout.reflowed);
    app.querySelector('#subject-switch')?.remove();
    app.querySelector('#learning-route-switch')?.remove();
    app.querySelector('.map-heading-tools .practice-link')?.remove();
    const subjectLink=document.createElement('a');subjectLink.className='exploration-subject-link';subjectLink.href=mapHash(focus.subject,null);
    subjectLink.textContent=`浏览${subjectInfo(focus.subject).title}图谱 / Subject map →`;
    app.querySelector('.map-heading-tools').append(subjectLink);
    app.querySelector('.map-heading .eyebrow').textContent='EXPLORE ONE CONCEPT';
    app.querySelector('.map-description').textContent='沿目标的前置依赖链理解概念，再看少量直接后续。相关分支按需展开。';
    app.querySelector('.graph-hint').textContent='灰色：未通过作者审核 · 目标概念有双圈 · 点击阅读 · + 继续展开';
    if(expanding)app.querySelector('.map-page').classList.remove('page-enter');
    bindConceptExploration(exploration,snapshot,layout);
  }
}
function expandConceptGraph(direction,anchorId=null,automatic=false){
  const entry=state.exploration;if(!entry||state.route!=='map')return;
  const oldNodes=[...app.querySelectorAll('.graph-node[data-node]')];
  const centreDistance=node=>{const rect=node.querySelector('.node-disc').getBoundingClientRect();return Math.abs(rect.top+rect.height/2-innerHeight/2);};
  const anchor=oldNodes.sort((a,b)=>centreDistance(a)-centreDistance(b))[0];
  const oldRect=anchor?.getBoundingClientRect();
  const anchorIdToKeep=anchor?.dataset.node,oldTop=oldRect?.top,oldLeft=oldRect?.left,oldScroll=window.scrollY;
  const expanded=MTreeConceptExplorer.expand(entry.session,direction,{...(anchorId?{anchorId}:{}),requiredOnly:automatic});
  if(!expanded.addedIds.length)return;
  if(!automatic)entry.manualExploration=true;
  entry.autoAfter=performance.now()+1800;
  renderMap({expanding:true});
  window.scrollTo({top:oldScroll,behavior:'instant'});
  const replacement=anchorIdToKeep?app.querySelector(`.graph-node[data-node="${CSS.escape(anchorIdToKeep)}"]`):null;
  if(replacement){
    const svg=app.querySelector('.graph-svg'),rect=replacement.getBoundingClientRect();
    state.mapCamera.x+=(oldLeft-rect.left)*entry.layout.width/svg.getBoundingClientRect().width;
    // A necessary reflow fits the complete unzoomed map horizontally again.
    // Ordinary expansion keeps its existing camera and all landmarks stable.
    if(entry.layout.reflowed&&state.mapCamera.scale===1)state.mapCamera.x=0;
    document.getElementById('graph-camera').setAttribute('transform',`translate(${state.mapCamera.x} ${state.mapCamera.y}) scale(${state.mapCamera.scale})`);
    window.scrollBy({top:replacement.getBoundingClientRect().top-oldTop,behavior:'instant'});
    const residual=oldTop-replacement.getBoundingClientRect().top;
    if(Math.abs(residual)>1){
      state.mapCamera.y+=residual*entry.layout.width/svg.getBoundingClientRect().width;
      document.getElementById('graph-camera').setAttribute('transform',`translate(${state.mapCamera.x} ${state.mapCamera.y}) scale(${state.mapCamera.scale})`);
    }
    app.querySelector('.map-page').dataset.preservedAnchor=anchorIdToKeep;
  }
  rememberMap();
  if(entry.layout.reflowed)toast('补入中间依赖，已调整局部排列。');
}
function bindConceptExploration(entry,snapshot,layout){
  const page=app.querySelector('.map-page'),camera=document.getElementById('graph-camera');
  const directions={prerequisites:[snapshot.counts.requiredRemaining?'必要前置':'分支前置','Prerequisites'],related:['相关节点','Related'],dependents:['后续节点','Next concepts']};
  const frontier=snapshot.frontier;
  const candidates=direction=>[...new Set(frontier[direction].flatMap(item=>item.candidateIds))];
  const controls=document.createElement('div');controls.className='concept-explorer-heading';
  controls.innerHTML=`<p class="exploration-summary" data-visible-count="${snapshot.nodes.length}" data-required-visible="${snapshot.counts.requiredVisible}" data-required-total="${snapshot.counts.requiredTotal}">当前 ${snapshot.nodes.length} 个概念 <span>· 必要前置 ${snapshot.counts.prerequisitesVisible} / ${snapshot.counts.prerequisitesTotal}</span></p><div class="exploration-controls">${Object.entries(directions).map(([direction,[title,english]])=>`<button type="button" data-expand-direction="${direction}" ${!frontier[direction].length||snapshot.atLimit?'disabled':''}>展开${title} <small>${english} · +${candidates(direction).length}</small></button>`).join('')}<button type="button" id="read-exploration-target">阅读目标讲义 <small>Read this concept →</small></button></div><label class="exploration-auto"><input type="checkbox" id="exploration-auto" ${entry.autoEnabled===false?'':'checked'}> 自动补齐必要前置 <span>Complete required prerequisites</span></label>${snapshot.atLimit?'<p class="exploration-limit">当前图谱已展开较多内容。选择边界上的新概念，可以从那里继续探索。</p>':''}`;
  page.querySelector('.map-heading').after(controls);
  page.querySelector('#read-exploration-target').onclick=()=>openLesson(snapshot.focusId);
  page.querySelector('#exploration-auto').onchange=event=>{entry.autoEnabled=event.target.checked;};
  page.querySelectorAll('[data-expand-direction]').forEach(button=>button.onclick=()=>expandConceptGraph(button.dataset.expandDirection));
  const boundaries=new Map();
  const badgeFrontier=entry.manualExploration?frontier:{prerequisites:snapshot.requiredFrontier,dependents:frontier.dependents.filter(item=>item.id===snapshot.focusId),related:[]};
  Object.keys(directions).forEach(direction=>badgeFrontier[direction].forEach(item=>{
    if(!boundaries.has(item.id))boundaries.set(item.id,[]);
    boundaries.get(item.id).push({...item,direction});
  }));
  const badges=[...boundaries].map(([id,items])=>{
    const [x,y]=layout.points.get(id),node=byId(id);
    const primary=state.subject==='linear-algebra'?PRIMARY_IDS.has(id):!['definition','definition-only'].includes(node.content_status)&&!isPlaceholder(node);
    const radius=primary?65:52,total=new Set(items.flatMap(item=>item.candidateIds)).size;
    const title=items.map(item=>`${directions[item.direction][0]} ${item.hiddenCount}`).join(' · ');
    return `<g class="exploration-boundary" transform="translate(${x+radius*.78} ${y+radius*.55})" data-expand-anchor="${escapeHTML(id)}" data-direction="${items[0].direction}" data-next-focus="${escapeHTML(items[0].candidateIds[0])}" role="button" tabindex="0" aria-label="${escapeHTML(node.title)}：${escapeHTML(title)}；${snapshot.atLimit?'以新概念为中心继续':'展开更多'}"><title>${escapeHTML(title)} · ${snapshot.atLimit?'以新概念为中心继续':'继续展开'}</title><circle r="13"/><text y="3.5">+${total}</text></g>`;
  }).join('');
  page.querySelector('.graph-nodes').insertAdjacentHTML('beforeend',badges);
  const section=document.createElement('section');section.className='exploration-frontier-section';
  section.innerHTML=`<h2>继续探索 <span>Beyond this view</span></h2><p>必要前置沿强依赖追溯；相关概念提供不同视角，后续应用展示它能通向哪里。</p>${Object.entries(directions).map(([direction,[title,english]])=>`<details class="exploration-frontier" data-direction="${direction}" ${direction==='prerequisites'?'open':''}><summary>${title} <small>${english} · ${candidates(direction).length} 个待展开</small></summary><div class="exploration-frontier-list">${frontier[direction].length?frontier[direction].map(item=>`<div class="exploration-frontier-row"><button type="button" data-expand-anchor="${escapeHTML(item.id)}" data-direction="${direction}" ${snapshot.atLimit?'disabled':''}>${escapeHTML(item.title)} <small>+${item.hiddenCount}</small></button><details><summary>选择新中心 / Change focus</summary><div>${item.candidateIds.map(id=>`<a data-explore-focus="${escapeHTML(id)}" href="${conceptHash(id)}">${escapeHTML(titleOf(id))}<small>${escapeHTML(byId(id)?.english_title||'')}</small></a>`).join('')}</div></details></div>`).join(''):'<p class="exploration-empty">这一方向的现有关系已全部展开。</p>'}</div></details>`).join('')}`;
  page.querySelector('.graph-frame').after(section);
  page.querySelectorAll('[data-expand-anchor]').forEach(button=>{
    const expand=event=>{event.preventDefault();event.stopPropagation();if(snapshot.atLimit&&button.dataset.nextFocus)navigate(conceptHash(button.dataset.nextFocus));else expandConceptGraph(button.dataset.direction,button.dataset.expandAnchor);};
    button.addEventListener('click',expand);
    if(button.tagName.toLowerCase()==='g')button.addEventListener('keydown',event=>{if(event.key==='Enter'||event.key===' ')expand(event);});
  });
  page.querySelectorAll('[data-explore-focus]').forEach(link=>link.onclick=event=>{event.preventDefault();navigate(conceptHash(link.dataset.exploreFocus));});
  const nearby=new Set();
  const observer=new IntersectionObserver(records=>records.forEach(record=>{if(record.isIntersecting)nearby.add(record.target);else nearby.delete(record.target);}),{rootMargin:'100px 0px'});
  page.querySelectorAll('.exploration-boundary,.exploration-frontier').forEach(element=>observer.observe(element));
  let scheduled=false;
  const afterGesture=event=>{
    if(event.type==='keydown'&&!['ArrowDown','ArrowUp','PageDown','PageUp',' '].includes(event.key))return;
    if(event.type==='pointerup'&&!event.target.closest?.('.graph-svg'))return;
    if(scheduled||entry.autoEnabled===false||snapshot.atLimit||!snapshot.counts.requiredRemaining||performance.now()<(entry.autoAfter||0))return;
    scheduled=true;
    requestAnimationFrame(()=>{
      scheduled=false;if(!camera.isConnected||state.exploration!==entry||state.route!=='map')return;
      const boundary=[...nearby].find(element=>{
        if(element.dataset.direction!=='prerequisites')return false;
        if(element.dataset.expandAnchor&&!snapshot.requiredFrontier.some(item=>item.id===element.dataset.expandAnchor))return false;
        if(element.classList.contains('exploration-frontier'))return frontier[element.dataset.direction].length&&element.getBoundingClientRect().top<innerHeight+80&&element.getBoundingClientRect().bottom>80;
        const rect=element.getBoundingClientRect();return rect.bottom>80&&rect.top<innerHeight+80&&(rect.top<190||rect.bottom>innerHeight-130);
      });
      if(boundary)expandConceptGraph('prerequisites',boundary.dataset.expandAnchor||null,true);
    });
  };
  ['wheel','touchmove','keydown','pointerup'].forEach(type=>window.addEventListener(type,afterGesture,{passive:true}));
  const cleanup=new MutationObserver(()=>{
    if(camera.isConnected)return;
    observer.disconnect();['wheel','touchmove','keydown','pointerup'].forEach(type=>window.removeEventListener(type,afterGesture));cleanup.disconnect();
  });
  cleanup.observe(app,{childList:true});
}
function cleanLessonHTML(html) {
  const template = document.createElement('template'); template.innerHTML = html || '';
  template.content.querySelectorAll('script,iframe,object,embed,form,input,button,style,link,meta,section.bibliography').forEach(el=>el.remove());
  template.content.querySelectorAll('*').forEach(el=>{
    [...el.attributes].forEach(attr=>{
      if (/^on/i.test(attr.name) || (['href','src'].includes(attr.name) && /^\s*(javascript|vbscript):/i.test(attr.value))) el.removeAttribute(attr.name);
    });
  });
  return template.innerHTML;
}
function isEmptyLesson(lesson) {
  if(lesson.articles?.some(article=>article.id!==`${lesson.id}.main`&&String(article.html||'').trim()))return false;
  if (['available','complete'].includes(lesson.content_status)) return false;
  return lesson.placeholder || lesson.content_status === 'placeholder' || lesson.content_state === 'empty' || /内容筹备中|Content coming soon/i.test(lesson.markdown || '') && (lesson.markdown || '').length < 1500;
}
function assetURL(lesson, resource) { return resource.preview_url || resource.asset_url || `/assets/${encodeURIComponent(lesson.id)}/${encodeURIComponent(resource.id)}`; }
function renderMath(container) {
  if (!window.katex) return;
  container.querySelectorAll('.math').forEach(element=>{
    if (element.querySelector('.katex')) return;
    try { window.katex.render(element.textContent,element,{displayMode:element.classList.contains('block')||element.classList.contains('display'),throwOnError:false,strict:false,trust:false}); }
    catch { /* Keep readable source if a formula is invalid. */ }
  });
  if(window.renderMathInElement) window.renderMathInElement(container,{delimiters:[{left:'$$',right:'$$',display:true},{left:'\\[',right:'\\]',display:true},{left:'$',right:'$',display:false},{left:'\\(',right:'\\)',display:false}],throwOnError:false,strict:false,ignoredClasses:['katex','math'],trust:false});
}
function scrollToAnchor(anchor,behavior='smooth') {
  const element=document.getElementById(anchor)||document.querySelector(`[data-original-anchor="${CSS.escape(anchor)}"]`);
  if(!element)return;
  const details=element.closest('details');if(details)details.open=true;
  element.scrollIntoView({behavior,block:'start'});
}
function renderBibliography(bibliography) {
  if(!bibliography.length)return '';
  return `<details class="references"><summary>参考资料 / References · ${bibliography.length}</summary><ol>${bibliography.map(ref=>{
    const title=/^https?:\/\//i.test(ref.url || '')?`<a href="${escapeHTML(ref.url)}" target="_blank" rel="noopener noreferrer">${escapeHTML(ref.title)}</a>`:`<span class="reference-title">${escapeHTML(ref.title)}</span>`;
    return `<li id="reference-${escapeHTML(ref.id)}">${title}${ref.author?` · ${escapeHTML(ref.author)}`:''}${ref.year?` · ${escapeHTML(ref.year)}`:''}${ref.locator?`<p class="reference-locator">${escapeHTML(ref.locator)}</p>`:''}${ref.source_path?`<p class="reference-source">原始材料位置 / Original source: <code>${escapeHTML(ref.source_path)}</code></p>`:''}</li>`;
  }).join('')}</ol></details>`;
}
function articleDirectoryHTML(lesson){
  const articles=displayedArticles(lesson),available=lesson.available_articles||articles;
  const selected=new Set(articles.map(article=>article.id));
  const others=available.filter(article=>!selected.has(article.id));
  return `<details class="article-directory" id="article-directory"><summary>讲解文章 / Articles · ${available.length} 篇<span>当前阅读 ${articles.length} 篇</span></summary><div class="article-directory-body"><p class="article-directory-label">当前阅读 / Reading now</p><ol class="article-current-list">${articles.map(article=>`<li><a href="#article-${escapeHTML(article.id)}">${escapeHTML(article.title)}<small>${escapeHTML(article.english_title||'')}</small></a><span>${state.articleRead.has(article.id)?'已读 / Read':''}</span></li>`).join('')}</ol><section class="other-articles"><h2>本节点其他讲解 / Other articles</h2>${others.length?`<ul>${others.map(article=>`<li><button data-open-article="${escapeHTML(article.id)}"><span>${escapeHTML(article.title)}</span><small>${escapeHTML(article.english_title||'')}</small></button><span>${state.articleRead.has(article.id)?'已读 / Read':'打开 →'}</span></li>`).join('')}</ul>`:'<p>本节点的其他讲解暂未添加。</p>'}</section><details class="article-selection"><summary>${state.learningRoute?'为当前路线选择讲解':'调整我的阅读选择'} / Select articles</summary><p>${state.learningRoute?`路线：${escapeHTML(state.learningRoute.title)}。`:''}可以选择一篇或多篇，按下面的顺序阅读。选择仅保存在这台设备上。</p><form id="article-selection-form"><div class="article-choice-list">${available.map(article=>`<label><input type="checkbox" name="article" value="${escapeHTML(article.id)}" ${selected.has(article.id)?'checked':''}><span>${escapeHTML(article.title)}<small>${escapeHTML(article.english_title||'')}</small></span></label>`).join('')}</div><p class="article-directory-label">阅读顺序 / Reading order</p><ol class="article-selection-order" id="article-selection-order"></ol><div class="article-selection-actions"><button type="submit" class="resource-chip" id="apply-article-selection">应用选择 / Apply</button><button type="button" class="text-button" id="reset-article-selection">恢复${state.learningRoute?'路线':'节点'}默认选择</button></div><p class="article-selection-status" id="article-selection-status" role="status"></p></form></details></div></details>`;
}
function bindArticleDirectory(lesson){
  const articles=displayedArticles(lesson),available=lesson.available_articles||articles;
  let order=articles.map(article=>article.id);
  const names=new Map(available.map(article=>[article.id,article.title]));
  const form=document.getElementById('article-selection-form'),list=document.getElementById('article-selection-order');
  const updateOrder=()=>{
    list.innerHTML=order.map((id,index)=>`<li><span>${escapeHTML(names.get(id)||id)}</span><div><button type="button" data-move-article="${escapeHTML(id)}" data-direction="-1" aria-label="将 ${escapeHTML(names.get(id)||id)} 上移" ${index===0?'disabled':''}>↑</button><button type="button" data-move-article="${escapeHTML(id)}" data-direction="1" aria-label="将 ${escapeHTML(names.get(id)||id)} 下移" ${index===order.length-1?'disabled':''}>↓</button></div></li>`).join('');
    document.getElementById('apply-article-selection').disabled=!order.length;
    document.getElementById('article-selection-status').textContent=order.length?'':'请至少选择一篇讲解 / Select at least one article';
    list.querySelectorAll('[data-move-article]').forEach(button=>button.onclick=()=>{const from=order.indexOf(button.dataset.moveArticle),to=from+Number(button.dataset.direction);if(to<0||to>=order.length)return;[order[from],order[to]]=[order[to],order[from]];updateOrder();});
  };
  form.querySelectorAll('input[name="article"]').forEach(input=>input.onchange=()=>{if(input.checked){if(!order.includes(input.value))order.push(input.value);}else order=order.filter(id=>id!==input.value);updateOrder();});
  form.onsubmit=event=>{event.preventDefault();if(!order.length)return;state.articleSelections[selectionKey(lesson.id)]=[...order];persist();openLesson(lesson.id,{articles:order,restore:0});};
  document.getElementById('reset-article-selection').onclick=()=>{delete state.articleSelections[selectionKey(lesson.id)];persist();openLesson(lesson.id,{restore:0});};
  app.querySelectorAll('[data-open-article]').forEach(button=>button.onclick=()=>openLesson(lesson.id,{articles:[button.dataset.openArticle],fromLink:true,restore:0}));
  updateOrder();
}
function renderSelectedArticles(lesson,content){
  const articles=displayedArticles(lesson),showHeading=(lesson.available_articles||articles).length>1||articles.length>1;
  content.innerHTML=articles.map((article,index)=>`<section class="reader-article" id="article-${escapeHTML(article.id)}" data-article-id="${escapeHTML(article.id)}">${showHeading?`<header class="article-heading"><p>讲解 ${index+1} / ARTICLE ${index+1}</p><h2>${escapeHTML(article.title)}</h2><p class="article-english">${escapeHTML(article.english_title||'')}</p><button class="article-read-toggle" data-read-article="${escapeHTML(article.id)}" aria-pressed="${state.articleRead.has(article.id)}">${state.articleRead.has(article.id)?'• 本篇已读':'标记本篇已读'}</button></header>`:''}<div class="article-content">${cleanLessonHTML(article.html)}</div><section class="resource-section article-resources" hidden></section>${renderBibliography(article.bibliography||article.reference_entries||[])}</section>`).join('');
  articles.forEach(article=>{
    const section=content.querySelector(`[data-article-id="${CSS.escape(article.id)}"]`),body=section.querySelector('.article-content');
    renderResources({...lesson,...article,id:lesson.id},body,section.querySelector('.article-resources'));
    window.MTreeLessonEnvironments?.enhance(body);
    const anchors=new Map();section.querySelectorAll('[id]').forEach(element=>{const original=element.id;anchors.set(original,`article-${article.id}--${original}`);element.dataset.originalAnchor=original;element.id=anchors.get(original);});
    section.querySelectorAll('a[href^="#"]:not([href^="#/"])').forEach(link=>{const original=decodeURIComponent(link.getAttribute('href').slice(1));if(anchors.has(original))link.setAttribute('href','#'+anchors.get(original));});
  });
  content.querySelectorAll('[data-read-article]').forEach(button=>button.onclick=()=>{const id=button.dataset.readArticle;state.articleRead.has(id)?state.articleRead.delete(id):state.articleRead.add(id);persist();button.textContent=state.articleRead.has(id)?'• 本篇已读':'标记本篇已读';button.setAttribute('aria-pressed',state.articleRead.has(id));});
}
function renderLesson(lesson) {
  const previous=state.readingStack.at(-1);
  const english=lesson.english_title || byId(lesson.id)?.english_title || '';
  const prerequisites=lesson.prerequisites || state.graph.edges.filter(edge=>edge.type==='prerequisite'&&edge.target===lesson.id).map(edge=>edge.source);
  const empty=isEmptyLesson(lesson);
  const exercise=isExercise(lesson)||isExercise(byId(lesson.id));
  const containing=state.graph.edges.filter(edge=>edge.type==='contains'&&edge.source===lesson.id).map(edge=>edge.target).filter(id=>byId(id)&&!isExercise(byId(id)));
  const practices=exercise?[]:exerciseNodes().filter(node=>directlyRequired(node).includes(lesson.id));
  const returnHash=exercise?state.exerciseReturn:state.readingMapReturn||mapHash(lesson.subject);
  const returnLabel=exercise?'返回习题库 / Back to exercises':state.learningRoute?'返回学习路线 / Back to route':'返回知识图谱 / Back to map';
  app.innerHTML=`<article class="reader-page ${exercise?'exercise-reader':''} page-enter"><div class="reader-topline"><a class="reader-back" id="reader-back" href="${returnHash}">← ${previous ? `返回原讲义 · ${escapeHTML(titleOf(previous.id))}` : returnLabel}</a><div class="reader-tools"><button id="toggle-read" class="read-toggle"></button><button id="toggle-understood" class="understood-toggle"></button><a class="reader-workspace" href="#/workspace?node=${encodeURIComponent(lesson.id)}">写作空间</a></div></div><header class="reader-heading"><p class="eyebrow">${escapeHTML(subjectInfo(lesson.subject || state.subject).english.toUpperCase())} · ${exercise?'EXERCISE':'CONCEPT'}</p><h1>${escapeHTML(lesson.title)}</h1><p class="reader-english">${escapeHTML(english)}</p><p class="lesson-progress" id="lesson-progress"></p>${lesson.objective?`<p class="reader-objective"><span>LEARNING OBJECTIVE · 学习目标</span>${escapeHTML(lesson.objective)}</p>`:''}${exercise?requirementDiagram({...byId(lesson.id),...lesson}):prerequisites.length?`<div class="prerequisite-strip"><span>前置依赖 / Prerequisites</span>${prerequisites.filter(id=>!isExercise(byId(id))).map(id=>`<a href="/learn/${encodeURIComponent(id)}">${escapeHTML(titleOf(id))} <span>${escapeHTML(byId(id)?.english_title||'')}</span></a>`).join('')}</div>`:''}</header><div class="lesson-content" id="lesson-content">${empty?`<section class="empty-lesson"><div class="empty-disc">＋</div><h2>这一个节点，等待你的讲义。</h2><p>内容筹备中 / Content coming soon</p><p>它已经连接到知识图谱。先修与相关节点可以自由探索。</p><a class="primary-button" href="#/workspace?node=${encodeURIComponent(lesson.id)}">开始写作 / Write this lesson <span>↗</span></a></section>`:cleanLessonHTML(lesson.html)}</div><section class="resource-section" id="lesson-resources" hidden></section>${containing.length?`<details class="lesson-components"><summary>可复用的小节点 / Reusable concepts · ${containing.length}</summary><div>${containing.map(id=>`<a href="/learn/${encodeURIComponent(id)}">${escapeHTML(titleOf(id))}<small>${escapeHTML(byId(id)?.english_title||'')}</small></a>`).join('')}</div></details>`:''}${practices.length?`<section class="lesson-practice"><div><h2>练习这一概念 / Practice</h2><p>${practices.length} 份习题直接使用此知识节点。</p></div><a href="#/exercises?node=${encodeURIComponent(lesson.id)}">前往习题库 →</a></section>`:''}${renderBibliography(lesson.bibliography || [])}<footer class="reader-ending"><span class="end-symbol">${empty?'○':'✧'}</span><h2>${exercise?'把练习连回知识。':empty?'回到知识网络':'把这一段理解，连回知识网络。'}</h2><p>${empty?'沿着关联，寻找下一个概念。':`继续向下滚动，${exercise?'回到习题库':'回到图谱'}并标记为已读。已理解需要你主动勾选。`}</p><button class="primary-button" id="finish-reading">${empty?returnLabel:exercise?'完成阅读，返回习题库 / Finish & return':'完成阅读，返回图谱 / Finish & return'} <span>↑</span></button><div class="end-scroll-hint" id="bottom-hint">${empty?'':'到达底部后，再向下滚动一次'}</div></footer></article>`;
  document.getElementById('reader-back').onclick=event=>{event.preventDefault();returnFromReading(false);};
  if(STATIC_SITE)app.querySelectorAll('.reader-workspace,.empty-lesson .primary-button').forEach(element=>element.remove());
  if(!exercise&&nodeSubjects(lesson).length>1){
    app.querySelector('.reader-heading').insertAdjacentHTML('beforeend',`<nav class="lesson-subjects" aria-label="复用此概念的主题 Topics using this concept"><span>同一概念，多个主题 / Shared concept</span>${nodeSubjects(lesson).map(subject=>`<a href="${mapHash(subject,null)}" ${subject===state.subject?'aria-current="page"':''}>${escapeHTML(subjectInfo(subject).title)} <small>${escapeHTML(subjectInfo(subject).english)}</small>${subject===lesson.subject?'<em>主要归属 / Primary</em>':''}</a>`).join('')}</nav>`);
  }
  document.getElementById('finish-reading').onclick=()=>returnFromReading(!empty,true);
  const readToggle=document.getElementById('toggle-read');
  const understoodToggle=document.getElementById('toggle-understood');
  readToggle.hidden=empty;understoodToggle.hidden=empty;
  const updateProgress=()=>{
    readToggle.textContent=state.read.has(lesson.id)?'• 已读':'标记已读';
    understoodToggle.textContent=state.understood.has(lesson.id)?'✓ 已理解':'标记已理解';
    readToggle.setAttribute('aria-pressed',state.read.has(lesson.id));understoodToggle.setAttribute('aria-pressed',state.understood.has(lesson.id));
    const status=document.getElementById('lesson-progress');status.className=`lesson-progress ${progressClass(lesson.id)}`;status.textContent=progressLabel(lesson.id);
  };
  readToggle.onclick=()=>{state.read.has(lesson.id)?state.read.delete(lesson.id):state.read.add(lesson.id);persist();updateProgress();};
  understoodToggle.onclick=()=>{state.understood.has(lesson.id)?state.understood.delete(lesson.id):state.understood.add(lesson.id);persist();updateProgress();};
  updateProgress();
  const content=document.getElementById('lesson-content');
  app.querySelector('.reader-heading').insertAdjacentHTML('afterend',articleDirectoryHTML(lesson));
  bindArticleDirectory(lesson);
  if(state.learningRoute){
    const steps=state.learningRoute.steps||[],index=steps.findIndex(step=>step.node_id===lesson.id),next=steps[index+1];
    app.querySelector('.reader-heading').insertAdjacentHTML('beforebegin',`<div class="route-reading-context"><a href="${state.readingMapReturn||mapHash(lesson.subject)}">${escapeHTML(state.learningRoute.title)}</a><span>${index>=0?`${index+1} / ${steps.length} 个知识节点`:'路线外的关联知识'}</span>${index>=0&&next?`<button id="next-route-node">下一节点 →</button>`:''}</div>`);
    const nextButton=document.getElementById('next-route-node');if(nextButton)nextButton.onclick=()=>openLesson(next.node_id,{restore:0});
  }
  if(!empty){
    app.querySelector('.reader-page>.references')?.remove();
    renderSelectedArticles(lesson,content);
  }
  renderMath(content);
  const externalLinks=window.MTreeExternalLinks?.render(lesson)||'';
  if(externalLinks)document.getElementById('lesson-resources').insertAdjacentHTML('afterend',externalLinks);
  app.querySelectorAll('a[href]').forEach(link=>{
    const href=link.getAttribute('href');
    if (/^#[^/]/.test(href)) {
      link.onclick=event=>{event.preventDefault();scrollToAnchor(decodeURIComponent(href.slice(1)));};
    } else if (/^#?\/learn\//.test(href) || /^node:/.test(href)) {
      const target=new URL(href.startsWith('node:')?'/learn/'+href.slice(5):href.replace(/^#/,''),location.origin);
      const id=decodeURIComponent(target.pathname.slice(7)),anchor=target.searchParams.get('anchor')||decodeURIComponent(target.hash.slice(1)),articles=target.searchParams.get('articles')?.split(',').filter(Boolean)||null;
      link.dataset.node=id;
      link.onclick=event=>{event.preventDefault();if(id===lesson.id&&anchor&&(!articles||articles.join(',')===displayedArticles(lesson).map(article=>article.id).join(','))){scrollToAnchor(anchor);}else openLesson(id,{anchor,articles,fromLink:true,routeId:target.searchParams.get('route')||state.currentRouteId});};
    } else if (/^https?:\/\//.test(href)) {link.target='_blank';link.rel='noopener noreferrer';}
  });
}
function videoFigure(lesson,resource) {
  const figure=document.createElement('figure'); figure.className='lesson-media';
  const video=document.createElement('video'); video.controls=true;video.preload='metadata';video.playsInline=true;video.src=assetURL(lesson,resource);
  if(resource.poster_url)video.poster=resource.poster_url;
  if(resource.caption_url){
    const track=document.createElement('track');track.kind='captions';track.srclang='zh';
      track.label=resource.captions_label||'中文讲解 / Chinese narration';track.src=resource.caption_url;
    video.append(track);
  }
  video.setAttribute('aria-label',resource.title||`${lesson.title} 动画 / Animation`);
  video.append(document.createTextNode('当前浏览器不支持视频，请通过下方链接下载。'));
  figure.append(video);
  const caption=document.createElement('figcaption');caption.className='media-caption';
  const text=document.createElement('span');text.textContent=resource.title || (resource.id==='existing-determinant-video'?'行列式动画 / Determinant animation':'数学动画 / Mathematical animation');
  const download=document.createElement('a');download.href=assetURL(lesson,resource);download.textContent='打开视频 / Open video';download.target='_blank';download.rel='noopener';
  caption.append(text,download);figure.append(caption);
  video.addEventListener('error',()=>{text.textContent='视频暂不可用，请确认附件路径。Video unavailable.';});
  return figure;
}
function interactiveFigure(lesson,resource) {
  const figure=document.createElement('figure');figure.className='lesson-media interactive-figure';
  const frame=document.createElement('iframe');frame.className='interactive-viewer';
  frame.src=assetURL(lesson,resource);frame.title=resource.title||`${lesson.title} · 交互图 / Interactive figure`;
  frame.loading='lazy';frame.setAttribute('sandbox','allow-scripts');frame.referrerPolicy='no-referrer';
  figure.dataset.resourceKey=`${lesson.id}/${resource.id}`;
  figure.append(frame);
  return figure;
}
function localResourcePath(href) {
  try {const url=new URL(href,location.origin);return url.origin===location.origin?(STATIC_SITE?MTreeDataSource.sitePath(url.pathname):url.pathname):null;}
  catch {return null;}
}
function assetReference(href,lessonId) {
  const published=STATIC_SITE&&MTreeDataSource.resourceReference(href);if(published)return published;
  if(href.startsWith('asset:')) {
    const parts=href.slice(6).split('/');
    return parts.length===1?{owner:lessonId,id:parts[0]}:parts.length===2?{owner:parts[0],id:parts[1]}:null;
  }
  const match=localResourcePath(href)?.match(/^\/assets\/([^/]+)\/([^/]+)$/);
  if(!match)return null;
  try {return {owner:decodeURIComponent(match[1]),id:decodeURIComponent(match[2])};}catch{return null;}
}
function matchesResource(href,lesson,resource) {
  const ref=assetReference(href,lesson.id);
  if(ref?.owner===lesson.id&&ref.id===resource.id)return true;
  const path=localResourcePath(href);
  return !!path&&[assetURL(lesson,resource),resource.asset_url,resource.preview_url,resource.source_url]
    .filter(Boolean).some(url=>localResourcePath(url)===path);
}
function authorSourceLink(link,lesson) {
  const href=link.getAttribute('href')||'';
  const path=localResourcePath(href);
  const sourceExtension=/\.(?:md|markdown|typ|tex|ipynb|py|jl|m|rst|toml|json|ya?ml|txt|sh|ps1|bat|csv)$/i;
  if(path&&/^\/(?:sources|assets)\//.test(path)&&sourceExtension.test(path))return true;
  const resource=(lesson.resources||[]).find(item=>matchesResource(href,lesson,item));
  if(resource&&(resource.type==='notebook'||resource.type==='typst'&&resource.render_state!=='built'))return true;
  return /原始源稿|相关源文件|分段源码|Original source|Related source|Constituent source/i.test(link.textContent);
}
function replaceResourceLink(link,replacement=null) {
  const paragraph=link.closest('p');
  const target=paragraph&&paragraph.textContent.trim()===link.textContent.trim()?paragraph:link;
  if(replacement)target.replaceWith(replacement);else target.remove();
}
async function embedCrossNodeMedia(lesson,content,used) {
  const groups=new Map();
  content.querySelectorAll('a[href]').forEach(link=>{
    const ref=assetReference(link.getAttribute('href')||'',lesson.id);
    if(!ref||ref.owner===lesson.id)return;
    if(!groups.has(ref.owner))groups.set(ref.owner,[]);
    groups.get(ref.owner).push({link,...ref});
  });
  await Promise.all([...groups].map(async([owner,links])=>{
    try {
      const linkedLesson=await request(`/api/lessons/${encodeURIComponent(owner)}`);
      if(!content.isConnected||state.lesson?.id!==lesson.id)return;
      links.forEach(({link,id})=>{
        if(!link.isConnected)return;
        const resource=(linkedLesson.resources||[]).find(item=>item.id===id);
        if(!resource)return;
        if(authorSourceLink(link,linkedLesson)){replaceResourceLink(link);return;}
        if(!['html','video','manim'].includes(resource.type))return;
        const key=`${owner}/${id}`;
        if(used.has(key)){replaceResourceLink(link);return;}
        replaceResourceLink(link,resource.type==='html'?interactiveFigure(linkedLesson,resource):videoFigure(linkedLesson,resource));
        used.add(key);
      });
    } catch { /* Preserve the existing resource link when its owner cannot be loaded. */ }
  }));
}
function renderResources(lesson,content,attachmentSection=null) {
  const resources=lesson.resources || [];
  const used=new Set();
  const handouts=resources.filter(resource=>resource.type==='pdf'||resource.type==='typst'&&resource.render_state==='built');
  content.querySelectorAll('p>a[href]:only-child').forEach(link=>{
    if(link.parentElement.textContent.trim()!==link.textContent.trim())return;
    const resource=handouts.find(item=>matchesResource(link.getAttribute('href')||'',lesson,item));
    if(!resource)return;
    const figure=document.createElement('figure');figure.className='lesson-media inline-handout';
    const frame=document.createElement('iframe');frame.className='pdf-viewer';frame.src=assetURL(lesson,resource);frame.title=`${lesson.title} · 完整讲义 / PDF handout`;frame.loading='lazy';
    const caption=document.createElement('figcaption');caption.className='media-caption';
    const download=document.createElement('a');download.href=assetURL(lesson,resource);download.target='_blank';download.rel='noopener';download.textContent=link.textContent;
    caption.append(download);figure.append(frame,caption);replaceResourceLink(link,figure);used.add(`${lesson.id}/${resource.id}`);
  });
  const mediaResources=resources.filter(resource=>['video','manim','html'].includes(resource.type));
  content.querySelectorAll('a[href]').forEach(link=>{
    if(authorSourceLink(link,lesson)){replaceResourceLink(link);return;}
    const resource=mediaResources.find(resource=>matchesResource(link.getAttribute('href')||'',lesson,resource));
    if(!resource)return;
    const key=`${lesson.id}/${resource.id}`;
    if(used.has(key)){replaceResourceLink(link);return;}
    replaceResourceLink(link,resource.type==='html'?interactiveFigure(lesson,resource):videoFigure(lesson,resource));
    used.add(key);
  });
  for (const resource of mediaResources) {
    const key=`${lesson.id}/${resource.id}`;
    if(used.has(key))continue;
    const figure=resource.type==='html'?interactiveFigure(lesson,resource):videoFigure(lesson,resource);
    const intro=content.querySelector('p');
    if (resource.id==='existing-determinant-video'&&intro) intro.after(figure); else content.append(figure);
    used.add(key);
  }
  embedCrossNodeMedia(lesson,content,used);
  const attachments=handouts.filter(resource=>!used.has(`${lesson.id}/${resource.id}`));
  if(!attachments.length)return;
  const section=attachmentSection||document.getElementById('lesson-resources');section.hidden=false;
  section.innerHTML='<h2>讲义与附件 / Handouts & resources</h2><div class="resource-list"></div>';
  const list=section.querySelector('.resource-list');
  attachments.forEach(resource=>{
    const url=assetURL(lesson,resource);
    const button=document.createElement('button');button.className='resource-chip';button.type='button';
    button.innerHTML='↗ 完整讲义 <span>PDF handout</span>';
    button.onclick=()=>{
      const existing=section.querySelector(`[data-resource-view="${CSS.escape(resource.id)}"]`);
      if(existing){existing.remove();return;}
      const frame=document.createElement('iframe');frame.className='pdf-viewer';frame.src=url;frame.title=`${lesson.title} · 完整讲义 / PDF handout`;frame.dataset.resourceView=resource.id;
      frame.setAttribute('loading','lazy');section.append(frame);
    };
    const download=document.createElement('a');download.className='resource-chip';download.href=url;download.target='_blank';download.rel='noopener';download.innerHTML='↓ 下载 <span>Download PDF</span>';
    list.append(button,download);
  });
}
function atBottom() { return window.scrollY+window.innerHeight>=document.documentElement.scrollHeight-36; }
function updateBottom() {
  if(state.route!=='learn'||!state.lesson)return;
  if(atBottom()) {if(!state.bottomAt)state.bottomAt=performance.now();}
  else state.bottomAt=0;
}
window.addEventListener('scroll',()=>{
  if(state.route==='learn') {
    updateBottom();clearTimeout(state.saveTimer);state.saveTimer=setTimeout(saveReadingPosition,250);
  } else if(state.route==='map') state.mapScroll=window.scrollY;
},{passive:true});
window.addEventListener('wheel',event=>{
  const now=performance.now(),gap=now-state.lastWheel;
  state.lastWheel=now;
  if(state.route!=='learn'||writer.open||event.ctrlKey)return;
  updateBottom();
  // The pause and gesture gap keep the wheel's arrival inertia from closing the lesson.
  if(event.deltaY>5&&atBottom()&&state.bottomAt&&now-state.bottomAt>650&&gap>220) {
    event.preventDefault();returnFromReading(!isEmptyLesson(state.lesson),true);
  }
},{passive:false});
window.addEventListener('touchstart',event=>{
  if(state.route!=='learn'||writer.open)return;
  updateBottom();state.touchStartY=event.touches[0]?.clientY;
  state.touchArmed=atBottom()&&!!state.bottomAt&&performance.now()-state.bottomAt>650;
},{passive:true});
window.addEventListener('touchmove',event=>{
  if(!state.touchArmed||state.route!=='learn'||writer.open)return;
  const y=event.touches[0]?.clientY;
  if(state.touchStartY-y>45) {event.preventDefault();state.touchArmed=false;returnFromReading(!isEmptyLesson(state.lesson),true);}
},{passive:false});
window.addEventListener('keydown',event=>{
  if(state.route!=='learn'||writer.open||/INPUT|TEXTAREA|SELECT|BUTTON/.test(event.target.tagName))return;
  if(['PageDown','ArrowDown',' '].includes(event.key)&&atBottom()&&state.bottomAt&&performance.now()-state.bottomAt>650) {event.preventDefault();returnFromReading(!isEmptyLesson(state.lesson),true);}
});
window.addEventListener('beforeunload',saveReadingPosition);
function writerStatus(message,error=false) {
  const status=document.getElementById('writer-status');status.textContent=message;status.classList.toggle('error',error);
}
function setField(name,value) {writerForm.elements.namedItem(name).value=value??'';}
function fillRelations(field,selected,ownId) {
  const select=writerForm.elements.namedItem(field);
  select.innerHTML=state.graph.nodes.filter(node=>node.id!==ownId).map(node=>`<option value="${escapeHTML(node.id)}" ${selected.includes(node.id)?'selected':''}>${escapeHTML(node.title)} · ${escapeHTML(node.english_title||node.id)}</option>`).join('');
}
function nodePrefix(subject) {return ({'linear-algebra':'la.','finite-difference-methods':'fd.','computational-tools':'tools.','calculus':'calc.'})[subject] || `${subject.replace(/-/g,'.')}.`;}
function openWriter(lesson=null) {
  state.writerEdit=lesson?.id||null;
  writerForm.reset();writerStatus('');
  document.getElementById('writer-sync-note').hidden=lesson?.primary_format!=='typst';
  document.getElementById('writer-title').textContent=lesson?'编辑知识节点 / Edit node':'添加知识节点 / Add node';
  const subject=lesson?.subject||byId(lesson?.id)?.subject||state.subject;
   const choices=[...new Set([...Object.keys(SUBJECTS),...availableSubjects().map(item=>item.id),subject])];
   writerForm.elements.namedItem('subject').innerHTML=choices.map(id=>`<option value="${escapeHTML(id)}">${escapeHTML(subjectInfo(id).title)} · ${escapeHTML(subjectInfo(id).english)}</option>`).join('');
   setField('subject',subject);
   setField('id',lesson?.id||nodePrefix(subject));writerForm.elements.namedItem('id').readOnly=!!lesson;
  setField('title',lesson?.title||'');setField('english_title',lesson?.english_title||byId(lesson?.id)?.english_title||'');
  setField('objective',lesson?.objective||'');setField('status',lesson?.status||'draft');
  const prerequisites=lesson?.prerequisites||state.graph.edges.filter(edge=>edge.type==='prerequisite'&&edge.target===lesson?.id).map(edge=>edge.source);
  const related=lesson?.related||state.graph.edges.filter(edge=>edge.type==='related'&&edge.source===lesson?.id).map(edge=>edge.target);
  fillRelations('prerequisites',prerequisites,lesson?.id);fillRelations('related',related,lesson?.id);
  setField('markdown',lesson?.markdown||'<a id="definition"></a>\n## 定义 Definition\n\n\n<a id="example"></a>\n## 例子 Example\n\n\n<a id="connections"></a>\n## 关联 Connections\n\n');
  writer.showModal();
}
writerForm.elements.namedItem('subject').onchange=event=>{if(!state.writerEdit){const id=writerForm.elements.namedItem('id');if(id.value.endsWith('.'))id.value=nodePrefix(event.target.value);}};
document.getElementById('close-writer').onclick=()=>writer.close();
document.getElementById('cancel-writer').onclick=()=>writer.close();
writer.addEventListener('click',event=>{if(event.target===writer){const rect=writer.getBoundingClientRect();if(event.clientX<rect.left||event.clientX>rect.right||event.clientY<rect.top||event.clientY>rect.bottom)writer.close();}});
writerForm.onsubmit=async event=>{
  event.preventDefault();
  const value=name=>writerForm.elements.namedItem(name).value.trim();
  const selected=name=>[...writerForm.elements.namedItem(name).selectedOptions].map(option=>option.value);
  const id=value('id');
  const assetFile=writerForm.elements.namedItem('asset_file').files[0];
  if(assetFile&&!value('asset_id')){writerStatus('上传附件需要填写固定附件 ID。An asset ID is required.',true);return;}
  const payload={id,title:value('title'),english_title:value('english_title'),subject:value('subject'),objective:value('objective'),prerequisites:selected('prerequisites'),related:selected('related'),markdown:writerForm.elements.namedItem('markdown').value,status:value('status'),content_status:'available'};
  const saveButton=document.getElementById('save-content');saveButton.disabled=true;
  let nodeSaved=false;
  try {
    writerStatus('正在检查并保存讲义… / Checking and saving…');
    await request(state.writerEdit?`/api/nodes/${encodeURIComponent(id)}`:'/api/nodes',{method:state.writerEdit?'PUT':'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
    nodeSaved=true;state.writerEdit=id;
    if(assetFile) {
      writerStatus('讲义已保存，正在上传附件… / Lesson saved, uploading attachment…');
      const form=new FormData();form.append('file',assetFile);form.append('id',value('asset_id'));form.append('type',value('asset_type'));
      await request(`/api/nodes/${encodeURIComponent(id)}/assets`,{method:'POST',body:form});
    }
    await refreshGraph();writer.close();state.readingStack=[];
    toast('节点已保存 / Node saved');openLesson(id,{restore:0});
  } catch(error) {
    writerStatus(`${nodeSaved?'讲义已经保存，附件或刷新未完成。可以修正后重试。\nLesson saved; attachment or refresh failed.\n':''}${error.message}`,true);
    if(nodeSaved){writerForm.elements.namedItem('id').readOnly=true;await refreshGraph().catch(()=>{});}
  } finally {saveButton.disabled=false;}
};
document.addEventListener('click',event=>{
  const results=document.getElementById('search-results');
  if(results&&!event.target.closest('.search-box'))results.hidden=true;
});
window.addEventListener('hashchange',route);
// The registry also exports shareable /learn/id#anchor URLs. Normalize them once.
if (location.pathname.startsWith('/learn/') && !location.hash.startsWith('#/')) {
  const id=decodeURIComponent(location.pathname.slice('/learn/'.length));
  const anchor=location.hash.slice(1);
  history.replaceState(null,'',`/#/learn/${encodeURIComponent(id)}${anchor?`?anchor=${encodeURIComponent(anchor)}`:''}`);
}
route();
