import { useRef, useState } from 'react';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { useEscapeToClose } from '../../hooks/useEscapeToClose';
import { useBodyScrollLock } from '../../hooks/useBodyScrollLock';
import ContractView, { type ContractViewProps } from './ContractView';

function buildContractNumber(generatedAt: string, code: string) {
  const d = new Date(generatedAt);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const suffix = code.replace(/[^0-9A-Z]/gi, '').slice(-3).padStart(3, '0');
  return `COMP-${yyyy}-${mm}${dd}-${suffix}`;
}

export default function ContractModal({
  code,
  score,
  generatedAt,
  data,
  signatures,
  myParticipantId,
  onClose,
}: {
  code: string;
  onClose: () => void;
} & Omit<ContractViewProps, 'contractNumber'>) {
  const nodeRef = useRef<HTMLDivElement>(null);
  const [exporting, setExporting] = useState(false);

  useEscapeToClose(true, onClose);
  useBodyScrollLock(true);

  async function capture() {
    if (!nodeRef.current) return null;
    return html2canvas(nodeRef.current, { scale: 2, backgroundColor: '#ffffff', useCORS: true });
  }

  async function downloadPng() {
    setExporting(true);
    try {
      const canvas = await capture();
      if (!canvas) return;
      const link = document.createElement('a');
      link.download = `contrat-compatilo-${code}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    } finally {
      setExporting(false);
    }
  }

  async function downloadPdf() {
    setExporting(true);
    try {
      const canvas = await capture();
      if (!canvas) return;
      // Une seule page, dimensionnée exactement sur le contenu capturé.
      const pdf = new jsPDF({
        orientation: canvas.width >= canvas.height ? 'landscape' : 'portrait',
        unit: 'px',
        format: [canvas.width, canvas.height],
      });
      pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, 0, canvas.width, canvas.height);
      pdf.save(`contrat-compatilo-${code}.pdf`);
    } finally {
      setExporting(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-3 backdrop-blur-sm sm:p-6"
      onClick={(e) => e.target === e.currentTarget && onClose()}
      role="dialog"
      aria-modal="true"
      aria-label="Contrat de compatibilité"
    >
      <div className="my-4 w-full max-w-[1080px]">
        <div className="no-print mb-4 flex flex-wrap items-center justify-between gap-2 rounded-xl bg-white px-4 py-3 shadow-lg">
          <p className="text-sm font-semibold text-slate-700">Aperçu du contrat</p>
          <div className="flex gap-2">
            <button type="button" className="btn-secondary" onClick={downloadPng} disabled={exporting}>
              {exporting ? '…' : 'Télécharger en PNG'}
            </button>
            <button type="button" className="btn-primary" onClick={downloadPdf} disabled={exporting}>
              {exporting ? '…' : 'Télécharger en PDF'}
            </button>
            <button type="button" className="btn-ghost" onClick={onClose}>
              Fermer
            </button>
          </div>
        </div>
        <div className="overflow-x-auto rounded-3xl shadow-2xl">
          <ContractView
            ref={nodeRef}
            contractNumber={buildContractNumber(generatedAt, code)}
            score={score}
            generatedAt={generatedAt}
            data={data}
            signatures={signatures}
            myParticipantId={myParticipantId}
          />
        </div>
      </div>
    </div>
  );
}
