-- Notifiche push dello staff per ruolo, con eccezione per singolo utente (Impostazioni → Notifiche staff).
-- - push_iscrizioni.utente_id: chi era collegato quando il telefono si è iscritto (app admin). Le iscrizioni admin senza
--   utente (fatte prima di questa migrazione) non ricevono più nulla finché l'app non si riapre: l'app staff le ricollega
--   da sola all'accesso.
-- - ruoli.notifiche: quali tipi riceve il ruolo (richiesta = tavolo, ombrellone, evento, cliente = modifica/annullo).
--   Tipo assente = sì.
-- - utenti.notifiche: null = come il ruolo, true = tutte, false = nessuna.
-- - beachin.iscrizioni_push(app, tipo): a chi manda la Edge Function beachin-push.
alter table beachin.push_iscrizioni add column if not exists utente_id uuid references auth.users(id) on delete set null;
alter table beachin.ruoli add column if not exists notifiche jsonb not null default '{}'::jsonb;
alter table beachin.utenti add column if not exists notifiche boolean;

create or replace function beachin.registra_push(p_endpoint text, p_p256dh text, p_auth text, p_url text, p_app text default 'admin')
returns void language sql security definer set search_path = '' as $$
  insert into beachin.push_iscrizioni (endpoint, p256dh, auth, url, app, utente_id)
  values (p_endpoint, p_p256dh, p_auth, p_url, case when p_app = 'clienti' then 'clienti' else 'admin' end,
          case when p_app = 'clienti' then null else auth.uid() end)
  on conflict (endpoint, app) do update set p256dh = excluded.p256dh, auth = excluded.auth, url = excluded.url,
    utente_id = coalesce(excluded.utente_id, beachin.push_iscrizioni.utente_id);
$$;
revoke all on function beachin.registra_push(text, text, text, text, text) from public;
grant execute on function beachin.registra_push(text, text, text, text, text) to anon, authenticated;

create or replace function beachin.iscrizioni_push(p_app text, p_tipo text)
returns table (endpoint text, p256dh text, auth text, url text)
language sql stable security definer set search_path = '' as $$
  select s.endpoint, s.p256dh, s.auth, s.url
  from beachin.push_iscrizioni s
  where s.app = 'clienti' and p_app = 'clienti'
  union all
  select s.endpoint, s.p256dh, s.auth, s.url
  from beachin.push_iscrizioni s
  join beachin.utenti u on u.id = s.utente_id and u.attivo
  join beachin.ruoli r on r.id = u.ruolo_id
  where s.app = 'admin' and p_app = 'admin'
    and coalesce(u.notifiche, coalesce((r.notifiche ->> p_tipo)::boolean, true))
$$;
revoke all on function beachin.iscrizioni_push(text, text) from public, anon, authenticated;

-- Per la pagina: quanti telefoni ha iscritto ogni utente (solo chi gestisce gli utenti).
create or replace function beachin.dispositivi_push() returns table (utente_id uuid, dispositivi int)
language sql stable security definer set search_path = '' as $$
  select s.utente_id, count(*)::int from beachin.push_iscrizioni s
  where s.app = 'admin' and s.utente_id is not null and beachin.ha_permesso('utenti', 1)
  group by s.utente_id
$$;
revoke all on function beachin.dispositivi_push() from public, anon;
grant execute on function beachin.dispositivi_push() to authenticated;

-- Eccezione per utente (utenti non ha policy di modifica per authenticated: passa da qui).
create or replace function beachin.imposta_notifiche_utente(p_id uuid, p_notifiche boolean) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not beachin.ha_permesso('utenti', 2) then raise exception 'permesso negato'; end if;
  update beachin.utenti set notifiche = p_notifiche where id = p_id;
end $$;
revoke all on function beachin.imposta_notifiche_utente(uuid, boolean) from public, anon;
grant execute on function beachin.imposta_notifiche_utente(uuid, boolean) to authenticated;
