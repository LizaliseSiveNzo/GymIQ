# Food Search & Catalog — Design

## 1. Catalog expansion
- Add ~100+ everyday foods: fruits, vegetables, grains, legumes, meats, fish, dairy, eggs, nuts/seeds, oils, snacks, condiments, drinks, prepared dishes.
- Every food carries: macros, allergens, `category`, `tags`, `synonyms`.

## 2. Indexing
- Extend each `foods.json` entry with new fields only (backward-compatible):
  - `category` → fruit | vegetable | meat | fish | grain | legume | dairy | egg | nut/seed | oil | snack | drink | condiment | prepared
  - `tags` → breakfast | high-protein | high-carb | low-fat | gluten-free | vegan…
  - `synonyms` → e.g. "Chicken breast" → `["chicken", "grilled chicken", "chicken fillet"]`
- Precompute a normalized `search_text` (name + synonyms + category + tags, lowercased, accents stripped).

## 3. Search engine
- **Client-side** (foods.json is bundled; catalog is small; instant + offline).
  - Normalize query: lowercase → strip diacritics → trim.
  - Tokenize, then score & rank:
    - exact name > synonym match > name-starts-with > word/tag match > category match.
  - Optional fuzzy (typo) later via prefix + edit-distance.
- *(Optional)* Server-side Postgres `search_foods` RPC (`pg_trgm`/`tsvector`) if the catalog grows large.

## 4. UI
- Replace the 2-group `<select>` with a **searchable picker**:
  - Search box (autofocus, filters as you type)
  - Category chips/tabs: Fruits · Veg · Meat & Fish · Grains · Dairy · Eggs · Nuts · Snacks…
  - Results list (name + kcal + macro hints)
  - "Recent / frequently used" row from the user's own logs

## 5. Backward compatibility
- `planner.js` / `mealTotals` / `meal-analyze` / coach read `id,name,kcal,protein,fat,carbs,vegetarian` — unchanged.
- New fields are additive → no migration.

## 6. Build order
1. Add `category` + `tags` + `synonyms` to existing foods.
2. Add ~100 new foods (accurate USDA values).
3. `searchFoods(query)` helper (normalize → score → rank).
4. Searchable picker UI.
5. *(Later)* fuzzy typo matching + "recent foods" from logs.
