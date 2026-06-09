import { useToast } from "./Toast";

export default function ExportDialog({
  title,
  subtitle,
  text,
  filename,
  onClose,
}: {
  title: string;
  subtitle?: string;
  text: string;
  filename: string;
  onClose: () => void;
}) {
  const toast = useToast();

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      toast("Copied to clipboard.", "success");
    } catch {
      toast("Copy failed — select the text and copy manually.", "error");
    }
  };

  const download = () => {
    const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="card w-full max-w-lg p-4" onClick={(e) => e.stopPropagation()}>
        <div className="mb-1 flex items-center gap-3">
          <h2 className="text-lg font-bold">{title}</h2>
          <button className="btn-secondary btn-sm ml-auto" onClick={onClose}>
            Close
          </button>
        </div>
        {subtitle && <p className="mb-2 text-xs text-muted">{subtitle}</p>}
        <textarea
          readOnly
          className="input h-72 w-full resize-none font-mono text-xs leading-relaxed"
          value={text}
          onFocus={(e) => e.currentTarget.select()}
        />
        <div className="mt-3 flex gap-2">
          <button className="btn-primary" onClick={copy}>
            Copy
          </button>
          <button className="btn-secondary" onClick={download}>
            Download .txt
          </button>
        </div>
      </div>
    </div>
  );
}
