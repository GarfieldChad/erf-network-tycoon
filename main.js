import {capacity,catalogue,equipment,services,variants} from './equipment.js';
import {advance,economy,HOURS_PER_SECOND,objectives} from './economy.js';
import {anchor,HEIGHT,icon,nodeMarkup,route,WIDTH} from './graphics.js';
import {simulate} from './network.js';
import {connect,install,load,save,snap} from './state.js';

const $ = id => document.getElementById(id);
const diagram = $('diagram'), world = $('world');
const loaded = load(window.localStorage), state = loaded.state;
let result = simulate(state), selected = state.nodes.find(node => node.type === 'furnace')?.id;
let selectedLink, buildMode, source, preview, gesture, ghost, paused = false;
let camera = {x:0,y:0,scale:1};
let lastSave = performance.now(), noticeTimer;
const cashFormatter = new Intl.NumberFormat('en-GB',{style:'currency',currency:'GBP',maximumFractionDigits:0});
const cash = value => cashFormatter.format(value);
const num = (value,digits = 1) => value.toFixed(digits);
const unit = id => state.nodes.find(node => node.id === id);
const line = id => state.links.find(link => link.id === id);
const label = node => `${equipment[node.type].name} #${node.id}`;
const readout = (title,value) => `<div class="readout"><span>${title}</span><b>${value}</b></div>`;
const button = (action,label,disabled = false) =>
  `<button data-action="${action}" ${disabled ? 'disabled' : ''}>${label}</button>`;
const upgradePrice = node => Math.ceil(equipment[node.type].cost*.35*1.45**(node.level-1));
const repairPrice = node => Math.ceil(60+(100-node.condition)*equipment[node.type].cost*.009);
const portAt = target => target?.closest?.('[data-port]')?.dataset.port.split('|');
function local(clientX,clientY) {
  const rect = diagram.getBoundingClientRect();
  return [(clientX-rect.left-camera.x)/camera.scale,(clientY-rect.top-camera.y)/camera.scale];
}
function applyCamera() {
  world.setAttribute('transform',`translate(${camera.x} ${camera.y}) scale(${camera.scale})`);
}
function fit() {
  const {width,height} = diagram.getBoundingClientRect();
  const scale = Math.min((width-24)/state.width,(height-24)/state.height,1);
  camera = {scale,x:(width-state.width*scale)/2,y:(height-state.height*scale)/2};
  applyCamera();
}
function zoom(factor,x,y) {
  const scale = Math.max(.12,Math.min(2.7,camera.scale*factor));
  camera.x = x-(x-camera.x)*scale/camera.scale;
  camera.y = y-(y-camera.y)*scale/camera.scale;
  camera.scale = scale;
  applyCamera();
}
function showMode() {
  $('mode').textContent = buildMode === 'waypoint' ? 'Tap the plan to append a routing waypoint'
    : buildMode ? `Place ${equipment[buildMode].name} on the plan · Esc cancels`
    : source ? `Choose a ${services[source[2]][0]} input · Esc cancels`
    : 'Drag the grid to pan · output to input to connect';
}
function notice(message,persistent = false) {
  clearTimeout(noticeTimer);
  $('notice').textContent = message;
  $('mode').textContent = message;
  if (!persistent) noticeTimer = setTimeout(() => {
    $('notice').textContent = '';
    showMode();
  },4800);
}
function persist() {
  $('saved').textContent = loaded.readOnly ? 'SAVE PROTECTED'
    : save(window.localStorage,state) ? 'LAYOUT SAVED' : 'SAVE UNAVAILABLE';
  lastSave = performance.now();
}
function updateSite() {
  $('site').setAttribute('width',state.width);
  $('site').setAttribute('height',state.height);
}
const geometry = link => route(anchor(unit(link.from),'out',link.service),anchor(unit(link.to),'in',link.service),link.via);
function showPipes() {
  $('pipes').innerHTML = state.links.map(link => {
    const [name,color] = services[link.service], path = geometry(link);
    return `<g data-pipe="${link.id}" style="--ink:${color}"><title>${name} · ${label(unit(link.from))} to ${label(unit(link.to))}</title>
      <path class="pipe-hit" d="${path}"/><path class="pipe ${link.id === selectedLink ? 'selected' : ''}" d="${path}"/>
      <path class="flow ${link.service}" visibility="hidden" d="${path}"/></g>`;
  }).join('');
}
function showRouting() {
  const current = line(selectedLink);
  const points = current?.via.map(([x,y],i) =>
    `<circle class="waypoint" data-point="${i}" cx="${x}" cy="${y}" r="7"><title>Drag waypoint ${i+1}</title></circle>`).join('') ?? '';
  const drag = source && preview ? `<path class="preview" style="--ink:${services[source[2]][1]}"
    d="${route(anchor(unit(source[0]),'out',source[2]),preview)}"/>` : '';
  $('routing').innerHTML = points+drag;
}
function updateVisuals() {
  for (const element of $('units').children) {
    const node = unit(element.dataset.unit), load = result.loads.get(node.id) ?? 0;
    element.classList.toggle('running',load > 0);
    if (node.type === 'furnace') element.style.setProperty('--flame',String(.25+.75*load/capacity(node)));
  }
  for (const element of $('pipes').children) {
    const rate = result.flows.get(element.dataset.pipe) ?? 0;
    element.querySelector('.pipe').classList.toggle('inactive',rate <= 0);
    element.querySelector('.flow').setAttribute('visibility',rate > 0 ? 'visible' : 'hidden');
    element.style.setProperty('--speed',`${Math.max(.42,1.65-rate*.025)}s`);
  }
}
function showCatalogue() {
  $('catalogue').innerHTML = Object.entries(catalogue).map(([category,types]) =>
    `<div class="section-label">${category}</div>`+types.map(type => {
      const def = equipment[type], locked = state.research < def.unlock;
      return `<div class="card ${locked ? 'locked' : ''}" data-card="${type}">${icon(type)}
        <div><b>${def.name}</b><small>${locked ? 'Research I' : cash(def.cost)}</small></div>
        <button data-build="${type}" aria-label="Add ${def.name}" ${locked ? 'disabled' : ''}>${locked ? 'Locked' : 'Add'}</button></div>`;
    }).join('')).join('');
}
function showInspector() {
  const node = unit(selected), link = line(selectedLink);
  let content;
  if (node) {
    const def = equipment[node.type], available = Object.entries(variants[node.type] ?? {});
    content = `<h3>${label(node)}</h3><p id="equipment-status"></p>
      ${readout('Capacity',`<span id="capacity"></span> ${def.unit}`)}
      ${readout('Current load',`<span id="load"></span> ${def.unit}`)}
      ${readout('Condition','<span id="condition"></span>%')}
      ${readout('Capacity level',node.level)}
      <div class="actions">${button('upgrade',`Upgrade +24% base capacity · ${cash(upgradePrice(node))}`)}
      ${button('toggle',node.enabled ? 'Isolate equipment' : 'Return to service')}
      ${button('repair',`Service equipment · ${cash(repairPrice(node))}`)}
      ${button('duplicate','Build another')}${button('delete','Demolish equipment')}</div>
      ${available.length ? '<div class="section-label">Technology options</div>' : ''}
      ${available.map(([key,tech]) => `<div class="actions">${button('tech-'+key,
        node.tech === key ? `${tech.name} · installed`
          : `${tech.name} · ${state.research ? cash(tech.price) : 'Research I'}`,node.tech === key || !state.research)}
        <small>${tech.detail}</small></div>`).join('')}`;
  } else if (link) {
    content = `<h3>${services[link.service][0]} route</h3><p>${label(unit(link.from))} → ${label(unit(link.to))}</p>
      ${readout('Flow','<span id="link-flow"></span>')}
      <div class="actions">${button('waypoint','Add waypoint on plan')}
      ${link.via.map((_,i) => button('remove-'+i,`Remove waypoint ${i+1}`)).join('')}
      ${button('disconnect','Disconnect route')}</div>`;
  } else content = '<p>Select equipment to see its controls, or select a process line to edit its route.</p>';
  $('inspector').innerHTML = content+`<div class="section-label">Automation</div>
    <div class="actions">${button('automation',state.automation ? 'Predictive maintenance active' : 'Predictive maintenance · £12,000',state.research < 2 || state.automation)}
    <small>${state.research < 2 ? 'Requires Research II' : 'Reduces equipment wear by 45%'}</small></div>`;
}
function showReports() {
  const costs = economy(result);
  $('metrics').innerHTML = [
    ['Capital',cash(state.cash)],['Waste',num(result.waste)+' t/h'],['Gross output',num(result.gross,2)+' MW'],
    ['Grid export',num(result.net,2)+' MW'],['Revenue',cash(costs.revenue)+'/h'],['Availability',num(result.availability,0)+'%']
  ].map(([name,value]) => `<div class="metric"><span>${name}</span><strong>${value}</strong></div>`).join('');
  $('operation').textContent = paused ? 'SIMULATION PAUSED' : result.waste ? 'PLANT OPERATING' : 'PLANT OFFLINE';
  $('operation').classList.toggle('off',paused || !result.waste);
  const firstLine = result.lines[0];
  $('constraint').textContent = firstLine ? `Furnace #${firstLine.id} · ${firstLine.issue}` : 'Install a combustion line to begin processing waste.';
  const next = objectives[state.milestones.length];
  const progress = state.milestones.length === 0 ? ` · ${num(state.processed)} / 10 t`
    : state.milestones.length === 1 ? ` · ${num(state.sold,2)} / 0.5 t` : '';
  $('objective').textContent = next ? `${next.label}${progress} · ${cash(next.reward)} grant` : 'All operating objectives complete';
  $('diagnostics').innerHTML = result.lines.map(report =>
    `<div class="diag ${report.waste ? '' : 'off'}"><b>Furnace #${report.id} · ${num(report.waste)} t/h</b>${report.issue}</div>`).join('')
    +readout('Steam',num(result.steam)+' t/h')+readout('Auxiliaries',num(result.auxiliary,2)+' MW')
    +readout('Gate fees',cash(costs.gate)+'/h')+readout('Power sales',cash(costs.electricity)+'/h')
    +readout('Metal sales',cash(costs.metal)+'/h')+readout('Operating costs',cash(costs.operating)+'/h')
    +readout('Maintenance',cash(costs.maintenance)+'/h')+readout('Operating margin',cash(costs.profit)+'/h');
  const node = unit(selected);
  if (node && $('load')) {
    $('capacity').textContent = num(capacity(node));
    $('load').textContent = num(result.loads.get(node.id) ?? 0);
    $('condition').textContent = num(node.condition,0);
    $('equipment-status').textContent = result.loads.get(node.id) ? 'Operating' : node.enabled ? 'Standby' : 'Isolated for maintenance';
  }
  if ($('link-flow')) $('link-flow').textContent = num(result.flows.get(selectedLink) ?? 0,2);
}
function refresh() {
  result = simulate(state);
  $('units').innerHTML = state.nodes.map(node => nodeMarkup(node,result,selected === node.id)).join('');
  showPipes();
  showRouting();
  showInspector();
  showReports();
  updateVisuals();
  showMode();
}
function changed() {
  refresh();
  persist();
}
function pay(price) {
  if (state.cash < price) { notice(`Requires ${cash(price)}. Keep the plant operating to earn capital.`); return false; }
  state.cash -= price;
  return true;
}
function overlaps(node,x,y) {
  return Math.abs(node.x-x) < WIDTH+6 && Math.abs(node.y-y) < HEIGHT+6;
}
function build(type,point) {
  const def = equipment[type];
  const [x,y] = [snap(point[0]-WIDTH/2),snap(point[1]-HEIGHT/2)];
  if (x < 0 || y < 0 || x+WIDTH > state.width || y+HEIGHT > state.height) {
    notice('Place equipment inside the site boundary.'); return;
  }
  if (state.nodes.some(node => overlaps(node,x,y))) {
    notice('Choose a clear part of the grid.'); return;
  }
  if (state.research < def.unlock || !pay(def.cost)) return;
  selected = install(state,type,x,y).id;
  buildMode = source = preview = selectedLink = null;
  changed();
}
function cancelMode() {
  source = preview = buildMode = null;
  showRouting();
  diagram.querySelectorAll('.port.active').forEach(port => port.classList.remove('active'));
  showMode();
}
function pickBuild(type) {
  if (equipment[type].unlock > state.research) return;
  cancelMode();
  buildMode = type;
  showMode();
  if (window.matchMedia('(max-width:680px)').matches) diagram.closest('.drawing').scrollIntoView({block:'start'});
}
function finishWire(target) {
  const [id,direction,service] = target;
  if (direction !== 'in' || service !== source[2]) {
    notice(`Incompatible port. Choose a ${services[source[2]][0]} input.`); return;
  }
  const message = connect(state,source[0],id,service);
  if (message) { notice(message); return; }
  source = preview = selected = null;
  selectedLink = state.links.at(-1).id;
  changed();
}

$('legend').innerHTML = Object.values(services).map(([name,color]) =>
  `<span><i style="--ink:${color}"></i>${name}</span>`).join('');
$('catalogue').addEventListener('click',event => {
  const type = event.target.closest('[data-build]')?.dataset.build;
  if (type) pickBuild(type);
});
$('inspector').addEventListener('click',event => {
  const action = event.target.closest('[data-action]')?.dataset.action;
  const node = unit(selected), link = line(selectedLink);
  if (!action) return;
  if (action === 'automation' && state.research >= 2 && !state.automation && pay(12000)) state.automation = true;
  else if (action === 'upgrade' && node && pay(upgradePrice(node))) node.level++;
  else if (action === 'toggle' && node) node.enabled = !node.enabled;
  else if (action === 'repair' && node) {
    if (node.enabled) { notice('Isolate this equipment before servicing it.'); return; }
    if (!pay(repairPrice(node))) return;
    node.condition = 100;
  } else if (action === 'duplicate' && node) { pickBuild(node.type); return; }
  else if (action === 'delete' && node) {
    if (!window.confirm(`Demolish ${label(node)} and remove its connected routes?`)) return;
    cancelMode();
    state.cash += Math.floor(equipment[node.type].cost*.4);
    state.nodes = state.nodes.filter(other => other.id !== selected);
    state.links = state.links.filter(edge => edge.from !== selected && edge.to !== selected);
    selected = null;
  } else if (action === 'disconnect' && link) {
    cancelMode();
    state.links = state.links.filter(edge => edge.id !== selectedLink);
    selectedLink = null;
  } else if (action === 'waypoint' && link) {
    cancelMode();
    buildMode = 'waypoint';
    showMode();
    return;
  } else if (action.startsWith('remove-') && link) link.via.splice(Number(action.slice(7)),1);
  else if (action.startsWith('tech-') && node && state.research) {
    const key = action.slice(5), tech = variants[node.type]?.[key];
    if (!tech || !pay(tech.price)) return;
    node.tech = key;
  } else return;
  changed();
});
$('pause').onclick = () => {
  paused = !paused;
  $('pause').textContent = paused ? 'Resume' : 'Pause';
  $('pause').setAttribute('aria-pressed',String(paused));
  diagram.classList.toggle('paused',paused);
  showReports();
};
$('fit').onclick = fit;
for (const [id,factor] of [['zoom-in',1.4],['zoom-out',1/1.4]]) {
  $(id).onclick = () => zoom(factor,diagram.clientWidth/2,diagram.clientHeight/2);
}
$('expand').onclick = () => {
  if (!pay(4200)) return;
  state.width += 480;
  state.height += 300;
  updateSite();
  persist();
  showReports();
  notice('Site extended east and south by one construction block.');
};
diagram.addEventListener('wheel',event => {
  event.preventDefault();
  const rect = diagram.getBoundingClientRect();
  zoom(Math.exp(-event.deltaY*.002),event.clientX-rect.left,event.clientY-rect.top);
},{passive:false});

document.addEventListener('pointerdown',event => {
  if (event.button !== 0 || !event.isPrimary) return;
  const card = event.target.closest('[data-card]'), onPlan = diagram.contains(event.target);
  if (!onPlan && (!card || event.target.closest('button'))) return;
  const port = portAt(event.target);
  const marker = event.target.closest('[data-point]');
  const id = event.target.closest('[data-unit]')?.dataset.unit;
  const pipe = event.target.closest('[data-pipe]')?.dataset.pipe;
  const base = {pointer:event.pointerId,x:event.clientX,y:event.clientY,moved:false};
  if (card) {
    if (state.research < equipment[card.dataset.card].unlock) return;
    gesture = {...base,kind:'build',type:card.dataset.card};
  } else if (buildMode) gesture = {...base,kind:'place',startX:camera.x,startY:camera.y};
  else if (port) {
    if (port[1] === 'out') {
      source = port;
      preview = local(event.clientX,event.clientY);
      diagram.querySelectorAll('.port.active').forEach(element => element.classList.remove('active'));
      event.target.closest('.port').classList.add('active');
      showMode();
      gesture = {...base,kind:'wire'};
    } else if (source) gesture = {...base,kind:'wire'};
    else notice('Start a route at a filled output port.');
  } else if (marker) {
    const index = Number(marker.dataset.point);
    gesture = {...base,kind:'waypoint',index,old:line(selectedLink).via[index]};
  } else if (id) {
    cancelMode();
    selected = id;
    selectedLink = null;
    refresh();
    const node = unit(id);
    gesture = {...base,kind:'unit',id,old:[node.x,node.y]};
  } else if (pipe) {
    cancelMode();
    selected = null;
    selectedLink = pipe;
    refresh();
  } else {
    cancelMode();
    gesture = {...base,kind:'pan',startX:camera.x,startY:camera.y};
  }
  if (gesture && onPlan) {
    diagram.setPointerCapture(event.pointerId);
    diagram.classList.add('dragging');
  }
});

function redrawRoute(link) {
  const path = geometry(link);
  $('pipes').querySelectorAll(`[data-pipe="${link.id}"] path`).forEach(element => element.setAttribute('d',path));
}
function moveUnit(id,x,y) {
  const node = unit(id);
  node.x = x;
  node.y = y;
  $('units').querySelector(`[data-unit="${id}"]`).setAttribute('transform',`translate(${x} ${y})`);
  for (const link of state.links.filter(edge => edge.from === id || edge.to === id)) redrawRoute(link);
}
function moveWaypoint(index,point) {
  const current = line(selectedLink);
  current.via[index] = point;
  redrawRoute(current);
  showRouting();
}
document.addEventListener('pointermove',event => {
  if (!gesture || gesture.pointer !== event.pointerId) return;
  const dx = event.clientX-gesture.x, dy = event.clientY-gesture.y;
  gesture.moved ||= Math.hypot(dx,dy) > 5;
  const point = local(event.clientX,event.clientY);
  if (gesture.kind === 'wire') { preview = point; showRouting(); }
  if (!gesture.moved) return;
  if (gesture.kind === 'pan' || gesture.kind === 'place') {
    camera.x = gesture.startX+dx;
    camera.y = gesture.startY+dy;
    applyCamera();
  } else if (gesture.kind === 'unit') {
    const x = snap(Math.max(0,Math.min(state.width-WIDTH-8,gesture.old[0]+dx/camera.scale)));
    const y = snap(Math.max(0,Math.min(state.height-HEIGHT-4,gesture.old[1]+dy/camera.scale)));
    if (!state.nodes.some(node => node.id !== gesture.id && overlaps(node,x,y))) moveUnit(gesture.id,x,y);
  } else if (gesture.kind === 'waypoint') moveWaypoint(gesture.index,point.map(snap));
  else if (gesture.kind === 'build') {
    if (!ghost) {
      ghost = document.createElement('div');
      ghost.className = 'ghost';
      ghost.textContent = equipment[gesture.type].name;
      document.body.append(ghost);
    }
    ghost.style.left = event.clientX+10+'px';
    ghost.style.top = event.clientY+10+'px';
  }
});
function release(event) {
  if (!gesture || gesture.pointer !== event.pointerId) return;
  const {kind,type,moved,old,index,id} = gesture;
  gesture = null;
  diagram.classList.remove('dragging');
  if (diagram.hasPointerCapture(event.pointerId)) diagram.releasePointerCapture(event.pointerId);
  ghost?.remove();
  ghost = null;
  if (event.type === 'pointercancel') {
    if (kind === 'unit' && moved) moveUnit(id,...old);
    if (kind === 'waypoint' && moved) moveWaypoint(index,old);
    if (kind === 'wire') cancelMode();
    return;
  }
  const target = document.elementFromPoint(event.clientX,event.clientY);
  const point = local(event.clientX,event.clientY);
  if (kind === 'build' && moved && diagram.contains(target)) build(type,point);
  if (kind === 'place' && !moved && buildMode) {
    if (buildMode === 'waypoint') {
      line(selectedLink).via.push(point.map(snap));
      buildMode = null;
      changed();
    } else build(buildMode,point);
  }
  if (kind === 'wire' && source) {
    const port = portAt(target);
    preview = null;
    showRouting();
    if (port && (port[1] === 'in' || moved)) finishWire(port);
    else if (moved) notice('Drop on a matching input, or tap an input to finish.');
  }
  if ((kind === 'unit' || kind === 'waypoint') && moved) persist();
}
document.addEventListener('pointerup',release);
document.addEventListener('pointercancel',release);
document.addEventListener('keydown',event => {
  if (event.key === 'Escape') { cancelMode(); return; }
  const port = portAt(event.target);
  if (!port || !['Enter',' '].includes(event.key)) return;
  event.preventDefault();
  if (port[1] === 'out') {
    cancelMode();
    source = port;
    event.target.classList.add('active');
    showMode();
  } else if (source) finishWire(port);
});

showCatalogue();
updateSite();
refresh();
fit();
if (loaded.warning) notice(loaded.warning,true);
persist();
let previous = performance.now();
setInterval(() => {
  const now = performance.now(), elapsed = Math.min(1,(now-previous)/1000);
  previous = now;
  if (!paused && !document.hidden) {
    const milestone = advance(state,result,elapsed*HOURS_PER_SECOND);
    result = simulate(state);
    if (milestone) {
      showCatalogue();
      showInspector();
      notice(`Objective complete · ${cash(milestone.reward)} grant`);
    }
    showReports();
    updateVisuals();
  }
  if (now-lastSave > 5000 && !gesture) persist();
},250);
window.addEventListener('pagehide',persist);
