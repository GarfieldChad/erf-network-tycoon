import {equipment, services} from './equipment.js';

const rotor = (x,y,r) => `<circle cx="${x}" cy="${y}" r="${r+5}"/><g class="rotor" style="transform-origin:${x}px ${y}px"><path d="M${x-r} ${y}h${2*r}M${x} ${y-r}v${2*r}M${x-r*.7} ${y-r*.7}l${r*1.4} ${r*1.4}m0 -${r*1.4}l-${r*1.4} ${r*1.4}"/><circle cx="${x}" cy="${y}" r="3"/></g>`;
const symbols = {
  bunker:'<path d="M8 14h84v49H8z M13 20h74v34H13z M8 63l9-9m75 9-9-9"/><path class="accent" d="m17 50 9-12 10 8 13-18 11 6 8 13 9-10 7 13z"/>',
  crane:'<path d="M11 64V12h78v52M9 18h83M16 24h69M50 24v19M45 29h10m-5 14-12 10 8 10h8l8-10-12-10m-12 10h24"/>',
  hopper:'<path d="M15 12h70v14L60 51v13H40V51L15 26z M15 22h70 M40 54h20"/><path class="accent" d="M28 29h44L56 46H44z"/>',
  furnace:'<path d="M14 9h72v57H14z M20 16h60v42H20z M20 53l60-8M27 52v6m11-8v8m11-9v9m11-11v11m11-13v13"/><path class="fire" d="M30 51C20 39 43 33 40 22c11 7 11 12 10 18 9-5 13-12 12-22 20 13 13 24 8 30z"/>',
  boiler:'<rect x="16" y="8" width="70" height="58" rx="4"/><rect x="23" y="12" width="57" height="9" rx="4"/><rect x="23" y="53" width="57" height="9" rx="4"/><path d="M30 21v32m10-32v32m10-32v32m10-32v32m10-32v32M8 38h13m59 0h12"/>',
  treatment:'<path d="M18 23h39v30L42 65h-9L18 53z M18 23l8-10h23l8 10M26 28v21m7-21v21m8-21v21m7-21v21M57 33h16V21h13v35H73V39H57"/>',
  fan:`<path d="M27 58H77V18H55M68 18V9h20v19H74"/>${rotor(45,37,19)}`,
  stack:'<path d="M36 67 42 12h16l6 55z M34 67h32m-25-53h18m-19 16h20m-21 12h22m-23 12h24"/><path class="plume" d="M50 9q16-8 31-3m-26 4q10-5 25 0"/>',
  water:'<ellipse cx="31" cy="20" rx="18" ry="7"/><path d="M13 20v33a18 7 0 0 0 36 0V20m-36 24a18 7 0 0 0 36 0m0-8h12v15h23V22H61v14m3-5h16m-16 7h16m-16 7h16"/>',
  pump:'<path d="M11 42h18m41-11h19V19H52M33 55l-7 11h47l-7-11"/><circle cx="49" cy="39" r="21"/><path d="m41 49 15-10-15-10z"/>',
  turbine:`<path d="m17 22 66-13v55L17 50z M8 36h82M26 51l-7 13h62m-12-13 7 13"/>${rotor(55,36,14)}`,
  acc:`<path d="M8 16h84v43H8z M8 16l10-8h64l10 8M13 59v7m74-7v7"/>${rotor(29,37,12)}${rotor(70,37,12)}`,
  generator:`<rect x="23" y="10" width="55" height="52" rx="13"/><path d="M7 36h16m55 0h14m-67 30h50"/>${rotor(50,36,13)}<path d="M43 37q4-8 8 0t8 0"/>`,
  transformer:'<path d="M14 17h72v43H14z M25 17V8m50 9V8M22 8h6m44 0h6M47 22v31m6-31v31M39 23a5 5 0 0 0 0 10 5 5 0 0 0 0 10 5 5 0 0 0 0 10m22-30a5 5 0 0 1 0 10 5 5 0 0 1 0 10 5 5 0 0 1 0 10"/>',
  grid:'<path d="m27 66 18-56h10l18 56M39 29h22m-27 15h32m-37 14h42M41 22H21l24-12m14 12h20L55 10M38 36H18l22-11m22 11h20L60 25m-18 6 20 14-27 13m23-27L38 45l27 13"/>',
  discharger:'<path d="M14 14h70l-8 19H27z M27 33l17 16h21l11-16m-32 16v14h32V49H65M10 14h79"/>',
  ash:'<rect x="12" y="25" width="76" height="19" rx="9"/><circle cx="22" cy="34.5" r="5"/><circle cx="78" cy="34.5" r="5"/><path d="m26 44-6 18m54-18 6 18M29 34h42m-40-9 7-9h9l8 9"/>',
  ashTreat:'<path d="M12 17h76v37H12z M20 45l58-21m-57 14 12 8m0-14 12 9m0-14 12 9m0-14 12 9M23 54v11m54-11v11"/>',
  recovery:'<path d="M11 47h76v14H11z M21 46V15h13v19h19V15h13v28M35 36v8m9-8v8m9-8v8"/><circle cx="77" cy="34" r="8"/>',
  metals:'<path d="M12 20h76l-9 44H21z M10 20h80M28 31h44M29 42h42m-40 11h38"/><path class="accent" d="m32 19 7-10 10 8 6-9 13 12z"/>'
};
export function icon(type) {
  return `<svg class="symbol" viewBox="0 0 100 74" aria-hidden="true">${symbols[type]}</svg>`;
}

export const WIDTH = 112, HEIGHT = 96;
export function anchor(node, direction, service) {
  const ports = equipment[node.type][direction === 'in' ? 'inputs' : 'outputs'];
  return [node.x+(direction === 'in' ? 0 : WIDTH),node.y+24+ports.indexOf(service)*32];
}

export function route(start, end, waypoints = []) {
  const entry = [end[0]-16,end[1]];
  let previous = [start[0]+16,start[1]];
  const points = [start,previous];
  for (const point of [...waypoints,entry]) {
    if (previous[0] > point[0] && !waypoints.length) {
      const y = Math.max(previous[1],point[1])+36;
      points.push([previous[0],y],[point[0],y]);
    } else {
      const x = (previous[0]+point[0])/2;
      points.push([x,previous[1]],[x,point[1]]);
    }
    points.push(point);
    previous = point;
  }
  points.push(end);
  return points.map(([x,y],index) => `${index ? 'L' : 'M'}${x},${y}`).join(' ');
}

export function nodeMarkup(node,result,selected) {
  const def = equipment[node.type];
  const load = result.loads.get(node.id) ?? 0;
  const ports = ['in','out'].flatMap(direction =>
    def[direction === 'in' ? 'inputs' : 'outputs'].map(service => {
      const [x,y] = anchor({...node,x:0,y:0},direction,service);
      const [label,color] = services[service];
      return `<g class="port ${direction}" data-port="${node.id}|${direction}|${service}" role="button" tabindex="0" aria-label="${direction === 'in' ? 'Input' : 'Output'} ${label} for ${def.name} ${node.id}" style="--ink:${color}">
        <title>${direction === 'in' ? 'Input' : 'Output'} · ${label}</title><circle class="target" cx="${x}" cy="${y}" r="12"/><circle class="pin" cx="${x}" cy="${y}" r="4.5"/>
      </g>`;
    })).join('');
  return `<g class="unit ${load > 0 ? 'running' : ''} ${selected ? 'selected' : ''}" data-unit="${node.id}" transform="translate(${node.x} ${node.y})">
    <rect class="unit-bg" width="112" height="96" rx="4"/>
    <foreignObject x="13" y="4" width="86" height="65">${icon(node.type)}</foreignObject>
    <text class="unit-title" x="56" y="76" text-anchor="middle">${def.name}</text>
    <text class="unit-tag" x="56" y="89" text-anchor="middle">${node.type.toUpperCase()}-${node.id.padStart(2,'0')}</text>
    <circle class="lamp" cx="102" cy="11" r="2.5"/>${ports}
  </g>`;
}
