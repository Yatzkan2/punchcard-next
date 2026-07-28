import supabase from '../supabase'

export async function registerClient(slotId, clientId) {
  const { data, error } = await supabase
    .from('slot_registrations')
    .insert({ slot_id: slotId, client_id: clientId })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function unregisterClient(slotId, clientId) {
  const { error } = await supabase
    .from('slot_registrations')
    .delete()
    .eq('slot_id', slotId)
    .eq('client_id', clientId)
  if (error) throw error
}

export async function getRegistrationForClient(slotId, clientId) {
  const { data, error } = await supabase
    .from('slot_registrations')
    .select()
    .eq('slot_id', slotId)
    .eq('client_id', clientId)
    .maybeSingle()
  if (error) throw error
  return data
}

export async function getRegistrationsForSlot(slotId) {
  const { data, error } = await supabase
    .from('slot_registrations')
    .select('id, client_id, attended, punched, clients(id, name)')
    .eq('slot_id', slotId)
    .order('created_at')
  if (error) throw error
  return data
}

export async function setPunched(slotId, clientId, punched) {
  const { error } = await supabase
    .from('slot_registrations')
    .update({ punched })
    .eq('slot_id', slotId)
    .eq('client_id', clientId)
  if (error) throw error
}

export async function markAttended(slotId, clientId, attended) {
  const { data, error } = await supabase
    .from('slot_registrations')
    .update({ attended })
    .eq('slot_id', slotId)
    .eq('client_id', clientId)
    .select()
    .single()
  if (error) throw error
  return data
}
