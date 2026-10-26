import { useEffect, useState } from 'react';
import { Button, Modal } from './Primitives';

// Appli ajoutée à l'écran d'accueil d'un iPhone/iPad : iOS ignore
// window.print() dans ce mode (rien ne s'ouvre).
function isIosStandalone(): boolean {
  const ios = /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const standalone = (navigator as Navigator & { standalone?: boolean }).standalone === true || window.matchMedia('(display-mode: standalone)').matches;
  return ios && standalone;
}

// Copie hors écran du contenu de la page, sans les éléments .no-print et
// en thème clair (voir .print-capture dans print.css), rendue en image.
async function captureMainContent(): Promise<Blob> {
  const source = document.querySelector<HTMLElement>('.main-content');
  if (!source) throw new Error('Contenu introuvable');
  const { default: html2canvas } = await import('html2canvas');
  const wrapper = document.createElement('div');
  wrapper.className = 'print-capture';
  const clone = source.cloneNode(true) as HTMLElement;
  clone.querySelectorAll('.no-print').forEach((el) => el.remove());
  wrapper.appendChild(clone);
  document.body.appendChild(wrapper);
  try {
    const canvas = await html2canvas(wrapper, { backgroundColor: '#ffffff', scale: 2, logging: false });
    return await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Image vide'))), 'image/png')
    );
  } finally {
    wrapper.remove();
  }
}

export function PrintButton({ filename = 'impression' }: { filename?: string }) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

  async function handleClick() {
    if (!isIosStandalone()) {
      window.print();
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const blob = await captureMainContent();
      setFile(new File([blob], `${filename}.png`, { type: 'image/png' }));
      setPreview(URL.createObjectURL(blob));
    } catch (err) {
      console.error(err);
      setError("Impossible de préparer l'impression.");
    } finally {
      setBusy(false);
    }
  }

  // Partage déclenché par un second appui : iOS exige un geste récent de
  // l'utilisateur, perdu pendant la génération de l'image.
  async function handleShare() {
    if (!file || !preview) return;
    if (navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: filename });
      } catch (err) {
        if ((err as Error).name !== 'AbortError') console.error(err);
      }
    } else {
      window.open(preview, '_blank');
    }
  }

  function close() {
    setFile(null);
    setPreview(null);
  }

  return (
    <>
      <Button variant="secondary" onClick={handleClick} disabled={busy}>
        {busy ? 'Préparation…' : 'Imprimer'}
      </Button>
      {error && <span style={{ fontSize: 12, color: 'var(--red)', marginLeft: 8 }}>{error}</span>}
      {preview && (
        <Modal title="Imprimer" onClose={close}>
          <div className="stack-sm">
            <img src={preview} alt="Aperçu de l'impression" style={{ width: '100%', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)' }} />
            <p style={{ fontSize: 12.5, color: 'var(--text-3)' }}>
              Appuie sur « Partager », puis choisis « Imprimer » (ou envoie l'image par message ou mail).
            </p>
            <div className="btn-row">
              <Button onClick={handleShare}>Partager / Imprimer</Button>
              <Button variant="secondary" onClick={close}>Fermer</Button>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}
