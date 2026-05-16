# Suggestion Correction field whitelist

A Correction may propose changes only to a bounded whitelist of fields: `name`, `permanently_closed`, `cuisine[]`, `vegetarian`, `locations[]`, `photo_url`, plus a free-text `anything_else` note. Every other field on `restaurants` is off-limits to anonymous proposers.

The whitelist sorts the schema on a three-way axis: **factual** (the world owns the truth — `name`, `permanently_closed`, `cuisine[]`, `vegetarian`, `locations[]`) is suggestable; **editorial voice** (the owner's voice — `notes`, `pros`, `cons`, `recommendations`, `rating`) is not; **personal-context** (anchored to the owner's habits — `occasion`, `wallet`, `status`, `visited_at`) is not. `photo_url` is treated as factual with extra safeguards (see ADR-0003). `slug` is excluded because rebrand-driven renames break URLs and want owner handling.

## Considered options

- **Include `occasion` and `wallet`.** Considered and rejected. Both fields are explicitly defined in `docs/dining-guide-spec.md` as personal-context, anchored to the owner's habits. Accepting outsider values would silently degrade the meaning of the field — a `wallet=Big night` from a stranger isn't anchored to the same baseline as the owner's. The free-text `anything_else` field captures the rare case where the spend tier needs flagging.
- **Include `name`.** Included. Rebrands and closures genuinely happen; without `name` on the list, "they changed names to X" can only be reported via `anything_else`, which is more friction than the value of excluding the field.
- **Include `rating` or `notes`.** Considered and rejected on first principles — these are the owner's voice, not the world's.

## Consequences

- The Correction form is a constrained subset of the existing `RestaurantForm`. Sub-components (`CuisineCombobox`, `AddressAutocomplete`, `LocationsFieldArray`) are reused; editorial-voice fields are simply not rendered.
- Zod enforces the whitelist at submit time. Any extra keys in the payload are stripped by `suggestionSchema.parse`. The DB does not enforce field-level constraints (JSONB column); the trust boundary is the server action's Zod parse.
- Expanding the whitelist later is a Zod + form change, not a schema migration. Contracting it is the same. Cost of evolution is low.
