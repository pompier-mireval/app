import { useEffect, useMemo, useState, Fragment } from 'react';
import { useAuth } from '../hooks/useAuth';
import { fetchVehicules, fetchAllPostes, fetchAllPostesCompetences } from '../api/vehicules';
import { fetchAgents } from '../api/agents';
import { fetchAllAgentCompetences, fetchCompetences } from '../api/competences';
import { fetchAstreinteConfig } from '../api/astreintes';
import { fetchAffectationsForDate, fetchAffectationsForRange, createAffectation, deleteAffectation } from '../api/affectations';
import { fetchCreneauxTypes } from '../api/creneaux';
import { fetchDisponibilitesForDate, fetchDisponibilitesForRange } from '../api/disponibilites';
import { fetchGardes, fetchAllAgentGardes } from '../api/gardes';
import { fetchGardeSemainesForDate, setGardeSemaine, clearGardeSemaine } from '../api/gardeSemaines';
import type { Vehicule, PosteVehicule, Agent, AgentCompetence, Affectation, CreneauType, Disponibilite, Garde, GardeSemaineType } from '../lib/types';
import type { PosteCompetenceLink } from '../api/vehicules';
import { formatHoraire, isHoraireNuit } from '../lib/format';
import {
  todayIso,
  dayLabel,
  dayLabelLong,
  daysAgo,
  gardeBlocOf,
  mondayOf,
  addDays,
  nextGardeBloc,
  prevGardeBloc,
  gardeBlocEnd,
  gardeBlocDays,
  gardeBlocCalendarDays,
  gardeBlocLabel,
} from '../lib/dates';
import { AstreintePanel } from '../components/planning/AstreintePanel';
import { AgentLink } from '../components/ui/AgentLink';
import { AgentPicker, type PickerAgent } from '../components/planning/AgentPicker';
import { Card, ErrorBanner, Spinner, PageHeader, Field, EmptyState, Button, Status, Modal, Choice } from '../components/ui/Primitives';
import { useToast } from '../components/ui/Toast';
import { PrintButton } from '../components/ui/PrintButton';
import { confirmAction } from '../lib/confirm';
import { IconChevronLeft, IconChevronRight } from '../components/ui/Icons';

interface Draft {
  agentId: string;
  creneauId: string; // '' = personnalisé
  heureDebut: string;
  heureFin: string;
}

// creneauId : '' = selon la disponibilité de l'agent, PERSO = heures saisies.
const PERSO = 'perso';
const EMPTY_DRAFT: Draft = { agentId: '', creneauId: '', heureDebut: '07:00', heureFin: '19:00' };

export function PlanningPage() {
  const { agent } = useAuth();
  const { showToast } = useToast();
  // Lecture ouverte à tous (dispos y compris) ; seuls admin/superadmin
  // peuvent modifier — aligné sur ce qu'autorisent les policies RLS.
  const canEdit = agent?.niveau_acces === 'admin' || agent?.niveau_acces === 'superadmin';
  // Le choix des gardes de la semaine est réservé au superadmin.
  const canEditGardes = agent?.niveau_acces === 'superadmin';
  const [viewMode, setViewMode] = useState<'jour' | 'semaine'>('semaine');
  const [horaireMode, setHoraireMode] = useState<'jour' | 'nuit'>('jour');
  const [date, setDate] = useState(todayIso());
  const [tousVehicules, setVehicules] = useState<Vehicule[]>([]);
  // Un véhicule exclu du planning n'est ni affiché ni rempli automatiquement.
  const vehicules = useMemo(() => tousVehicules.filter((v) => v.dans_planning !== false), [tousVehicules]);
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
    // Préchauffe le cache pour le panneau d'astreinte (affiché ensuite) : ses
    // lectures de référence sont alors déjà en vol ou en mémoire, au lieu
    // de partir seulement une fois le planning chargé.
    for (const warm of [fetchCompetences, fetchAstreinteConfig, fetchAllAgentGardes]) warm().catch(() => undefined);
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

  // Un agent peut déclarer plusieurs dispos le même jour (jour, nuit, autres
  // créneaux) : on ne retient que celles du côté demandé et pas "indisponible".
  function disposOnDay(agentId: string, day: string, horaire: 'jour' | 'nuit'): Disponibilite[] {
    return dispos.filter(
      (d) => d.agent_id === agentId && d.date === day && d.statut !== 'indisponible' && isHoraireNuit(d, creneaux) === (horaire === 'nuit')
    );
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

  // Horaire appliqué à une affectation : celui choisi explicitement dans la
  // popup, sinon celui de la disponibilité de l'agent, sinon le premier
  // créneau type du bon côté (jour/nuit), sinon des heures par défaut.
  function horaireFor(agentId: string, cell: { posteId: string; date: string; horaire: 'jour' | 'nuit' }) {
    const draft = draftFor(cell.posteId);
    if (draft.creneauId && draft.creneauId !== PERSO) return { creneauTypeId: draft.creneauId };
    if (draft.creneauId === PERSO) return { heureDebutPerso: draft.heureDebut, heureFinPerso: draft.heureFin };
    const dispo = disposOnDay(agentId, cell.date, cell.horaire)[0];
    if (dispo?.creneau_type_id) return { creneauTypeId: dispo.creneau_type_id };
    if (dispo?.heure_debut_perso && dispo.heure_fin_perso) {
      return { heureDebutPerso: dispo.heure_debut_perso, heureFinPerso: dispo.heure_fin_perso };
    }
    const nuit = cell.horaire === 'nuit';
    const defaut = creneaux.find((c) => (c.heure_debut > c.heure_fin) === nuit);
    if (defaut) return { creneauTypeId: defaut.id };
    return nuit ? { heureDebutPerso: '19:00', heureFinPerso: '07:00' } : { heureDebutPerso: '07:00', heureFinPerso: '19:00' };
  }

  async function handleAddAffectation(posteId: string, day: string, agentId: string, horaire: 'jour' | 'nuit') {
    if (agentsAlreadyOnVehicule(day, vehiculeIdForPoste(posteId), posteId).has(agentId)) {
      setError('Cet agent est déjà affecté sur un autre poste de ce véhicule ce jour-là.');
      return;
    }
    setError(null);
    setPendingPostes((prev) => new Set(prev).add(posteId));
    try {
      await createAffectation({ agentId, posteVehiculeId: posteId, date: day, ...horaireFor(agentId, { posteId, date: day, horaire }) });
      await refreshCurrentPeriod();
      showToast(`${agentLabel(agentId)} affecté(e).`);
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
      const vehiculesParGeneration = [...vehicules].sort((a, b) => a.ordre_generation - b.ordre_generation || a.nom.localeCompare(b.nom));
      type Nouvelle = { agentId: string; posteId: string; date: string; horaire: 'jour' | 'nuit'; creneauTypeId?: string; heureDebutPerso?: string; heureFinPerso?: string };
      const nouvelles: Nouvelle[] = [];

      // Créneaux à remplir : les 5 du week-end ; pour une semaine, uniquement
      // les nuits (la garde de jour Lun-Ven passe par les astreintes).
      const genSlots: { date: string; horaire: 'jour' | 'nuit' }[] =
        bloc.type === 'weekend' ? slots : gardeBlocDays(bloc, 'nuit').map((d) => ({ date: d, horaire: 'nuit' as const }));

      for (const { date: day, horaire } of genSlots) {
        const nuit = horaire === 'nuit';
        const dejaAffectesCeJour = new Set(affectations.filter((a) => a.date === day).map((a) => a.agent_id));
        for (const nouv of nouvelles.filter((n) => n.date === day)) dejaAffectesCeJour.add(nouv.agentId);

        // Un agent peut avoir plusieurs dispos le même jour : on ne garde
        // que celles du bon côté (jour/nuit) et pas "indisponible".
        const dispoDe = (agentId: string) =>
          dispoSemaine.find(
            (d) => d.agent_id === agentId && d.date === day && d.statut !== 'indisponible' && isHoraireNuit(d, creneaux) === nuit
          );

        for (const vehicule of vehiculesParGeneration) {
          // Un agent ne peut être qu'une seule fois sur un même engin le
          // même jour (deux postes différents du même véhicule) — c'est un
          // vrai blocage, contrairement à la préférence entre véhicules.
          const dejaSurCetEnginCeJour = agentsAlreadyOnVehicule(day, vehicule.id);
          for (const nouv of nouvelles.filter((n) => n.date === day && (postesByVehicule[vehicule.id] ?? []).some((p) => p.id === n.posteId))) {
            dejaSurCetEnginCeJour.add(nouv.agentId);
          }

          for (const poste of postesByVehicule[vehicule.id] ?? []) {
            const dejaSurCePoste = [
              ...displayAffectationsAt(day, poste.id, horaire),
              ...nouvelles.filter((n) => n.date === day && n.horaire === horaire && n.posteId === poste.id),
            ];
            if (dejaSurCePoste.length > 0) continue; // ne pas écraser l'existant

            const buildCandidats = (excludeDejaAffectes: boolean) =>
              eligibleAgents(poste.id)
                .filter((a) => !dejaSurCetEnginCeJour.has(a.id))
                .filter((a) => !excludeDejaAffectes || !dejaAffectesCeJour.has(a.id))
                .map((a) => ({ agent: a, dispo: dispoDe(a.id) }))
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
              horaire,
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

  // Garde de jour (Lun-Ven) : pas d'affectation sur véhicule, on ne gère que
  // l'astreinte (voir AstreintePanel).
  const lundi = mondayOf(date);
  const jourSemaineOuvre = date >= lundi && date <= addDays(lundi, 4);
  const jourSansVehicule = horaireMode === 'jour' && (viewMode === 'jour' ? jourSemaineOuvre : bloc.type === 'semaine');

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
            ? "Clique sur une case, puis sur un agent pour l'affecter — plusieurs agents possibles par poste."
            : 'Clique sur une case pour voir qui est affecté.'
        }
      />
      <h2 className="print-only">
        {periodeLabel}
        {viewMode === 'semaine' && (bloc.type === 'weekend' ? gardeWeekendNom : horaireMode === 'nuit' ? gardeNuitNom : gardeJourNom) &&
          ` — Garde : ${bloc.type === 'weekend' ? gardeWeekendNom : horaireMode === 'nuit' ? gardeNuitNom : gardeJourNom}`}
      </h2>
      {error && <ErrorBanner message={error} />}

      <Card className="no-print">
        <div className="field-row planning-toolbar" style={{ justifyContent: 'space-between' }}>
          <div className="field-row planning-controls">
            <div className="toggle-row">
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
            </div>
            {viewMode === 'jour' ? (
              <div className="btn-row" style={{ alignItems: 'flex-end' }}>
                <Button variant="secondary" onClick={() => setDate(addDays(date, -1))} aria-label="Jour précédent">
                  <IconChevronLeft /> Veille
                </Button>
                <Field label="Date" style={{ maxWidth: 170 }}>
                  <input type="date" className="input" value={date} onChange={(e) => e.target.value && setDate(e.target.value)} />
                </Field>
                <Button variant="secondary" onClick={() => setDate(addDays(date, 1))} aria-label="Jour suivant">
                  Lendemain <IconChevronRight />
                </Button>
                <Button variant="secondary" onClick={() => setDate(todayIso())}>Aujourd'hui</Button>
              </div>
            ) : (
              <div className="btn-row">
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
          <span className="planning-print"><PrintButton filename={`planning-${viewMode === 'jour' ? date : weekStart}`} /></span>
        </div>

        {viewMode === 'semaine' && (
          <p style={{ fontSize: 12.5, color: 'var(--text-3)', marginTop: 10 }}>{gardeBlocLabel(bloc)}</p>
        )}
        {viewMode === 'jour' && (
          <p style={{ fontSize: 15, fontWeight: 600, marginTop: 10, textTransform: 'capitalize' }}>
            {dayLabelLong(date)} {date.slice(0, 4)} — {horaireMode === 'nuit' ? 'Nuit' : 'Journée'}
            {date === todayIso() && <span style={{ fontWeight: 400, color: 'var(--text-3)' }}> (aujourd'hui)</span>}
          </p>
        )}

        {viewMode === 'semaine' && canEdit && (
          <div className="field-row" style={{ marginTop: 12, borderTop: '1px solid var(--border)', paddingTop: 12 }}>
            {canEditGardes && (bloc.type === 'semaine' ? (
              <>
                <Field label="Garde de jour (Lun-Ven, fixe)">
                  <Choice ariaLabel="Garde" value={gardeJourId} onChange={(v) => handleChangeGardeSemaine('jour', v)} emptyLabel="Non définie" options={gardes.map((g) => ({ value: g.id, label: g.nom }))} />
                </Field>
                <Field label="Garde de nuit (Lun-Jeu, tourne)">
                  <Choice ariaLabel="Garde" value={gardeNuitId} onChange={(v) => handleChangeGardeSemaine('nuit', v)} emptyLabel="Non définie" options={gardes.map((g) => ({ value: g.id, label: g.nom }))} />
                </Field>
              </>
            ) : (
              <Field label="Garde de week-end (tourne)">
                <Choice ariaLabel="Garde" value={gardeWeekendId} onChange={(v) => handleChangeGardeSemaine('weekend', v)} emptyLabel="Non définie" options={gardes.map((g) => ({ value: g.id, label: g.nom }))} />
              </Field>
            ))}
            {!jourSansVehicule && (
            <Button onClick={handleAutoGenerate} disabled={generating}>
              {generating
                ? genProgress
                  ? `Génération… ${genProgress.done}/${genProgress.total}`
                  : 'Génération…'
                : 'Générer automatiquement'}
            </Button>
            )}
          </div>
        )}
      </Card>

      {viewMode === 'jour' && jourSansVehicule && (
        <AstreintePanel date={date} agents={agents} agentCompetences={agentCompetences} affectations={affectations} canEdit={canEdit} isSuperAdmin={canEditGardes} />
      )}

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

      {viewMode === 'semaine' && jourSansVehicule && (
        <AstreintePanel semaine date={weekStart} agents={agents} agentCompetences={agentCompetences} affectations={[]} canEdit={canEdit} isSuperAdmin={canEditGardes} />
      )}

      {jourSansVehicule ? null : viewMode === 'jour' ? (
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

          {canEdit && (() => {
            const cell = selectedCell;
            const surVehicule = agentsAlreadyOnVehicule(cell.date, vehiculeIdForPoste(cell.posteId), cell.posteId);
            const dejaIci = new Set(displayAffectationsAt(cell.date, cell.posteId, cell.horaire).map((a) => a.agent_id));
            const libres = eligibleAgents(cell.posteId).filter((a) => !surVehicule.has(a.id) && !dejaIci.has(a.id));
            const disponibles: PickerAgent[] = [];
            for (const a of libres) {
              const ds = disposOnDay(a.id, cell.date, cell.horaire);
              if (ds.length > 0) {
                disponibles.push({
                  id: a.id,
                  label: `${a.prenom} ${a.nom}`,
                  hint: ds.map((d) => formatHoraire(d, creneaux)).join(' ; '),
                  partiel: ds.every((d) => d.statut === 'partiel'),
                });
              }
            }
            const draft = draftFor(cell.posteId);
            return (
              <div className="stack-sm" style={{ marginTop: 12, borderTop: '1px solid var(--border)', paddingTop: 12 }}>
                <AgentPicker
                  disponibles={disponibles}
                  disabled={pendingPostes.has(cell.posteId)}
                  onPick={(id) => handleAddAffectation(cell.posteId, cell.date, id, cell.horaire)}
                />
                <details>
                  <summary style={{ fontSize: 12.5, cursor: 'pointer', color: 'var(--text-2)' }}>
                    Horaire : {draft.creneauId ? (draft.creneauId === PERSO ? 'personnalisé' : creneaux.find((c) => c.id === draft.creneauId)?.nom) : "selon la disponibilité de l'agent"}
                  </summary>
                  <div className="stack-sm" style={{ marginTop: 8 }}>
                    <Field label="Imposer un horaire">
                      <Choice
                        ariaLabel="Horaire"
                        value={draft.creneauId}
                        onChange={(v) => updateDraft(cell.posteId, { creneauId: v })}
                        emptyLabel="Selon la disponibilité de l'agent"
                        options={[
                          ...creneaux.map((c) => ({ value: c.id, label: c.nom, hint: `${c.heure_debut.slice(0, 5)}–${c.heure_fin.slice(0, 5)}` })),
                          { value: PERSO, label: 'Horaire personnalisé' },
                        ]}
                      />
                    </Field>
                    {draft.creneauId === PERSO && (
                      <div className="field-row">
                        <Field label="Début">
                          <input type="time" className="input" value={draft.heureDebut} onChange={(e) => updateDraft(cell.posteId, { heureDebut: e.target.value })} />
                        </Field>
                        <Field label="Fin">
                          <input type="time" className="input" value={draft.heureFin} onChange={(e) => updateDraft(cell.posteId, { heureFin: e.target.value })} />
                        </Field>
                      </div>
                    )}
                  </div>
                </details>
                <div className="field-row">
                  <Button variant="secondary" onClick={() => setSelectedCell(null)}>Terminer</Button>
                </div>
              </div>
            );
          })()}
        </Modal>
      )}
    </div>
  );
}
