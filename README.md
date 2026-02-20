# React + TypeScript + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Babel](https://babeljs.io/) for Fast Refresh
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/) for Fast Refresh

## Expanding the ESLint configuration

If you are developing a production application, we recommend updating the configuration to enable type-aware lint rules:

```js
export default tseslint.config({
  extends: [
    // Remove ...tseslint.configs.recommended and replace with this
    ...tseslint.configs.recommendedTypeChecked,
    // Alternatively, use this for stricter rules
    ...tseslint.configs.strictTypeChecked,
    // Optionally, add this for stylistic rules
    ...tseslint.configs.stylisticTypeChecked,
  ],
  languageOptions: {
    // other options...
    parserOptions: {
      project: ['./tsconfig.node.json', './tsconfig.app.json'],
      tsconfigRootDir: import.meta.dirname,
    },
  },
})
```

You can also install [eslint-plugin-react-x](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-x) and [eslint-plugin-react-dom](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-dom) for React-specific lint rules:

```js
// eslint.config.js
import reactX from 'eslint-plugin-react-x'
import reactDom from 'eslint-plugin-react-dom'

export default tseslint.config({
  plugins: {
    // Add the react-x and react-dom plugins
    'react-x': reactX,
    'react-dom': reactDom,
  },
  rules: {
    // other rules...
    // Enable its recommended typescript rules
    ...reactX.configs['recommended-typescript'].rules,
    ...reactDom.configs.recommended.rules,
  },
})
```

## Tournament Analytics & Playoffs

This project now includes an extended tournament analytics/playoff module built on top of Supabase.

### Database migration

Apply:

`supabase/migrations/20260218093000_tournament_analytics_playoffs.sql`

Main additions:

- `player_stats` advanced fields:
  - `tournament_id`
  - `steals`, `blocks`, `turnovers`, `fouls`, `fgm`, `fga`
- Validation constraints:
  - all stats non-negative
  - `fgm <= fga`
- Integrity constraints:
  - unique `(match_id, player_id)` in `player_stats`
  - unique `(match_id, player_id)` in `match_players`
  - `player_stats(match_id, player_id)` FK to `match_players(match_id, player_id)`
- New tables:
  - `tournament_settings`
  - `playoff_series`
  - `playoff_games`
- New helper view/functions:
  - `tournament_player_stats_enriched`
  - `tournament_regular_standings`
  - `generate_tournament_playoffs(p_tournament_id uuid)`
  - `sync_playoff_series_from_match(p_match_id bigint)`

### Playoff format JSON (`tournament_settings.playoff_format`)

```json
{
  "enabled": true,
  "format": "custom_1vN_handicap_2v3_bo3_finals_bo3",
  "rounds": [
    {
      "name": "Round 1",
      "series": [
        {
          "pairing": "1vN",
          "type": "handicap",
          "targetWins": { "topSeed": 1, "bottomSeed": 2 }
        },
        {
          "pairing": "2v3",
          "type": "bestOf",
          "bestOf": 3
        }
      ]
    },
    {
      "name": "Finals",
      "series": [
        {
          "pairing": "Winners",
          "type": "bestOf",
          "bestOf": 3
        }
      ]
    }
  ]
}
```

### MVP formulas

Regular-season MVP and Finals MVP use z-score normalized per-game features:

`score = 0.30*z(PPG) + 0.20*z(APG) + 0.20*z(RPG) + 0.10*z(SPG) + 0.10*z(BPG) + 0.10*z(FG%) - 0.15*z(TOPG) - 0.05*z(FPG)`

Team success adjustment:

`finalScore = score + 0.10*z(teamFactor)`

Eligibility rule:

- player must have at least `30%` of team games in the selected phase.

### PR Audit Summary Template

Use this in PR description:

1. **Current tables and stats storage**
   - List tournament-related tables currently used.
   - Identify where stats were stored before migration.
2. **Current match result flow**
   - Explain schedule creation -> result entry -> standings/leaders flow.
3. **Schema changes applied**
   - Summarize columns/tables/functions/views added.
   - Explain backward-compatibility strategy and data backfills.
