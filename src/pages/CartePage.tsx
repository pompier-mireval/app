import { useEffect, useMemo, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Button, Card, Choice, EmptyState, ErrorBanner, PageHeader, Spinner } from '../components/ui/Primitives';

// Points d'eau incendie du SDIS 34 (data.gouv.fr, ODbL, février 2024),
// convertis de Lambert 93 en WGS84 : [id_sdis, type, privé (0/1), diamètre, lat, lon, situation].
type PeiRow = [string, string, 0 | 1, number, number, number, string];
interface Pei {
  id: string;
  type: string;
  prive: boolean;
  diam: number;
  lat: number;
  lon: number;
  situation: string;
}

const TYPE_LABEL: Record<string, string> = {
  PI: 'Poteau incendie',
  BI: 'Bouche incendie',
  CI: 'Citerne',
  PA: "Point d'aspiration",
  BA: 'Bâche',
  PR: 'PR',
};
const TYPE_COLOR: Record<string, string> = { PI: '#D62828', BI: '#7B3FBF' };
// Bleu réservé à « ma position », comme dans Plans / Google Maps.
const MOI_COLOR = '#1A73E8';
const AUTRE_COLOR = '#1E8F5F';

// Centre par défaut : Mireval.
const CENTRE: L.LatLngTuple = [43.508, 3.73];
// En dessous de ce zoom, trop de points à l'écran : on n'affiche rien.
const ZOOM_MIN_POINTS = 13;

function distanceM(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000;
  const rad = Math.PI / 180;
  const dLat = (lat2 - lat1) * rad;
  const dLon = (lon2 - lon1) * rad;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

function formatDistance(m: number): string {
  return m < 1000 ? `${Math.round(m)} m` : `${(m / 1000).toFixed(m < 10000 ? 1 : 0).replace('.', ',')} km`;
}

function itineraireUrl(p: Pei): string {
  return /iPhone|iPad|iPod|Macintosh/.test(navigator.userAgent)
    ? `https://maps.apple.com/?daddr=${p.lat},${p.lon}&dirflg=d`
    : `https://www.google.com/maps/dir/?api=1&destination=${p.lat},${p.lon}`;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}

function popupHtml(p: Pei): string {
  const details = [p.diam ? `Ø ${p.diam}` : '', p.prive ? 'privé' : 'public'].filter(Boolean).join(' · ');
  return `<strong>${escapeHtml(TYPE_LABEL[p.type] ?? p.type)} ${escapeHtml(p.id)}</strong><br>
    <span>${escapeHtml(details)}</span>
    ${p.situation ? `<br><span>${escapeHtml(p.situation)}</span>` : ''}
    <br><a href="${itineraireUrl(p)}" target="_blank" rel="noopener">Itinéraire</a>`;
}

export function CartePage() {
  const mapEl = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const pointsLayer = useRef<L.LayerGroup | null>(null);
  const moiLayer = useRef<L.LayerGroup | null>(null);
  const watchId = useRef<number | null>(null);
  const centreSurMoi = useRef(false);
  const [peis, setPeis] = useState<Pei[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [zoomTropFaible, setZoomTropFaible] = useState(false);
  const [position, setPosition] = useState<{ lat: number; lon: number; precision: number } | null>(null);
  const [localisation, setLocalisation] = useState<'off' | 'recherche' | 'on'>('off');
  const [filtre, setFiltre] = useState<'PI' | 'tous'>('PI');

  useEffect(() => {
    fetch(`${import.meta.env.BASE_URL}data/pei34.json`)
      .then((r) => {
        if (!r.ok) throw new Error(String(r.status));
        return r.json() as Promise<PeiRow[]>;
      })
      .then((rows) =>
        setPeis(rows.map(([id, type, prive, diam, lat, lon, situation]) => ({ id, type, prive: prive === 1, diam, lat, lon, situation })))
      )
      .catch(() => setError("Impossible de charger les points d'eau incendie."))
      .finally(() => setLoading(false));
  }, []);

  // Création de la carte une fois les données là (le conteneur n'existe
  // qu'après le chargement).
  useEffect(() => {
    if (loading || !mapEl.current || mapRef.current) return;
    const map = L.map(mapEl.current, { preferCanvas: true }).setView(CENTRE, 15);
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> · PEI : SDIS 34',
    }).addTo(map);
    pointsLayer.current = L.layerGroup().addTo(map);
    moiLayer.current = L.layerGroup().addTo(map);
    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, [loading]);

  // Seuls les points de la zone visible sont dessinés, pour rester fluide
  // sur téléphone (le département en compte près de 20 000).
  useEffect(() => {
    const map = mapRef.current;
    if (!map || peis.length === 0) return;
    const redraw = () => {
      const layer = pointsLayer.current!;
      layer.clearLayers();
      const tropLoin = map.getZoom() < ZOOM_MIN_POINTS;
      setZoomTropFaible(tropLoin);
      if (tropLoin) return;
      const bounds = map.getBounds().pad(0.2);
      for (const p of peis) {
        if (!bounds.contains([p.lat, p.lon])) continue;
        const color = TYPE_COLOR[p.type] ?? AUTRE_COLOR;
        L.circleMarker([p.lat, p.lon], {
          radius: 7,
          color: '#fff',
          weight: 1.5,
          fillColor: color,
          fillOpacity: p.prive ? 0.5 : 0.95,
        })
          .bindPopup(popupHtml(p))
          .addTo(layer);
      }
    };
    redraw();
    map.on('moveend', redraw);
    return () => {
      map.off('moveend', redraw);
    };
  }, [peis, loading]);

  useEffect(() => () => {
    if (watchId.current !== null) navigator.geolocation.clearWatch(watchId.current);
  }, []);

  // Marqueur « moi » et cercle de précision.
  useEffect(() => {
    const layer = moiLayer.current;
    if (!layer || !position) return;
    layer.clearLayers();
    L.circle([position.lat, position.lon], { radius: position.precision, color: MOI_COLOR, weight: 1, fillOpacity: 0.08, interactive: false }).addTo(layer);
    // Marqueur HTML (et non un rond sur le canvas) : il passe au-dessus des
    // points d'eau et son halo animé le distingue d'un PEI.
    L.marker([position.lat, position.lon], {
      icon: L.divIcon({ className: 'pei-moi', html: '<span class="pei-moi-halo"></span><span class="pei-moi-point"></span>', iconSize: [22, 22] }),
      zIndexOffset: 1000,
      keyboard: false,
    })
      .bindPopup('Ma position')
      .addTo(layer);
    if (centreSurMoi.current) {
      centreSurMoi.current = false;
      mapRef.current?.setView([position.lat, position.lon], 17);
    }
  }, [position]);

  function handleLocaliser() {
    if (!('geolocation' in navigator)) {
      setError("La localisation n'est pas disponible sur cet appareil.");
      return;
    }
    if (watchId.current !== null) {
      if (position) mapRef.current?.setView([position.lat, position.lon], 17);
      return;
    }
    setError(null);
    setLocalisation('recherche');
    centreSurMoi.current = true;
    watchId.current = navigator.geolocation.watchPosition(
      (pos) => {
        setPosition({ lat: pos.coords.latitude, lon: pos.coords.longitude, precision: pos.coords.accuracy });
        setLocalisation('on');
      },
      (err) => {
        console.error(err);
        if (watchId.current !== null) navigator.geolocation.clearWatch(watchId.current);
        watchId.current = null;
        setLocalisation('off');
        setError(
          err.code === err.PERMISSION_DENIED
            ? "Localisation refusée : autorise-la pour l'appli dans les réglages du téléphone."
            : 'Impossible de te localiser pour le moment.'
        );
      },
      { enableHighAccuracy: true, maximumAge: 10000, timeout: 20000 }
    );
  }

  const plusProches = useMemo(() => {
    if (!position) return [];
    return peis
      .filter((p) => filtre === 'tous' || p.type === 'PI')
      .map((p) => ({ pei: p, distance: distanceM(position.lat, position.lon, p.lat, p.lon) }))
      .sort((a, b) => a.distance - b.distance)
      .slice(0, 4);
  }, [peis, position, filtre]);

  function voir(p: Pei) {
    const map = mapRef.current;
    if (!map) return;
    map.setView([p.lat, p.lon], 18);
    L.popup().setLatLng([p.lat, p.lon]).setContent(popupHtml(p)).openOn(map);
    mapEl.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  if (loading) return <Spinner />;

  return (
    <div className="stack">
      <PageHeader title="Carte des PEI" sub="Points d'eau incendie du SDIS 34. Localise-toi pour voir les 4 plus proches." />
      {error && <ErrorBanner message={error} />}

      <Card>
        <div className="field-row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
          <Button onClick={handleLocaliser} disabled={localisation === 'recherche'}>
            {localisation === 'recherche' ? 'Localisation…' : localisation === 'on' ? 'Recentrer sur moi' : 'Me localiser'}
          </Button>
          <div className="pei-legende">
            <span><i style={{ background: MOI_COLOR, boxShadow: `0 0 0 3px ${MOI_COLOR}40` }} /> Moi</span>
            <span><i style={{ background: TYPE_COLOR.PI }} /> Poteau</span>
            <span><i style={{ background: TYPE_COLOR.BI }} /> Bouche</span>
            <span><i style={{ background: AUTRE_COLOR }} /> Citerne, aspiration…</span>
            <span><i style={{ background: '#999', opacity: 0.5 }} /> Pâle = privé</span>
          </div>
        </div>
        <div className="pei-map-wrap" style={{ marginTop: 12 }}>
          <div ref={mapEl} className="pei-map" />
          {zoomTropFaible && <div className="pei-map-hint">Zoome pour afficher les points d'eau</div>}
        </div>
      </Card>

      <Card accent="brand">
        <div className="field-row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
          <strong>Les 4 plus proches de moi</strong>
          <Choice
            ariaLabel="Type de point d'eau"
            compact
            value={filtre}
            onChange={(v) => setFiltre(v as 'PI' | 'tous')}
            options={[{ value: 'PI', label: 'Poteaux' }, { value: 'tous', label: 'Tous les PEI' }]}
          />
        </div>
        <div className="stack-sm" style={{ marginTop: 10 }}>
          {!position && <EmptyState>Appuie sur « Me localiser » pour calculer les distances.</EmptyState>}
          {plusProches.map(({ pei, distance }, i) => (
            <div key={pei.id} className="list-row" style={{ alignItems: 'flex-start' }}>
              <span style={{ minWidth: 0 }}>
                <strong>{i + 1}. {formatDistance(distance)}</strong>{' '}
                <span style={{ color: 'var(--text-2)' }}>
                  · {TYPE_LABEL[pei.type] ?? pei.type} <span className="mono">{pei.id}</span>
                  {pei.diam ? ` · Ø ${pei.diam}` : ''}
                  {pei.prive ? ' · privé' : ''}
                </span>
                {pei.situation && <div style={{ fontSize: 12, color: 'var(--text-3)' }}>{pei.situation}</div>}
              </span>
              <span className="btn-row" style={{ flexShrink: 0 }}>
                <Button variant="secondary" onClick={() => voir(pei)}>Voir</Button>
                <a className="btn-secondary" href={itineraireUrl(pei)} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-flex', alignItems: 'center' }}>
                  Itinéraire
                </a>
              </span>
            </div>
          ))}
          {position && (
            <p style={{ fontSize: 12, color: 'var(--text-3)', margin: 0 }}>
              Distances à vol d'oiseau, précision de ta position : ± {Math.round(position.precision)} m. Données SDIS 34 de février 2024 : vérifie sur place.
            </p>
          )}
        </div>
      </Card>
    </div>
  );
}
