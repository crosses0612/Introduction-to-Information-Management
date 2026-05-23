const ORDER_SELECT = `
  o.id, o.user_id, o.delivery_date, o.delivery_at, o.delivery_method, o.delivery_address,
  o.note, o.status, o.created_at, o.confirmed_at,
  u.name AS customer_name, u.email AS customer_email, u.phone AS customer_phone,
  COALESCE(
    json_agg(
      json_build_object(
        'productId', oi.product_id,
        'productName', p.name,
        'quantity', oi.quantity,
        'unitPrice', oi.unit_price
      )
      ORDER BY oi.id
    ) FILTER (WHERE oi.id IS NOT NULL),
    '[]'::json
  ) AS items,
  COALESCE(SUM(oi.quantity * oi.unit_price), 0) AS total_amount
`;

const ORDER_FROM = `
  FROM orders o
  JOIN users u ON u.id = o.user_id
  LEFT JOIN order_items oi ON oi.order_id = o.id
  LEFT JOIN products p ON p.id = oi.product_id
`;

export function buildVendorOrdersQuery(scope) {
  let where = "";
  if (scope === "pending") {
    where = " WHERE o.status = 'pending'";
  } else if (scope === "history") {
    where = " WHERE o.status IN ('confirmed', 'cancelled', 'completed')";
  }
  return {
    sql: `SELECT ${ORDER_SELECT} ${ORDER_FROM}${where}
          GROUP BY o.id, u.name, u.email, u.phone
          ORDER BY o.id DESC`,
    params: []
  };
}

export const CUSTOMER_ORDER_SELECT = `
  SELECT o.*,
         COALESCE(
           json_agg(
             json_build_object(
               'productId', oi.product_id,
               'productName', p.name,
               'quantity', oi.quantity,
               'unitPrice', oi.unit_price
             )
             ORDER BY oi.id
           ) FILTER (WHERE oi.id IS NOT NULL),
           '[]'::json
         ) AS items
  FROM orders o
  LEFT JOIN order_items oi ON oi.order_id = o.id
  LEFT JOIN products p ON p.id = oi.product_id
  WHERE o.user_id = $1
  GROUP BY o.id
  ORDER BY o.id DESC
`;
