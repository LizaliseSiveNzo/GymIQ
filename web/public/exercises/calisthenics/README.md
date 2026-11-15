# Calisthenics exercise images

Drop the 30 generated calisthenics illustrations in this folder.

## Naming convention

- Full image: `<exercise-id>-<hash>.webp` — **768 × 1376**
- Thumbnail: `<exercise-id>-<hash>-thumb.webp` — small (~192 × 344)

Where:
- `<exercise-id>` is the UUID of the exercise in the `exercises` table (see the SQL in `docs/CALISTHENICS_IMAGE_PROMPTS.md`).
- `<hash>` is any short unique suffix (8 hex chars, e.g. `a1b2c3d4`).

## Then wire them up

Add one entry per exercise to `web/src/lib/exerciseImages.json` with `src` pointing at
`/exercises/calisthenics/<exercise-id>-<hash>.webp` and `thumbnail` at the `-thumb` file.
