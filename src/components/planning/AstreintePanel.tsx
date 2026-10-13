import { useEffect, useMemo, useState } from 'react';
import { fetchAllAgentGardes } from '../../api/gardes';
import { fetchGardeSemainesForDate } from '../../api/gardeSemaines';
import { fetchCompetences } from '../../api/competences';
import { fetchDisponibilitesForRange } from '../../api/disponibilites';
import {
  fetchAstreintesForRange,
  fetchAstreinteConfig,
  saveAstreinteConfig,
  createAstreintes,
  deleteAstreinte,
  deleteAstreintesForRange,
} from '../../api/astreintes';
import type { Agent, AgentCompetence, Affectation, Astreinte, AstreinteConfig, Competence } from '../../lib/types';
import { addDays, daysAgo, mondayOf } from '../../lib/dates';
import {
  CATEGORIES,
  NB_MAX_DEFAUT,
  categorieOf,
  pickAstreintes,
  resolveCompetences,
  type Candidat,
} from '../../lib/astreinte';
import { AgentLink } from '../ui/AgentLink';
import { Badge, Button, Card, EmptyState, ErrorBanner, Field } from '../ui/Primitives';
import { useToast } from '../ui/Toast';
import { confirmAction } from '../../lib/confirm';

interface Props {
  date: string;
  agents: Agent[]; // agents actifs
  agentCompetences: AgentCompetence[];
  affectations: Affectation[]; // affectations du jour affiché
  canEdit: boolean;
}

// Aperçu des astreints de la garde de jour (Lun-Ven) pour la date affichée,
// classés en 3 listes selon leur plus haute compétence, avec génération
// équilibrée de la semaine (le moins d'astreintes récentes passe en premier).
export function AstreintePanel({ date, agents, agentCompetences, affectations, canEdit }: Props) {
  const { showToast } = useToast();
  const monday = mondayOf(date);
  const friday = addDays(monday, 4);
  const isWeekday = date >= monday && date <= friday;

  const [competences, setCompetences] = useState<Competence[]>([]);
  const [config, setConfig] = useState<AstreinteConfig | null>(null);
  const [membresIds, setMembresIds] = useState<Set<string>>(new Set());
  const [gardeDefinie, setGardeDefinie] = useState(true);
  const [astreintes, setAstreintes] = useState<Astreinte[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showConfig, setShowConfig] = useState(false);
  const [addId, setAddId] = useState('');

  const comps = useMemo(() => resolveCompetences(config), [config]);
  const nbMax = config?.nb_max ?? NB_MAX_DEFAUT;

  useEffect(() => {
    Promise.all([fetchCompetences(), fetchAstreinteConfig()])
      .then(([c, cfg]) => {
        setCompetences(c);
        setConfig(cfg);
      })
      .catch(() => setError("Impossible de charger la configuration des astreintes."));
  }, []);

  async function reload() {
    const [gs, links, ast] = await Promise.all([
      fetchGardeSemainesForDate(monday),
      fetchAllAgentGardes(),
      fetchAstreintesForRange(monday, friday),
    ]);
    const gardeId = gs.find((g) => g.type === 'jour')?.garde_id;
    setGardeDefinie(!!gardeId);
    setMembresIds(new Set(links.filter((l) => l.garde_id === gardeId).map((l) => l.agent_id)));
    setAstreintes(ast);
  }

  useEffect(() => {
    if (!isWeekday) return;
    reload().catch(() => setError('Impossible de charger les astreintes.'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [monday, isWeekday]);

  if (!isWeekday) return null;

  const agentById = (id: string) => agents.find((a) => a.id === id);
  const label = (id: string) => {
    const a = agentById(id);
    return a ? `${a.prenom} ${a.nom}` : 'Agent inconnu';
  };
  const membres = agents.filter((a) => membresIds.has(a.id));
  const duJour = astreintes.filter((a) => a.date === date && agentById(a.agent_id));
  const affectesIds = new Set(affectations.map((a) => a.agent_id));

  const parCategorie = CATEGORIES.map(({ key, label: titre }) => ({
    key,
    titre,
    items: duJour.filter((a) => categorieOf(a.agent_id, agentCompetences, comps) === key),
  }));
  const sansCategorie = duJour.filter((a) => categorieOf(a.agent_id, agentCompetences, comps) === null);
  const candidatsAjout = membres.filter(
    (a) => !duJour.some((x) => x.agent_id === a.id) && categorieOf(a.id, agentCompetences, comps)
  );

  async function run(action: () => Promise<void>, errMsg: string) {
    setError(null);
    setBusy(true);
    try {
      await action();
      await reload();
    } catch (err) {
      console.error(err);
      setError(errMsg);
    } finally {
      setBusy(false);
    }
  }

  async function handleGenerate() {
    if (membres.length === 0) {
      setError("La garde de jour de cette semaine n'a aucun membre — définis-la dans la vue Semaine.");
      return;
    }
    await run(async () => {
      // Charge = nombre d'astreintes sur les 60 derniers jours (hors semaine
      // en cours, comptée plus bas avec l'existant conservé).
      const [historique, existantes, dispos] = await Promise.all([
        fetchAstreintesForRange(daysAgo(60), addDays(monday, -1)),
        fetchAstreintesForRange(monday, friday),
        fetchDisponibilitesForRange(monday, friday),
      ]);
      const charge = new Map<string, number>();
      for (const a of [...historique, ...existantes]) charge.set(a.agent_id, (charge.get(a.agent_id) ?? 0) + 1);

      const nouvelles: { agentId: string; date: string }[] = [];
      for (let i = 0; i < 5; i++) {
        const day = addDays(monday, i);
        const deja = new Set(existantes.filter((a) => a.date === day).map((a) => a.agent_id));
        const candidats: Candidat[] = [];
        for (const a of membres) {
          const categorie = categorieOf(a.id, agentCompetences, comps);
          if (!categorie) continue;
          // Sans dispo déclarée (ou déclarée indisponible), pas d'astreinte.
          if (!dispos.some((d) => d.agent_id === a.id && d.date === day && d.statut !== 'indisponible')) continue;
          candidats.push({ agentId: a.id, categorie, label: `${a.nom} ${a.prenom}` });
        }
        // Les astreints déjà posés à la main restent, même s'ils ne sont
        // plus dans les candidats (indisponibles, sans catégorie…).
        for (const id of pickAstreintes(candidats, deja, nbMax, charge)) nouvelles.push({ agentId: id, date: day });
      }
      await createAstreintes(nouvelles);
      showToast(nouvelles.length > 0 ? `${nouvelles.length} astreinte(s) générée(s).` : 'Rien à générer : semaine déjà complète.');
    }, 'La génération des astreintes a échoué.');
  }

  async function handleReset() {
    if (!confirmAction('Supprimer toutes les astreintes de cette semaine ?')) return;
    await run(() => deleteAstreintesForRange(monday, friday), 'Impossible de supprimer les astreintes.');
  }

  async function handleAdd() {
    if (!addId) return;
    await run(async () => {
      await createAstreintes([{ agentId: addId, date }]);
      setAddId('');
    }, "Impossible d'ajouter cette astreinte.");
  }

  async function handleRemove(id: string) {
    await run(() => deleteAstreinte(id), 'Impossible de retirer cette astreinte.');
  }

  async function handleSaveConfig(patch: Partial<Omit<AstreinteConfig, 'id'>>) {
    const next: Omit<AstreinteConfig, 'id'> = {
      nb_max: config?.nb_max ?? NB_MAX_DEFAUT,
      competence_ca_id: config?.competence_ca_id ?? null,
      competence_conducteur_id: config?.competence_conducteur_id ?? null,
      competence_equipier_id: config?.competence_equipier_id ?? null,
      ...patch,
    };
    setError(null);
    try {
      await saveAstreinteConfig(next);
      setConfig({ id: 1, ...next });
    } catch (err) {
      console.error(err);
      setError("Impossible d'enregistrer la configuration.");
    }
  }

  const compSelect = (field: 'competence_ca_id' | 'competence_conducteur_id' | 'competence_equipier_id', titre: string, current: string | null) => (
    <Field label={titre}>
      <select className="input" value={current ?? ''} onChange={(e) => handleSaveConfig({ [field]: e.target.value || null })}>
        <option value="">— non définie —</option>
        {competences.map((c) => (
          <option key={c.id} value={c.id}>{c.nom}</option>
        ))}
      </select>
    </Field>
  );

  return (
    <Card accent="brand">
      <div className="field-row" style={{ justifyContent: 'space-between' }}>
        <strong>Astreinte garde de jour — {duJour.length}/{nbMax}</strong>
        {canEdit && (
          <div className="no-print" style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <Button onClick={handleGenerate} disabled={busy}>{busy ? 'En cours…' : 'Générer la semaine'}</Button>
            <Button variant="secondary" onClick={handleReset} disabled={busy}>Vider la semaine</Button>
            <Button variant="secondary" onClick={() => setShowConfig((v) => !v)}>Réglages</Button>
          </div>
        )}
      </div>
      {error && <ErrorBanner message={error} />}

      {gardeDefinie && !comps.ca && !comps.conducteur && !comps.equipier && (
        <EmptyState>Choisis les compétences de chaque catégorie dans « Réglages ».</EmptyState>
      )}
      {!gardeDefinie && (
        <EmptyState>Aucune garde de jour définie pour cette semaine (vue Semaine).</EmptyState>
      )}

      {canEdit && showConfig && (
        <div className="field-row no-print" style={{ marginTop: 12, borderTop: '1px solid var(--border)', paddingTop: 12 }}>
          <Field label="Astreints max par jour">
            <input
              type="number"
              className="input"
              min={3}
              max={50}
              value={nbMax}
              onChange={(e) => {
                const n = Math.floor(Number(e.target.value));
                if (n >= 3 && n <= 50) handleSaveConfig({ nb_max: n });
              }}
            />
          </Field>
          {compSelect('competence_ca_id', 'Compétence CA VSAV', comps.ca)}
          {compSelect('competence_conducteur_id', 'Compétence Conducteur', comps.conducteur)}
          {compSelect('competence_equipier_id', 'Compétence Équipier VSAV', comps.equipier)}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16, marginTop: 12 }}>
        {parCategorie.map(({ key, titre, items }) => (
          <div key={key}>
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>{titre} ({items.length})</div>
            {items.length === 0 && <EmptyState>Personne.</EmptyState>}
            {items.map((a) => (
              <div key={a.id} className="list-row" style={{ padding: '6px 0' }}>
                <span>
                  <AgentLink agentId={a.agent_id}>{label(a.agent_id)}</AgentLink>{' '}
                  <Badge tone={affectesIds.has(a.agent_id) ? 'neutral' : 'green'}>
                    {affectesIds.has(a.agent_id) ? 'affecté' : 'sollicitable'}
                  </Badge>
                </span>
                {canEdit && (
                  <button className="link-delete no-print" onClick={() => handleRemove(a.id)}>retirer</button>
                )}
              </div>
            ))}
          </div>
        ))}
      </div>

      {sansCategorie.length > 0 && (
        <p style={{ fontSize: 12.5, color: 'var(--text-3)', marginTop: 8 }}>
          Sans catégorie (compétences non reconnues) : {sansCategorie.map((a) => label(a.agent_id)).join(', ')}
        </p>
      )}

      {canEdit && (
        <div className="field-row no-print" style={{ marginTop: 12 }}>
          <Field label="Ajouter manuellement">
            <select className="input" value={addId} onChange={(e) => setAddId(e.target.value)}>
              <option value="">— choisir un membre de la garde —</option>
              {candidatsAjout.map((a) => (
                <option key={a.id} value={a.id}>{a.prenom} {a.nom}</option>
              ))}
            </select>
          </Field>
          <Button variant="secondary" onClick={handleAdd} disabled={busy || !addId}>Ajouter</Button>
        </div>
      )}
    </Card>
  );
}
