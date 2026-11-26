/**
 * Menu letto ad alta voce (per clienti non vedenti o ipovedenti): sintesi vocale del browser (Web Speech API),
 * niente server né costi. Legge una sezione alla volta (nome, prezzo, descrizione di ogni voce) e passa da sola
 * alla successiva; tasti grandi per pausa, sezione precedente/successiva, stop e lettura più lenta.
 * Se il browser non ha la sintesi vocale il pulsante non compare. Attivabile da Impostazioni → Moduli (`sito.voce`).
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { Volume2, Pause, Play, SkipBack, SkipForward, Square, Turtle } from 'lucide-react'
import type { LinguaMenu } from '@/data/types'
import { cn } from '@/lib/cn'

export interface SezioneDaLeggere {
  id: string
  nome: string
  voci: { nome: string; prezzo: number; descrizione?: string }[]
}

type Testi = { ascolta: string; leggo: string; di: string; pausa: string; riprendi: string; prec: string; succ: string; stop: string; lento: string; sezione: string; intro: (titolo: string, n: number, nomi: string) => string; fine: string; ns: string }

const TESTI: Record<LinguaMenu, Testi> = {
  it: { ascolta: 'Ascolta il menu', leggo: 'Sto leggendo', di: 'di', pausa: 'Pausa', riprendi: 'Riprendi', prec: 'Sezione precedente', succ: 'Sezione successiva', stop: 'Ferma la lettura', lento: 'Più lento', sezione: 'Sezione',
    intro: (t, n, s) => `${t}. ${n} sezioni: ${s}. Usa i tasti avanti e indietro per cambiare sezione.`, fine: 'Fine del menu.', ns: 'Lettura vocale non disponibile su questo browser' },
  en: { ascolta: 'Listen to the menu', leggo: 'Now reading', di: 'of', pausa: 'Pause', riprendi: 'Resume', prec: 'Previous section', succ: 'Next section', stop: 'Stop reading', lento: 'Slower', sezione: 'Section',
    intro: (t, n, s) => `${t}. ${n} sections: ${s}. Use the next and previous buttons to change section.`, fine: 'End of the menu.', ns: 'Voice reading is not available on this browser' },
  fr: { ascolta: 'Écouter le menu', leggo: 'Lecture en cours', di: 'sur', pausa: 'Pause', riprendi: 'Reprendre', prec: 'Section précédente', succ: 'Section suivante', stop: 'Arrêter la lecture', lento: 'Plus lent', sezione: 'Section',
    intro: (t, n, s) => `${t}. ${n} sections : ${s}. Utilisez les boutons suivant et précédent pour changer de section.`, fine: 'Fin du menu.', ns: 'Lecture vocale indisponible sur ce navigateur' },
  de: { ascolta: 'Speisekarte anhören', leggo: 'Wird gelesen', di: 'von', pausa: 'Pause', riprendi: 'Weiter', prec: 'Vorheriger Abschnitt', succ: 'Nächster Abschnitt', stop: 'Vorlesen beenden', lento: 'Langsamer', sezione: 'Abschnitt',
    intro: (t, n, s) => `${t}. ${n} Abschnitte: ${s}. Mit den Tasten vor und zurück wechseln Sie den Abschnitt.`, fine: 'Ende der Speisekarte.', ns: 'Vorlesen ist in diesem Browser nicht verfügbar' },
  es: { ascolta: 'Escuchar el menú', leggo: 'Leyendo', di: 'de', pausa: 'Pausa', riprendi: 'Continuar', prec: 'Sección anterior', succ: 'Sección siguiente', stop: 'Detener la lectura', lento: 'Más lento', sezione: 'Sección',
    intro: (t, n, s) => `${t}. ${n} secciones: ${s}. Usa los botones siguiente y anterior para cambiar de sección.`, fine: 'Fin del menú.', ns: 'La lectura en voz alta no está disponible en este navegador' },
}
const BCP47: Record<LinguaMenu, string> = { it: 'it-IT', en: 'en-GB', fr: 'fr-FR', de: 'de-DE', es: 'es-ES' }
const VALUTA: Record<LinguaMenu, [string, string]> = { it: ['euro', 'e'], en: ['euros', ''], fr: ['euros', ''], de: ['Euro', ''], es: ['euros', 'con'] }

/** "4 euro e 50": la sintesi legge meglio delle cifre con virgola e simbolo €. */
export function prezzoParlato(prezzo: number, lingua: LinguaMenu = 'it') {
  if (!prezzo) return ''
  const cent = Math.round(prezzo * 100)
  const [parola, e] = VALUTA[lingua]
  const intero = Math.floor(cent / 100)
  const resto = cent % 100
  return resto ? `${intero} ${parola}${e ? ` ${e}` : ''} ${String(resto).padStart(2, '0')}` : `${intero} ${parola}`
}

const disponibile = () => typeof window !== 'undefined' && 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window

export function LettoreMenu({ titolo, sezioni, lingua = 'it', className }: { titolo: string; sezioni: SezioneDaLeggere[]; lingua?: LinguaMenu; className?: string }) {
  const t = TESTI[lingua]
  const [stato, setStato] = useState<'fermo' | 'parla' | 'pausa'>('fermo')
  const [indice, setIndice] = useState(0)
  const [lento, setLento] = useState(false)
  // ogni lettura ha un "giro": gli onend di letture annullate (cancel) vengono ignorati
  const giro = useRef(0)
  const voce = useRef<SpeechSynthesisVoice | undefined>()

  useEffect(() => {
    if (!disponibile()) return
    const scegli = () => {
      const tutte = window.speechSynthesis.getVoices()
      const codice = BCP47[lingua]
      voce.current = tutte.find((v) => v.lang === codice) ?? tutte.find((v) => v.lang.toLowerCase().startsWith(lingua))
    }
    scegli()
    window.speechSynthesis.addEventListener?.('voiceschanged', scegli)
    return () => window.speechSynthesis.removeEventListener?.('voiceschanged', scegli)
  }, [lingua])

  // uscendo dalla pagina (o cambiando lingua/menu) la voce si ferma
  useEffect(() => () => { giro.current++; if (disponibile()) window.speechSynthesis.cancel() }, [lingua, sezioni.length])

  const leggi = useCallback((i: number, conIntro = false) => {
    const synth = window.speechSynthesis
    const mio = ++giro.current
    synth.cancel()
    const sez = sezioni[i]
    if (!sez) { setStato('fermo'); return }
    setIndice(i); setStato('parla')
    const frasi: string[] = []
    if (conIntro) frasi.push(t.intro(titolo, sezioni.length, sezioni.map((s) => s.nome).join(', ')))
    frasi.push(`${t.sezione} ${i + 1}: ${sez.nome}.`)
    sez.voci.forEach((v) => frasi.push([v.nome, prezzoParlato(v.prezzo, lingua), v.descrizione].filter(Boolean).join('. ') + '.'))
    if (i === sezioni.length - 1) frasi.push(t.fine)
    // una frase per voce: le frasi lunghe su Chrome si interrompono dopo ~15 secondi
    frasi.forEach((testo, k) => {
      const u = new SpeechSynthesisUtterance(testo)
      u.lang = BCP47[lingua]
      if (voce.current) u.voice = voce.current
      u.rate = lento ? 0.75 : 1
      if (k === frasi.length - 1) {
        u.onend = () => {
          if (giro.current !== mio) return
          if (i < sezioni.length - 1) leggi(i + 1)
          else setStato('fermo')
        }
      }
      synth.speak(u)
    })
  }, [sezioni, lingua, lento, titolo, t])

  if (!disponibile() || !sezioni.length) return null

  const ferma = () => { giro.current++; window.speechSynthesis.cancel(); setStato('fermo') }
  const pausa = () => {
    if (stato === 'parla') { window.speechSynthesis.pause(); setStato('pausa') }
    else { window.speechSynthesis.resume(); setStato('parla') }
  }
  const tasto = 'grid h-12 w-12 place-content-center rounded-full bg-white text-[color:var(--acc)] ring-1 ring-[#3B2A20]/15 active:scale-95 disabled:opacity-40'

  return (
    <div className={cn('rounded-3xl bg-[#FFFCF6] p-3 shadow-[0_6px_24px_-12px_rgba(59,42,32,0.35)] ring-1 ring-[#3B2A20]/5', className)} role="region" aria-label={t.ascolta}>
      {stato === 'fermo' ? (
        <button type="button" onClick={() => leggi(0, true)}
          className="flex h-14 w-full items-center justify-center gap-2 rounded-full bg-[var(--acc)] text-lg font-semibold text-white shadow-sm active:scale-[0.98]">
          <Volume2 className="h-6 w-6" aria-hidden /> {t.ascolta}
        </button>
      ) : (
        <>
          <p className="mb-2 text-center text-sm" aria-live="polite">
            <span className="text-[#3B2A20]/60">{t.leggo} ({indice + 1} {t.di} {sezioni.length}):</span>{' '}
            <span className="font-semibold">{sezioni[indice]?.nome}</span>
          </p>
          <div className="flex items-center justify-center gap-2">
            <button type="button" className={tasto} onClick={() => leggi(indice - 1)} disabled={indice === 0} aria-label={t.prec} title={t.prec}><SkipBack className="h-5 w-5" /></button>
            <button type="button" onClick={pausa} aria-label={stato === 'parla' ? t.pausa : t.riprendi} title={stato === 'parla' ? t.pausa : t.riprendi}
              className="grid h-14 w-14 place-content-center rounded-full bg-[var(--acc)] text-white shadow-sm active:scale-95">
              {stato === 'parla' ? <Pause className="h-6 w-6" /> : <Play className="h-6 w-6" />}
            </button>
            <button type="button" className={tasto} onClick={() => leggi(indice + 1)} disabled={indice >= sezioni.length - 1} aria-label={t.succ} title={t.succ}><SkipForward className="h-5 w-5" /></button>
            <button type="button" className={tasto} onClick={ferma} aria-label={t.stop} title={t.stop}><Square className="h-5 w-5" /></button>
          </div>
        </>
      )}
      <label className="mt-2 flex items-center justify-center gap-2 text-sm text-[#3B2A20]/70">
        <input type="checkbox" checked={lento} onChange={(e) => setLento(e.target.checked)} className="h-5 w-5 accent-[color:var(--acc)]" />
        <Turtle className="h-4 w-4" aria-hidden /> {t.lento}
      </label>
    </div>
  )
}
