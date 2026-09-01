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

export interface GardeSemaine {
  id: string;
  semaine_debut: string;
  garde_id: string;
  created_by: string | null;
  created_at: string;
}

