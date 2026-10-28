import { admin, authenticate, json } from '../_shared/launch.ts';
Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return json({});
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  const user = await authenticate(req);
  if (!user) return json({ error: 'Sign in again to delete your account.' }, 401);
  try {
    const body = await req.json();
    if (body.confirmation !== 'DELETE') return json({ error: 'Type DELETE to confirm.' }, 400);
    const db = admin();
    const { data: files, error } = await db.rpc('account_storage_objects', { p_user: user.id });
    if (error) throw error;
    const buckets = new Map<string, string[]>();
    for (const file of files || []) buckets.set(file.bucket_id, [...(buckets.get(file.bucket_id) || []), file.name]);
    for (const [bucket, paths] of buckets) {
      for (let i=0; i<paths.length; i+=100) {
        const { error } = await db.storage.from(bucket).remove(paths.slice(i,i+100));
        if (error) throw error;
      }
    }
    const token = req.headers.get('Authorization')!.replace(/^Bearer /i, '');
    const signedOut = await db.auth.admin.signOut(token, 'global');
    if (signedOut.error) throw signedOut.error;
    // The auth.users -> public.users FK cascades owned database records atomically.
    const deleted = await db.auth.admin.deleteUser(user.id);
    if (deleted.error) throw deleted.error;
    return json({ deleted: true });
  } catch { return json({ error: 'Account deletion could not finish. Please contact support with your account email.' }, 500); }
});
