export type DeliveryOrderStatus =
  | "pending"
  | "preparing"
  | "delivering"
  | "completed"
  | "cancelled";

export type DeliveryOrderLike = {
  id: string;
  total_amount: number | string | null;
  status: DeliveryOrderStatus;
  created_at: string;
};

export function buildDeliveryDashboardStats(orders: DeliveryOrderLike[]) {
  return orders.reduce(
    (acc, order) => {
      const amount = Number(order.total_amount ?? 0) || 0;
      acc.totalOrders += 1;
      acc.totalRevenue += amount;

      if (order.status === "pending") acc.pendingOrders += 1;
      if (order.status === "completed") acc.completedOrders += 1;
      if (order.status === "cancelled") acc.cancelledOrders += 1;
      if (order.status === "pending" || order.status === "preparing" || order.status === "delivering") {
        acc.activeOrders += 1;
      }

      return acc;
    },
    {
      totalOrders: 0,
      pendingOrders: 0,
      activeOrders: 0,
      completedOrders: 0,
      cancelledOrders: 0,
      totalRevenue: 0,
    }
  );
}

export function sortOrdersNewestFirst<T extends DeliveryOrderLike>(orders: T[]): T[] {
  return [...orders].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );
}

export function buildOrderStatusUrl(orderId: string, trackingToken?: string | null): string {
  const encodedOrderId = encodeURIComponent(orderId);
  const token = trackingToken?.trim();
  if (!token) return `/order-status/${encodedOrderId}`;
  return `/order-status/${encodedOrderId}?t=${encodeURIComponent(token)}`;
}
