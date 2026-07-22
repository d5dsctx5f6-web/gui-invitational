-- Skins buy-in was explicitly listed in PRODUCT_SPEC §6 as a pending input Chris supplies
-- later ("Skins buy-in... TBD (admin)") — nullable so the Money screen can show skin counts
-- before a buy-in is set and dollar amounts once it is, never hard-blocking on a missing value.
-- Per-round (not per-season) since buy-in could differ Saturday vs Sunday.

alter table rounds add column skins_buy_in numeric;
