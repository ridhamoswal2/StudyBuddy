import { useState, useEffect, useRef } from "react";
import axios from "axios";
import { FileText, Upload, Trash2, Loader2, ChevronDown, ChevronUp, Download } from "lucide-react";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function DocumentsPage() {
  const [documents, setDocuments] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [expanded, setExpanded] = useState(null);
  const [loading, setLoading] = useState(true);
  const fileRef = useRef(null);

  useEffect(() => {
    fetchDocuments();
  }, []);

  const fetchDocuments = async () => {
    try {
      const res = await axios.get(`${API}/documents`);
      setDocuments(res.data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.name.toLowerCase().endsWith('.pdf')) {
      alert("Only PDF files are supported");
      return;
    }

    setUploading(true);
    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await axios.post(`${API}/documents/upload`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
        timeout: 120000,
      });
      setDocuments([res.data, ...documents]);
      setExpanded(res.data.id);
    } catch (e) {
      console.error("Upload failed", e);
      alert("Upload failed. Please try again.");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const deleteDocument = async (docId) => {
    try {
      await axios.delete(`${API}/documents/${docId}`);
      setDocuments(documents.filter(d => d.id !== docId));
    } catch (e) {
      console.error(e);
    }
  };

  const formatSize = (bytes) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="p-6 md:p-10 max-w-4xl mx-auto" data-testid="documents-page">
      <div className="mb-8 animate-slide-up">
        <p className="text-sm font-bold uppercase tracking-[0.15em] text-[#52525B] mb-2">Documents</p>
        <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight" style={{ fontFamily: 'Outfit, sans-serif' }}>
          Upload & Summarize
        </h1>
        <p className="text-base text-[#52525B] mt-2">Upload PDF documents to get AI-powered summaries</p>
      </div>

      {/* Upload area */}
      <div className="mb-8 animate-slide-up stagger-1">
        <label
          htmlFor="pdf-upload"
          data-testid="upload-area"
          className={`neo-card flex flex-col items-center justify-center p-10 border-2 border-dashed border-[#0A0A0A] bg-white cursor-pointer transition-all hover:bg-[#FFFDF7] ${uploading ? 'opacity-60 pointer-events-none' : ''}`}
        >
          {uploading ? (
            <>
              <Loader2 size={36} strokeWidth={2.5} className="animate-spin mb-3" />
              <p className="font-bold text-sm">Uploading & analyzing...</p>
              <p className="text-xs text-[#52525B] mt-1">This may take a moment</p>
            </>
          ) : (
            <>
              <div className="w-14 h-14 bg-[#C3B1E1] border-2 border-[#0A0A0A] shadow-[3px_3px_0px_#0A0A0A] flex items-center justify-center mb-4">
                <Upload size={24} strokeWidth={2.5} />
              </div>
              <p className="font-bold text-sm">Click to upload a PDF</p>
              <p className="text-xs text-[#52525B] mt-1">Max 10MB &middot; PDF files only</p>
            </>
          )}
          <input
            ref={fileRef}
            id="pdf-upload"
            data-testid="pdf-upload-input"
            type="file"
            accept=".pdf"
            onChange={handleUpload}
            className="hidden"
            disabled={uploading}
          />
        </label>
      </div>

      {/* Documents list */}
      {loading ? (
        <div className="space-y-4">
          {[1,2].map(i => <div key={i} className="h-20 bg-white border-2 border-[#0A0A0A] animate-pulse" />)}
        </div>
      ) : documents.length === 0 ? (
        <div className="bg-white border-2 border-[#0A0A0A] shadow-[4px_4px_0px_#0A0A0A] p-10 text-center">
          <div className="w-14 h-14 bg-[#FFDE59] border-2 border-[#0A0A0A] flex items-center justify-center mx-auto mb-4">
            <FileText size={24} strokeWidth={2.5} />
          </div>
          <p className="font-bold text-sm">No documents yet</p>
          <p className="text-xs text-[#52525B] mt-1">Upload a PDF to get started</p>
        </div>
      ) : (
        <div className="space-y-4" data-testid="documents-list">
          {documents.map(doc => (
            <div
              key={doc.id}
              className="bg-white border-2 border-[#0A0A0A] shadow-[4px_4px_0px_#0A0A0A] overflow-hidden"
              data-testid={`document-${doc.id}`}
            >
              {/* Header */}
              <button
                data-testid={`document-toggle-${doc.id}`}
                onClick={() => setExpanded(expanded === doc.id ? null : doc.id)}
                className="w-full flex items-center gap-4 p-5 text-left hover:bg-[#FFFDF7] transition-colors"
              >
                <div className="w-10 h-10 bg-[#FF6B6B] border-2 border-[#0A0A0A] flex items-center justify-center flex-shrink-0">
                  <FileText size={20} strokeWidth={2.5} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-sm truncate">{doc.original_filename}</p>
                  <p className="text-xs text-[#52525B]">
                    {formatSize(doc.size)} &middot; {new Date(doc.created_at).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <button
                    data-testid={`delete-doc-${doc.id}`}
                    onClick={(e) => { e.stopPropagation(); deleteDocument(doc.id); }}
                    className="p-2 hover:bg-[#FF6B6B] border-2 border-transparent hover:border-[#0A0A0A] transition-all"
                  >
                    <Trash2 size={16} strokeWidth={2.5} />
                  </button>
                  {expanded === doc.id ? <ChevronUp size={18} strokeWidth={2.5} /> : <ChevronDown size={18} strokeWidth={2.5} />}
                </div>
              </button>

              {/* Expanded content */}
              {expanded === doc.id && (
                <div className="border-t-2 border-[#0A0A0A] p-5 animate-slide-up" data-testid={`document-summary-${doc.id}`}>
                  <div className="mb-4">
                    <p className="text-sm font-bold uppercase tracking-wider mb-2">Summary</p>
                    <p className="text-sm leading-relaxed text-[#0A0A0A]">{doc.summary}</p>
                  </div>
                  {doc.key_points && doc.key_points.length > 0 && (
                    <div>
                      <p className="text-sm font-bold uppercase tracking-wider mb-2">Key Points</p>
                      <ul className="space-y-2">
                        {doc.key_points.map((point, i) => (
                          <li key={i} className="flex items-start gap-2 text-sm">
                            <span className="w-5 h-5 bg-[#FFDE59] border-2 border-[#0A0A0A] flex items-center justify-center flex-shrink-0 text-xs font-bold mt-0.5">
                              {i + 1}
                            </span>
                            <span>{point}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
