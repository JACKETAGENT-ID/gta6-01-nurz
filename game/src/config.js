// Shared constants for Neon Bay Nights: world size, road grid, physics and tuning.
// Everything else in the game reads these, so a number only ever lives in one place.
export const CFG = {
  worldW: 3200,
  worldH: 2400,
  roadGap: 300,
  roadHalf: 26,
  roadOff: 150,
  viewW: 1280,
  viewH: 800,
  // Player on foot.
  walkSpeed: 170,
  runSpeed: 250,
  playerRadius: 13,
  playerHealth: 100,
  // Car physics.
  carGrip: 1,
  // Wanted.
  wantedMax: 5,
  heatSeconds: 20,
  decaySeconds: 15,
  // Combat.
  bulletSpeed: 950,
  bulletDamage: 34,
  punchDamage: 22,
  punchRange: 56,
  reloadSeconds: 1.1,
  // Missions and money.
  missionRewardTotal: 7200,
  packageValue: 25,
  packageCount: 20,
  // Day cycle: one game hour per 60 real seconds.
  hourPerSecond: 1 / 60,
  // Traffic.
  trafficCount: 22,
  pedCount: 42,
  // Shots: fixed step for deterministic staging.
  step: 1 / 60,
};

// Colours for the three districts plus the shared palette.
export const PALETTE = {
  downtownGround: '#2b2f38',
  midtownGround: '#33302a',
  docksGround: '#3a3430',
  beachSand: '#c9a86a',
  water: '#1d6f8f',
  road: '#1c1e24',
  roadLine: '#d8c25a',
  sidewalk: '#4a4d55',
  roofDowntown: '#3d4a63',
  roofMidtown: '#5a4a3d',
  roofDocks: '#6e4a33',
  neon: ['#ff2d78', '#00e5ff', '#ffe14d', '#7cff4d', '#ff7a1a', '#c26bff'],
};

// Names for neon signs: all invented, none from any commercial game.
export const NEON_SIGNS = [
  'NEON BAY', 'HOTEL LUMEN', 'PIER 9', 'TACOS EL FARO', 'RAMEN 24', 'CLUB VOLT',
  'NEON BAY BANK', 'CINEMA NOVA', 'BAR LA LUNA', 'MOTEL SUN', 'ARCADE PIXEL',
  'GYM IRON', 'DONUT HOLE', 'LIQUOR 7', 'PIZZA NOVA', 'HOTEL CORAL',
  'FERRY TERMINAL', 'WAREHOUSE 12',
];
