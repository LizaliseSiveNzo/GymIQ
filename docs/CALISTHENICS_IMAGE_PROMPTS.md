# Calisthenics Exercise Image Prompts

Prompts for the 30 calisthenics exercises added in `20261115160000_calisthenics.sql`
and `20261115161500_calisthenics_skills.sql`.

## Style prefix (paste at the start of every image prompt)

> Flat, clean vector illustration of a single athletic figure performing a calisthenics
> movement. Neutral warm light-gray background, soft ground shadow, no text, no logos,
> no watermark. Clear, accurate body position and joint angles. Muted palette — deep navy
> figure with a lime-green accent — premium fitness-app aesthetic, rounded shapes,
> 9:16 portrait composition.

Generate two sizes per exercise: **full 768 × 1376** and a **thumb (~192 × 344)**.

## The 30 exercises — subject line (append to the style prefix)

| # | Exercise | Subject line |
|---|----------|--------------|
| 1 | Bodyweight Squat | A person standing with feet shoulder-width, sitting back into a deep squat with thighs parallel to the floor, arms extended forward for balance, back straight. |
| 2 | Jump Squat | A person mid-air after exploding out of a squat, both feet off the ground, knees tucked, arms swinging up. |
| 3 | Pistol Squat | A person balancing on one leg in a deep single-leg squat, the other leg extended straight forward, arms reaching forward. |
| 4 | Bodyweight Lunge | A person in a forward lunge, front knee bent 90 degrees, rear knee near the floor, hands on hips, torso upright. |
| 5 | Bodyweight Split Squat | A person in a staggered stance lowering straight down, rear knee descending toward the floor, front shin vertical, hands on hips. |
| 6 | Glute Bridge | A person lying on their back with knees bent and feet flat, hips lifted into a bridge, arms flat at the sides. |
| 7 | Single-Leg Glute Bridge | A person lying on their back with one leg extended straight and the other foot planted, hips lifted into a one-leg bridge. |
| 8 | Pike Push-Up | A person in a downward-dog position with hips high, bending the elbows to lower the crown of the head toward the floor between the hands. |
| 9 | Inverted Row | A person lying beneath a low bar with a straight body, pulling the chest up to the bar with elbows back, feet on the ground. |
| 10 | Chest-to-Bar Pull-Up | A person hanging from a pull-up bar, pulling high until the chest or upper sternum touches the bar, elbows driven down. |
| 11 | Explosive High Pull-Up | A person pulling upward explosively on a pull-up bar, bringing the bar toward the lower chest or waist. |
| 12 | False-Grip Pull-Up | A person hanging from a pull-up bar with wrists rolled over the top in a false grip, pulling the chest to the bar. |
| 13 | Negative Muscle-Up | A person above a pull-up bar in support, lowering slowly through the transition down into a dead hang. |
| 14 | Muscle-Up | A person transitioning over a pull-up bar from a dead hang into a straight-arm support above the bar, wrists rolled over. |
| 15 | Tuck Front Lever | A person hanging from a bar with the body horizontal, knees tucked tight to the chest, arms straight. |
| 16 | Advanced Tuck Front Lever | A person hanging from a bar with the body horizontal, knees extended away while the hips stay tucked, arms straight. |
| 17 | One-Leg Front Lever | A person hanging from a bar with the body horizontal, one leg fully extended and the other tucked, arms straight. |
| 18 | Front Lever | A person hanging from a bar with the body fully horizontal and straight, legs together, arms straight. |
| 19 | Dragon Flag | A person lying on their back gripping a support behind their head, lifting the whole body into a straight vertical line resting on the shoulders. |
| 20 | Skin the Cat | A person hanging from a bar rotating backward, tucking the legs through the arms into a German hang position. |
| 21 | Planche Lean | A person in a plank position leaning the shoulders far forward past the hands, arms straight, body rigid. |
| 22 | Pseudo Planche Push-Up | A person performing a push-up with the hands near the hips and the shoulders leaning forward, elbows tracking back. |
| 23 | Tuck Planche | A person balancing on straight arms with the body lifted and knees tucked to the chest, shoulders leaned forward. |
| 24 | Advanced Tuck Planche | A person balancing on straight arms with knees extended back while the hips stay tucked, body near horizontal. |
| 25 | Straddle Planche | A person balancing on straight arms with legs spread wide in a straddle, body horizontal above the floor. |
| 26 | Full Planche | A person balancing on straight arms with legs together and the body fully horizontal, parallel to the floor. |
| 27 | Tuck L-Sit | A person sitting on the floor supporting their weight on the hands, lifting the hips and tucking the knees to the chest. |
| 28 | L-Sit | A person sitting on the floor supporting their weight on the hands, legs straight out and parallel to the floor, chest tall. |
| 29 | V-Sit | A person sitting on the floor supporting their weight on the hands, legs lifted high toward a V shape, hips forward. |
| 30 | Pike Compression Hold | A person seated with legs straight, leaning forward and pressing the hands beside the hips, thighs squeezed toward the chest. |

## Get the exercise IDs (run after the two migrations)

```sql
select id, name from public.exercises
where name in (
  'Bodyweight Squat','Jump Squat','Pistol Squat','Bodyweight Lunge','Bodyweight Split Squat',
  'Glute Bridge','Single-Leg Glute Bridge','Pike Push-Up','Inverted Row',
  'Chest-to-Bar Pull-Up','Explosive High Pull-Up','False-Grip Pull-Up','Negative Muscle-Up','Muscle-Up',
  'Tuck Front Lever','Advanced Tuck Front Lever','One-Leg Front Lever','Front Lever','Dragon Flag','Skin the Cat',
  'Planche Lean','Pseudo Planche Push-Up','Tuck Planche','Advanced Tuck Planche','Straddle Planche','Full Planche',
  'Tuck L-Sit','L-Sit','V-Sit','Pike Compression Hold'
) order by sort_order;
```

Name each output `<id>-<hash>.webp` / `<id>-<hash>-thumb.webp` and drop them in
`web/public/exercises/calisthenics/`.
