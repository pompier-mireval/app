import { useEffect, useMemo, useState, Fragment } from 'react';
import { useAuth } from '../hooks/useAuth';
import { fetchVehicules, fetchAllPostes, fetchAllPostesCompetences } from '../api/vehicules';
import { fetchAgents } from '../api/agents';
import { fetchAllAgentCompetences } from '../api/competences';
import { fetchAffectationsForDate, fetchAffectationsForRange, createAffectation, deleteAffectation } from '../api/affectations';
import { fetchCreneauxTypes } from '../api/creneaux';
import { fetchDisponibilitesForDate, fetchDisponibilitesForRange } from '../api/disponibilites';
import { fetchGardes } from '../api/gardes';
import { fetchGardeSemainesForDate, setGardeSemaine, clearGardeSemaine } from '../api/gardeSemaines';
import type { Vehicule, PosteVehicule, Agent, AgentCompetence, Affectation, CreneauType, Disponibilite, Garde, GardeSemaineType } from '../lib/types';
import type { PosteCompetenceLink } from '../api/vehicules';
import { formatHoraire, isHoraireNuit } from '../lib/format';
import {
  todayIso,
  dayLabel,
  daysAgo,
  gardeBlocOf,
  nextGardeBloc,
  prevGardeBloc,
  gardeBlocEnd,
  gardeBlocDays,
  gardeBlocCalendarDays,
  gardeBlocLabel,
} from '../lib/dates';
import { AgentLink } from '../components/ui/AgentLink';
import { Card, ErrorBanner, Spinner, PageHeader, Field, EmptyState, Button, Status, Modal } from '../components/ui/Primitives';
import { useToast } from '../components/ui/Toast';
import { confirmAction } from '../lib/confirm';
import { IconChevronLeft, IconChevronRight } from '../components/ui/Icons';

interface Draft {
  agentId: string;
  creneauId: string; // '' = personnalisé
  heureDebut: string;
  heureFin: string;
}

const EMPTY_DRAFT: Draft = { agentId: '', creneauId: '', heureDebut: '07:00', heureFin: '19:00' };

export function PlanningPage() {
  const { agent } = useAuth();
  const { showToast } = useToast();
  // Lecture ouverte à tous (dispos y compris) ; seuls admin/superadmin
  // peuvent modifier — aligné sur ce qu'autorisent les policies RLS.
  const canEdit = agent?.niveau_acces === 'admin' || agent?.niveau_acces === 'superadmin';
  const [viewMode, setViewMode] = useState<'jour' | 'semaine'>('semaine');
  const [horaireMode, setHoraireMode] = useState<'jour' | 'nuit'>('jour');
  const [date, setDate] = useState(todayIso());
  const [vehicules, setVehicules] = useState<Vehicule[]>([]);
  const [postes, setPostes] = useState<PosteVehicule[]>([]);
  const [postesCompetences, setPostesCompetences] = useState<PosteCompetenceLink[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [agentCompetences, setAgentCompetences] = useState<AgentCompetence[]>([]);
  const [affectations, setAffectations] = useState<Affectation[]>([]);
  const [creneaux, setCreneaux] = useState<CreneauType[]>([]);
  const [dispos, setDispos] = useState<Disponibilite[]>([]);
  const [gardes, setGardes] = useState<Garde[]>([]);
  // Une garde de jour et une garde de nuit peuvent coexister sur un même
  // bloc "semaine" ; un bloc "weekend" n'a que 'weekend' (voir schema_v3.sql).
  const [gardeJourId, setGardeJourId] = useState<string>('');
  const [gardeNuitId, setGardeNuitId] = useState<string>('');
  const [gardeWeekendId, setGardeWeekendId] = useState<string>('');
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [selectedCell, setSelectedCell] = useState<{ posteId: string; date: string; horaire: 'jour' | 'nuit' } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [genProgress, setGenProgress] = useState<{ done: number; total: number } | null>(null);
  const [pendingPostes, setPendingPostes] = useState<Set<string>>(new Set());

  const bloc = useMemo(() => gardeBlocOf(date), [date]);
  const weekStart = bloc.start;
  const weekEnd = useMemo(() => gardeBlocEnd(bloc), [bloc]);
  const weekDays = useMemo(() => gardeBlocCalendarDays(bloc), [bloc]);
  const visibleDays = useMemo(() => gardeBlocDays(bloc, horaireMode), [bloc, horaireMode]);

  // Un week-end (Ven 19h → Lun 7h) s'affiche toujours sur ses 5 créneaux
  // d'un coup — Ven nuit, Sam jour, Sam nuit, Dim jour, Dim nuit — plutôt
  // que de forcer à basculer Journée/Nuit comme pour une semaine classique
  // (le vendredi n'a pas de portion jour dans ce bloc, voir gardeBlocDays).
  interface Slot { date: string; horaire: 'jour' | 'nuit'; label: string }
  const slots: Slot[] = useMemo(() => {
    if (bloc.type === 'weekend') {
      const [vendredi, samedi, dimanche] = weekDays;
      return [
        { date: vendredi, horaire: 'nuit', label: `${dayLabel(vendredi)} nuit` },
        { date: samedi, horaire: 'jour', label: `${dayLabel(samedi)} jour` },
        { date: samedi, horaire: 'nuit', label: `${dayLabel(samedi)} nuit` },
        { date: dimanche, horaire: 'jour', label: `${dayLabel(dimanche)} jour` },
        { date: dimanche, horaire: 'nuit', label: `${dayLabel(dimanche)} nuit` },
      ];
    }
    return visibleDays.map((d) => ({ date: d, horaire: horaireMode, label: dayLabel(d) }));
  }, [bloc, weekDays, visibleDays, horaireMode]);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      fetchVehicules(),
      fetchAllPostes(),
      fetchAllPostesCompetences(),
      fetchAgents(),
      fetchAllAgentCompetences(),
      fetchCreneauxTypes(),
      fetchGardes(),
    ])
      .then(([v, p, pc, a, ac, cr, g]) => {
        setVehicules(v);
        setPostes(p);
        setPostesCompetences(pc);
        setAgents(a.filter((ag) => ag.actif));
        setAgentCompetences(ac);
        setCreneaux(cr);
        setGardes(g);
      })
      .catch(() => setError('Impossible de charger les données du planning.'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (viewMode === 'jour') {
      Promise.all([fetchAffectationsForDate(date), fetchDisponibilitesForDate(date)])
        .then(([a, d]) => {
          setAffectations(a);
          setDispos(d);
        })
        .catch(() => setError('Impossible de charger les données de ce jour.'));
    } else {
      Promise.all([
        fetchAffectationsForRange(weekStart, weekEnd),
        fetchDisponibilitesForRange(weekStart, weekEnd),
        fetchGardeSemainesForDate(weekStart),
      ])
        .then(([a, d, gs]) => {
          setAffectations(a);
          setDispos(d);
          setGardeJourId(gs.find((g) => g.type === 'jour')?.garde_id ?? '');
          setGardeNuitId(gs.find((g) => g.type === 'nuit')?.garde_id ?? '');
          setGardeWeekendId(gs.find((g) => g.type === 'weekend')?.garde_id ?? '');
        })
        .catch(() => setError('Impossible de charger les données de la semaine.'));
    }
  }, [viewMode, date, weekStart, weekEnd]);

  const postesByVehicule = useMemo(() => {
    const map: Record<string, PosteVehicule[]> = {};
    for (const p of postes) (map[p.vehicule_id] ??= []).push(p);
    return map;
  }, [postes]);

  function eligibleAgents(posteId: string): Agent[] {
    const required = postesCompetences.filter((pc) => pc.poste_id === posteId).map((pc) => pc.competence_id);
    if (required.length === 0) return agents;
    const eligibleIds = new Set(
      agentCompetences.filter((ac) => required.includes(ac.competence_id)).map((ac) => ac.agent_id)
    );
    return agents.filter((a) => eligibleIds.has(a.id));
  }

  function affectationsAt(day: string, posteId: string): Affectation[] {
    return affectations.filter((a) => a.date === day && a.poste_vehicule_id === posteId);
  }

  // Filtré selon jour/nuit — n'affecte que l'affichage, jamais les
  // vérifications de conflit (agentsAlreadyOnVehicule, génération auto).
  // Le paramètre par défaut couvre la vue "Jour" (une seule date, pilotée
  // par le bouton Journée/Nuit) ; la vue "Semaine" week-end passe le
  // créneau explicite de chaque colonne (voir `slots`).
  function displayAffectationsAt(day: string, posteId: string, horaire: 'jour' | 'nuit' = horaireMode): Affectation[] {
    return affectationsAt(day, posteId).filter((a) => isHoraireNuit(a, creneaux) === (horaire === 'nuit'));
  }

  function vehiculeIdForPoste(posteId: string): string | undefined {
    return postes.find((p) => p.id === posteId)?.vehicule_id;
  }

  // Un agent peut être affecté le même jour sur plusieurs véhicules, mais
  // une seule fois par véhicule (pas sur deux postes du même engin en même
  // temps). `excludePosteId` sert à ne pas se bloquer soi-même quand on
  // ajoute un deuxième agent sur le poste qu'on est en train de remplir.
  function agentsAlreadyOnVehicule(day: string, vehiculeId: string | undefined, excludePosteId?: string): Set<string> {
    if (!vehiculeId) return new Set();
    const posteIds = new Set((postesByVehicule[vehiculeId] ?? []).map((p) => p.id));
    return new Set(
      affectations
        .filter((a) => a.date === day && a.poste_vehicule_id !== excludePosteId && posteIds.has(a.poste_vehicule_id))
        .map((a) => a.agent_id)
    );
  }

  function dispoOnDay(agentId: string, day: string): Disponibilite | undefined {
    return dispos.find((d) => d.agent_id === agentId && d.date === day);
  }

  function agentLabel(agentId: string): string {
    const a = agents.find((x) => x.id === agentId);
    return a ? `${a.prenom} ${a.nom}` : 'Agent inconnu';
  }
  function agentShortLabel(agentId: string): string {
    const a = agents.find((x) => x.id === agentId);
    return a ? `${a.prenom} ${a.nom[0]}.` : '?';
  }

  function draftFor(posteId: string): Draft {
    return drafts[posteId] ?? EMPTY_DRAFT;
  }
  function updateDraft(posteId: string, patch: Partial<Draft>) {
    setDrafts((prev) => ({ ...prev, [posteId]: { ...draftFor(posteId), ...patch } }));
  }

  async function handleAddAffectation(posteId: string, day: string) {
    const draft = draftFor(posteId);
    if (!draft.agentId) {
      setError('Sélectionne un agent avant d’affecter.');
      return;
    }
    if (agentsAlreadyOnVehicule(day, vehiculeIdForPoste(posteId), posteId).has(draft.agentId)) {
      setError('Cet agent est déjà affecté sur un autre poste de ce véhicule ce jour-là.');
      return;
    }
    setError(null);
    setPendingPostes((prev) => new Set(prev).add(posteId));
    try {
      await createAffectation({
        agentId: draft.agentId,
        posteVehiculeId: posteId,
        date: day,
        creneauTypeId: draft.creneauId || undefined,
        heureDebutPerso: draft.creneauId ? undefined : draft.heureDebut,
        heureFinPerso: draft.creneauId ? undefined : draft.heureFin,
      });
      await refreshCurrentPeriod();
      setDrafts((prev) => ({ ...prev, [posteId]: EMPTY_DRAFT }));
      showToast('Affectation ajoutée.');
    } catch (err) {
      console.error(err);
      setError("Impossible d'ajouter cette affectation.");
    } finally {
      setPendingPostes((prev) => {
        const next = new Set(prev);
        next.delete(posteId);
        return next;
      });
    }
  }

  async function handleRemoveAffectation(id: string) {
    if (!confirmAction('Retirer cette affectation ?')) return;
    setError(null);
    try {
      await deleteAffectation(id);
      setAffectations((prev) => prev.filter((a) => a.id !== id));
      showToast('Affectation retirée.');
    } catch (err) {
      console.error(err);
      setError("Impossible de retirer cette affectation.");
    }
  }

  async function refreshCurrentPeriod() {
    if (viewMode === 'jour') {
      setAffectations(await fetchAffectationsForDate(date));
    } else {
      setAffectations(await fetchAffectationsForRange(weekStart, weekEnd));
    }
  }

  async function handleChangeGardeSemaine(type: GardeSemaineType, gardeId: string) {
    setError(null);
    const setLocal = type === 'jour' ? setGardeJourId : type === 'nuit' ? setGardeNuitId : setGardeWeekendId;
    try {
      if (gardeId) await setGardeSemaine(weekStart, type, gardeId);
      else await clearGardeSemaine(weekStart, type);
      setLocal(gardeId);
    } catch {
      setError('Impossible de définir la garde de la semaine.');
    }
  }

  // Génération automatique équitable : pour chaque jour de la semaine
  // affichée, comble les postes vides avec un agent éligible (compétence),
  // disponible ce jour-là, pas déjà affecté ce même jour, en priorisant
  // celui qui a fait le moins de gardes récemment.
  async function handleAutoGenerate() {
    setError(null);
    setGenerating(true);
    setGenProgress(null);
    try {
      const historique = await fetchAffectationsForRange(daysAgo(60), weekStart);
      const charge = new Map<string, number>();
      for (const a of historique) charge.set(a.agent_id, (charge.get(a.agent_id) ?? 0) + 1);
      for (const a of affectations) charge.set(a.agent_id, (charge.get(a.agent_id) ?? 0) + 1);

      const dispoSemaine = await fetchDisponibilitesForRange(weekStart, weekEnd);
      const nouvelles: { agentId: string; posteId: string; date: string; creneauTypeId?: string; heureDebutPerso?: string; heureFinPerso?: string }[] = [];

      for (const day of weekDays) {
        const dejaAffectesCeJour = new Set(affectations.filter((a) => a.date === day).map((a) => a.agent_id));
        for (const nouv of nouvelles.filter((n) => n.date === day)) dejaAffectesCeJour.add(nouv.agentId);

        for (const vehicule of vehicules) {
          // Un agent ne peut être qu'une seule fois sur un même engin le
          // même jour (deux postes différents du même véhicule) — c'est un
          // vrai blocage, contrairement à la préférence entre véhicules.
          const dejaSurCetEnginCeJour = agentsAlreadyOnVehicule(day, vehicule.id);
          for (const nouv of nouvelles.filter((n) => n.date === day && (postesByVehicule[vehicule.id] ?? []).some((p) => p.id === n.posteId))) {
            dejaSurCetEnginCeJour.add(nouv.agentId);
          }

          for (const poste of postesByVehicule[vehicule.id] ?? []) {
            const dejaSurCePoste = [
              ...affectationsAt(day, poste.id),
              ...nouvelles.filter((n) => n.date === day && n.posteId === poste.id),
            ];
            if (dejaSurCePoste.length > 0) continue; // ne pas écraser l'existant

            const buildCandidats = (excludeDejaAffectes: boolean) =>
              eligibleAgents(poste.id)
                .filter((a) => !dejaSurCetEnginCeJour.has(a.id))
                .filter((a) => !excludeDejaAffectes || !dejaAffectesCeJour.has(a.id))
                .map((a) => ({ agent: a, dispo: dispoSemaine.find((d) => d.agent_id === a.id && d.date === day) }))
                .filter((c) => c.dispo)
                .sort((a, b) => (charge.get(a.agent.id) ?? 0) - (charge.get(b.agent.id) ?? 0));

            // On évite d'abord les agents déjà affectés ce jour-là sur un
            // autre engin, mais ce n'est qu'une préférence : si personne
            // d'autre n'est éligible/disponible, on autorise un agent déjà
            // sur un autre véhicule plutôt que de laisser le poste vide
            // (non bloquant). En revanche dejaSurCetEnginCeJour reste un
            // filtre dur dans les deux cas : jamais deux fois sur le même engin.
            let candidats = buildCandidats(true);
            if (candidats.length === 0) candidats = buildCandidats(false);

            if (candidats.length === 0) continue; // trou assumé : personne d'éligible/disponible

            const choix = candidats[0];
            nouvelles.push({
              agentId: choix.agent.id,
              posteId: poste.id,
              date: day,
              creneauTypeId: choix.dispo?.creneau_type_id ?? undefined,
              heureDebutPerso: choix.dispo?.creneau_type_id ? undefined : choix.dispo?.heure_debut_perso ?? undefined,
              heureFinPerso: choix.dispo?.creneau_type_id ? undefined : choix.dispo?.heure_fin_perso ?? undefined,
            });
            dejaAffectesCeJour.add(choix.agent.id);
            dejaSurCetEnginCeJour.add(choix.agent.id);
            charge.set(choix.agent.id, (charge.get(choix.agent.id) ?? 0) + 1);
          }
        }
      }

      setGenProgress({ done: 0, total: nouvelles.length });
      for (const [i, n] of nouvelles.entries()) {
        await createAffectation({
          agentId: n.agentId,
          posteVehiculeId: n.posteId,
          date: n.date,
          creneauTypeId: n.creneauTypeId,
          heureDebutPerso: n.heureDebutPerso,
          heureFinPerso: n.heureFinPerso,
        });
        setGenProgress({ done: i + 1, total: nouvelles.length });
      }

      await refreshCurrentPeriod();
      if (nouvelles.length === 0) {
        setError('Aucun poste vide n’a pu être comblé — vérifie les disponibilités déclarées pour cette semaine.');
      } else {
        showToast(`${nouvelles.length} affectation(s) générée(s).`);
      }
    } catch (err) {
      console.error(err);
      setError("La génération automatique a échoué en cours de route. Vérifie le planning, certaines affectations ont peut-être été créées.");
    } finally {
      setGenerating(false);
      setGenProgress(null);
    }
  }

  if (loading) return <Spinner />;

  const periodeLabel = viewMode === 'jour' ? `Planning du ${date}` : gardeBlocLabel(bloc);
  const nomDe = (id: string) => gardes.find((g) => g.id === id)?.nom;
  const gardeJourNom = nomDe(gardeJourId);
  const gardeNuitNom = nomDe(gardeNuitId);
  const gardeWeekendNom = nomDe(gardeWeekendId);

  return (
    <div className="stack">
      <PageHeader
        title="Planning"
        sub={
          canEdit
            ? 'Clique sur une case pour affecter un agent — plusieurs agents possibles par poste, avec des horaires différents.'
            : 'Clique sur une case pour voir qui est affecté.'
        }
      />
      <h2 className="print-only">{periodeLabel}</h2>
      {error && <ErrorBanner message={error} />}

      <Card className="no-print">
        <div className="field-row" style={{ justifyContent: 'space-between' }}>
          <div className="field-row">
            <div className="view-toggle">
              <button className={viewMode === 'jour' ? 'view-toggle-btn active' : 'view-toggle-btn'} onClick={() => setViewMode('jour')}>Jour</button>
              <button className={viewMode === 'semaine' ? 'view-toggle-btn active' : 'view-toggle-btn'} onClick={() => setViewMode('semaine')}>Semaine</button>
            </div>
            {/* Sans objet pour un week-end en vue Semaine : les 5 créneaux
                (Ven nuit, Sam jour/nuit, Dim jour/nuit) sont alors tous
                affichés ensemble, voir `slots`. */}
            {!(viewMode === 'semaine' && bloc.type === 'weekend') && (
              <div className="view-toggle">
                <button className={horaireMode === 'jour' ? 'view-toggle-btn active' : 'view-toggle-btn'} onClick={() => setHoraireMode('jour')}>Journée</button>
                <button className={horaireMode === 'nuit' ? 'view-toggle-btn active' : 'view-toggle-btn'} onClick={() => setHoraireMode('nuit')}>Nuit</button>
              </div>
            )}
            {viewMode === 'jour' ? (
              <Field label="Date" style={{ maxWidth: 200 }}>
                <input type="date" className="input" value={date} onChange={(e) => setDate(e.target.value)} />
              </Field>
            ) : (
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                <Button variant="secondary" onClick={() => setDate(prevGardeBloc(bloc).start)}>
                  <IconChevronLeft /> Précédente
                </Button>
                <Button variant="secondary" onClick={() => setDate(todayIso())}>Aujourd'hui</Button>
                <Button variant="secondary" onClick={() => setDate(nextGardeBloc(bloc).start)}>
                  Suivante <IconChevronRight />
                </Button>
              </div>
            )}
          </div>
          <Button variant="secondary" onClick={() => window.print()}>Imprimer</Button>
        </div>

        {viewMode === 'semaine' && (
          <p style={{ fontSize: 12.5, color: 'var(--text-3)', marginTop: 10 }}>{gardeBlocLabel(bloc)}</p>
        )}

        {viewMode === 'semaine' && canEdit && (
          <div className="field-row" style={{ marginTop: 12, borderTop: '1px solid var(--border)', paddingTop: 12 }}>
            {bloc.type === 'semaine' ? (
              <>
                <Field label="Garde de jour (Lun-Ven, fixe)">
                  <select className="input" value={gardeJourId} onChange={(e) => handleChangeGardeSemaine('jour', e.target.value)}>
                    <option value="">— non définie —</option>
                    {gardes.map((g) => (
                      <option key={g.id} value={g.id}>{g.nom}</option>
                    ))}
                  </select>
                </Field>
                <Field label="Garde de nuit (Lun-Jeu, tourne)">
                  <select className="input" value={gardeNuitId} onChange={(e) => handleChangeGardeSemaine('nuit', e.target.value)}>
                    <option value="">— non définie —</option>
                    {gardes.map((g) => (
                      <option key={g.id} value={g.id}>{g.nom}</option>
                    ))}
                  </select>
                </Field>
              </>
            ) : (
              <Field label="Garde de week-end (tourne)">
                <select className="input" value={gardeWeekendId} onChange={(e) => handleChangeGardeSemaine('weekend', e.target.value)}>
                  <option value="">— non définie —</option>
                  {gardes.map((g) => (
                    <option key={g.id} value={g.id}>{g.nom}</option>
                  ))}
                </select>
              </Field>
            )}
            <Button onClick={handleAutoGenerate} disabled={generating}>
              {generating
                ? genProgress
                  ? `Génération… ${genProgress.done}/${genProgress.total}`
                  : 'Génération…'
                : 'Générer automatiquement'}
            </Button>
          </div>
        )}
      </Card>

      {viewMode === 'jour' && (
        <Card className="no-print">
          <strong style={{ fontSize: 13 }}>Disponibilités déclarées ce jour</strong>
          <div className="stack-sm" style={{ marginTop: 10 }}>
            {dispos.filter((d) => isHoraireNuit(d, creneaux) === (horaireMode === 'nuit')).length === 0 && (
              <EmptyState>Aucune disponibilité déclarée pour cette date.</EmptyState>
            )}
            {dispos.filter((d) => isHoraireNuit(d, creneaux) === (horaireMode === 'nuit')).map((d) => (
              <div key={d.id} className="list-row">
                <AgentLink agentId={d.agent_id}>{agentLabel(d.agent_id)}</AgentLink>
                <Status tone={d.statut === 'disponible' ? 'green' : d.statut === 'partiel' ? 'amber' : 'red'}>
                  <span className="mono">{formatHoraire(d, creneaux)}</span>
                </Status>
              </div>
            ))}
          </div>
        </Card>
      )}

      {viewMode === 'jour' ? (
        vehicules.map((v) => (
          <Card key={v.id} accent="brand">
            <strong>{v.nom}</strong>
            <div className="stack" style={{ marginTop: 10 }}>
              {(postesByVehicule[v.id] ?? []).map((poste) => {
                const current = displayAffectationsAt(date, poste.id);
                return (
                  <div key={poste.id} style={{ borderTop: '1px solid var(--border)', paddingTop: 10 }}>
                    <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 6 }}>{poste.nom_poste}</div>

                    <div className="stack-sm">
                      {current.map((a) => (
                        <div key={a.id} className="list-row" style={{ padding: '6px 0' }}>
                          <span>
                            <AgentLink agentId={a.agent_id}>{agentLabel(a.agent_id)}</AgentLink>{' '}
                            <span className="mono" style={{ color: 'var(--text-3)' }}>· {formatHoraire(a, creneaux)}</span>
                          </span>
                          {canEdit && (
                            <button className="link-delete no-print" onClick={() => handleRemoveAffectation(a.id)}>retirer</button>
                          )}
                        </div>
                      ))}
                      {current.length === 0 && <EmptyState>Aucun agent affecté sur ce poste pour l'instant.</EmptyState>}
                    </div>

                    {canEdit && (
                      <div className="no-print" style={{ marginTop: 8 }}>
                        <Button variant="secondary" onClick={() => setSelectedCell({ posteId: poste.id, date, horaire: horaireMode })}>
                          Affecter un agent
                        </Button>
                      </div>
                    )}
                  </div>
                );
              })}
              {(postesByVehicule[v.id] ?? []).length === 0 && (
                <EmptyState>Aucun poste défini pour ce véhicule — ajoute-en depuis la page Véhicules.</EmptyState>
              )}
            </div>
          </Card>
        ))
      ) : (
        <>
          {(gardeJourNom || gardeNuitNom || gardeWeekendNom) && (
            <Card accent="brand" className="no-print">
              <div style={{ fontSize: 13, display: 'flex', flexDirection: 'column', gap: 2 }}>
                {bloc.type === 'semaine' ? (
                  <>
                    {gardeNuitNom && <span>Garde de nuit : <strong>{gardeNuitNom}</strong></span>}
                  </>
                ) : (
                  gardeWeekendNom && <span>Garde de week-end : <strong>{gardeWeekendNom}</strong></span>
                )}
              </div>
            </Card>
          )}

          <Card>
            <div className="week-grid-scroll">
              <table className="week-grid">
                <thead>
                  <tr>
                    <th>Poste</th>
                    {slots.map((s) => (
                      <th key={`${s.date}-${s.horaire}`}>{s.label}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {vehicules.map((v) => (
                    <Fragment key={v.id}>
                      <tr className="week-grid-vehicule-row">
                        <td colSpan={1 + slots.length}>{v.nom}</td>
                      </tr>
                      {(postesByVehicule[v.id] ?? []).map((poste) => (
                        <tr key={poste.id}>
                          <td>{poste.nom_poste}</td>
                          {slots.map((s) => {
                            const dayAffs = displayAffectationsAt(s.date, poste.id, s.horaire);
                            const covered = dayAffs.length > 0;
                            const isSelected =
                              selectedCell?.posteId === poste.id &&
                              selectedCell?.date === s.date &&
                              selectedCell?.horaire === s.horaire;
                            return (
                              <td
                                key={`${s.date}-${s.horaire}`}
                                className={`${covered ? 'week-cell-covered' : 'week-cell-gap'} ${isSelected ? 'week-cell-selected' : ''}`}
                              >
                                <button
                                  className="week-cell-btn no-print"
                                  onClick={() => setSelectedCell({ posteId: poste.id, date: s.date, horaire: s.horaire })}
                                >
                                  {covered ? dayAffs.map((a) => agentShortLabel(a.agent_id)).join(', ') : '—'}
                                </button>
                                <span className="print-only week-cell-print">
                                  {covered ? dayAffs.map((a) => agentShortLabel(a.agent_id)).join(', ') : '—'}
                                </span>
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                      {(postesByVehicule[v.id] ?? []).length === 0 && (
                        <tr>
                          <td colSpan={1 + slots.length}><span style={{ color: 'var(--text-3)', fontSize: 12 }}>Aucun poste défini pour {v.nom}</span></td>
                        </tr>
                      )}
                    </Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

        </>
      )}

      {selectedCell && (
        <Modal
          title={`${postes.find((p) => p.id === selectedCell.posteId)?.nom_poste ?? ''} — ${dayLabel(selectedCell.date)} ${selectedCell.horaire}`}
          onClose={() => setSelectedCell(null)}
        >
          <div className="stack-sm">
            {displayAffectationsAt(selectedCell.date, selectedCell.posteId, selectedCell.horaire).map((a) => (
              <div key={a.id} className="list-row">
                <span>
                  <AgentLink agentId={a.agent_id}>{agentLabel(a.agent_id)}</AgentLink>{' '}
                  <span className="mono" style={{ color: 'var(--text-3)' }}>· {formatHoraire(a, creneaux)}</span>
                </span>
                {canEdit && (
                  <button className="link-delete" onClick={() => handleRemoveAffectation(a.id)}>retirer</button>
                )}
              </div>
            ))}
            {displayAffectationsAt(selectedCell.date, selectedCell.posteId, selectedCell.horaire).length === 0 && (
              <EmptyState>Aucun agent affecté sur ce poste pour l'instant.</EmptyState>
            )}
          </div>

          {canEdit && (
            <div className="stack-sm" style={{ marginTop: 12, borderTop: '1px solid var(--border)', paddingTop: 12 }}>
              <Field label="Agent">
                <select
                  className="input"
                  value={draftFor(selectedCell.posteId).agentId}
                  onChange={(e) => updateDraft(selectedCell.posteId, { agentId: e.target.value })}
                >
                  <option value="">— choisir —</option>
                  {eligibleAgents(selectedCell.posteId)
                    .filter((a) => !agentsAlreadyOnVehicule(selectedCell.date, vehiculeIdForPoste(selectedCell.posteId), selectedCell.posteId).has(a.id))
                    .map((a) => ({ a, dispo: dispoOnDay(a.id, selectedCell.date) }))
                    .filter(({ dispo }) => dispo)
                    .map(({ a, dispo }) => (
                      <option key={a.id} value={a.id}>
                        {a.prenom} {a.nom} — dispo {formatHoraire(dispo!, creneaux)}
                      </option>
                    ))}
                </select>
              </Field>
              <Field label="Créneau">
                <select
                  className="input"
                  value={draftFor(selectedCell.posteId).creneauId}
                  onChange={(e) => updateDraft(selectedCell.posteId, { creneauId: e.target.value })}
                >
                  <option value="">Personnalisé</option>
                  {creneaux.map((c) => (
                    <option key={c.id} value={c.id}>{c.nom} ({c.heure_debut}–{c.heure_fin})</option>
                  ))}
                </select>
              </Field>
              {!draftFor(selectedCell.posteId).creneauId && (
                <div className="field-row">
                  <Field label="Début">
                    <input
                      type="time"
                      className="input"
                      value={draftFor(selectedCell.posteId).heureDebut}
                      onChange={(e) => updateDraft(selectedCell.posteId, { heureDebut: e.target.value })}
                    />
                  </Field>
                  <Field label="Fin">
                    <input
                      type="time"
                      className="input"
                      value={draftFor(selectedCell.posteId).heureFin}
                      onChange={(e) => updateDraft(selectedCell.posteId, { heureFin: e.target.value })}
                    />
                  </Field>
                </div>
              )}
              <div className="field-row">
                <Button
                  onClick={() => handleAddAffectation(selectedCell.posteId, selectedCell.date)}
                  disabled={pendingPostes.has(selectedCell.posteId)}
                >
                  {pendingPostes.has(selectedCell.posteId) ? 'Affectation…' : 'Affecter'}
                </Button>
                <Button variant="secondary" onClick={() => setSelectedCell(null)}>Fermer</Button>
              </div>
            </div>
          )}
        </Modal>
      )}
    </div>
  );
}
