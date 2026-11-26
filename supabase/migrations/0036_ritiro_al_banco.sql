-- App clienti: l'ordine dall'ombrellone può essere "ritiro al banco" (senza spese) o consegnato all'ombrellone
-- con le spese di consegna (importo in sito_contenuti, riga consegna_ombrellone = {"costo": 2}), già comprese nel totale.
alter table beachin.comande add column if not exists ritiro boolean not null default false;
alter table beachin.comande add column if not exists consegna numeric(10,2) not null default 0;

-- Le spese di consegna le cambia chi gestisce il Bar (Bar → Listino), anche senza permesso sul Sito.
drop policy if exists "bar consegna" on beachin.sito_contenuti;
create policy "bar consegna" on beachin.sito_contenuti for all to authenticated
  using (id = 'consegna_ombrellone' and beachin.ha_permesso('bar', 2))
  with check (id = 'consegna_ombrellone' and beachin.ha_permesso('bar', 2));
