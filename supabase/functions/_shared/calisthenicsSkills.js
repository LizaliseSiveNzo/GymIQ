// Calisthenics skill-based training content (vetted progression pathways).
// Static, deterministic, versioned. References exercises by NAME (stable);
// the generator resolves names against the exercise library.
// CONTENT REVIEW STATUS: bar muscle-up = reviewed; ring muscle-up = structure
// only, flagged for qualified review before it is presented to users.

export const SKILL_CONTENT_VERSION = '2026-11-16-v1';

// Each skill: id, name, equipment (required), and a pathway of stages.
// A stage has: purpose, exercises (each with a "why"), advancement criteria,
// and harder/easier alternatives. Strength, technique, coordination and
// control are tracked separately — developing muscle alone is not the skill.
export const SKILLS = {
  muscle_up_bar: {
    id: 'muscle_up_bar',
    name: 'Bar Muscle-Up',
    equipment: ['pull_up_bar'],
    requires: [],
    status: 'reviewed',
    pathway: [
      {
        id: 'pull_capacity',
        name: 'Pull capacity',
        purpose: 'Strength: pull high enough to begin the transition.',
        exercises: [
          { name: 'Bodyweight Pull-Up', why: 'Baseline strict pulling strength and scapular control.', type: 'strength', sets: '3', reps: '6–10' },
          { name: 'Chest-to-Bar Pull-Up', why: 'Builds the high pull that carries you into the transition.', type: 'strength', sets: '3', reps: '4–8' },
          { name: 'Explosive High Pull-Up', why: 'Trains the fast, high pull specific to the muscle-up.', type: 'strength', sets: '3', reps: '3–5' },
        ],
        advancement: '3 clean sets of 8 chest-to-bar pull-ups, controlled, before moving on.',
        alternatives: { harder: 'Explosive High Pull-Up', easier: 'Bodyweight Pull-Up' },
      },
      {
        id: 'support_push',
        name: 'Support & push',
        purpose: 'Strength: support above the bar and press to lockout.',
        exercises: [
          { name: 'Parallel Bar Chest Dips', why: 'Builds the pressing strength used in the top of the muscle-up.', type: 'strength', sets: '3', reps: '6–10' },
          { name: 'Bench Dip', why: 'Easier dip regression when dip bars are unavailable.', type: 'assistance', sets: '3', reps: '8–12' },
        ],
        advancement: '3 clean sets of 8 full dips with control.',
        alternatives: { harder: 'Parallel Bar Chest Dips', easier: 'Bench Dip' },
      },
      {
        id: 'transition',
        name: 'Transition practice',
        purpose: 'Technique: the wrist-roll and turnover over the bar.',
        exercises: [
          { name: 'False-Grip Pull-Up', why: 'Teaches the grip and wrist position needed to roll over the bar.', type: 'technique', sets: '3', reps: '3–6' },
          { name: 'Negative Muscle-Up', why: 'Lowers slowly through the transition so the movement is learned under control.', type: 'technique', sets: '3', reps: '2–4' },
        ],
        advancement: '3 controlled negative muscle-ups with a slow, smooth transition.',
        alternatives: { harder: 'Muscle-Up', easier: 'False-Grip Pull-Up' },
      },
      {
        id: 'skill',
        name: 'The muscle-up',
        purpose: 'Skill: putting the pull, transition and press together.',
        exercises: [
          { name: 'Muscle-Up', why: 'The full skill itself, practised when fresh.', type: 'skill', sets: '3–5', reps: '1–3' },
        ],
        advancement: 'A reliable first muscle-up, then build to repeatable singles with control.',
        alternatives: { harder: null, easier: 'Negative Muscle-Up' },
      },
    ],
  },

  muscle_up_ring: {
    id: 'muscle_up_ring',
    name: 'Ring Muscle-Up',
    equipment: ['gymnastic_rings'],
    requires: [],
    status: 'content_review', // flagged for qualified review before presenting to users
    pathway: [
      {
        id: 'ring_support',
        name: 'Ring support & false grip',
        purpose: 'Control: stable support and false grip on the rings.',
        exercises: [
          { name: 'Ring Support Hold', why: 'Builds the straight-arm support that the ring muscle-up finishes in.', type: 'technique', sets: '3', reps: '10–20s' },
          { name: 'False-Grip Hang', why: 'Trains the false grip required to transition on rings.', type: 'technique', sets: '3', reps: '10–20s' },
        ],
        advancement: '3 steady 20-second ring supports with locked elbows.',
        alternatives: { harder: null, easier: null },
      },
      {
        id: 'ring_transition',
        name: 'Ring transition',
        purpose: 'Technique: pulling and turning the rings out through the transition.',
        exercises: [
          { name: 'Ring Muscle-Up', why: 'The skill itself; the rings rotate, so the transition is ring-specific.', type: 'skill', sets: '3–5', reps: '1–3' },
        ],
        advancement: 'A reliable ring muscle-up with controlled ring rotation.',
        alternatives: { harder: null, easier: 'Ring Support Hold' },
      },
    ],
  },
};

// Skill IDs in the order offered for selection.
export const SKILL_ORDER = ['muscle_up_bar', 'muscle_up_ring'];

// General training movements used to keep the week balanced (legs, push, pull, core).
export const GENERAL_TRAINING = [
  'Bodyweight Squat',
  'Bodyweight Lunge',
  'Glute Bridge',
  'Bodyweight Push-Up',
  'Inverted Row',
  'Plank Hold',
];
