import { useEffect, useState } from 'react'
import { Bell, Smartphone } from 'lucide-react'
import { Card, CardHeader, CardBody } from '@/components/ui/Card'
import type { Ruolo, Utente } from '@/lib/permessi'
import { impostaNotificheUtente, leggiDispositiviPush, salvaNotificheRuolo } from '@/lib/utenti'
import { cn } from '@/lib/cn'

/** Tipi di notifica push dell'app staff (stessi nomi della Edge Function beachin-push). */
const TIPI = [
  { id: 'richiesta', nome: 'Tavoli' },
  { id: 'ombrellone', nome: 'Ombrelloni' },
  { id: 'evento', nome: 'Eventi' },
  { id: 'cliente', nome: 'Modifiche clienti' },
] as const

const OPZIONI_UTENTE = [
  { v: 'ruolo', nome: 'Come il ruolo' },
  { v: 'tutte', nome: 'Tutte' },
  { v: 'nessuna', nome: 'Nessuna' },
] as const

const attivo = (r: Ruolo, tipo: string) => r.notifiche?.[tipo] !== false

/**
 * Impostazioni → Utenti e ruoli → Notifiche staff: quali notifiche push riceve ogni ruolo,
 * con eccezione per il singolo utente (es. nessuna notifica durante le prove). Migrazione 0035.
 */
export default function NotificheStaff({ ruoli, utenti, modifica, esegui }: {
  ruoli: Ruolo[]; utenti: Utente[]; modifica: boolean; esegui: (op: Promise<string | null>, ok: string) => Promise<boolean>
}) {
  const [dispositivi, setDispositivi] = useState<Record<string, number>>({})
  useEffect(() => { void leggiDispositiviPush().then(setDispositivi) }, [utenti])

  const cambiaRuolo = (r: Ruolo, tipo: string) =>
    esegui(salvaNotificheRuolo(r.id, { ...(r.notifiche ?? {}), [tipo]: !attivo(r, tipo) }), `Notifiche del ruolo ${r.nome} aggiornate`)
  const cambiaUtente = (u: Utente, v: string) =>
    esegui(impostaNotificheUtente(u.id, v === 'tutte' ? true : v === 'nessuna' ? false : null), `Notifiche di ${u.nome} aggiornate`)
  const ruolo = (id: string) => ruoli.find((r) => r.id === id)

  return (
    <Card>
      <CardHeader
        titolo={<span className="inline-flex items-center gap-2"><Bell className="h-4 w-4 text-cabina" /> Notifiche staff</span>}
        sottotitolo="Quali notifiche push arrivano sul telefono a ogni ruolo. Per un singolo utente puoi fare un'eccezione."
      />
      <CardBody className="space-y-5 pt-1">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[480px] text-sm">
            <thead>
              <tr className="text-left text-xs text-profondo/60">
                <th className="py-2 pr-3 font-medium">Ruolo</th>
                {TIPI.map((t) => <th key={t.id} className="px-2 py-2 text-center font-medium">{t.nome}</th>)}
              </tr>
            </thead>
            <tbody>
              {ruoli.map((r) => (
                <tr key={r.id} className="border-t border-calce-200">
                  <td className="py-2 pr-3 font-medium text-profondo">{r.nome}</td>
                  {TIPI.map((t) => (
                    <td key={t.id} className="px-2 py-2 text-center">
                      <input type="checkbox" className="h-4 w-4 accent-cabina" checked={attivo(r, t.id)} disabled={!modifica}
                        onChange={() => void cambiaRuolo(r, t.id)} aria-label={`${r.nome}: ${t.nome}`} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <ul className="divide-y divide-calce-200">
          {utenti.map((u) => {
            const v = u.notifiche === true ? 'tutte' : u.notifiche === false ? 'nessuna' : 'ruolo'
            const n = dispositivi[u.id] ?? 0
            return (
              <li key={u.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                <div className="min-w-0">
                  <p className={cn('font-medium text-profondo', !u.attivo && 'opacity-50')}>{u.nome}</p>
                  <p className="inline-flex items-center gap-1 text-xs text-profondo/60">
                    {ruolo(u.ruolo_id)?.nome ?? u.ruolo_id} · <Smartphone className="h-3 w-3" />
                    {n === 0 ? 'nessun telefono iscritto' : n === 1 ? '1 telefono' : `${n} telefoni`}
                  </p>
                </div>
                <select className="h-9 rounded-xl border border-calce-200 bg-white px-2 text-sm" value={v} disabled={!modifica}
                  onChange={(e) => void cambiaUtente(u, e.target.value)} aria-label={`Notifiche di ${u.nome}`}>
                  {OPZIONI_UTENTE.map((o) => <option key={o.v} value={o.v}>{o.nome}</option>)}
                </select>
              </li>
            )
          })}
        </ul>
        <p className="text-xs text-profondo/60">
          Un telefono vale per l'utente che era collegato quando ha attivato le notifiche (si ricollega da solo a ogni accesso).
        </p>
      </CardBody>
    </Card>
  )
}
