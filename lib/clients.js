import supabase from '../supabase'

export async function getClientByCode(code) {
  const { data, error } = await supabase
    .from('clients')
    .select('*, passes(remaining, products(id, name))')
    .eq('code', code)
    .eq('active', true)
    .single()
  if (error) throw error
  return {
    ...data,
    passes: (data.passes ?? []).map(p => ({ product_id: p.products.id, product_name: p.products.name, remaining: p.remaining })),
  }
}

export async function getAllClients(status = 'active') {
  let query = supabase
    .from('clients')
    .select('id, name, entries, code, created_at, active, passes(id, remaining, products(id, name, default_refill))')
    .order('created_at', { ascending: true })
  if (status === 'active')   query = query.eq('active', true)
  if (status === 'inactive') query = query.eq('active', false)

  const [clientsRes, debtsRes] = await Promise.all([
    query,
    supabase
      .from('debts')
      .select('client_id, product_id')
      .eq('settled', false),
  ])
  if (clientsRes.error) throw clientsRes.error
  if (debtsRes.error) throw debtsRes.error

  const debtMap = {}
  for (const row of debtsRes.data ?? []) {
    const key = `${row.client_id}:${row.product_id}`
    debtMap[key] = (debtMap[key] ?? 0) + 1
  }

  return clientsRes.data.map(c => ({
    ...c,
    passes: (c.passes ?? []).map(p => ({
      id: p.id,
      remaining: p.remaining,
      product_id: p.products.id,
      product_name: p.products.name,
      default_refill: p.products.default_refill ?? 10,
      debt: debtMap[`${c.id}:${p.products.id}`] ?? 0,
    })),
  }))
}

export async function addClient(name, code) {
  const { data, error } = await supabase
    .from('clients')
    .insert({ name, code })
    .select()
    .single()
  if (error) {
    if (error.code === '23505') throw new Error(`${name} is already a client.`)
    throw error
  }
  return data
}

export async function punchClient(id, passes, entries) {
  const next = Math.max(passes - 1, 0)
  const { error } = await supabase
    .from('clients')
    .update({ passes: next, entries: entries + 1 })
    .eq('id', id)
  if (error) {
    // entries column not yet added — fall back to passes-only update
    if (error.code === '42703' || error.message?.includes('entries')) {
      const { error: e2 } = await supabase
        .from('clients')
        .update({ passes: next })
        .eq('id', id)
      if (e2) throw e2
      return
    }
    throw error
  }
}

export async function updatePasses(id, passes) {
  const { data, error } = await supabase
    .from('clients')
    .update({ passes })
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function incrementEntries(id, entries) {
  const { error } = await supabase
    .from('clients')
    .update({ entries: entries + 1 })
    .eq('id', id)
  if (error) throw error
}

export async function setClientActive(id, active) {
  const { error } = await supabase
    .from('clients')
    .update({ active })
    .eq('id', id)
  if (error) throw error
}

export async function removeClient(id) {
  const { error } = await supabase
    .from('clients')
    .delete()
    .eq('id', id)
  if (error) throw error
}
