import supabase from '../supabase'

export async function getProducts() {
  const { data, error } = await supabase
    .from('products')
    .select('id, name, default_capacity, default_refill')
    .order('name')
  if (error) throw error
  return data
}

export async function addProduct(name, { default_capacity = 10, default_refill = 10 } = {}) {
  const { data, error } = await supabase
    .from('products')
    .insert({ name, default_capacity, default_refill })
    .select()
    .single()
  if (error) {
    if (error.code === '23505') throw new Error(`${name} already exists.`)
    throw error
  }
  return data
}

export async function updateProductDefaults(id, { default_capacity, default_refill }) {
  const { data, error } = await supabase
    .from('products')
    .update({ default_capacity, default_refill })
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function removeProduct(id) {
  const { error: passesError } = await supabase
    .from('passes')
    .delete()
    .eq('product_id', id)
  if (passesError) throw passesError

  const { error } = await supabase
    .from('products')
    .delete()
    .eq('id', id)
  if (error) throw error
}
