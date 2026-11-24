# Backend setup for accounts & leaderboards

Reaction Arena is served from **`https://reaction.retrac.space`** (see `CNAME`). Sign-in and leaderboards only work once the two backend services trust that origin and the API knows about the game's boards. Nothing below is done by this repository; each step goes in the repo named.

## 1. retrac.space-accounts: trust the origin

In `src/server/worker.ts`, add the origin to `websiteOrigins` (the same way `toptext` was added):

```ts
  "https://reaction.retrac.space",
```

Then add `https://reaction.retrac.space` to the deployed `GAME_AUTH_ORIGINS` setting so `/api/auth/token` issues tokens to the site.

## 2. retrac.space-api: allow the origin

In `wrangler.jsonc`, append the origin to `ALLOWED_ORIGINS`:

```
,https://reaction.retrac.space
```

## 3. retrac.space-api: register the game and its boards

Add this as a new migration (e.g. `migrations/0008_reactionarena.sql`) and apply it. The board IDs, directions and ranges must match `BOARDS` in `js/leaderboards.js`. `tests/leaderboards.test.mjs` checks that they do.

<!-- reactionarena-sql:start -->
```sql
INSERT INTO games (id, name, save_slots) VALUES ('reactionarena', 'Reaction Arena', 1);
--> statement-breakpoint
INSERT INTO leaderboards (game_id, id, name, direction, score_type, min_score, max_score) VALUES
  ('reactionarena', 'reaction', 'Reaction Time (ms)', 'asc', 'integer', 50, 5000),
  ('reactionarena', 'aim', 'Aim Trainer (ms per target)', 'asc', 'integer', 50, 10000),
  ('reactionarena', 'typing', 'Typing Speed (wpm)', 'desc', 'integer', 0, 300),
  ('reactionarena', 'sequence', 'Sequence Memory (steps)', 'desc', 'integer', 0, 1000),
  ('reactionarena', 'clicks', 'Click Speed (clicks in 5 s)', 'desc', 'integer', 0, 250),
  ('reactionarena', 'time', 'Time Perception (ms off)', 'asc', 'integer', 0, 60000),
  ('reactionarena', 'color', 'Color Detection (levels)', 'desc', 'integer', 0, 1000),
  ('reactionarena', 'math', 'Mental Math (solved)', 'desc', 'integer', 0, 500),
  ('reactionarena', 'precision', 'Precision (points over 10 shots)', 'desc', 'integer', 0, 1000),
  ('reactionarena', 'visual', 'Visual Memory (levels)', 'desc', 'integer', 0, 1000);
```
<!-- reactionarena-sql:end -->

### How scores are stored

All boards use integers. Two are shown differently from how they're stored:

| Board | Stored | Shown as |
|-------|--------|----------|
| `clicks` | total clicks in 5 seconds | clicks ÷ 5, as clicks per second |
| `precision` | total points over 10 shots (0–1000) | points ÷ 10, as an average out of 100 |

`asc` boards (reaction, aim, time) rank lower scores higher.

Zero scores on higher-wins boards aren't submitted.
