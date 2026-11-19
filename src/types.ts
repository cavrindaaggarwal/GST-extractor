/**
 * Types representing the structured Indian GST Tax Invoice data extractions and state.
 */

export interface GSTParty {
  name: string | null;
  gstin: string | null;
  state: string | null;
  address: string | null;
}

export interface LineItem {
  description: string | null;
  hsn_sac: string | null;
  qty: number | null;
  unit: string | null;
  rate: number | null;
  taxable_value: number | null;
  gst_rate_percent: number | null;
}

export interface InvoiceTotals {
  taxable_value: number | null;
  cgst: number | null;
  sgst: number | null;
  igst: number | null;
  cess: number | null;
  round_off: number | null;
  grand_total: number | null;
}

export interface GSTInvoiceData {
  invoice_number: string | null;
  invoice_date: string | null; // DD-MM-YYYY
  irn: string | null;
  eway_bill_no: string | null;
  supplier: GSTParty;
  buyer: GSTParty;
  place_of_supply: string | null;
  reverse_charge: "Yes" | "No" | null;
  line_items: LineItem[];
  totals: InvoiceTotals;
  extraction_confidence: "High" | "Medium" | "Low";
  review_flags: string[];
}

export interface GSTValidationResult {
  gstin: string;
  isValid: boolean;
  stateCode: string;
  stateName: string;
  pan: string;
  entityNumber: string;
  checksum: string;
  errors: string[];
}

export interface SampleInvoice {
  id: string;
  title: string;
  subtitle: string;
  description: string;
  imageUrl?: string;
  isCustomUploaded?: boolean;
  rawHtmlMarkdown?: string;
  data: GSTInvoiceData;
}
