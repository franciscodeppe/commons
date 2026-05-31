// ============================================================
// Commons — shared vocabulary & options
// Provisional vocabulary for MVP; tags and sort items will grow
// and be tuned against real data (see spec "Known Unknowns").
// ============================================================

export const BRAND = {
  forest: '#2F4734',
  gold: '#C9A24B',
  cream: '#F5F1E6',
}

// --- Four categories (verbs) ---
export const CATEGORIES = [
  { key: 'move', label: 'Move', blurb: 'Out of the house and into your body.' },
  { key: 'learn', label: 'Learn', blurb: 'Feed a curiosity with people who share it.' },
  { key: 'play', label: 'Play', blurb: 'Hobbies, games, and making things — for the joy of it.' },
  { key: 'belong', label: 'Belong', blurb: 'Connection with meaning — values and showing up for each other.' },
]

// --- Predefined, category-scoped tags ---
export const PREDEFINED_TAGS = {
  move: ['hiking', 'running', 'climbing', 'cycling', 'yoga', 'pickup sports', 'swimming', 'martial arts'],
  learn: ['book club', 'languages', 'debate', 'writing', 'tech', 'history', 'philosophy', 'science'],
  play: ['board games', 'tabletop rpg', 'video games', 'crafts', 'collecting', 'music', 'photography', 'cooking'],
  belong: ['faith', 'volunteering', 'support circle', 'parenting', 'meditation', 'newcomers', 'civic'],
}

// --- The six axes of group character (organizer declaration) ---
// Each option maps to the dealbreaker token `${axis}:${value}` where relevant.
export const CHARACTER_AXES = [
  {
    key: 'char_energy',
    label: 'Energy',
    options: [
      { value: 'low', label: 'Low-key' },
      { value: 'balanced', label: 'Balanced' },
      { value: 'high', label: 'High-energy' },
    ],
  },
  {
    key: 'char_drinking',
    label: 'Drinking culture',
    options: [
      { value: 'sober', label: 'Sober-friendly' },
      { value: 'social', label: 'Social' },
      { value: 'heavy', label: 'Booze-forward' },
    ],
  },
  {
    key: 'char_size',
    label: 'Group size',
    options: [
      { value: 'small', label: 'Small & intimate' },
      { value: 'large', label: 'Big & lively' },
    ],
  },
  {
    key: 'char_commitment',
    label: 'Commitment',
    options: [
      { value: 'dropin', label: 'Drop-in welcome' },
      { value: 'regulars', label: 'Regulars who return' },
    ],
  },
  {
    key: 'char_setting',
    label: 'Setting',
    options: [
      { value: 'outdoors', label: 'Outdoors' },
      { value: 'indoors', label: 'Indoors' },
      { value: 'venue', label: 'At a venue' },
    ],
  },
  {
    key: 'char_worldview',
    label: 'Worldview',
    options: [
      { value: 'aligned', label: 'Shares alignment' },
      { value: 'mixed', label: 'Mixed & respectful' },
      { value: 'aside', label: 'Politics-aside' },
    ],
  },
]

// --- Facts layer options ---
export const LIFE_STAGES = [
  { value: 'single', label: 'Single' },
  { value: 'partnered', label: 'Partnered' },
  { value: 'parent_young', label: 'Parent (young kids)' },
  { value: 'parent_old', label: 'Parent (older kids)' },
  { value: 'empty_nest', label: 'Empty nest' },
  { value: 'retired', label: 'Retired' },
]

export const EDUCATION = [
  { value: 'high_school', label: 'High school' },
  { value: 'some_college', label: 'Some college' },
  { value: 'bachelors', label: "Bachelor's" },
  { value: 'postgrad', label: 'Postgrad' },
  { value: 'self_taught', label: 'Self-taught' },
]

export const SPEND_COMFORT = [
  { value: 'coffee', label: 'Coffee money' },
  { value: 'dinner', label: 'Dinner out' },
  { value: 'weekend', label: 'A weekend' },
]

// --- Dealbreakers (hard no's). User picks up to 3. ---
export const DEALBREAKER_CAP = 3
export const DEALBREAKERS = [
  { token: 'drinking:heavy', label: 'Heavy drinking' },
  { token: 'size:large', label: 'Big crowds' },
  { token: 'energy:high', label: 'High-intensity energy' },
  { token: 'commitment:regulars', label: 'Strict regular commitment' },
  { token: 'setting:venue', label: 'Always at a venue / bar' },
  { token: 'worldview:aligned', label: 'Requires shared politics' },
]

// --- The five sorts. Each item is rated 0 (not me), 1 (sometimes), 2 (very me). ---
// Provisional item sets — these drive the derived axes in matchingLogic.js.
export const SORTS = [
  {
    key: 'sort_taste',
    title: 'Taste',
    prompt: 'How do you like to spend a free evening?',
    items: ['A quiet night in', 'Trying a new restaurant', 'A loud night out', 'Making something with my hands', 'A long walk somewhere green'],
  },
  {
    key: 'sort_humor',
    title: 'Humor',
    prompt: 'What kind of fun is your kind of fun?',
    items: ['Dry and witty', 'Goofy and silly', 'Sharp debate', 'Easy and warm', 'Anything goes'],
  },
  {
    key: 'sort_social',
    title: 'Social energy',
    prompt: 'How do you show up with people?',
    items: ['Deep one-on-ones', 'The center of the party', 'Happy in a small circle', 'Love meeting strangers', 'Recharge alone after'],
  },
  {
    key: 'sort_rhythm',
    title: 'Rhythm',
    prompt: 'How do you like commitments to feel?',
    items: ['Same people, every week', 'Show up when I can', 'Plan it all ahead', 'Spontaneous is best', 'Early mornings'],
  },
  {
    key: 'sort_politics',
    title: 'Politics',
    prompt: 'How much should values come up?',
    items: ['I want shared values', 'Keep it respectful and mixed', "Leave politics at the door", 'I enjoy the debate'],
  },
]
