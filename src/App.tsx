import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
  FileText, 
  Upload, 
  FileJson, 
  CheckCircle, 
  AlertTriangle, 
  Plus, 
  Trash2, 
  Copy, 
  Sparkles, 
  Search, 
  ArrowRight,
  Info,
  Layers,
  Building,
  User,
  Calculator,
  RefreshCw,
  ExternalLink,
  ShieldCheck,
  Globe
} from "lucide-react";
import { SAMPLE_INVOICES } from "./data";
import { STATE_CODES, runGstAuditor, normalizeDate } from "./gstUtils";
import { GSTInvoiceData, LineItem } from "./types";

export default function App() {
  // Current active invoice data
  const [invoiceData, setInvoiceData] = useState<GSTInvoiceData>(SAMPLE_INVOICES[0].data);
  // Source showing if it's sample or uploaded
  const [selectedSampleId, setSelectedSampleId] = useState<string>("sample_01");
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  
  // UI Tabs: 'fields' | 'flags' | 'json'
  const [activeTab, setActiveTab] = useState<"fields" | "flags" | "json">("fields");
  
  // App states
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [apiError, setApiError] = useState<{ message: string; code?: string } | null>(null);
  const [copySuccess, setCopySuccess] = useState<boolean>(false);
  const [downloadSuccess, setDownloadSuccess] = useState<boolean>(false);
  const [dragOver, setDragOver] = useState<boolean>(false);
  
  // Verification Assist Modal states
  const [isVerifyModalOpen, setIsVerifyModalOpen] = useState<boolean>(false);
  const [verifyCopyType, setVerifyCopyType] = useState<string | null>(null);
  
  // Ref for manual file input element
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Auto-auditor state representing computed diagnostics
  const { warnings, supplierGstinVal, buyerGstinVal } = runGstAuditor(invoiceData);

  // Sync sample selection with active invoiceData
  const handleSelectSample = (id: string) => {
    const sample = SAMPLE_INVOICES.find(s => s.id === id);
    if (sample) {
      setInvoiceData(JSON.parse(JSON.stringify(sample.data)));
      setSelectedSampleId(id);
      setUploadedImage(null);
      setApiError(null);
    }
  };

  // Convert uploaded image to base64 and send to backend
  const processImageFile = async (file: File) => {
    const fileName = file.name ? file.name.toLowerCase() : "";
    const isImageExtension = fileName.endsWith(".jpg") || fileName.endsWith(".jpeg") || fileName.endsWith(".png");
    if (!file.type.startsWith("image/") && !isImageExtension) {
      setApiError({ message: "Invalid file type. Please upload an image file (PNG/JPEG)." });
      return;
    }

    setIsLoading(true);
    setApiError(null);
    setSelectedSampleId("custom");

    // Convert file to Base64
    const reader = new FileReader();
    reader.onloadend = async () => {
      const base64String = reader.result as string;
      setUploadedImage(base64String);

      // Map file extension to exact standard MIME type if MIME type is blank or not image/*
      let determinedMimeType = file.type;
      if (!determinedMimeType || !determinedMimeType.startsWith("image/")) {
        determinedMimeType = fileName.endsWith(".png") ? "image/png" : "image/jpeg";
      }

      try {
        const response = await fetch("/api/extract", {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            image: base64String,
            mimeType: determinedMimeType
          })
        });

        if (!response.ok) {
          const errData = await response.json();
          if (errData.code === "MISSING_API_KEY") {
            setApiError({
              message: "Required Gemini API Key not specified in Settings.",
              code: "MISSING_API_KEY"
            });
          } else {
            throw new Error(errData.error || "Failed to extract invoice data.");
          }
          setIsLoading(false);
          return;
        }

        const data: GSTInvoiceData = await response.json();
        
        // Clean and normalize simple date returns 
        if (data.invoice_date) {
          data.invoice_date = normalizeDate(data.invoice_date) || data.invoice_date;
        }

        // Keep raw printed totals, but perform audit checks
        const audited = runGstAuditor(data);
        const mergedFlags = Array.from(new Set([...(data.review_flags || []), ...(audited.warnings || [])]));
        data.review_flags = mergedFlags;

        setInvoiceData(data);
        setActiveTab("fields");
      } catch (err: any) {
        console.error("Extraction error:", err);
        setApiError({ 
          message: err.message || "An error occurred during multimodal Gemini invoice extraction. Please verify your internet connection or try loading a sample invoice below." 
        });
      } finally {
        setIsLoading(false);
      }
    };
    reader.onerror = () => {
      setApiError({ message: "Failed to read file." });
      setIsLoading(false);
    };
    reader.readAsDataURL(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = () => {
    setDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processImageFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      processImageFile(e.target.files[0]);
    }
  };

  // Helper code to copy generated JSON strictly
  const handleCopyJson = () => {
    const rawResultJson = {
      ...invoiceData,
      review_flags: Array.from(new Set([...(invoiceData.review_flags || []), ...warnings]))
    };
    navigator.clipboard.writeText(JSON.stringify(rawResultJson, null, 2));
    setCopySuccess(true);
    setTimeout(() => setCopySuccess(false), 2000);
  };

  const handleDownloadJson = () => {
    const rawResultJson = {
      ...invoiceData,
      review_flags: Array.from(new Set([...(invoiceData.review_flags || []), ...warnings]))
    };
    const jsonString = JSON.stringify(rawResultJson, null, 2);
    
    // Create blob & anchor element to trigger browser file download
    const blob = new Blob([jsonString], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `gst_invoice_${invoiceData.invoice_number ? invoiceData.invoice_number.replace(/[^a-zA-Z0-9]/g, "_") : "extracted"}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    
    setDownloadSuccess(true);
    setTimeout(() => setDownloadSuccess(false), 2500);
  };

  // State modification handlers for the Interactive form
  const handleUpdateField = (path: string[], value: any) => {
    setInvoiceData(prev => {
      const copy = JSON.parse(JSON.stringify(prev));
      let current = copy;
      for (let i = 0; i < path.length - 1; i++) {
        current = current[path[i]];
      }
      current[path[path.length - 1]] = value;
      return copy;
    });
  };

  const handleLineItemChange = (index: number, field: keyof LineItem, value: any) => {
    setInvoiceData(prev => {
      const copy = JSON.parse(JSON.stringify(prev));
      const item = copy.line_items[index];
      if (item) {
        // Cast or convert types correctly
        if (field === "qty" || field === "rate" || field === "taxable_value" || field === "gst_rate_percent") {
          item[field] = value === "" ? null : Number(value);
          // If qty and rate configured, auto-calc taxable value as helpful helper, but keep it editable!
          if (field === "qty" || field === "rate") {
            const q = field === "qty" ? Number(value) : Number(item.qty || 0);
            const r = field === "rate" ? Number(value) : Number(item.rate || 0);
            item.taxable_value = q * r;
          }
        } else {
          item[field] = value;
        }
      }
      return copy;
    });
  };

  const handleAddLineItem = () => {
    setInvoiceData(prev => ({
      ...prev,
      line_items: [
        ...prev.line_items,
        { description: "New Item Service/Good", hsn_sac: "", qty: 1, unit: "Nos", rate: 0, taxable_value: 0, gst_rate_percent: 18 }
      ]
    }));
  };

  const handleRemoveLineItem = (index: number) => {
    setInvoiceData(prev => {
      const line_items = prev.line_items.filter((_, idx) => idx !== index);
      return { ...prev, line_items };
    });
  };

  // Quick total calculations to let user optionally auto-fill
  const handleRecalculateTotals = () => {
    let sumTaxable = 0;
    let sumCgst = 0;
    let sumSgst = 0;
    let sumIgst = 0;

    // Check same vs cross-state of current inputs
    const supplierState = (invoiceData.supplier.state || "").trim().toLowerCase();
    const posState = (invoiceData.place_of_supply || invoiceData.buyer.state || "").trim().toLowerCase();
    const isLocal = supplierState === posState || supplierState.includes(posState) || posState.includes(supplierState);

    (invoiceData.line_items || []).forEach(item => {
      const taxVal = Number(item.taxable_value || 0);
      const rate = Number(item.gst_rate_percent || 0);
      sumTaxable += taxVal;
      const calculatedGst = (taxVal * rate) / 100;
      if (isLocal) {
        sumCgst += calculatedGst / 2;
        sumSgst += calculatedGst / 2;
      } else {
        sumIgst += calculatedGst;
      }
    });

    setInvoiceData(prev => ({
      ...prev,
      totals: {
        ...prev.totals,
        taxable_value: Number(sumTaxable.toFixed(2)),
        cgst: Number(sumCgst.toFixed(2)),
        sgst: Number(sumSgst.toFixed(2)),
        igst: Number(sumIgst.toFixed(2)),
        grand_total: Number((sumTaxable + sumCgst + sumSgst + sumIgst + Number(prev.totals.cess || 0) + Number(prev.totals.round_off || 0)).toFixed(2))
      }
    }));
  };

  // Render the original printed visual look of active selection
  const activeSample = SAMPLE_INVOICES.find(s => s.id === selectedSampleId);

  const [isConfirmed, setIsConfirmed] = useState<boolean>(false);

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-800 font-sans flex flex-col selection:bg-blue-100 selection:text-blue-900 overflow-x-hidden">
      
      {/* Top Navigation Bar */}
      <header className="h-14 bg-white border-b border-slate-200 flex items-center justify-between px-6 shrink-0 shadow-sm sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-blue-600 rounded flex items-center justify-center">
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 20 0 01-2-2V5a2 20 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 20 0 01-2 2z"></path>
            </svg>
          </div>
          <h1 className="text-lg font-bold tracking-tight text-slate-900">
            GST Agent <span className="text-slate-400 font-normal">v2.4</span>
          </h1>
          <div className="hidden sm:flex items-center gap-2 px-3 py-1 bg-emerald-50 text-emerald-700 rounded-full border border-emerald-100 text-xs font-semibold uppercase tracking-wider">
            <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
            <span>Active Extraction</span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button 
            type="button"
            onClick={() => setIsVerifyModalOpen(true)}
            className="text-xs font-medium text-slate-600 hover:text-blue-600 border border-slate-200 bg-slate-50 hover:bg-slate-100 px-3.5 py-1.5 rounded flex items-center gap-1.5 transition-all cursor-pointer shadow-xs"
          >
            <Globe className="h-3.5 w-3.5" />
            <span className="hidden md:inline">Verify on GST Portal</span>
            <ExternalLink className="h-3 w-3" />
          </button>
          <button 
            type="button"
            onClick={handleDownloadJson}
            className="px-4 py-1.5 bg-blue-600 text-white rounded font-medium text-sm hover:bg-blue-700 transition-colors cursor-pointer shadow-sm"
          >
            {downloadSuccess ? "Downloaded!" : "Download JSON"}
          </button>
        </div>
      </header>

      {/* Main Workspace */}
      <main className="flex flex-1 flex-col lg:flex-row overflow-hidden lg:h-[calc(100vh-3.5rem)]">
        
        {/* Left: Source Document Viewer */}
        <section className="w-full lg:w-[55%] lg:border-r border-slate-200 bg-slate-100 p-4 sm:p-6 flex flex-col overflow-y-auto gap-5">
          
          {/* Diagnostic status cards */}
          <div className="bg-white rounded border border-slate-200 p-4 shadow-sm">
            <h2 className="text-xs font-bold text-slate-550 uppercase tracking-widest mb-3 flex items-center gap-1.5">
              <span>Input Invoice Source</span>
            </h2>

            {/* Custom file dropzone */}
            <div 
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded p-5 text-center cursor-pointer transition-all flex flex-col items-center justify-center group ${
                dragOver 
                  ? "border-blue-500 bg-blue-50/50" 
                  : "border-slate-300 hover:border-blue-400 hover:bg-slate-50/50"
              }`}
            >
              <input 
                type="file" 
                ref={fileInputRef}
                onChange={handleFileInputChange}
                accept=".jpg, .jpeg, .png, image/png, image/jpeg"
                className="hidden"
              />
              <div className="bg-slate-100 text-slate-600 p-2 rounded mb-2 group-hover:bg-blue-50 group-hover:text-blue-600 transition-colors">
                <Upload className="h-4 w-4" />
              </div>
              <p className="text-xs font-semibold text-slate-700">Drag & drop invoice image</p>
              <p className="text-[11px] text-slate-400 mt-0.5">Supports PNG, JPG, JPEG up to 10MB</p>
              <button 
                type="button" 
                className="mt-2 text-[11px] bg-white border border-slate-200 hover:border-blue-200 hover:text-blue-600 px-2.5 py-1 rounded shadow-xs transition-colors font-semibold text-slate-600"
              >
                Choose Local File
              </button>
            </div>

            {/* Custom Key Notice */}
            {apiError && (
              <div className="mt-3 p-3 bg-rose-50 border border-rose-100 rounded flex items-start gap-2 text-rose-800 text-xs">
                <AlertTriangle className="h-4 w-4 text-rose-500 shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-rose-900">{apiError.message}</p>
                  {apiError.code === "MISSING_API_KEY" ? (
                    <p className="mt-1 text-rose-700 leading-relaxed text-[11px]">
                      AI Studio has not injected your Gemini API key. Go to <strong>Settings &gt; Secrets</strong> to add <code>GEMINI_API_KEY</code>. You can fully test all validation rules by selecting the preloaded samples below!
                    </p>
                  ) : (
                    <p className="mt-1 text-rose-700 leading-relaxed text-[11px]">Please try an image upload or try one of our specialized testing situations below.</p>
                  )}
                </div>
              </div>
            )}

            {/* Selector for samples */}
            <div className="mt-4">
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">Or test predefined GST situations:</p>
              <div className="flex flex-col gap-1.5">
                {SAMPLE_INVOICES.map((sample) => (
                  <button
                    key={sample.id}
                    onClick={() => handleSelectSample(sample.id)}
                    className={`text-left p-2.5 rounded border text-xs transition-all flex items-start justify-between gap-3 cursor-pointer ${
                      selectedSampleId === sample.id 
                        ? "border-blue-600 bg-blue-50/20 shadow-xs" 
                        : "border-slate-200 hover:border-slate-300 hover:bg-slate-50/60"
                    }`}
                  >
                    <div className="flex items-start gap-2">
                      <div className={`mt-0.5 p-1 rounded ${
                        sample.id === "sample_01" 
                          ? "bg-emerald-50 text-emerald-600" 
                          : sample.id === "sample_02" 
                            ? "bg-amber-50 text-amber-600" 
                            : "bg-rose-50 text-rose-600"
                      }`}>
                        <FileText className="h-3.5 w-3.5" />
                      </div>
                      <div>
                        <p className="font-semibold text-slate-800">{sample.title}</p>
                        <p className="text-[11px] text-slate-500 mt-0.5">{sample.subtitle}</p>
                        <p className="text-[10px] text-slate-400 italic mt-0.5 line-clamp-1">{sample.description}</p>
                      </div>
                    </div>
                    {selectedSampleId === sample.id && (
                      <span className="h-1.5 w-1.5 rounded-full bg-blue-600 shrink-0 mt-2"></span>
                    )}
                  </button>
                ))}
              </div>
            </div>

          </div>

          {/* Visual Invoice Paper Representation */}
          <div className="flex flex-col flex-1 gap-2.5">
            <div className="flex justify-between items-center bg-slate-150 rounded py-1 px-1">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-widest">
                Source Document: {selectedSampleId === "custom" ? "uploaded_invoice.jpg" : `invoice_${invoiceData.invoice_number || "TS442"}.pdf`}
              </span>
              <div className="flex gap-1.5">
                <button type="button" className="p-1.5 bg-white border border-slate-200 rounded shadow-xs text-slate-600 hover:bg-slate-50 transition-colors cursor-pointer">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7"></path>
                  </svg>
                </button>
                <button type="button" className="p-1.5 bg-white border border-slate-200 rounded shadow-xs text-slate-600 hover:bg-slate-50 transition-colors cursor-pointer">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4"></path>
                  </svg>
                </button>
              </div>
            </div>

            <div className="bg-white shadow-xl border border-slate-350 rounded overflow-hidden p-6 sm:p-9 flex flex-col flex-1 overflow-y-auto max-h-[580px]">
              {selectedSampleId === "custom" && uploadedImage ? (
                <div className="flex flex-col items-center justify-center py-8">
                  <p className="font-semibold text-slate-700 mb-3 text-center">Uploaded Invoice Document</p>
                  <img 
                    src={uploadedImage} 
                    alt="Uploaded user invoice" 
                    className="max-h-80 max-w-full rounded-lg shadow-sm border border-slate-200 object-contain bg-white"
                  />
                  <div className="mt-4 p-3 bg-indigo-50 border border-indigo-100 text-indigo-800 rounded-lg text-center max-w-xs">
                    <p className="text-[11px] font-semibold flex items-center justify-center gap-1">
                      <Sparkles className="h-3.5 w-3.5" />
                      Extracted via Multimodal AI
                    </p>
                    <p className="text-[10px] text-indigo-600 mt-1">Review the AI populated fields in the right-side tabs to make any custom adjustments manually.</p>
                  </div>
                </div>
              ) : activeSample?.rawHtmlMarkdown ? (
                <div className="bg-white font-sans relative">
                  {/* Decorative stamp */}
                  {selectedSampleId !== "sample_01" && (
                    <div className="absolute right-4 top-12 border border-dashed border-rose-500/60 text-rose-500/60 font-mono rotate-12 px-2.5 py-0.5 text-[9px] font-bold tracking-widest uppercase rounded">
                      Compliance Warning
                    </div>
                  )}

                  {/* Header */}
                  <div className="flex justify-between border-b-2 border-slate-900 pb-5 mb-6">
                    <div>
                      <h2 className="font-black text-xl text-slate-900 tracking-tight uppercase leading-none">{activeSample.data.supplier.name}</h2>
                      <div className="mt-2 text-slate-500 space-y-0.5 text-[11px]">
                        <p>{activeSample.data.supplier.address?.split(',')[0]}... ({activeSample.data.supplier.state})</p>
                        <p className="font-mono text-[10px] font-bold">GSTIN: <span className="text-blue-600">{activeSample.data.supplier.gstin}</span></p>
                      </div>
                    </div>
                    <div className="text-right">
                      <h3 className="text-2xl font-light text-slate-400 uppercase tracking-tighter">Tax Invoice</h3>
                      <p className="text-xs font-bold mt-2 text-slate-800">INV NO: {activeSample.data.invoice_number}</p>
                      <p className="text-[11px] text-slate-500">DATE: {activeSample.data.invoice_date}</p>
                    </div>
                  </div>

                  {/* Billed To */}
                  <div className="grid grid-cols-2 gap-4 border-b pb-5 mb-5">
                    <div>
                      <p className="text-[10px] uppercase font-bold text-slate-400 mb-1">Bill To:</p>
                      <p className="text-xs font-bold text-slate-900">{activeSample.data.buyer.name}</p>
                      <p className="text-xs text-slate-500">{activeSample.data.buyer.address?.split(',')[0]}... ({activeSample.data.buyer.state})</p>
                      <p className="text-[10px] font-mono font-semibold text-slate-800 mt-1 italic underline decoration-blue-500/20">GSTIN: {activeSample.data.buyer.gstin}</p>
                    </div>
                    <div className="bg-slate-50 p-2.5 rounded border border-slate-100">
                      <p className="text-[10px] uppercase font-bold text-slate-400">Place of Supply:</p>
                      <p className="text-xs font-bold text-slate-850 uppercase">{activeSample.data.place_of_supply || "State"}</p>
                      <p className="text-[10px] text-slate-500 mt-1.5 font-medium">
                        {(activeSample.data.supplier.state || "").toLowerCase() === (activeSample.data.place_of_supply || "").toLowerCase() ? "CGST + SGST (Intra-State Supply)" : "IGST Applicable (Inter-State Supply)"}
                      </p>
                    </div>
                  </div>

                  {/* Items Table */}
                  <div className="border-b mb-5 overflow-hidden">
                    <table className="w-full text-left text-[11px] mb-4">
                      <thead className="border-y border-slate-200 bg-slate-50/80">
                        <tr className="text-slate-600 h-7 font-bold">
                          <th className="py-1 px-1">Description</th>
                          <th className="py-1">HSN</th>
                          <th className="py-1 text-center">Qty</th>
                          <th className="py-1 text-right">Rate</th>
                          <th className="py-1 text-right pr-1">Amount</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {activeSample.data.line_items.map((item, idx) => (
                          <tr key={idx} className="h-9">
                            <td className="py-2 px-1 font-medium text-slate-900 max-w-[12rem] truncate">
                              {item.description}
                            </td>
                            <td className="py-2 font-mono text-slate-500">{item.hsn_sac || "—"}</td>
                            <td className="py-2 text-center">{item.qty} {item.unit || "Nos"}</td>
                            <td className="py-2 text-right font-mono">{(item.rate || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                            <td className="py-2 text-right font-mono font-semibold text-slate-900 pr-1">{(item.taxable_value || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Totals Section */}
                  <div className="flex">
                    <div className="w-1/2 pr-3 self-end">
                      <div className="border border-slate-205 rounded p-2 bg-slate-50 font-mono text-[9px] text-slate-500 leading-normal">
                        <strong>Compliance Note:</strong> Calculated in conformance with the state code laws of the Central GST Act.
                      </div>
                    </div>
                    <div className="w-1/2 space-y-1 text-right text-[11px] border-l pl-3 border-slate-100">
                      <div className="flex justify-between border-b border-slate-100 pb-1">
                        <span className="text-slate-500">Taxable Value:</span>
                        <span className="font-mono font-semibold text-slate-900">{(activeSample.data.totals.taxable_value || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                      </div>
                      
                      {activeSample.data.totals.cgst! > 0 && (
                        <div className="flex justify-between text-slate-500 border-b border-slate-100 pb-1">
                          <span>Central CGST:</span>
                          <span className="font-mono">{(activeSample.data.totals.cgst || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                        </div>
                      )}
                      {activeSample.data.totals.sgst! > 0 && (
                        <div className="flex justify-between text-slate-500 border-b border-slate-100 pb-1">
                          <span>State SGST:</span>
                          <span className="font-mono">{(activeSample.data.totals.sgst || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                        </div>
                      )}
                      {activeSample.data.totals.igst! > 0 && (
                        <div className="flex justify-between text-blue-600 border-b border-slate-100 pb-1 font-semibold">
                          <span>IGST:</span>
                          <span className="font-mono">{(activeSample.data.totals.igst || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                        </div>
                      )}
                      
                      <div className="flex justify-between font-black border-t border-slate-900 pt-2 text-xs text-slate-950">
                        <span>TOTAL:</span>
                        <span className="font-mono">{(activeSample.data.totals.grand_total || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                      </div>
                    </div>
                  </div>

                </div>
              ) : (
                <div className="text-center py-20 text-slate-400">
                  <FileText className="h-10 w-10 mx-auto opacity-40 mb-3" />
                  <p>Upload an invoice or click a sample card above to visualize the physical document.</p>
                </div>
              )}
            </div>
            
            <div className="bg-slate-50 px-4 py-2.5 rounded text-[10px] text-slate-500 text-center flex items-center justify-center gap-1 font-mono">
              <Info className="h-3 w-3 shrink-0" />
              <span>SYSTEM MATCHES COORDINATE EXTRACTIONS TO INDIAN CGST RULES.</span>
            </div>
          </div>

        </section>

        {/* Right: Metadata Workspace (Parser Editor, Auditor Checks, Raw JSON) */}
        <section className="w-full lg:w-[45%] flex flex-col bg-white overflow-hidden lg:h-[calc(100vh-3.5rem)] relative">
          
          {/* Tab Selector Header */}
          <div className="border-b border-slate-200 bg-slate-50 p-3 pb-0 flex flex-col md:flex-row md:items-center justify-between gap-3 shrink-0">
            
            <div className="flex items-center gap-1 select-none">
              <button
                onClick={() => setActiveTab("fields")}
                className={`px-3 py-2.5 text-xs font-bold border-b-2 flex items-center gap-1.5 transition-all cursor-pointer ${
                  activeTab === "fields" 
                    ? "border-blue-600 text-blue-600 bg-white md:rounded-t border-x md:border-slate-200" 
                    : "border-transparent text-slate-500 hover:text-slate-800"
                }`}
              >
                <Layers className="h-3.5 w-3.5" />
                <span>Parser Editor</span>
              </button>

              <button
                onClick={() => setActiveTab("flags")}
                className={`px-3 py-2.5 text-xs font-bold border-b-2 flex items-center gap-1.5 relative transition-all cursor-pointer ${
                  activeTab === "flags" 
                    ? "border-blue-600 text-blue-600 bg-white md:rounded-t border-x md:border-slate-200" 
                    : "border-transparent text-slate-500 hover:text-slate-800"
                }`}
              >
                <AlertTriangle className="h-3.5 w-3.5" />
                <span>Auditor Checks</span>
                {warnings.length > 0 && (
                  <span className="bg-rose-500 text-white font-mono font-bold text-[9px] rounded h-3.5 min-w-[14px] flex items-center justify-center px-1 shrink-0">
                    {warnings.length}
                  </span>
                )}
                {warnings.length === 0 && (
                  <CheckCircle className="h-3 w-3 text-emerald-500 shrink-0" />
                )}
              </button>

              <button
                onClick={() => setActiveTab("json")}
                className={`px-3 py-2.5 text-xs font-bold border-b-2 flex items-center gap-1.5 transition-all cursor-pointer ${
                  activeTab === "json" 
                    ? "border-blue-600 text-blue-600 bg-white md:rounded-t border-x md:border-slate-200" 
                    : "border-transparent text-slate-500 hover:text-slate-800"
                }`}
              >
                <FileJson className="h-3.5 w-3.5" />
                <span>Strict JSON</span>
              </button>
            </div>

            <div className="flex items-center gap-2 pb-2.5 md:pb-0">
              <div className="flex items-center gap-1 bg-blue-50 text-blue-800 px-2 py-0.5 rounded border border-blue-100">
                <span className="text-[9px] font-bold text-blue-550 uppercase">Confidence:</span>
                <span className={`text-[10px] font-extrabold px-1 py-0.2 rounded ${
                  invoiceData.extraction_confidence === "High" 
                    ? "bg-emerald-100 text-emerald-800" 
                    : invoiceData.extraction_confidence === "Medium"
                      ? "bg-amber-100 text-amber-800" 
                      : "bg-rose-100 text-rose-800"
                }`}>
                  {invoiceData.extraction_confidence || "High"}
                </span>
              </div>
            </div>

          </div>

          {/* Extraction Loader */}
          {isLoading && (
            <div className="bg-white/95 backdrop-blur-xs flex-1 flex flex-col items-center justify-center p-12 text-center absolute inset-0 z-40">
              <motion.div 
                animate={{ rotate: 360 }}
                transition={{ repeat: Infinity, duration: 1.5, ease: "linear" }}
                className="text-blue-600 mb-4"
              >
                <RefreshCw className="h-8 w-8" />
              </motion.div>
              <h3 className="text-sm font-bold text-slate-800">Gemini Parsing In Progress...</h3>
              <p className="text-[11px] text-slate-400 mt-1 max-w-xs leading-normal">Applying Indian GST formatting models, validating checksum arrays, and organizing nested tables.</p>
            </div>
          )}

          {/* Active Tab Area */}
          <div className="p-4 sm:p-6 flex-1 overflow-y-auto max-h-[700px] bg-white">
            
            <AnimatePresence mode="wait">
              
              {/* TAB 1: PARSER EDITOR */}
              {activeTab === "fields" && (
                <motion.div
                  key="fields"
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -5 }}
                  className="space-y-5"
                >
                  
                  {/* Master Header Block */}
                  <div>
                    <h3 className="text-[11px] font-bold uppercase tracking-widest text-slate-450 text-slate-400 mb-3 flex items-center gap-1.5">
                      <span>1. Invoice Metadata</span>
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <div>
                        <label className="block text-[10px] uppercase font-bold text-slate-400 tracking-wider mb-1">Invoice Number</label>
                        <input 
                          type="text" 
                          value={invoiceData.invoice_number || ""} 
                          onChange={(e) => handleUpdateField(["invoice_number"], e.target.value)}
                          className="w-full text-xs font-mono border border-slate-200 focus:border-blue-600 bg-slate-50/50 px-2.5 py-1.5 rounded focus:outline-hidden text-slate-900"
                          placeholder="e.g. TIS/2026/01"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] uppercase font-bold text-slate-400 tracking-wider mb-1">Date (DD-MM-YYYY)</label>
                        <input 
                          type="text" 
                          value={invoiceData.invoice_date || ""} 
                          onChange={(e) => handleUpdateField(["invoice_date"], e.target.value)}
                          className="w-full text-xs font-mono border border-slate-200 focus:border-blue-600 bg-slate-50/50 px-2.5 py-1.5 rounded focus:outline-hidden text-slate-900"
                          placeholder="DD-MM-YYYY"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] uppercase font-bold text-slate-400 tracking-wider mb-1">E-Way Bill Number</label>
                        <input 
                          type="text" 
                          value={invoiceData.eway_bill_no || ""} 
                          onChange={(e) => handleUpdateField(["eway_bill_no"], e.target.value)}
                          className="w-full text-xs font-mono border border-slate-200 focus:border-blue-600 bg-slate-50/50 px-2.5 py-1.5 rounded focus:outline-hidden text-slate-900"
                          placeholder="Optional"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
                      <div>
                        <label className="block text-[10px] uppercase font-bold text-slate-400 tracking-wider mb-1">64-char IRN String</label>
                        <input 
                          type="text" 
                          value={invoiceData.irn || ""} 
                          onChange={(e) => handleUpdateField(["irn"], e.target.value)}
                          className="w-full text-xs font-mono border border-slate-200 focus:border-blue-600 bg-slate-50/50 px-2.5 py-1.5 rounded focus:outline-hidden text-slate-900"
                          placeholder="Optional IRN identifier"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] uppercase font-bold text-slate-400 tracking-wider mb-1">Place of Supply State</label>
                        <input 
                          type="text" 
                          value={invoiceData.place_of_supply || ""} 
                          onChange={(e) => handleUpdateField(["place_of_supply"], e.target.value)}
                          className="w-full text-xs border border-slate-200 focus:border-blue-600 bg-slate-50/50 px-2.5 py-1.5 rounded focus:outline-hidden font-bold text-slate-800"
                          placeholder="State name"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Supplier & Buyer block */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
                    
                    {/* Supplier */}
                    <div className="border border-slate-200 rounded p-4 bg-slate-50/40 relative">
                      <div className="absolute top-4 right-4 text-slate-400">
                        <Building className="h-3.5 w-3.5" />
                      </div>
                      <h4 className="text-[10px] font-bold text-slate-900 uppercase tracking-widest flex items-center gap-1.5 mb-3">
                        <span className="h-1.5 w-1.5 rounded-full bg-blue-600"></span>
                        <span>Supplier details</span>
                      </h4>
 
                      <div className="space-y-2.5">
                        <div>
                          <label className="text-[9px] uppercase font-bold text-slate-400 tracking-wider block mb-0.5">Supplier Name</label>
                          <input 
                            type="text" 
                            value={invoiceData.supplier.name || ""} 
                            onChange={(e) => handleUpdateField(["supplier", "name"], e.target.value)}
                            className="w-full text-xs border border-slate-200 bg-white px-2.5 py-1.5 rounded focus:outline-hidden font-semibold text-slate-800 focus:border-blue-600"
                          />
                        </div>
                        <div>
                          <label className="text-[9px] uppercase font-bold text-slate-400 tracking-wider block mb-0.5">Supplier GSTIN (15 chars)</label>
                          <input 
                            type="text" 
                            value={invoiceData.supplier.gstin || ""} 
                            onChange={(e) => handleUpdateField(["supplier", "gstin"], e.target.value.toUpperCase())}
                            className={`w-full text-xs font-mono border px-2.5 py-1.5 rounded focus:outline-hidden ${
                              supplierGstinVal.isValid 
                                ? "border-slate-200 focus:border-blue-600 text-blue-700 font-semibold" 
                                : "border-rose-300 focus:border-rose-500 bg-rose-50/20 text-rose-800 font-semibold"
                            }`}
                          />
                          {!supplierGstinVal.isValid && invoiceData.supplier.gstin && (
                            <span className="text-[9px] text-rose-600 mt-1 block">✕ Format Error: {supplierGstinVal.errors[0]}</span>
                          )}
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="text-[9px] uppercase font-bold text-slate-400 tracking-wider block mb-0.5">Supplier State</label>
                            <input 
                              type="text" 
                              value={invoiceData.supplier.state || ""} 
                              onChange={(e) => handleUpdateField(["supplier", "state"], e.target.value)}
                              className="w-full text-xs border border-slate-200 bg-white px-2.5 py-1.5 rounded focus:outline-hidden font-semibold text-slate-800 focus:border-blue-600"
                            />
                          </div>
                          <div>
                            <label className="text-[9px] uppercase font-bold text-slate-400 tracking-wider block mb-0.5">Reverse Charge</label>
                            <select
                              value={invoiceData.reverse_charge || "No"}
                              onChange={(e) => handleUpdateField(["reverse_charge"], e.target.value)}
                              className="w-full text-xs border border-slate-200 bg-white px-2 py-1.5 rounded focus:outline-hidden font-semibold text-slate-800 focus:border-blue-600"
                            >
                              <option value="No">No</option>
                              <option value="Yes">Yes</option>
                            </select>
                          </div>
                        </div>
                        <div>
                          <label className="text-[9px] uppercase font-bold text-slate-400 tracking-wider block mb-0.5">Address</label>
                          <textarea 
                            value={invoiceData.supplier.address || ""} 
                            onChange={(e) => handleUpdateField(["supplier", "address"], e.target.value)}
                            rows={2}
                            className="w-full text-xs border border-slate-200 bg-white px-2.5 py-1.5 rounded focus:outline-hidden text-slate-600 focus:border-blue-600"
                          />
                        </div>
                      </div>
                    </div>
 
                    {/* Buyer */}
                    <div className="border border-slate-200 rounded p-4 bg-slate-50/40 relative">
                      <div className="absolute top-4 right-4 text-slate-400">
                        <User className="h-3.5 w-3.5" />
                      </div>
                      <h4 className="text-[10px] font-bold text-slate-900 uppercase tracking-widest flex items-center gap-1.5 mb-3">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-600"></span>
                        <span>Buyer details (Bill To)</span>
                      </h4>

                      <div className="space-y-2.5">
                        <div>
                          <label className="text-[9px] uppercase font-bold text-slate-400 tracking-wider block mb-0.5">Buyer Name</label>
                          <input 
                            type="text" 
                            value={invoiceData.buyer.name || ""} 
                            onChange={(e) => handleUpdateField(["buyer", "name"], e.target.value)}
                            className="w-full text-xs border border-slate-200 bg-white px-2.5 py-1.5 rounded focus:outline-hidden font-semibold text-slate-800 focus:border-blue-600"
                          />
                        </div>
                        <div>
                          <label className="text-[9px] uppercase font-bold text-slate-400 tracking-wider block mb-0.5">Buyer GSTIN</label>
                          <input 
                            type="text" 
                            value={invoiceData.buyer.gstin || ""} 
                            onChange={(e) => handleUpdateField(["buyer", "gstin"], e.target.value.toUpperCase())}
                            className={`w-full text-xs font-mono border px-2.5 py-1.5 rounded focus:outline-hidden ${
                              buyerGstinVal.isValid 
                                ? "border-slate-200 focus:border-blue-600 text-blue-700 font-semibold" 
                                : "border-rose-300 focus:border-rose-500 bg-rose-50/20 text-rose-800 font-semibold"
                            }`}
                          />
                          {!buyerGstinVal.isValid && invoiceData.buyer.gstin && (
                            <span className="text-[9px] text-rose-600 mt-1 block">✕ Format Error: {buyerGstinVal.errors[0]}</span>
                          )}
                        </div>
                        <div>
                          <label className="text-[9px] uppercase font-bold text-slate-400 tracking-wider block mb-0.5">Buyer State</label>
                          <input 
                            type="text" 
                            value={invoiceData.buyer.state || ""} 
                            onChange={(e) => handleUpdateField(["buyer", "state"], e.target.value)}
                            className="w-full text-xs border border-slate-200 bg-white px-2.5 py-1.5 rounded focus:outline-hidden font-semibold text-slate-800 focus:border-blue-600"
                          />
                        </div>
                        <div>
                          <label className="text-[9px] uppercase font-bold text-slate-400 tracking-wider block mb-0.5">Address</label>
                          <textarea 
                            value={invoiceData.buyer.address || ""} 
                            onChange={(e) => handleUpdateField(["buyer", "address"], e.target.value)}
                            rows={2}
                            className="w-full text-xs border border-slate-200 bg-white px-2.5 py-1.5 rounded focus:outline-hidden text-slate-600 focus:border-blue-600"
                          />
                        </div>
                      </div>
                    </div>

                  </div>

                  {/* Line Items Table */}
                  <div className="pt-2">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-[11px] font-bold uppercase tracking-widest text-slate-400 flex items-center gap-1.5">
                        <span>2. Goods and Services details</span>
                      </h3>
                      <button
                        type="button"
                        onClick={handleAddLineItem}
                        className="text-[11px] bg-slate-900 text-white hover:bg-slate-800 font-bold px-2.5 py-1 rounded inline-flex items-center gap-1 cursor-pointer transition-all"
                      >
                        <Plus className="h-3 w-3" />
                        <span>Add Row</span>
                      </button>
                    </div>

                    <div className="border border-slate-200 rounded overflow-hidden shadow-xs">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead>
                          <tr className="bg-slate-550 bg-slate-100 border-b border-slate-200 text-slate-600 h-8 font-bold text-[10px] uppercase tracking-wider">
                            <th className="pl-3 py-1 font-semibold">Description</th>
                            <th className="py-1 w-20 font-semibold">HSN</th>
                            <th className="py-1 w-16 text-center font-semibold">Qty</th>
                            <th className="py-1 w-20 text-right font-semibold">Rate</th>
                            <th className="py-1 w-24 text-right font-semibold">Taxable</th>
                            <th className="py-1 w-16 text-center font-semibold">GST %</th>
                            <th className="w-10 text-center"></th>
                          </tr>
                        </thead>
                        <tbody>
                          {invoiceData.line_items.map((item, idx) => (
                            <tr key={idx} className="border-b border-slate-100 hover:bg-slate-50/50 h-10">
                              <td className="pl-2.5 py-1 pr-1">
                                <input 
                                  type="text" 
                                  value={item.description || ""} 
                                  onChange={(e) => handleLineItemChange(idx, "description", e.target.value)}
                                  className="w-full text-xs font-semibold border-0 hover:bg-slate-100 p-1 rounded focus:bg-white focus:outline-hidden focus:ring-1 focus:ring-blue-500"
                                />
                              </td>
                              <td className="py-1 pr-1">
                                <input 
                                  type="text" 
                                  value={item.hsn_sac || ""} 
                                  onChange={(e) => handleLineItemChange(idx, "hsn_sac", e.target.value)}
                                  className="w-full text-xs font-mono border-0 hover:bg-slate-100 p-1 rounded focus:bg-white focus:outline-hidden focus:ring-1 focus:ring-blue-500"
                                />
                              </td>
                              <td className="py-1 pr-1">
                                <input 
                                  type="text" 
                                  value={item.qty === null ? "" : item.qty} 
                                  onChange={(e) => handleLineItemChange(idx, "qty", e.target.value)}
                                  className="w-full text-xs font-mono text-center border-0 hover:bg-slate-100 p-1 rounded focus:bg-white focus:outline-hidden focus:ring-1 focus:ring-blue-500"
                                />
                              </td>
                              <td className="py-1 pr-1">
                                <input 
                                  type="text" 
                                  value={item.rate === null ? "" : item.rate} 
                                  onChange={(e) => handleLineItemChange(idx, "rate", e.target.value)}
                                  className="w-full text-xs font-mono text-right border-0 hover:bg-slate-100 p-1 rounded focus:bg-white focus:outline-hidden focus:ring-1 focus:ring-blue-500"
                                />
                              </td>
                              <td className="py-1 pr-1">
                                <input 
                                  type="text" 
                                  value={item.taxable_value === null ? "" : item.taxable_value} 
                                  onChange={(e) => handleLineItemChange(idx, "taxable_value", e.target.value)}
                                  className="w-full text-xs font-mono text-right font-semibold text-slate-800 border-0 hover:bg-slate-100 p-1 rounded focus:bg-white focus:outline-hidden focus:ring-1 focus:ring-blue-500"
                                />
                              </td>
                              <td className="py-1 pr-1">
                                <input 
                                  type="text" 
                                  value={item.gst_rate_percent === null ? "" : item.gst_rate_percent} 
                                  onChange={(e) => handleLineItemChange(idx, "gst_rate_percent", e.target.value)}
                                  className="w-full text-xs font-mono text-center border-0 hover:bg-slate-100 p-1 rounded focus:bg-white focus:outline-hidden focus:ring-1 focus:ring-blue-500"
                                />
                              </td>
                              <td className="text-center pr-2">
                                <button
                                  type="button"
                                  onClick={() => handleRemoveLineItem(idx)}
                                  disabled={invoiceData.line_items.length <= 1}
                                  className="text-slate-400 hover:text-rose-600 disabled:opacity-30 disabled:hover:text-slate-400 p-1 rounded cursor-pointer"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Totals workspace */}
                  <div className="pt-2 border-t border-slate-100">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-[11px] font-bold uppercase tracking-widest text-slate-400 flex items-center gap-1.5">
                        <Calculator className="h-3.5 w-3.5 text-slate-400" />
                        <span>3. Invoice Aggregations</span>
                      </h3>
                      <button
                        type="button"
                        onClick={handleRecalculateTotals}
                        className="text-[11px] text-blue-700 bg-blue-50 border border-blue-200 hover:bg-blue-100 px-2.5 py-1 rounded flex items-center gap-1 font-bold transition-all cursor-pointer shadow-xs"
                      >
                        <RefreshCw className="h-3 w-3" />
                        <span>Recalculate Totals</span>
                      </button>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 bg-slate-50/50 p-3 rounded border border-slate-200">
                      <div>
                        <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">Taxable Value</label>
                        <input 
                          type="number" 
                          value={invoiceData.totals.taxable_value || 0} 
                          onChange={(e) => handleUpdateField(["totals", "taxable_value"], Number(e.target.value))}
                          className="w-full text-xs font-mono font-bold text-slate-900 border border-slate-200 bg-white p-2 rounded focus:outline-hidden focus:border-blue-700"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">CGST Tax</label>
                        <input 
                          type="number" 
                          value={invoiceData.totals.cgst || 0} 
                          onChange={(e) => handleUpdateField(["totals", "cgst"], Number(e.target.value))}
                          className="w-full text-xs font-mono border border-slate-200 bg-white p-2 rounded focus:outline-hidden focus:border-blue-700"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">SGST Tax</label>
                        <input 
                          type="number" 
                          value={invoiceData.totals.sgst || 0} 
                          onChange={(e) => handleUpdateField(["totals", "sgst"], Number(e.target.value))}
                          className="w-full text-xs font-mono border border-slate-200 bg-white p-2 rounded focus:outline-hidden focus:border-blue-700"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">IGST Tax</label>
                        <input 
                          type="number" 
                          value={invoiceData.totals.igst || 0} 
                          onChange={(e) => handleUpdateField(["totals", "igst"], Number(e.target.value))}
                          className="w-full text-xs font-mono border border-slate-200 bg-white p-2 rounded focus:outline-hidden focus:border-blue-700"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-3">
                      <div>
                        <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">Cess (INR)</label>
                        <input 
                          type="number" 
                          value={invoiceData.totals.cess || 0} 
                          onChange={(e) => handleUpdateField(["totals", "cess"], Number(e.target.value))}
                          className="w-full text-xs font-mono border border-slate-200 bg-slate-50/50 p-2 rounded focus:outline-hidden focus:border-blue-700"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">Round Off</label>
                        <input 
                          type="number" 
                          value={invoiceData.totals.round_off || 0} 
                          onChange={(e) => handleUpdateField(["totals", "round_off"], Number(e.target.value))}
                          className="w-full text-xs font-mono border border-slate-200 bg-slate-50/50 p-2 rounded focus:outline-hidden focus:border-blue-700"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] uppercase font-bold text-slate-900 mb-1">Grand Total (INR)</label>
                        <input 
                          type="number" 
                          value={invoiceData.totals.grand_total || 0} 
                          onChange={(e) => handleUpdateField(["totals", "grand_total"], Number(e.target.value))}
                          className="w-full text-xs font-mono font-extrabold text-blue-750 text-blue-800 bg-blue-50/30 border border-blue-200 p-2 rounded focus:outline-hidden"
                        />
                      </div>
                    </div>
                  </div>

                </motion.div>
              )}

              {/* TAB 2: AUDIT CHECKS */}
              {activeTab === "flags" && (
                <motion.div
                  key="flags"
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -5 }}
                  className="space-y-5"
                >
                  <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                    <div>
                      <h3 className="text-sm font-bold text-slate-900">Auditor Evaluation Report</h3>
                      <p className="text-[11px] text-slate-500">Legal ledger audits conforming to the Indian GST Act rules</p>
                    </div>
                    {warnings.length === 0 ? (
                      <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 px-2.5 py-1 rounded text-xs font-bold flex items-center gap-1">
                        <CheckCircle className="h-3.5 w-3.5" /> Correct Audit
                      </span>
                    ) : (
                      <span className="bg-amber-50 text-amber-700 border border-amber-200 px-2.5 py-1 rounded text-xs font-bold flex items-center gap-1 animate-pulse">
                        <AlertTriangle className="h-3.5 w-3.5 text-amber-500" /> {warnings.length} Check Warnings
                      </span>
                    )}
                  </div>

                  {/* Summary Box */}
                  <div className={`p-3.5 rounded border flex gap-3 ${
                    warnings.length === 0 
                      ? "bg-emerald-50/40 border-emerald-200 text-emerald-800" 
                      : "bg-amber-50/30 border-amber-200 text-slate-800"
                  }`}>
                    <div className="mt-0.5 shrink-0">
                      {warnings.length === 0 ? (
                        <CheckCircle className="h-4.5 w-4.5 text-emerald-600" />
                      ) : (
                        <AlertTriangle className="h-4.5 w-4.5 text-amber-600" />
                      )}
                    </div>
                    <div className="text-xs">
                      <p className="font-bold text-slate-950 mb-1">
                        {warnings.length === 0 
                          ? "Congratulations! Invoice data passed all business validations." 
                          : `${warnings.length} GST configuration checks failed or flagged minor variances.`}
                      </p>
                      <ul className="list-disc list-inside space-y-1 mt-1 text-slate-600 leading-relaxed text-[11px]">
                        <li>Evaluated state code identifiers for both parties.</li>
                        <li>Verified symmetry of CGST (Central Tax) and SGST (State Tax).</li>
                        <li>Cross-checked computed line calculation sums against final printed totals.</li>
                      </ul>
                    </div>
                  </div>

                  {/* List of Warning logs */}
                  <div className="space-y-2.5">
                    <h4 className="text-[10px] uppercase font-bold text-slate-400 tracking-wider flex items-center gap-1.5">
                      <span>Evaluated Warnings Logs ({warnings.length})</span>
                    </h4>

                    {warnings.length === 0 ? (
                      <div className="p-8 text-center bg-slate-50 border border-slate-200 border-dashed rounded py-10">
                        <CheckCircle className="h-6 w-6 text-emerald-500 mx-auto opacity-75 mb-2" />
                        <p className="text-xs font-bold text-slate-700">Perfect Compliance!</p>
                        <p className="text-[10px] text-slate-450 text-slate-400 mt-1 max-w-sm mx-autoleading-normal">No discrepancies found in taxpayer states, symmetric rates, HSN codes, or total summation arrays.</p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {warnings.map((warn, index) => (
                          <div 
                            key={index} 
                            className="bg-slate-50 hover:bg-slate-100/50 border border-slate-200 rounded p-3 flex items-start gap-2.5 text-xs transition-colors"
                          >
                            <span className="bg-amber-100 text-amber-800 font-extrabold shrink-0 rounded h-5 w-5 flex items-center justify-center font-mono text-[10px] mt-0.5" id={`warning-index-${index}`}>
                              {index + 1}
                            </span>
                            <div className="space-y-0.5">
                              <p className="font-bold text-slate-850">Validation Diagnostic</p>
                              <p className="text-slate-600 leading-relaxed text-[11px]">{warn}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Additional Information details on GST regulations */}
                  <div className="bg-slate-50 p-4 rounded border border-slate-200 text-xs text-slate-600">
                    <div className="flex items-center gap-1.5 font-bold text-slate-800 mb-2 font-sans">
                      <Info className="h-4 w-4 text-blue-600" />
                      <span>Regulatory Business Rules Verified:</span>
                    </div>
                    <ul className="space-y-2 leading-relaxed text-[11px]">
                      <li>
                        <strong>Rule 1 &amp; Rule 2 (GSTIN Syntax):</strong> First 2 characters must correspond precisely to the registered State (e.g. <code>29</code> for Karnataka, <code>27</code> for Maharashtra). Chars 3-12 are matching regular expression profiles of the 10-digit PAN string. Char 14 registers <code>Z</code>.
                      </li>
                      <li>
                        <strong>Rule 3 (Local vs Inter-state Tax Code symmetry):</strong> Under local intra-state transactions (Supplier State matches Place of Supply), the ledger is restricted to matching levels of CGST &amp; SGST. Inter-state transfers enforce IGST exclusively.
                      </li>
                      <li>
                        <strong>Rule 4 (No overridden totals):</strong> We display exactly captured physical figures. Any arithmetic differences are highlighted in warnings to protect against double entries.
                      </li>
                    </ul>
                  </div>

                </motion.div>
              )}

              {/* TAB 3: STRICT JSON VIEW */}
              {activeTab === "json" && (
                <motion.div
                  key="json"
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -5 }}
                  className="space-y-4"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-bold text-slate-900">Extracted Structured JSON</h3>
                      <p className="text-[11px] text-slate-500">Strict schema compliant layout for automatic API integrations</p>
                    </div>
                    <button
                      type="button"
                      onClick={handleCopyJson}
                      className="bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold px-3 py-1.5 rounded flex items-center gap-1.5 cursor-pointer shadow-xs transition-all"
                    >
                      <Copy className="h-3.5 w-3.5" />
                      <span>{copySuccess ? "Copied!" : "Copy JSON"}</span>
                    </button>
                  </div>

                  <div className="border border-slate-200 rounded overflow-hidden bg-slate-950 shadow-inner max-h-[500px] overflow-y-auto">
                    <pre className="p-4 text-[11px] font-mono text-emerald-400 leading-normal selection:bg-slate-800">
                      {JSON.stringify({
                        ...invoiceData,
                        review_flags: Array.from(new Set([...(invoiceData.review_flags || []), ...warnings]))
                      }, null, 2)}
                    </pre>
                  </div>

                  <div className="flex items-start gap-1 p-3 bg-blue-50/50 border border-blue-150 rounded text-[11px] text-blue-850">
                    <Info className="h-4 w-4 shrink-0 mt-0.5 text-blue-600" />
                    <span>This JSON representation follows the requested schema, returning clean double numbers and dates standardized to <code>DD-MM-YYYY</code>. Missing fields revert safely to null.</span>
                  </div>

                </motion.div>
              )}

            </AnimatePresence>

          </div>

          {/* Recalculate helper tray */}
          <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between gap-4">
            <div className="text-xs text-slate-400 font-mono">
              Schema version: 1.0.1 (JSON Strictly Enforced)
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-slate-500">Status Check:</span>
              <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full border ${
                warnings.length === 0 
                  ? "bg-emerald-50 text-emerald-700 border-emerald-200" 
                  : "bg-amber-50 text-amber-700 border-amber-200"
              }`}>
                {warnings.length === 0 ? "Perfect Match" : `${warnings.length} Check Warnings`}
              </span>
            </div>
          </div>

        </section>

      </main>

      {/* Styled Footer */}
      <footer className="bg-slate-900 text-slate-400 text-xs py-8 px-6 mt-12 border-t border-slate-850">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="text-center md:text-left space-y-1">
            <p className="font-bold text-slate-200">GST Invoice Extraction Intelligent Agent</p>
            <p className="text-slate-500 text-[11px]">Specialised auditing models matching Central GST and Integrated GST state laws.</p>
          </div>
          <div className="text-center md:text-right font-mono text-[11px] text-slate-500">
            Current system time: 2026-05-21 UTC
          </div>
        </div>
      </footer>

      {/* GST Portal Verification Assistant Modal */}
      <AnimatePresence>
        {isVerifyModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            {/* Backdrop */}
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsVerifyModalOpen(false)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-xs"
            />
            
            {/* Modal Card */}
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="bg-white rounded border border-slate-200 shadow-2xl max-w-lg w-full overflow-hidden relative z-10 flex flex-col"
            >
              <div className="bg-slate-900 text-white px-5 py-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Globe className="h-5 w-5 text-blue-400" />
                  <div>
                    <h3 className="font-bold text-sm">GST Portal Verification Assistant</h3>
                    <p className="text-[10px] text-slate-400">Verify extracted invoice compliance with the tax authority</p>
                  </div>
                </div>
                <button 
                  type="button"
                  onClick={() => setIsVerifyModalOpen(false)}
                  className="text-slate-400 hover:text-white text-lg font-bold p-1 cursor-pointer"
                >
                  &times;
                </button>
              </div>

              <div className="p-5 space-y-4">
                
                {/* Information Callout */}
                <div className="p-3 bg-blue-50 border border-blue-100 text-slate-700 rounded text-xs flex gap-2 leading-relaxed">
                  <Info className="h-4.5 w-4.5 text-blue-600 shrink-0 mt-0.5" />
                  <p>
                    <strong>Clipboard Auto-Copy Policy:</strong> Government tax portals require manual entry and a CAPTCHA solver. Selecting any verification below will <strong>automatically copy the identifier to your clipboard</strong> and launch the correct external verification page.
                  </p>
                </div>

                <div className="divide-y divide-slate-100">
                  
                  {/* Option 1: Supplier GSTIN */}
                  <div className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="space-y-1">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Supplier Taxpayer Identity</span>
                      <p className="font-mono text-xs font-bold text-slate-900 flex items-center gap-1.5 flex-wrap">
                        <span>{invoiceData.supplier.gstin || "No GSTIN found"}</span>
                        {supplierGstinVal && !supplierGstinVal.isValid && (
                          <span className="text-[10px] bg-rose-50 text-rose-700 border border-rose-200 px-1.5 py-0.2 rounded font-sans font-semibold">Invalid GSTIN Format</span>
                        )}
                      </p>
                    </div>
                    {invoiceData.supplier.gstin ? (
                      <a
                        href="https://services.gst.gov.in/services/searchtp"
                        target="_blank"
                        rel="noreferrer"
                        onClick={() => {
                          navigator.clipboard.writeText(invoiceData.supplier.gstin || "");
                          setVerifyCopyType("supplier");
                          setTimeout(() => setVerifyCopyType(null), 2000);
                        }}
                        className="px-3 py-1.5 text-xs font-bold text-white bg-slate-900 rounded hover:bg-slate-800 transition-colors text-center inline-flex items-center gap-1.5 cursor-pointer shadow-xs whitespace-nowrap"
                      >
                        <Copy className="h-3 w-3" />
                        <span>{verifyCopyType === "supplier" ? "Copied & Opening!" : "Copy & Verify Taxpayer"}</span>
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    ) : (
                      <span className="text-xs text-slate-400 italic">Not extracted</span>
                    )}
                  </div>

                  {/* Option 2: Buyer GSTIN */}
                  <div className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="space-y-1">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Buyer Taxpayer Identity</span>
                      <p className="font-mono text-xs font-bold text-slate-900 flex items-center gap-1.5 flex-wrap">
                        <span>{invoiceData.buyer.gstin || "No GSTIN found"}</span>
                        {buyerGstinVal && !buyerGstinVal.isValid && (
                          <span className="text-[10px] bg-rose-50 text-rose-700 border border-rose-200 px-1.5 py-0.2 rounded font-sans font-semibold">Invalid GSTIN Format</span>
                        )}
                      </p>
                    </div>
                    {invoiceData.buyer.gstin ? (
                      <a
                        href="https://services.gst.gov.in/services/searchtp"
                        target="_blank"
                        rel="noreferrer"
                        onClick={() => {
                          navigator.clipboard.writeText(invoiceData.buyer.gstin || "");
                          setVerifyCopyType("buyer");
                          setTimeout(() => setVerifyCopyType(null), 2000);
                        }}
                        className="px-3 py-1.5 text-xs font-bold text-white bg-slate-900 rounded hover:bg-slate-800 transition-colors text-center inline-flex items-center gap-1.5 cursor-pointer shadow-xs whitespace-nowrap"
                      >
                        <Copy className="h-3 w-3" />
                        <span>{verifyCopyType === "buyer" ? "Copied & Opening!" : "Copy & Verify Taxpayer"}</span>
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    ) : (
                      <span className="text-xs text-slate-400 italic">Not extracted</span>
                    )}
                  </div>

                  {/* Option 3: E-Way Bill Number */}
                  <div className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="space-y-1">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">E-Way Bill Identification</span>
                      <p className="font-mono text-xs font-bold text-slate-900">{invoiceData.eway_bill_no || "No E-way bill linked"}</p>
                    </div>
                    {invoiceData.eway_bill_no ? (
                      <a
                        href="https://ewaybillgst.gov.in/"
                        target="_blank"
                        rel="noreferrer"
                        onClick={() => {
                          navigator.clipboard.writeText(invoiceData.eway_bill_no || "");
                          setVerifyCopyType("eway");
                          setTimeout(() => setVerifyCopyType(null), 2000);
                        }}
                        className="px-3 py-1.5 text-xs font-bold text-white bg-slate-900 rounded hover:bg-slate-800 transition-colors text-center inline-flex items-center gap-1.5 cursor-pointer shadow-xs whitespace-nowrap"
                      >
                        <Copy className="h-3 w-3" />
                        <span>{verifyCopyType === "eway" ? "Copied & Opening!" : "Copy & Verify Bill"}</span>
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    ) : (
                      <span className="text-xs text-slate-400 italic">Not extracted</span>
                    )}
                  </div>

                  {/* Option 4: IRN */}
                  <div className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="space-y-1">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">E-Invoice Hash (IRN)</span>
                      <p className="font-mono text-xs font-bold text-slate-900 truncate max-w-[210px] sm:max-w-[250px]" title={invoiceData.irn || ""}>
                        {invoiceData.irn || "No IRN found"}
                      </p>
                    </div>
                    {invoiceData.irn ? (
                      <a
                        href="https://einvoice1.gst.gov.in/Others/Searchtaxpayer"
                        target="_blank"
                        rel="noreferrer"
                        onClick={() => {
                          navigator.clipboard.writeText(invoiceData.irn || "");
                          setVerifyCopyType("irn");
                          setTimeout(() => setVerifyCopyType(null), 2000);
                        }}
                        className="px-3 py-1.5 text-xs font-bold text-white bg-slate-900 rounded hover:bg-slate-800 transition-colors text-center inline-flex items-center gap-1.5 cursor-pointer shadow-xs whitespace-nowrap"
                      >
                        <Copy className="h-3 w-3" />
                        <span>{verifyCopyType === "irn" ? "Copied & Opening!" : "Copy & Verify IRN"}</span>
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    ) : (
                      <span className="text-xs text-slate-400 italic">Not extracted</span>
                    )}
                  </div>

                </div>

              </div>

              <div className="bg-slate-50 px-5 py-3.5 border-t border-slate-100 flex items-center justify-end">
                <button 
                  type="button"
                  onClick={() => setIsVerifyModalOpen(false)}
                  className="px-4 py-1.5 bg-slate-250 hover:bg-slate-300 text-slate-700 rounded text-xs font-bold transition-colors cursor-pointer"
                >
                  Close Assistant
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
