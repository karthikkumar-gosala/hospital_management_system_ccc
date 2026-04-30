/**
 * =========================================================
 * Smart Hospital Queue & Emergency Priority System
 * script.js — Max Heap Priority Queue + Greedy Algorithm
 *
 * DSA/DAA Concepts:
 *   - Max Heap (Priority Queue) for O(log n) insert/extract
 *   - Greedy Algorithm: always treat highest-priority patient first
 * =========================================================
 */

// ──────────────────────────────────────────
//  1. MAX HEAP (Priority Queue) Implementation
// ──────────────────────────────────────────
/**
 * MaxHeap class implementing a binary max-heap.
 * - insert(patient): O(log n) — adds patient and bubbles up
 * - extractMax():    O(log n) — removes root and heapifies down
 * - peek():          O(1)     — returns highest priority patient
 *
 * WHY GREEDY?
 * The greedy approach makes the locally optimal choice at each step:
 * always selecting the patient with the highest priority score.
 * In emergency triage this ensures critical patients are never
 * delayed by less urgent cases — each extraction is the best
 * possible decision given current information.
 */
class MaxHeap {
    constructor() {
        this.heap = [];
    }

    // Helper: parent/child index calculations
    _parent(i) { return Math.floor((i - 1) / 2); }
    _left(i)   { return 2 * i + 1; }
    _right(i)  { return 2 * i + 2; }

    _swap(i, j) {
        [this.heap[i], this.heap[j]] = [this.heap[j], this.heap[i]];
    }

    /**
     * Bubble-up: restore heap property after insertion.
     * Time Complexity: O(log n) — at most height-of-tree swaps
     */
    _bubbleUp(i) {
        while (i > 0 && this.heap[i].priority > this.heap[this._parent(i)].priority) {
            this._swap(i, this._parent(i));
            i = this._parent(i);
        }
    }

    /**
     * Heapify-down: restore heap property after extraction.
     * Time Complexity: O(log n)
     */
    _heapifyDown(i) {
        const n = this.heap.length;
        let largest = i;
        const l = this._left(i);
        const r = this._right(i);

        if (l < n && this.heap[l].priority > this.heap[largest].priority) largest = l;
        if (r < n && this.heap[r].priority > this.heap[largest].priority) largest = r;

        if (largest !== i) {
            this._swap(i, largest);
            this._heapifyDown(largest);
        }
    }

    /** Insert patient — O(log n) */
    insert(patient) {
        this.heap.push(patient);
        this._bubbleUp(this.heap.length - 1);
    }

    /** Extract patient with maximum priority — O(log n) (Greedy choice) */
    extractMax() {
        if (this.heap.length === 0) return null;
        const max = this.heap[0];
        const last = this.heap.pop();
        if (this.heap.length > 0) {
            this.heap[0] = last;
            this._heapifyDown(0);
        }
        return max;
    }

    /** Peek at highest-priority patient — O(1) */
    peek() { return this.heap.length > 0 ? this.heap[0] : null; }

    /** Return sorted copy for display (does NOT mutate heap) */
    getSorted() {
        return [...this.heap].sort((a, b) => b.priority - a.priority);
    }

    get size() { return this.heap.length; }
    isEmpty()  { return this.heap.length === 0; }
    clear()    { this.heap = []; }
}

// ──────────────────────────────────────────
//  2. PRIORITY CALCULATION (Greedy heuristic)
// ──────────────────────────────────────────
/**
 * Priority = severity × 2 + (emergency ? 10 : 0) + ageFactor
 * ageFactor: age > 60 → +5 | age < 10 → +3 | else → 0
 */
function calcPriority(severity, age, emergency) {
    let ageFactor = 0;
    if (age > 60) ageFactor = 5;
    else if (age < 10) ageFactor = 3;
    return severity * 2 + (emergency ? 10 : 0) + ageFactor;
}

function priorityTier(p) {
    if (p >= 20) return 'high';
    if (p >= 12) return 'med';
    return 'low';
}

// ──────────────────────────────────────────
//  3. APPLICATION STATE
// ──────────────────────────────────────────
const pq = new MaxHeap();
let treatedList = [];
let patientIdCounter = 1;
let totalWaitSim = 0; // simulated cumulative wait (minutes)

// ──────────────────────────────────────────
//  4. DOM REFERENCES
// ──────────────────────────────────────────
const $ = (s) => document.querySelector(s);
const form          = $('#patientForm');
const nameInput     = $('#patientName');
const ageInput      = $('#patientAge');
const severitySlider= $('#severitySlider');
const severityVal   = $('#severityValue');
const emergencyTog  = $('#emergencyToggle');
const treatBtn      = $('#treatNextBtn');
const resetBtn      = $('#resetBtn');
const sampleBtn     = $('#loadSampleBtn');
const themeBtn      = $('#themeToggle');
const queueContainer= $('#queueContainer');
const emptyState    = $('#emptyState');
const treatedCont   = $('#treatedContainer');
const noTreated     = $('#noTreated');
const queueCount    = $('#queueCount');
const statQueueVal  = $('#statQueueVal');
const statTreatedVal= $('#statTreatedVal');
const statAvgWaitVal= $('#statAvgWaitVal');
const statEmergencyVal=$('#statEmergencyVal');
const toastContainer= $('#toastContainer');

// ──────────────────────────────────────────
//  5. THEME TOGGLE
// ──────────────────────────────────────────
function setTheme(t) {
    document.documentElement.setAttribute('data-theme', t);
    localStorage.setItem('hq_theme', t);
}

themeBtn.addEventListener('click', () => {
    const cur = document.documentElement.getAttribute('data-theme');
    setTheme(cur === 'dark' ? 'light' : 'dark');
    updateCharts(); // re-render charts with correct colors
});

// Restore saved theme
(function initTheme() {
    const saved = localStorage.getItem('hq_theme');
    if (saved) setTheme(saved);
})();

// ──────────────────────────────────────────
//  6. SEVERITY SLIDER LIVE UPDATE
// ──────────────────────────────────────────
severitySlider.addEventListener('input', () => {
    const v = severitySlider.value;
    severityVal.textContent = v;
    // Color badge based on severity
    if (v >= 8) severityVal.style.background = 'var(--rose-500)';
    else if (v >= 5) severityVal.style.background = 'var(--amber-500)';
    else severityVal.style.background = 'var(--emerald-500)';
});

// ──────────────────────────────────────────
//  7. ADD PATIENT
// ──────────────────────────────────────────
form.addEventListener('submit', (e) => {
    e.preventDefault();
    const name = nameInput.value.trim();
    const age  = parseInt(ageInput.value, 10);
    const sev  = parseInt(severitySlider.value, 10);
    const emg  = emergencyTog.checked;

    if (!name || isNaN(age) || age < 0 || age > 120) {
        showToast('Please fill in valid details.', 'warning');
        return;
    }

    const patient = {
        id: patientIdCounter++,
        name, age, severity: sev, emergency: emg,
        priority: calcPriority(sev, age, emg),
        timestamp: Date.now()
    };

    pq.insert(patient);
    showToast(`${name} added — Priority ${patient.priority}`, emg ? 'error' : 'success');
    form.reset();
    severitySlider.value = 5;
    severityVal.textContent = '5';
    severityVal.style.background = 'var(--indigo-500)';
    refreshUI();
    saveState();
});

// ──────────────────────────────────────────
//  8. TREAT NEXT PATIENT (Greedy extraction)
// ──────────────────────────────────────────
treatBtn.addEventListener('click', () => {
    if (pq.isEmpty()) return;
    const patient = pq.extractMax(); // Greedy: always pick highest priority
    // Simulate wait time (2-15 min based on queue position)
    const wait = Math.floor(Math.random() * 13) + 2;
    totalWaitSim += wait;
    patient.waitTime = wait;
    patient.treatedAt = Date.now();
    treatedList.unshift(patient);
    showToast(`Treating ${patient.name} (Priority ${patient.priority})`, 'info');
    refreshUI();
    saveState();
});

// ──────────────────────────────────────────
//  9. RESET
// ──────────────────────────────────────────
resetBtn.addEventListener('click', () => {
    if (!pq.isEmpty() || treatedList.length > 0) {
        pq.clear();
        treatedList = [];
        totalWaitSim = 0;
        patientIdCounter = 1;
        showToast('Queue has been reset.', 'warning');
        refreshUI();
        saveState();
    }
});

// ──────────────────────────────────────────
//  10. SAMPLE DATA
// ──────────────────────────────────────────
const SAMPLES = [
    { name: 'Rahul Sharma',   age: 72, severity: 9, emergency: true  },
    { name: 'Priya Patel',    age: 28, severity: 4, emergency: false },
    { name: 'Amit Verma',     age: 5,  severity: 7, emergency: true  },
    { name: 'Sneha Reddy',    age: 45, severity: 3, emergency: false },
    { name: 'Vikram Singh',   age: 65, severity: 8, emergency: true  },
    { name: 'Ananya Gupta',   age: 8,  severity: 6, emergency: false },
    { name: 'Rajesh Kumar',   age: 55, severity: 5, emergency: false },
    { name: 'Meera Joshi',    age: 80, severity: 10,emergency: true  },
    { name: 'Karan Nair',     age: 34, severity: 2, emergency: false },
    { name: 'Divya Iyer',     age: 3,  severity: 8, emergency: true  },
];

sampleBtn.addEventListener('click', () => {
    // Clear existing queue to prevent duplicates
    pq.clear();
    treatedList = [];
    totalWaitSim = 0;
    patientIdCounter = 1;

    SAMPLES.forEach(s => {
        const p = {
            id: patientIdCounter++,
            ...s,
            priority: calcPriority(s.severity, s.age, s.emergency),
            timestamp: Date.now()
        };
        pq.insert(p);
    });
    showToast(`${SAMPLES.length} sample patients loaded!`, 'success');
    refreshUI();
    saveState();
});

// ──────────────────────────────────────────
//  11. UI RENDERING
// ──────────────────────────────────────────
function refreshUI() {
    renderQueue();
    renderTreated();
    updateStats();
    updateCharts();
    treatBtn.disabled = pq.isEmpty();
}

function renderQueue() {
    // Keep empty state or build cards
    const sorted = pq.getSorted();
    // Remove old patient cards (keep emptyState node)
    queueContainer.querySelectorAll('.patient-card').forEach(el => el.remove());

    if (sorted.length === 0) {
        emptyState.style.display = 'flex';
        queueCount.textContent = '0 patients';
        return;
    }
    emptyState.style.display = 'none';
    queueCount.textContent = `${sorted.length} patient${sorted.length > 1 ? 's' : ''}`;

    sorted.forEach((p, idx) => {
        const tier = priorityTier(p.priority);
        const rankClass = idx === 0 ? 'rank-1' : idx === 1 ? 'rank-2' : idx === 2 ? 'rank-3' : 'rank-default';
        const card = document.createElement('div');
        card.className = `patient-card priority-${tier}${idx === 0 ? ' is-top' : ''}`;
        card.style.animationDelay = `${idx * 0.05}s`;
        card.innerHTML = `
            <div class="rank-circle ${rankClass}">${idx + 1}</div>
            <div class="patient-info">
                <div class="patient-name">${esc(p.name)}</div>
                <div class="patient-meta">
                    <span class="meta-tag">Age ${p.age}</span>
                    <span class="meta-tag">Sev ${p.severity}/10</span>
                    ${p.emergency ? '<span class="meta-tag emergency">⚠ Emergency</span>' : ''}
                    ${idx === 0 ? '<span class="meta-tag emergency">⮕ NEXT</span>' : ''}
                </div>
            </div>
            <div class="priority-score">
                <span class="priority-number">${p.priority}</span>
                <span class="priority-label">Priority</span>
            </div>`;
        queueContainer.appendChild(card);
    });
}

function renderTreated() {
    treatedCont.querySelectorAll('.treated-item').forEach(el => el.remove());
    if (treatedList.length === 0) {
        noTreated.style.display = 'block';
        return;
    }
    noTreated.style.display = 'none';
    treatedList.slice(0, 20).forEach((p, i) => {
        const el = document.createElement('div');
        el.className = 'treated-item';
        el.style.animationDelay = `${i * 0.04}s`;
        el.innerHTML = `
            <span class="treated-name">${esc(p.name)} (Age ${p.age})</span>
            <span class="treated-priority">✓ P${p.priority} · ${p.waitTime || 0}min</span>`;
        treatedCont.appendChild(el);
    });
}

function updateStats() {
    statQueueVal.textContent = pq.size;
    statTreatedVal.textContent = treatedList.length;
    const avg = treatedList.length > 0 ? Math.round(totalWaitSim / treatedList.length) : 0;
    statAvgWaitVal.textContent = `${avg} min`;
    const emergCount = pq.getSorted().filter(p => p.emergency).length;
    statEmergencyVal.textContent = emergCount;
}

// ──────────────────────────────────────────
//  12. CHART.JS ANALYTICS
// ──────────────────────────────────────────
let priorityChart = null;
let severityChart = null;

function getChartTextColor() {
    return document.documentElement.getAttribute('data-theme') === 'dark' ? '#94a3b8' : '#475569';
}

function updateCharts() {
    const sorted = pq.getSorted();
    const textCol = getChartTextColor();

    // Priority Distribution (Doughnut)
    const high = sorted.filter(p => priorityTier(p.priority) === 'high').length;
    const med  = sorted.filter(p => priorityTier(p.priority) === 'med').length;
    const low  = sorted.filter(p => priorityTier(p.priority) === 'low').length;

    const doughnutData = {
        labels: ['High (≥20)', 'Medium (12-19)', 'Low (<12)'],
        datasets: [{
            data: [high, med, low],
            backgroundColor: ['#f43f5e', '#fbbf24', '#10b981'],
            borderWidth: 0,
            hoverOffset: 8
        }]
    };

    if (priorityChart) priorityChart.destroy();
    priorityChart = new Chart($('#priorityChart'), {
        type: 'doughnut',
        data: doughnutData,
        options: {
            responsive: true, maintainAspectRatio: false,
            plugins: {
                legend: { position: 'bottom', labels: { color: textCol, font: { family: 'Inter', size: 11, weight: '600' }, padding: 12 } },
                title: { display: true, text: 'Priority Distribution', color: textCol, font: { family: 'Inter', size: 13, weight: '700' } }
            },
            cutout: '62%'
        }
    });

    // Severity Bar Chart
    const sevBuckets = Array(10).fill(0);
    sorted.forEach(p => { sevBuckets[p.severity - 1]++; });
    // Include treated patients too
    treatedList.forEach(p => { sevBuckets[p.severity - 1]++; });

    const barData = {
        labels: ['1','2','3','4','5','6','7','8','9','10'],
        datasets: [{
            label: 'Patients',
            data: sevBuckets,
            backgroundColor: sevBuckets.map((_, i) => {
                if (i >= 7) return 'rgba(244, 63, 94, 0.7)';
                if (i >= 4) return 'rgba(251, 191, 36, 0.7)';
                return 'rgba(16, 185, 129, 0.7)';
            }),
            borderRadius: 6,
            borderSkipped: false,
        }]
    };

    if (severityChart) severityChart.destroy();
    severityChart = new Chart($('#severityChart'), {
        type: 'bar',
        data: barData,
        options: {
            responsive: true, maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                title: { display: true, text: 'Severity Breakdown (All Patients)', color: textCol, font: { family: 'Inter', size: 13, weight: '700' } }
            },
            scales: {
                x: { grid: { display: false }, ticks: { color: textCol, font: { family: 'Inter', weight: '600' } } },
                y: { beginAtZero: true, grid: { color: 'rgba(148,163,184,.1)' }, ticks: { color: textCol, stepSize: 1, font: { family: 'Inter' } } }
            }
        }
    });
}

// ──────────────────────────────────────────
//  13. LOCALSTORAGE PERSISTENCE
// ──────────────────────────────────────────
function saveState() {
    const state = {
        heap: pq.heap,
        treated: treatedList,
        nextId: patientIdCounter,
        totalWait: totalWaitSim
    };
    localStorage.setItem('hq_state', JSON.stringify(state));
}

function loadState() {
    try {
        const raw = localStorage.getItem('hq_state');
        if (!raw) return;
        const state = JSON.parse(raw);
        if (state.heap && Array.isArray(state.heap)) {
            // Rebuild heap properly, deduplicating by name+age
            pq.clear();
            const seen = new Set();
            state.heap.forEach(p => {
                const key = `${p.name}_${p.age}`;
                if (!seen.has(key)) {
                    seen.add(key);
                    pq.insert(p);
                }
            });
        }
        if (state.treated) treatedList = state.treated;
        if (state.nextId)  patientIdCounter = state.nextId;
        if (state.totalWait) totalWaitSim = state.totalWait;
        refreshUI();
        saveState(); // re-save the cleaned data
    } catch (e) {
        console.warn('Could not restore state:', e);
    }
}

// ──────────────────────────────────────────
//  14. TOAST NOTIFICATIONS
// ──────────────────────────────────────────
function showToast(msg, type = 'info') {
    const t = document.createElement('div');
    t.className = `toast toast-${type}`;
    t.textContent = msg;
    toastContainer.appendChild(t);
    setTimeout(() => {
        t.style.animation = 'toastOut .35s var(--ease) forwards';
        setTimeout(() => t.remove(), 350);
    }, 2800);
}

// ──────────────────────────────────────────
//  15. UTILITY
// ──────────────────────────────────────────
function esc(str) {
    const d = document.createElement('div');
    d.textContent = str;
    return d.innerHTML;
}

// ──────────────────────────────────────────
//  16. INITIALISE
// ──────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    loadState();
    if (pq.isEmpty() && treatedList.length === 0) {
        updateCharts(); // render empty charts
    }
});
