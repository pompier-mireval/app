export type NiveauAcces = 'utilisateur' | 'admin' | 'superadmin';
export type StatutDispo = 'disponible' | 'indisponible' | 'partiel';

export interface Agent {
  id: string;
  auth_user_id: string | null;
  email: string;
  nom: string;
  prenom: string;
  niveau_acces: NiveauAcces;
  note_dispo: string | null;
  telephone: string | null;
  grade_id: string | null;
  actif: boolean;
  created_at: string;
}

export interface Garde {
  id: string;
  nom: string;
  created_by: string | null;
  created_at: string;
}

export interface Competence {
  id: string;
  code: string;
  nom: string;
  created_at: string;
}

export interface AgentCompetence {
  agent_id: string;
  competence_id: string;
  date_obtention: string;
  validated_by: string | null;
}

export interface Vehicule {
  id: string;
  nom: string;
  immatriculation: string | null;
  type: string | null;
  statut: string;
  ordre: number;
  ordre_generation: number;
  created_by: string | null;
  created_at: string;
}

export interface PosteVehicule {
  id: string;
  vehicule_id: string;
  nom_poste: string;
  ordre: number;
}

export interface CreneauType {
  id: string;
  nom: string;
  heure_debut: string;
  heure_fin: string;
  created_by: string | null;
  created_at: string;
}

export interface Disponibilite {
  id: string;
  agent_id: string;
  date: string;
  creneau_type_id: string | null;
  heure_debut_perso: string | null;
  heure_fin_perso: string | null;
  statut: StatutDispo;
  created_at: string;
}

export interface Affectation {
  id: string;
  agent_id: string;
  poste_vehicule_id: string;
  date: string;
  creneau_type_id: string | null;
  heure_debut_perso: string | null;
  heure_fin_perso: string | null;
  created_by: string | null;
  created_at: string;
}

export interface Grade {
  id: string;
  nom: string;
  ordre: number;
  created_at: string;
}

// 'jour' (Lun-Ven journée, fixe) / 'nuit' (Lun-Jeu nuit) / 'weekend'
// (Ven nuit-Dim nuit) — voir schema_v3.sql. Nuit et weekend tournent
// habituellement sur un cycle de gardes, jour reste la même chaque semaine.
export type GardeSemaineType = 'jour' | 'nuit' | 'weekend';

export interface GardeSemaine {
  id: string;
  semaine_debut: string;
  type: GardeSemaineType;
  garde_id: string;
  created_by: string | null;
  created_at: string;
}


export interface Astreinte {
  id: string;
  agent_id: string;
  date: string;
  created_by: string | null;
  created_at: string;
}

// Ligne unique (id = 1) — voir schema_v4.sql.
export interface AstreinteConfig {
  id: number;
  nb_max: number;
  competence_ca_id: string | null;
  competence_conducteur_id: string | null;
  competence_equipier_id: string | null;
}

export interface SignalementMecanique {
  id: string;
  vehicule_id: string;
  agent_id: string;
  description: string;
  urgence: 'normale' | 'urgente';
  statut: 'ouvert' | 'resolu';
  created_at: string;
  resolu_at: string | null;
}

export type TypeVetement = 'polo' | 'veste_tsi' | 'pantalon' | 'surpantalon' | 'veste_f1' | 'rangers' | 'autre';
export type StatutDemandeHabillement = 'en_attente' | 'acceptee' | 'refusee' | 'livree';

export interface DemandeHabillement {
  id: string;
  agent_id: string;
  type: TypeVetement;
  type_autre: string | null;
  code: string | null;
  motif: string;
  statut: StatutDemandeHabillement;
  created_at: string;
  traite_at: string | null;
}

export type FamilleControle = 'inventaire' | 'verification' | 'materiel';

export interface InventaireItem {
  id: string;
  vehicule_id: string | null;
  materiel_id: string | null;
  zone: string;
  nom: string;
  quantite: number;
  ordre: number;
  famille: FamilleControle;
}

export interface InventaireControle {
  id: string;
  vehicule_id: string | null;
  materiel_id: string | null;
  agent_id: string;
  nb_items: number;
  created_at: string;
}

export interface InventaireManque {
  id: string;
  controle_id: string;
  vehicule_id: string | null;
  materiel_id: string | null;
  agent_id: string;
  item_id: string | null;
  zone: string;
  item_nom: string;
  quantite_attendue: number;
  quantite_constatee: number;
  probleme: 'manquant' | 'defectueux' | 'anomalie';
  commentaire: string | null;
  statut: 'a_traiter' | 'regle';
  created_at: string;
  regle_at: string | null;
}

export interface SignalementBatiment {
  id: string;
  agent_id: string;
  lieu: string;
  description: string;
  urgence: 'normale' | 'urgente';
  statut: 'ouvert' | 'resolu';
  created_at: string;
  resolu_at: string | null;
}

export interface PetitMateriel {
  id: string;
  nom: string;
  created_at: string;
}
