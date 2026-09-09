#!/usr/bin/env bash
set -euo pipefail
python - <<'PY'
from pathlib import Path
p = Path('index.html')
s = p.read_text()
block = '''                <div id="routePlanControls" class="panel">
                    <div class="inlineHeader">
                        <h3>Multi-Day Plan</h3>
                        <label>
                            Active Day
                            <select id="routePlanDaySelector"></select>
                        </label>
                    </div>
                    <div class="row2">
                        <label>
                            Days
                            <input id="routePlanDayCount" type="number" min="1" step="1" value="1" />
                        </label>
                        <div class="btnRow">
                            <button id="routePlanAutoDays" type="button" class="btn btnSmall">
                                Suggest Days
                            </button>
                            <button id="routePlanBuildDays" type="button" class="btn btnSmall">
                                Build / Replace Plan
                            </button>
                        </div>
                    </div>
                    <div class="btnRow">
                        <button id="routePlanAssignDays" type="button" class="btn btnSmall">
                            Reassign Unlocked Work
                        </button>
                    </div>
                    <p id="routePlanStatus" class="tiny muted">
                        One-day routes still work normally. Multi-day assignment is local and never calls Google automatically.
                    </p>
                    <details>
                        <summary>Day assignments</summary>
                        <div id="routePlanAssignmentList"></div>
                    </details>
                </div>

'''
anchor = '                <div id="workdayControls" class="panel plannerWorkday">'
assert s.count(anchor) == 1
s = s.replace(anchor, block + anchor, 1)
a = '        <script src="route-plan.js?v=1.0.0"></script>\n'
assert s.count(a) == 1
s = s.replace(a, a + '        <script src="route-plan-days.js?v=1.0.0"></script>\n', 1)
a = '        <script src="planner-model.js?v=1.0.0"></script>\n'
assert s.count(a) == 1
s = s.replace(a, a + '        <script src="route-plan-controls.js?v=1.0.0"></script>\n', 1)
p.write_text(s)
PY
actual="$(git hash-object index.html)"
test "$actual" = "2dbe656dfc83d7c3cc0e6ef04f5ec071c113a3c2"
git diff --check -- index.html
