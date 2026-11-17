/**
 * Bookings List & Cancellation Management Controller
 */

let selectedBookingForCancel = null;

document.addEventListener('DOMContentLoaded', () => {
  const searchForm = document.getElementById('bookingSearchForm');
  const refreshBtn = document.getElementById('refreshBtn');
  const confirmCancelBtn = document.getElementById('confirmCancelBtn');

  fetchBookings();

  searchForm.addEventListener('submit', (e) => {
    e.preventDefault();
    fetchBookings();
  });

  refreshBtn.addEventListener('click', () => {
    fetchBookings();
  });

  confirmCancelBtn.addEventListener('click', handleExecuteCancel);
});

async function fetchBookings() {
  const tbody = document.getElementById('bookingsTableBody');
  const ref = document.getElementById('search_reference')?.value.trim() || '';
  const email = document.getElementById('search_email')?.value.trim() || '';
  const status = document.getElementById('filter_status')?.value || 'All';

  tbody.innerHTML = '<tr><td colspan="8" style="text-align: center; padding: 2rem;">Loading bookings...</td></tr>';

  const params = new URLSearchParams();
  if (ref) params.append('reference', ref);
  if (email) params.append('email', email);
  if (status && status !== 'All') params.append('status', status);

  try {
    const res = await fetch(`/api/bookings?${params.toString()}`);
    const json = await res.json();

    if (!json.success || !json.data) {
      tbody.innerHTML = `<tr><td colspan="8" class="text-center" style="color: var(--danger); padding: 1.5rem;">Error loading bookings: ${json.message}</td></tr>`;
      return;
    }

    const bookings = json.data;

    if (bookings.length === 0) {
      tbody.innerHTML = `<tr><td colspan="8" style="text-align: center; padding: 2.5rem; color: var(--text-muted);">No bookings found matching criteria.</td></tr>`;
      return;
    }

    tbody.innerHTML = bookings.map(b => {
      const passengerName = b.passenger?.name || 'Unknown';
      const passengerEmail = b.passenger?.email || '-';
      const flightNum = b.flight?.flight_number || 'N/A';
      const airline = b.flight?.airline || '';
      const route = b.flight ? `${b.flight.departure_city} &rarr; ${b.flight.destination_city}` : '-';
      const statusClass = `status-${b.status.toLowerCase()}`;
      const isConfirmed = b.status === 'Confirmed';

      return `
        <tr>
          <td><strong style="color: var(--primary);">${b.booking_reference}</strong></td>
          <td>
            <div>${passengerName}</div>
            <small style="color: var(--text-muted);">${passengerEmail}</small>
          </td>
          <td>
            <div><strong>${flightNum}</strong> <span style="font-size: 0.8rem; color: var(--text-muted);">(${airline})</span></div>
            <small style="color: var(--text-muted);">${route}</small>
          </td>
          <td><strong>${b.number_of_seats}</strong></td>
          <td><strong>${formatCurrency(b.total_amount)}</strong></td>
          <td><small>${new Date(b.booking_date).toLocaleDateString()}</small></td>
          <td><span class="status-badge ${statusClass}">${b.status}</span></td>
          <td>
            ${
              isConfirmed
                ? `<button class="btn btn-danger btn-sm" onclick="openCancelModal('${b._id}', '${b.booking_reference}')">Cancel</button>`
                : `<span style="font-size: 0.8rem; color: var(--text-muted);">Cancelled</span>`
            }
          </td>
        </tr>
      `;
    }).join('');

  } catch (err) {
    console.error('Error fetching bookings:', err);
    tbody.innerHTML = `<tr><td colspan="8" style="text-align: center; color: var(--danger); padding: 2rem;">Failed to connect to bookings API.</td></tr>`;
  }
}

function openCancelModal(bookingId, bookingRef) {
  selectedBookingForCancel = bookingId;
  document.getElementById('modalBookingRef').textContent = bookingRef;
  document.getElementById('cancelModal').classList.add('open');
}

function closeCancelModal() {
  selectedBookingForCancel = null;
  document.getElementById('cancelModal').classList.remove('open');
}

async function handleExecuteCancel() {
  if (!selectedBookingForCancel) return;

  const btn = document.getElementById('confirmCancelBtn');
  btn.disabled = true;
  btn.textContent = 'Processing...';

  try {
    const res = await fetch(`/api/bookings/${selectedBookingForCancel}/cancel`, {
      method: 'POST'
    });
    const result = await res.json();

    if (!result.success) {
      showAlert(result.message || 'Failed to cancel booking.', 'danger', 'bookingListAlert');
      return;
    }

    showAlert(result.message, 'success', 'bookingListAlert');
    closeCancelModal();
    fetchBookings(); // Reload updated table
  } catch (err) {
    console.error('Error during cancellation:', err);
    showAlert('Network error while processing cancellation.', 'danger', 'bookingListAlert');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Confirm Cancellation';
  }
}
