import { useMemo, useState } from 'react';
import { searchFoods, groupFoods } from '../../lib/foodSearch.js';
import FoodImage from './FoodImage.jsx';
import './foodPicker.css';

// Searchable food picker: a search box over category-grouped foods with
// thumbnails, used instead of a long <select> list.
export default function FoodPicker({ foods, value, onChange }) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const selected = foods.find((f) => f.id === value);
  const searching = query.trim().length > 0;
  const results = useMemo(() => (searching ? searchFoods(foods, query) : null), [foods, query, searching]);
  const groups = useMemo(() => groupFoods(foods), [foods]);

  function pick(id) { onChange(id); setOpen(false); setQuery(''); }

  return (
    <div className="food-picker">
      <button type="button" className="food-picker-trigger" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        <FoodImage foodId={value} />
        <span className="food-picker-trigger-label">{selected ? selected.name : 'Choose an ingredient'}</span>
        <span className="food-picker-caret" aria-hidden="true">▾</span>
      </button>
      {open && (
        <div className="food-picker-popover">
          <input
            autoFocus
            type="search"
            className="food-picker-search"
            placeholder="Search foods…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <div className="food-picker-list">
            {searching ? (
              results.length
                ? results.map((f) => (
                    <button type="button" key={f.id} className="food-picker-item" onClick={() => pick(f.id)}>
                      <FoodImage foodId={f.id} /><span>{f.name}</span>
                    </button>
                  ))
                : <p className="subtle" style={{ margin: 8 }}>No matches for “{query}”.</p>
            ) : groups.map((g) => (
              <div key={g.id}>
                <div className="food-picker-group">{g.label}</div>
                {g.foods.map((f) => (
                  <button type="button" key={f.id} className="food-picker-item" onClick={() => pick(f.id)}>
                    <FoodImage foodId={f.id} /><span>{f.name}</span>
                  </button>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
