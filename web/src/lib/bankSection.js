// Calorie Bank section resolution. Kept pure so the URL + localStorage rules
// are testable and don't drift between the menu and the Bank tab.
export const BANK_SECTION_KEY = 'gymiq_bank_section';

export const BANK_SECTIONS = {
  home: 'Calorie overview',
  goals: 'Monthly goal',
  plan: 'Daily meal plan',
  builder: 'Meal builder',
  diary: 'Food diary',
  barcode: 'Barcode lookup',
  weight: 'Weight check-ins',
  insights: 'Food & calorie insights',
  sources: 'Estimates & food sources',
};

// Map a URL search string to a known section name. `summary` is a legacy alias
// for the overview; unknown values and empty params fall back to the overview.
export function bankSection(search) {
  const value = search.get('section');
  if (value === 'summary') return 'home';
  return Object.hasOwn(BANK_SECTIONS, value)
    ? value
    : search.get('goals') === '1'
      ? 'goals'
      : 'home';
}

// Resolve the active section from the URL, falling back to the remembered
// section only when the URL carries no explicit section/goals signal.
export function resolveBankSection(search) {
  if (search.has('section') || search.get('goals') === '1') return bankSection(search);
  try {
    return localStorage.getItem(BANK_SECTION_KEY) || 'home';
  } catch {
    return 'home';
  }
}

// Remember where the user left off. Returning to the overview clears the
// memory so a later tab visit resumes from the overview, not a stale section.
export function rememberBankSection(section) {
  try {
    if (section === 'home') localStorage.removeItem(BANK_SECTION_KEY);
    else localStorage.setItem(BANK_SECTION_KEY, section);
  } catch {
    /* optional storage */
  }
}
