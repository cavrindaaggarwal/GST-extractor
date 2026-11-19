import express from "express";
import path from "path";
import dotenv from "dotenv";
import { GoogleGenAI, Type } from "@google/genai";
import { createServer as createViteServer } from "vite";

// Load environment variables
dotenv.config();

// Initialize Express
const app = express();
const PORT = 3000;

// Increase payload limits for base64 invoice images
app.use(express.json({ limit: "15mb" }));
app.use(express.urlencoded({ limit: "15mb", extended: true }));

// Shared Gemini Key check & initialization
let ai: GoogleGenAI | null = null;
try {
  const apiKey = process.env.GEMINI_API_KEY;
  if (apiKey && apiKey !== "MY_GEMINI_API_KEY" && apiKey.trim() !== "") {
    ai = new GoogleGenAI({
      apiKey: apiKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });
    console.log("Successfully initialized GoogleGenAI server client.");
  } else {
    console.warn("GEMINI_API_KEY not found or is placeholder. Server running with audit emulation.");
  }
} catch (error) {
  console.error("Failed to initialize GoogleGenAI:", error);
}

// 1. API: Extract GST Invoice data from image
app.post("/api/extract", async (req, res) => {
  const { image, mimeType = "image/png" } = req.body;

  if (!image) {
    return res.status(400).json({ error: "Missing invoice image base64 data." });
  }

  // Handle case where API KEY is not set yet
  if (!ai) {
    return res.status(503).json({
      error: "Gemini API key is not configured yet. Please configure it in Settings > Secrets.",
      code: "MISSING_API_KEY"
    });
  }

  try {
    // Strip metadata prefixes if present (e.g. data:image/png;base64,)
    let cleanBase64 = image;
    if (image.includes("base64,")) {
      cleanBase64 = image.split("base64,")[1];
    }

    const imagePart = {
      inlineData: {
        mimeType: mimeType,
        data: cleanBase64,
      },
    };

    const promptText = `
      You are a specialised data extraction agent for Indian GST tax invoices.
      Your goal is to parse this invoice image and extract structured data with absolute accuracy.

      RULES:
      1. Extract only what is visibly printed. If a field is missing, return null.
      2. Dates must be converted to DD-MM-YYYY format.
      3. Amounts must be numeric, with no commas and no currency symbols.
      4. Carefully find the supplier and buyer details, including their printed GSTIN, 
         legal or trade name, full state name, and address.
      5. Identify all line items, their description, HSN/SAC code, quantity, unit, unit rate, taxable value (amount before tax), and total applicable GST rate percentage (e.g., if CGST is 9% and SGST is 9%, the total GST rate percentage is 18).
      6. Extract the totals: taxable value, CGST, SGST, IGST, cess, round-off, and grand total exactly as printed.
    `;

    const textPart = {
      text: promptText,
    };

    console.log("Calling Gemini 3.5 Flash for multimodal invoice extraction...");

    // Create schema types for structured output
    const responseSchema = {
      type: Type.OBJECT,
      properties: {
        invoice_number: { type: Type.STRING, description: "Draft format invoice number" },
        invoice_date: { type: Type.STRING, description: "Invoice date in DD-MM-YYYY format" },
        irn: { type: Type.STRING, description: "64-character Invoice Reference Number (IRN) if visible, else null" },
        eway_bill_no: { type: Type.STRING, description: "Printed E-Way bill number if visible, otherwise null" },
        supplier: {
          type: Type.OBJECT,
          properties: {
            name: { type: Type.STRING, description: "Legal name or trade name of supplier" },
            gstin: { type: Type.STRING, description: "15-digit supplier GSTIN" },
            state: { type: Type.STRING, description: "State or Union Territory name" },
            address: { type: Type.STRING, description: "Full address details" }
          },
          required: ["name", "gstin", "state", "address"]
        },
        buyer: {
          type: Type.OBJECT,
          properties: {
            name: { type: Type.STRING, description: "Legal name of buyer/billed-to party" },
            gstin: { type: Type.STRING, description: "15-digit buyer GSTIN" },
            state: { type: Type.STRING, description: "State or Union Territory name" },
            address: { type: Type.STRING, description: "Full address details" }
          },
          required: ["name", "gstin", "state", "address"]
        },
        place_of_supply: { type: Type.STRING, description: "State or Union Territory name where goods/services are delivered" },
        reverse_charge: { type: Type.STRING, description: "Must be 'Yes' or 'No'" },
        line_items: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              description: { type: Type.STRING, description: "Description of goods or services" },
              hsn_sac: { type: Type.STRING, description: "HSN or SAC code" },
              qty: { type: Type.NUMBER, description: "Quantity numeric" },
              unit: { type: Type.STRING, description: "Unit of measurement like Pcs, Box, Nos" },
              rate: { type: Type.NUMBER, description: "Rate per unit" },
              taxable_value: { type: Type.NUMBER, description: "Taxable value of line item" },
              gst_rate_percent: { type: Type.NUMBER, description: "Total GST rate percentage charged on this item" }
            },
            required: ["description", "hsn_sac", "qty", "unit", "rate", "taxable_value", "gst_rate_percent"]
          }
        },
        totals: {
          type: Type.OBJECT,
          properties: {
            taxable_value: { type: Type.NUMBER, description: "Sum of line item taxable amounts before tax" },
            cgst: { type: Type.NUMBER, description: "Total Central CGST charged if applicable" },
            sgst: { type: Type.NUMBER, description: "Total State SGST charged if applicable" },
            igst: { type: Type.NUMBER, description: "Total Integrated IGST charged if applicable" },
            cess: { type: Type.NUMBER, description: "Total Cess charged if applicable" },
            round_off: { type: Type.NUMBER, description: "Rounded off value to get whole grand total" },
            grand_total: { type: Type.NUMBER, description: "Grand total invoice printed amount" }
          },
          required: ["taxable_value", "cgst", "sgst", "igst", "cess", "round_off", "grand_total"]
        },
        extraction_confidence: { type: Type.STRING, description: "Must be High, Medium, or Low" },
        review_flags: { type: Type.ARRAY, items: { type: Type.STRING }, description: "List of warning strings or flags parsed" }
      },
      required: [
        "invoice_number", "invoice_date", "irn", "eway_bill_no", "supplier", "buyer", 
        "place_of_supply", "reverse_charge", "line_items", "totals", "extraction_confidence", "review_flags"
      ]
    };

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: { parts: [imagePart, textPart] },
      config: {
        responseMimeType: "application/json",
        responseSchema: responseSchema,
      },
    });

    const textResult = response.text;
    if (!textResult) {
      throw new Error("Empty response from Gemini.");
    }

    const parsedData = JSON.parse(textResult.trim());
    return res.json(parsedData);

  } catch (error: any) {
    console.error("Error in invoice extraction route:", error);
    return res.status(500).json({ error: error.message || "Failed to process image through Gemini." });
  }
});

// Serve frontend assets
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    // In development, hook Vite middleware
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
    console.log("Vite development middleware integrated.");
  } else {
    // In production, serve compiled static site
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
    console.log("Serving production static files from:", distPath);
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Express custom server running at http://0.0.0.0:${PORT}`);
  });
}

startServer();
