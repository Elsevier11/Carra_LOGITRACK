const {
  Document, Packer, Paragraph, TextRun, HeadingLevel,
  AlignmentType, LevelFormat, BorderStyle, PageNumber,
  Header, Footer, TableOfContents
} = require('docx');
const fs = require('fs');

const TODAY = new Date().toLocaleDateString('it-IT', { day: '2-digit', month: 'long', year: 'numeric' });

function heading1(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_1,
    spacing: { before: 320, after: 120 },
    children: [new TextRun({ text, font: 'Arial', size: 32, bold: true, color: '1e3a5f' })]
  });
}

function heading2(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 240, after: 80 },
    children: [new TextRun({ text, font: 'Arial', size: 26, bold: true, color: '2e6099' })]
  });
}

function body(text) {
  return new Paragraph({
    spacing: { before: 60, after: 60 },
    children: [new TextRun({ text, font: 'Arial', size: 22 })]
  });
}

function bullet(text, bold_prefix) {
  const children = [];
  if (bold_prefix) {
    children.push(new TextRun({ text: bold_prefix, font: 'Arial', size: 22, bold: true }));
    children.push(new TextRun({ text, font: 'Arial', size: 22 }));
  } else {
    children.push(new TextRun({ text, font: 'Arial', size: 22 }));
  }
  return new Paragraph({
    numbering: { reference: 'bullets', level: 0 },
    spacing: { before: 40, after: 40 },
    children
  });
}

function spacer() {
  return new Paragraph({ spacing: { before: 60, after: 60 }, children: [new TextRun('')] });
}

function note(text) {
  return new Paragraph({
    spacing: { before: 80, after: 80 },
    indent: { left: 720 },
    children: [
      new TextRun({ text: 'Nota: ', font: 'Arial', size: 20, bold: true, italics: true, color: '555555' }),
      new TextRun({ text, font: 'Arial', size: 20, italics: true, color: '555555' })
    ]
  });
}

const doc = new Document({
  numbering: {
    config: [{
      reference: 'bullets',
      levels: [{
        level: 0,
        format: LevelFormat.BULLET,
        text: '•',
        alignment: AlignmentType.LEFT,
        style: { paragraph: { indent: { left: 720, hanging: 360 } } }
      }]
    }]
  },
  styles: {
    default: {
      document: { run: { font: 'Arial', size: 22 } }
    },
    paragraphStyles: [
      {
        id: 'Heading1', name: 'Heading 1', basedOn: 'Normal', next: 'Normal', quickFormat: true,
        run: { size: 32, bold: true, font: 'Arial', color: '1e3a5f' },
        paragraph: { spacing: { before: 320, after: 120 }, outlineLevel: 0 }
      },
      {
        id: 'Heading2', name: 'Heading 2', basedOn: 'Normal', next: 'Normal', quickFormat: true,
        run: { size: 26, bold: true, font: 'Arial', color: '2e6099' },
        paragraph: { spacing: { before: 240, after: 80 }, outlineLevel: 1 }
      }
    ]
  },
  sections: [{
    properties: {
      page: {
        size: { width: 11906, height: 16838 },
        margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 }
      }
    },
    headers: {
      default: new Header({
        children: [new Paragraph({
          border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: '2e6099', space: 1 } },
          spacing: { after: 120 },
          children: [
            new TextRun({ text: 'LogiTrack — Note di rilascio', font: 'Arial', size: 20, color: '2e6099' })
          ]
        })]
      })
    },
    footers: {
      default: new Footer({
        children: [new Paragraph({
          border: { top: { style: BorderStyle.SINGLE, size: 4, color: 'cccccc', space: 1 } },
          alignment: AlignmentType.RIGHT,
          spacing: { before: 120 },
          children: [
            new TextRun({ text: 'Pagina ', font: 'Arial', size: 18, color: '888888' }),
            new TextRun({ children: [PageNumber.CURRENT], font: 'Arial', size: 18, color: '888888' }),
            new TextRun({ text: ' di ', font: 'Arial', size: 18, color: '888888' }),
            new TextRun({ children: [PageNumber.TOTAL_PAGES], font: 'Arial', size: 18, color: '888888' })
          ]
        })]
      })
    },
    children: [
      // Titolo principale
      new Paragraph({
        spacing: { before: 0, after: 80 },
        children: [new TextRun({ text: 'LogiTrack', font: 'Arial', size: 56, bold: true, color: '1e3a5f' })]
      }),
      new Paragraph({
        spacing: { before: 0, after: 60 },
        children: [new TextRun({ text: 'Note di rilascio — Aggiornamento interfaccia', font: 'Arial', size: 30, color: '2e6099' })]
      }),
      new Paragraph({
        spacing: { before: 0, after: 400 },
        children: [new TextRun({ text: TODAY, font: 'Arial', size: 22, color: '888888', italics: true })]
      }),

      // ── 1. CORSIA DI PARCHEGGIO TEMPORANEO ──────────────────────────────
      heading1('1. Corsia di parcheggio temporaneo'),
      body('È stata aggiunta alla planimetria una corsia dedicata al parcheggio temporaneo delle vasche, denominata PARK.'),
      spacer(),
      bullet('La corsia PARK è visivamente separata dalle corsie operative da una linea tratteggiata con l\'etichetta "PARCHEGGIO TEMPORANEO".'),
      bullet('La lunghezza è di 70 m, sufficiente per ospitare più vasche in attesa di collocazione definitiva.'),
      bullet('Le vasche possono essere posizionate, spostate e scaricate dalla corsia PARK esattamente come in qualsiasi altra corsia.'),
      spacer(),

      // ── 2. PANNELLO DI SELEZIONE SU TABLET ──────────────────────────────
      heading1('2. Pannello di selezione su tablet — sempre visibile a destra'),
      body('In precedenza, selezionando una vasca sul tablet, il pannello con i dettagli e i pulsanti di azione scivolava sotto la planimetria, costringendo l\'utente a scorrere la pagina per trovarlo.'),
      spacer(),
      bullet('Il pannello di selezione rimane ora fisso nella colonna destra dello schermo, affiancato alla planimetria senza mai scivolare sotto.'),
      bullet('I pulsanti di azione (Posiziona, Sposta, Scarica, Duplica, Modifica, Elimina) sono sempre raggiungibili senza scorrimento.'),
      spacer(),

      // ── 3. DESELEZIONARE UNA VASCA SU TABLET ────────────────────────────
      heading1('3. Deselezionare una vasca su tablet'),
      body('Su PC la deselezione avviene premendo il tasto ESC; su tablet non esiste una tastiera fisica, quindi non era possibile tornare alla vista normale dopo aver selezionato una vasca.'),
      spacer(),
      bullet('', 'Nuovo pulsante "Chiudi selezione": '),
      new Paragraph({
        numbering: { reference: 'bullets', level: 0 },
        spacing: { before: 40, after: 40 },
        children: [new TextRun({ text: 'nella scheda laterale, in modalità visualizzazione dati, compare ora un pulsante esplicito "Chiudi selezione" che riporta alla vista normale.', font: 'Arial', size: 22 })]
      }),
      bullet('', 'Pulsante "Annulla" in modalità operativa: '),
      new Paragraph({
        numbering: { reference: 'bullets', level: 0 },
        spacing: { before: 40, after: 40 },
        children: [new TextRun({ text: 'quando si è in modalità Posiziona o Sposta, il messaggio "premi ESC per annullare" è stato sostituito con un vero pulsante "Annulla" funzionante.', font: 'Arial', size: 22 })]
      }),
      spacer(),

      // ── 4. SPOSTAMENTO VASCA SU TABLET ──────────────────────────────────
      heading1('4. Spostamento vasca su tablet — drag con il dito'),
      body('Il precedente meccanismo di spostamento (doppio tap: primo tap per l\'anteprima, secondo tap per confermare) risultava poco intuitivo. È stato introdotto un sistema di trascinamento diretto.'),
      spacer(),
      new Paragraph({
        spacing: { before: 60, after: 60 },
        children: [new TextRun({ text: 'Come funziona:', font: 'Arial', size: 22, bold: true })]
      }),
      bullet('Selezionare la vasca da spostare e premere il pulsante Sposta.'),
      bullet('Toccare con il dito la corsia di destinazione: appare immediatamente il "fantasma" della vasca nella posizione indicata.'),
      bullet('Trascinando il dito, il fantasma segue il movimento e mostra in tempo reale dove verrà posizionata la vasca (contorno blu = posizione valida, rosso = non valida).'),
      bullet('Sollevando il dito compare la richiesta di conferma.'),
      bullet('Confermando, la vasca si sposta nella posizione indicata; annullando, il fantasma scompare e si può riprovare.'),
      spacer(),
      note('L\'operazione può essere avviata toccando qualsiasi punto libero della corsia. Non è necessario toccare la vasca stessa.'),
      spacer(),

      // ── 5. AFFIANCAMENTO GUIDATO DA DRAG ────────────────────────────────
      heading1('5. Affiancamento guidato — funziona anche dal drag'),
      body('La funzione di affiancamento guidato (posizionare una vasca a sinistra o a destra di un\'altra già presente) era disponibile solo cliccando direttamente sul blocco della vasca di riferimento. Ora è attivata automaticamente anche nelle seguenti situazioni:'),
      spacer(),
      bullet('Su tablet, quando si trascina il dito e lo si solleva sopra a una vasca già posizionata.'),
      bullet('Su PC, quando si clicca su uno spazio già occupato da un\'altra vasca (invece di ricevere l\'errore "posizione non valida").'),
      spacer(),
      body('In entrambi i casi compare il popup "Affiancamento guidato" con i pulsanti "Affianca a sinistra" e "Affianca a destra". I pulsanti non disponibili per mancanza di spazio risultano disattivati.'),
      spacer(),

      // ── 6. SCHEDA DETTAGLIO (TOOLTIP) ───────────────────────────────────
      heading1('6. Scheda dettaglio vasca — tooltip migliorato'),
      body('Il riquadro informativo che appare passando il cursore del mouse su una vasca è stato ridisegnato.'),
      spacer(),
      bullet('Aspetto più leggero: sfondo bianco con bordo sottile, al posto del precedente pannello scuro.'),
      bullet('Dimensioni ridotte: le informazioni sono presentate in modo più compatto senza perdere leggibilità.'),
      bullet('Posizionamento corretto: il tooltip appare ora vicino alla vasca su cui si trova il cursore (in precedenza restava fisso in un angolo dello schermo).'),
      bullet('Adattamento ai bordi: se la vasca è vicina al bordo dello schermo il tooltip si sposta automaticamente per rimanere visibile.'),
      spacer(),
    ]
  }]
});

Packer.toBuffer(doc).then(buffer => {
  fs.writeFileSync('C:/Dev/CARRA/Note-di-rilascio-LogiTrack.docx', buffer);
  console.log('OK');
});
