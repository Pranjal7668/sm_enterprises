// Constants
const API_BASE = '/api';

// Helper: Get token from localStorage
function getAdminToken() {
  return localStorage.getItem('sme_admin_token');
}

// Helper: Save token to localStorage
function saveAdminToken(token) {
  localStorage.setItem('sme_admin_token', token);
}

// Helper: Clear token
function clearAdminToken() {
  localStorage.removeItem('sme_admin_token');
}

// Helper: Format Currency (INR)
function formatINR(value) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(value);
}

// Initialize Page Logic
document.addEventListener('DOMContentLoaded', () => {
  // Determine page type
  const isHomepage = document.getElementById('public-track-btn') !== null;
  const isDashboard = document.getElementById('login-form') !== null;

  if (isHomepage) {
    initHomepage();
  } else if (isDashboard) {
    initDashboard();
  }
});

// ========================================================
// HOMEPAGE LOGIC
// ========================================================
function initHomepage() {
  // Mobile Nav Toggle
  const menuToggle = document.getElementById('menu-toggle');
  const navLinks = document.getElementById('nav-links');
  if (menuToggle && navLinks) {
    menuToggle.addEventListener('click', () => {
      navLinks.style.display = navLinks.style.display === 'flex' ? 'none' : 'flex';
    });

    // Close mobile nav when clicking a link or button
    const navItems = navLinks.querySelectorAll('a, button');
    navItems.forEach(item => {
      item.addEventListener('click', () => {
        if (window.innerWidth <= 768) {
          navLinks.style.display = 'none';
        }
      });
    });
  }

  // Public Tracking
  const trackBtn = document.getElementById('public-track-btn');
  const trackInput = document.getElementById('public-track-input');
  const resultCard = document.getElementById('tracking-result-card');
  const closeTrackBtn = document.getElementById('tracking-close-btn');

  if (trackBtn && trackInput) {
    const handleTrack = () => {
      const awb = trackInput.value.trim();
      if (!awb) {
        alert('Please enter a valid tracking or AWB number.');
        return;
      }

      trackBtn.disabled = true;
      trackBtn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Searching...';

      fetch(`${API_BASE}/track/${encodeURIComponent(awb)}`)
        .then(res => res.json())
        .then(data => {
          trackBtn.disabled = false;
          trackBtn.innerHTML = '<i class="fa-solid fa-magnifying-glass"></i> Track Parcel';

          if (data.success && data.shipment) {
            const ship = data.shipment;
            document.getElementById('track-date').textContent = ship.date || '-';
            document.getElementById('track-service').textContent = ship.service || '-';
            document.getElementById('track-awb').textContent = ship.awb || '-';
            document.getElementById('track-destination').textContent = ship.destination || '-';
            
            const statusEl = document.getElementById('track-status');
            statusEl.textContent = ship.status || 'IN TRANSIT';
            statusEl.className = 'status-badge'; // Reset classes
            
            // Map status CSS
            const normStatus = (ship.status || '').toUpperCase();
            if (normStatus === 'DLVD' || normStatus === 'DELIVERED') {
              statusEl.classList.add('badge-dlvd');
            } else if (normStatus === 'PENDING') {
              statusEl.classList.add('badge-pending');
            } else if (normStatus === 'FAILED' || normStatus === 'EXCEPTION') {
              statusEl.classList.add('badge-failed');
            } else if (normStatus === 'OUT FOR DELIVERY') {
              statusEl.classList.add('badge-out');
            } else {
              statusEl.classList.add('badge-transit');
            }

            resultCard.style.display = 'block';
            resultCard.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
          } else {
            alert(data.message || 'No tracking information found.');
            resultCard.style.display = 'none';
          }
        })
        .catch(err => {
          trackBtn.disabled = false;
          trackBtn.innerHTML = '<i class="fa-solid fa-magnifying-glass"></i> Track Parcel';
          console.error(err);
          alert('Failed to connect to tracking server. Please try again.');
        });
    };

    trackBtn.addEventListener('click', handleTrack);
    trackInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') handleTrack();
    });
  }

  if (closeTrackBtn && resultCard) {
    closeTrackBtn.addEventListener('click', () => {
      resultCard.style.display = 'none';
    });
  }

  // Interactive Contact Form
  const contactForm = document.getElementById('contact-form');
  if (contactForm) {
    contactForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const name = document.getElementById('contact-name').value.trim();
      const email = document.getElementById('contact-email').value.trim();
      const subject = document.getElementById('contact-subject').value.trim();
      const message = document.getElementById('contact-message').value.trim();
      
      const submitBtn = contactForm.querySelector('.submit-btn');
      const origHtml = submitBtn.innerHTML;

      try {
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Sending message...';

        const response = await fetch('/api/contact', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, email, subject, message })
        });
        const data = await response.json();
        
        if (data.success) {
          alert('Thank you! Your message has been sent successfully through the website. We will get back to you shortly.');
          contactForm.reset();
        } else {
          throw new Error(data.message || 'Server error');
        }
      } catch (err) {
        console.warn('API submission failed, falling back to mail client:', err);
        // Fallback to mailto link
        const emailBody = `Name: ${name}%0DEmail: ${email}%0D%0DMessage:%0D${message}`;
        const mailtoUrl = `mailto:smenterprisesagra5@gmail.com?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(emailBody)}`;
        alert('Enquiry submission offline. Opening your local mail app to send the message.');
        window.location.href = mailtoUrl;
        contactForm.reset();
      } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = origHtml;
      }
    });
  }
}

// ========================================================
// ADMIN DASHBOARD LOGIC
// ========================================================
function initDashboard() {
  const loginContainer = document.getElementById('login-container');
  const dashboardContainer = document.getElementById('dashboard-container');
  const loginForm = document.getElementById('login-form');
  const loginError = document.getElementById('login-error');
  const logoutBtn = document.getElementById('logout-btn');

  // Check login state
  const token = getAdminToken();
  if (token) {
    loginContainer.style.display = 'none';
    dashboardContainer.style.display = 'block';
    setupDashboardApp(token);
  } else {
    loginContainer.style.display = 'flex';
    dashboardContainer.style.display = 'none';
  }

  // Handle Login Form Submit
  if (loginForm) {
    loginForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const password = document.getElementById('admin-password').value;

      loginError.style.display = 'none';

      fetch(`${API_BASE}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password })
      })
        .then(res => res.json())
        .then(data => {
          if (data.success && data.token) {
            saveAdminToken(data.token);
            window.location.reload();
          } else {
            loginError.textContent = data.message || 'Invalid password.';
            loginError.style.display = 'block';
          }
        })
        .catch(err => {
          console.error(err);
          loginError.textContent = 'Server error occurred during login.';
          loginError.style.display = 'block';
        });
    });
  }

  // Handle Logout
  if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
      clearAdminToken();
      window.location.reload();
    });
  }
}

function setupDashboardApp(token) {
  let currentPage = 1;
  let totalPages = 1;
  
  // Dashboard Elements
  const statsFetchHeaders = { 'Authorization': `Bearer ${token}` };
  const shipmentsTableBody = document.getElementById('shipments-table-body');
  const shipmentForm = document.getElementById('shipment-form');
  const shipmentIdInput = document.getElementById('shipment-id-input');
  
  const buyingInput = document.getElementById('shipment-buying');
  const saleInput = document.getElementById('shipment-sale');
  const profitLabel = document.getElementById('label-calculated-profit');
  const formTitle = document.getElementById('form-title');
  const formCancelBtn = document.getElementById('form-cancel-btn');
  
  // Expand/Collapse Shipment Form Card
  const expandFormBtn = document.getElementById('expand-form-btn');
  const shipmentFormCard = document.getElementById('shipment-form-card');
  
  const collapseForm = () => {
    if (shipmentFormCard && shipmentFormCard.classList.contains('expanded')) {
      shipmentFormCard.classList.remove('expanded');
      document.body.classList.remove('form-expanded-open');
      if (expandFormBtn) {
        expandFormBtn.innerHTML = '<i class="fa-solid fa-expand"></i> <span id="expand-btn-text">Expand Form</span>';
        expandFormBtn.title = 'Expand view';
      }
    }
  };

  if (expandFormBtn && shipmentFormCard) {
    expandFormBtn.addEventListener('click', (e) => {
      e.stopPropagation(); // Stop event propagation to prevent document listener from triggering an immediate collapse
      const isExpanded = shipmentFormCard.classList.toggle('expanded');
      document.body.classList.toggle('form-expanded-open', isExpanded);
      
      if (isExpanded) {
        expandFormBtn.innerHTML = '<i class="fa-solid fa-compress"></i> <span id="expand-btn-text">Minimize Form</span>';
        expandFormBtn.title = 'Collapse view';
      } else {
        expandFormBtn.innerHTML = '<i class="fa-solid fa-expand"></i> <span id="expand-btn-text">Expand Form</span>';
        expandFormBtn.title = 'Expand view';
      }
    });

    // Close when clicking outside of the expanded form card
    document.addEventListener('click', (e) => {
      if (shipmentFormCard.classList.contains('expanded')) {
        // If the clicked element is already detached from the DOM, ignore it to prevent accidental collapses
        if (!document.body.contains(e.target)) return;

        if (!shipmentFormCard.contains(e.target) && !expandFormBtn.contains(e.target)) {
          collapseForm();
        }
      }
    });
  }

  // Filters Elements
  const filterSearch = document.getElementById('filter-search-input');
  const filterService = document.getElementById('filter-service-select');
  const filterStatus = document.getElementById('filter-status-select');

  // Pagination Elements
  const prevBtn = document.getElementById('pagination-prev-btn');
  const nextBtn = document.getElementById('pagination-next-btn');
  const paginationText = document.getElementById('pagination-info-text');

  // Export CSV
  const exportBtn = document.getElementById('export-csv-btn');
  const deleteAllBtn = document.getElementById('delete-all-btn');

  // Modal Invoice
  const invoiceModal = document.getElementById('invoice-modal');
  const invoiceCloseBtn = document.getElementById('invoice-modal-close-btn');
  const invoiceCancelBtn = document.getElementById('invoice-modal-cancel-btn');
  const invoicePrintBtn = document.getElementById('invoice-print-btn');
  const invoiceExcelBtn = document.getElementById('invoice-excel-btn');
  let currentInvoiceShipment = null;

  // Messages Elements & Handlers
  const refreshMessagesBtn = document.getElementById('refresh-messages-btn');
  const messagesTableBody = document.getElementById('messages-table-body');

  const escapeHTML = (str) => {
    if (!str) return '';
    return str.replace(/&/g, '&amp;')
              .replace(/</g, '&lt;')
              .replace(/>/g, '&gt;')
              .replace(/"/g, '&quot;')
              .replace(/'/g, '&#039;');
  };

  const loadMessages = async () => {
    if (!messagesTableBody) return;
    try {
      const res = await fetch(`${API_BASE}/messages`, {
        headers: statsFetchHeaders
      });
      const data = await res.json();
      if (data.success && data.messages) {
        const list = data.messages;
        if (list.length === 0) {
          messagesTableBody.innerHTML = `
            <tr>
              <td colspan="7" style="text-align: center; color: var(--text-muted); padding: 24px;">No customer enquiries found.</td>
            </tr>
          `;
          return;
        }

        messagesTableBody.innerHTML = list.map((msg, idx) => `
          <tr>
            <td>${idx + 1}</td>
            <td>${msg.date || '-'}</td>
            <td style="font-weight: 600;">${escapeHTML(msg.name)}</td>
            <td><a href="mailto:${escapeHTML(msg.email)}" style="color: var(--primary); text-decoration: underline;">${escapeHTML(msg.email)}</a></td>
            <td style="font-weight: 500; color: var(--primary-dark);">${escapeHTML(msg.subject)}</td>
            <td style="font-size: 12px; color: var(--text-muted); white-space: pre-wrap; max-width: 300px;">${escapeHTML(msg.message)}</td>
            <td style="text-align: right;">
              <button onclick="deleteMessage(${msg.id})" class="action-btn text-danger" title="Delete Message" style="border: none; background: transparent; cursor: pointer; color: #ef4444; font-size: 14px;">
                <i class="fa-solid fa-trash-can"></i>
              </button>
            </td>
          </tr>
        `).join('');
      }
    } catch (err) {
      console.error('Error loading enquiries:', err);
    }
  };

  window.deleteMessage = async (id) => {
    if (!confirm('Are you sure you want to delete this enquiry message?')) return;
    try {
      const res = await fetch(`${API_BASE}/messages/${id}`, {
        method: 'DELETE',
        headers: statsFetchHeaders
      });
      const data = await res.json();
      if (data.success) {
        loadMessages();
      } else {
        alert(data.message || 'Failed to delete message.');
      }
    } catch (err) {
      console.error('Error deleting message:', err);
      alert('Network error while deleting.');
    }
  };

  if (refreshMessagesBtn) {
    refreshMessagesBtn.addEventListener('click', loadMessages);
  }

  // Default Today's Date for Shipment Form
  const setTodayDate = () => {
    const today = new Date();
    const dd = String(today.getDate()).padStart(2, '0');
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const yy = String(today.getFullYear()).substr(-2);
    document.getElementById('shipment-date').value = `${dd}.${mm}.${yy}`;
  };
  setTodayDate();

  // Load Dashboard Data
  const loadStats = () => {
    fetch(`${API_BASE}/stats`, { headers: statsFetchHeaders })
      .then(res => {
        if (res.status === 401) { clearAdminToken(); window.location.reload(); }
        return res.json();
      })
      .then(data => {
        if (data.success && data.stats) {
          const s = data.stats;
          document.getElementById('metric-total-shipments').textContent = s.totalShipments;
          document.getElementById('metric-active-shipments').textContent = s.activeShipments;
          document.getElementById('metric-total-sales').textContent = formatINR(s.totalSales);
          document.getElementById('metric-total-profit').textContent = formatINR(s.totalProfit);
        }
      })
      .catch(err => console.error('Error fetching stats:', err));
  };

  const loadShipments = (page = 1) => {
    currentPage = page;
    const search = filterSearch.value;
    const service = filterService.value;
    const status = filterStatus.value;

    const url = `${API_BASE}/shipments?page=${page}&limit=10&search=${encodeURIComponent(search)}&service=${encodeURIComponent(service)}&status=${encodeURIComponent(status)}`;
    
    shipmentsTableBody.innerHTML = '<tr><td colspan="10" style="text-align:center; padding: 24px;"><i class="fa-solid fa-spinner fa-spin"></i> Loading records...</td></tr>';

    fetch(url, { headers: statsFetchHeaders })
      .then(res => {
        if (res.status === 401) { clearAdminToken(); window.location.reload(); }
        return res.json();
      })
      .then(data => {
        if (data.success && data.shipments) {
          shipmentsTableBody.innerHTML = '';
          const rows = data.shipments;

          if (rows.length === 0) {
            shipmentsTableBody.innerHTML = '<tr><td colspan="10" style="text-align:center; padding: 24px; color: var(--text-muted);">No matching shipment records found.</td></tr>';
          }

          rows.forEach(r => {
            const tr = document.createElement('tr');
            
            // Map status badges
            let badgeClass = 'badge-pending';
            const s = (r.status || '').toUpperCase();
            if (s === 'DLVD' || s === 'DELIVERED') badgeClass = 'badge-dlvd';
            else if (s === 'IN TRANSIT') badgeClass = 'badge-transit';
            else if (s === 'OUT FOR DELIVERY') badgeClass = 'badge-out';
            else if (s === 'FAILED') badgeClass = 'badge-failed';

            tr.innerHTML = `
              <td>${r.date || '-'}</td>
              <td>
                <div style="font-weight:600;">${r.jbn_awb || '-'}</div>
                <div style="font-size:11px; color:var(--text-muted); font-family:monospace;">${r.awb}</div>
              </td>
              <td>${r.shipper || '-'}</td>
              <td>${r.consignee || '-'}</td>
              <td><strong>${r.service || '-'}</strong></td>
              <td>${r.destination || '-'}</td>
              <td>${r.sale ? formatINR(r.sale) : '₹0'}</td>
              <td style="color:${r.profit >= 0 ? '#15803d' : '#b91c1c'}; font-weight:600;">
                ${r.profit ? formatINR(r.profit) : '₹0'}
              </td>
              <td><span class="status-badge ${badgeClass}">${r.status}</span></td>
              <td style="text-align:right; white-space:nowrap;">
                <button class="action-icon-btn btn-invoice" title="Generate Bill" data-id="${r.id}"><i class="fa-solid fa-file-invoice-dollar"></i></button>
                <button class="action-icon-btn btn-excel" title="Download Excel Invoice" data-id="${r.id}"><i class="fa-solid fa-file-excel" style="color:#10b981;"></i></button>
                <button class="action-icon-btn btn-edit" title="Edit Shipment" data-id="${r.id}"><i class="fa-solid fa-pen-to-square"></i></button>
                <button class="action-icon-btn btn-delete" title="Delete Record" data-id="${r.id}"><i class="fa-solid fa-trash"></i></button>
              </td>
            `;
            shipmentsTableBody.appendChild(tr);
          });

          // Update Pagination variables
          const pag = data.pagination;
          totalPages = pag.totalPages || 1;
          const from = (currentPage - 1) * pag.limit + 1;
          const to = Math.min(currentPage * pag.limit, pag.totalCount);
          paginationText.textContent = pag.totalCount > 0 
            ? `Showing ${from}-${to} of ${pag.totalCount} shipments`
            : `Showing 0-0 of 0 shipments`;

          prevBtn.disabled = currentPage === 1;
          nextBtn.disabled = currentPage >= totalPages;

          // Attach Action Listeners
          attachTableActionListeners(rows);
        }
      })
      .catch(err => {
        console.error('Error fetching shipments:', err);
        shipmentsTableBody.innerHTML = '<tr><td colspan="10" style="text-align:center; padding: 24px; color:#ef4444;"><i class="fa-solid fa-triangle-exclamation"></i> Error loading records.</td></tr>';
      });
  };

  const attachTableActionListeners = (rows) => {
    // Edit Action
    const editBtns = document.querySelectorAll('.btn-edit');
    editBtns.forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = parseInt(btn.getAttribute('data-id'));
        const row = rows.find(r => r.id === id);
        if (row) {
          // Load form values
          shipmentIdInput.value = row.id;
          document.getElementById('shipment-date').value = row.date || '';
          document.getElementById('shipment-jbn').value = row.jbn_awb || '';
          document.getElementById('shipment-awb').value = row.awb || '';
          document.getElementById('shipment-shipper').value = row.shipper || '';
          document.getElementById('shipment-consignee').value = row.consignee || '';
          document.getElementById('shipment-pcs').value = row.pcs || 1;
          document.getElementById('shipment-weight').value = row.weight || 0;
          document.getElementById('shipment-destination').value = row.destination || '';
          document.getElementById('shipment-service').value = row.service || 'UPS';
          document.getElementById('shipment-paid-by').value = row.paid_by || '';
          document.getElementById('shipment-vendor').value = row.vendor || '';
          buyingInput.value = row.buying || 0;
          saleInput.value = row.sale || 0;
          document.getElementById('shipment-status').value = row.status || 'PENDING';
          
          calculateProfit();
          
          formTitle.textContent = `Edit Shipment (ID: ${row.id})`;
          formCancelBtn.style.display = 'block';
          
          // Scroll form into view
          document.querySelector('.form-card').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
      });
    });

    // Delete Action
    const deleteBtns = document.querySelectorAll('.btn-delete');
    deleteBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-id');
        if (confirm(`Are you sure you want to delete shipment ID ${id}? This action cannot be undone.`)) {
          fetch(`${API_BASE}/shipments/${id}`, {
            method: 'DELETE',
            headers: statsFetchHeaders
          })
            .then(res => res.json())
            .then(data => {
              if (data.success) {
                loadStats();
                loadShipments(currentPage);
              } else {
                alert(data.message || 'Failed to delete record.');
              }
            })
            .catch(err => console.error(err));
        }
      });
    });

    // Invoice Action
    const invoiceBtns = document.querySelectorAll('.btn-invoice');
    invoiceBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const id = parseInt(btn.getAttribute('data-id'));
        const row = rows.find(r => r.id === id);
        if (row) {
          openInvoiceModal(row);
        }
      });
    });

    // Excel Invoice Action from Table Row
    const excelInvoiceBtns = document.querySelectorAll('.btn-excel');
    excelInvoiceBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const id = parseInt(btn.getAttribute('data-id'));
        const row = rows.find(r => r.id === id);
        if (row) {
          initInvoiceFields(row);
          downloadExcelInvoice(row);
        }
      });
    });
  };

  // Setup Form Cancellations
  formCancelBtn.addEventListener('click', () => {
    shipmentForm.reset();
    shipmentIdInput.value = '';
    formTitle.textContent = 'Register New Shipment';
    formCancelBtn.style.display = 'none';
    setTodayDate();
    calculateProfit();
    collapseForm();
  });

  // Calculate profit on input
  const calculateProfit = () => {
    const buying = parseFloat(buyingInput.value) || 0;
    const sale = parseFloat(saleInput.value) || 0;
    const profit = sale - buying;
    profitLabel.textContent = formatINR(profit);
    profitLabel.style.color = profit >= 0 ? '#15803d' : '#b91c1c';
  };

  buyingInput.addEventListener('input', calculateProfit);
  saleInput.addEventListener('input', calculateProfit);

  // Submit Shipment Form (Create or Update)
  shipmentForm.addEventListener('submit', (e) => {
    e.preventDefault();

    const id = shipmentIdInput.value;
    const isEditing = id !== '';

    const payload = {
      date: document.getElementById('shipment-date').value.trim(),
      jbn_awb: document.getElementById('shipment-jbn').value.trim(),
      awb: document.getElementById('shipment-awb').value.trim(),
      shipper: document.getElementById('shipment-shipper').value.trim(),
      consignee: document.getElementById('shipment-consignee').value.trim(),
      pcs: parseInt(document.getElementById('shipment-pcs').value) || 1,
      weight: parseFloat(document.getElementById('shipment-weight').value) || 0,
      destination: document.getElementById('shipment-destination').value.trim(),
      service: document.getElementById('shipment-service').value,
      paid_by: document.getElementById('shipment-paid-by').value.trim(),
      vendor: document.getElementById('shipment-vendor').value.trim(),
      buying: parseFloat(buyingInput.value) || 0,
      sale: parseFloat(saleInput.value) || 0,
      status: document.getElementById('shipment-status').value
    };

    const method = isEditing ? 'PUT' : 'POST';
    const url = isEditing ? `${API_BASE}/shipments/${id}` : `${API_BASE}/shipments`;

    fetch(url, {
      method: method,
      headers: {
        'Content-Type': 'application/json',
        ...statsFetchHeaders
      },
      body: JSON.stringify(payload)
    })
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          alert(isEditing ? 'Shipment updated successfully!' : 'New shipment registered successfully!');
          shipmentForm.reset();
          shipmentIdInput.value = '';
          formTitle.textContent = 'Register New Shipment';
          formCancelBtn.style.display = 'none';
          setTodayDate();
          calculateProfit();
          collapseForm();
          loadStats();
          loadShipments(isEditing ? currentPage : 1);
        } else {
          alert(data.message || 'Failed to save shipment.');
        }
      })
      .catch(err => {
        console.error(err);
        alert('Server connection error. Failed to save shipment.');
      });
  });

  // Filters Trigger
  let filterTimeout = null;
  const triggerFilters = () => {
    clearTimeout(filterTimeout);
    filterTimeout = setTimeout(() => {
      loadShipments(1);
    }, 300);
  };

  filterSearch.addEventListener('input', triggerFilters);
  filterService.addEventListener('change', () => loadShipments(1));
  filterStatus.addEventListener('change', () => loadShipments(1));

  // Pagination triggers
  prevBtn.addEventListener('click', () => {
    if (currentPage > 1) loadShipments(currentPage - 1);
  });
  nextBtn.addEventListener('click', () => {
    if (currentPage < totalPages) loadShipments(currentPage + 1);
  });

  // Export CSV
  exportBtn.addEventListener('click', () => {
    // Fetch ALL records (we make a query with high limit or special query to get everything matching filters)
    const search = filterSearch.value;
    const service = filterService.value;
    const status = filterStatus.value;
    
    // Request up to 10000 records to fetch everything
    const url = `${API_BASE}/shipments?page=1&limit=10000&search=${encodeURIComponent(search)}&service=${encodeURIComponent(service)}&status=${encodeURIComponent(status)}`;
    
    exportBtn.disabled = true;
    exportBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Exporting...';

    fetch(url, { headers: statsFetchHeaders })
      .then(res => res.json())
      .then(data => {
        exportBtn.disabled = false;
        exportBtn.innerHTML = '<i class="fa-solid fa-file-csv" style="color:#10b981;"></i> Export CSV';

        if (data.success && data.shipments) {
          const list = data.shipments;
          if (list.length === 0) {
            alert('No shipment records to export.');
            return;
          }

          // Generate CSV content
          const headers = ['S.No.', 'Date', 'AWB NO.', 'AWB Tracking NO.', 'Shipper', 'Consignee Name', 'PCS', 'Ch. Weight (KG)', 'Destination', 'Paid By', 'Vendor', 'Service', 'Buying (INR)', 'Sale (INR)', 'Profit (INR)', 'Status'];
          
          let csvContent = '\uFEFF'; // UTF-8 BOM
          csvContent += headers.map(h => `"${h}"`).join(',') + '\r\n';

          list.forEach((r, idx) => {
            const rowData = [
              idx + 1,
              r.date || '',
              r.jbn_awb || '',
              r.awb || '',
              r.shipper || '',
              r.consignee || '',
              r.pcs || 1,
              r.weight || 0,
              r.destination || '',
              r.paid_by || '',
              r.vendor || '',
              r.service || '',
              r.buying || 0,
              r.sale || 0,
              r.profit || 0,
              r.status || ''
            ];
            csvContent += rowData.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',') + '\r\n';
          });

          // Trigger browser download
          const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
          const link = document.createElement('a');
          const dateStr = new Date().toISOString().slice(0, 10);
          
          link.href = URL.createObjectURL(blob);
          link.setAttribute('download', `SM_Enterprises_Shipments_${dateStr}.csv`);
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
        }
      })
      .catch(err => {
        exportBtn.disabled = false;
        exportBtn.innerHTML = '<i class="fa-solid fa-file-csv" style="color:#10b981;"></i> Export CSV';
        console.error(err);
        alert('Failed to export records.');
      });
  });

  // Delete All Action
  if (deleteAllBtn) {
    deleteAllBtn.addEventListener('click', () => {
      const confirmFirst = confirm("⚠️ WARNING: Are you sure you want to delete ALL shipments? This will permanently wipe your entire shipment database!");
      if (!confirmFirst) return;

      const confirmText = prompt("Type 'DELETE ALL' to confirm wiping the database:");
      if (confirmText !== 'DELETE ALL') {
        alert("Verification failed. Delete all action canceled.");
        return;
      }

      deleteAllBtn.disabled = true;
      deleteAllBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Deleting...';

      fetch(`${API_BASE}/shipments`, {
        method: 'DELETE',
        headers: statsFetchHeaders
      })
        .then(res => res.json())
        .then(data => {
          deleteAllBtn.disabled = false;
          deleteAllBtn.innerHTML = '<i class="fa-solid fa-trash-can"></i> Delete All Shipments';
          if (data.success) {
            alert('All shipments have been deleted successfully.');
            loadStats();
            loadShipments(1);
          } else {
            alert(data.message || 'Failed to delete shipments.');
          }
        })
        .catch(err => {
          deleteAllBtn.disabled = false;
          deleteAllBtn.innerHTML = '<i class="fa-solid fa-trash-can"></i> Delete All Shipments';
          console.error(err);
          alert('Server connection error. Failed to delete all shipments.');
        });
    });
  }

  // Helper: Convert number to Indian Rupees words
  const numberToWords = (num) => {
    const a = ['', 'One ', 'Two ', 'Three ', 'Four ', 'Five ', 'Six ', 'Seven ', 'Eight ', 'Nine ', 'Ten ', 'Eleven ', 'Twelve ', 'Thirteen ', 'Fourteen ', 'Fifteen ', 'Sixteen ', 'Seventeen ', 'Eighteen ', 'Nineteen '];
    const b = ['', '', 'Twenty ', 'Thirty ', 'Forty ', 'Fifty ', 'Sixty ', 'Seventy ', 'Eighty ', 'Ninety '];

    const convertThreeDigit = (n) => {
      let word = '';
      if (n >= 100) {
        word += a[Math.floor(n / 100)] + 'Hundred ';
        n %= 100;
      }
      if (n > 0) {
        if (word !== '') word += 'and ';
        if (n < 20) {
          word += a[n];
        } else {
          word += b[Math.floor(n / 10)] + a[n % 10];
        }
      }
      return word;
    };

    let n = Math.floor(num);
    if (n === 0) return 'Rupees Zero Only';

    let word = 'Rupees ';
    
    // Crore
    if (Math.floor(n / 10000000) > 0) {
      word += convertThreeDigit(Math.floor(n / 10000000)) + 'Crore ';
      n %= 10000000;
    }
    // Lakh
    if (Math.floor(n / 100000) > 0) {
      word += convertThreeDigit(Math.floor(n / 100000)) + 'Lakh ';
      n %= 100000;
    }
    // Thousand
    if (Math.floor(n / 1000) > 0) {
      word += convertThreeDigit(Math.floor(n / 1000)) + 'Thousand ';
      n %= 1000;
    }
    // Hundreds/Tens/Ones
    if (n > 0) {
      word += convertThreeDigit(n);
    }

    // Paise
    const paise = Math.round((num - Math.floor(num)) * 100);
    if (paise > 0) {
      word += 'and ' + convertThreeDigit(paise) + 'Paise ';
    }

    return word.trim() + ' Only';
  };

  const detectGstType = (destination) => {
    if (!destination) return 'IGST';
    const dest = destination.trim().toLowerCase();
    
    // Check if it's within UP
    const upKeywords = [
      'uttar pradesh', 'u.p.', 'up',
      'agra', 'noida', 'lucknow', 'kanpur', 'ghaziabad', 'varanasi', 'meerut', 
      'prayagraj', 'allahabad', 'aligarh', 'bareilly', 'moradabad', 'saharanpur', 
      'gorakhpur', 'jhansi', 'muzaffarnagar', 'mathura', 'ayodhya', 'firozabad', 
      'loni', 'rampur', 'shahjahanpur', 'farrukhabad', 'hapur', 'greater noida'
    ];
    
    const isWithinUP = upKeywords.some(keyword => {
      if (keyword === 'up' || keyword === 'u.p.') {
        const regex = new RegExp('\\b' + keyword.replace('.', '\\.') + '\\b', 'i');
        return regex.test(dest);
      }
      return dest.includes(keyword);
    });
    
    return isWithinUP ? 'CGST_SGST' : 'IGST';
  };

  const getExcelSpellNumberFormula = (cellRef) => {
    const rupeesExpr = `INT(${cellRef})`;
    const paiseExpr = `ROUND((MOD(${cellRef},1)*100),0)`;
    
    const spellTwoDigits = (expr) => {
      return `IF(${expr}>0,IF(${expr}<10,CHOOSE(${expr},"One","Two","Three","Four","Five","Six","Seven","Eight","Nine"),IF(${expr}<20,CHOOSE(${expr}-9,"Ten","Eleven","Twelve","Thirteen","Fourteen","Fifteen","Sixteen","Seventeen","Eighteen","Nineteen"),CHOOSE(INT(${expr}/10)-1,"Twenty","Thirty","Forty","Fifty","Sixty","Seventy","Eighty","Ninety")&IF(MOD(${expr},10)>0," "&CHOOSE(MOD(${expr},10),"One","Two","Three","Four","Five","Six","Seven","Eight","Nine"),""))),"")`;
    };
    
    const spellThreeDigits = (expr) => {
      const hundreds = `IF(INT(${expr}/100)>0,CHOOSE(INT(${expr}/100),"One","Two","Three","Four","Five","Six","Seven","Eight","Nine")&" Hundred ","")`;
      const tensOnes = `IF(MOD(${expr},100)>0,IF(MOD(${expr},100)<10,CHOOSE(MOD(${expr},100),"One","Two","Three","Four","Five","Six","Seven","Eight","Nine"),IF(MOD(${expr},100)<20,CHOOSE(MOD(${expr},100)-9,"Ten","Eleven","Twelve","Thirteen","Fourteen","Fifteen","Sixteen","Seventeen","Eighteen","Nineteen"),CHOOSE(INT(MOD(${expr},100)/10)-1,"Twenty","Thirty","Forty","Fifty","Sixty","Seventy","Eighty","Ninety")&IF(MOD(${expr},10)>0," "&CHOOSE(MOD(${expr},10),"One","Two","Three","Four","Five","Six","Seven","Eight","Nine"),""))),"")`;
      return `(${hundreds}&${tensOnes})`;
    };

    const croresPart = `IF(INT(${rupeesExpr}/10000000)>0,${spellTwoDigits(`INT(${rupeesExpr}/10000000)`)}&" Crore ","")`;
    const lakhsPart = `IF(INT(MOD(${rupeesExpr},10000000)/100000)>0,${spellTwoDigits(`INT(MOD(${rupeesExpr},10000000)/100000)`)}&" Lakh ","")`;
    const thousandsPart = `IF(INT(MOD(${rupeesExpr},100000)/1000)>0,${spellTwoDigits(`INT(MOD(${rupeesExpr},100000)/1000)`)}&" Thousand ","")`;
    const hundredsPart = `IF(MOD(${rupeesExpr},1000)>0,${spellThreeDigits(`MOD(${rupeesExpr},1000)`)},"")`;
    
    const spellRupees = `TRIM(${croresPart}&${lakhsPart}&${thousandsPart}&${hundredsPart})`;
    const spellPaise = `IF(${paiseExpr}>0," and "&${spellTwoDigits(paiseExpr)}&" Paise","")`;
    
    return `"Amount in Words: Rupees " & IF(${rupeesExpr}=0,"Zero",${spellRupees}) & ${spellPaise} & " Only"`;
  };

  // Recalculate GST based on Freight amount, custom clearance, misc charges and type selection
  const calculateGstValues = () => {
    const freight = parseFloat(document.getElementById('inv-edit-freight').value) || 0;
    const custom = parseFloat(document.getElementById('inv-edit-custom').value) || 0;
    const misc = parseFloat(document.getElementById('inv-edit-misc').value) || 0;
    const taxableBasis = freight + custom + misc;
    
    const gstType = document.getElementById('inv-edit-gst-type').value;
    
    let igst = 0, cgst = 0, sgst = 0;
    
    if (gstType === 'IGST') {
      igst = Math.round(taxableBasis * 0.18 * 100) / 100;
    } else if (gstType === 'CGST') {
      cgst = Math.round(taxableBasis * 0.09 * 100) / 100;
    } else if (gstType === 'SGST') {
      sgst = Math.round(taxableBasis * 0.09 * 100) / 100;
    } else if (gstType === 'CGST_SGST') {
      cgst = Math.round(taxableBasis * 0.09 * 100) / 100;
      sgst = Math.round(taxableBasis * 0.09 * 100) / 100;
    }
    
    document.getElementById('inv-edit-igst-val').value = igst;
    document.getElementById('inv-edit-cgst-val').value = cgst;
    document.getElementById('inv-edit-sgst-val').value = sgst;
    
    updateGrandTotal();
  };

  const updateGrandTotal = () => {
    const freight = parseFloat(document.getElementById('inv-edit-freight').value) || 0;
    const custom = parseFloat(document.getElementById('inv-edit-custom').value) || 0;
    const misc = parseFloat(document.getElementById('inv-edit-misc').value) || 0;
    
    const subtotal = freight + custom + misc;
    const igst = parseFloat(document.getElementById('inv-edit-igst-val').value) || 0;
    const cgst = parseFloat(document.getElementById('inv-edit-cgst-val').value) || 0;
    const sgst = parseFloat(document.getElementById('inv-edit-sgst-val').value) || 0;
    
    const gstTotal = igst + cgst + sgst;
    const grandTotal = subtotal + gstTotal;
    
    document.getElementById('inv-show-gst-total').textContent = formatINR(gstTotal);
    document.getElementById('inv-show-custom').textContent = formatINR(custom);
    document.getElementById('inv-show-misc').textContent = formatINR(misc);
    document.getElementById('inv-show-subtotal').textContent = formatINR(subtotal);
    document.getElementById('inv-total-charge').textContent = formatINR(grandTotal);

    // Dynamic Amount in Words
    document.getElementById('inv-amount-words-text').textContent = numberToWords(grandTotal);
  };

  // Helper: Generate and Download Excel Invoice (Option B Style) using ExcelJS
  const downloadExcelInvoice = async (shipment) => {
    try {
      // Gather current live inputs from modal
      const invoiceNoVal = document.getElementById('inv-edit-meta-id').value;
      const dateVal = document.getElementById('inv-edit-date').value;
      const awbVal = document.getElementById('inv-edit-awb').value;
      const networkVal = document.getElementById('inv-edit-network').value;
      const pkgVal = parseInt(document.getElementById('inv-edit-package').value) || 1;
      const consigneeVal = document.getElementById('inv-edit-consignee').value;
      const destVal = document.getElementById('inv-edit-destination').value;
      const weightVal = parseFloat(document.getElementById('inv-edit-weight').value) || 0;
      
      const billToNameVal = document.getElementById('inv-edit-billto-name').value;
      const billToAddressVal = document.getElementById('inv-edit-billto-address').value;
      const billToGstinVal = document.getElementById('inv-edit-billto-gstin').value;
      
      const dimVal = document.getElementById('inv-edit-dimension').value;
      const customVal = parseFloat(document.getElementById('inv-edit-custom').value) || 0;
      const miscVal = parseFloat(document.getElementById('inv-edit-misc').value) || 0;
      const freightVal = parseFloat(document.getElementById('inv-edit-freight').value) || 0;
      
      const igstVal = parseFloat(document.getElementById('inv-edit-igst-val').value) || 0;
      const cgstVal = parseFloat(document.getElementById('inv-edit-cgst-val').value) || 0;
      const sgstVal = parseFloat(document.getElementById('inv-edit-sgst-val').value) || 0;
      const gstTypeVal = document.getElementById('inv-edit-gst-type').value;

      let igstExcelVal = 0;
      let cgstExcelVal = 0;
      let sgstExcelVal = 0;
      
      if (gstTypeVal === 'IGST') {
        igstExcelVal = { formula: 'G24 * 0.18', result: igstVal };
      } else if (gstTypeVal === 'CGST') {
        cgstExcelVal = { formula: 'G24 * 0.09', result: cgstVal };
      } else if (gstTypeVal === 'SGST') {
        sgstExcelVal = { formula: 'G24 * 0.09', result: sgstVal };
      } else if (gstTypeVal === 'CGST_SGST') {
        cgstExcelVal = { formula: 'G24 * 0.09', result: cgstVal };
        sgstExcelVal = { formula: 'G24 * 0.09', result: sgstVal };
      }
      
      const gstTotal = igstVal + cgstVal + sgstVal;
      const grandTotal = freightVal + customVal + miscVal + gstTotal;
      const rupeesWords = numberToWords(grandTotal);

      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Invoice');

      worksheet.views = [{ showGridLines: true }];

      // Define columns
      worksheet.columns = [
        { key: 'A', width: 24 },
        { key: 'B', width: 24 },
        { key: 'C', width: 20 },
        { key: 'D', width: 18 },
        { key: 'E', width: 24 },
        { key: 'F', width: 20 },
        { key: 'G', width: 20 }
      ];

      // Set header row heights to fit the larger logo comfortably
      for (let r = 1; r <= 6; r++) {
        worksheet.getRow(r).height = 24;
      }

      // Merge space for header and insert details (starting directly from Column B next to Column A logo)
      worksheet.mergeCells('B1:G1');
      worksheet.getCell('B1').value = 'SM ENTERPRISES';
      worksheet.getCell('B1').font = { name: 'Outfit', size: 20, bold: true, color: { argb: 'FF1E3A8A' } };

      worksheet.mergeCells('B2:G2');
      worksheet.getCell('B2').value = 'International Courier & Cargo Services';
      worksheet.getCell('B2').font = { name: 'Inter', size: 11, italic: true, color: { argb: 'FF64748B' } };

      worksheet.mergeCells('B3:G3');
      worksheet.getCell('B3').value = 'GSTIN: 09BXIPM9504M1ZT';
      worksheet.getCell('B3').font = { name: 'Inter', size: 11, bold: true };

      worksheet.mergeCells('B4:G4');
      worksheet.getCell('B4').value = 'MSME NO. : UDYAM - UP - 01 - 011 - 6646';
      worksheet.getCell('B4').font = { name: 'Inter', size: 11, bold: true };

      worksheet.mergeCells('B5:G5');
      worksheet.getCell('B5').value = 'Address: H NO-57 SHIVANI DHAM III, NEAR JAG JEEVAN NAGAR NARAICH, Agra, UP - 282006';
      worksheet.getCell('B5').font = { name: 'Inter', size: 10, color: { argb: 'FF475569' } };

      worksheet.mergeCells('B6:G6');
      worksheet.getCell('B6').value = 'Phone: +91 9068451228, 7248637203 | Email: smenterprisesagra5@gmail.com';
      worksheet.getCell('B6').font = { name: 'Inter', size: 10, color: { argb: 'FF475569' } };

      // Load SM Logo
      try {
        const logoResponse = await fetch('/images/logo.jpg');
        if (logoResponse.ok) {
          const logoBlob = await logoResponse.blob();
          const arrayBuffer = await logoBlob.arrayBuffer();
          const logoImage = workbook.addImage({
            buffer: arrayBuffer,
            extension: 'jpeg'
          });
          worksheet.addImage(logoImage, {
            tl: { col: 0, row: 0 },
            ext: { width: 140, height: 140 }
          });
        }
      } catch (err) {
        console.warn('Failed to load logo inside Excel invoice:', err);
      }

      // Title Bar (Row 8)
      worksheet.mergeCells('A8:G8');
      const titleCell = worksheet.getCell('A8');
      titleCell.value = 'INVOICE BILL / BILL OF LADING';
      titleCell.font = { name: 'Outfit', size: 16, bold: true, color: { argb: 'FF1E3A8A' } };
      titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDBEAFE' } };
      titleCell.alignment = { vertical: 'middle', horizontal: 'center' };

      // Metadata Row (Row 9)
      worksheet.getCell('A9').value = 'Invoice No:';
      worksheet.getCell('A9').font = { bold: true };
      worksheet.getCell('B9').value = invoiceNoVal;
      worksheet.getCell('B9').font = { bold: true, color: { argb: 'FF1E40AF' } };

      worksheet.getCell('F9').value = 'Date:';
      worksheet.getCell('F9').font = { bold: true };
      worksheet.getCell('G9').value = new Date().toLocaleDateString('en-GB');

      // Parties Section Headers - Only BILL TO PARTY (Row 11)
      worksheet.mergeCells('A11:C11');
      worksheet.getCell('A11').value = 'BILL TO PARTY';
      worksheet.getCell('A11').font = { name: 'Outfit', size: 11, bold: true, color: { argb: 'FF1E3A8A' } };
      worksheet.getCell('A11').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };

      // Bill To Party Values (Row 12-14)
      worksheet.getCell('A12').value = 'Name:';
      worksheet.getCell('B12').value = billToNameVal || '-';
      worksheet.getCell('A13').value = 'Address:';
      worksheet.getCell('B13').value = billToAddressVal || '-';
      worksheet.getCell('A14').value = 'GSTIN:';
      worksheet.getCell('B14').value = billToGstinVal || '-';

      // Item Details Title (Row 16)
      worksheet.mergeCells('A16:G16');
      worksheet.getCell('A16').value = 'SHIPMENT ITEM DETAILS';
      worksheet.getCell('A16').font = { name: 'Outfit', size: 11, bold: true, color: { argb: 'FF1E3A8A' } };
      worksheet.getCell('A16').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };

      // Table Headers (Row 17)
      const headers = ['Date', 'AWB No.', 'Network', 'Package (PCS)', 'Consignee', 'Destination', 'Ch-Weight (KG)'];
      headers.forEach((h, idx) => {
        const cell = worksheet.getCell(17, idx + 1);
        cell.value = h;
        cell.font = { bold: true, size: 11 };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2E8F0' } };
        cell.alignment = { horizontal: idx === 3 ? 'center' : (idx === 6 ? 'right' : 'left') };
      });

      // Table values (Row 18)
      const rowValues = [dateVal, awbVal, networkVal, pkgVal, consigneeVal, destVal, weightVal];
      rowValues.forEach((val, idx) => {
        const cell = worksheet.getCell(18, idx + 1);
        cell.value = val;
        cell.alignment = { horizontal: idx === 3 ? 'center' : (idx === 6 ? 'right' : 'left') };
        cell.border = { bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } } };
      });

      // Billing block title (Row 20)
      worksheet.mergeCells('E20:G20');
      worksheet.getCell('E20').value = 'BILLING SUMMARY';
      worksheet.getCell('E20').font = { name: 'Outfit', size: 11, bold: true, color: { argb: 'FF1E3A8A' } };
      worksheet.getCell('E20').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };

      // Base Freight (Row 21)
      worksheet.getCell('E21').value = 'Freight Amount:';
      worksheet.getCell('E21').font = { bold: true };
      worksheet.getCell('G21').value = freightVal;
      worksheet.getCell('G21').numFmt = '₹#,##0.00';
      worksheet.getCell('G21').alignment = { horizontal: 'right' };

      // Custom Clearance (Row 22)
      worksheet.getCell('E22').value = 'Custom Clearance:';
      worksheet.getCell('G22').value = customVal;
      worksheet.getCell('G22').numFmt = '₹#,##0.00';
      worksheet.getCell('G22').alignment = { horizontal: 'right' };

      // Misc Charges (Row 23)
      worksheet.getCell('E23').value = 'Misc Charges:';
      worksheet.getCell('G23').value = miscVal;
      worksheet.getCell('G23').numFmt = '₹#,##0.00';
      worksheet.getCell('G23').alignment = { horizontal: 'right' };

      // Total before tax (Row 24)
      worksheet.getCell('E24').value = 'Total:';
      worksheet.getCell('E24').font = { bold: true };
      worksheet.getCell('G24').value = { formula: 'SUM(G21:G23)', result: freightVal + customVal + miscVal };
      worksheet.getCell('G24').font = { bold: true };
      worksheet.getCell('G24').numFmt = '₹#,##0.00';
      worksheet.getCell('G24').alignment = { horizontal: 'right' };

      // GST Price Section header (Row 25)
      worksheet.mergeCells('A25:G25');
      worksheet.getCell('A25').value = 'GST PRICE SECTION';
      worksheet.getCell('A25').font = { name: 'Outfit', size: 11, bold: true, color: { argb: 'FF1E3A8A' } };
      worksheet.getCell('A25').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };

      // GST Table Columns (Row 26)
      worksheet.mergeCells('A26:B26');
      worksheet.getCell('A26').value = 'IGST (18%)';
      worksheet.getCell('A26').font = { bold: true, size: 10 };
      worksheet.getCell('A26').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2E8F0' } };
      worksheet.getCell('A26').alignment = { horizontal: 'center' };

      worksheet.mergeCells('C26:D26');
      worksheet.getCell('C26').value = 'CGST (9%)';
      worksheet.getCell('C26').font = { bold: true, size: 10 };
      worksheet.getCell('C26').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2E8F0' } };
      worksheet.getCell('C26').alignment = { horizontal: 'center' };

      worksheet.mergeCells('E26:G26');
      worksheet.getCell('E26').value = 'SGST (9%)';
      worksheet.getCell('E26').font = { bold: true, size: 10 };
      worksheet.getCell('E26').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2E8F0' } };
      worksheet.getCell('E26').alignment = { horizontal: 'center' };

      // GST Table Values (Row 27)
      worksheet.mergeCells('A27:B27');
      worksheet.getCell('A27').value = igstExcelVal;
      worksheet.getCell('A27').numFmt = '₹#,##0.00';
      worksheet.getCell('A27').alignment = { horizontal: 'center' };

      worksheet.mergeCells('C27:D27');
      worksheet.getCell('C27').value = cgstExcelVal;
      worksheet.getCell('C27').numFmt = '₹#,##0.00';
      worksheet.getCell('C27').alignment = { horizontal: 'center' };

      worksheet.mergeCells('E27:G27');
      worksheet.getCell('E27').value = sgstExcelVal;
      worksheet.getCell('E27').numFmt = '₹#,##0.00';
      worksheet.getCell('E27').alignment = { horizontal: 'center' };

      // Grand Total & Amount in Words (Row 29-30)
      worksheet.mergeCells('A29:D30');
      const wordsCell = worksheet.getCell('A29');
      wordsCell.value = {
        formula: getExcelSpellNumberFormula('G29'),
        result: 'Amount in Words: ' + rupeesWords
      };
      wordsCell.font = { italic: true, size: 10, color: { argb: 'FF475569' } };
      wordsCell.alignment = { wrapText: true, vertical: 'top' };

      // Set row heights to ensure enough vertical space for text wrapping
      worksheet.getRow(29).height = 24;
      worksheet.getRow(30).height = 24;

      worksheet.mergeCells('E29:F29');
      worksheet.getCell('E29').value = 'Grand Total:';
      worksheet.getCell('E29').font = { bold: true, size: 13, color: { argb: 'FF1E3A8A' } };
      worksheet.getCell('G29').value = {
        formula: 'SUM(G24, A27, C27, E27)',
        result: grandTotal
      };
      worksheet.getCell('G29').font = { bold: true, size: 13, color: { argb: 'FF1E3A8A' } };
      worksheet.getCell('G29').numFmt = '₹#,##0.00';
      worksheet.getCell('G29').alignment = { horizontal: 'right' };
      
      const totalRow = worksheet.getRow(29);
      // Removed light blue lines to ensure clean PDF export

      let nextRowIdx = 31;
      const startBankRow = nextRowIdx;

      // Terms
      worksheet.getCell('A' + nextRowIdx).value = 'Terms & Conditions :';
      worksheet.getCell('A' + nextRowIdx).font = { bold: true, size: 11 };
      nextRowIdx++;

      const terms = [
        "1. Payment should be made to authorised repre. only against official receipt.",
        "2. Cheque/DD should be made in favour of SM ENTERPRISES",
        "3. Payment should be made within 1 days from the date of bill.",
        "4. Late payments are subject to an interest charges of 2% per month.",
        "5. All disputes are subject to Agra Jurisdiction only.",
        "6. SM ENTERPRISES laibility is as per the clause specified in Airwaybill."
      ];
      terms.forEach((t, idx) => {
        worksheet.getCell('A' + nextRowIdx).value = t;
        worksheet.getCell('A' + nextRowIdx).font = { 
          size: 10, 
          bold: idx === 1, 
          color: idx === 1 ? { argb: 'FF000000' } : { argb: 'FF64748B' } 
        };
        nextRowIdx++;
      });

      // Bank Details next to Terms (Columns E/F/G starting at same row 31)
      worksheet.mergeCells(`E${startBankRow}:G${startBankRow}`);
      worksheet.getCell(`E${startBankRow}`).value = 'BANK DETAILS:';
      worksheet.getCell(`E${startBankRow}`).font = { name: 'Outfit', bold: true, size: 11, color: { argb: 'FF1E3A8A' } };

      worksheet.mergeCells(`E${startBankRow + 1}:G${startBankRow + 1}`);
      worksheet.getCell(`E${startBankRow + 1}`).value = 'SM ENTERPRISES';
      worksheet.getCell(`E${startBankRow + 1}`).font = { name: 'Inter', bold: true, size: 10, color: { argb: 'FF000000' } };

      worksheet.mergeCells(`E${startBankRow + 2}:G${startBankRow + 2}`);
      worksheet.getCell(`E${startBankRow + 2}`).value = 'IDFC FIRST BANK';
      worksheet.getCell(`E${startBankRow + 2}`).font = { name: 'Inter', bold: true, size: 10, color: { argb: 'FF000000' } };

      worksheet.mergeCells(`E${startBankRow + 3}:G${startBankRow + 3}`);
      worksheet.getCell(`E${startBankRow + 3}`).value = 'A/C: 72486372038';
      worksheet.getCell(`E${startBankRow + 3}`).font = { name: 'Inter', bold: true, size: 10, color: { argb: 'FF000000' } };

      worksheet.mergeCells(`E${startBankRow + 4}:G${startBankRow + 4}`);
      worksheet.getCell(`E${startBankRow + 4}`).value = 'IFSC CODE: IDFB0021291';
      worksheet.getCell(`E${startBankRow + 4}`).font = { name: 'Inter', bold: true, size: 10, color: { argb: 'FF000000' } };

      worksheet.mergeCells(`E${startBankRow + 5}:G${startBankRow + 5}`);
      worksheet.getCell(`E${startBankRow + 5}`).value = 'SWIFT CODE: IDFBINBBMUM';
      worksheet.getCell(`E${startBankRow + 5}`).font = { name: 'Inter', bold: true, size: 10, color: { argb: 'FF000000' } };

      worksheet.mergeCells(`E${startBankRow + 6}:G${startBankRow + 6}`);
      worksheet.getCell(`E${startBankRow + 6}`).value = 'Bank Address: Sanjay Palace, Agra.';
      worksheet.getCell(`E${startBankRow + 6}`).font = { name: 'Inter', size: 10, color: { argb: 'FF64748B' } };

      // Signatory section
      worksheet.getCell('F' + (nextRowIdx + 1)).value = 'SM Enterprises';
      worksheet.getCell('F' + (nextRowIdx + 1)).font = { bold: true, size: 11 };
      worksheet.getCell('F' + (nextRowIdx + 2)).value = 'Authorized Signatory';
      worksheet.getCell('F' + (nextRowIdx + 2)).font = { size: 10, color: { argb: 'FF64748B' } };

      // Page Setup for Perfect A4 PDF Printing
      worksheet.pageSetup = {
        paperSize: 9, // A4
        orientation: 'portrait',
        fitToPage: true,
        fitToWidth: 1,
        fitToHeight: 1,
        margins: {
          left: 0.5, right: 0.5,
          top: 0.5, bottom: 0.5,
          header: 0.3, footer: 0.3
        },
        printArea: 'A1:G' + (nextRowIdx + 2)
      };

      worksheet.eachRow((row) => {
        row.font = row.font || { name: 'Inter', size: 11 };
      });

      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `Invoice_${awbVal || 'Shipment'}.xlsx`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (ex) {
      console.error('Error generating Excel invoice:', ex);
      alert('Failed to generate Excel file.');
    }
  };

  const initInvoiceFields = (shipment) => {
    currentInvoiceShipment = shipment;
    
    // Populate header dates
    document.getElementById('inv-meta-date').textContent = new Date().toLocaleDateString('en-GB');
    document.getElementById('inv-edit-meta-id').value = shipment.jbn_awb || `INV-${shipment.id}`;
    
    // Populate Bill To Party inputs
    document.getElementById('inv-edit-billto-name').value = shipment.shipper || '';
    document.getElementById('inv-edit-billto-address').value = 'Agra, Uttar Pradesh, India';
    document.getElementById('inv-edit-billto-gstin').value = '';
    
    // Populate table inputs
    document.getElementById('inv-edit-date').value = shipment.date || '';
    document.getElementById('inv-edit-awb').value = shipment.awb || '';
    document.getElementById('inv-edit-network').value = shipment.service || '';
    document.getElementById('inv-edit-package').value = shipment.pcs || 1;
    document.getElementById('inv-edit-consignee').value = shipment.consignee || '';
    document.getElementById('inv-edit-destination').value = shipment.destination || '';
    document.getElementById('inv-edit-weight').value = shipment.weight || 0;
    
    // Populate description inputs
    document.getElementById('inv-edit-dimension').value = '-';
    document.getElementById('inv-edit-custom').value = 0;
    document.getElementById('inv-edit-misc').value = 0;
    document.getElementById('inv-edit-freight').value = shipment.sale || 0;
    
    // Always default GST Type to NONE
    document.getElementById('inv-edit-gst-type').value = 'NONE';
    
    // Recalculate
    calculateGstValues();
  };

  // Invoice Modal Operations
  const openInvoiceModal = (shipment) => {
    initInvoiceFields(shipment);
    invoiceModal.style.display = 'flex';
  };

  const closeInvoiceModal = () => {
    invoiceModal.style.display = 'none';
    currentInvoiceShipment = null;
  };

  invoiceCloseBtn.addEventListener('click', closeInvoiceModal);
  invoiceCancelBtn.addEventListener('click', closeInvoiceModal);
  
  // Close invoice modal if clicking outside modal content
  window.addEventListener('click', (e) => {
    if (e.target === invoiceModal) {
      closeInvoiceModal();
    }
  });

  // Print Invoice Action
  invoicePrintBtn.addEventListener('click', () => {
    window.print();
  });

  // Excel Invoice Action from Modal
  invoiceExcelBtn.addEventListener('click', () => {
    if (currentInvoiceShipment) {
      downloadExcelInvoice(currentInvoiceShipment);
    }
  });

  // Attach event listeners for real-time recalculations in invoice preview
  document.getElementById('inv-edit-gst-type').addEventListener('change', calculateGstValues);
  document.getElementById('inv-edit-freight').addEventListener('input', calculateGstValues);
  document.getElementById('inv-edit-custom').addEventListener('input', calculateGstValues);
  document.getElementById('inv-edit-misc').addEventListener('input', calculateGstValues);
  document.getElementById('inv-edit-igst-val').addEventListener('input', updateGrandTotal);
  document.getElementById('inv-edit-cgst-val').addEventListener('input', updateGrandTotal);
  document.getElementById('inv-edit-sgst-val').addEventListener('input', updateGrandTotal);

  // Initial Data Loads
  loadStats();
  loadShipments(1);
  loadMessages();
}
