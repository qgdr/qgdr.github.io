/* Bounded, deterministic exploration of existing knowledge relations. No DOM or AI. */
(() => {
  'use strict';
  const sessions = new WeakMap();
  const directions = ['prerequisites', 'dependents', 'related'];
  const compare = (a, b) => a < b ? -1 : a > b ? 1 : 0;
  function integer(value, fallback, name) {
    if(value === undefined) return fallback;
    if(!Number.isInteger(value) || value < 1) throw new TypeError(`${name} must be a positive integer`);
    return value;
  }
  function context(session) {
    const value = session && sessions.get(session);
    if(!value) throw new TypeError('Use a session returned by MTreeConceptExplorer.create');
    return value;
  }
  function uniqueEdges(edges, nodes) {
    const found = new Set(), result = [];
    for(const edge of edges || []) {
      if(!edge || !nodes.has(edge.source) || !nodes.has(edge.target) || edge.source === edge.target) continue;
      const type = edge.type || 'related';
      const [source, target] = type === 'related' ? [edge.source, edge.target].sort(compare) : [edge.source, edge.target];
      const key = JSON.stringify([type, source, target]);
      if(found.has(key)) continue;
      found.add(key);
      result.push({...edge, source, target, type});
    }
    return result.sort((a, b) => compare(a.source, b.source) || compare(a.target, b.target) || compare(a.type, b.type));
  }
  function closure(index, focusId) {
    const result = new Set([focusId]), queue = [focusId];
    for(let cursor = 0; cursor < queue.length; cursor++) {
      for(const id of index.get(queue[cursor])) {
        if(!result.has(id)) { result.add(id); queue.push(id); }
      }
    }
    return result;
  }
  function create(graph, focusId, {initialLimit = 32, maxNodes = 96, batchSize = 12} = {}) {
    if(!graph || !Array.isArray(graph.nodes) || !Array.isArray(graph.edges)) throw new TypeError('A graph with nodes and edges is required');
    const nodes = new Map();
    for(const node of graph.nodes) {
      if(!node || node.kind === 'exercise' || typeof node.id !== 'string' || !node.id) continue;
      if(nodes.has(node.id)) throw new TypeError(`Duplicate knowledge node: ${node.id}`);
      nodes.set(node.id, node);
    }
    if(!nodes.has(focusId)) throw new RangeError('Choose an existing knowledge node as focus');
    const budget = integer(maxNodes, 96, 'maxNodes');
    const initial = Math.min(integer(initialLimit, 32, 'initialLimit'), budget);
    const batch = integer(batchSize, 12, 'batchSize');
    const declaredEdges = [...graph.edges];
    for(const node of nodes.values()) {
      for(const source of Array.isArray(node.prerequisites) ? node.prerequisites : []) {
        declaredEdges.push({source, target: node.id, type: 'prerequisite'});
      }
    }
    const edges = uniqueEdges(declaredEdges, nodes);
    const adjacency = Object.fromEntries(directions.map(direction => [direction, new Map([...nodes.keys()].map(id => [id, new Set()]))]));
    for(const edge of edges) {
      if(edge.type === 'prerequisite') {
        adjacency.prerequisites.get(edge.target).add(edge.source);
        adjacency.dependents.get(edge.source).add(edge.target);
      } else if(edge.type === 'related') {
        adjacency.related.get(edge.source).add(edge.target);
        adjacency.related.get(edge.target).add(edge.source);
      }
    }
    for(const index of Object.values(adjacency)) {
      for(const [id, neighbors] of index) index.set(id, [...neighbors].sort(compare));
    }
    const required = closure(adjacency.prerequisites, focusId);
    const visible = new Set([focusId]);
    let level = [focusId];
    const visited = new Set(level);
    // Follow only the target's prerequisite chain. Wider branches are opt-in.
    while(level.length&&visible.size<initial) {
      const next = [...new Set(level.flatMap(id => adjacency.prerequisites.get(id)))].filter(id => !visited.has(id)).sort(compare);
      next.forEach(id => visited.add(id));
      for(const id of next) if(visible.size < initial) visible.add(id);
      level = next;
    }
    for(const [direction, allowance] of [['dependents', 2]]) {
      let added = 0;
      for(const id of adjacency[direction].get(focusId)) {
        if(added >= allowance || visible.size >= initial) break;
        if(!visible.has(id)) { visible.add(id); added++; }
      }
    }
    const session = Object.freeze({focusId});
    sessions.set(session, {focusId, nodes, edges, adjacency, required, visible, maxNodes: budget, batchSize: batch});
    return session;
  }
  function frontierFor(data, direction, requiredOnly = false) {
    const anchors = [...data.visible].sort((a, b) => a === b ? 0 : a === data.focusId ? -1 : b === data.focusId ? 1 : compare(a, b));
    const result = [];
    for(const id of anchors) {
      const candidateIds = data.adjacency[direction].get(id).filter(candidate => !data.visible.has(candidate)&&(!requiredOnly||data.required.has(candidate)));
      if(!candidateIds.length) continue;
      const node = data.nodes.get(id);
      result.push({id, title: node.title || id, english_title: node.english_title || '',
                   hiddenCount: candidateIds.length, candidateIds});
    }
    return result;
  }
  function snapshot(session) {
    const data = context(session);
    const frontier = Object.fromEntries(directions.map(direction => [direction, frontierFor(data, direction)]));
    const requiredVisible = [...data.visible].filter(id => data.required.has(id)).length;
    const frontierCandidates = Object.fromEntries(directions.map(direction => [direction, new Set(frontier[direction].flatMap(item => item.candidateIds)).size]));
    return {
      nodes: [...data.visible].map(id => data.nodes.get(id)),
      edges: data.edges.filter(edge => data.visible.has(edge.source) && data.visible.has(edge.target)),
      focusId: data.focusId,
      maxNodes: data.maxNodes,
      batchSize: data.batchSize,
      counts: {visibleNodes: data.visible.size, totalKnowledgeNodes: data.nodes.size,
               requiredVisible, requiredTotal: data.required.size, requiredRemaining: data.required.size - requiredVisible,
               prerequisitesVisible: requiredVisible - 1, prerequisitesTotal: data.required.size - 1,
               maxNodes: data.maxNodes, remainingCapacity: Math.max(0, data.maxNodes - data.visible.size),
               frontierCandidates},
      frontier,
      requiredFrontier: frontierFor(data, 'prerequisites', true),
      atLimit: data.visible.size >= data.maxNodes,
      exhausted: Object.fromEntries(directions.map(direction => [direction, frontierCandidates[direction] === 0]))
    };
  }
  function expand(session, direction, {anchorId, limit, requiredOnly = false} = {}) {
    const data = context(session);
    if(!directions.includes(direction)) throw new RangeError('Expand prerequisites, dependents or related');
    if(typeof requiredOnly!=='boolean'||requiredOnly&&direction!=='prerequisites')throw new RangeError('Required-only expansion is limited to prerequisites');
    if(anchorId !== undefined && !data.visible.has(anchorId)) throw new RangeError('Expansion anchor must be visible');
    const batch = integer(limit, data.batchSize, 'limit');
    const room = Math.min(batch, Math.max(0, data.maxNodes - data.visible.size));
    const frontier = frontierFor(data, direction, requiredOnly).filter(item => anchorId === undefined || item.id === anchorId);
    const candidates = [...new Set(frontier.flatMap(item => item.candidateIds))];
    if(direction === 'prerequisites') candidates.sort((a, b) => Number(data.required.has(b)) - Number(data.required.has(a)));
    const addedIds = candidates.slice(0, room);
    addedIds.forEach(id => data.visible.add(id));
    return {...snapshot(session), addedIds};
  }
  globalThis.MTreeConceptExplorer = Object.freeze({create, snapshot, expand});
})();
