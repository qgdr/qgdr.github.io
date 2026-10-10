/* Progressive, content-preserving mathematics typography. No source is rewritten. */
(function (global) {
  'use strict';

  const kinds = {
    definition: ['定义', 'Definition'], theorem: ['定理', 'Theorem'],
    lemma: ['引理', 'Lemma'], proposition: ['命题', 'Proposition'],
    corollary: ['推论', 'Corollary'], proof: ['证明', 'Proof'],
    explanation: ['讲解', 'Explanation'], example: ['例子', 'Example'],
    remark: ['注记', 'Remark']
  };
  const aliases = {def: 'definition', defination: 'definition', definitions: 'definition',
    definations: 'definition', thm: 'theorem', lem: 'lemma', prop: 'proposition',
    intuition: 'explanation', discussion: 'explanation', examples: 'example',
    note: 'remark', observation: 'remark'};
  const normalize = value => {
    const key = String(value || '').trim().toLowerCase();
    return kinds[key] ? key : aliases[key] || Object.keys(kinds).find(kind => kinds[kind][0] === key) || null;
  };
  function explicitKind(element) {
    const attribute = element.getAttribute('data-math-env') || element.getAttribute('data-environment');
    if (attribute) return normalize(attribute);
    for (const value of element.classList) {
      const kind = normalize(value.replace(/^(?:math-env|env)[-_]/, ''));
      if (kind) return kind;
    }
    return null;
  }
  function classify(text) {
    const title = String(text || '').trim().replace(/^\d+(?:\.\d+)*[.、)\s]+/, '');
    if (!title || title.length > 130) return null;
    // Proof takes priority in titles such as “命题证明”. Narrative sentences are
    // deliberately not inspected: their mathematical scope is ambiguous.
    if (/^(?:证明|推导与证明|推导或证明|命题证明|Proof\b)/i.test(title)) return 'proof';
    if (/^(?:定义|一般定义|补充定义|Definition\b|Definitions\b|Defination\b|Definations\b)/i.test(title)
        || /的定义(?:与|及|[（(/·]|$)/.test(title)) return 'definition';
    if (/^(?:定理|Theorem\b)/i.test(title) || /(?:\bTheorem\b|定理)(?:\s|[\d（(/·]|$)/i.test(title)) return 'theorem';
    if (/^(?:引理|Lemma\b)/i.test(title) || /(?:\bLemma\b|引理)(?:\s|[\d（(/·]|$)/i.test(title)) return 'lemma';
    if (/^(?:命题|Proposition\b)/i.test(title)) return 'proposition';
    if (/^(?:推论|Corollary\b)/i.test(title)) return 'corollary';
    if (/^(?:例子|例题|示例|一个.*例子|Example\b|Examples\b)/i.test(title)) return 'example';
    if (/^(?:讲解|解释|直觉|理解|从.{0,30}理解|Intuition\b|Explanation\b)/i.test(title)) return 'explanation';
    if (/^(?:注记|注释|备注|Remark\b|Note\b|Observation\b)/i.test(title)) return 'remark';
    return null;
  }
  const heading = element => /^H[1-6]$/.test(element.tagName);
  function anchorOnly(element) {
    if (element.tagName === 'A') return !!element.id && !element.textContent.trim();
    return element.tagName === 'P' && !element.textContent.trim()
      && element.children.length > 0 && Array.from(element.children).every(anchorOnly);
  }
  function marker(element) {
    if (/^H[2-6]$/.test(element.tagName)) {
      const kind = classify(element.textContent);
      return kind ? {kind, block: true} : null;
    }
    if (element.tagName !== 'P') return null;
    const first = element.firstElementChild;
    if (!first || !['STRONG', 'B'].includes(first.tagName)) return null;
    // A label must start the paragraph, not follow a sentence or an equation.
    if (Array.from(element.childNodes).slice(0, Array.from(element.childNodes).indexOf(first))
      .some(node => node.textContent.trim())) return null;
    const kind = classify(first.textContent);
    if (!kind) return null;
    const rest = element.textContent.slice(first.textContent.length).trim();
    // Inline “**定义**：对象…” is decorated by itself. Only a standalone
    // label has a reliably recoverable scope over following paragraphs.
    return {kind, block: !rest || /^[：:.。]$/.test(rest)};
  }
  function decorate(element, kind, title = null) {
    if (!kind || element.dataset.mathEnhanced) return;
    element.classList.add('math-environment', `math-environment--${kind}`);
    element.dataset.mathEnhanced = kind;
    if (title) title.classList.add('math-env-title');
    const compactTitle = title?.textContent.replace(/[\s/()（）·:：。.]/g, '').toLowerCase();
    const chineseName = kinds[kind][0], englishName = kinds[kind][1];
    const pureLabels = [chineseName, englishName.toLowerCase(),
      chineseName + englishName.toLowerCase(), englishName.toLowerCase() + chineseName];
    if (title && pureLabels.includes(compactTitle)) {
      // Reuse a short original label rather than displaying “Proof” twice.
      title.classList.add('math-env-title--label');
      if (compactTitle === chineseName || compactTitle === englishName.toLowerCase()) {
        const translation = document.createElement('span');
        translation.className = 'math-env-added-label';
        translation.textContent = ` / ${compactTitle === chineseName ? englishName : chineseName}`;
        title.append(translation);
      }
      return;
    }
    const caption = document.createElement('div');
    caption.className = 'math-env-caption';
    const chinese = document.createElement('span');
    chinese.className = 'math-env-kind'; chinese.textContent = kinds[kind][0];
    const english = document.createElement('span');
    english.className = 'math-env-english'; english.textContent = kinds[kind][1];
    caption.append(chinese, english); element.prepend(caption);
  }
  function reference(element) {
    return element.tagName === 'P' && /^(?:参考(?:文献)?[：:]|References?\s*[:：])/i.test(element.textContent.trim());
  }
  function boundary(node) {
    if (node.nodeType !== 1) return false;
    return heading(node) || node.tagName === 'HR' || reference(node)
      || node.matches('.math-environment, .math-env, [data-math-env], [data-environment]')
      || anchorOnly(node)
      || !!marker(node);
  }
  function enhanceBody(body) {
    // Imported manuscripts put empty anchors before their document title.
    // Keep that title in the DOM, but avoid repeating the reader's title.
    const firstContent = Array.from(body.children).find(element => !anchorOnly(element));
    if (firstContent?.tagName === 'H1') firstContent.classList.add('math-article-title');
    // Explicit bounded blocks are authoritative; never infer their internals.
    body.querySelectorAll('.math-env, [data-math-env], [data-environment]').forEach(element => {
      if (element.closest('.math-environment')) return;
      decorate(element, explicitKind(element), Array.from(element.children).find(child => heading(child)));
    });
    // A Markdown blockquote is already a precise scope. Only a leading typed
    // label makes it an environment; ordinary quotations stay quotations.
    body.querySelectorAll('blockquote').forEach(element => {
      if (element.closest('.math-environment')) return;
      const first = element.firstElementChild;
      const typed = first && marker(first);
      if (typed) decorate(element, typed.kind, first);
    });
    // Legacy headings and bold labels can be upgraded without rewriting their
    // text, formula nodes, IDs, link attributes or document order.
    const candidates = Array.from(body.querySelectorAll('h2,h3,h4,h5,h6,p'));
    for (const element of candidates) {
      if (!body.contains(element) || element.closest('.math-environment')
          || element.closest('blockquote,table,pre,li,figure,figcaption')) continue;
      const typed = marker(element);
      if (!typed) continue;
      // Infer ranges only among the article's direct children. Nested editorial
      // markup can have an independent scope, so decorate its label alone.
      const span = typed.block && element.parentElement === body;
      const section = document.createElement('section');
      element.before(section);
      section.append(element);
      if (span) {
        let next = section.nextSibling;
        while (next && !boundary(next)) {
          const following = next.nextSibling;
          section.append(next); next = following;
        }
      }
      decorate(section, typed.kind, typed.block ? element : null);
    }
  }
  function enhance(container) {
    if (!container || container.nodeType !== 1) return;
    if (container.matches('.article-content')) enhanceBody(container);
    else {
      const bodies = container.querySelectorAll('.article-content');
      if (bodies.length) bodies.forEach(enhanceBody);
      else enhanceBody(container);
    }
  }
  global.MTreeLessonEnvironments = Object.freeze({enhance});
})(window);
