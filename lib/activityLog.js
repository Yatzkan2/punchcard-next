import supabase from '../supabase'

export function logEvent({ eventType, actor, clientName = null, description = null, metadata = {} }) {
  supabase
    .from('activity_log')
    .insert({ event_type: eventType, actor, client_name: clientName, description, metadata })
    .then(({ error }) => { if (error) console.error('[activityLog]', error) })
    .catch(err => console.error('[activityLog]', err))
}

export async function getActivityLog({ eventType = null, excludeType = null, clientName = null, before = null, after = null, limit = 50 } = {}) {
  let query = supabase
    .from('activity_log')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit)

  if (eventType)   query = query.eq('event_type', eventType)
  if (excludeType) query = query.neq('event_type', excludeType)
  if (clientName)  query = query.ilike('client_name', `%${clientName}%`)
  if (after)      query = query.gte('created_at', after)
  if (before)     query = query.lte('created_at', before)

  const { data, error } = await query
  if (error) throw error
  return data
}
