/* Optional, file-managed links. Rendering never fetches an external website. */
(function(global){
  'use strict';
  const escape=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const kinds={video:['外部视频','External video'],article:['延伸阅读','Further reading'],website:['网站','Website'],tool:['学习工具','Learning tool']};
  function collect(lesson){
    const sources=[...(lesson.external_links||[]),...(lesson.articles||[]).flatMap(article=>article.external_links||[])];
    const found=new Set(),links=[];
    for(const item of sources){
      if(!item||typeof item.url!=='string'||/[\u0000-\u0020\u007f]/.test(item.url))continue;
      let url;try{url=new URL(item.url);}catch{continue;}
      if(!['https:','http:'].includes(url.protocol)||url.username||url.password||found.has(url.href))continue;
      found.add(url.href);links.push({...item,url:url.href,host:url.hostname.replace(/^www\./,'')});
    }
    return links;
  }
  function render(lesson){
    const links=collect(lesson);if(!links.length)return '';
    return `<section class="external-resources" aria-labelledby="external-resources-title"><header><h2 id="external-resources-title">延伸资源 <span>Further resources</span></h2><p>换一种讲法，继续理解。<span>Explore another perspective.</span></p></header><div class="external-resource-list">${links.map(link=>{
      const [title,english]=kinds[link.kind]||kinds.website;
      const icon=link.kind==='video'?'<path d="m10 7 8 5-8 5Z"/>':'<path d="M7 5h10v14H7zM10 9h4m-4 4h4"/>';
      return `<a class="external-resource-card external-resource-${escape(link.kind||'website')}" href="${escape(link.url)}" target="_blank" rel="noopener noreferrer" aria-label="${escape(link.title)} / ${escape(link.english_title||english)} · 在新标签页打开 / Open in a new tab"><span class="external-resource-icon" aria-hidden="true"><svg viewBox="0 0 24 24">${icon}</svg></span><span class="external-resource-copy"><span class="external-resource-type">${escape(title)} <span lang="en">${escape(english)}</span></span><strong>${escape(link.title)}</strong>${link.english_title?`<span class="external-resource-english" lang="en">${escape(link.english_title)}</span>`:''}${link.description?`<span class="external-resource-description">${escape(link.description)}</span>`:''}<span class="external-resource-provider">${escape(link.provider||link.host)} <span>· 新标签页打开 / Opens in a new tab</span></span></span><span class="external-resource-arrow" aria-hidden="true">↗</span></a>`;
    }).join('')}</div></section>`;
  }
  global.MTreeExternalLinks={collect,render};
})(typeof window==='undefined'?globalThis:window);
