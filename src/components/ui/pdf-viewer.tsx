"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import type { PDFDocumentProxy, PDFDocumentLoadingTask } from "pdfjs-dist";
export default function PdfViewer({
  href,
  title,
  autoPrint,
  onClose,
}: {
  href: string;
  title: string;
  autoPrint: boolean;
  onClose: () => void;
}) {
  const [pdf, setPdf] = useState<PDFDocumentProxy | null>(null);
  const [file, setFile] = useState<{ url: string; filename: string } | null>(null);
  const [page, setPage] = useState(1);
  const [error, setError] = useState("");
  const [rendered, setRendered] = useState(false);
  const [printProgress, setPrintProgress] = useState("");
  const canvas = useRef<HTMLCanvasElement>(null);
  const printFrame = useRef<HTMLIFrameElement | null>(null);
  const printRequested = useRef(autoPrint);
  const preview = `${href}${href.includes("?") ? "&" : "?"}inline=1`;
  useEffect(() => {
    const controller = new AbortController();
    let url = "",
      task: PDFDocumentLoadingTask | undefined;
    void (async () => {
      try {
        const response = await fetch(preview, { signal: controller.signal, cache: "no-store" });
        if (!response.ok || !response.headers.get("Content-Type")?.includes("application/pdf"))
          throw new Error(
            response.status === 401
              ? "Your session expired. Sign in again."
              : response.status === 422
                ? await response.text()
                : "Unable to generate this PDF. Close and try again.",
          );
        const bytes = await response.arrayBuffer();
        if (controller.signal.aborted) return;
        url = URL.createObjectURL(new Blob([bytes], { type: "application/pdf" }));
        setFile({
          url,
          filename:
            response.headers.get("Content-Disposition")?.match(/filename="([^"]+)"/)?.[1] ??
            "StockFlow-document.pdf",
        });
        const library = await import("pdfjs-dist");
        library.GlobalWorkerOptions.workerSrc = `/pdfjs/pdf.worker-${library.version}.min.mjs`;
        if (controller.signal.aborted) return;
        task = library.getDocument({ data: bytes });
        const document = await task.promise;
        if (!controller.signal.aborted) setPdf(document);
      } catch (err) {
        if (!controller.signal.aborted)
          setError(err instanceof Error ? err.message : "Unable to load PDF.");
      }
    })();
    return () => {
      controller.abort();
      if (url) URL.revokeObjectURL(url);
      void task?.destroy();
      printFrame.current?.remove();
    };
  }, [preview]);
  const print = useCallback(async () => {
    if (!pdf) return;
    if (pdf.numPages > 100) {
      setError(
        "For documents over 100 pages, download the PDF and print it from your PDF viewer, or choose a smaller date range.",
      );
      return;
    }
    try {
      const images: string[] = [];
      for (let i = 1; i <= pdf.numPages; i++) {
        setPrintProgress(`Preparing print ${i} / ${pdf.numPages}…`);
        const page = await pdf.getPage(i),
          viewport = page.getViewport({ scale: 2 });
        const paper = document.createElement("canvas");
        paper.width = Math.ceil(viewport.width);
        paper.height = Math.ceil(viewport.height);
        await page.render({ canvas: paper, viewport }).promise;
        images.push(`<img src="${paper.toDataURL("image/png")}" alt="PDF page ${i}"/>`);
        paper.width = paper.height = 0;
      }
      printFrame.current?.remove();
      const frame = document.createElement("iframe");
      printFrame.current = frame;
      frame.style.cssText = "position:fixed;width:0;height:0;border:0;left:-9999px;";
      frame.title = "Printable PDF pages";
      frame.onload = () => {
        void (async () => {
          const content = frame.contentWindow;
          if (!content) return;
          await Promise.all(Array.from(content.document.images).map((image) => image.decode()));
          content.addEventListener("afterprint", () => frame.remove(), { once: true });
          content.focus();
          content.print();
          setPrintProgress("");
        })().catch(() => {
          setPrintProgress("");
          setError("Use Download PDF to print this document in your PDF viewer.");
        });
      };
      frame.srcdoc = `<!doctype html><html><head><title>StockFlow document</title><style>@page{size:A4;margin:0}*{box-sizing:border-box}body{margin:0}img{display:block;width:210mm;height:297mm;break-after:page;object-fit:contain}img:last-child{break-after:auto}</style></head><body>${images.join("")}</body></html>`;
      document.body.appendChild(frame);
    } catch {
      setPrintProgress("");
      setError("Use Download PDF to print this document in your PDF viewer.");
    }
  }, [pdf]);
  useEffect(() => {
    if (!pdf || !canvas.current) return;
    const surface = canvas.current;
    let cancelled = false,
      renderTask:
        ReturnType<Awaited<ReturnType<PDFDocumentProxy["getPage"]>>["render"]> | undefined;
    void (async () => {
      try {
        const sheet = await pdf.getPage(page);
        if (cancelled) return;
        const viewport = sheet.getViewport({ scale: 2 });
        surface.width = Math.ceil(viewport.width);
        surface.height = Math.ceil(viewport.height);
        renderTask = sheet.render({ canvas: surface, viewport });
        await renderTask.promise;
        if (cancelled) return;
        setRendered(true);
        if (printRequested.current) {
          printRequested.current = false;
          void print();
        }
      } catch (err) {
        if (!cancelled)
          setError(err instanceof Error ? err.message : "Unable to display PDF page.");
      }
    })();
    return () => {
      cancelled = true;
      renderTask?.cancel();
    };
  }, [pdf, page, print]);
  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b bg-white p-4">
        <div>
          <h2 className="font-semibold">{title}</h2>
          <p className="text-xs text-slate-500">
            A4 document · Preview, download and print the same bill
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <a className="btn-secondary" href={preview} target="_blank" rel="noreferrer">
            Open in New Tab
          </a>
          {file && (
            <a className="btn-primary" href={file.url} download={file.filename}>
              Download PDF
            </a>
          )}
          <button
            className="btn-secondary"
            type="button"
            disabled={!pdf || !!printProgress}
            onClick={() => void print()}
          >
            Print PDF
          </button>
          <button
            className="btn-secondary"
            type="button"
            onClick={onClose}
            aria-label="Close PDF preview"
          >
            Close ✕
          </button>
        </div>
      </div>
      <div className="flex-1 overflow-auto bg-slate-200 p-3 sm:p-5">
        {error && (
          <p className="alert-error mb-4" role="alert">
            {error}
          </p>
        )}
        {!rendered && !error && (
          <p className="p-8 text-center text-sm text-slate-600" role="status">
            Generating PDF…
          </p>
        )}
        {printProgress && (
          <p className="mb-3 rounded-lg bg-indigo-50 p-3 text-sm text-indigo-700" role="status">
            {printProgress}
          </p>
        )}
        <canvas
          ref={canvas}
          aria-label={`PDF page ${page}`}
          className={`mx-auto h-auto w-full max-w-[794px] bg-white shadow-lg ${rendered ? "" : "hidden"}`}
        />
      </div>
      <div className="flex items-center justify-center gap-4 border-t bg-white p-3">
        <button
          className="btn-secondary"
          type="button"
          disabled={!pdf || page <= 1 || !!printProgress}
          onClick={() => {
            setRendered(false);
            setPage((p) => p - 1);
          }}
        >
          ← Previous
        </button>
        <span className="text-sm tabular-nums">
          Page {page} / {pdf?.numPages ?? "…"}
        </span>
        <button
          className="btn-secondary"
          type="button"
          disabled={!pdf || page >= pdf.numPages || !!printProgress}
          onClick={() => {
            setRendered(false);
            setPage((p) => p + 1);
          }}
        >
          Next →
        </button>
      </div>
    </>
  );
}
