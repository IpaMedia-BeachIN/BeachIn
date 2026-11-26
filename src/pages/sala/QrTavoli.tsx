/**
 * QR fissi dei tavoli: un QR stampato per tavolo (link con codice non indovinabile, `urlTavoloQr`).
 * Dal telefono si ordina solo se il tavolo è aperto (lo apre il cameriere, o si apre da solo alla prima comanda).
 * Con «Ordine in autonomia» il tavolo si apre da solo quando il cliente inquadra il QR (tavoli senza servizio al tavolo).
 * Tutto dalla schermata del cameriere: sulla card del tavolo menu (Ristorante, Bar, Lavagnetta), apri/chiudi e stampa;
 * nell'intestazione della scelta tavolo "Chiudi tutti" e "Stampa QR" di tutti i tavoli.
 */
import { useEffect, useMemo } from 'react'
import { Lock, Printer, QrCode, Smartphone } from 'lucide-react'
import type { TavoloQr } from '@/data/types'
import { useDemoData } from '@/context/DemoDataContext'
import { useModuli } from '@/context/ModuliContext'
import { Button } from '@/components/ui/Button'
import { QrCodice, stampaQr } from '@/components/QrCodice'
import { config } from '@/data/config'
import { urlTavoloQr } from '@/lib/sala'
import { cn } from '@/lib/cn'
import { MENU_SELF } from './AvvioSelf'

/** Tasti "Chiudi tutti" e "Stampa tutti" dei QR, nell'intestazione della scelta tavolo del cameriere. */
export function AzioniQrTavoli() {
  const { tavoliDelGiorno, tavoliQr, assicuraTavoliQr, impostaTavoloQr } = useDemoData()
  const tavoli = useMemo(() => tavoliDelGiorno(config.oggi), [tavoliDelGiorno])
  const aperti = tavoliQr.filter((q) => q.aperto)
  const numeri = useMemo(() => [...tavoli].sort((a, b) => a.numero - b.numero).map((t) => t.numero), [tavoli])
  const tuttiAutonomi = numeri.length > 0 && numeri.every((n) => tavoliQr.find((q) => q.numero === n)?.autonomo)
  const stampaTutti = () => stampaTavoli(assicuraTavoliQr(numeri))
  return (
    <div className="flex flex-wrap gap-2">
      {aperti.length > 0 && <Button dimensione="sm" onClick={() => { if (confirm(`Chiudere tutti i ${aperti.length} tavoli aperti?`)) aperti.forEach((q) => impostaTavoloQr(q.numero, { aperto: false })) }} title="Dal QR non si ordina più finché il tavolo non viene riaperto"><Lock className="h-4 w-4" /> Chiudi tutti</Button>}
      <Button dimensione="sm" onClick={() => {
        const tutti = !tuttiAutonomi
        if (confirm(tutti ? 'Mettere tutti i tavoli in autonomia? Il cliente inquadra il QR e ordina senza aspettare il cameriere.' : 'Togliere l\'autonomia a tutti i tavoli? Si ordinerà solo con il tavolo aperto dal cameriere.'))
          numeri.forEach((n) => impostaTavoloQr(n, { autonomo: tutti }))
      }} title="Il tavolo si apre da solo quando il cliente inquadra il QR"><Smartphone className="h-4 w-4" /> {tuttiAutonomi ? 'Togli autonomia' : 'Tutti in autonomia'}</Button>
      <Button dimensione="sm" onClick={stampaTutti} title="Stampa i QR fissi di tutti i tavoli"><Printer className="h-4 w-4" /> Stampa QR</Button>
    </div>
  )
}

const stampaTavoli = (righe: TavoloQr[]) =>
  void stampaQr(righe.map((q) => ({ titolo: `Tavolo ${q.numero}`, sottotitolo: 'Inquadra e ordina dal telefono', url: urlTavoloQr(q.codice) })), config.nome, 'tavolo')

/** QR di un tavolo con menu, apri/chiudi e stampa (card del tavolo del cameriere). */
export function DettaglioQr({ numero }: { numero: number }) {
  const q = useQrTavolo(numero)
  const { impostaTavoloQr } = useDemoData()
  const conBar = useModuli().moduloAttivo('bar-tavolo')
  const menu = MENU_SELF.filter((m) => m.id !== 'bar' || conBar)
  if (!q) return null
  return (
    <div className="space-y-3">
      <QrCodice tipo="tavolo" url={urlTavoloQr(q.codice)} className="mx-auto w-48" />
      <p className="break-all text-center text-[11px] text-profondo/50">{urlTavoloQr(q.codice)}</p>
      <div>
        <p className="mb-1 text-xs font-medium text-profondo/60">Menu del tavolo</p>
        <div className="grid grid-cols-3 gap-1.5">
          {menu.map((m) => (
            <button key={m.id} type="button" onClick={() => impostaTavoloQr(q.numero, { menu: m.id })}
              className={cn('rounded-lg border px-2 py-1.5 text-xs font-semibold', q.menu === m.id ? 'border-cabina bg-cabina text-white' : 'border-calce-200 text-profondo/70')}>
              {m.nome}
            </button>
          ))}
        </div>
      </div>
      <label className="flex cursor-pointer items-start gap-2 rounded-lg border border-calce-200 p-2 text-xs text-profondo/70">
        <input type="checkbox" className="mt-0.5" checked={!!q.autonomo} onChange={(e) => impostaTavoloQr(q.numero, { autonomo: e.target.checked })} />
        <span><b className="text-profondo">Ordine in autonomia</b><br />Il tavolo si apre da solo quando il cliente inquadra il QR, senza cameriere. Con «Chiudi conto» si richiude fino alla scansione successiva.</span>
      </label>
      <div className="flex gap-2">
        <Button className="flex-1" variante={q.aperto ? 'secondario' : 'primario'} onClick={() => impostaTavoloQr(q.numero, { aperto: !q.aperto })}>
          {q.aperto ? <><Lock className="h-4 w-4" /> Chiudi</> : <><QrCode className="h-4 w-4" /> Apri tavolo</>}
        </Button>
        <Button onClick={() => stampaTavoli([q])}><Printer className="h-4 w-4" /> Stampa</Button>
      </div>
    </div>
  )
}

/** Riga QR del tavolo; se manca la crea (dopo il render: non si cambia lo stato del context mentre si disegna). */
export function useQrTavolo(numero: number) {
  const { tavoliQr, assicuraTavoliQr } = useDemoData()
  const q = tavoliQr.find((x) => x.numero === numero)
  useEffect(() => { if (!q) assicuraTavoliQr([numero]) }, [q, numero, assicuraTavoliQr])
  return q
}
