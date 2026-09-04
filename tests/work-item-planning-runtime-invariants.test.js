const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const runtimeSource = fs.readFileSync(path.join(__dirname, '..', 'work-item-planning-runtime.js'), 'utf8');
const KEY = 'fmr_work_item_planning_v1';

function memoryStorage(initial = []) {
  const values = new Map([[KEY, JSON.stringify(initial)]]);
  return {
    getItem(key) { return values.has(key) ? values.get(key) : null; },
    setItem(key, value) { values.set(key, String(value)); },
  };
}

function normalizeServiceMinutes(value) {
  if (value == null || String(value).trim() === '') return null;
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) throw new Error('Service minutes must be a positive number.');
  return n;
}
function normalizeCalendarDate(value) {
  if (value == null || String(value).trim() === '') return null;
  const raw = String(value).trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) throw new Error('Assigned date must be a valid local calendar date.');
  return raw;
}
function key(kind, id) { return `${String(kind).trim().toLowerCase()}:${String(id).trim()}`; }
function normalizeList(records) { return Array.isArray(records) ? records.map((r) => ({...r})) : []; }

function contract() {
  return {
    normalizeServiceMinutes,
    normalizeCalendarDate,
    readPlanningRecords(storage) {
      try { return normalizeList(JSON.parse(storage.getItem(KEY) || '[]')); } catch { return []; }
    },
    writePlanningRecords(storage, records) {
      const copy = normalizeList(records);
      storage.setItem(KEY, JSON.stringify(copy));
      return copy;
    },
    findPlanningRecord(records, kind, workItemId) {
      const wanted = key(kind, workItemId);
      return records.find((r) => key(r.kind, r.workItemId) === wanted) || null;
    },
    createPlanningRecord(draft, options = {}) {
      return {
        schemaVersion: 1,
        kind: String(draft.kind).trim().toLowerCase(),
        workItemId: String(draft.workItemId).trim(),
        serviceMinutes: normalizeServiceMinutes(draft.serviceMinutes),
        assignedDate: normalizeCalendarDate(draft.assignedDate),
        lockedDay: draft.lockedDay === true,
        revision: 1,
        updatedAt: new Date(options.now || Date.now()).toISOString(),
      };
    },
    applyPlanningEdit(records, kind, workItemId, patch, options = {}) {
      const wanted = key(kind, workItemId);
      return records.map((record) => {
        if (key(record.kind, record.workItemId) !== wanted) return {...record};
        if (record.revision !== options.expectedRevision) throw new Error('The planning record changed since it was loaded. Reload before editing it.');
        return {
          ...record,
          ...patch,
          kind: record.kind,
          workItemId: record.workItemId,
          revision: record.revision + 1,
          updatedAt: new Date(options.now || Date.now()).toISOString(),
        };
      });
    },
  };
}

function record(values = {}) {
  return {
    schemaVersion: 1,
    kind: 'workbook',
    workItemId: 'ORDER-1',
    serviceMinutes: values.serviceMinutes ?? 5,
    assignedDate: values.assignedDate ?? null,
    lockedDay: values.lockedDay === true,
    revision: values.revision ?? 1,
    updatedAt: '2026-09-03T20:00:00.000Z',
  };
}

function load(initial = []) {
  let domReady;
  const storage = memoryStorage(initial);
  const context = {
    FMRWorkItemPlanning: contract(),
    FMRBackup: { takeParsedPlanningForRestore() { return null; } },
    localStorage: storage,
    restoreRoutes(routes) { return routes; },
    document: { addEventListener(name, cb) { if (name === 'DOMContentLoaded') domReady = cb; } },
  };
  context.globalThis = context;
  vm.runInNewContext(runtimeSource, context, { filename: 'work-item-planning-runtime.js' });
  domReady();
  return context.FMRWorkItemPlanningRuntime;
}

test('cannot create a locked planning record without an assigned day', () => {
  const runtime = load();
  assert.throws(
    () => runtime.save('workbook', 'ORDER-1', { serviceMinutes: 5, lockedDay: true }, { expectedRevision: 0 }),
    /assigned day before locking/,
  );
});

test('existing assigned day can be locked with the exact revision', () => {
  const runtime = load([record({ assignedDate: '2026-09-05', lockedDay: false })]);
  const saved = runtime.save('workbook', 'ORDER-1', { lockedDay: true }, { expectedRevision: 1, now: '2026-09-03T23:00:00Z' });
  assert.equal(saved.assignedDate, '2026-09-05');
  assert.equal(saved.lockedDay, true);
  assert.equal(saved.revision, 2);
});

test('cannot clear an assigned day while leaving the effective record locked', () => {
  const runtime = load([record({ assignedDate: '2026-09-05', lockedDay: true })]);
  assert.throws(
    () => runtime.save('workbook', 'ORDER-1', { assignedDate: '' }, { expectedRevision: 1 }),
    /assigned day before locking/,
  );
});

test('assigned day and lock can be cleared together', () => {
  const runtime = load([record({ assignedDate: '2026-09-05', lockedDay: true })]);
  const saved = runtime.save('workbook', 'ORDER-1', { assignedDate: '', lockedDay: false }, { expectedRevision: 1, now: '2026-09-03T23:00:00Z' });
  assert.equal(saved.assignedDate, null);
  assert.equal(saved.lockedDay, false);
  assert.equal(saved.revision, 2);
});

test('brand-new blank planning form does not create an empty record', () => {
  const runtime = load();
  assert.throws(
    () => runtime.save('workbook', 'ORDER-1', { serviceMinutes: '', assignedDate: '', lockedDay: false }, { expectedRevision: 0 }),
    /no planning values to save/,
  );
  assert.equal(runtime.get('workbook', 'ORDER-1'), null);
});
