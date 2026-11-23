import {capacity, equipment, technology} from './equipment.js';

const ASH = .22;
const MAKEUP = .06;

export function simulate(state) {
  const nodes = new Map(state.nodes.map(node => [node.id,node]));
  const remaining = new Map(state.nodes.map(node => [node.id,node.enabled && node.condition > 0 ? capacity(node) : 0]));
  const outgoing = new Map(), incoming = new Map();
  const flows = new Map(), loads = new Map(), lines = [];
  let waste = 0, steam = 0, gross = 0, auxiliary = 0, deliverable = 0, metals = 0, active = 0;

  for (const link of state.links) {
    const from = nodes.get(link.from), to = nodes.get(link.to);
    if (!from || !to || !equipment[from.type].outputs.includes(link.service)
      || !equipment[to.type].inputs.includes(link.service)) continue;
    if (!outgoing.has(from.id)) outgoing.set(from.id,[]);
    if (!incoming.has(to.id)) incoming.set(to.id,[]);
    outgoing.get(from.id).push(link);
    incoming.get(to.id).push(link);
  }

  function* routes(id, steps, reverse = false, trail = []) {
    if (!steps.length) { yield trail; return; }
    const [[service,type],...rest] = steps;
    for (const link of (reverse ? incoming : outgoing).get(id) ?? []) {
      const next = reverse ? link.from : link.to;
      if (link.service === service && nodes.get(next).type === type && remaining.get(next) > 1e-8) {
        yield* routes(next,rest,reverse,[...trail,link]);
      }
    }
  }

  const endpoint = (path,reverse = false) => path.at(-1)?.[reverse ? 'from' : 'to'];
  const mark = (path,rate) => {
    for (const link of path) flows.set(link.id,(flows.get(link.id) ?? 0) + rate);
  };

  for (const furnace of state.nodes.filter(node => node.type === 'furnace')) {
    const report = {id:furnace.id,waste:0,steam:0,issue:'',exported:0};
    lines.push(report);
    if (!remaining.get(furnace.id)) { report.issue = 'Combustion line offline.'; continue; }
    const supply = [...routes(furnace.id,[['waste','hopper'],['waste','crane'],['waste','bunker']],true)];
    if (!supply.length) { report.issue = 'Waste supply unavailable or fully allocated.'; continue; }
    const ashRoutes = [...routes(furnace.id,[['ash','discharger'],['ash','ash']])];
    if (!ashRoutes.length) { report.issue = 'Ash discharge unavailable or fully allocated.'; continue; }
    let issue = 'Connect furnace heat to a boiler.';
    let best;

    for (const heat of routes(furnace.id,[['heat','boiler']])) {
      const boiler = nodes.get(endpoint(heat));
      const yieldSteam = 3.35 * (technology(boiler).steam ?? 1);
      const gas = [...routes(boiler.id,[['gas','treatment'],['clean','fan'],['clean','stack']])];
      if (!gas.length) { issue = 'Flue gas discharge unavailable or fully allocated.'; continue; }
      const waterRoutes = [...routes(boiler.id,[['feed','pump'],['feed','water']],true)];
      if (!waterRoutes.length) { issue = 'Boiler has no available feedwater supply.'; continue; }
      issue = 'Steam circuit incomplete. Connect turbine exhaust and condensate return.';
      for (const steamPath of routes(boiler.id,[['steam','turbine'],['exhaust','acc'],['condensate','pump']])) {
        const turbine = nodes.get(steamPath[0].to);
        for (const water of waterRoutes.filter(path => path[0].from === endpoint(steamPath))) {
          for (const feed of supply) for (const air of gas) for (const ash of ashRoutes) {
            const constraints = [[furnace.id,1],...feed.map(edge => [edge.from,1]),
              ...air.map(edge => [edge.to,1]),...ash.map(edge => [edge.to,ASH]),
              [boiler.id,yieldSteam],[turbine.id,yieldSteam],[steamPath[1].to,yieldSteam],
              [water[0].from,yieldSteam],[water[1].from,yieldSteam * MAKEUP]];
            const ranked = constraints.map(([id,factor]) => ({id, rate:remaining.get(id) / factor}))
              .sort((a,b) => a.rate-b.rate);
            if (!best || ranked[0].rate > best.limit.rate) {
              best = {constraints,limit:ranked[0],heat,feed,air,ash,water,steamPath,yieldSteam,turbine};
            }
          }
        }
      }
    }
    if (!best || best.limit.rate <= 1e-8) { report.issue = issue; continue; }
    const {constraints,limit,heat,feed,air,ash,water,steamPath,yieldSteam,turbine} = best;
    const amount = limit.rate, generatedSteam = amount * yieldSteam;
    active++;
    waste += amount;
    steam += generatedSteam;
    report.waste = amount;
    report.steam = generatedSteam;
    report.issue = `Limited by ${equipment[nodes.get(limit.id).type].name} #${limit.id}.`;
    for (const [id,factor] of constraints) {
      remaining.set(id,Math.max(0,remaining.get(id)-amount*factor));
      loads.set(id,(loads.get(id) ?? 0)+amount*factor);
    }
    for (const path of [heat,feed,air]) mark(path,amount);
    mark(ash,amount*ASH);
    mark([water[0],...steamPath.slice(0,2)],generatedSteam);
    mark([steamPath[2]],generatedSteam*(1-MAKEUP));
    mark([water[1]],generatedSteam*MAKEUP);

    const treatment = nodes.get(air[0].to), condenser = nodes.get(steamPath[1].to);
    const lineAux = .12 + amount*(.042 + .018*(technology(treatment).aux ?? 1)
      + .013*(technology(condenser).aux ?? 1));
    auxiliary += lineAux;
    const shaft = generatedSteam * .195 * (technology(turbine).power ?? 1);
    const exportStages = [['shaft','generator'],['power','transformer'],['power','grid']];
    let generated = 0, exported = 0, remainingShaft = shaft;
    for (const path of routes(turbine.id,exportStages)) {
      const generator = path[0].to, transformer = path[1].to, grid = path[2].to;
      const mw = Math.min(remainingShaft*.97,remaining.get(generator),remaining.get(transformer),remaining.get(grid));
      if (mw <= 1e-8) continue;
      for (const id of [generator,transformer,grid]) {
        remaining.set(id,remaining.get(id)-mw);
        loads.set(id,(loads.get(id) ?? 0)+mw);
      }
      remainingShaft -= mw/.97;
      generated += mw;
      exported += mw;
      mark([path[0]],mw/.97);
      mark(path.slice(1),mw);
    }
    // A connected generator can carry plant auxiliaries even with its grid breaker open.
    for (const path of routes(turbine.id,[['shaft','generator']])) {
      const id = endpoint(path);
      const mw = Math.min(remainingShaft*.97,Math.max(0,lineAux-generated),remaining.get(id));
      if (mw <= 1e-8) continue;
      remainingShaft -= mw/.97;
      remaining.set(id,remaining.get(id)-mw);
      loads.set(id,(loads.get(id) ?? 0)+mw);
      generated += mw;
      mark(path,mw/.97);
    }
    gross += generated;
    deliverable += exported;
    report.exported = exported;
    if (!exported) report.issue += ' Grid export route unavailable.';
    else if (remainingShaft > 1e-6) report.issue += ' Generator or grid capacity limits electrical output.';

    const residue = [['ash','ashTreat'],['ash','recovery'],['metal','metals']];
    for (const path of routes(endpoint(ash),residue)) {
      const [treat,recovery,dispatch] = path.map(link => link.to);
      const tech = technology(nodes.get(recovery));
      const yieldMetal = tech.recovery ?? .09;
      const processed = Math.min(amount*ASH,remaining.get(treat),remaining.get(recovery),remaining.get(dispatch)/yieldMetal);
      if (processed <= 1e-8) continue;
      for (const [id,flow] of [[treat,processed],[recovery,processed],[dispatch,processed*yieldMetal]]) {
        remaining.set(id,remaining.get(id)-flow);
        loads.set(id,(loads.get(id) ?? 0)+flow);
      }
      mark(path.slice(0,2),processed);
      mark(path.slice(2),processed*yieldMetal);
      auxiliary += processed*.035*(tech.aux ?? 1);
      metals += processed*yieldMetal;
      break;
    }
  }

  const net = Math.max(0,Math.min(deliverable,gross-auxiliary));
  const exportFactor = deliverable ? net/deliverable : 0;
  for (const link of state.links) {
    if (link.service === 'power' && flows.has(link.id)) {
      if (exportFactor) flows.set(link.id,flows.get(link.id)*exportFactor);
      else flows.delete(link.id);
    }
  }
  const availability = lines.length ? 100 * active / lines.length : 0;
  return {waste,steam,gross,auxiliary,net,metals,availability,lines,flows,loads};
}
