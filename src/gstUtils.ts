import { GSTInvoiceData, GSTValidationResult } from "./types";

// Official State code map for Indian GSTIN (first 2 digits)
export const STATE_CODES: { [key: string]: string } = {
  "01": "Jammu & Kashmir",
  "02": "Himachal Pradesh",
  "03": "Punjab",
  "04": "Chandigarh",
  "05": "Uttarakhand",
  "06": "Haryana",
  "07": "Delhi",
  "08": "Rajasthan",
  "09": "Uttar Pradesh",
  "10": "Bihar",
  "11": "Sikkim",
  "12": "Arunachal Pradesh",
  "13": "Nagaland",
  "14": "Manipur",
  "15": "Mizoram",
  "16": "Tripura",
  "17": "Meghalaya",
  "18": "Assam",
  "19": "West Bengal",
  "20": "Jharkhand",
  "21": "Odisha",
  "22": "Chhattisgarh",
  "23": "Madhya Pradesh",
  "24": "Gujarat",
  "26": "Dadra and Nagar Haveli and Daman and Diu",
  "27": "Maharashtra",
  "29": "Karnataka",
  "30": "Goa",
  "31": "Lakshadweep",
  "32": "Kerala",
  "33": "Tamil Nadu",
  "34": "Puducherry",
  "35": "Andaman & Nicobar Islands",
  "36": "Telangana",
  "37": "Andhra Pradesh",
  "38": "Ladakh"
};

/**
 * Validates any Indian GSTIN (15 chars) based on the legal format structure:
 * Chars 1-2: State Code
 * Chars 3-12: PAN (5 letters, 4 digits, 1 letter)
 * Char 13: Entity Code (usually 1-9, A-Z)
 * Char 14: Default char (typically 'Z')
 * Char 15: Checksum digit
 */
export function validateGSTIN(gstin: string | null): GSTValidationResult {
  const code = (gstin || "").trim().toUpperCase();
  const errors: string[] = [];

  const result: GSTValidationResult = {
    gstin: code,
    isValid: false,
    stateCode: "",
    stateName: "Unknown State",
    pan: "",
    entityNumber: "",
    checksum: "",
    errors: []
  };

  if (!code) {
    errors.push("GSTIN is empty or missing.");
    result.errors = errors;
    return result;
  }

  if (code.length !== 15) {
    errors.push(`GSTIN must be exactly 15 characters. Printed length is ${code.length} characters.`);
    result.errors = errors;
    return result;
  }

  // 1. Validate State code
  const stateCode = code.substring(0, 2);
  result.stateCode = stateCode;
  if (!/^\d{2}$/.test(stateCode)) {
    errors.push(`First 2 characters (State Code) must be numeric. Found "${stateCode}".`);
  } else {
    const name = STATE_CODES[stateCode];
    if (name) {
      result.stateName = name;
    } else {
      errors.push(`"${stateCode}" is not a recognized state code under India GST.`);
    }
  }

  // 2. Validate PAN (characters 3 to 12)
  const pan = code.substring(2, 12);
  result.pan = pan;
  if (!/^[A-Z]{5}\d{4}[A-Z]$/.test(pan)) {
    errors.push(`Characters 3-12 must be a valid 10-character Indian PAN format (5 letters + 4 digits + 1 letter). Found "${pan}".`);
  }

  // 3. Validate Entity number (character 13)
  const entityNo = code.substring(12, 13);
  result.entityNumber = entityNo;
  if (!/^[A-Z0-9]$/.test(entityNo)) {
    errors.push(`13th character (Entity Number/No of Registrations) must be alphanumeric. Found "${entityNo}".`);
  }

  // 4. Validate 14th character (usually Z)
  const defaultZ = code.substring(13, 14);
  if (defaultZ !== "Z") {
    errors.push(`14th character should legally be "Z" according to GST formatting. Found "${defaultZ}".`);
  }

  // 5. Validate checksum (15th character)
  const checksum = code.substring(14, 15);
  result.checksum = checksum;
  if (!/^[A-Z0-9]$/.test(checksum)) {
    errors.push(`15th character (Checksum) must be alphanumeric. Found "${checksum}".`);
  }

  result.errors = errors;
  result.isValid = errors.length === 0;
  return result;
}

/**
 * Normalize dates to DD-MM-YYYY format
 */
export function normalizeDate(dateStr: string | null): string | null {
  if (!dateStr) return null;
  const clean = dateStr.trim();
  // If already DD-MM-YYYY
  if (/^\d{2}-\d{2}-\d{4}$/.test(clean)) {
    return clean;
  }
  // If YYYY-MM-DD
  const yyyymmdd = clean.match(/^(\d{4})[-/](\d{2})[-/](\d{2})$/);
  if (yyyymmdd) {
    return `${yyyymmdd[3]}-${yyyymmdd[2]}-${yyyymmdd[1]}`;
  }
  // Try split with slash or dot
  const parts = clean.split(/[-/.\s]+/);
  if (parts.length === 3) {
    // If first part is 4 digits, assume Year-Month-Day
    if (parts[0].length === 4) {
      return `${parts[2].padStart(2, '0')}-${parts[1].padStart(2, '0')}-${parts[0]}`;
    }
    // Assume Day-Month-Year
    return `${parts[0].padStart(2, '0')}-${parts[1].padStart(2, '0')}-${parts[2].padStart(4, '20')}`;
  }
  return clean;
}

/**
 * Thorough GST Rules Auditing Engine matching the requested rules:
 */
export function runGstAuditor(data: GSTInvoiceData): {
  isValid: boolean;
  warnings: string[];
  supplierGstinVal: GSTValidationResult;
  buyerGstinVal: GSTValidationResult;
} {
  const warnings: string[] = [];

  // Rule 2: Validate Supplier & Buyer GSTIN configurations
  const supplierGstinVal = validateGSTIN(data.supplier.gstin);
  const buyerGstinVal = validateGSTIN(data.buyer.gstin);

  if (data.supplier.gstin) {
    if (!supplierGstinVal.isValid) {
      warnings.push(`Supplier GSTIN "${data.supplier.gstin}" is invalid: ${supplierGstinVal.errors[0]}`);
    } else {
      // Check if supplier GSTIN state matches supplier state string
      const matchedState = supplierGstinVal.stateName.toLowerCase();
      const currentSupplierState = (data.supplier.state || "").trim().toLowerCase();
      if (currentSupplierState && !matchedState.includes(currentSupplierState) && !currentSupplierState.includes(matchedState)) {
        warnings.push(`Supplier GSTIN prefix code "${supplierGstinVal.stateCode}" designates "${supplierGstinVal.stateName}", but Supplier state is printed as "${data.supplier.state}".`);
      }
    }
  } else {
    warnings.push("Supplier GSTIN is missing from invoice.");
  }

  if (data.buyer.gstin) {
    if (!buyerGstinVal.isValid) {
      warnings.push(`Buyer GSTIN "${data.buyer.gstin}" is invalid: ${buyerGstinVal.errors[0]}`);
    } else {
      // Check if buyer GSTIN state matches buyer state string
      const matchedState = buyerGstinVal.stateName.toLowerCase();
      const currentBuyerState = (data.buyer.state || "").trim().toLowerCase();
      if (currentBuyerState && !matchedState.includes(currentBuyerState) && !currentBuyerState.includes(matchedState)) {
        warnings.push(`Buyer GSTIN prefix code "${buyerGstinVal.stateCode}" designates "${buyerGstinVal.stateName}", but Billed State is printed as "${data.buyer.state}".`);
      }
    }
  } else {
    warnings.push("Buyer GSTIN is missing or unregistered.");
  }

  // Rule 3: Tax Type determination (Intra vs Inter state)
  const supplierState = (data.supplier.state || "").trim().toLowerCase();
  const placeOfSupply = (data.place_of_supply || data.buyer.state || "").trim().toLowerCase();

  const isIntraState = supplierState && placeOfSupply && (
    supplierState === placeOfSupply || 
    supplierState.includes(placeOfSupply) || 
    placeOfSupply.includes(supplierState) ||
    (data.supplier.gstin && data.buyer.gstin && data.supplier.gstin.substring(0, 2) === data.buyer.gstin.substring(0, 2))
  );

  const cgstVal = Number(data.totals.cgst || 0);
  const sgstVal = Number(data.totals.sgst || 0);
  const igstVal = Number(data.totals.igst || 0);

  if (isIntraState) {
    // Should be CGST + SGST, no IGST
    if (igstVal > 0) {
      warnings.push(`Tax Mismatch: Transaction determined intra-state (${data.supplier.state} to ${data.place_of_supply || data.buyer.state}), but IGST (INR ${igstVal}) is charged. It should be CGST + SGST.`);
    }
    if (cgstVal === 0 && sgstVal === 0 && (data.totals.taxable_value || 0) > 0) {
      warnings.push(`Tax Code Alert: Intra-state transaction but CGST & SGST are printed as 0.`);
    }
    if (Math.abs(cgstVal - sgstVal) > 0.1) {
      warnings.push(`Symmetry Mismatch: CGST (INR ${cgstVal}) and SGST (INR ${sgstVal}) must be identical for intra-state GST.`);
    }
  } else {
    // Should be IGST, no CGST or SGST
    if (cgstVal > 0 || sgstVal > 0) {
      warnings.push(`Tax Mismatch: Transaction determined inter-state (${data.supplier.state} to ${data.place_of_supply || data.buyer.state}), but CGST/SGST (INR ${cgstVal + sgstVal}) are charged. It should be IGST.`);
    }
    if (igstVal === 0 && (data.totals.taxable_value || 0) > 0) {
      warnings.push(`Tax Code Alert: Inter-state transaction but IGST is printed as 0.`);
    }
  }

  // Rule 4: Total check (Check sum of rows taxable value, evaluate total math)
  let calculatedTaxableValue = 0;
  let calculatedCgst = 0;
  let calculatedSgst = 0;
  let calculatedIgst = 0;

  (data.line_items || []).forEach((item) => {
    const qty = Number(item.qty || 0);
    const rate = Number(item.rate || 0);
    const val = Number(item.taxable_value || 0);
    const ratePercent = Number(item.gst_rate_percent || 0);

    // Verify item-level rate * qty
    if (qty > 0 && rate > 0) {
      const multiplication = qty * rate;
      if (Math.abs(multiplication - val) > 1.0) {
        // Line-level variance
        warnings.push(`Line Item Math Error: "${item.description || "Unnamed block"}" Qty (${qty}) * Rate (${rate}) = ${multiplication}, but printed taxable value is ${val}.`);
      }
    }

    calculatedTaxableValue += val;

    // Check individual line items GST values
    if (val > 0 && ratePercent > 0) {
      const calculatedGst = (val * ratePercent) / 100;
      if (isIntraState) {
        calculatedCgst += calculatedGst / 2;
        calculatedSgst += calculatedGst / 2;
      } else {
        calculatedIgst += calculatedGst;
      }
    }
  });

  // Verify aggregated taxable values
  const printedTaxable = Number(data.totals.taxable_value || 0);
  if (Math.abs(calculatedTaxableValue - printedTaxable) > 1.0) {
    warnings.push(`Taxable Value Sum Mismatch: Sum of line items is INR ${calculatedTaxableValue.toFixed(2)}, but printed total taxable value is INR ${printedTaxable.toFixed(2)}.`);
  }

  // Verify grand total math
  const printedGrand = Number(data.totals.grand_total || 0);
  const cess = Number(data.totals.cess || 0);
  const roundOff = Number(data.totals.round_off || 0);

  const calculatedGrandTotal = printedTaxable + cgstVal + sgstVal + igstVal + cess + roundOff;
  if (Math.abs(calculatedGrandTotal - printedGrand) > 1.0) {
    warnings.push(`Printed Total Variance: Sum of taxable value & taxes (INR ${calculatedGrandTotal.toFixed(2)}) disagrees with printed grand total (INR ${printedGrand.toFixed(2)}). Difference of INR ${Math.abs(calculatedGrandTotal - printedGrand).toFixed(2)}.`);
  }

  return {
    isValid: warnings.length === 0,
    warnings,
    supplierGstinVal,
    buyerGstinVal
  };
}
