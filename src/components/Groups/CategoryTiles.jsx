import { CATEGORIES } from '../../utils/constants'
import { CATEGORY_ICONS } from '../../assets/categoryIcons'

// Four category tiles that double as a filter. Click an active tile to clear.
export default function CategoryTiles({ active, onSelect }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {CATEGORIES.map((c) => {
        const on = active === c.key
        return (
          <button
            key={c.key}
            type="button"
            onClick={() => onSelect(on ? '' : c.key)}
            aria-pressed={on}
            className={`flex flex-col items-center gap-2 rounded-xl border p-4 text-center transition ${
              on
                ? 'border-forest bg-forest text-cream'
                : 'border-forest/15 bg-white text-forest hover:border-forest/40'
            }`}
          >
            <img
              src={CATEGORY_ICONS[c.key]}
              alt=""
              aria-hidden="true"
              className={`h-10 w-10 ${on ? 'brightness-0 invert' : 'brightness-0'}`}
            />
            <span className="text-sm font-semibold">{c.label}</span>
          </button>
        )
      })}
    </div>
  )
}
