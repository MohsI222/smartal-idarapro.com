import test from "node:test";
import assert from "node:assert/strict";

import {
  buildDeliveryDashboardStats,
  buildOrderStatusUrl,
  sortOrdersNewestFirst,
  type DeliveryOrderLike,
} from "./deliveryHubHelpers";

test("buildDeliveryDashboardStats aggregates totals by status and revenue", () => {
  const stats = buildDeliveryDashboardStats([
    { id: "1", total_amount: 120, status: "pending", created_at: "2026-07-24T10:00:00.000Z" },
    { id: "2", total_amount: 80, status: "delivering", created_at: "2026-07-24T11:00:00.000Z" },
    { id: "3", total_amount: 50, status: "completed", created_at: "2026-07-24T12:00:00.000Z" },
    { id: "4", total_amount: 30, status: "cancelled", created_at: "2026-07-24T13:00:00.000Z" },
  ]);

  assert.deepEqual(stats, {
    totalOrders: 4,
    pendingOrders: 1,
    activeOrders: 2,
    completedOrders: 1,
    cancelledOrders: 1,
    totalRevenue: 280,
  });
});

test("sortOrdersNewestFirst returns latest orders first without mutating input", () => {
  const orders: DeliveryOrderLike[] = [
    { id: "old", total_amount: 10, status: "pending", created_at: "2026-07-24T09:00:00.000Z" },
    { id: "new", total_amount: 20, status: "pending", created_at: "2026-07-24T12:00:00.000Z" },
  ];

  const sorted = sortOrdersNewestFirst(orders);

  assert.deepEqual(sorted.map((order) => order.id), ["new", "old"]);
  assert.deepEqual(orders.map((order) => order.id), ["old", "new"]);
});

test("buildOrderStatusUrl includes the tracking token when present", () => {
  assert.equal(
    buildOrderStatusUrl("order id", " token/value "),
    "/order-status/order%20id?t=token%2Fvalue"
  );
  assert.equal(buildOrderStatusUrl("order-id", ""), "/order-status/order-id");
});
