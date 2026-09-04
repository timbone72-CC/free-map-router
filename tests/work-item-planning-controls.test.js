const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const controlsPath = path.join(__dirname, '..', 'work-item-planning-controls.js');
const controlsSource = fs.readFileSync(controlsPath, 'utf8');
const routeWorkControlsPath = path.join(__dirname, '..', 'route-work-controls.js');
const routeWorkControlsSource = fs.readFileSync(routeWorkControlsPath, 'utf8');

function loadControlsHelper() {
  let domReady = null;
  const workItemKey = (kind, id) => `${String(kind).trim().toLowerCase()}:${String(id).trim()}`;
  const context = {
    FMRRouteWorkClear: {
      clearInspectorAdeRouteWork(history) { return { history, removedOrderIdCount: 0 }; },
      clearManualGigRouteWork(history) { return { history }; },
    },
    FMRRouteHistory: { writeRouteHistory(_storage, history) { return history; } },
    FMRGigContract: { readGigs() { return []; }, writeGigs(_s, gigs) { return gigs; } },
    FMRWorkItemPlanning: { workItemKey },
    FMRWorkItemPlanningRuntime: {
      get() { return null; },
      save() { throw new Error('not used'); },
      projectRoute() { throw new Error('not used'); },
    },
    document: {
      readyState: 'loading',
      addEventListener(name, callback) {
        if (name === 'DOMContentLoaded') domReady = callback;
      },
    },
  };
  context.globalThis = context;
  vm.runInNewContext(controlsSource, context, { filename: 'work-item-planning-controls.js' });
  assert.equal(typeof domReady, 'function');
  return context.FMRWorkItemPlanningControls;
}

test('minimal planning control source uses the exact runtime API, not direct planning storage writes', () => {
  assert.match(controlsSource, /FMRWorkItemPlanningRuntime/);
  assert.match(controlsSource, /planningRuntime\.get\(/);
  assert.match(controlsSource, /planningRuntime\.save\(/);
  assert.match(controlsSource, /planningRuntime\.projectRoute\(/);
  assert.match(controlsSource, /expectedRevision/);
  assert.doesNotMatch(controlsSource, /writePlanningRecords\(/);
  assert.doesNotMatch(controlsSource, /PLANNING_STORAGE_KEY/);
});

test('Build Route planning panel keeps one compact editor and adds only read-only service summaries', () => {
  assert.match(controlsSource, />Plan Work Item</);
  assert.match(controlsSource, /id="workItemPlanningServiceSummary"/);
  assert.match(controlsSource, /data-fmr-stop-service-time/);
  assert.match(controlsSource, /id="workItemPlanningSelect"/);
  assert.match(controlsSource, /id="workItemPlanningMinutes"/);
  assert.match(controlsSource, /id="workItemPlanningDate"/);
  assert.match(controlsSource, /id="workItemPlanningLocked"/);
  assert.match(controlsSource, /id="saveWorkItemPlanning"/);
  assert.doesNotMatch(controlsSource, /High|Medium|Low/);
  assert.doesNotMatch(controlsSource, /Google Optimize[\s\S]*serviceMinutes/);
});

test('route editor derives exact workbook and gig identities from route snapshot metadata', () => {
  const { planningRefsForSnapshot } = loadControlsHelper();
  const refs = planningRefsForSnapshot({
    routeIds: ['stop-b', 'stop-a'],
    orderIdsByStopId: {
      'stop-b': ['ORDER-2', 'ORDER-3', 'ORDER-2'],
      'stop-a': ['123'],
    },
    gigIdsByStopId: {
      'stop-b': ['GIG-9'],
      'stop-a': ['123'],
    },
  });
  assert.deepEqual(
    Array.from(refs, (ref) => `${ref.stopId}|${ref.kind}|${ref.workItemId}`),
    [
      'stop-b|workbook|ORDER-2',
      'stop-b|workbook|ORDER-3',
      'stop-b|gig|GIG-9',
      'stop-a|workbook|123',
      'stop-a|gig|123',
    ],
  );
});

test('same exact work item on two different stops fails closed', () => {
  const { planningRefsForSnapshot } = loadControlsHelper();
  assert.throws(
    () => planningRefsForSnapshot({
      routeIds: ['one', 'two'],
      orderIdsByStopId: { one: ['ORDER-X'], two: ['ORDER-X'] },
    }),
    /attached to more than one route stop/,
  );
});

test('planning UI carries stale revision and reloads instead of silently retrying', () => {
  assert.match(controlsSource, /form\.dataset\.expectedRevision/);
  assert.match(controlsSource, /changed elsewhere/);
  assert.match(controlsSource, /loadSelectedPlanning\(\)/);
  assert.doesNotMatch(controlsSource, /expectedRevision:\s*planningRuntime\.get/);
});

test('assigned day and locked-day remain independent approved planning fields', () => {
  assert.match(controlsSource, /assignedDate: date\.value/);
  assert.match(controlsSource, /lockedDay: locked\.checked/);
  assert.doesNotMatch(controlsSource, /assigned day before locking/);
});

test('service-minute formatting is compact and preserves fractional minutes', () => {
  const { formatServiceMinutes } = loadControlsHelper();
  assert.equal(formatServiceMinutes(0), '0 min');
  assert.equal(formatServiceMinutes(25), '25 min');
  assert.equal(formatServiceMinutes(60), '1 hr');
  assert.equal(formatServiceMinutes(75.5), '1 hr 15.5 min');
});

test('complete physical stop displays its already-derived total service time', () => {
  const { formatStopServiceText } = loadControlsHelper();
  assert.equal(
    formatStopServiceText({
      workItemCount: 2,
      serviceMinutes: 25,
      knownServiceMinutes: 25,
      complete: true,
      items: [
        { kind: 'workbook', workItemId: 'A', serviceMinutes: 5 },
        { kind: 'workbook', workItemId: 'B', serviceMinutes: 20 },
      ],
    }),
    'Service: 25 min',
  );
});

test('physical stop with unknown manual duration shows known time plus missing duration', () => {
  const { formatStopServiceText } = loadControlsHelper();
  assert.equal(
    formatStopServiceText({
      workItemCount: 2,
      serviceMinutes: null,
      knownServiceMinutes: 5,
      complete: false,
      items: [
        { kind: 'workbook', workItemId: 'ORDER-1', serviceMinutes: 5 },
        { kind: 'gig', workItemId: 'GIG-1', serviceMinutes: null },
      ],
    }),
    'Service: 5 min known + 1 work item missing duration',
  );
});

test('route service summary never invents a complete total when a work item duration is unknown', () => {
  const { formatRouteServiceText } = loadControlsHelper();
  assert.equal(
    formatRouteServiceText({
      workItemCount: 3,
      serviceMinutes: null,
      knownServiceMinutes: 25,
      complete: false,
      stops: [
        {
          items: [
            { kind: 'workbook', workItemId: 'ORDER-1', serviceMinutes: 5 },
            { kind: 'gig', workItemId: 'GIG-1', serviceMinutes: null },
          ],
        },
        {
          items: [
            { kind: 'workbook', workItemId: 'ORDER-2', serviceMinutes: 20 },
          ],
        },
      ],
    }),
    'Route service: 25 min known + 1 work item missing duration.',
  );
});

test('complete route service summary formats the true derived total', () => {
  const { formatRouteServiceText } = loadControlsHelper();
  assert.equal(
    formatRouteServiceText({
      workItemCount: 3,
      serviceMinutes: 65,
      knownServiceMinutes: 65,
      complete: true,
      stops: [],
    }),
    'Route service: 1 hr 5 min.',
  );
});

test('route work adapter loads the projection before the planning controls consumer', () => {
  assert.match(routeWorkControlsSource, /route-work-planning\.js\?v=1\.0\.0/);
  assert.match(routeWorkControlsSource, /work-item-planning-controls\.js\?v=1\.1\.0/);
  assert.match(routeWorkControlsSource, /script\.addEventListener\("load", loadPlanningControlsScript/);
  assert.match(routeWorkControlsSource, /if \(root\.FMRRouteWorkPlanning\)/);
});
