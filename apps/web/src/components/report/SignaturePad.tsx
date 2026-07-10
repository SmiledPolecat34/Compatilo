import { useEffect, useRef, useState } from 'react';
import SignaturePadLib from 'signature_pad';

export default function SignaturePad({
  onSave,
  disabled,
}: {
  onSave: (dataUrl: string) => Promise<void>;
  disabled?: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const padRef = useRef<SignaturePadLib | null>(null);
  const [isEmpty, setIsEmpty] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Résolution adaptée au devicePixelRatio (netteté Retina)
    const ratio = Math.max(window.devicePixelRatio || 1, 1);
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * ratio;
    canvas.height = rect.height * ratio;
    canvas.getContext('2d')?.scale(ratio, ratio);

    const pad = new SignaturePadLib(canvas, {
      penColor: '#3b2a63',
      backgroundColor: 'rgba(255,255,255,0)',
    });
    pad.addEventListener('endStroke', () => setIsEmpty(pad.isEmpty()));
    padRef.current = pad;
    return () => pad.off();
  }, []);

  async function save() {
    const pad = padRef.current;
    if (!pad || pad.isEmpty()) return;
    setSaving(true);
    try {
      await onSave(pad.toDataURL('image/png'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <canvas
        ref={canvasRef}
        className="h-40 w-full touch-none rounded-2xl border-2 border-dashed border-brand-200 bg-white"
        aria-label="Zone de signature"
      />
      <div className="mt-3 flex gap-2">
        <button
          type="button"
          className="btn-secondary flex-1"
          onClick={() => {
            padRef.current?.clear();
            setIsEmpty(true);
          }}
          disabled={disabled || saving}
        >
          Effacer
        </button>
        <button
          type="button"
          className="btn-primary flex-1"
          onClick={save}
          disabled={disabled || isEmpty || saving}
        >
          {saving ? 'Enregistrement…' : 'Signer ✓'}
        </button>
      </div>
    </div>
  );
}
