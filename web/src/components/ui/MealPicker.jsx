import { useMemo, useState } from 'react';
import './foodPicker.css';

// Searchable picker for preset + saved meals, styled like the ingredient picker.
export default function MealPicker({ meals, onPick, placeholder = 'Start from a preset or saved meal' }) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const searching = query.trim().length > 0;
  const q = query.trim().toLowerCase();
  const results = useMemo(() => (searching ? meals.filter((m) => m.name.toLowerCase().includes(q)) : meals), [meals, q, searching]);

  function pick(id) { onPick(id); setOpen(false); setQuery(''); }

  return (
    <div className="food-picker">
      <button type="button" className="food-picker-trigger" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        <span className="food-picker-trigger-label">{placeholder}</span>
        <span className="food-picker-caret" aria-hidden="true">▾</span>
      </button>
      {open && (
        <div className="food-picker-popover">
          <input
            autoFocus
            type="search"
            className="food-picker-search"
            placeholder="Search meals…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <div className="food-picker-list">
            {results.length ? (
              results.map((m) => (
                <button type="button" key={m.id} className="food-picker-item" onClick={() => pick(m.id)}>
                  <span>{m.name}</span>
                </button>
              ))
            ) : (
              <p className="subtle" style={{ margin: 8 }}>No matches for “{query}”.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
