import React, { useEffect, useState } from 'react';
import jsPDF from 'jspdf';
import { Download, Share2, Printer, X, FileText, CheckCircle2, Sparkles, ExternalLink, RefreshCw } from 'lucide-react';
import { shareOrDownloadPDF } from '../utils/pdfGenerator';

interface PDFPreviewModalProps {
  isOpen: boolean;
  doc: jsPDF | null;
  filename: string;
  title: string;
  onClose: () => void;
}

export const PDFPreviewModal: React.FC<PDFPreviewModalProps> = ({
  isOpen,
  doc,
  filename,
  title,
  onClose
}) => {
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [isSharing, setIsSharing] = useState(false);
  const [sharedSuccess, setSharedSuccess] = useState(false);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    if (doc && isOpen) {
      try {
        const blob = doc.output('blob');
        const url = URL.createObjectURL(blob);
        setPdfUrl(url);
        setLoadError(false);

        return () => {
          URL.revokeObjectURL(url);
        };
      } catch (err) {
        console.error('Error generating PDF blob:', err);
        setLoadError(true);
      }
    } else {
      setPdfUrl(null);
    }
  }, [doc, isOpen]);

  if (!isOpen || !doc) return null;

  const handleDownload = async () => {
    try {
      await shareOrDownloadPDF(doc, filename, title);
    } catch (e) {
      console.error('Download error:', e);
    }
  };

  const handleOpenInNewTab = () => {
    if (pdfUrl) {
      // Create a temporary anchor to safely open without forcing current window navigation
      const a = document.createElement('a');
      a.href = pdfUrl;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      a.click();
    } else {
      try {
        const blobUrl = doc.output('bloburl');
        const a = document.createElement('a');
        a.href = blobUrl.toString();
        a.target = '_blank';
        a.rel = 'noopener noreferrer';
        a.click();
      } catch (e) {
        handleDownload();
      }
    }
  };

  const handlePrint = () => {
    try {
      doc.autoPrint();
      const blobUrl = doc.output('bloburl');
      const printWindow = window.open(blobUrl, '_blank');
      if (printWindow) {
        printWindow.focus();
      }
    } catch (e) {
      console.error('Print error:', e);
      handleDownload();
    }
  };

  const handleShare = async () => {
    setIsSharing(true);
    try {
      await shareOrDownloadPDF(doc, filename, title, `Please find attached ${title} from HSS ALL IN ONE.`);
      setSharedSuccess(true);
      setTimeout(() => setSharedSuccess(false), 3000);
    } catch (e) {
      console.error(e);
    } finally {
      setIsSharing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2.5 sm:p-6 bg-black/85 backdrop-blur-md animate-fade-in font-sans">
      <div className="w-full max-w-5xl h-[92vh] flex flex-col rounded-3xl bg-[#1A1C23] border border-[#2D3139] shadow-2xl overflow-hidden text-slate-100">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-3.5 border-b border-[#2D3139] bg-[#16181F]">
          <div className="flex items-center gap-3 min-w-0">
            <div className="p-2 sm:p-2.5 rounded-2xl bg-purple-500/15 text-purple-400 border border-purple-500/30 shrink-0">
              <FileText className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm sm:text-base font-bold text-white leading-tight truncate">{title}</h3>
              <p className="text-[11px] text-slate-400 font-mono mt-0.5 truncate">{filename}</p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {pdfUrl && (
              <button
                type="button"
                onClick={handleOpenInNewTab}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-purple-600/20 hover:bg-purple-600/30 text-purple-300 border border-purple-500/30 text-xs font-semibold transition cursor-pointer"
                title="Open PDF in a new tab for native fullscreen viewing"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Open in New Tab</span>
              </button>
            )}

            <button
              type="button"
              onClick={handleDownload}
              className="p-2 sm:px-3 sm:py-1.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold flex items-center gap-1.5 transition shadow-sm cursor-pointer"
              title="Save PDF file to device"
            >
              <Download className="w-4 h-4" />
              <span className="hidden sm:inline">Save PDF</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-[#252830] transition cursor-pointer"
              title="Close Preview"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Informative Banner for Iframe Sandbox Compatibility */}
        <div className="bg-[#12141A] px-4 py-2 border-b border-[#2D3139] flex flex-wrap items-center justify-between gap-2 text-xs text-slate-300">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shrink-0" />
            <span>Document generated successfully. If your browser restricts embedded preview inside iframes, use <strong>Open in New Tab</strong>.</span>
          </div>
          {pdfUrl && (
            <button
              type="button"
              onClick={handleOpenInNewTab}
              className="text-purple-400 hover:text-purple-300 underline font-semibold cursor-pointer shrink-0"
            >
              Launch in Browser Tab ↗
            </button>
          )}
        </div>

        {/* PDF Preview Area */}
        <div className="flex-1 bg-[#0B0D12] p-2 sm:p-4 overflow-hidden relative flex flex-col items-center justify-center">
          {pdfUrl && !loadError ? (
            <div className="w-full h-full relative flex flex-col items-center justify-center bg-white rounded-2xl overflow-hidden shadow-inner">
              <object
                data={`${pdfUrl}#toolbar=1&navpanes=0&scrollbar=1`}
                type="application/pdf"
                className="w-full h-full rounded-2xl"
                title="PDF Document Preview"
              >
                {/* Fallback if object is blocked */}
                <iframe
                  src={`${pdfUrl}#toolbar=1&navpanes=0&scrollbar=1`}
                  className="w-full h-full rounded-2xl border-0"
                  title="PDF Preview Frame"
                >
                  <div className="flex flex-col items-center justify-center h-full p-6 text-center text-slate-700 bg-slate-100">
                    <FileText className="w-12 h-12 text-purple-600 mb-3" />
                    <h4 className="text-base font-bold mb-1 text-slate-900">PDF Ready to View</h4>
                    <p className="text-xs text-slate-600 mb-4 max-w-sm">
                      Your browser cannot display this PDF inside an embedded window. Click below to view or save it.
                    </p>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={handleOpenInNewTab}
                        className="px-4 py-2 rounded-xl bg-purple-600 text-white text-xs font-bold shadow hover:bg-purple-500"
                      >
                        Open in New Tab
                      </button>
                      <button
                        type="button"
                        onClick={handleDownload}
                        className="px-4 py-2 rounded-xl bg-slate-800 text-white text-xs font-bold shadow hover:bg-slate-700"
                      >
                        Download PDF
                      </button>
                    </div>
                  </div>
                </iframe>
              </object>
            </div>
          ) : loadError ? (
            <div className="flex flex-col items-center justify-center text-slate-300 gap-3 p-6 text-center max-w-md bg-[#16181F] rounded-2xl border border-[#2D3139]">
              <FileText className="w-12 h-12 text-purple-400" />
              <h4 className="text-base font-bold text-white">Document Prepared</h4>
              <p className="text-xs text-slate-400">
                The document was created. Click below to download or open it in a new window.
              </p>
              <div className="flex gap-3 mt-2">
                <button
                  type="button"
                  onClick={handleDownload}
                  className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs"
                >
                  Download PDF
                </button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center text-slate-400 gap-3 p-4 text-center">
              <div className="w-10 h-10 border-4 border-purple-500 border-t-transparent rounded-full animate-spin" />
              <p className="text-sm font-medium text-slate-300">Rendering PDF document preview...</p>
            </div>
          )}
        </div>

        {/* Modal Action Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5 border-t border-[#2D3139] bg-[#16181F]">
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <Sparkles className="w-4 h-4 text-purple-400" />
            <span className="hidden sm:inline">Official Higher Secondary Standard Layout</span>
          </div>

          <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end">
            <button
              type="button"
              onClick={handleOpenInNewTab}
              className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-medium bg-[#222631] hover:bg-[#2c313f] text-purple-300 border border-purple-500/30 transition active:scale-95 cursor-pointer"
            >
              <ExternalLink className="w-4 h-4" />
              <span>Full Tab</span>
            </button>

            <button
              type="button"
              onClick={handlePrint}
              className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-medium bg-[#222631] hover:bg-[#2c313f] text-slate-200 border border-[#2D3139] transition active:scale-95 cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span>Print</span>
            </button>

            <button
              type="button"
              onClick={handleShare}
              disabled={isSharing}
              className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-medium bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 border border-blue-500/30 transition active:scale-95 disabled:opacity-50 cursor-pointer"
            >
              {sharedSuccess ? (
                <>
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <span>Shared!</span>
                </>
              ) : (
                <>
                  <Share2 className="w-4 h-4" />
                  <span>Share</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={handleDownload}
              className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-5 py-2.5 rounded-xl text-xs sm:text-sm font-semibold bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white shadow-lg shadow-purple-900/30 transition active:scale-95 cursor-pointer"
            >
              <Download className="w-4 h-4" />
              <span>Save PDF</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
