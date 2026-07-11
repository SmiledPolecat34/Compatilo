import { useEffect, useRef, useState } from 'react';
import SignaturePadLib from 'signature_pad';

const SAVED_SIGNATURE_KEY = 'compatilo_saved_signature';

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
  const [rememberSignature, setRememberSignature] = useState(true);
  const [savedSignature, setSavedSignature] = useState<string | null>(null);

  useEffect(() => {
    setSavedSignature(localStorage.getItem(SAVED_SIGNATURE_KEY));
  }, []);

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
      const image = pad.toDataURL('image/png');
      await onSave(image);
      if (rememberSignature) {
        localStorage.setItem(SAVED_SIGNATURE_KEY, image);
      }
    } finally {
      setSaving(false);
    }
  }

  async function useSavedSignature() {
    if (!savedSignature) return;
    setSaving(true);
    try {
      await onSave(savedSignature);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      {savedSignature && (
        <div className="mb-3 flex items-center justify-between gap-3 rounded-xl border border-brand-100 bg-brand-50 p-3">
          <div className="flex items-center gap-3">
            <img src={savedSignature} alt="Signature enregistrée" className="h-10 object-contain" />
            <span className="text-xs text-slate-500">Signature enregistrée sur cet appareil</span>
          </div>
          <button
            type="button"
            className="btn-secondary shrink-0 px-3 py-1.5 text-sm"
            onClick={useSavedSignature}
            disabled={disabled || saving}
          >
            Utiliser celle-ci
          </button>
        </div>
      )}
      <canvas
        ref={canvasRef}
        className="h-40 w-full touch-none rounded-2xl border-2 border-dashed border-brand-200 bg-surface"
        aria-label="Zone de signature"
      />
      <label className="mt-2 flex cursor-pointer items-center gap-2 text-xs text-slate-500">
        <input
          type="checkbox"
          className="h-4 w-4 accent-brand-600"
          checked={rememberSignature}
          onChange={(e) => setRememberSignature(e.target.checked)}
        />
        Enregistrer cette signature sur cet appareil pour la réutiliser
      </label>
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
