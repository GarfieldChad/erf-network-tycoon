import {capacity, technology} from './equipment.js';

// One real second advances one simulated minute while the game is active.
export const HOURS_PER_SECOND = 1/60;
export const objectives = [
  {label:'Process 10 t of waste',reward:2800,test:s => s.processed >= 10},
  {label:'Recover and sell 0.5 t of metals',reward:7500,test:s => s.sold >= .5},
  {label:'Run two combustion lines simultaneously',reward:14000,test:(s,r) => r.lines.filter(line => line.waste > 0).length >= 2},
  {label:'Export 18 MW to the grid',reward:20000,test:(s,r) => r.net >= 18}
];

export function economy(result) {
  const electricity = result.net*96;
  const gate = result.waste*78;
  const metal = result.metals*230;
  const operating = result.waste*25 + result.steam*.43 + Math.max(0,result.auxiliary-result.gross)*120;
  const maintenance = result.loads.size*5;
  const revenue = electricity+gate+metal;
  return {electricity,gate,metal,operating,maintenance,revenue,profit:revenue-operating-maintenance};
}

export function advance(state,result,hours) {
  const {profit} = economy(result);
  state.cash += profit*hours;
  state.processed += result.waste*hours;
  state.sold += result.metals*hours;
  for (const node of state.nodes) {
    const utilization = (result.loads.get(node.id) ?? 0) / capacity(node);
    node.condition = Math.max(0,node.condition-hours*.48*utilization*(technology(node).wear ?? 1)
      *(state.automation ? .55 : 1));
  }
  const next = objectives[state.milestones.length];
  if (next?.test(state,result)) {
    state.milestones.push(next.label);
    state.cash += next.reward;
    state.research = Math.min(2,state.milestones.length);
    return next;
  }
}
