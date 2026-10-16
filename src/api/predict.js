/**
 * paradisometer — calibrated multi-model temperature, relative-humidity and
 * delta-T forecast, nudged towards live BoM observations.
 *
 * Fetches the raw Open-Meteo multi-model forecast, applies the blending /
 * calibration model fitted by train.js (model.json), then:
 *   - replaces any hour that already has a BoM observation with the observation
 *   - corrects the remaining (future) hours by the model's recent observed bias,
 *     decaying that correction with lead time
 *
 * Usage:
 *   node predict.js                 # pretty table for the next 3 days
 *   node predict.js --json          # machine-readable JSON
 *   node predict.js --lat -43.2 --lon 148 --days 3
 *   node predict.js --no-obs        # skip the observation nudge
 *
 * As a library:
 *   const { getForecast, applyModel } = require('./predict');
 *   const hours = await getForecast({ latitude: -43.2, longitude: 148 });
 */
import MODEL from './model.json' with { type: 'json' };

const API = 'https://api.open-meteo.com/v1/forecast';

// Live observations for Tasman Island (WMO 95986). Updated every ~10-30 min and
// covering roughly the last 72 hours. The BoM feed sends no CORS headers, so in
// the browser we go through the /bom proxy configured in vite.config.js.
const OBS_PATH = '/fwo/IDT60801/IDT60801.95986.json';
const OBS_URL =
  typeof window === 'undefined' ? `https://www.bom.gov.au${OBS_PATH}` : `/bom${OBS_PATH}`;

// How the observation nudge behaves.
const NUDGE = {
  // e-folding time (hours) used to weight recent observations when estimating
  // the model's current bias — the last few hours dominate.
  biasTau: 6,
  // how many hours of history to consider at all
  biasWindow: 24,
  // e-folding time (hours) over which the correction decays with lead time
  decayTau: 8,
  // hard caps so a single bad observation cannot wreck the forecast
  maxBias: { temp: 4, rhum: 20, dt: 3 },
};

// Only the members the fitted model actually uses. chmi_aladin_seamless and
// meteoswiss_icon_seamless have no history at this location, and
// cma_grapes_global / kma_seamless / meteofrance_seamless were shown by
// ablate.js to add nothing, so none of them are requested.
const MODELS = [...new Set([
  ...MODEL.temp.models,
  ...MODEL.rhum.models,
  ...(MODEL.dt ? MODEL.dt.models : []),
])];

const TARGETS = {
  temp: { apiPrefix: 'temperature_2m', unit: '°C' },
  rhum: { apiPrefix: 'relative_humidity_2m', unit: '%' },
};

// ---------------------------------------------------------------- features
// NOTE: must stay byte-for-byte consistent with train.js.

const RESID_FEATURES = [
  'hourSin1', 'hourCos1', 'hourSin2', 'hourCos2', 'hourSin3', 'hourCos3',
  'yearSin1', 'yearCos1', 'yearSin2', 'yearCos2',
  'spread', 'nAvail', 'blendAnom',
];

function timeFeatures(isoLocal) {
  const t = Date.parse(isoLocal.slice(0, 16) + ':00Z');
  const d = new Date(t);
  const hour = d.getUTCHours() + d.getUTCMinutes() / 60;
  const startOfYear = Date.UTC(d.getUTCFullYear(), 0, 1);
  const doy = (t - startOfYear) / 86400000;
  const yearLen = (Date.UTC(d.getUTCFullYear() + 1, 0, 1) - startOfYear) / 86400000;
  const h = (2 * Math.PI * hour) / 24;
  const y = (2 * Math.PI * doy) / yearLen;
  return {
    hourSin1: Math.sin(h), hourCos1: Math.cos(h),
    hourSin2: Math.sin(2 * h), hourCos2: Math.cos(2 * h),
    hourSin3: Math.sin(3 * h), hourCos3: Math.cos(3 * h),
    yearSin1: Math.sin(y), yearCos1: Math.cos(y),
    yearSin2: Math.sin(2 * y), yearCos2: Math.cos(2 * y),
  };
}

function blend(weights, members) {
  let num = 0, den = 0;
  for (const [m, z] of members) { num += weights[m] * z; den += weights[m]; }
  if (den <= 1e-9) {
    let s = 0;
    for (const [, z] of members) s += z;
    return members.length ? s / members.length : null;
  }
  return num / den;
}

/**
 * Apply the fitted model for one target at one hour.
 * @param {string} targetKey 'temp' | 'rhum'
 * @param {string} time ISO hour, UTC
 * @param {Object<string,number>} raw model name -> raw forecast value
 */
function applyModel(targetKey, time, raw) {
  const mdl = MODEL[targetKey];
  const members = [];
  for (let m = 0; m < mdl.models.length; m++) {
    const v = raw[mdl.models[m]];
    if (!Number.isFinite(v)) continue;
    const c = mdl.calib[mdl.models[m]];
    members.push([m, c.a * v + c.c]);
  }
  if (!members.length) return null;

  const b = blend(mdl.weights, members);

  let mean = 0;
  for (const [, z] of members) mean += z;
  mean /= members.length;
  let varr = 0;
  for (const [, z] of members) varr += (z - mean) * (z - mean);
  const spread = Math.sqrt(varr / members.length);

  const scale = mdl.scale ?? (targetKey === 'temp' ? 10 : 50);
  const anchor = mdl.anchor ?? (targetKey === 'temp' ? 12 : 70);
  const vals = {
    ...timeFeatures(time),
    spread,
    nAvail: members.length / 10,
    blendAnom: (b - anchor) / scale,
  };
  const x = [1, ...RESID_FEATURES.map((k) => vals[k])];

  let corr = 0;
  for (let j = 0; j < x.length; j++) corr += x[j] * mdl.beta[j];

  const [lo, hi] = mdl.clamp;
  return {
    value: Math.max(lo, Math.min(hi, b + corr)),
    spread,
    nMembers: members.length,
  };
}
// ---------------------------------------------------------------- enrich data
/**
 * Calculate wet bulb temperate using Stull approximation
 * @returns wet bulb temperature in °C
 */
function getWetBulbTemp(temp, rhum) {
  if (temp === null || rhum === null) return null;
  const r = Math.max(1, Math.min(100, rhum));
  let tw =  temp * Math.atan(0.151977 * Math.sqrt(r + 8.313659)) + 
            Math.atan(temp + r) - Math.atan(r - 1.676331) + 
            0.00391838 * Math.pow(r, 1.5) * Math.atan(0.023101 * r) - 4.686035;
  return tw;
}

// ---------------------------------------------------------------- fetching

/**
 * @param {number} pastDays how many days of already-elapsed hours to request.
 *   These overlap the BoM observation window and are what makes the
 *   model -> current-reading bias estimate possible.
 */
async function fetchRaw({ latitude = -43.2, longitude = 148, days = 3, pastDays = 2 } = {}) {
  const url =
    `${API}?latitude=${latitude}&longitude=${longitude}` +
    `&hourly=temperature_2m,relative_humidity_2m` +
    `&models=${MODELS.join(',')}&forecast_days=${days}&past_days=${pastDays}` +
    `&timezone=UTC`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Open-Meteo request failed: ${res.status} ${res.statusText}`);
  return res.json();
}

// ---------------------------------------------------------------- observations

const num = (v) => {
  const n = typeof v === 'string' ? parseFloat(v) : v;
  return Number.isFinite(n) ? n : null;
};

/** "20260909073000" (UTC) -> ms since epoch. */
function parseAifsUtc(s) {
  if (typeof s !== 'string' || s.length < 14) return NaN;
  return Date.UTC(
    +s.slice(0, 4), +s.slice(4, 6) - 1, +s.slice(6, 8),
    +s.slice(8, 10), +s.slice(10, 12), +s.slice(12, 14)
  );
}

/**
 * Fetches the BoM observation feed and snaps it onto whole UTC hours.
 * For each hour the reading closest to the top of the hour (within 30 min) wins.
 * @returns {Map<string, {temp:number|null, rhum:number|null, dt:number|null, obsTime:string}>}
 *   keyed by ISO UTC hour, e.g. "2026-09-09T07:00".
 */
async function fetchObservations(url = OBS_URL) {
  const res = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!res.ok) throw new Error(`BoM observation request failed: ${res.status} ${res.statusText}`);
  const json = await res.json();
  const data = json?.observations?.data;
  if (!Array.isArray(data)) throw new Error('unexpected BoM observation payload');

  const best = new Map(); // hourKey -> { offset, row }
  for (const o of data) {
    const t = parseAifsUtc(o.aifstime_utc);
    if (!Number.isFinite(t)) continue;
    const hour = Math.round(t / 3600000) * 3600000;
    const offset = Math.abs(t - hour);
    if (offset > 30 * 60000) continue;
    const key = new Date(hour).toISOString().slice(0, 16);
    const prev = best.get(key);
    if (prev && prev.offset <= offset) continue;

    const temp = num(o.air_temp);
    const rhum = num(o.rel_hum);
    // BoM publishes delta_t directly; fall back to deriving it.
    let dt = num(o.delta_t);
    if (dt === null && temp !== null && rhum !== null) dt = temp - getWetBulbTemp(temp, rhum);
    best.set(key, {
      offset,
      row: { temp, rhum, dt, obsTime: new Date(t).toISOString() },
    });
  }

  const out = new Map();
  for (const [k, v] of best) out.set(k, v.row);
  return out;
}

/**
 * Estimates the model's current bias per target from the overlap between the
 * model's hindcast hours and the observations, weighting recent hours most.
 * @returns {{temp:number, rhum:number, dt:number, n:number, latest:string|null}}
 */
function estimateBias(modelled, observations, nowMs) {
  const acc = { temp: [0, 0], rhum: [0, 0], dt: [0, 0] };
  let n = 0;
  let latest = null;
  for (const row of modelled) {
    const obs = observations.get(row.key);
    if (!obs) continue;
    const ageH = (nowMs - row.ms) / 3600000;
    if (ageH < 0 || ageH > NUDGE.biasWindow) continue;
    const w = Math.exp(-ageH / NUDGE.biasTau);
    let used = false;
    for (const k of ['temp', 'rhum', 'dt']) {
      const p = row.pred[k];
      const y = obs[k];
      if (p === null || y === null || !Number.isFinite(y)) continue;
      acc[k][0] += w * (y - p);
      acc[k][1] += w;
      used = true;
    }
    if (used) {
      n++;
      if (!latest || row.ms > latest.ms) latest = { ms: row.ms, key: row.key };
    }
  }
  const bias = {};
  for (const k of ['temp', 'rhum', 'dt']) {
    const b = acc[k][1] > 1e-6 ? acc[k][0] / acc[k][1] : 0;
    const cap = NUDGE.maxBias[k];
    bias[k] = Math.max(-cap, Math.min(cap, b));
  }
  return { ...bias, n, latest: latest ? latest.key : null };
}

/** Normalises the Open-Meteo response into [{ time, temp:{model:v}, rhum:{...}, dt:{...} }]. */
function parseRaw(json) {
  const hourly = json.hourly;
  const times = hourly.time;
  return times.map((time, i) => {
    const row = { time, temp: {}, rhum: {}, dt: {} };
    for (const [key, t] of Object.entries(TARGETS)) {
      for (const model of MODELS) {
        const v = hourly[`${t.apiPrefix}_${model}`]?.[i];
        if (Number.isFinite(v)) row[key][model] = v;
      }
    }
    // per-member delta T, matching how the model was trained
    for (const model of Object.keys(row.temp)) {
      const tw = getWetBulbTemp(row.temp[model], row.rhum[model]);
      if (Number.isFinite(tw)) row.dt[model] = row.temp[model] - tw;
    }
    return row;
  });
}

async function getForecast(opts = {}) {
  const { useObservations = true, now = Date.now() } = opts;
  const json = await fetchRaw(opts);
  const rows = parseRaw(json);

  // --- pure model output, one entry per hour
  const modelled = rows.map((row) => {
    const t = applyModel('temp', row.time, row.temp);
    const r = applyModel('rhum', row.time, row.rhum);
    // delta T comes from its own directly-optimised model where available,
    // falling back to deriving it from the temp/rhum models.
    const d = MODEL.dt ? applyModel('dt', row.time, row.dt) : null;
    const dtValue = d
      ? d.value
      : t && r
        ? t.value - getWetBulbTemp(t.value, r.value)
        : null;
    const key = row.time.slice(0, 16);
    return {
      key,
      ms: Date.parse(key + ':00Z'),
      raw: row,
      t, r, d,
      pred: {
        temp: t ? t.value : null,
        rhum: r ? r.value : null,
        dt: dtValue,
      },
    };
  });

  // --- live observations (best effort: the forecast still works without them)
  let observations = new Map();
  let obsError = null;
  if (useObservations) {
    try {
      observations = await fetchObservations(opts.observationsUrl);
    } catch (e) {
      obsError = e.message;
    }
  }

  const bias = observations.size
    ? estimateBias(modelled, observations, now)
    : { temp: 0, rhum: 0, dt: 0, n: 0, latest: null };
  const anchorMs = bias.latest ? Date.parse(bias.latest + ':00Z') : now;

  return modelled.map((m) => {
    const obs = observations.get(m.key);
    const { t, r, d } = m;

    // lead time measured from the most recent hour we have an observation for
    const leadH = Math.max(0, (m.ms - anchorMs) / 3600000);
    const decay = bias.n ? Math.exp(-leadH / NUDGE.decayTau) : 0;
    const adjust = (v, k) => (v === null ? null : v + bias[k] * decay);

    // an observed hour is reported verbatim; anything the observation is
    // missing falls back to the nudged model value
    const observed = !!obs;
    const temperature = observed && obs.temp !== null ? obs.temp : adjust(m.pred.temp, 'temp');
    const humidity = observed && obs.rhum !== null ? obs.rhum : adjust(m.pred.rhum, 'rhum');
    let deltaT = observed && obs.dt !== null ? obs.dt : adjust(m.pred.dt, 'dt');
    if (deltaT !== null) deltaT = Math.max(0, deltaT);

    return {
      time: new Date(m.key + ':00Z'),
      source: observed ? 'observation' : 'forecast',
      temperature_2m: round(temperature, 2),
      relative_humidity_2m: round(humidity, 1),
      wet_bulb_2m:
        temperature !== null && deltaT !== null ? round(temperature - deltaT, 2) : null,
      delta_t: round(deltaT, 2),
      model: {
        temperature_2m: round(m.pred.temp, 2),
        relative_humidity_2m: round(m.pred.rhum, 1),
        delta_t: round(m.pred.dt, 2),
      },
      nudge: observed
        ? null
        : {
            lead_hours: round(leadH, 1),
            temperature_2m: round(bias.temp * decay, 2),
            relative_humidity_2m: round(bias.rhum * decay, 1),
            delta_t: round(bias.dt * decay, 2),
          },
      ensemble: {
        temperature_spread: t ? round(t.spread, 2) : null,
        humidity_spread: r ? round(r.spread, 2) : null,
        delta_t_spread: d ? round(d.spread, 2) : null,
        members: t ? t.nMembers : 0,
      },
      raw_mean: {
        temperature_2m: round(mean(Object.values(m.raw.temp)), 2),
        relative_humidity_2m: round(mean(Object.values(m.raw.rhum)), 1),
        delta_t: round(mean(Object.values(m.raw.dt)), 2),
      },
      _meta: { bias, obsError },
    };
  });
}

const mean = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : null);
const round = (v, d) => (v === null || !Number.isFinite(v) ? null : Number(v.toFixed(d)));

const HOBART_FMT = new Intl.DateTimeFormat('en-AU', {
  timeZone: 'Australia/Hobart',
  year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit', hour12: false,
});

/** Formats a Date as "YYYY-MM-DD HH:MM" in Australia/Hobart local time. */
function hobartTime(date) {
  const p = Object.fromEntries(
    HOBART_FMT.formatToParts(date).map(({ type, value }) => [type, value])
  );
  return `${p.year}-${p.month}-${p.day} ${p.hour}:${p.minute}`;
}

// ---------------------------------------------------------------- CLI

function parseArgs(argv) {
  const o = { latitude: -43.2, longitude: 148, days: 3, pastDays: 2, json: false };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--json') o.json = true;
    else if (argv[i] === '--no-obs') o.useObservations = false;
    else if (argv[i] === '--lat') o.latitude = parseFloat(argv[++i]);
    else if (argv[i] === '--lon') o.longitude = parseFloat(argv[++i]);
    else if (argv[i] === '--days') o.days = parseInt(argv[++i], 10);
    else if (argv[i] === '--past-days') o.pastDays = parseInt(argv[++i], 10);
  }
  return o;
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  const rows = await getForecast(opts);

  if (opts.json) {
    console.log(JSON.stringify(rows, null, 2));
    return;
  }

  const cv = MODEL.temp.cv;
  const meta = rows.length ? rows[0]._meta : { bias: { n: 0 }, obsError: null };
  console.log(
    `paradisometer forecast  lat=${opts.latitude} lon=${opts.longitude}  (Australia/Hobart)\n` +
    `calibrated blend of ${MODEL.temp.models.length} NWP models\n` +
    `expected skill (blocked CV): temp MAE ${cv.model.mae.toFixed(2)}°C, ` +
    `rhum MAE ${MODEL.rhum.cv.model.mae.toFixed(2)}%` +
    (MODEL.dt ? `, deltaT MAE ${MODEL.dt.cv.model.mae.toFixed(2)}°C` : '')
  );
  if (meta.obsError) {
    console.log(`observations unavailable (${meta.obsError}) — pure model output`);
  } else if (meta.bias.n) {
    console.log(
      `obs nudge from ${meta.bias.n} observed hours (latest ${meta.bias.latest}Z): ` +
      `temp ${meta.bias.temp >= 0 ? '+' : ''}${meta.bias.temp.toFixed(2)}°C, ` +
      `rhum ${meta.bias.rhum >= 0 ? '+' : ''}${meta.bias.rhum.toFixed(1)}%, ` +
      `deltaT ${meta.bias.dt >= 0 ? '+' : ''}${meta.bias.dt.toFixed(2)}°C ` +
      `(decaying with tau=${NUDGE.decayTau}h)`
    );
  }
  console.log();
  console.log(
    'time              src   temp    (raw)   rhum   (raw)   twet    deltaT  (model)  n'
  );
  console.log('-'.repeat(80));
  for (const r of rows) {
    console.log(
      `${hobartTime(r.time)}  ` +
      `${(r.source === 'observation' ? 'obs' : 'fcst').padEnd(5)}` +
      `${String(r.temperature_2m).padStart(5)}°C ` +
      `${String(r.raw_mean.temperature_2m).padStart(6)}  ` +
      `${String(r.relative_humidity_2m).padStart(5)}% ` +
      `${String(r.raw_mean.relative_humidity_2m).padStart(6)}  ` +
      `${String(r.wet_bulb_2m).padStart(5)}°C  ` +
      `${String(r.delta_t).padStart(5)}°C ` +
      `${String(r.model.delta_t).padStart(6)}  ` +
      `${r.ensemble.members}`
    );
  }
}

if (typeof process !== 'undefined' && process.argv && import.meta.url === `file://${process.argv[1]}`) {
  main().catch((e) => {
    console.error(e.message);
    process.exit(1);
  });
}

export {
  getForecast,
  applyModel,
  fetchRaw,
  parseRaw,
  fetchObservations,
  estimateBias,
  MODEL,
  OBS_URL,
  NUDGE,
};
