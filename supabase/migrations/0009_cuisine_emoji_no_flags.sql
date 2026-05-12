-- Adopt the "dish or ingredient, never a country flag" cuisine emoji convention.
--
-- The seed in 0004 (and lib/cuisines.ts) mixed dishes with flags. Flags can't be
-- applied uniformly — most cuisine entries aren't nationalities — so we drop them
-- entirely. This re-points the seven flag entries at a representative dish; only
-- those rows are touched, so any emoji you've since edited by hand survives.

update cuisines set emoji = '🥧' where name = 'American'   and emoji = '🇺🇸'; -- apple pie
update cuisines set emoji = '🫘' where name = 'Brazilian'  and emoji = '🇧🇷'; -- feijoada
update cuisines set emoji = '🥪' where name = 'Cuban'      and emoji = '🇨🇺'; -- Cuban sandwich
update cuisines set emoji = '🫓' where name = 'Ethiopian'  and emoji = '🇪🇹'; -- injera
update cuisines set emoji = '🍢' where name = 'Filipino'   and emoji = '🇵🇭'; -- BBQ skewers
update cuisines set emoji = '🫒' where name = 'Greek'      and emoji = '🇬🇷'; -- olives
update cuisines set emoji = '🥘' where name = 'Spanish'    and emoji = '🇪🇸'; -- paella
