// Shared (client + server) default preferences.
export const DEFAULT_SETTINGS = {
  anchor: 'gps', // 'gps' | 'fixed'
  fixedAddress: '',
  fixedLat: null,
  fixedLon: null,
  fixedLabel: '',
  radius: 1500, // metres
  units: 'km', // 'km' | 'mi'
  sort: 'distance', // 'distance' | 'name' | 'open'
  theme: 'warm', // 'warm' | 'espresso' | 'linen'
  mapStyle: 'warm', // 'warm' | 'topo' | 'mono'
};
