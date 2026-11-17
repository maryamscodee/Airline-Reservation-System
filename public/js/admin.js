/**
 * Administrator Panel Controller
 * Handles administrative CRUD on flights and bookings
 */

let allAdminFlights = [];

function getAuthHeaders(customHeaders = {}) {
  const token = localStorage.getItem('admin_token');
  const headers = { ...customHeaders };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

document.addEventListener('DOMContentLoaded', async () => {
  // Check auth before loading
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

  loadAdminStats();
  fetchAdminFlights();
});

async function handleAdminLogout() {
  try {
    await fetch('/api/auth/logout', { method: 'POST', headers: getAuthHeaders() });
  } catch (e) {}
  localStorage.removeItem('admin_token');
  window.location.href = '/admin-login.html';
}

async function loadAdminStats() {
  try {
    const res = await fetch('/api/admin/stats', { headers: getAuthHeaders() });
    if (res.status === 401) {
      window.location.href = '/admin-login.html?error=unauthorized';
      return;
    }
    const json = await res.json();
    if (json.success && json.data) {
      const stats = json.data;
      document.getElementById('metricFlights').textContent = stats.flightsCount;
      document.getElementById('metricBookings').textContent = `${stats.confirmedCount} / ${stats.bookingsCount}`;
      document.getElementById('metricRevenue').textContent = formatCurrency(stats.totalRevenue);
      document.getElementById('metricTxMode').textContent = stats.replicaSetEnabled ? 'Replica Set (ACID)' : 'Standalone (Guarded)';
    }
  } catch (err) {
    console.error('Failed to load admin stats:', err);
  }
}

function switchAdminTab(tab) {
  const flightsTab = document.getElementById('sectionFlights');
  const bookingsTab = document.getElementById('sectionBookings');
  const tabFlightsBtn = document.getElementById('tabFlightsBtn');
  const tabBookingsBtn = document.getElementById('tabBookingsBtn');

  if (tab === 'flights') {
    flightsTab.style.display = 'block';
    bookingsTab.style.display = 'none';
    tabFlightsBtn.className = 'btn btn-primary';
    tabBookingsBtn.className = 'btn btn-outline';
    fetchAdminFlights();
  } else {
    flightsTab.style.display = 'none';
    bookingsTab.style.display = 'block';
    tabFlightsBtn.className = 'btn btn-outline';
    tabBookingsBtn.className = 'btn btn-primary';
    fetchAdminBookings();
  }
}

async function fetchAdminFlights() {
  const tbody = document.getElementById('adminFlightsTableBody');
  tbody.innerHTML = '<tr><td colspan="8" style="text-align: center; padding: 2rem;">Loading flights from MongoDB...</td></tr>';

  try {
    const res = await fetch('/api/flights?sort_by=departure_time&order=desc', { headers: getAuthHeaders() });
    const json = await res.json();

    if (!json.success || !json.data) {
      tbody.innerHTML = `<tr><td colspan="8" style="color: var(--danger); text-align: center;">Error loading flights: ${json.message}</td></tr>`;
      return;
    }

    allAdminFlights = json.data;
    if (allAdminFlights.length === 0) {
      tbody.innerHTML = `<tr><td colspan="8" style="text-align: center; padding: 2rem;">No flights found in database.</td></tr>`;
      return;
    }

    tbody.innerHTML = allAdminFlights.map(f => {
      const statusClass = `status-${f.status.toLowerCase()}`;
      return `
        <tr>
          <td><strong style="color: var(--primary);">${f.flight_number}</strong></td>
          <td>${f.airline}</td>
          <td>${f.departure_city} &rarr; ${f.destination_city}</td>
          <td><small>${f.departure_time}<br>${f.arrival_time}</small></td>
          <td><strong>${formatCurrency(f.ticket_price)}</strong></td>
          <td>${f.available_seats} / ${f.total_seats}</td>
          <td><span class="status-badge ${statusClass}">${f.status}</span></td>
          <td>
            <div style="display: flex; gap: 0.4rem;">
              <button class="btn btn-outline btn-sm" onclick="openEditFlightModal('${f._id}')">Edit</button>
              <button class="btn btn-danger btn-sm" onclick="handleDeleteFlight('${f._id}', '${f.flight_number}')">Delete</button>
            </div>
          </td>
        </tr>
      `;
    }).join('');

  } catch (err) {
    console.error('Error fetching admin flights:', err);
    tbody.innerHTML = '<tr><td colspan="8" style="color: var(--danger); text-align: center;">Failed to connect to API.</td></tr>';
  }
}

async function fetchAdminBookings() {
  const tbody = document.getElementById('adminBookingsTableBody');
  const statusFilter = document.getElementById('adminBookingFilterStatus')?.value || 'All';
  tbody.innerHTML = '<tr><td colspan="9" style="text-align: center; padding: 2rem;">Loading bookings...</td></tr>';

  const params = new URLSearchParams();
  if (statusFilter !== 'All') params.append('status', statusFilter);

  try {
    const res = await fetch(`/api/bookings?${params.toString()}`, { headers: getAuthHeaders() });
    const json = await res.json();

    if (!json.success || !json.data) {
      tbody.innerHTML = `<tr><td colspan="9" style="color: var(--danger); text-align: center;">Error: ${json.message}</td></tr>`;
      return;
    }

    const bookings = json.data;
    if (bookings.length === 0) {
      tbody.innerHTML = '<tr><td colspan="9" style="text-align: center; padding: 2rem;">No bookings found.</td></tr>';
      return;
    }

    tbody.innerHTML = bookings.map(b => {
      const passenger = b.passenger ? `${b.passenger.name} (${b.passenger.email})` : 'N/A';
      const flightNum = b.flight ? b.flight.flight_number : 'N/A';
      const route = b.flight ? `${b.flight.departure_city} &rarr; ${b.flight.destination_city}` : '-';
      const statusClass = `status-${b.status.toLowerCase()}`;

      return `
        <tr>
          <td><strong style="color: var(--primary);">${b.booking_reference}</strong></td>
          <td>${passenger}</td>
          <td><strong>${flightNum}</strong></td>
          <td><small>${route}</small></td>
          <td>${b.number_of_seats}</td>
          <td><strong>${formatCurrency(b.total_amount)}</strong></td>
          <td><small>${new Date(b.booking_date).toLocaleDateString()}</small></td>
          <td><span class="status-badge ${statusClass}">${b.status}</span></td>
          <td>
            ${
              b.status === 'Confirmed'
                ? `<button class="btn btn-danger btn-sm" onclick="handleAdminCancelBooking('${b._id}', '${b.booking_reference}')">Cancel</button>`
                : `<span style="font-size: 0.8rem; color: var(--text-muted);">Cancelled</span>`
            }
          </td>
        </tr>
      `;
    }).join('');

  } catch (err) {
    console.error('Error fetching admin bookings:', err);
    tbody.innerHTML = '<tr><td colspan="9" style="color: var(--danger); text-align: center;">Failed to connect to API.</td></tr>';
  }
}

// Add Flight Modal Functions
function openAddFlightModal() {
  document.getElementById('addFlightForm').reset();
  document.getElementById('addFlightModal').classList.add('open');
}

function closeAddFlightModal() {
  document.getElementById('addFlightModal').classList.remove('open');
}

async function handleCreateFlight(e) {
  e.preventDefault();

  const flightData = {
    flight_number: document.getElementById('new_flight_number').value.trim(),
    airline: document.getElementById('new_airline').value.trim(),
    departure_city: document.getElementById('new_departure_city').value.trim(),
    destination_city: document.getElementById('new_destination_city').value.trim(),
    departure_time: document.getElementById('new_departure_time').value.trim(),
    arrival_time: document.getElementById('new_arrival_time').value.trim(),
    ticket_price: Number(document.getElementById('new_ticket_price').value),
    total_seats: Number(document.getElementById('new_total_seats').value),
    status: document.getElementById('new_status').value
  };

  try {
    const res = await fetch('/api/flights', {
      method: 'POST',
      headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(flightData)
    });
    const result = await res.json();

    if (!result.success) {
      showAlert(result.message || 'Failed to create flight.', 'danger', 'adminAlertArea');
      return;
    }

    showAlert(`Flight ${result.data.flight_number} created successfully!`, 'success', 'adminAlertArea');
    closeAddFlightModal();
    fetchAdminFlights();
    loadAdminStats();
  } catch (err) {
    showAlert('Network error while creating flight.', 'danger', 'adminAlertArea');
  }
}

// Edit Flight Modal Functions
function openEditFlightModal(flightId) {
  const flight = allAdminFlights.find(f => f._id === flightId);
  if (!flight) return;

  document.getElementById('edit_flight_id').value = flight._id;
  document.getElementById('edit_flight_number').value = flight.flight_number;
  document.getElementById('edit_status').value = flight.status;
  document.getElementById('edit_ticket_price').value = flight.ticket_price;
  document.getElementById('edit_total_seats').value = flight.total_seats;

  document.getElementById('editFlightModal').classList.add('open');
}

function closeEditFlightModal() {
  document.getElementById('editFlightModal').classList.remove('open');
}

async function handleUpdateFlight(e) {
  e.preventDefault();
  const id = document.getElementById('edit_flight_id').value;

  const updateData = {
    status: document.getElementById('edit_status').value,
    ticket_price: Number(document.getElementById('edit_ticket_price').value),
    total_seats: Number(document.getElementById('edit_total_seats').value)
  };

  try {
    const res = await fetch(`/api/flights/${id}`, {
      method: 'PUT',
      headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(updateData)
    });
    const result = await res.json();

    if (!result.success) {
      showAlert(result.message || 'Failed to update flight.', 'danger', 'adminAlertArea');
      return;
    }

    showAlert('Flight updated successfully!', 'success', 'adminAlertArea');
    closeEditFlightModal();
    fetchAdminFlights();
  } catch (err) {
    showAlert('Network error while updating flight.', 'danger', 'adminAlertArea');
  }
}

async function handleDeleteFlight(id, flightNumber) {
  if (!confirm(`Are you sure you want to delete flight ${flightNumber}? This will be blocked if active bookings exist.`)) {
    return;
  }

  try {
    const res = await fetch(`/api/flights/${id}`, {
      method: 'DELETE',
      headers: getAuthHeaders()
    });
    const result = await res.json();

    if (!result.success) {
      showAlert(result.message || 'Failed to delete flight.', 'danger', 'adminAlertArea');
      return;
    }

    showAlert(result.message, 'success', 'adminAlertArea');
    fetchAdminFlights();
    loadAdminStats();
  } catch (err) {
    showAlert('Network error while deleting flight.', 'danger', 'adminAlertArea');
  }
}

async function handleAdminCancelBooking(bookingId, ref) {
  if (!confirm(`Cancel booking ${ref} and return seats to flight inventory?`)) return;

  try {
    const res = await fetch(`/api/bookings/${bookingId}/cancel`, {
      method: 'POST',
      headers: getAuthHeaders()
    });
    const result = await res.json();

    if (!result.success) {
      showAlert(result.message, 'danger', 'adminAlertArea');
      return;
    }

    showAlert(`Booking ${ref} cancelled and seats returned.`, 'success', 'adminAlertArea');
    fetchAdminBookings();
    loadAdminStats();
  } catch (err) {
    showAlert('Error cancelling booking.', 'danger', 'adminAlertArea');
  }
}
