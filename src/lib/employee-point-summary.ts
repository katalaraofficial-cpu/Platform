export type PointTransactionSummaryRow = {
  profile_id: string;
  transaction_type: string;
  points: number;
};

export type EmployeePointSummary = {
  points_balance: number;
  total_earned: number;
  total_redeemed: number;
};

export function summarizeEmployeePoints(rows: PointTransactionSummaryRow[]): EmployeePointSummary {
  let earnedNet = 0;
  const summary: EmployeePointSummary = {
    points_balance: 0,
    total_earned: 0,
    total_redeemed: 0,
  };

  for (const row of rows) {
    const points = Number(row.points ?? 0);
    summary.points_balance += points;
    if (row.transaction_type === "earn" || row.transaction_type === "adjust") {
      earnedNet += points;
    }
    if (row.transaction_type === "redeem") {
      summary.total_redeemed += Math.abs(points);
    }
  }

  summary.points_balance = Math.max(0, summary.points_balance);
  summary.total_earned = Math.max(0, earnedNet);
  return summary;
}

export function summarizeEmployeePointsByProfile(rows: PointTransactionSummaryRow[]) {
  const earnedNetByProfile = new Map<string, number>();
  const summaryMap = new Map<string, EmployeePointSummary>();

  for (const row of rows) {
    const current = summaryMap.get(row.profile_id) ?? {
      points_balance: 0,
      total_earned: 0,
      total_redeemed: 0,
    };

    const points = Number(row.points ?? 0);
    current.points_balance += points;
    if (row.transaction_type === "earn" || row.transaction_type === "adjust") {
      earnedNetByProfile.set(
        row.profile_id,
        (earnedNetByProfile.get(row.profile_id) ?? 0) + points
      );
    }
    if (row.transaction_type === "redeem") {
      current.total_redeemed += Math.abs(points);
    }

    current.points_balance = Math.max(0, current.points_balance);
    summaryMap.set(row.profile_id, current);
  }

  for (const [profileId, current] of summaryMap.entries()) {
    current.total_earned = Math.max(0, earnedNetByProfile.get(profileId) ?? 0);
  }

  return summaryMap;
}
