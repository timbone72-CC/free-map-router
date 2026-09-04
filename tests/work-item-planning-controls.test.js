const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const controlsPath = path.join(__dirname, '..', 'work-item-planning-controls.js');
const controlsSource = fs.readFileSync(controlsPath, 'utf8');

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
    FMRWorkItemPlanningRuntime: { get() { return null; }, save() { throw new Error('not used'); } },
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
  assert.match(controlsSource, /expectedRevision/);
  assert.doesNotMatch(controlsSource, /writePlanningRecords\(/);
  assert.doesNotMatch(controlsSource, /PLANNING_STORAGE_KEY/);
});

test('Build Route planning panel is one compact editor with only Phase 2G fields', () => {
  assert.match(controlsSource, />Plan Work Item</);
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

test('clearing assigned day automatically clears and disables day lock', () => {
  assert.match(controlsSource, /if \(!hasAssignedDay\) locked\.checked = false/);
  assert.match(controlsSource, /locked\.disabled = Boolean\(select\?\.disabled \|\| !hasAssignedDay\)/);
});
