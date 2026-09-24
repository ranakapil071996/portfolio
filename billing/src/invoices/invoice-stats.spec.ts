import { addDays, buildCharts, contribution, emptyBucket, statDeltas, sumBuckets } from "./invoice-stats";

describe("invoice stats", () => {
  const issued = {
    invoiceDate: new Date("2026-09-12T00:00:00.000Z"),
    status: "issued",
    grandTotal: 236,
    taxableTotal: 200,
    cgstTotal: 0,
    sgstTotal: 0,
    igstTotal: 36,
    cessTotal: 0,
    amountPaid: 0,
  };

  it("counts an unpaid bill as sales and due, with no pay mode", () => {
    const bucket = contribution(issued);
    expect(bucket).toMatchObject({
      day: "2026-09-12",
      sales: 236,
      gst: 36,
      paid: 0,
      due: 236,
      count: 1,
      unpaidCount: 1,
      paidCount: 0,
      cash: 0,
    });
  });

  it("attributes collected cash and leaves the balance due", () => {
    const bucket = contribution({
      ...issued,
      status: "partial",
      amountPaid: 100,
      payMode: "upi",
    });
    expect(bucket).toMatchObject({
      paid: 100,
      due: 136,
      partialCount: 1,
      unpaidCount: 0,
      upi: 100,
    });
  });

  it("nets a same-day edit and moves a date change across days", () => {
    const paid = { ...issued, status: "paid", amountPaid: 236, payMode: "cash" };
    const sameDay = statDeltas(issued, paid);
    expect(sameDay).toHaveLength(1);
    expect(sameDay[0]).toMatchObject({ day: "2026-09-12", paid: 236, due: -236, paidCount: 1, unpaidCount: -1, cash: 236, sales: 0 });

    const moved = statDeltas(issued, { ...issued, invoiceDate: "2026-09-13" });
    expect(moved.map((row) => row.day).sort()).toEqual(["2026-09-12", "2026-09-13"]);
    expect(sumBuckets(moved).sales).toBe(0);
    expect(sumBuckets(moved).count).toBe(0);
  });

  it("treats a paid bill with no stored amount as fully collected", () => {
    const bucket = contribution({ ...issued, status: "paid", amountPaid: undefined, payMode: "card" });
    expect(bucket).toMatchObject({ paid: 236, due: 0, paidCount: 1, unpaidCount: 0, card: 236 });
  });

  it("drops a deleted invoice and ignores a missing date", () => {
    expect(statDeltas(issued, { ...issued, deletedAt: new Date() })[0].sales).toBe(-236);
    expect(contribution({ ...issued, invoiceDate: null })).toBeNull();
  });

  it("fills 30 daily and 12 monthly points from rollups only", () => {
    const day = emptyBucket("2026-09-24");
    day.sales = 500;
    day.paid = 200;
    day.due = 300;
    day.gst = 90;
    day.count = 2;
    day.cash = 200;
    const charts = buildCharts(
      { sales: 500, paid: 200, due: 300, gst: 90, count: 2, paidCount: 0, partialCount: 1, unpaidCount: 1, cash: 200 },
      [day],
      new Date("2026-09-24T08:00:00.000Z"),
    );
    expect(charts.daily).toHaveLength(30);
    expect(charts.monthly).toHaveLength(12);
    expect(charts.daily[29]).toMatchObject({ day: "2026-09-24", sales: 500 });
    expect(charts.monthly[11]).toMatchObject({ month: "2026-09", sales: 500, gst: 90 });
    expect(charts.totals).toMatchObject({ paid: 200, due: 300, collectionRate: 40 });
    expect(charts.payModes.find((mode) => mode.mode === "cash")?.amount).toBe(200);
    expect(addDays("2026-09-24", -29)).toBe(charts.daily[0].day);
  });
});
