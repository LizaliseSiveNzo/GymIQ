import {describe,it,expect,beforeEach,afterEach,vi} from 'vitest';
import {BANK_SECTIONS,BANK_SECTION_KEY,bankSection,resolveBankSection,rememberBankSection} from '../bankSection.js';

describe('bankSection()',()=>{
  it('returns every known section verbatim',()=>{
    for(const key of Object.keys(BANK_SECTIONS))expect(bankSection(new URLSearchParams(`section=${key}`))).toBe(key);
  });
  it('maps the legacy summary alias to home',()=>{
    expect(bankSection(new URLSearchParams('section=summary'))).toBe('home');
  });
  it('falls back to home for missing or unknown sections',()=>{
    expect(bankSection(new URLSearchParams())).toBe('home');
    expect(bankSection(new URLSearchParams('section=wat'))).toBe('home');
  });
  it('opens the goals page for the goals=1 deep link',()=>{
    expect(bankSection(new URLSearchParams('goals=1'))).toBe('goals');
  });
});

describe('resolveBankSection() and rememberBankSection()',()=>{
  let store;
  beforeEach(()=>{
    store=new Map();
    vi.stubGlobal('localStorage',{
      getItem:k=>store.get(k)??null,
      setItem:(k,v)=>store.set(k,String(v)),
      removeItem:k=>store.delete(k),
    });
  });
  afterEach(()=>{vi.unstubAllGlobals();});

  it('defaults to home with no URL section and no memory',()=>{
    expect(resolveBankSection(new URLSearchParams())).toBe('home');
  });
  it('resumes the remembered section when the URL carries none',()=>{
    localStorage.setItem(BANK_SECTION_KEY,'diary');
    expect(resolveBankSection(new URLSearchParams())).toBe('diary');
  });
  it('lets an explicit home section override a stale memory',()=>{
    localStorage.setItem(BANK_SECTION_KEY,'plan');
    expect(resolveBankSection(new URLSearchParams('section=home'))).toBe('home');
  });
  it('remembers non-home sections',()=>{
    rememberBankSection('weight');
    expect(localStorage.getItem(BANK_SECTION_KEY)).toBe('weight');
  });
  it('clears the remembered section when returning to the overview',()=>{
    localStorage.setItem(BANK_SECTION_KEY,'builder');
    rememberBankSection('home');
    expect(localStorage.getItem(BANK_SECTION_KEY)).toBeNull();
    expect(resolveBankSection(new URLSearchParams())).toBe('home');
  });
});
