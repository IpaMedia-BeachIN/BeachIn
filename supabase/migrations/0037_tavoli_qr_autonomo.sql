-- Ordine in autonomia: il tavolo si apre da solo quando il cliente inquadra il QR (senza cameriere).
alter table beachin.tavoli_qr add column if not exists autonomo boolean not null default false;
