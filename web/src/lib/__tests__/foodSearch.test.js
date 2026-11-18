import { describe, it, expect } from 'vitest';
import { normalizeFood, foodCategory, searchFoods, groupFoods } from '../foodSearch.js';

const foods = [
  { id: '1', name: 'Chicken breast · cooked', vegetarian: false },
  { id: '2', name: 'Banana', vegetarian: true },
  { id: '3', name: 'Brown rice · cooked', vegetarian: true },
  { id: '4', name: 'Broccoli · cooked', vegetarian: true },
  { id: '5', name: 'Almonds', vegetarian: true },
  { id: '6', name: 'Orange · raw', vegetarian: true },
];

describe('normalizeFood', () => {
  it('lowercases and strips diacritics', () => {
    expect(normalizeFood('  Café  Éclair ')).toBe('cafe eclair');
  });
});

describe('foodCategory', () => {
  it('classifies by name keywords', () => {
    expect(foodCategory(foods[0])).toBe('meat_fish');
    expect(foodCategory(foods[1])).toBe('fruit');
    expect(foodCategory(foods[2])).toBe('grain');
    expect(foodCategory(foods[3])).toBe('vegetable');
    expect(foodCategory(foods[4])).toBe('nut_seed');
  });
});

describe('searchFoods', () => {
  it('ranks exact matches first', () => {
    expect(searchFoods(foods, 'banana')[0].id).toBe('2');
  });
  it('finds by substring', () => {
    expect(searchFoods(foods, 'chick').some((f) => f.id === '1')).toBe(true);
  });
  it('finds by token match across words', () => {
    expect(searchFoods(foods, 'chicken cooked').some((f) => f.id === '1')).toBe(true);
  });
  it('returns empty for no match', () => {
    expect(searchFoods(foods, 'zzzz')).toEqual([]);
  });
});

describe('groupFoods', () => {
  it('groups foods into categories', () => {
    const ids = groupFoods(foods).map((g) => g.id);
    expect(ids).toContain('meat_fish');
    expect(ids).toContain('fruit');
    expect(ids).toContain('grain');
  });
});
