import { SampleInvoice } from "./types";

export const SAMPLE_INVOICES: SampleInvoice[] = [
  {
    id: "sample_01",
    title: "GST-A: Intra-state Goods Invoice",
    subtitle: "Clean intra-state transaction with CGST & SGST",
    description: "Computers and hardware delivery from Bengaluru to Hubli in Karnataka (intra-state transaction). Includes symmetric 9% CGST and 9% SGST with perfect math validations.",
    rawHtmlMarkdown: `### TAX INVOICE
**SUPPLIER:** Tech India Solutions
* Bengaluru, Karnataka
* GSTIN: **29AAAAA1111A1Z1** (State Code 29: Karnataka)

**BUYER:** Future Soft Consulting
* Hubli, Karnataka
* GSTIN: **29BBBBB2222B1Z2** (State Code 29: Karnataka)

* **Invoice No:** TIS/2026/9024
* **Invoice Date:** 12-05-2026
* **Place of Supply:** Karnataka
* **Reverse Charge:** No

| Description | HSN/SAC | Qty | Unit | Unit Rate | Taxable Value | GST Rate | Tax Type |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| Dell Latitude E7470 laptop | 8471 | 2 | Pcs | 50000.00 | 100000.00 | 18% | CGST+SGST |
| Logitech Wireless Mouse | 8471 | 5 | Nos | 1200.00 | 6000.00 | 18% | CGST+SGST |

**Tax Summary:**
* Total Taxable Value: **106000.00**
* CGST (9.00%): **9540.00**
* SGST (9.00%): **9540.00**
* IGST: **0.00**
* Grand Total: **125080.00**`,
    data: {
      invoice_number: "TIS/2026/9024",
      invoice_date: "12-05-2026",
      irn: "235e23d7ebd1ca50d75aee824c82c6114ba7421ab7dc2edfa5473cd5fa0a12ba",
      eway_bill_no: "338920485122",
      supplier: {
        name: "Tech India Solutions",
        gstin: "29AAAAA1111A1Z1",
        state: "Karnataka",
        address: "Industrial Layout, Outer Ring Road, Sector 4, Bengaluru, Karnataka, 560102"
      },
      buyer: {
        name: "Future Soft Consulting",
        gstin: "29BBBBB2222B1Z2",
        state: "Karnataka",
        address: "Suite 410, Cyber Towers, Hubli-Dharwad Bypass road, Hubli, Karnataka, 580030"
      },
      place_of_supply: "Karnataka",
      reverse_charge: "No",
      line_items: [
        {
          description: "Dell Latitude E7470 laptop",
          hsn_sac: "8471",
          qty: 2,
          unit: "Pcs",
          rate: 50000,
          taxable_value: 100000,
          gst_rate_percent: 18
        },
        {
          description: "Logitech Wireless Mouse",
          hsn_sac: "8471",
          qty: 5,
          unit: "Nos",
          rate: 1200,
          taxable_value: 6000,
          gst_rate_percent: 18
        }
      ],
      totals: {
        taxable_value: 106000,
        cgst: 9540,
        sgst: 9540,
        igst: 0,
        cess: 0,
        round_off: 0,
        grand_total: 125080
      },
      extraction_confidence: "High",
      review_flags: []
    }
  },
  {
    id: "sample_02",
    title: "GST-B: Inter-state State Code Mismatch",
    subtitle: "Supplies to different state flagging incorrect tax split",
    description: "Services provided by Mumbai supplier, Maharashtra to Delhi. The printer mistakenly charged CGST + SGST instead of IGST, and has a wrong State Code prefix mismatch in the GSTIN.",
    rawHtmlMarkdown: `### TAX INVOICE
**SUPPLIER:** Creative Pixel Lab
* Mumbai, Maharashtra
* GSTIN: **27CCCCCC1234A1Z5** (State Code 27: Maharashtra)

**BUYER:** Zen Retailers
* Delhi, Delhi
* GSTIN: **07DDDDD5678C1Z8** (State Code 07: Delhi)

* **Invoice No:** CPL-SERV-2026/088
* **Invoice Date:** 18-05-2026
* **Place of Supply:** Delhi
* **Reverse Charge:** No

| Description | HSN/SAC | Qty | Unit | Unit Rate | Taxable Value | GST Rate | Tax Type |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| UI/UX Web Layout Design Consultation | 9983 | 1 | Unit | 75000.00 | 75000.00 | 18% | CGST+SGST (Error!) |

**Tax Summary:**
* Total Taxable Value: **75000.00**
* CGST (9.00%): **6750.00** (Miscalculated Type)
* SGST (9.00%): **6750.00** (Miscalculated Type)
* IGST: **0.00**
* Grand Total: **88500.00**`,
    data: {
      invoice_number: "CPL-SERV-2026/088",
      invoice_date: "18-05-2026",
      irn: null,
      eway_bill_no: null,
      supplier: {
        name: "Creative Pixel Lab",
        gstin: "27CCCCCC1234A1Z5",
        state: "Maharashtra",
        address: "602 Pinnacle Corporate Park, Bandra Kurla Complex, Mumbai, Maharashtra, 400051"
      },
      buyer: {
        name: "Zen Retailers",
        gstin: "07DDDDD5678C1Z8",
        state: "Delhi",
        address: "G-14 Connaught Place, Inner Circle, New Delhi, Delhi, 110001"
      },
      place_of_supply: "Delhi",
      reverse_charge: "No",
      line_items: [
        {
          description: "UI/UX Web Layout Design Consultation",
          hsn_sac: "9983",
          qty: 1,
          unit: "Unit",
          rate: 75000,
          taxable_value: 75000,
          gst_rate_percent: 18
        }
      ],
      totals: {
        taxable_value: 75000,
        cgst: 6750,
        sgst: 6750,
        igst: 0,
        cess: 0,
        round_off: 0,
        grand_total: 88500
      },
      extraction_confidence: "High",
      review_flags: [
        "Tax Mismatch: Transaction determined inter-state (Maharashtra to Delhi), but CGST/SGST (INR 13500) are charged. It should be IGST."
      ]
    }
  },
  {
    id: "sample_03",
    title: "GST-C: Calculation Mismatch",
    subtitle: "Mathematical total mismatch on physical printout",
    description: "An invoice issued in Gujarat where the physical print-out's Grand Total shows 27,800.00 but summing the printed taxable value and GST totals yields 28,000.00. Rule 4 dictates printed total must be kept and variance flagged.",
    rawHtmlMarkdown: `### TAX INVOICE
**SUPPLIER:** Super Plast Industries
* Ahmedabad, Gujarat
* GSTIN: **24EEEEE9999K1Z4** (State Code 24: Gujarat)

**BUYER:** Mega Traders
* Gandhinagar, Gujarat
* GSTIN: **24GGGGG3333M1Z9** (State Code 24: Gujarat)

* **Invoice No:** SPI/PLAS/3044
* **Invoice Date:** 05-21-2026
* **Place of Supply:** Gujarat
* **Reverse Charge:** No

| Description | HSN/SAC | Qty | Unit | Unit Rate | Taxable Value | GST Rate | Tax Type |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| Plastic Heavy Duty Moulds 3mm | 3926 | 100 | Pcs | 250.00 | 25000.00 | 12% | CGST+SGST |

**Tax Summary:**
* Total Taxable Value: **25000.00**
* CGST (6.00%): **1500.00**
* SGST (6.00%): **1500.00**
* IGST: **0.00**
* Printed Grand Total: **27800.00** (Discrepancy: Correct math is 28000.00)`,
    data: {
      invoice_number: "SPI/PLAS/3044",
      invoice_date: "21-05-2026",
      irn: null,
      eway_bill_no: null,
      supplier: {
        name: "Super Plast Industries",
        gstin: "24EEEEE9999K1Z4",
        state: "Gujarat",
        address: "Block G, Vatva GIDC Extension, Ahmedabad, Gujarat, 382440"
      },
      buyer: {
        name: "Mega Traders",
        gstin: "24GGGGG3333M1Z9",
        state: "Gujarat",
        address: "Plot 104, Sector 21 GIDC, Gandhinagar, Gujarat, 382021"
      },
      place_of_supply: "Gujarat",
      reverse_charge: "No",
      line_items: [
        {
          description: "Plastic Heavy Duty Moulds 3mm",
          hsn_sac: "3926",
          qty: 100,
          unit: "Pcs",
          rate: 250,
          taxable_value: 25000,
          gst_rate_percent: 12
        }
      ],
      totals: {
        taxable_value: 25000,
        cgst: 1500,
        sgst: 1500,
        igst: 0,
        cess: 0,
        round_off: 0,
        grand_total: 27800
      },
      extraction_confidence: "Medium",
      review_flags: [
        "Printed Total Variance: Sum of taxable value & taxes (INR 28000.00) disagrees with printed grand total (INR 27800.00). Difference of INR 200.00."
      ]
    }
  }
];
