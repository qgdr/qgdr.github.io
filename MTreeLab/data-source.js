/* Read the same published content without requiring a Python server. */
(() => {
  'use strict';
  const config=window.MTreeSiteConfig||{mode:'local',base_path:'/'};
  const isStatic=config.mode==='static';
  const basePath='/'+String(config.base_path||'/').replace(/^\/+|\/+$/g,'')+'/';
  const base=new URL(basePath==='//'?'/':basePath,location.origin);
  const cache=new Map();
  const resourceMap=new Map((config.resource_map||[]).map(item=>[new URL(item.url,base).pathname,{owner:item.owner,id:item.id}]));
  function sitePath(path){
    return base.pathname!=='/'&&path.startsWith(base.pathname)?'/'+path.slice(base.pathname.length):path;
  }
  async function json(path){
    if(!cache.has(path))cache.set(path,fetch(new URL((config.data_path||'data/')+path,base)).then(async response=>{
      if(!response.ok)throw new Error('内容暂不可用 / Content unavailable: '+path);
      return response.json();
    }).catch(error=>{cache.delete(path);throw error;}));
    return cache.get(path);
  }
  function identifier(value){
    if(!/^[a-z0-9][a-z0-9.\-]*$/.test(value))throw new Error('内容 ID 无效 / Invalid content ID');
    return value;
  }
  async function route(id){
    if(!id)return null;
    const data=await json('routes/'+identifier(id)+'.json');
    return data.route||data;
  }
  async function selectLesson(id,params){
    const lesson=await json('lessons/'+identifier(id)+'.json');
    const learningRoute=await route(params.get('route'));
    const step=learningRoute?.steps?.find(item=>item.node_id===id);
    if(params.getAll('articles').length>1)throw new Error('请只传入一组文章 / Pass one article selection');
    const selected=params.has('articles')?params.get('articles').split(','):step?.article_ids||lesson.default_articles;
    const lookup=new Map((lesson.all_articles||lesson.articles||[]).map(article=>[article.id,article]));
    if(!Array.isArray(selected)||!selected.length||new Set(selected).size!==selected.length||selected.some(key=>!lookup.has(key)))
      throw new Error('请选择本节点的一篇或多篇文章 / Select articles owned by this node');
    const {all_articles,...result}=lesson;
    return {...result,articles:selected.map(key=>lookup.get(key)),selected_article_ids:selected,route:learningRoute,in_route:learningRoute?!!step:null};
  }
  async function request(url,options={}){
    if((options.method||'GET').toUpperCase()!=='GET')throw new Error('请在本地写作空间维护内容 / Edit content in the local writing workspace');
    const target=new URL(url,location.origin),path=target.pathname,params=target.searchParams;
    let data;
    if(path==='/api/graph')data=await json(params.get('route')?'routes/'+identifier(params.get('route'))+'.json':'graph.json');
    else if(path==='/api/routes')data=await json('routes.json');
    else if(path.startsWith('/api/routes/'))data=await route(decodeURIComponent(path.slice('/api/routes/'.length)));
    else if(path.startsWith('/api/lessons/'))data=await selectLesson(decodeURIComponent(path.slice('/api/lessons/'.length)),params);
    else if(path==='/api/search'){
      const words=(params.get('q')||'').trim().toLowerCase().split(/\s+/).filter(Boolean);
      data=(await json('search-index.json')).filter(entry=>{
        const text=['title','english_title','objective','text'].map(key=>entry[key]||'').join(' ').toLowerCase();
        return words.every(word=>text.includes(word));
      }).map(({text,...entry})=>entry);
    }else throw new Error('静态内容入口不存在 / Static content not found');
    return structuredClone(data);
  }
  function resourceReference(href){
    try{return resourceMap.get(new URL(href,base).pathname)||null;}catch{return null;}
  }
  window.MTreeDataSource=Object.freeze({isStatic,request,sitePath,resourceReference});
})();
