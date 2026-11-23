export const services = {
  waste: ['Waste','#cf985b'], heat: ['Combustion heat','#ff8c55'], steam: ['Steam','#f56b72'],
  exhaust: ['Exhaust steam','#df8b9e'], feed: ['Feedwater','#609fff'], condensate: ['Condensate','#55cedf'],
  gas: ['Flue gas','#a3b3bc'], clean: ['Treated gas','#bdcbd0'], ash: ['Bottom ash','#767e91'],
  metal: ['Metals','#56c4a4'], shaft: ['Shaft power','#e4b68a'], power: ['Electricity','#f4ce67']
};

// Capacities use the equipment's primary service, with gas/heat rated in waste-equivalent t/h.
const item = (name, cost, capacity, unit, inputs, outputs, unlock = 0) =>
  ({name, cost, capacity, unit, inputs, outputs, unlock});
export const equipment = {
  bunker: item('Waste bunker',4800,22,'t/h',[],['waste']),
  crane: item('Grab crane',4200,18,'t/h',['waste'],['waste']),
  hopper: item('Feed hopper',2300,17,'t/h',['waste'],['waste']),
  furnace: item('Grate furnace',9800,12,'t/h',['waste'],['heat','ash']),
  boiler: item('Water-tube boiler',9200,45,'t/h steam',['heat','feed'],['steam','gas']),
  treatment: item('Gas treatment',6500,13,'t/h eq.',['gas'],['clean']),
  fan: item('ID fan',3900,20,'t/h eq.',['clean'],['clean']),
  stack: item('Stack',2500,25,'t/h eq.',['clean'],[]),
  water: item('Water treatment',4000,4,'t/h makeup',[],['feed']),
  pump: item('Feedwater system',3600,60,'t/h',['feed','condensate'],['feed']),
  turbine: item('Steam turbine',8400,52,'t/h steam',['steam'],['shaft','exhaust']),
  acc: item('Air-cooled condenser',5600,60,'t/h steam',['exhaust'],['condensate']),
  generator: item('Generator',4900,9,'MW',['shaft'],['power']),
  transformer: item('Transformer',2600,10,'MW',['power'],['power']),
  grid: item('Grid export',2100,15,'MW',['power'],[]),
  discharger: item('Ash discharger',2100,5,'t/h',['ash'],['ash']),
  ash: item('Ash conveyor',2600,6,'t/h',['ash'],['ash']),
  ashTreat: item('Ash treatment',3800,7,'t/h',['ash'],['ash'],1),
  recovery: item('Metal separator',5400,6,'t/h',['ash'],['metal'],1),
  metals: item('Metals dispatch',1700,2,'t/h',['metal'],[],1)
};

export const variants = {
  furnace: {
    martin: {name:'MARTIN reverse-acting grate',price:4200,capacity:1.32,wear:1.13,detail:'+32% throughput · +13% wear'},
    dyna: {name:'DynaGrate system',price:4800,capacity:1.17,wear:.65,detail:'+17% throughput · −35% wear'}
  },
  boiler: {
    multipass:{name:'Multi-pass boiler',price:5200,capacity:1.24,steam:1.1,wear:1.12,detail:'+24% steam rating · +10% steam yield · +12% wear'}
  },
  turbine: {
    efficient:{name:'High-efficiency stages',price:6100,capacity:1.13,power:1.14,wear:1.1,detail:'+13% steam rating · +14% conversion · +10% wear'}
  },
  treatment: {
    dosing:{name:'Conditioning tower and bag filters',price:4900,capacity:1.4,aux:1.2,detail:'+40% gas capacity · +20% fan and treatment load'}
  },
  recovery: {
    eddy:{name:'Ferrous and non-ferrous recovery',price:4300,capacity:1.15,recovery:.16,aux:1.15,detail:'16% recovery yield · +15% auxiliary load'}
  },
  acc: {
    fans:{name:'Variable-speed condenser fans',price:4300,capacity:1.18,aux:.72,detail:'+18% capacity · −28% condenser load'}
  }
};

export const technology = node => variants[node.type]?.[node.tech] ?? {};
export const capacity = node => equipment[node.type].capacity * (1 + .24 * (node.level - 1))
  * (technology(node).capacity ?? 1) * (.55 + .45 * node.condition / 100);
export const catalogue = {
  'Waste & combustion':['bunker','crane','hopper','furnace','boiler'],
  'Emissions control':['treatment','fan','stack'],
  'Steam & power':['water','pump','turbine','acc','generator','transformer','grid'],
  'Residue handling':['discharger','ash','ashTreat','recovery','metals']
};
