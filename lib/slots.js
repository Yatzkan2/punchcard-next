import supabase from '../supabase'

export async function getSlotsByWeek(startDate) {
  const start = new Date(startDate)
  start.setHours(0, 0, 0, 0)
  const end = new Date(start)
  end.setDate(end.getDate() + 7)

  const { data, error } = await supabase
    .from('slots')
    .select('*, products!slots_product_id_fkey(id, name), slot_registrations(id, attended, punched, clients(id, name))')
    .gte('starts_at', start.toISOString())
    .lt('starts_at', end.toISOString())
    .order('starts_at')
  if (error) throw error
  return data
}

export async function createSlot(date, time, productId, capacity, notes, cancellationCutoffHours = 0) {
  const starts_at = new Date(`${date}T${time}`).toISOString()
  const { data, error } = await supabase
    .from('slots')
    .insert({ starts_at, product_id: productId || null, capacity, notes: notes || null, cancellation_cutoff_hours: cancellationCutoffHours })
    .select('*, products!slots_product_id_fkey(id, name)')
    .single()
  if (error) throw error
  return data
}

export async function updateSlot(id, fields) {
  const { data, error } = await supabase
    .from('slots')
    .update(fields)
    .eq('id', id)
    .select('*, products!slots_product_id_fkey(id, name)')
    .single()
  if (error) throw error
  return data
}

export async function deleteSlot(id) {
  const { error } = await supabase
    .from('slots')
    .delete()
    .eq('id', id)
  if (error) throw error
}

export async function getSlotCountForProduct(productId) {
  const { count, error } = await supabase
    .from('slots')
    .select('id', { count: 'exact', head: true })
    .eq('product_id', productId)
  if (error) throw error
  return count ?? 0
}

export function canClientCancel(slot) {
  if (!slot.cancellation_cutoff_hours) return true
  const cutoff = new Date(slot.starts_at)
  cutoff.setHours(cutoff.getHours() - slot.cancellation_cutoff_hours)
  return new Date() < cutoff
}

export async function getRegisteredSlotsForClient(clientId, productId) {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  const until = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
  const { data, error } = await supabase
    .from('slots')
    .select('id, starts_at, products!slots_product_id_fkey(id, name), slot_registrations!inner(client_id)')
    .eq('product_id', productId)
    .eq('slot_registrations.client_id', clientId)
    .gte('starts_at', since)
    .lte('starts_at', until)
    .order('starts_at')
  if (error) throw error
  return data
}

export async function getFutureRegistrationsForClient(clientId) {
  const { data, error } = await supabase
    .from('slots')
    .select('id, starts_at, products!slots_product_id_fkey(name), slot_registrations!inner(client_id)')
    .eq('slot_registrations.client_id', clientId)
    .gt('starts_at', new Date().toISOString())
    .order('starts_at')
  if (error) throw error
  return data
}

export async function getSlotWithRegistrations(id) {
  const { data, error } = await supabase
    .from('slots')
    .select('*, products!slots_product_id_fkey(id, name), slot_registrations(id, attended, punched, clients(id, name))')
    .eq('id', id)
    .single()
  if (error) throw error
  return data
}
