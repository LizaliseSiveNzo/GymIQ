import { Link } from 'react-router-dom';

const sections=[
 ['Training and sets', [
  ['Rep (repetition)', 'One complete movement of an exercise, from the start position and back again.'],
  ['Set', 'A group of reps done in a row before you rest.'],
  ['Working set', 'A set performed at your target load to drive progress — not a warm-up.'],
  ['Warm-up set', 'A lighter set done first to prepare your body for the working sets.'],
  ['Rest interval', 'The time you rest between sets, shown in seconds.'],
  ['RIR (Reps in Reserve)', 'How many more reps you could have done before failing. RIR 2 means you stop two reps short of failure.'],
  ['Failure', 'The point where you cannot complete another rep with good form.'],
  ['Superset', 'Two exercises done back-to-back with little or no rest between them.'],
  ['Drop set', 'A set where you lower the weight after reaching near-failure and keep going.'],
  ['Myorep', 'A set style with short rest pauses after an initial activation set.'],
  ['Progressive overload', 'Gradually increasing load, reps or sets over time to keep improving.'],
  ['Concentric / Eccentric', 'The lifting phase (muscle shortens) and the lowering phase (muscle lengthens).'],
 ]],
 ['Programme structure', [
  ['Hypertrophy', 'A training goal focused on muscle size — moderate weights and moderate-to-high reps.'],
  ['Strength', 'A training goal focused on maximal force — heavier weights and fewer reps.'],
  ['Fat loss', 'A training goal using moderate reps and shorter rests to keep muscle while in a calorie deficit.'],
  ['Calisthenics', 'Bodyweight training (push-ups, pull-ups, squats and skills) rather than external weights.'],
  ['Split', 'How you divide muscle groups across the week — for example Full Body, Upper/Lower, or Push Pull Legs.'],
  ['Deload', 'A planned, lighter recovery week that lets your body recover.'],
  ['Volume', 'The total amount of work you do, usually counted as weekly sets per muscle.'],
  ['Main lift / Accessory', 'A main lift is the primary compound movement of a session; accessories are supporting exercises.'],
  ['Compound movement', 'An exercise that uses several joints and muscle groups at once, like a squat or push-up.'],
  ['Isolation movement', 'An exercise that targets a single muscle group, like a curl or leg extension.'],
 ]],
 ['Muscles and movement', [
  ['Primary muscle', 'The main muscle an exercise is meant to target.'],
  ['Secondary muscle', 'Muscles that assist during an exercise.'],
  ['Bilateral', 'Using both sides together, like a regular squat.'],
  ['Unilateral', 'Using one side at a time, like a pistol squat.'],
  ['Movement pattern', 'The type of movement: squat, hinge, lunge, horizontal/vertical push, and horizontal/vertical pull.'],
 ]],
 ['Progress and records', [
  ['PR (Personal Record)', 'Your best recorded lift or performance.'],
  ['1RM (One-Rep Max)', 'The heaviest weight you can lift for a single rep.'],
  ['E1RM (Estimated 1RM)', 'An estimate of your one-rep max calculated from a lighter set.'],
  ['Readiness', 'How recovered you feel before a session — ready, tired or sore.'],
  ['Effort', 'How hard a completed set felt — easy, right or hard.'],
 ]],
 ['Calisthenics skills', [
  ['Muscle-up', 'Pulling from a dead hang up and over the bar into a straight-arm support.'],
  ['Front lever', 'Holding your body horizontal while hanging from a bar with straight arms.'],
  ['Planche', 'Holding your body horizontal above the floor on straight arms.'],
  ['L-sit', 'Sitting with your legs straight out in front, supported on your hands.'],
  ['Progression', 'An easier step that builds toward a harder skill — for example a tuck front lever before the full front lever.'],
 ]],
 ['Nutrition', [
  ['Calorie', 'A unit of energy from food and drink.'],
  ['Calorie deficit / surplus', 'Eating fewer / more calories than your body uses.'],
  ['Macros (macronutrients)', 'Protein, carbohydrates and fat — the nutrients that provide energy.'],
  ['Protein', 'The macronutrient that supports muscle repair and growth.'],
  ['TDEE (Total Daily Energy Expenditure)', 'Roughly the total calories your body burns in a day.'],
  ['Maintenance', 'Eating about the calories you burn, keeping your weight roughly stable.'],
 ]],
];

export default function Glossary(){
 return <div className="container" style={{maxWidth:760,padding:'32px 20px 80px'}}>
  <div className="row between"><Link to="/" className="app-wordmark">GYM<span>IQ</span></Link><Link to="/more" className="btn btn-ghost">Back to account</Link></div>
  <h1 style={{marginTop:40}}>Glossary</h1>
  <p className="subtle">Fitness terms explained in plain language.</p>
  {sections.map(([title,terms])=>(
   <section key={title} style={{marginTop:28}}>
    <h2 style={{fontSize:19}}>{title}</h2>
    {terms.map(([term,def])=>(
     <div key={term} style={{marginTop:14}}>
      <strong style={{fontSize:15}}>{term}</strong>
      <p style={{fontSize:14,lineHeight:1.7,color:'var(--text-muted)',margin:'2px 0 0'}}>{def}</p>
     </div>
    ))}
   </section>
  ))}
 </div>;
}
