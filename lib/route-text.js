// Turn OSRM route steps into readable instructions + Material Symbols icons.

const CARDINALS = ['north', 'northeast', 'east', 'southeast', 'south', 'southwest', 'west', 'northwest'];
const cardinal = (deg) => CARDINALS[Math.round((((deg ?? 0) % 360) + 360) % 360 / 45) % 8];

const ordinal = (n) => {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
};

const ICONS = {
  uturn: 'u_turn_left',
  'sharp right': 'turn_sharp_right',
  right: 'turn_right',
  'slight right': 'turn_slight_right',
  straight: 'straight',
  'slight left': 'turn_slight_left',
  left: 'turn_left',
  'sharp left': 'turn_sharp_left',
};

export function stepIcon(type, modifier) {
  if (type === 'depart') return 'trip_origin';
  if (type === 'arrive') return 'flag';
  if (type === 'roundabout' || type === 'rotary' || type === 'roundabout turn' || type === 'exit roundabout') return 'roundabout_right';
  if (type === 'fork') return modifier?.includes('left') ? 'fork_left' : 'fork_right';
  if (type === 'merge') return 'merge';
  if (type === 'on ramp' || type === 'off ramp') return modifier?.includes('left') ? 'ramp_left' : 'ramp_right';
  return ICONS[modifier] || 'straight';
}

export function stepText(step, mode = 'foot') {
  const { type, modifier, bearing_after: bearing, exit } = step.maneuver || {};
  const name = step.name || step.ref || '';
  const onto = name ? ` onto ${name}` : '';
  const on = name ? ` on ${name}` : '';
  const mod = modifier || 'straight';
  const verb = mode === 'foot' ? 'Walk' : mode === 'bike' ? 'Ride' : 'Drive';

  switch (type) {
    case 'depart':
      return `${verb} ${cardinal(bearing)}${on}`;
    case 'arrive':
      return modifier === 'left' || modifier === 'right'
        ? `Arrive at your destination, on the ${modifier}`
        : 'Arrive at your destination';
    case 'roundabout':
    case 'rotary':
      return exit ? `At the roundabout, take the ${ordinal(exit)} exit${onto}` : `Go through the roundabout${onto}`;
    case 'roundabout turn':
      return `At the roundabout, turn ${mod}${onto}`;
    case 'exit roundabout':
    case 'exit rotary':
      return `Exit the roundabout${onto}`;
    case 'fork':
      return `Keep ${mod.replace('slight ', '')} at the fork${onto}`;
    case 'end of road':
      return `At the end of the road, turn ${mod}${onto}`;
    case 'merge':
      return `Merge ${mod}${onto}`;
    case 'on ramp':
      return `Take the ramp on the ${mod.includes('left') ? 'left' : 'right'}${onto}`;
    case 'off ramp':
      return `Take the exit on the ${mod.includes('left') ? 'left' : 'right'}${onto}`;
    case 'new name':
      return name ? `Continue onto ${name}` : 'Continue straight';
    case 'continue':
      if (mod === 'straight') return `Continue straight${on}`;
      if (mod === 'uturn') return `Make a U-turn${on}`;
      return `Keep ${mod}${on}`;
    default:
      if (mod === 'straight') return `Continue straight${on}`;
      if (mod === 'uturn') return `Make a U-turn${on}`;
      return `Turn ${mod}${onto}`;
  }
}
