import { useRef, useState } from "react";
import { analyzeReport } from "../api/client";
import type { ApiResponse } from "../api/types";

type Props = { onDone: (data: ApiResponse) => void };

const MAX_MB = 10;
const ACCEPTED_EXT = [".pdf", ".txt", ".png", ".jpg", ".jpeg"];

function bytesToMB(bytes: number) {
  return bytes / (1024 * 1024);
}

function isAccepted(file: File) {
  const name = file.name.toLowerCase();
  return ACCEPTED_EXT.some((ext) => name.endsWith(ext));
}

export default function UploadPage({ onDone }: Props) {
  const inputRef = useRef<HTMLInputElement | null>(null);

  const [file, setFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  function pickFile(f: File | null) {
    setError("");
    if (!f) {
      setFile(null);
      return;
    }

    if (!isAccepted(f)) {
      setFile(null);
      setError("Supported formats: PDF, TXT, PNG, JPG, JPEG (max 10MB).");
      return;
    }

    if (bytesToMB(f.size) > MAX_MB) {
      setFile(null);
      setError(`File is too large. Max size is ${MAX_MB}MB.`);
      return;
    }

    setFile(f);
  }

  async function handleAnalyze() {
    if (!file) return;
    setLoading(true);
    setError("");
    try {
      const data = await analyzeReport(file);
      onDone(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="page">
      <div className="hero">
        <h1 className="title">Medical Report Analyzer</h1>
        <p className="subtitle">
          Upload your medical report to get a simplified explanation
        </p>
      </div>

      <div className="card">
        <div
          className={`dropzone ${dragOver ? "dropzone--active" : ""}`}
          onDragEnter={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setDragOver(true);
          }}
          onDragOver={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setDragOver(true);
          }}
          onDragLeave={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setDragOver(false);
          }}
          onDrop={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setDragOver(false);
            const f = e.dataTransfer.files?.[0] ?? null;
            pickFile(f);
          }}
          onClick={() => inputRef.current?.click()}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") inputRef.current?.click();
          }}
        >
          <div className="dropzoneInner">
            <div className="iconWrap" aria-hidden="true">
              <svg width="56" height="56" viewBox="0 0 24 24" fill="none">
                <path
                  d="M4 7a3 3 0 0 1 3-3h7"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                />
                <path
                  d="M4 7v10a3 3 0 0 0 3 3h10a3 3 0 0 0 3-3V10"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                />
                <path
                  d="M14 4h6"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                />
                <path
                  d="M17 1v6"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                />
                <path
                  d="M7.5 14.5l2.2-2.2a1.2 1.2 0 0 1 1.7 0l1.3 1.3 1.1-1.1a1.2 1.2 0 0 1 1.7 0l2.2 2.2"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path
                  d="M8.5 10.2h.01"
                  stroke="currentColor"
                  strokeWidth="2.6"
                  strokeLinecap="round"
                />
              </svg>
            </div>

            <p className="dropTitle">Drag and drop your medical report here</p>
            <p className="dropHint">PDF, TXT, PNG, JPG, JPEG files (max 10MB)</p>

            <button
              type="button"
              className="browseBtn"
              onClick={(e) => {
                e.stopPropagation();
                inputRef.current?.click();
              }}
            >
              Browse Files
            </button>

            {file ? (
              <p className="fileLine">
                Selected: <span className="fileName">{file.name}</span>
              </p>
            ) : null}
          </div>

          <input
            ref={inputRef}
            className="hiddenInput"
            type="file"
            accept=".pdf,.txt,image/png,image/jpeg"
            onChange={(e) => pickFile(e.target.files?.[0] ?? null)}
          />
        </div>

        <button
          type="button"
          className={`analyzeBtn ${!file || loading ? "analyzeBtn--disabled" : ""}`}
          disabled={!file || loading}
          onClick={handleAnalyze}
        >
          {loading ? "Analyzing..." : "Analyze Report"}
        </button>

        {error ? <p className="error">{error}</p> : null}
      </div>

      <p className="footer">
        Supported formats: PDF, TXT, PNG, JPG, JPEG • Maximum file size: 10MB
      </p>
    </div>
  );
}
