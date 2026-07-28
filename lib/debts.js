import supabase from '../supabase'

export async function createDebt({ clientId, productId, slotId = null }) {
  const { data, error } = await supabase
    .from('debts')
    .insert({ client_id: clientId, product_id: productId, slot_id: slotId })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function getDebtsForClient(clientId) {
  const { data, error } = await supabase
    .from('debts')
    .select('*, products(id, name)')
    .eq('client_id', clientId)
    .eq('settled', false)
    .order('created_at')
  if (error) throw error
  return data
}

export async function getDebtCountForClientProduct(clientId, productId) {
  const { count, error } = await supabase
    .from('debts')
    .select('*', { count: 'exact', head: true })
    .eq('client_id', clientId)
    .eq('product_id', productId)
    .eq('settled', false)
  if (error) throw error
  return count ?? 0
}

export async function settleDebts(clientId, productId, count) {
  const { data, error } = await supabase
    .from('debts')
    .select('id')
    .eq('client_id', clientId)
    .eq('product_id', productId)
    .eq('settled', false)
    .order('created_at')
    .limit(count)
  if (error) throw error
  if (!data.length) return 0

  const ids = data.map(d => d.id)
  const { error: updateError } = await supabase
    .from('debts')
    .update({ settled: true, settled_at: new Date().toISOString() })
    .in('id', ids)
  if (updateError) throw updateError
  return ids.length
}

export async function getAllUnsettledDebts() {
  const { data, error } = await supabase
    .from('debts')
    .select('*, clients(id, name), products(id, name)')
    .eq('settled', false)
    .order('created_at')
  if (error) throw error
  return data
}
