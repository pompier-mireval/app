// Edge Function Supabase (Deno) — création d'un compte agent par un
// superadmin, avec un mot de passe provisoire (le lien d'invitation par
// email n'étant pas utilisable). L'agent devra le changer à sa première
// connexion : le drapeau user_metadata.must_change_password est lu par l'app.
//
// Déploiement : supabase functions deploy create-agent
// (SUPABASE_URL, SUPABASE_ANON_KEY et SUPABASE_SERVICE_ROLE_KEY sont fournis
// automatiquement par Supabase.)
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const url = Deno.env.get('SUPABASE_URL')!;
  const userClient = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
  });
  const { data: userData } = await userClient.auth.getUser();
  if (!userData.user) return json({ error: 'Non authentifié' }, 401);

  const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const { data: caller } = await admin.from('agents').select('niveau_acces, actif').eq('auth_user_id', userData.user.id).maybeSingle();
  if (!caller?.actif || caller.niveau_acces !== 'superadmin') return json({ error: 'Réservé au superadmin' }, 403);

  const body = await req.json().catch(() => ({}));
  const email = String(body.email ?? '').trim().toLowerCase();
  const password = String(body.password ?? '');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json({ error: 'Email invalide' }, 400);
  if (password.length < 8) return json({ error: 'Mot de passe provisoire : 8 caractères minimum' }, 400);

  // Fiche agent : réutilise une fiche pré-créée (ancienne invitation) si elle
  // n'est pas déjà reliée à un compte, sinon la crée.
  const { data: existing } = await admin.from('agents').select('id, auth_user_id').eq('email', email).maybeSingle();
  if (existing?.auth_user_id) return json({ error: 'Un compte existe déjà pour cet email' }, 409);
  let createdAgentId: string | null = null;
  if (!existing) {
    const { data: inserted, error } = await admin.from('agents').insert({ email }).select('id').single();
    if (error) return json({ error: 'Création de la fiche impossible' }, 500);
    createdAgentId = inserted.id;
  }

  // Le trigger handle_new_auth_user rattache ensuite auth_user_id à la fiche.
  const { error: authError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { must_change_password: true },
  });
  if (authError) {
    if (createdAgentId) await admin.from('agents').delete().eq('id', createdAgentId);
    return json({ error: authError.message }, 400);
  }
  return json({ ok: true });
});
