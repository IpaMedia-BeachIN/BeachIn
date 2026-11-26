/**
 * Scontrini di cucina e bar su stampante termica (80 mm), dal browser del dispositivo di cucina/bar.
 * Stampa silenziosa: Chrome avviato con `--kiosk-printing` e la termica come stampante predefinita
 * (senza quel flag a ogni scontrino si apre la finestra di stampa). Più scontrini insieme = un solo lavoro.
 * Stampa automatica per dispositivo (localStorage): solo il tablet/PC della cucina la accende, così non stampa due volte.
 */
import type { Comanda, ComandaSala } from '@/data/types'
import { nomeUscita, uscitaChiamata, uscitaDi, statoRiga, type Reparto } from '@/lib/sala'

export type Scontrino = { titolo: string; sottotitolo?: string; gruppi: { nome: string; righe: string[]; dopo?: boolean }[]; note?: string; ora: string; origine?: string }

const esc = (t: string) => t.replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[ch] as string)

/** Scontrino di una comanda del tavolo (vista del reparto). `soloUscita`: scontrino del «via» con le sole righe di quell'uscita. */
export function scontrinoTavolo(c: ComandaSala, reparto: Reparto, soloUscita?: number): Scontrino {
  const usc = [...new Set(c.righe.map(uscitaDi))].sort((a, b) => a - b).filter((n) => soloUscita === undefined || n === soloUscita)
  return {
    titolo: `TAVOLO ${c.tavolo}`,
    sottotitolo: soloUscita !== undefined ? `VIA ${nomeUscita(soloUscita).toUpperCase()}` : `${reparto === 'bar' ? 'BAR' : 'CUCINA'}${c.coperti ? ` · ${c.coperti} coperti` : ''}`,
    gruppi: usc.map((n) => ({
      nome: nomeUscita(n),
      dopo: soloUscita === undefined && !uscitaChiamata(c, n),
      righe: c.righe.filter((r) => uscitaDi(r) === n && statoRiga(c, r) !== 'servita').map((r) => `${r.quantita}× ${r.nome}${r.note ? ` (${r.note})` : ''}`),
    })).filter((g) => g.righe.length),
    note: c.note,
    ora: c.ora,
    origine: c.origine === 'qr' ? 'QR dal telefono' : c.origine === 'self' ? 'Tablet al tavolo' : c.cameriere,
  }
}

export const scontrinoOmbrellone = (c: Comanda): Scontrino => ({
  titolo: `OMBRELLONE ${c.ombrellone || '—'}`,
  sottotitolo: 'BAR',
  gruppi: [{ nome: 'Da preparare', righe: c.righe.map((r) => `${r.quantita}× ${r.nome}`) }],
  note: c.note,
  ora: c.ora,
  origine: c.origine === 'app' ? `App${c.cliente ? ` · ${c.cliente}` : ''}` : 'Banco',
})

const html = (s: Scontrino) => `<section>
  <p class="t">${esc(s.titolo)}</p>${s.sottotitolo ? `<p class="s">${esc(s.sottotitolo)}</p>` : ''}
  <p class="o">${esc(s.ora)}${s.origine ? ` · ${esc(s.origine)}` : ''}</p>
  ${s.gruppi.map((g) => `<p class="g">${esc(g.nome)}${g.dopo ? ' · ASPETTA IL VIA' : ''}</p><ul class="${g.dopo ? 'd' : ''}">${g.righe.map((r) => `<li>${esc(r)}</li>`).join('')}</ul>`).join('')}
  ${s.note ? `<p class="n">NOTE: ${esc(s.note)}</p>` : ''}
</section>`

/** Stampa uno o più scontrini in un solo lavoro (iframe nascosto: niente finestre nuove, funziona anche senza un tocco). */
export function stampaScontrini(scontrini: Scontrino[]) {
  if (!scontrini.length) return
  const f = document.createElement('iframe')
  f.setAttribute('aria-hidden', 'true')
  f.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0'
  document.body.appendChild(f)
  const d = f.contentDocument
  if (!d) return
  d.open()
  d.write(`<!doctype html><html><head><meta charset="utf-8"><title>Comanda</title><style>
    @page{size:80mm auto;margin:0} body{margin:0;padding:3mm 4mm;width:72mm;font-family:ui-monospace,Menlo,Consolas,monospace;color:#000}
    section{break-after:page;padding-bottom:6mm} section:last-child{break-after:auto}
    .t{margin:0;font-size:22pt;font-weight:800} .s{margin:0;font-size:13pt;font-weight:700} .o{margin:1mm 0 2mm;font-size:10pt;border-bottom:1px dashed #000;padding-bottom:2mm}
    .g{margin:2mm 0 1mm;font-size:10pt;font-weight:700;text-transform:uppercase} ul{margin:0;padding:0;list-style:none;font-size:14pt;font-weight:700}
    ul.d{font-weight:400;font-size:11pt} li{margin:.5mm 0} .n{margin-top:2mm;border-top:1px dashed #000;padding-top:2mm;font-size:12pt}
  </style></head><body>${scontrini.map(html).join('')}</body></html>`)
  d.close()
  window.setTimeout(() => {
    f.contentWindow?.focus()
    f.contentWindow?.print()
    window.setTimeout(() => f.remove(), 60000)
  }, 250)
}

const chiaveAuto = (reparto: Reparto) => `beachin.stampa.auto.${reparto}`
const chiaveFatte = (reparto: Reparto) => `beachin.stampa.fatte.${reparto}`
const leggi = (k: string) => { try { return localStorage.getItem(k) } catch { return null } }
const scrivi = (k: string, v: string) => { try { localStorage.setItem(k, v) } catch { /* niente */ } }

export const stampaAutoAttiva = (reparto: Reparto) => leggi(chiaveAuto(reparto)) === '1'
export const impostaStampaAuto = (reparto: Reparto, on: boolean) => scrivi(chiaveAuto(reparto), on ? '1' : '0')

/** Cosa è già stato stampato su questo dispositivo: id → ultima uscita stampata (-1 = comanda dall'ombrellone). */
export function stampate(reparto: Reparto): Record<string, number> {
  try { return JSON.parse(leggi(chiaveFatte(reparto)) ?? '{}') as Record<string, number> } catch { return {} }
}
export function salvaStampate(reparto: Reparto, m: Record<string, number>) {
  // si tengono solo le ultime 300 voci
  const voci = Object.entries(m).slice(-300)
  scrivi(chiaveFatte(reparto), JSON.stringify(Object.fromEntries(voci)))
}
