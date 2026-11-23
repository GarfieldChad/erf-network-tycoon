import {equipment} from './equipment.js';

export const KEY = 'erf-network-tycoon-pid';
export const snap = value => Math.round(value / 20) * 20;
export function install(state, type, x, y) {
  const node = {id:String(state.next++), type, x, y, level:1, condition:100, enabled:true, tech:null};
  state.nodes.push(node);
  return node;
}

export function connect(state, from, to, service, via = []) {
  const source = state.nodes.find(node => node.id === from);
  const target = state.nodes.find(node => node.id === to);
  if (!source || !target || from === to || !equipment[source.type].outputs.includes(service)
      || !equipment[target.type].inputs.includes(service)) return 'Choose a compatible input on another unit.';
  if (state.links.some(line => line.from === from && line.to === to && line.service === service))
    return 'These ports are already connected.';
  state.links.push({id:String(state.next++), from, to, service, via});
  return '';
}

const layout = {
  bunker:[80,100], crane:[240,100], hopper:[400,100], furnace:[560,100], boiler:[760,100],
  treatment:[960,40], fan:[1120,40], stack:[1280,40], water:[420,460], pump:[600,460],
  turbine:[960,220], acc:[760,460], generator:[1120,220], transformer:[1280,220], grid:[1440,220],
  discharger:[560,300], ash:[760,300]
};
const routes = [
  ['bunker','crane','waste'],['crane','hopper','waste'],['hopper','furnace','waste'],
  ['furnace','boiler','heat'],['boiler','treatment','gas'],['treatment','fan','clean'],['fan','stack','clean'],
  ['water','pump','feed'],['pump','boiler','feed',[[740,484],[740,160]]],
  ['boiler','turbine','steam'],['turbine','acc','exhaust',[[1100,280],[1100,420],[720,420],[720,480]]],
  ['acc','pump','condensate',[[900,560],[580,560],[580,520]]],
  ['turbine','generator','shaft'],['generator','transformer','power'],['transformer','grid','power'],
  ['furnace','discharger','ash',[[700,240],[520,240]]],['discharger','ash','ash']
];
const blank = () => ({version:1, next:1, cash:7200, processed:0, sold:0, milestones:[],
  research:0, automation:false, width:1640, height:660, nodes:[], links:[]});

export function starter() {
  const state = blank();
  const ids = {};
  for (const [type,[x,y]] of Object.entries(layout)) ids[type] = install(state,type,x,y).id;
  for (const [from,to,service,via] of routes) connect(state,ids[from],ids[to],service,via);
  return state;
}

export function migrate(old) {
  const state = starter();
  state.cash += Math.max(0,Number(old.cash) || 0);
  state.processed = Math.max(0,Number(old.totalWaste) || 0);
  const names = {reception:'bunker',furnace:'furnace',boiler:'boiler',water:'water',turbine:'turbine',
    fgt:'treatment',idfan:'fan',stack:'stack',grid:'grid',acc:'acc',ashHandling:'ash',
    ashTreatment:'ashTreat',metals:'recovery'};
  // Keep the starter footprint operable. Import the legacy equipment as a second, editable train.
  if (!old.blocks || Object.keys(old.blocks).length < 2) return state;
  const imported = {};
  for (const [key,type] of Object.entries(names)) {
    const block = old.blocks[key];
    if (!block) continue;
    const x = snap(Math.max(20, Number(block.x) || 20));
    const y = 700 + snap(Math.max(20, Number(block.y) || 20));
    const node = install(state,type,x,y);
    node.level = Math.max(1,Math.min(20,Number(block.lvl) || 1));
    node.condition = Math.max(0,Math.min(100,Number(block.condition ?? 100) || 0));
    if (key === 'furnace') node.tech = [null,'martin','dyna'][block.tier] ?? null;
    if (key === 'boiler' && block.tier) node.tech = 'multipass';
    state.width = Math.max(state.width,x + 220);
    state.height = Math.max(state.height,y + 180);
    imported[key] = node.id;
  }
  const services = {hotgas:'heat',fluegas:'gas',cleangas:'clean',exhaust:'exhaust',
    condensate:'condensate',steam:'steam',rawash:'ash',treatedash:'ash'};
  for (const line of old.links ?? []) {
    if (services[line.ap]) connect(state,imported[line.a],imported[line.b],services[line.ap]);
  }
  return state;
}

export function load(storage) {
  try {
    const current = JSON.parse(storage.getItem(KEY));
    if (current?.version === 1 && Array.isArray(current.nodes) && Array.isArray(current.links)) return {state:current};
    if (current) return {state:starter(),warning:'Save version unsupported. Autosave is disabled to protect it.',readOnly:true};
    const legacy = JSON.parse(storage.getItem('erf-network-tycoon-v02'));
    if (legacy?.blocks) return {state:migrate(legacy),warning:'Prototype assets imported below the starter plant. Reconnect legacy equipment using the new port sequence.'};
  } catch {
    return {state:starter(),warning:'The saved plant could not be read. Autosave is disabled to protect it.',readOnly:true};
  }
  return {state:starter()};
}

export function save(storage,state) {
  try { storage.setItem(KEY,JSON.stringify(state)); return true; }
  catch { return false; }
}
