import { describe, it, expect } from 'vitest';
import { normalizeQuery, isPublicFaqEligible, FAQ_CONTENT_VERSION } from '../../../../supabase/functions/_shared/faqCache.js';

describe('public FAQ cache safety', () => {
  it('normalizes harmless formatting only', () => {
    expect(normalizeQuery('  How do I   Export My DATA?')).toBe('how do i export my data');
    expect(normalizeQuery('HOW MUCH DOES PREMIUM COST?!')).toBe('how much does premium cost');
  });

  it('preserves negation, quantities and units', () => {
    expect(normalizeQuery('Is premium NOT monthly?')).toBe('is premium not monthly');
    expect(normalizeQuery('How much is 30 days?')).toBe('how much is 30 days');
    expect(normalizeQuery('R100 per month?')).toBe('r100 per month');
  });

  it('keeps closely-worded but different questions distinct', () => {
    expect(normalizeQuery('how do i export my data')).not.toBe(normalizeQuery('how do i delete my data'));
    expect(normalizeQuery('what does premium include')).not.toBe(normalizeQuery('how much does premium cost'));
  });

  it('allows public FAQ topics', () => {
    expect(isPublicFaqEligible('How do I export my data?')).toBe(true);
    expect(isPublicFaqEligible('How much does premium cost?')).toBe(true);
    expect(isPublicFaqEligible('Where is the Calorie Bank?')).toBe(true);
    expect(isPublicFaqEligible('How do I reset my password?')).toBe(true);
    expect(isPublicFaqEligible('How do I build a new programme?')).toBe(true);
  });

  it('bypasses fitness, nutrition and medical advice', () => {
    expect(isPublicFaqEligible('How much protein should I eat?')).toBe(false);
    expect(isPublicFaqEligible('Give me a workout plan')).toBe(false);
    expect(isPublicFaqEligible('My knee hurts when I squat')).toBe(false);
    expect(isPublicFaqEligible('Recommend a meal for weight loss')).toBe(false);
    expect(isPublicFaqEligible('How many reps and sets for hypertrophy?')).toBe(false);
  });

  it('bypasses empty and overlong queries', () => {
    expect(isPublicFaqEligible('')).toBe(false);
    expect(isPublicFaqEligible('x'.repeat(300))).toBe(false);
  });

  it('has a versioned cache key', () => {
    expect(FAQ_CONTENT_VERSION).toMatch(/^\d{4}-\d{2}-\d{2}-v\d+$/);
  });
});
