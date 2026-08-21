/**
 * Local transaction tracking for dashboard financial stats
 * Works alongside server API to provide real-time local data
 * Data is isolated per user to prevent cross-account data leakage
 */

// Get user-specific storage keys to ensure data isolation
function getStorageKeys(userId: string | null) {
  const suffix = userId ? `_${userId}` : '';
  return {
    TRANSACTIONS_KEY: `idara_local_transactions${suffix}`,
    DOWNLOADS_KEY: `idara_local_downloads${suffix}`,
  };
}

export type LocalTransaction = {
  id: string;
  type: "sale" | "invoice" | "payment";
  amount: number;
  profit: number;
  timestamp: number;
  description?: string;
};

export type LocalDownload = {
  id: string;
  filename: string;
  type: "pdf" | "excel" | "word";
  timestamp: number;
};

// Transaction management
export function addLocalTransaction(tx: Omit<LocalTransaction, "id" | "timestamp">, userId: string | null = null): void {
  try {
    const { TRANSACTIONS_KEY } = getStorageKeys(userId);
    const raw = localStorage.getItem(TRANSACTIONS_KEY);
    const list: LocalTransaction[] = raw ? JSON.parse(raw) : [];
    list.push({
      ...tx,
      id: crypto.randomUUID(),
      timestamp: Date.now(),
    });
    localStorage.setItem(TRANSACTIONS_KEY, JSON.stringify(list));
  } catch {
    /* ignore storage errors */
  }
}

export function getLocalTransactions(userId: string | null = null): LocalTransaction[] {
  try {
    const { TRANSACTIONS_KEY } = getStorageKeys(userId);
    const raw = localStorage.getItem(TRANSACTIONS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function clearLocalTransactions(userId: string | null = null): void {
  try {
    const { TRANSACTIONS_KEY } = getStorageKeys(userId);
    localStorage.removeItem(TRANSACTIONS_KEY);
  } catch {
    /* ignore */
  }
}

// Download tracking
export function addLocalDownload(dl: Omit<LocalDownload, "id" | "timestamp">, userId: string | null = null): void {
  try {
    const { DOWNLOADS_KEY } = getStorageKeys(userId);
    const raw = localStorage.getItem(DOWNLOADS_KEY);
    const list: LocalDownload[] = raw ? JSON.parse(raw) : [];
    list.push({
      ...dl,
      id: crypto.randomUUID(),
      timestamp: Date.now(),
    });
    localStorage.setItem(DOWNLOADS_KEY, JSON.stringify(list));
  } catch {
    /* ignore storage errors */
  }
}

export function getLocalDownloads(userId: string | null = null): LocalDownload[] {
  try {
    const { DOWNLOADS_KEY } = getStorageKeys(userId);
    const raw = localStorage.getItem(DOWNLOADS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function clearLocalDownloads(userId: string | null = null): void {
  try {
    const { DOWNLOADS_KEY } = getStorageKeys(userId);
    localStorage.removeItem(DOWNLOADS_KEY);
  } catch {
    /* ignore */
  }
}

// Calculate financial stats from local transactions
export function calculateLocalFinancialStats(userId: string | null = null): {
  docCount: number;
  todayRevenue: number;
  hourRevenue: number;
  todayNetProfit: number;
  hourNetProfit: number;
  salesCount: number;
  chart: { day: string; revenue: number }[];
} {
  const transactions = getLocalTransactions(userId);
  const downloads = getLocalDownloads(userId);
  const now = Date.now();
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const hourAgo = now - 3600000;

  let todayRevenue = 0;
  let hourRevenue = 0;
  let todayProfit = 0;
  let hourProfit = 0;
  let salesCount = 0;

  for (const tx of transactions) {
    const amount = Number(tx.amount) || 0;
    const profit = Number(tx.profit) || 0;
    
    if (tx.timestamp >= startOfToday.getTime()) {
      todayRevenue += amount;
      todayProfit += profit;
    }
    if (tx.timestamp >= hourAgo) {
      hourRevenue += amount;
      hourProfit += profit;
    }
    
    if (tx.type === "sale" || tx.type === "invoice") {
      salesCount++;
    }
  }

  // 7-day chart
  const chart: { day: string; revenue: number }[] = [];
  const dayMs = 86400000;
  for (let i = 6; i >= 0; i--) {
    const d = new Date(startOfToday.getTime() - i * dayMs);
    const d0 = d.getTime();
    const d1 = d0 + dayMs;
    let rev = 0;
    for (const tx of transactions) {
      if (tx.timestamp >= d0 && tx.timestamp < d1) {
        rev += Number(tx.amount) || 0;
      }
    }
    chart.push({
      day: d.toISOString().slice(0, 10),
      revenue: Math.round(rev * 100) / 100,
    });
  }

  return {
    docCount: transactions.length + downloads.length,
    todayRevenue: Math.round(todayRevenue * 100) / 100,
    hourRevenue: Math.round(hourRevenue * 100) / 100,
    todayNetProfit: Math.round(todayProfit * 100) / 100,
    hourNetProfit: Math.round(hourProfit * 100) / 100,
    salesCount: downloads.length,
    chart,
  };
}

// Add sample data for testing
export function addSampleTransactions(userId: string | null = null): void {
  const now = Date.now();
  const dayMs = 86400000;
  const { TRANSACTIONS_KEY } = getStorageKeys(userId);

  const sampleTransactions: Omit<LocalTransaction, "id" | "timestamp">[] = [
    { type: "sale", amount: 1500, profit: 300, description: "بيع اليوم" },
    { type: "sale", amount: 2300, profit: 460, description: "بيع صباح" },
    { type: "invoice", amount: 5000, profit: 1000, description: "فاتورة كبيرة" },
    { type: "payment", amount: 800, profit: 160, description: "دفع" },
  ];

  // Add transactions for past 7 days
  for (let i = 0; i < 7; i++) {
    const dayOffset = i * dayMs;
    sampleTransactions.forEach((tx, idx) => {
      // Manually create the transaction with timestamp
      const fullTx: LocalTransaction = {
        ...tx,
        id: crypto.randomUUID(),
        timestamp: now - dayOffset - (idx * 3600000),
      };
      try {
        const raw = localStorage.getItem(TRANSACTIONS_KEY);
        const list: LocalTransaction[] = raw ? JSON.parse(raw) : [];
        list.push(fullTx);
        localStorage.setItem(TRANSACTIONS_KEY, JSON.stringify(list));
      } catch {
        /* ignore storage errors */
      }
    });
  }

  // Add sample downloads
  for (let i = 0; i < 15; i++) {
    addLocalDownload({
      filename: `report_${i + 1}.pdf`,
      type: "pdf",
    }, userId);
  }
}
