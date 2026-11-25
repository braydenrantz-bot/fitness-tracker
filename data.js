'use strict';
/* ---------- Exercise library ----------
 * muscle: primary muscle slot used by the workout generator
 * equip:  barbell | dumbbell | machine | cable | bodyweight
 * c:      compound lift (programmed first, heavier rep ranges)
 * avoid:  injuries this exercise is skipped for
 * timed:  reps field is seconds
 */
const EX = {};
function ex(id, name, muscle, equip, o = {}) {
  EX[id] = { id, name, muscle, equip, compound: !!o.c, avoid: o.avoid || [], bw: equip === 'bodyweight', timed: !!o.timed };
}

// Chest
ex('bench_press', 'Barbell Bench Press', 'chest', 'barbell', { c: 1, avoid: ['shoulders'] });
ex('incline_bench', 'Incline Barbell Bench', 'chest', 'barbell', { c: 1, avoid: ['shoulders'] });
ex('db_bench', 'Dumbbell Bench Press', 'chest', 'dumbbell', { c: 1 });
ex('incline_db_press', 'Incline Dumbbell Press', 'chest', 'dumbbell', { c: 1 });
ex('machine_chest_press', 'Machine Chest Press', 'chest', 'machine', { c: 1 });
ex('cable_fly', 'Cable Fly', 'chest', 'cable');
ex('pec_deck', 'Pec Deck', 'chest', 'machine');
ex('db_fly', 'Dumbbell Fly', 'chest', 'dumbbell', { avoid: ['shoulders'] });
ex('push_up', 'Push-Up', 'chest', 'bodyweight', { c: 1, avoid: ['wrists'] });
ex('decline_push_up', 'Feet-Elevated Push-Up', 'chest', 'bodyweight', { avoid: ['wrists'] });

// Back
ex('deadlift', 'Deadlift', 'back', 'barbell', { c: 1, avoid: ['lowerBack'] });
ex('barbell_row', 'Barbell Row', 'back', 'barbell', { c: 1, avoid: ['lowerBack'] });
ex('pull_up', 'Pull-Up', 'back', 'bodyweight', { c: 1, avoid: ['shoulders'] });
ex('chin_up', 'Chin-Up', 'back', 'bodyweight', { c: 1 });
ex('lat_pulldown', 'Lat Pulldown', 'back', 'cable', { c: 1 });
ex('seated_cable_row', 'Seated Cable Row', 'back', 'cable', { c: 1 });
ex('db_row', 'One-Arm Dumbbell Row', 'back', 'dumbbell', { c: 1 });
ex('t_bar_row', 'T-Bar Row', 'back', 'machine', { c: 1, avoid: ['lowerBack'] });
ex('inverted_row', 'Inverted Row', 'back', 'bodyweight', { c: 1 });
ex('db_pullover', 'Dumbbell Pullover', 'back', 'dumbbell', { avoid: ['shoulders'] });
ex('straight_arm_pulldown', 'Straight-Arm Pulldown', 'back', 'cable');
ex('superman', 'Superman Hold', 'back', 'bodyweight', { timed: 1 });

// Shoulders
ex('ohp', 'Overhead Press', 'shoulders', 'barbell', { c: 1, avoid: ['shoulders', 'lowerBack'] });
ex('db_shoulder_press', 'Dumbbell Shoulder Press', 'shoulders', 'dumbbell', { c: 1, avoid: ['shoulders'] });
ex('machine_shoulder_press', 'Machine Shoulder Press', 'shoulders', 'machine', { c: 1 });
ex('arnold_press', 'Arnold Press', 'shoulders', 'dumbbell', { c: 1, avoid: ['shoulders'] });
ex('pike_push_up', 'Pike Push-Up', 'shoulders', 'bodyweight', { c: 1, avoid: ['shoulders', 'wrists'] });
ex('lateral_raise', 'Dumbbell Lateral Raise', 'shoulders', 'dumbbell');
ex('cable_lateral_raise', 'Cable Lateral Raise', 'shoulders', 'cable');
ex('front_raise', 'Front Raise', 'shoulders', 'dumbbell');

// Rear delts
ex('face_pull', 'Face Pull', 'reardelt', 'cable');
ex('rear_delt_fly', 'Rear Delt Fly', 'reardelt', 'dumbbell');
ex('reverse_pec_deck', 'Reverse Pec Deck', 'reardelt', 'machine');
ex('prone_y_raise', 'Prone Y-Raise', 'reardelt', 'bodyweight');

// Biceps
ex('barbell_curl', 'Barbell Curl', 'biceps', 'barbell', { avoid: ['wrists'] });
ex('db_curl', 'Dumbbell Curl', 'biceps', 'dumbbell');
ex('hammer_curl', 'Hammer Curl', 'biceps', 'dumbbell');
ex('incline_db_curl', 'Incline Dumbbell Curl', 'biceps', 'dumbbell');
ex('preacher_curl', 'Preacher Curl', 'biceps', 'machine');
ex('cable_curl', 'Cable Curl', 'biceps', 'cable');
ex('towel_curl', 'Chin-Up Hold (Top)', 'biceps', 'bodyweight', { timed: 1 });

// Triceps
ex('close_grip_bench', 'Close-Grip Bench Press', 'triceps', 'barbell', { c: 1, avoid: ['wrists'] });
ex('dip', 'Dip', 'triceps', 'bodyweight', { c: 1, avoid: ['shoulders'] });
ex('skull_crusher', 'Skull Crusher', 'triceps', 'barbell', { avoid: ['elbows'] });
ex('tricep_pushdown', 'Cable Pushdown', 'triceps', 'cable');
ex('overhead_db_ext', 'Overhead Dumbbell Extension', 'triceps', 'dumbbell', { avoid: ['elbows', 'shoulders'] });
ex('db_kickback', 'Dumbbell Kickback', 'triceps', 'dumbbell');
ex('diamond_push_up', 'Diamond Push-Up', 'triceps', 'bodyweight', { avoid: ['wrists'] });
ex('bench_dip', 'Bench Dip', 'triceps', 'bodyweight', { avoid: ['shoulders'] });

// Quads
ex('squat', 'Back Squat', 'quads', 'barbell', { c: 1, avoid: ['knees', 'lowerBack'] });
ex('front_squat', 'Front Squat', 'quads', 'barbell', { c: 1, avoid: ['knees', 'wrists'] });
ex('leg_press', 'Leg Press', 'quads', 'machine', { c: 1, avoid: ['knees'] });
ex('hack_squat', 'Hack Squat', 'quads', 'machine', { c: 1, avoid: ['knees'] });
ex('goblet_squat', 'Goblet Squat', 'quads', 'dumbbell', { c: 1, avoid: ['knees'] });
ex('bulgarian_split_squat', 'Bulgarian Split Squat', 'quads', 'dumbbell', { c: 1, avoid: ['knees'] });
ex('walking_lunge', 'Walking Lunge', 'quads', 'dumbbell', { avoid: ['knees'] });
ex('leg_extension', 'Leg Extension', 'quads', 'machine', { avoid: ['knees'] });
ex('step_up', 'Dumbbell Step-Up', 'quads', 'dumbbell');
ex('bodyweight_squat', 'Bodyweight Squat', 'quads', 'bodyweight', { c: 1 });
ex('split_squat_bw', 'Split Squat', 'quads', 'bodyweight', { avoid: ['knees'] });
ex('wall_sit', 'Wall Sit', 'quads', 'bodyweight', { timed: 1 });

// Hamstrings & glutes
ex('rdl', 'Romanian Deadlift', 'hams', 'barbell', { c: 1, avoid: ['lowerBack'] });
ex('db_rdl', 'Dumbbell Romanian Deadlift', 'hams', 'dumbbell', { c: 1, avoid: ['lowerBack'] });
ex('hip_thrust', 'Barbell Hip Thrust', 'hams', 'barbell', { c: 1 });
ex('good_morning', 'Good Morning', 'hams', 'barbell', { avoid: ['lowerBack'] });
ex('leg_curl', 'Lying Leg Curl', 'hams', 'machine');
ex('seated_leg_curl', 'Seated Leg Curl', 'hams', 'machine');
ex('single_leg_rdl', 'Single-Leg RDL', 'hams', 'dumbbell');
ex('glute_bridge', 'Glute Bridge', 'hams', 'bodyweight', { c: 1 });
ex('single_leg_bridge', 'Single-Leg Glute Bridge', 'hams', 'bodyweight');
ex('nordic_curl', 'Nordic Curl', 'hams', 'bodyweight', { avoid: ['knees'] });

// Calves
ex('standing_calf_raise', 'Standing Calf Raise', 'calves', 'machine');
ex('seated_calf_raise', 'Seated Calf Raise', 'calves', 'machine');
ex('db_calf_raise', 'Dumbbell Calf Raise', 'calves', 'dumbbell');
ex('calf_raise_bw', 'Single-Leg Calf Raise', 'calves', 'bodyweight');

// Core
ex('hanging_leg_raise', 'Hanging Leg Raise', 'core', 'bodyweight');
ex('plank', 'Plank', 'core', 'bodyweight', { timed: 1 });
ex('cable_crunch', 'Cable Crunch', 'core', 'cable');
ex('ab_wheel', 'Ab Wheel Rollout', 'core', 'bodyweight', { avoid: ['lowerBack'] });
ex('russian_twist', 'Russian Twist', 'core', 'bodyweight', { avoid: ['lowerBack'] });
ex('dead_bug', 'Dead Bug', 'core', 'bodyweight');
ex('bicycle_crunch', 'Bicycle Crunch', 'core', 'bodyweight');
ex('side_plank', 'Side Plank', 'core', 'bodyweight', { timed: 1 });

const MUSCLE_NAMES = {
  chest: 'Chest', back: 'Back', shoulders: 'Shoulders', reardelt: 'Rear Delts', biceps: 'Biceps',
  triceps: 'Triceps', quads: 'Quads', hams: 'Hamstrings & Glutes', calves: 'Calves', core: 'Core',
};

/* ---------- Day types (what each day trains) ----------
 * slots are filled in order; session length decides how many are used.
 */
const DAY_TYPES = {
  chest:     { name: 'Chest Day',     emoji: '🫁', slots: ['chest', 'chest', 'chest', 'chest', 'triceps', 'core', 'chest'] },
  back:      { name: 'Back Day',      emoji: '🦅', slots: ['back', 'back', 'back', 'reardelt', 'back', 'biceps', 'back'] },
  legs:      { name: 'Leg Day',       emoji: '🦵', slots: ['quads', 'hams', 'quads', 'hams', 'calves', 'core', 'quads'] },
  shoulders: { name: 'Shoulder Day',  emoji: '🏔️', slots: ['shoulders', 'shoulders', 'shoulders', 'reardelt', 'shoulders', 'core', 'core'] },
  arms:      { name: 'Arm Day',       emoji: '💪', slots: ['biceps', 'triceps', 'biceps', 'triceps', 'biceps', 'triceps', 'core'] },
  push:      { name: 'Push Day',      emoji: '🫸', slots: ['chest', 'shoulders', 'chest', 'triceps', 'shoulders', 'triceps', 'chest'] },
  pull:      { name: 'Pull Day',      emoji: '🪝', slots: ['back', 'back', 'biceps', 'reardelt', 'back', 'biceps', 'core'] },
  upper:     { name: 'Upper Body',    emoji: '🧱', slots: ['chest', 'back', 'shoulders', 'back', 'chest', 'biceps', 'triceps'] },
  lower:     { name: 'Lower Body',    emoji: '🏋️', slots: ['quads', 'hams', 'quads', 'hams', 'calves', 'core', 'core'] },
  full:      { name: 'Full Body',     emoji: '⚡', slots: ['quads', 'chest', 'back', 'hams', 'shoulders', 'core', 'biceps'] },
};

const SPLITS = {
  bro:        { name: 'Body-part split', days: ['chest', 'back', 'legs', 'shoulders', 'arms'] },
  ppl:        { name: 'Push / Pull / Legs', days: ['push', 'pull', 'legs'] },
  upperlower: { name: 'Upper / Lower', days: ['upper', 'lower'] },
  full:       { name: 'Full body', days: ['full'] },
  arnold:     { name: 'Chest+Back / Shoulders+Arms / Legs', days: ['upper', 'arms', 'legs'] },
};

const GOALS = {
  strength: { name: 'Get stronger', desc: 'Heavy weight, low reps. Push your PRs up.', c: [5, 3, 5, 180], i: [3, 6, 10, 90] },
  muscle:   { name: 'Build muscle', desc: 'Moderate weight, more volume. Get bigger.', c: [4, 6, 10, 120], i: [3, 10, 15, 75] },
  fatloss:  { name: 'Lose fat',     desc: 'Higher reps, short rest. Burn more.',      c: [3, 10, 12, 60], i: [3, 12, 15, 45] },
  general:  { name: 'Stay fit',     desc: 'A balanced mix of strength and fitness.',  c: [3, 6, 10, 90],  i: [3, 10, 12, 60] },
};

const EQUIPMENT = {
  gym:        { name: 'Full gym',             desc: 'Barbells, machines, cables, dumbbells', allow: ['barbell', 'dumbbell', 'machine', 'cable', 'bodyweight'] },
  homebar:    { name: 'Home gym w/ barbell',  desc: 'Barbell, rack, bench, dumbbells',       allow: ['barbell', 'dumbbell', 'bodyweight'] },
  dumbbells:  { name: 'Dumbbells only',       desc: 'Dumbbells, bench, pull-up bar',         allow: ['dumbbell', 'bodyweight'] },
  bodyweight: { name: 'No equipment',         desc: 'Bodyweight only',                       allow: ['bodyweight'] },
};

const INJURIES = { shoulders: 'Shoulders', lowerBack: 'Lower back', knees: 'Knees', wrists: 'Wrists', elbows: 'Elbows' };
const FOCUS = {
  chest: { name: 'Chest', muscles: ['chest'] },
  back: { name: 'Back', muscles: ['back'] },
  shoulders: { name: 'Shoulders', muscles: ['shoulders'] },
  arms: { name: 'Arms', muscles: ['biceps', 'triceps'] },
  legs: { name: 'Legs', muscles: ['quads', 'hams'] },
  glutes: { name: 'Glutes', muscles: ['hams'] },
  core: { name: 'Abs / Core', muscles: ['core'] },
};

/* ---------- Ranks ---------- */
const RANKS = [
  { n: 'Iron', c: '#8d939e' },
  { n: 'Bronze', c: '#cd7f45' },
  { n: 'Silver', c: '#cfd6e0' },
  { n: 'Gold', c: '#f5c542' },
  { n: 'Platinum', c: '#38d9c4' },
  { n: 'Diamond', c: '#5aa9ff' },
  { n: 'Elite', c: '#b38cff' },
  { n: 'Legend', c: '#ff4d6d' },
];

/* Strength standards. Thresholds to reach Bronze..Legend (7 values).
 * ratio: estimated 1-rep max ÷ bodyweight (dumbbells are per hand)
 * reps:  bodyweight reps (added weight converts to equivalent reps)
 * ff:    multiplier applied for female lifters
 */
const RANK_LIFTS = {
  bench_press:       { type: 'ratio', std: [0.5, 0.75, 1.0, 1.25, 1.5, 1.75, 2.0], ff: 0.6 },
  incline_bench:     { type: 'ratio', std: [0.4, 0.6, 0.85, 1.05, 1.3, 1.5, 1.75], ff: 0.6 },
  db_bench:          { type: 'ratio', std: [0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8], ff: 0.6 },
  push_up:           { type: 'reps',  std: [5, 15, 25, 35, 45, 60, 75], ff: 0.6 },
  deadlift:          { type: 'ratio', std: [1.0, 1.25, 1.5, 2.0, 2.5, 3.0, 3.5], ff: 0.75 },
  barbell_row:       { type: 'ratio', std: [0.5, 0.65, 0.8, 1.0, 1.25, 1.5, 1.75], ff: 0.65 },
  db_row:            { type: 'ratio', std: [0.25, 0.35, 0.45, 0.55, 0.7, 0.85, 1.0], ff: 0.65 },
  pull_up:           { type: 'reps',  std: [1, 4, 8, 12, 16, 20, 25], ff: 0.4 },
  chin_up:           { type: 'reps',  std: [1, 5, 9, 13, 17, 21, 26], ff: 0.4 },
  ohp:               { type: 'ratio', std: [0.35, 0.5, 0.65, 0.8, 1.0, 1.2, 1.4], ff: 0.6 },
  db_shoulder_press: { type: 'ratio', std: [0.15, 0.22, 0.3, 0.38, 0.45, 0.55, 0.65], ff: 0.6 },
  barbell_curl:      { type: 'ratio', std: [0.2, 0.3, 0.4, 0.55, 0.7, 0.85, 1.0], ff: 0.6 },
  db_curl:           { type: 'ratio', std: [0.1, 0.15, 0.2, 0.27, 0.35, 0.42, 0.5], ff: 0.6 },
  close_grip_bench:  { type: 'ratio', std: [0.4, 0.6, 0.8, 1.0, 1.25, 1.5, 1.75], ff: 0.6 },
  skull_crusher:     { type: 'ratio', std: [0.2, 0.3, 0.4, 0.5, 0.65, 0.8, 0.95], ff: 0.6 },
  dip:               { type: 'reps',  std: [2, 6, 10, 15, 20, 25, 30], ff: 0.5 },
  squat:             { type: 'ratio', std: [0.75, 1.0, 1.25, 1.5, 2.0, 2.5, 3.0], ff: 0.75 },
  front_squat:       { type: 'ratio', std: [0.6, 0.8, 1.0, 1.25, 1.6, 2.0, 2.4], ff: 0.75 },
  leg_press:         { type: 'ratio', std: [1.0, 1.5, 2.0, 2.5, 3.25, 4.0, 5.0], ff: 0.75 },
  bodyweight_squat:  { type: 'reps',  std: [10, 25, 40, 60, 80, 100, 125], ff: 0.9 },
  rdl:               { type: 'ratio', std: [0.6, 0.9, 1.2, 1.5, 1.9, 2.3, 2.7], ff: 0.75 },
  hip_thrust:        { type: 'ratio', std: [0.75, 1.0, 1.5, 2.0, 2.5, 3.0, 3.5], ff: 0.8 },
  hanging_leg_raise: { type: 'reps',  std: [2, 5, 8, 12, 16, 20, 25], ff: 0.8 },
};

const RANK_GROUPS = {
  chest:     { name: 'Chest',      lifts: ['bench_press', 'incline_bench', 'db_bench', 'push_up'] },
  back:      { name: 'Back',       lifts: ['deadlift', 'barbell_row', 'db_row', 'pull_up', 'chin_up'] },
  shoulders: { name: 'Shoulders',  lifts: ['ohp', 'db_shoulder_press'] },
  biceps:    { name: 'Biceps',     lifts: ['barbell_curl', 'db_curl', 'chin_up'] },
  triceps:   { name: 'Triceps',    lifts: ['close_grip_bench', 'dip', 'skull_crusher'] },
  core:      { name: 'Core',       lifts: ['hanging_leg_raise'] },
  quads:     { name: 'Quads',      lifts: ['squat', 'front_squat', 'leg_press', 'bodyweight_squat'] },
  hams:      { name: 'Hamstrings & Glutes', lifts: ['deadlift', 'rdl', 'hip_thrust'] },
};
