import { useEffect, useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { fetchAgents } from '../api/agents';
import { fetchVehicules, setVehiculePretable } from '../api/vehicules';
import {
  fetchPrets,
  createPret,
  setPretStatut,
  deletePret,
  fetchMesPretsValidables,
} from '../api/prets';
import type { Agent, PretVehicule, StatutPret, Vehicule } from '../lib/types';
import { daysAgo } from '../lib/dates';
import { Badge, Button, Card, EmptyState, ErrorBanner, Field, PageHeader, Spinner, Choice } from '../components/ui/Primitives';
import { AgentLink } from '../components/ui/AgentLink';
import { useToast } from '../components/ui/Toast';
import { confirmAction } from '../lib/confirm';

const STATUT_LABEL: Record<StatutPret, string> = { en_attente: 'en attente', valide: 'validé', refuse: 'refusé' };
const STATUT_TONE: Record<StatutPret, 'amber' | 'green' | 'red'> = { en_attente: 'amber', valide: 'green', refuse: 'red' };

function dateHeure(iso: string): string {
  return new Date(iso).toLocaleString('fr-FR', { weekday: 'short', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

export function PretsPage() {
  const { agent } = useAuth();
  const { showToast } = useToast();
  const isSuperadmin = agent?.niveau_acces === 'superadmin';
  const [vehicules, setVehicules] = useState<Vehicule[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [prets, setPrets] = useState<PretVehicule[]>([]);
  const [validables, setValidables] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  // Demande
  const [vehiculeId, setVehiculeId] = useState('');
  const [debut, setDebut] = useState('');
  const [fin, setFin] = useState('');
  const [motif, setMotif] = useState('');

  async function reload() {
    const [v, p, ids] = await Promise.all([fetchVehicules(), fetchPrets(daysAgo(30)), fetchMesPretsValidables()]);
    setVehicules(v);
    setPrets(p);
    setValidables(new Set(ids));
  }

  useEffect(() => {
    Promise.all([fetchAgents(), reload()])
      .then(([a]) => setAgents(a))
      .catch(() => setError('Impossible de charger les prêts de véhicule.'))
      .finally(() => setLoading(false));
  }, []);

  const vehiculeNom = (id: string) => vehicules.find((v) => v.id === id)?.nom ?? 'Véhicule inconnu';
  const agentNom = (id: string) => {
    const a = agents.find((x) => x.id === id);
    return a ? `${a.prenom} ${a.nom}` : 'Agent inconnu';
  };

  async function run(action: () => Promise<void>, errMsg: string) {
    setError(null);
    try {
      await action();
      await reload();
    } catch (err) {
      console.error(err);
      const msg = (err as { message?: string })?.message;
      // Messages explicites levés par le trigger (chevauchement, etc.).
      setError(msg && /prêt|véhicule/i.test(msg) ? msg : errMsg);
    }
  }

  async function handleDemande(e: React.FormEvent) {
    e.preventDefault();
    if (!agent || !vehiculeId || !debut || !fin) {
      setError('Choisis un véhicule, une date de début et une date de fin.');
      return;
    }
    const debutIso = new Date(debut).toISOString();
    const finIso = new Date(fin).toISOString();
    if (finIso <= debutIso) {
      setError('La fin du prêt doit être après le début.');
      return;
    }
    const conflit = prets.find(
      (p) => p.vehicule_id === vehiculeId && p.statut === 'valide' && p.debut < finIso && p.fin > debutIso
    );
    if (conflit) {
      setError(`Ce véhicule est déjà prêté à ${agentNom(conflit.emprunteur_id)} du ${dateHeure(conflit.debut)} au ${dateHeure(conflit.fin)}.`);
      return;
    }
    setSending(true);
    await run(async () => {
      await createPret({ vehiculeId, emprunteurId: agent.id, debut: debutIso, fin: finIso, motif: motif.trim() });
      setVehiculeId('');
      setDebut('');
      setFin('');
      setMotif('');
      showToast('Demande envoyée : un admin de garde doit la valider.');
    }, "Impossible d'enregistrer la demande.");
    setSending(false);
  }

  if (loading) return <Spinner />;

  const actifs = vehicules.filter((v) => v.pretable);
  const enAttente = prets.filter((p) => p.statut === 'en_attente');
  const traites = prets.filter((p) => p.statut !== 'en_attente');

  function renderPret(p: PretVehicule) {
    const peutValider = validables.has(p.id);
    const estMoi = p.emprunteur_id === agent?.id;
    return (
      <div key={p.id} style={{ borderTop: '1px solid var(--border)', paddingTop: 8 }}>
        <div className="list-row" style={{ border: 'none' }}>
          <span>
            <strong>{vehiculeNom(p.vehicule_id)}</strong>{' '}
            <Badge tone={STATUT_TONE[p.statut]}>{STATUT_LABEL[p.statut]}</Badge>
          </span>
          <span className="mono" style={{ fontSize: 12, color: 'var(--text-3)' }}>
            {dateHeure(p.debut)} → {dateHeure(p.fin)}
          </span>
        </div>
        {p.motif && <p style={{ fontSize: 13, whiteSpace: 'pre-wrap', margin: '4px 0' }}>{p.motif}</p>}
        <div style={{ fontSize: 12, color: 'var(--text-3)' }}>
          Emprunté par <AgentLink agentId={p.emprunteur_id}>{agentNom(p.emprunteur_id)}</AgentLink>
          {p.valide_par && (
            <>
              {' · '}
              {p.statut === 'valide' ? 'Validé' : 'Refusé'} par <AgentLink agentId={p.valide_par}>{agentNom(p.valide_par)}</AgentLink>
              {p.valide_at && ` le ${new Date(p.valide_at).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })}`}
            </>
          )}
          {estMoi && p.statut === 'en_attente' && (
            <>
              {' · '}
              <button className="link-delete" onClick={() => confirmAction('Annuler cette demande ?') && run(() => deletePret(p.id), "Impossible d'annuler la demande.")}>annuler</button>
            </>
          )}
          {isSuperadmin && !(estMoi && p.statut === 'en_attente') && (
            <>
              {' · '}
              <button className="link-delete" onClick={() => confirmAction('Supprimer ce prêt ?') && run(() => deletePret(p.id), 'Impossible de supprimer.')}>supprimer</button>
            </>
          )}
        </div>
        {peutValider && (
          <div className="btn-row" style={{ marginTop: 8 }}>
            {p.statut !== 'valide' && (
              <Button onClick={() => run(async () => { await setPretStatut(p.id, 'valide'); showToast('Prêt validé.'); }, 'Impossible de valider ce prêt.')}>Valider</Button>
            )}
            {p.statut !== 'refuse' && (
              <Button variant="secondary" onClick={() => run(async () => { await setPretStatut(p.id, 'refuse'); showToast('Prêt refusé.'); }, 'Impossible de refuser ce prêt.')}>Refuser</Button>
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="stack">
      <PageHeader title="Prêts de véhicule" sub="Demande un véhicule : un admin de la garde en service pendant le prêt le valide." />
      {error && <ErrorBanner message={error} />}

      <Card accent="brand">
        <form className="stack-sm" onSubmit={handleDemande}>
          <strong>Demander un véhicule</strong>
          {actifs.length === 0 ? (
            <EmptyState>Aucun véhicule disponible au prêt pour l'instant.</EmptyState>
          ) : (
            <>
              <Field label="Véhicule">
                <Choice
                  ariaLabel="Véhicule"
                  value={vehiculeId}
                  onChange={setVehiculeId}
                  options={actifs.map((v) => ({ value: v.id, label: v.nom, hint: v.immatriculation ?? undefined }))}
                />
              </Field>
              <div className="field-row">
                <Field label="Début">
                  <input type="datetime-local" className="input" value={debut} onChange={(e) => setDebut(e.target.value)} />
                </Field>
                <Field label="Fin">
                  <input type="datetime-local" className="input" value={fin} min={debut || undefined} onChange={(e) => setFin(e.target.value)} />
                </Field>
              </div>
              <Field label="Motif (facultatif)">
                <textarea className="input" rows={2} maxLength={500} value={motif} onChange={(e) => setMotif(e.target.value)} placeholder="Ex : formation à l'école départementale" />
              </Field>
              <div>
                <Button type="submit" disabled={sending}>{sending ? 'Envoi…' : 'Envoyer la demande'}</Button>
              </div>
            </>
          )}
        </form>
      </Card>

      <Card>
        <strong>Demandes en attente</strong>
        <div className="stack-sm" style={{ marginTop: 10 }}>
          {enAttente.length === 0 && <EmptyState>Aucune demande en attente.</EmptyState>}
          {enAttente.map(renderPret)}
        </div>
      </Card>

      <Card>
        <strong>Prêts validés et refusés</strong>
        <div className="stack-sm" style={{ marginTop: 10 }}>
          {traites.length === 0 && <EmptyState>Aucun prêt traité récemment.</EmptyState>}
          {traites.map(renderPret)}
        </div>
      </Card>

      {isSuperadmin && (
        <Card>
          <strong>Véhicules prêtables</strong>
          <p style={{ fontSize: 12.5, color: 'var(--text-3)', margin: '4px 0 0' }}>Coche les véhicules qui peuvent être demandés en prêt (la liste vient de la page Véhicules).</p>
          <div className="stack-sm" style={{ marginTop: 10 }}>
            {vehicules.length === 0 && <EmptyState>Aucun véhicule — ajoute-en depuis la page Véhicules.</EmptyState>}
            {vehicules.map((v) => (
              <label key={v.id} className="checkbox-pill">
                <input type="checkbox" checked={!!v.pretable} onChange={() => run(() => setVehiculePretable(v.id, !v.pretable), 'Impossible de modifier ce véhicule.')} />
                {v.nom}
                {v.immatriculation && <span className="mono" style={{ color: 'var(--text-3)' }}> · {v.immatriculation}</span>}
              </label>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
