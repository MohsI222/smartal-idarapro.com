/**
 * Réexport du client Supabase — implémentation : `./supabaseClient`.
 * L’authentification email/mot de passe et OAuth utilisent ces exports via `AuthContext` et les pages Login/Register.
 */
export { supabase, supabaseClient, isSupabaseConfigured } from "./supabaseClient";
