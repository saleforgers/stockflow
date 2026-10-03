"use client";
import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
const PdfViewer = dynamic(() => import("./pdf-viewer"), {
  ssr: false,
  loading: () => <p className="p-8 text-slate-500">Loading PDF viewer…</p>,
});
export function PdfActions({ href, title = "Document" }: { href: string; title?: string }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [mode, setMode] = useState<"preview" | "print" | null>(null);
  useEffect(() => {
    if (mode) dialog.current?.showModal();
    else dialog.current?.close();
  }, [mode]);
  return (
    <>
      <button className="btn-secondary" type="button" onClick={() => setMode("preview")}>
        Preview PDF
      </button>
      <button className="btn-secondary" type="button" onClick={() => setMode("print")}>
        Print PDF
      </button>
      <dialog
        ref={dialog}
        className="pdf-dialog"
        onCancel={() => setMode(null)}
        onClose={() => setMode(null)}
      >
        {mode && (
          <PdfViewer
            href={href}
            title={title}
            autoPrint={mode === "print"}
            onClose={() => setMode(null)}
          />
        )}
      </dialog>
    </>
  );
}
