export type OHLCData = {
  time: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

export type ChipData = {
  time: string;
  mainForce: number;
  foreign: number;
  trust: number;
  dealer: number;
};

/** 
 * Generate realistic OHLC candlestick data.
 * If seeds are provided, it fills the gaps between them to produce a continuous series.
 */
export function generateMockStockData(
  days: number,
  startPrice: number,
  volatility: number,
  targetPrice?: number,
  seedData?: OHLCData[]
): OHLCData[] {
  const result: OHLCData[] = [];
  const date = new Date();
  date.setDate(date.getDate() - days + 1);

  // Sort seeds by time
  const sortedSeeds = seedData ? [...seedData].sort((a, b) => a.time.localeCompare(b.time)) : [];
  
  let currentPrice = startPrice;
  let seedIdx = 0;

  for (let i = 0; i < days; i++) {
    const currentDate = fmtDate(date);
    const dow = date.getDay();

    // Check if we have a seed for this exact day
    const activeSeed = sortedSeeds.find(s => s.time === currentDate);

    if (activeSeed) {
      result.push(activeSeed);
      currentPrice = activeSeed.close;
      // Skip to next seed for finding the next target
      while(seedIdx < sortedSeeds.length && sortedSeeds[seedIdx].time <= currentDate) seedIdx++;
    } else if (dow !== 0 && dow !== 6) {
      // Generate random bar
      // Determine target for this segment
      const nextSeed = sortedSeeds[seedIdx];
      const segmentTarget = nextSeed ? nextSeed.open : (targetPrice || currentPrice);
      
      // Calculate a slight drift towards the target
      const remainingDays = nextSeed 
        ? Math.max(1, countTradingDays(currentDate, nextSeed.time))
        : (days - i);
      const drift = (segmentTarget - currentPrice) / remainingDays;

      const chg = (Math.random() - 0.48) * volatility + (drift / currentPrice);
      const open = round(currentPrice * (1 + (Math.random() - 0.5) * volatility * 0.2));
      const close = round(open * (1 + chg));
      const high = round(Math.max(open, close) * (1 + Math.random() * volatility * 0.3));
      const low = round(Math.min(open, close) * (1 - Math.random() * volatility * 0.3));
      const volume = Math.floor(Math.random() * 50000 + 10000);

      result.push({ time: currentDate, open, high, low, close, volume });
      currentPrice = close;
    }
    date.setDate(date.getDate() + 1);
  }

  return result;
}

/** Helper to count trading days between two strings (approximate) */
function countTradingDays(startStr: string, endStr: string): number {
  const s = new Date(startStr);
  const e = new Date(endStr);
  let count = 0;
  while (s < e) {
    const d = s.getDay();
    if (d !== 0 && d !== 6) count++;
    s.setDate(s.getDate() + 1);
  }
  return Math.max(1, count);
}

/** Generate institutional chip data. */
export function generateChipData(days: number, avgVol: number, seedData?: ChipData[]): ChipData[] {
  const result: ChipData[] = [];
  const date = new Date();
  date.setDate(date.getDate() - days + 1);
  const sortedSeeds = seedData ? [...seedData].sort((a, b) => a.time.localeCompare(b.time)) : [];

  for (let i = 0; i < days; i++) {
    const currentDate = fmtDate(date);
    const dow = date.getDay();
    const activeSeed = sortedSeeds.find(s => s.time === currentDate);

    if (activeSeed) {
      result.push(activeSeed);
    } else if (dow !== 0 && dow !== 6) {
      const scale = avgVol / 10;
      const f = round((Math.random() - 0.45) * scale);
      const t = round((Math.random() - 0.47) * (scale * 0.4));
      const d = round((Math.random() - 0.52) * (scale * 0.2));
      const m = round(f + t + d + (Math.random() - 0.5) * scale * 0.3);

      result.push({ time: currentDate, mainForce: m, foreign: f, trust: t, dealer: d });
    }
    date.setDate(date.getDate() + 1);
  }
  return result;
}

/** Generate simple line data. */
export function generateLineData(
  days: number,
  startValue: number,
  volatility: number,
  targetValue?: number,
  seedData?: { time: string; value: number }[]
): { time: string; value: number }[] {
  const result: { time: string; value: number }[] = [];
  const date = new Date();
  date.setDate(date.getDate() - days + 1);
  const sortedSeeds = seedData ? [...seedData].sort((a, b) => a.time.localeCompare(b.time)) : [];
  let val = startValue;
  let seedIdx = 0;

  for (let i = 0; i < days; i++) {
    const currentDate = fmtDate(date);
    const dow = date.getDay();
    const activeSeed = sortedSeeds.find(s => s.time === currentDate);

    if (activeSeed) {
      result.push(activeSeed);
      val = activeSeed.value;
      while(seedIdx < sortedSeeds.length && sortedSeeds[seedIdx].time <= currentDate) seedIdx++;
    } else if (dow !== 0 && dow !== 6) {
      const nextSeed = sortedSeeds[seedIdx];
      const segmentTarget = nextSeed ? nextSeed.value : (targetValue || val);
      const remainingDays = nextSeed ? countTradingDays(currentDate, nextSeed.time) : (days - i);
      const drift = (segmentTarget - val) / remainingDays;

      val = Math.max(5, round(val + drift + (Math.random() - 0.5) * (val * volatility)));
      result.push({ time: currentDate, value: val });
    }
    date.setDate(date.getDate() + 1);
  }
  return result;
}

export function generateBarData(days: number, amplitude: number) {
  const data: { time: string; value: number; color: string }[] = [];
  const date = new Date();
  date.setDate(date.getDate() - days + 1);
  for (let i = 0; i < days; i++) {
    const dow = date.getDay();
    if (dow !== 0 && dow !== 6) {
      const v = round((Math.random() - 0.5) * 2 * amplitude);
      data.push({ time: fmtDate(date), value: v, color: v >= 0 ? '#c0392b' : '#4a7c59' });
    }
    date.setDate(date.getDate() + 1);
  }
  return data;
}

export function generateTrendLine(days: number, startValue: number, drift: number, noise: number) {
  const data: { time: string; value: number }[] = [];
  let val = startValue;
  const date = new Date();
  date.setDate(date.getDate() - days + 1);
  for (let i = 0; i < days; i++) {
    const dow = date.getDay();
    if (dow !== 0 && dow !== 6) {
      val = Math.max(0, round(val * (1 + drift + (Math.random() - 0.5) * noise)));
      data.push({ time: fmtDate(date), value: val });
    }
    date.setDate(date.getDate() + 1);
  }
  return data;
}

export function generateBreadthData(days: number) {
  let v20 = 55, v60 = 60;
  const ma20: any[] = [];
  const ma60: any[] = [];
  const date = new Date();
  date.setDate(date.getDate() - days + 1);
  for (let i = 0; i < days; i++) {
    const dow = date.getDay();
    if (dow !== 0 && dow !== 6) {
      v20 = Math.min(100, Math.max(0, round(v20 + (Math.random() - 0.5) * 6)));
      v60 = Math.min(100, Math.max(0, round(v60 + (Math.random() - 0.5) * 3)));
      ma20.push({ time: fmtDate(date), value: v20 });
      ma60.push({ time: fmtDate(date), value: v60 });
    }
    date.setDate(date.getDate() + 1);
  }
  return { ma20, ma60 };
}

export function calculateMA(data: OHLCData[], period: number) {
  const result: any[] = [];
  for (let i = period - 1; i < data.length; i++) {
    let sum = 0;
    for (let j = 0; j < period; j++) sum += data[i - j].close;
    result.push({ time: data[i].time, value: sum / period });
  }
  return result;
}

function calcEMA(data: OHLCData[], period: number) {
  const k = 2 / (period + 1);
  let prev = data[0].close;
  return data.map((d) => {
    const ema = d.close * k + prev * (1 - k);
    prev = ema;
    return { time: d.time, value: ema };
  });
}

function calcEMASeries(data: any[], period: number) {
  if (!data.length) return [];
  const k = 2 / (period + 1);
  let prev = data[0].value;
  return data.map((d) => {
    const ema = d.value * k + prev * (1 - k);
    prev = ema;
    return { time: d.time, value: ema };
  });
}

export function calculateMACD(data: OHLCData[]) {
  const ema12 = calcEMA(data, 12);
  const ema26 = calcEMA(data, 26);
  const dif = ema12.map((d, i) => ({ time: d.time, value: d.value - ema26[i].value }));
  const dem = calcEMASeries(dif, 9);
  const histogram = dif.map((d, i) => ({ time: d.time, value: d.value - dem[i].value }));
  return { dif, dem, histogram };
}

export function calculateKD(data: OHLCData[]) {
  const period = 9;
  const result: any[] = [];
  let prevK = 50, prevD = 50;
  for (let i = period - 1; i < data.length; i++) {
    const slice = data.slice(i - period + 1, i + 1);
    const h = Math.max(...slice.map((d) => d.high));
    const l = Math.min(...slice.map((d) => d.low));
    const rsv = h !== l ? ((data[i].close - l) / (h - l)) * 100 : 50;
    const k = (2 / 3) * prevK + (1 / 3) * rsv;
    const d = (2 / 3) * prevD + (1 / 3) * k;
    result.push({ time: data[i].time, k, d });
    prevK = k; prevD = d;
  }
  return result;
}

export function calculateRSI(data: OHLCData[], period = 14) {
  if (data.length < period + 1) return [];
  const result: any[] = [];
  let gainSum = 0, lossSum = 0;
  for (let i = 1; i <= period; i++) {
    const diff = data[i].close - data[i - 1].close;
    if (diff > 0) gainSum += diff; else lossSum -= diff;
  }
  let avgGain = gainSum / period;
  let avgLoss = lossSum / period;
  for (let i = period; i < data.length; i++) {
    if (i > period) {
      const diff = data[i].close - data[i - 1].close;
      avgGain = (avgGain * (period - 1) + Math.max(0, diff))  / period;
      avgLoss = (avgLoss * (period - 1) + Math.max(0, -diff)) / period;
    }
    const rs  = avgLoss === 0 ? 100 : avgGain / avgLoss;
    const rsi = avgLoss === 0 ? 100 : 100 - 100 / (1 + rs);
    result.push({ time: data[i].time, value: round(rsi) });
  }
  return result;
}

function round(n: number) { return Math.round(n * 100) / 100; }
function fmtDate(d: Date)  { return d.toISOString().split('T')[0]; }
