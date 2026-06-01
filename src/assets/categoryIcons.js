// Category icon URLs, keyed by category. Kept separate from constants.js so
// that file stays import-safe for the Node seed script (which can't import PNGs).
import move from './categories/move.png'
import learn from './categories/learn.png'
import play from './categories/play.png'
import belong from './categories/belong.png'

export const CATEGORY_ICONS = { move, learn, play, belong }
