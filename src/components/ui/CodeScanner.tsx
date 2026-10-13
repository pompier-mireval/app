import { useEffect, useId, useState } from 'react';
import { Button } from './Primitives';

// Scanner QR / code-barres via la caméra. La librairie n'est chargée qu'à
// l'ouverture du scanner. La caméra exige HTTPS (ou localhost).
export function CodeScanner({ onCode, onClose }: { onCode: (code: string) => void; onClose: () => void }) {
  const zoneId = useId().replace(/:/g, '');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let scanner: import('html5-qrcode').Html5Qrcode | null = null;
    let stopped = false;
    (async () => {
      try {
        const { Html5Qrcode } = await import('html5-qrcode');
        if (stopped) return;
        scanner = new Html5Qrcode(zoneId);
        await scanner.start(
          { facingMode: 'environment' },
          { fps: 10, qrbox: { width: 260, height: 160 } },
          (texte) => {
            if (stopped) return;
            stopped = true;
            onCode(texte);
          },
          () => { /* pas de code dans l'image : on continue */ },
        );
      } catch (err) {
        console.error(err);
        setError("Impossible d'accéder à la caméra. Autorise-la dans le navigateur, ou saisis le code à la main.");
      }
    })();
    return () => {
      stopped = true;
      if (scanner) {
        const s = scanner;
        s.stop().then(() => s.clear()).catch(() => { /* déjà arrêté */ });
      }
    };
  }, [zoneId, onCode]);

  return (
    <div className="stack-sm">
      <div id={zoneId} style={{ width: '100%', maxWidth: 360 }} />
      {error && <div style={{ fontSize: 13, color: 'var(--red, #ef4444)' }}>{error}</div>}
      <div><Button type="button" variant="secondary" onClick={onClose}>Annuler le scan</Button></div>
    </div>
  );
}
