/**
 * Aggregation Reports & Query Performance Analytics Controller
 * Restricted to authenticated administrators
 */

function getAuthHeaders(customHeaders = {}) {
  const token = localStorage.getItem('admin_token');
  const headers = { ...customHeaders };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

document.addEventListener('DOMContentLoaded', async () => {
  // Check auth before loading reports
  try {
    const authRes = await fetch('/api/auth/verify', { headers: getAuthHeaders() });
    const authJson = await authRes.json();
    if (!authJson.authenticated) {
      window.location.href = '/admin-login.html?error=unauthorized';
      return;
    }
  } catch (e) {
    window.location.href = '/admin-login.html?error=unauthorized';
    return;
  }

  loadAllReports();
});

async function handleAdminLogout() {
  try {
    await fetch('/api/auth/logout', { method: 'POST', headers: getAuthHeaders() });
  } catch (e) {}
  localStorage.removeItem('admin_token');
  window.location.href = '/admin-login.html';
}

async function loadAllReports() {
  loadBookingStatusReport();
  loadPopularRoutesReport();
  loadBookingsPerFlightReport();
  loadRevenueReport();
}

/**
 * Report 3: Booking Status Summary
 */
async function loadBookingStatusReport() {
  const tbody = document.getElementById('reportBookingStatusBody');
  tbody.innerHTML = '<tr><td colspan="4" style="text-align: center; padding: 1.5rem;">Running aggregation pipeline...</td></tr>';

  try {
    const res = await fetch('/api/reports/booking-status', { headers: getAuthHeaders() });
    if (res.status === 401) {
      window.location.href = '/admin-login.html?error=unauthorized';
      return;
    }
    const json = await res.json();

    if (!json.success || !json.data) {
      tbody.innerHTML = `<tr><td colspan="4" style="color: var(--danger); text-align: center;">Error: ${json.message}</td></tr>`;
      return;
    }

    const data = json.data;
    if (data.length === 0) {
      tbody.innerHTML = '<tr><td colspan="4" style="text-align: center;">No booking records available.</td></tr>';
      return;
    }

    tbody.innerHTML = data.map(item => {
      const statusClass = `status-${item.status.toLowerCase()}`;
      return `
        <tr>
          <td><span class="status-badge ${statusClass}">${item.status}</span></td>
          <td><strong>${item.count.toLocaleString()}</strong></td>
          <td>${item.total_seats.toLocaleString()} seats</td>
          <td><strong>${formatCurrency(item.total_amount)}</strong></td>
        </tr>
      `;
    }).join('');
  } catch (err) {
    tbody.innerHTML = '<tr><td colspan="4" style="color: var(--danger); text-align: center;">Failed to load booking status report.</td></tr>';
  }
}

/**
 * Report 2: Most Popular Routes
 */
async function loadPopularRoutesReport() {
  const tbody = document.getElementById('reportPopularRoutesBody');
  tbody.innerHTML = '<tr><td colspan="4" style="text-align: center; padding: 1.5rem;">Running aggregation pipeline...</td></tr>';

  try {
    const res = await fetch('/api/reports/popular-routes', { headers: getAuthHeaders() });
    if (res.status === 401) {
      window.location.href = '/admin-login.html?error=unauthorized';
      return;
    }
    const json = await res.json();

    if (!json.success || !json.data) {
      tbody.innerHTML = `<tr><td colspan="4" style="color: var(--danger); text-align: center;">Error: ${json.message}</td></tr>`;
      return;
    }

    const routes = json.data;
    if (routes.length === 0) {
      tbody.innerHTML = '<tr><td colspan="4" style="text-align: center;">No route booking data.</td></tr>';
      return;
    }

    tbody.innerHTML = routes.slice(0, 10).map((r, i) => `
      <tr>
        <td><strong>#${i + 1}</strong></td>
        <td><strong>${r.route}</strong></td>
        <td><span class="badge-tag" style="background: #e0f2fe; color: #0369a1;">${r.number_of_bookings} bookings</span></td>
        <td>${r.total_passengers} passengers</td>
      </tr>
    `).join('');
  } catch (err) {
    tbody.innerHTML = '<tr><td colspan="4" style="color: var(--danger); text-align: center;">Failed to load popular routes report.</td></tr>';
  }
}

/**
 * Report 1: Bookings per Flight
 */
async function loadBookingsPerFlightReport() {
  const tbody = document.getElementById('reportBookingsPerFlightBody');
  tbody.innerHTML = '<tr><td colspan="4" style="text-align: center; padding: 1.5rem;">Running aggregation pipeline...</td></tr>';

  try {
    const res = await fetch('/api/reports/bookings-per-flight', { headers: getAuthHeaders() });
    if (res.status === 401) {
      window.location.href = '/admin-login.html?error=unauthorized';
      return;
    }
    const json = await res.json();

    if (!json.success || !json.data) {
      tbody.innerHTML = `<tr><td colspan="4" style="color: var(--danger); text-align: center;">Error: ${json.message}</td></tr>`;
      return;
    }

    const flights = json.data;
    if (flights.length === 0) {
      tbody.innerHTML = '<tr><td colspan="4" style="text-align: center;">No flight bookings found.</td></tr>';
      return;
    }

    tbody.innerHTML = flights.slice(0, 10).map(f => `
      <tr>
        <td><strong style="color: var(--primary);">${f.flight_number}</strong></td>
        <td>${f.airline}</td>
        <td><small>${f.route}</small></td>
        <td><strong>${f.total_bookings}</strong></td>
      </tr>
    `).join('');
  } catch (err) {
    tbody.innerHTML = '<tr><td colspan="4" style="color: var(--danger); text-align: center;">Failed to load bookings per flight.</td></tr>';
  }
}

/**
 * Report 4: Revenue by Flight (Confirmed)
 */
async function loadRevenueReport() {
  const tbody = document.getElementById('reportRevenueBody');
  tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 1.5rem;">Running aggregation pipeline...</td></tr>';

  try {
    const res = await fetch('/api/reports/revenue', { headers: getAuthHeaders() });
    if (res.status === 401) {
      window.location.href = '/admin-login.html?error=unauthorized';
      return;
    }
    const json = await res.json();

    if (!json.success || !json.data) {
      tbody.innerHTML = `<tr><td colspan="6" style="color: var(--danger); text-align: center;">Error: ${json.message}</td></tr>`;
      return;
    }

    const revenues = json.data;
    if (revenues.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6" style="text-align: center;">No confirmed revenue records found.</td></tr>';
      return;
    }

    tbody.innerHTML = revenues.slice(0, 15).map(r => `
      <tr>
        <td><strong style="color: var(--primary);">${r.flight_number}</strong></td>
        <td>${r.airline}</td>
        <td><small>${r.route}</small></td>
        <td>${r.confirmed_bookings}</td>
        <td>${r.confirmed_seats}</td>
        <td><strong style="color: var(--success); font-size: 1.05rem;">${formatCurrency(r.total_revenue)}</strong></td>
      </tr>
    `).join('');
  } catch (err) {
    tbody.innerHTML = '<tr><td colspan="6" style="color: var(--danger); text-align: center;">Failed to load revenue report.</td></tr>';
  }
}

/**
 * Live Query Performance Benchmark using MongoDB explain("executionStats")
 */
async function runLivePerformanceBenchmark() {
  const btn = document.getElementById('runBenchmarkBtn');
  const container = document.getElementById('benchmarkContainer');
  const tbody = document.getElementById('benchmarkTableBody');
  const notesDiv = document.getElementById('benchmarkNotes');

  btn.disabled = true;
  btn.textContent = 'Running explain("executionStats")...';

  try {
    const res = await fetch('/api/performance', { headers: getAuthHeaders() });
    if (res.status === 401) {
      window.location.href = '/admin-login.html?error=unauthorized';
      return;
    }
    const json = await res.json();

    if (!json.success || !json.data) {
      showAlert(json.message || 'Benchmark execution failed.', 'danger', 'reportAlertArea');
      return;
    }

    const data = json.data;
    container.style.display = 'block';

    tbody.innerHTML = `
      <tr>
        <td><strong>Execution Stage</strong></td>
        <td><span class="badge-tag" style="background: #fdeced; color: #b71c1c;">${data.beforeIndex.stage}</span></td>
        <td><span class="badge-tag" style="background: #e8f5f3; color: #1b635b;">${data.afterIndex.stage}</span></td>
        <td>Transformed to B-Tree Index Scan</td>
      </tr>
      <tr>
        <td><strong>Total Documents Examined</strong></td>
        <td><strong style="color: var(--danger);">${data.beforeIndex.totalDocsExamined}</strong> docs (Entire Collection)</td>
        <td><strong style="color: var(--success);">${data.afterIndex.totalDocsExamined}</strong> docs (Only Matching)</td>
        <td><strong style="color: var(--success);">${data.reductionPercentage} reduction</strong></td>
      </tr>
      <tr>
        <td><strong>Total Keys Examined</strong></td>
        <td>${data.beforeIndex.totalKeysExamined}</td>
        <td><strong>${data.afterIndex.totalKeysExamined}</strong></td>
        <td>Exact B-Tree keys traversed</td>
      </tr>
      <tr>
        <td><strong>Execution Time</strong></td>
        <td>${data.beforeIndex.executionTimeMillis} ms</td>
        <td>${data.afterIndex.executionTimeMillis} ms</td>
        <td>O(N) &rarr; O(log N) complexity</td>
      </tr>
      <tr>
        <td><strong>Documents Returned</strong></td>
        <td>${data.beforeIndex.nReturned}</td>
        <td>${data.afterIndex.nReturned}</td>
        <td>Identical query results preserved</td>
      </tr>
    `;

    notesDiv.innerHTML = `
      <strong>Academic Database Analysis:</strong><br>
      ${data.academicNotes.map(n => `&bull; ${n}`).join('<br>')}
    `;

    showAlert('Query performance analysis completed successfully!', 'success', 'reportAlertArea');
  } catch (err) {
    showAlert('Error executing explain plan benchmark.', 'danger', 'reportAlertArea');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Re-Run Real Explain Benchmark';
  }
}
