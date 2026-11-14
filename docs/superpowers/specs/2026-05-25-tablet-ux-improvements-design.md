# Tablet UX Improvements — Design Spec

**Data:** 2026-05-25  
**Branch:** feature/yard-manager-multi  
**Stato:** Approvato per implementazione

---

## Contesto

Dall'uso dell'app su tablet (orientamento landscape e portrait) sono emerse quattro criticità:

1. **Modal "Crea vasca" non scrollabile** — in landscape il form esce dallo schermo e non si riesce a raggiungere il pulsante di conferma.
2. **Pannello azioni in basso** — il `TabletActionBar` fisso in basso occupa spazio prezioso e nasconde parte della griglia; l'utente preferisce averlo sul lato destro.
3. **Nessun drag touch** — per spostare una vasca su tablet si usa il doppio-tap (poco intuitivo); si vuole poter trascinare con il dito dopo aver toccato "Sposta".
4. **Impossibile deselezionare una vasca su tablet** — su PC si usa ESC, ma su tablet non esiste un equivalente touch per tornare allo stato neutro dopo aver consultato i dati di una vasca.

---

## Fix 1 — Modal scrollabile in landscape

**File:** `src/logitrack_vasche_v2.tsx` (CSS inline, riga ~1887)

**Problema:** `.modal` non ha `max-height` né `overflow-y`, quindi in landscape (viewport height ~768px) un form lungo esce dallo schermo.

**Fix:** aggiungere al selettore `.modal`:
```css
max-height: 90vh;
overflow-y: auto;
```

La `.modal-overlay` usa già `align-items: center` (flex), quindi il modal si tronca correttamente e diventa scrollabile internamente.

---

## Fix 2 — Pannello azioni come sidebar fissa a destra su tablet

**File principale:** `src/logitrack_vasche_v2.tsx` (CSS + JSX render)  
**Componenti:** `SelectionCard.tsx`, `TabletActionBar.tsx`

### Layout attuale (≤1024px)
```css
.content { grid-template-columns: 1fr; }  /* 1 colonna */
```
Il `TabletActionBar` è `position: fixed; bottom: 10px` e mostra i pulsanti azioni.

### Layout target (tablet, ≤1024px)
Ripristinare il layout a 2 colonne mantenendo la sidebar a destra:
```css
@media (max-width: 1024px) {
  .content { grid-template-columns: minmax(0, 1fr) 270px; }
  /* sidebar non più static ma sticky */
  .sidebar { position: sticky; top: 0; max-height: 100vh; overflow-y: auto; }
}
```

Anche la media query `@media (max-width: 1100px)` deve smettere di sovrascrivere `grid-template-columns` (o va rimossa / ristretta a ≤768px).

### `TabletActionBar` — rimosso su tablet ≥768px
La condizione di render in `logitrack_vasche_v2.tsx` (riga ~2489):
```tsx
{isTabletLayout && activeTab === 'grid' && mode === 'view' && selectedArticolo && (
  <TabletActionBar ... />
)}
```
Va limitata solo a `isMobileLayout` (≤768px), poiché su tablet la `SelectionCard` nella sidebar destra gestisce già tutte le azioni.

### `SelectionCard` — nessuna modifica strutturale necessaria
Il componente già mostra tutti i pulsanti (Sposta, Posiziona, Spedisci, Duplica, Modifica, Elimina) e gestisce correttamente il dettaglio espanso/collassato. Su tablet con sidebar visibile la logica `isTabletLayout` può restare ma il toggle expand/collapse diventa meno rilevante.

### Padding app
La regola `@media (max-width: 1024px) { .app { padding-bottom: 120px } }` serve per il bottom bar — va ridotta a 20px quando `isMobileLayout` è falso.

---

## Fix 3 — Drag touch per spostare la vasca (solo tablet, modalità "move")

**File:** `src/logitrack_vasche_v2.tsx`  
**Componenti coinvolti:** rendering delle righe fila, `handleTrackTap`

### Flusso utente (opzione B approvata)
1. Selezione vasca → tocco "Sposta" nel pannello → `mode = 'move'`
2. L'utente appoggia il dito **sulla vasca evidenziata** nella griglia e trascina
3. Durante il drag il ghost si aggiorna in real-time (come su mouse)
4. Al `touchend` la posizione viene confermata automaticamente (`commitMoveArticolo`)

### Implementazione

**a) Aggiungere `onTouchStart`/`onTouchMove`/`onTouchEnd` al blocco vasca selezionato**

Nel render dei blocchi vasca (`ArticoloBlock` in `GridBlocks.tsx`), quando `mode === 'move'` e il blocco è quello selezionato (`articolo.id === selectedArticolo?.id`), aggiungere:

```tsx
onTouchStart={(e) => {
  if (mode !== 'move') return;
  e.preventDefault();
  setIsDraggingTouch(true);
}}
onTouchMove={(e) => {
  if (!isDraggingTouch || mode !== 'move') return;
  e.preventDefault();
  const touch = e.touches[0];
  // trova la fila sotto il dito tramite elementFromPoint
  const el = document.elementFromPoint(touch.clientX, touch.clientY);
  const filaEl = el?.closest('[data-fila]');
  if (!filaEl) return;
  const fila = filaEl.getAttribute('data-fila')!;
  const rect = filaEl.getBoundingClientRect();
  const rawOffset = ((touch.clientX - rect.left) / rect.width) * filaLength;
  handleTrackTap(fila, rawOffset, 'touch-drag');
}}
onTouchEnd={() => {
  if (!isDraggingTouch || !ghostPosition) return;
  setIsDraggingTouch(false);
  const [fila, offset] = ghostPosition.split(':');
  commitMoveArticolo(fila, parseFloat(offset));
}}
```

**b) Nuovo state `isDraggingTouch`**

```tsx
const [isDraggingTouch, setIsDraggingTouch] = useState(false);
```

**c) `data-fila` attribute sulle righe fila**

Ogni elemento di track (`.fila-track` o wrapper) deve esporre `data-fila={fila.nome}` e `data-fila-length={fila.lunghezza}` per permettere il calcolo dell'offset.

**d) Modifica `handleTrackTap`**

Aggiungere il tipo `'touch-drag'` che bypassa il meccanismo stagedPlacement e aggiorna solo il ghost (non commit — il commit avviene nel `touchend`):

```tsx
const handleTrackTap = useCallback((fila, rawOffset, pointerType: 'mouse' | 'touch' | 'touch-drag') => {
  ...
  if (pointerType === 'touch-drag') {
    setGhostPosition(`${fila}:${snappedOffset}`);
    return; // non committa, non staged
  }
  // logica esistente per 'mouse' e 'touch'
  ...
});
```

**e) `GridBlocks.tsx` — passare callback di drag**

`ArticoloBlock` riceve due nuove props opzionali:
- `onTouchDragStart?: () => void`
- `onTouchDragMove?: (e: React.TouchEvent) => void`
- `onTouchDragEnd?: () => void`

Passate solo quando `mode === 'move'` e `articolo.id === selectedArticolo.id`.

---

## Fix 4 — Pulsante "Chiudi selezione" su tablet

**File:** `src/components/logitrack/SelectionCard.tsx` + `src/logitrack_vasche_v2.tsx`

### Problema
Su tablet non c'è tastiera fisica, quindi `Escape` non è disponibile. Una volta selezionata una vasca per consultarne i dati, non esiste un modo touch per tornare allo stato neutro (nessuna vasca selezionata).

Il pulsante "Chiudi" già presente in `renderMovementActionButtons(articolo, compact=true)` (riga ~1600) chiama solo `setSelectedArticolo(null)` ma non resetta `mode`, `ghostPosition` e `stagedPlacement`.

### Fix

**a) Aggiungere prop `onClose` a `SelectionCard`**

```tsx
interface SelectionCardProps {
  ...
  onClose?: () => void;  // nuovo
}
```

**b) Mostrare il pulsante ✕ nella `selection-card-head` quando `isTabletLayout`**

Accanto al toggle expand/collapse, aggiungere:
```tsx
{isTabletLayout && onClose && (
  <button
    className="btn btn-secondary"
    style={{ padding: '6px 10px', minHeight: '32px' }}
    onClick={onClose}
    aria-label="Deseleziona vasca"
  >
    <X size={14} />
  </button>
)}
```

**c) Passare `onClose` dal parent**

In `logitrack_vasche_v2.tsx`, dove viene reso `<SelectionCard>`, passare:
```tsx
onClose={() => {
  setSelectedArticolo(null);
  setMode('view');
  setGhostPosition(null);
  setStagedPlacement(null);
}}
```

**d) Correggere il "Chiudi" esistente nel `TabletActionBar`**

Il pulsante compact in `renderMovementActionButtons` (riga ~1600) va aggiornato con lo stesso reset completo:
```tsx
onClick={() => {
  setSelectedArticolo(null);
  setMode('view');
  setGhostPosition(null);
  setStagedPlacement(null);
}}
```

**Note:** L'icona `X` è già importata da `lucide-react` nel file principale.

---

## Verifica

1. **Modal:** aprire "Crea vasca" su tablet landscape → il form deve scrollare e il pulsante "Crea" deve essere raggiungibile.
2. **Pannello destra:** selezionare una vasca su tablet → il pannello deve apparire nella sidebar destra senza barra in basso.
3. **Drag touch:** selezionare una vasca IN_AREA → toccare "Sposta" → trascinare sulla griglia → rilasciare → la vasca si sposta senza doppio-tap.
4. **Chiudi selezione:** selezionare una vasca in modalità view → toccare ✕ nella testata del pannello → la vasca si deseleziona e la griglia torna neutrale.
5. **Regresso:** verificare che su mobile (≤768px) il `TabletActionBar` in basso funzioni ancora correttamente.
