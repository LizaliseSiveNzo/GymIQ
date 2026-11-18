// Food search + category helpers. Pure functions (no imports) so they stay
// testable; the catalog is passed in by the caller.

export const FOOD_CATEGORIES = [
  ['meat_fish', 'Meat & fish'],
  ['fruit', 'Fruit'],
  ['vegetable', 'Vegetables'],
  ['grain', 'Grains & starches'],
  ['dairy_egg', 'Dairy & eggs'],
  ['legume', 'Legumes'],
  ['nut_seed', 'Nuts & seeds'],
  ['oil_fat', 'Oils & fats'],
  ['snack', 'Snacks & sweets'],
  ['other', 'Other'],
];

// Name-keyword → category classifier. Works for current + future foods.
const KEYWORDS = [
  ['meat_fish', /\b(chicken|turkey|beef|pork|lamb|mutton|goat|venison|sausage|tuna|fish|salmon|mince|sirloin|thigh|fillet|steak|roast|bacon|egg)\b/i],
  ['fruit', /\b(banana|apple|orange|strawberr|blueberr|grapes|mango|pineapple|watermelon|peach|pear|kiwi|fruit|melon|berry)\b/i],
  ['vegetable', /\b(broccoli|carrot|tomato|cucumber|sweet potato|potato|spinach|kale|lettuce|pepper|onion|garlic|cabbage|vegetable|salad|mushroom|zucchini|courgette|pumpkin)\b/i],
  ['grain', /\b(oats|oat|rice|bread|pasta|noodle|cereal|quinoa|barley|corn|popcorn|rice cake|tortilla|flour|porridge)\b/i],
  ['dairy_egg', /\b(milk|yoghurt|yogurt|cheese|butter|cream|egg|whey)\b/i],
  ['legume', /\b(lentil|bean|chickpea|pea|tofu|soy|hummus|tempeh)\b/i],
  ['nut_seed', /\b(almond|nut|peanut|cashew|walnut|seed|chia|flax|sesame|pistachio|hazelnut)\b/i],
  ['oil_fat', /\b(oil|fat|avocado)\b/i],
  ['snack', /\b(chocolate|cake|biscuit|cookie|cracker|sweet|candy|honey|jam|sugar|syrup|ice cream)\b/i],
];

export function foodCategory(food) {
  const name = String(food?.name || '');
  if (food?.category) return food.category;
  for (const [cat, re] of KEYWORDS) if (re.test(name)) return cat;
  return 'other';
}

// Lowercase, strip diacritics (é→e), collapse whitespace.
export function normalizeFood(text) {
  return String(text || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// Rank foods by how well they match the query.
export function searchFoods(foods, query, limit = 40) {
  const q = normalizeFood(query);
  if (!q) return [];
  const tokens = q.split(' ').filter(Boolean);
  const scored = [];
  for (const f of foods) {
    const name = normalizeFood(f.name);
    const syn = (f.synonyms || []).map(normalizeFood);
    const cat = normalizeFood(foodCategory(f));
    let score = -1;
    if (name === q) score = 100;
    else if (syn.includes(q)) score = 90;
    else if (name.startsWith(q)) score = 80;
    else if (name.includes(q) || syn.some((s) => s.startsWith(q) || s.includes(q))) score = 60;
    else if (tokens.every((t) => name.includes(t) || syn.some((s) => s.includes(t)) || cat.includes(t))) score = 40;
    if (score >= 0) scored.push({ food: f, score });
  }
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, limit).map((x) => x.food);
}

// Group foods into the ordered categories for the browse view.
export function groupFoods(foods) {
  const groups = FOOD_CATEGORIES.map(([id, label]) => ({ id, label, foods: [] }));
  const byId = Object.fromEntries(groups.map((g) => [g.id, g]));
  for (const f of foods) {
    const g = byId[foodCategory(f)] || byId.other;
    g.foods.push(f);
  }
  return groups.filter((g) => g.foods.length);
}
