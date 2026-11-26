/** Scheda di una comanda dall'ombrellone (pagina Comande e coda del bar): righe, stato e tasto per avanzare. */
import { Check, Store, Umbrella, X } from 'lucide-react'
import type { Comanda, StatoComanda } from '@/data/types'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { euroCent } from '@/lib/formatters'
import { cn } from '@/lib/cn'
import { etichettaStatoComanda as etichettaStato } from '@/lib/comandapp'

const tonoStato: Record<StatoComanda, 'boa' | 'tenda' | 'stagionale' | 'acqua'> = {
  in_attesa: 'boa', presa_in_carico: 'tenda', in_preparazione: 'stagionale', pronta: 'acqua',
}
const azione: Partial<Record<StatoComanda, string>> = {
  in_attesa: 'Prendi in carico', presa_in_carico: 'Inizia preparazione', in_preparazione: 'Pronta',
}
/** Al banco il cliente viene a prendersela: l'ultimo passo dice di chiamarlo invece di portarla. */
const azioneRitiro: Partial<Record<StatoComanda, string>> = { in_preparazione: 'Pronta al banco' }


export function ComandaCard({ comanda: c, onAvanza, onAnnulla }: { comanda: Comanda; onAvanza: () => void; onAnnulla: () => void }) {
  const consegnata = c.stato === 'pronta'
  return (
    <div className={cn('rounded-xl border p-3', consegnata ? 'border-calce-200 bg-calce/40 opacity-70' : c.ritiro ? 'border-2 border-tenda bg-white' : 'border-calce-200 bg-white')}>
      <div className="flex items-center justify-between gap-2">
        <span className="inline-flex items-center gap-1.5 font-bold text-profondo"><Umbrella className="h-4 w-4 text-cabina" /> {c.ombrellone || '—'}{c.origine === 'app' && <Badge tono="mare">App</Badge>}{c.cliente && <span className="text-xs font-normal text-profondo/50">{c.cliente}</span>}</span>
        <div className="flex items-center gap-2">
          <span className="num text-xs text-profondo/45">{c.ora}</span>
          <Badge tono={tonoStato[c.stato]} puntino>{etichettaStato[c.stato]}</Badge>
        </div>
      </div>
      {c.ritiro && (
        <p className="mt-2 flex items-center gap-1.5 rounded-lg bg-tenda px-2.5 py-1.5 text-sm font-bold uppercase tracking-wide text-profondo">
          <Store className="h-4 w-4" /> Ritiro al banco · non consegnare
        </p>
      )}
      <ul className="mt-2 space-y-0.5 text-sm text-profondo/80">
        {c.righe.map((r) => (
          <li key={r.articoloId} className="flex justify-between gap-2">
            <span><span className="num font-semibold">{r.quantita}×</span> {r.nome}</span>
            <span className="num text-profondo/55">{euroCent(r.quantita * r.prezzoUnitario)}</span>
          </li>
        ))}
        {!!c.consegna && <li className="flex justify-between gap-2 text-profondo/55"><span>Consegna all’ombrellone</span><span className="num">{euroCent(c.consegna)}</span></li>}
      </ul>
      {c.note && <p className="mt-1 text-xs italic text-profondo/55">Note: {c.note}</p>}
      <div className="mt-2 flex items-center justify-between gap-2 border-t border-calce-200 pt-2">
        <span className="num text-sm font-bold text-profondo">{euroCent(c.totale)}</span>
        <div className="flex items-center gap-2">
          {!consegnata && (
            <button type="button" onClick={onAnnulla} className="grid h-8 w-8 place-content-center rounded-lg text-profondo/45 hover:bg-boa/10 hover:text-boa" title="Annulla comanda" aria-label="Annulla comanda"><X className="h-4 w-4" /></button>
          )}
          {azione[c.stato] && <Button variante={c.stato === 'in_preparazione' ? 'primario' : 'secondario'} dimensione="sm" onClick={onAvanza}>{c.stato === 'in_preparazione' && <Check className="h-4 w-4" />} {(c.ritiro && azioneRitiro[c.stato]) || azione[c.stato]}</Button>}
          {consegnata && <span className="inline-flex items-center gap-1 text-sm font-medium text-acqua"><Check className="h-4 w-4" /> {c.ritiro ? 'Pronta al banco' : 'Pronta'}</span>}
        </div>
      </div>
    </div>
  )
}
