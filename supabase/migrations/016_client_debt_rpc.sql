-- Date: 2026-07-28
-- Reason: allow anonymous clients to read their own unsettled debt by code, without loosening admin-only RLS on debts

CREATE OR REPLACE FUNCTION get_client_debt_by_code(p_code text)
RETURNS TABLE (product_id uuid, product_name text, debt_count bigint)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT d.product_id, pr.name AS product_name, COUNT(*) AS debt_count
  FROM debts d
  JOIN clients c ON c.id = d.client_id
  JOIN products pr ON pr.id = d.product_id
  WHERE c.code = p_code
    AND c.active = true
    AND d.settled = false
  GROUP BY d.product_id, pr.name;
$$;

GRANT EXECUTE ON FUNCTION get_client_debt_by_code(text) TO anon, authenticated;
