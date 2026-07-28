import supabase from '../supabase'
import { logEvent } from './activityLog'

export function nextRemainingAfterPunch(currentRemaining) {
  return Math.max(currentRemaining - 1, 0)
}

export async function getPassesForClient(clientId) {
  const { data, error } = await supabase
    .from('passes')
    .select('id, remaining, products(id, name)')
    .eq('client_id', clientId)
    .order('created_at')
  if (error) throw error
  return data.map(p => ({ ...p, product_name: p.products.name, product_id: p.products.id }))
}

export async function getPassesByCode(code) {
  const { data, error } = await supabase
    .from('clients')
    .select('passes(remaining, products(name))')
    .eq('code', code)
    .single()
  if (error) throw error
  return data.passes.map(p => ({ product_name: p.products.name, remaining: p.remaining }))
}

export async function upsertPass(clientId, productId, remaining) {
  const { error } = await supabase
    .from('passes')
    .upsert(
      { client_id: clientId, product_id: productId, remaining },
      { onConflict: 'client_id,product_id' }
    )
  if (error) throw error
}

export async function getClientNamesForProduct(productId) {
  const { data, error } = await supabase
    .from('passes')
    .select('clients(name)')
    .eq('product_id', productId)
    .gt('remaining', 0)
  if (error) throw error
  return data.map(p => p.clients.name)
}

export async function getClientsWithPass(productId) {
  const { data, error } = await supabase
    .from('passes')
    .select('remaining, clients(id, name, active)')
    .eq('product_id', productId)
  if (error) throw error
  return data
    .filter(p => p.clients?.active !== false)
    .map(p => ({ ...p.clients, remaining: p.remaining }))
    .sort((a, b) => a.name.localeCompare(b.name))
}

export async function punchPass({ clientId, clientName, productId, productName, currentRemaining, slot = null, attended = false }) {
  const after = nextRemainingAfterPunch(currentRemaining)
  await upsertPass(clientId, productId, after)
  logEvent({
    eventType: 'pass_punched',
    actor: 'admin',
    clientName,
    metadata: {
      product_name: productName,
      before:       currentRemaining,
      after,
      attended,
      slot_id:      slot?.id        ?? null,
      slot_date:    slot?.date      ?? null,
      slot_time:    slot?.time      ?? null,
      activity:     slot?.product_name ?? null,
    },
  })
}

export async function refundPass({ clientId, productId, currentRemaining }) {
  await upsertPass(clientId, productId, currentRemaining + 1)
}

export async function removePass(clientId, productId) {
  const { error } = await supabase
    .from('passes')
    .delete()
    .eq('client_id', clientId)
    .eq('product_id', productId)
  if (error) throw error
}
