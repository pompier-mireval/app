import { useEffect, useId, useRef, useState } from 'react';
import { Button } from './Primitives';

type Scanner = import('html5-qrcode').Html5Qrcode;

// Scanner QR / code-barres. Deux modes : caméra en direct, et lecture d'une
// photo prise avec l'appareil photo (plus fiable sur certains téléphones).
// La librairie n'est chargée qu'à l'ouverture. Caméra : HTTPS obligatoire.
export function CodeScanner({ onCode, onClose }: { onCode: (code: string) => void; onClose: () => void }) {
  const zoneId = useId().replace(/:/g, '');
  const scannerRef = useRef<Scanner | null>(null);
  const doneRef = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const options = { verbose: false, useBarCodeDetectorIfSupported: true };

  useEffect(() => {
    let annule = false;
    (async () => {
      try {
        const { Html5Qrcode } = await import('html5-qrcode');
        if (annule) return;
        const scanner = new Html5Qrcode(zoneId, options);
        scannerRef.current = scanner;
        await scanner.start(
          { facingMode: 'environment' },
          {
            fps: 15,
            // Pas de cadre restreint : toute l'image est analysée (utile pour
            // les codes-barres larges). Haute résolution demandée pour la netteté.
            aspectRatio: 1.333,
            videoConstraints: {
              facingMode: 'environment',
              width: { ideal: 1920 },
              height: { ideal: 1080 },
              // @ts-expect-error — propriété non typée mais acceptée par les navigateurs
              focusMode: 'continuous',
            },
          },
          (texte) => {
            if (doneRef.current) return;
            doneRef.current = true;
            onCode(texte);
          },
          () => { /* pas de code dans l'image : on continue */ },
        );
      } catch (err) {
        console.error(err);
        setError("Caméra indisponible. Autorise-la dans le navigateur, ou utilise « Prendre en photo » / saisis le code à la main.");
      }
    })();
    return () => {
      annule = true;
      doneRef.current = true;
      const s = scannerRef.current;
      scannerRef.current = null;
      if (s) s.stop().then(() => s.clear()).catch(() => { /* déjà arrêté */ });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zoneId, onCode]);

  async function handlePhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const live = scannerRef.current;
      if (live) {
        scannerRef.current = null;
        await live.stop().catch(() => undefined);
      }
      const { Html5Qrcode } = await import('html5-qrcode');
      const lecteur = new Html5Qrcode(`${zoneId}-photo`, options);
      const texte = await lecteur.scanFile(file, false);
      doneRef.current = true;
      onCode(texte);
    } catch (err) {
      console.error(err);
      setError("Aucun code lu sur cette photo. Rapproche-toi, évite les reflets, cadre bien le code et réessaie.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="stack-sm">
      <div id={zoneId} style={{ width: '100%', maxWidth: 400 }} />
      <div id={`${zoneId}-photo`} style={{ display: 'none' }} />
      {error && <div style={{ fontSize: 13, color: 'var(--red, #ef4444)' }}>{error}</div>}
      <div style={{ fontSize: 12, color: 'var(--text-3)' }}>
        Cadre le code en entier, bien net et éclairé. S'il ne se lit pas, prends-le en photo.
      </div>
      <div className="field-row">
        <label className="btn-secondary" style={{ cursor: busy ? 'wait' : 'pointer', display: 'inline-block' }}>
          {busy ? 'Lecture…' : 'Prendre en photo'}
          <input type="file" accept="image/*" capture="environment" hidden disabled={busy} onChange={handlePhoto} />
        </label>
        <Button type="button" variant="secondary" onClick={onClose}>Annuler le scan</Button>
      </div>
    </div>
  );
}
