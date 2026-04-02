export interface ParsedGS1 {
  gtin: string | null;
  expiryDate: string | null;
  batch: string | null;
  serial?: string | null;
}

/**
 * Parser dla kodów GS1 Data Matrix stosowanych w farmacji.
 * Obsługuje Identyfikatory Zastosowania (AI):
 * (01) - GTIN
 * (17) - Data ważności (YYMMDD)
 * (10) - Numer partii (Batch)
 * (21) - Numer seryjny (opcjonalny na niektórych lekach)
 */
export function parseGS1DataMatrix(rawText: string): ParsedGS1 {
  // Czyścimy kod z ewentualnych niewidocznych znaków sterujących (np. FNC1 / ASCII 232)
  // Często czytniki zamieniają je na spacje lub znaki specjalne
  const cleanText = rawText.replace(/[^a-zA-Z0-9]/g, '');

  // Regexy wyciągające dane na podstawie standardowych AI GS1
  // GTIN zawsze ma 14 cyfr
  const gtinMatch = cleanText.match(/01(\d{14})/);
  
  // Data ważności zawsze ma 6 cyfr (YYMMDD)
  const expiryMatch = cleanText.match(/17(\d{6})/);
  
  // Batch (10) i Serial (21) mogą mieć zmienną długość, 
  // w uproszczeniu szukamy ciągu alfanumerycznego po AI
  const batchMatch = cleanText.match(/10([a-zA-Z0-9]{1,20})/);
  const serialMatch = cleanText.match(/21([a-zA-Z0-9]{1,20})/);

  return {
    gtin: gtinMatch ? gtinMatch[1] : null,
    expiryDate: expiryMatch ? formatGS1Date(expiryMatch[1]) : null,
    batch: batchMatch ? batchMatch[1] : null,
    serial: serialMatch ? serialMatch[1] : null,
  };
}

/**
 * Konwertuje format YYMMDD na czytelny YYYY-MM-DD
 */
function formatGS1Date(yyMmDd: string): string {
  const year = "20" + yyMmDd.substring(0, 2);
  const month = yyMmDd.substring(2, 4);
  const day = yyMmDd.substring(4, 6);
  
  // Jeśli dzień to '00', oznacza to koniec miesiąca - ustawiamy 01 dla kompatybilności z typem Date
  const safeDay = day === '00' ? '01' : day;
  
  return `${year}-${month}-${safeDay}`;
}