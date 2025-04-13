// Main JavaScript file for IntegrateISP

// Global variables
let currentUser = null;
let token = null;

// API endpoints
const API = {
    users: '/api/users',
    expenses: '/api/finance/expenses',
    expenseStats: '/api/finance/expenses/stats',
    clients: '/api/clients',
    tasks: '/api/tasks',
    taskStats: '/api/tasks/stats'
};

// Helper functions
function formatCurrency(amount) {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
}

function formatDate(dateString) {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

function formatDateTime(dateString) {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function getStatusBadge(status, type = 'generic') {
    let colorClass = '';
    
    if (type === 'client') {
        switch (status) {
            case 'active': colorClass = 'badge-success'; break;
            case 'pending': colorClass = 'badge-warning'; break;
            case 'inactive': colorClass = 'badge-danger'; break;
            default: colorClass = 'badge-info';
        }
    } else if (type === 'expense') {
        switch (status) {
            case 'submitted': colorClass = 'badge-info'; break;
            case 'approved': colorClass = 'badge-warning'; break;
            case 'rejected': colorClass = 'badge-danger'; break;
            case 'reimbursed': colorClass = 'badge-success'; break;
            default: colorClass = 'badge-info';
        }
    } else if (type === 'task') {
        switch (status) {
            case 'pending': colorClass = 'badge-info'; break;
            case 'in_progress': colorClass = 'badge-warning'; break;
            case 'completed': colorClass = 'badge-success'; break;
            default: colorClass = 'badge-info';
        }
    } else {
        switch (status) {
            case 'success':
            case 'active':
            case 'completed':
            case 'reimbursed': colorClass = 'badge-success'; break;
            case 'warning':
            case 'pending':
            case 'in_progress':
            case 'approved': colorClass = 'badge-warning'; break;
            case 'danger':
            case 'inactive':
            case 'rejected': colorClass = 'badge-danger'; break;
            default: colorClass = 'badge-info';
        }
    }
    
    const displayStatus = status.charAt(0).toUpperCase() + status.slice(1).replace('_', ' ');
    
    return `<span class="badge ${colorClass}">${displayStatus}</span>`;
}

function getPriorityBadge(priority) {
    let colorClass = '';
    
    switch (priority) {
        case 'high': colorClass = 'badge-danger'; break;
        case 'medium': colorClass = 'badge-warning'; break;
        case 'low': colorClass = 'badge-info'; break;
        default: colorClass = 'badge-info';
    }
    
    const displayPriority = priority.charAt(0).toUpperCase() + priority.slice(1);
    
    return `<span class="badge ${colorClass}">${displayPriority}</span>`;
}

function getQuotationStatusBadge(status) {
    let colorClass = '';
    
    switch (status) {
        case 'draft': colorClass = 'badge-info'; break;
        case 'sent': colorClass = 'badge-warning'; break;
        case 'accepted': colorClass = 'badge-success'; break;
        case 'rejected': colorClass = 'badge-danger'; break;
        default: colorClass = 'badge-info';
    }
    
    const displayStatus = status.charAt(0).toUpperCase() + status.slice(1);
    
    return `<span class="badge ${colorClass}">${displayStatus}</span>`;
}

async function fetchAPI(endpoint, options = {}) {
    if (!token) {
        token = localStorage.getItem('token');
        if (!token) {
            window.location.href = '/';
            return null;
        }
    }
    
    // Add authorization header
    const headers = {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        ...options.headers
    };
    
    try {
        const response = await fetch(endpoint, {
            ...options,
            headers
        });
        
        if (response.status === 401) {
            // Unauthorized, redirect to login
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            window.location.href = '/';
            return null;
        }
        
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.detail || 'API request failed');
        }
        
        return await response.json();
    } catch (error) {
        console.error('API Error:', error);
        throw error;
    }
}

// Initialize the application
async function initApp() {
    // Check if user is logged in
    token = localStorage.getItem('token');
    if (!token) {
        window.location.href = '/';
        return;
    }
    
    // Get user info
    const userJson = localStorage.getItem('user');
    if (userJson) {
        currentUser = JSON.parse(userJson);
        document.getElementById('user-name').textContent = currentUser.full_name;
        document.getElementById('user-role').textContent = currentUser.role.charAt(0).toUpperCase() + currentUser.role.slice(1);
    } else {
        try {
            currentUser = await fetchAPI(API.users + '/me');
            localStorage.setItem('user', JSON.stringify(currentUser));
            document.getElementById('user-name').textContent = currentUser.full_name;
            document.getElementById('user-role').textContent = currentUser.role.charAt(0).toUpperCase() + currentUser.role.slice(1);
        } catch (error) {
            console.error('Error fetching user info:', error);
            // Redirect to login if user info cannot be retrieved
            localStorage.removeItem('token');
            window.location.href = '/';
            return;
        }
    }
    
    // Setup navigation
    setupNavigation();
    
    // Setup logout button
    document.getElementById('logout-button').addEventListener('click', logout);
    
    // Load dashboard data
    loadDashboard();
    
    // Setup modals
    setupModals();
    
    // Setup form submissions
    setupForms();
}

function setupNavigation() {
    const navItems = document.querySelectorAll('.nav-item');
    const sections = document.querySelectorAll('.section');
    
    // Hide sections based on user role
    if (currentUser.role !== 'admin') {
        const userManagementNav = document.querySelector('[data-section="user-management"]');
        if (userManagementNav) {
            userManagementNav.style.display = 'none';
        }
    }
    
    if (currentUser.role !== 'admin' && currentUser.role !== 'finance') {
        const financeNav = document.querySelector('[data-section="finance-tracker"]');
        if (financeNav) {
            financeNav.classList.add('restricted');
        }
    }
    
    // Setup navigation clicks
    navItems.forEach(item => {
        item.addEventListener('click', function(e) {
            e.preventDefault();
            
            const sectionId = this.getAttribute('data-section');
            
            // Hide all sections
            sections.forEach(section => {
                section.classList.remove('active');
            });
            
            // Show selected section
            const targetSection = document.getElementById(sectionId);
            targetSection.classList.add('active');
            
            // Load section data if needed
            loadSectionData(sectionId);
        });
    });
    
    // Quick action card navigation
    document.querySelectorAll('.card[data-section]').forEach(card => {
        card.addEventListener('click', function(e) {
            e.preventDefault();
            
            const sectionId = this.getAttribute('data-section');
            
            // Hide all sections
            sections.forEach(section => {
                section.classList.remove('active');
            });
            
            // Show selected section
            const targetSection = document.getElementById(sectionId);
            targetSection.classList.add('active');
            
            // Load section data if needed
            loadSectionData(sectionId);
        });
    });
}
function loadSectionData(sectionId) {
    switch (sectionId) {
        case 'user-management':
            loadUsers();
            break;
        case 'finance-tracker':
            loadExpenses();
            loadExpenseStats();
            break;
        case 'client-management':
            loadClients();
            break;
        case 'task-management':
            loadTasks();
            loadTaskStats();
            loadAssignedTasks();
            loadUpcomingDeadlines();
            break;
    }
}

async function loadDashboard() {
    // Load dashboard overview data
    try {
        // Load recent clients
        const clients = await fetchAPI(API.clients + '?limit=4');
        updateRecentClients(clients);
        
        // Update client count
        document.getElementById('total-clients').textContent = clients.length;
        document.getElementById('client-growth').textContent = '12'; // Mock data
        
        // Load upcoming tasks
        const tasks = await fetchAPI(API.tasks + '?limit=4');
        updateUpcomingTasks(tasks);
        
        // Update task count
        const pendingTasks = tasks.filter(task => task.status !== 'completed').length;
        document.getElementById('pending-tasks').textContent = pendingTasks;
        document.getElementById('tasks-growth').textContent = '5'; // Mock data
        
        // Load expense stats
        const expenseStats = await fetchAPI(API.expenseStats);
        document.getElementById('expenses-mtd').textContent = formatCurrency(expenseStats.total_mtd);
        document.getElementById('expenses-growth').textContent = '2'; // Mock data
        
        // Mock revenue data
        document.getElementById('monthly-revenue').textContent = '$12,450';
        document.getElementById('revenue-growth').textContent = '8';
        
        // Load recent activities (mock data)
        updateRecentActivities();
        
    } catch (error) {
        console.error('Error loading dashboard data:', error);
    }
}

function updateRecentClients(clients) {
    const container = document.getElementById('recent-clients');
    
    if (!clients || clients.length === 0) {
        container.innerHTML = '<tr><td colspan="3" class="text-center py-4">No clients found</td></tr>';
        return;
    }
    
    let html = '';
    
    clients.forEach(client => {
        const initial = client.name.charAt(0).toUpperCase();
        const statusBadge = getStatusBadge(client.status, 'client');
        
        html += `
        <tr>
            <td class="py-2">
                <div class="flex items-center">
                    <div class="bg-blue-100 rounded-full w-8 h-8 flex items-center justify-center mr-3">
                        <span class="text-blue-600 font-bold">${initial}</span>
                    </div>
                    <span>${client.name}</span>
                </div>
            </td>
            <td>${statusBadge}</td>
            <td>${client.service_plan.charAt(0).toUpperCase() + client.service_plan.slice(1)}</td>
        </tr>
        `;
    });
    
    container.innerHTML = html;
}

function updateUpcomingTasks(tasks) {
    const container = document.getElementById('upcoming-tasks');
    
    if (!tasks || tasks.length === 0) {
        container.innerHTML = '<div class="text-center py-4">No upcoming tasks</div>';
        return;
    }
    
    let html = '';
    
    tasks.forEach(task => {
        const priorityBadge = getPriorityBadge(task.priority);
        
        html += `
        <div class="flex items-start justify-between">
            <div class="flex items-start">
                <input type="checkbox" class="mt-1 mr-3" ${task.status === 'completed' ? 'checked' : ''} data-task-id="${task.id}" onchange="toggleTaskCompletion(this)">
                <div>
                    <p class="text-sm font-medium text-gray-800">${task.title}</p>
                    <p class="text-xs text-gray-500">Due: ${formatDate(task.due_date)}</p>
                </div>
            </div>
            <span>${priorityBadge}</span>
        </div>
        `;
    });
    
    container.innerHTML = html;
}

function updateRecentActivities() {
    const container = document.getElementById('recent-activities');
    
    // Mock data for recent activities
    const activities = [
        { type: 'client', icon: 'user-check', color: 'green', text: 'New client onboarded', details: 'TechCorp Ltd. - 2 hours ago' },
        { type: 'quotation', icon: 'file-signature', color: 'blue', text: 'Quotation sent', details: 'Acme Industries - 5 hours ago' },
        { type: 'expense', icon: 'exclamation-triangle', color: 'red', text: 'Expense rejected', details: 'Hardware purchase - 1 day ago' },
        { type: 'task', icon: 'tasks', color: 'purple', text: 'Task completed', details: 'Network setup for Global Services - 1 day ago' }
    ];
    
    let html = '';
    
    activities.forEach(activity => {
        html += `
        <div class="flex items-start">
            <div class="flex-shrink-0 bg-${activity.color}-100 rounded-full p-2">
                <i class="fas fa-${activity.icon} text-${activity.color}-600"></i>
            </div>
            <div class="ml-3">
                <p class="text-sm font-medium text-gray-800">${activity.text}</p>
                <p class="text-xs text-gray-500">${activity.details}</p>
            </div>
        </div>
        `;
    });
    
    container.innerHTML = html;
}

// User Management Functions
async function loadUsers() {
    try {
        const users = await fetchAPI(API.users);
        updateUsersTable(users);
    } catch (error) {
        console.error('Error loading users:', error);
    }
}

function updateUsersTable(users) {
    const container = document.getElementById('users-table');
    
    if (!users || users.length === 0) {
        container.innerHTML = '<tr><td colspan="6" class="text-center py-4">No users found</td></tr>';
        return;
    }
    
    let html = '';
    
    users.forEach(user => {
        const initials = user.full_name.split(' ').map(name => name.charAt(0).toUpperCase()).join('');
        const roleBadge = getRoleBadge(user.role);
        const statusBadge = getStatusBadge(user.is_active ? 'active' : 'inactive');
        
        html += `
        <tr>
            <td>
                <div class="flex items-center">
                    <div class="bg-indigo-100 rounded-full w-8 h-8 flex items-center justify-center mr-3">
                        <span class="text-indigo-600 font-bold">${initials}</span>
                    </div>
                    <span>${user.full_name}</span>
                </div>
            </td>
            <td>${user.email}</td>
            <td>${roleBadge}</td>
            <td>${statusBadge}</td>
            <td>${formatDateTime(user.last_login)}</td>
            <td>
                <div class="flex space-x-2">
                    <button class="text-blue-600 hover:text-blue-800" onclick="editUser(${user.id})"><i class="fas fa-edit"></i></button>
                    ${user.id !== currentUser.id ? `<button class="text-red-600 hover:text-red-800" onclick="deleteUser(${user.id})"><i class="fas fa-trash"></i></button>` : ''}
                </div>
            </td>
        </tr>
        `;
    });
    
    container.innerHTML = html;
    document.getElementById('users-count').textContent = `Showing ${users.length} users`;
}

function getRoleBadge(role) {
    let colorClass = '';
    
    switch (role) {
        case 'admin': colorClass = 'badge-info'; break;
        case 'manager': colorClass = 'badge-warning'; break;
        case 'employee': colorClass = 'badge-success'; break;
        case 'finance': colorClass = 'badge-danger'; break;
        default: colorClass = 'badge-info';
    }
    
    const displayRole = role.charAt(0).toUpperCase() + role.slice(1);
    
    return `<span class="badge ${colorClass}">${displayRole}</span>`;
}

async function editUser(userId) {
    try {
        const user = await fetchAPI(`${API.users}/${userId}`);
        
        // Populate form with user data
        document.getElementById('full-name').value = user.full_name;
        document.getElementById('user-email').value = user.email;
        document.getElementById('user-password').value = ''; // Don't populate password
        document.getElementById('user-role-select').value = user.role;
        
        // Show the modal
        const modal = document.getElementById('add-user-modal');
        modal.querySelector('h2').textContent = 'Edit User';
        document.getElementById('add-user-form').setAttribute('data-user-id', userId);
        modal.style.display = 'block';
        
    } catch (error) {
        console.error('Error fetching user details:', error);
    }
}

async function deleteUser(userId) {
    if (!confirm('Are you sure you want to delete this user?')) {
        return;
    }
    
    try {
        await fetchAPI(`${API.users}/${userId}`, { method: 'DELETE' });
        alert('User deleted successfully');
        loadUsers();
    } catch (error) {
        console.error('Error deleting user:', error);
        alert('Failed to delete user: ' + error.message);
    }
}
// Finance Tracker Functions
async function loadExpenses() {
    try {
        const expenses = await fetchAPI(API.expenses);
        updateExpensesTable(expenses);
    } catch (error) {
        console.error('Error loading expenses:', error);
    }
}

function updateExpensesTable(expenses) {
    const container = document.getElementById('expenses-table');
    
    if (!expenses || expenses.length === 0) {
        container.innerHTML = '<tr><td colspan="7" class="text-center py-4">No expenses found</td></tr>';
        return;
    }
    
    let html = '';
    
    expenses.forEach(expense => {
        const statusBadge = getStatusBadge(expense.status, 'expense');
        
        html += `
        <tr>
            <td>${expense.description}</td>
            <td>${expense.category.charAt(0).toUpperCase() + expense.category.slice(1)}</td>
            <td>${formatCurrency(expense.amount)}</td>
            <td>${expense.submitter_name}</td>
            <td>${formatDate(expense.date)}</td>
            <td>${statusBadge}</td>
            <td>
                <div class="flex space-x-2">
                    <button class="text-blue-600 hover:text-blue-800" onclick="viewExpense(${expense.id})"><i class="fas fa-eye"></i></button>
                    ${getExpenseActionButtons(expense)}
                </div>
            </td>
        </tr>
        `;
    });
    
    container.innerHTML = html;
    document.getElementById('expenses-count').textContent = `Showing ${expenses.length} expenses`;
}

function getExpenseActionButtons(expense) {
    let buttons = '';
    
    // Different buttons based on role and expense status
    if (currentUser.role === 'admin' || currentUser.role === 'manager') {
        if (expense.status === 'submitted') {
            buttons += `
            <button class="text-green-600 hover:text-green-800" onclick="approveExpense(${expense.id})"><i class="fas fa-check"></i></button>
            <button class="text-red-600 hover:text-red-800" onclick="rejectExpense(${expense.id})"><i class="fas fa-times"></i></button>
            `;
        }
    }
    
    if (currentUser.role === 'admin' || currentUser.role === 'finance') {
        if (expense.status === 'approved') {
            buttons += `
            <button class="text-green-600 hover:text-green-800" onclick="reimburseExpense(${expense.id})"><i class="fas fa-dollar-sign"></i></button>
            `;
        }
    }
    
    // Allow editing if it's the user's own expense and it's still in submitted status
    if ((expense.submitter_id === currentUser.id && expense.status === 'submitted') || currentUser.role === 'admin') {
        buttons += `
        <button class="text-blue-600 hover:text-blue-800" onclick="editExpense(${expense.id})"><i class="fas fa-edit"></i></button>
        `;
    }
    
    return buttons;
}

async function loadExpenseStats() {
    try {
        const stats = await fetchAPI(API.expenseStats);
        
        // Update expense stats display
        document.getElementById('total-expenses-mtd').textContent = formatCurrency(stats.total_mtd);
        document.getElementById('pending-approval').textContent = formatCurrency(stats.pending_approval);
        document.getElementById('reimbursed-mtd').textContent = formatCurrency(stats.reimbursed_mtd);
        
        // Budget percentage
        const budgetPercent = stats.budget_percentage.toFixed(0);
        document.getElementById('budget-percentage').textContent = `${budgetPercent}%`;
        document.getElementById('budget-progress').style.width = `${budgetPercent}%`;
        
        // Count of pending expenses
        const pendingCount = Object.keys(stats.expenses_by_category).reduce((acc, category) => {
            return acc + (stats.expenses_by_category[category] || 0);
        }, 0);
        document.getElementById('pending-count').textContent = pendingCount;
        
        // Update expense categories
        updateExpenseCategories(stats.expenses_by_category);
        
    } catch (error) {
        console.error('Error loading expense stats:', error);
    }
}

function updateExpenseCategories(categoriesData) {
    const container = document.getElementById('expense-categories');
    
    if (!categoriesData || Object.keys(categoriesData).length === 0) {
        container.innerHTML = '<div class="text-center py-4">No expense data available</div>';
        return;
    }
    
    // Calculate total
    const total = Object.values(categoriesData).reduce((a, b) => a + b, 0);
    
    let html = '';
    
    // Color classes for different categories
    const colors = {
        equipment: 'blue',
        travel: 'green',
        meals: 'yellow',
        software: 'purple',
        supplies: 'red',
        other: 'gray'
    };
    
    // Sort categories by amount (descending)
    const sortedCategories = Object.entries(categoriesData)
        .sort(([, a], [, b]) => b - a)
        .map(([category, amount]) => ({ category, amount }));
    
    sortedCategories.forEach(({ category, amount }) => {
        const percent = ((amount / total) * 100).toFixed(0);
        const color = colors[category] || 'gray';
        
        html += `
        <div>
            <div class="flex justify-between text-sm mb-1">
                <span>${category.charAt(0).toUpperCase() + category.slice(1)}</span>
                <span>${formatCurrency(amount)} (${percent}%)</span>
            </div>
            <div class="progress">
                <div class="progress-bar bg-${color}-500" style="width: ${percent}%"></div>
            </div>
        </div>
        `;
    });
    
    container.innerHTML = html;
}

async function viewExpense(expenseId) {
    try {
        const expense = await fetchAPI(`${API.expenses}/${expenseId}`);
        
        // Create modal content
        const modalContent = `
        <div class="flex justify-between items-center mb-4">
            <h2 class="text-xl font-bold text-gray-800">Expense Details</h2>
            <button class="text-gray-500 hover:text-gray-700 close-modal" data-modal="expense-detail-modal">
                <i class="fas fa-times"></i>
            </button>
        </div>
        
        <div class="space-y-4">
            <div class="flex justify-between items-center">
                <h3 class="text-lg font-semibold">${expense.description}</h3>
                <span>${getStatusBadge(expense.status, 'expense')}</span>
            </div>
            
            <div class="grid grid-cols-2 gap-4">
                <div>
                    <p class="text-sm text-gray-500">Amount</p>
                    <p class="font-medium">${formatCurrency(expense.amount)}</p>
                </div>
                <div>
                    <p class="text-sm text-gray-500">Category</p>
                    <p class="font-medium">${expense.category.charAt(0).toUpperCase() + expense.category.slice(1)}</p>
                </div>
                <div>
                    <p class="text-sm text-gray-500">Date</p>
                    <p class="font-medium">${formatDate(expense.date)}</p>
                </div>
                <div>
                    <p class="text-sm text-gray-500">Submitted By</p>
                    <p class="font-medium">${expense.submitter_name}</p>
                </div>
                ${expense.approver_name ? `
                <div>
                    <p class="text-sm text-gray-500">Approved By</p>
                    <p class="font-medium">${expense.approver_name}</p>
                </div>
                <div>
                    <p class="text-sm text-gray-500">Approved On</p>
                    <p class="font-medium">${formatDateTime(expense.approved_at)}</p>
                </div>
                ` : ''}
                ${expense.reimburser_name ? `
                <div>
                    <p class="text-sm text-gray-500">Reimbursed By</p>
                    <p class="font-medium">${expense.reimburser_name}</p>
                </div>
                <div>
                    <p class="text-sm text-gray-500">Reimbursed On</p>
                    <p class="font-medium">${formatDateTime(expense.reimbursed_at)}</p>
                </div>
                ` : ''}
                ${expense.client_name ? `
                <div>
                    <p class="text-sm text-gray-500">Client</p>
                    <p class="font-medium">${expense.client_name}</p>
                </div>
                ` : ''}
            </div>
            
            ${expense.notes ? `
            <div>
                <p class="text-sm text-gray-500">Notes</p>
                <p class="mt-1 p-2 bg-gray-50 rounded">${expense.notes}</p>
            </div>
            ` : ''}
            
            <div class="flex justify-end space-x-3 mt-6">
                ${getExpenseDetailActionButtons(expense)}
                <button class="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 close-modal" data-modal="expense-detail-modal">
                    Close
                </button>
            </div>
        </div>
        `;
        
        // Update modal and show it
        const modal = document.getElementById('expense-detail-modal');
        modal.querySelector('.modal-content').innerHTML = modalContent;
        modal.style.display = 'block';
        
        // Setup close button
        modal.querySelector('.close-modal').addEventListener('click', function() {
            modal.style.display = 'none';
        });
        
    } catch (error) {
        console.error('Error fetching expense details:', error);
    }
}
function getExpenseDetailActionButtons(expense) {
    let buttons = '';
    
    // Different buttons based on role and expense status
    if (currentUser.role === 'admin' || currentUser.role === 'manager') {
        if (expense.status === 'submitted') {
            buttons += `
            <button class="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700" onclick="approveExpense(${expense.id})">
                Approve
            </button>
            <button class="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-red-600 hover:bg-red-700" onclick="rejectExpense(${expense.id})">
                Reject
            </button>
            `;
        }
    }
    
    if (currentUser.role === 'admin' || currentUser.role === 'finance') {
        if (expense.status === 'approved') {
            buttons += `
            <button class="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700" onclick="reimburseExpense(${expense.id})">
                Mark Reimbursed
            </button>
            `;
        }
    }
    
    // Allow editing if it's the user's own expense and it's still in submitted status
    if ((expense.submitter_id === currentUser.id && expense.status === 'submitted') || currentUser.role === 'admin') {
        buttons += `
        <button class="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700" onclick="editExpense(${expense.id})">
            Edit
        </button>
        `;
    }
    
    return buttons;
}

async function approveExpense(expenseId) {
    try {
        await fetchAPI(`${API.expenses}/${expenseId}/approve`, {
            method: 'POST',
            body: JSON.stringify({
                status: 'approved'
            })
        });
        
        alert('Expense approved successfully');
        
        // Close modal if open
        const modal = document.getElementById('expense-detail-modal');
        modal.style.display = 'none';
        
        // Reload data
        loadExpenses();
        loadExpenseStats();
        
    } catch (error) {
        console.error('Error approving expense:', error);
        alert('Failed to approve expense: ' + error.message);
    }
}

async function rejectExpense(expenseId) {
    const reason = prompt('Please enter a reason for rejection:');
    if (reason === null) return; // User cancelled
    
    try {
        await fetchAPI(`${API.expenses}/${expenseId}/approve`, {
            method: 'POST',
            body: JSON.stringify({
                status: 'rejected',
                notes: reason
            })
        });
        
        alert('Expense rejected successfully');
        
        // Close modal if open
        const modal = document.getElementById('expense-detail-modal');
        modal.style.display = 'none';
        
        // Reload data
        loadExpenses();
        loadExpenseStats();
        
    } catch (error) {
        console.error('Error rejecting expense:', error);
        alert('Failed to reject expense: ' + error.message);
    }
}

async function reimburseExpense(expenseId) {
    try {
        await fetchAPI(`${API.expenses}/${expenseId}/reimburse`, {
            method: 'POST'
        });
        
        alert('Expense marked as reimbursed successfully');
        
        // Close modal if open
        const modal = document.getElementById('expense-detail-modal');
        modal.style.display = 'none';
        
        // Reload data
        loadExpenses();
        loadExpenseStats();
        
    } catch (error) {
        console.error('Error reimbursing expense:', error);
        alert('Failed to reimburse expense: ' + error.message);
    }
}

async function editExpense(expenseId) {
    try {
        const expense = await fetchAPI(`${API.expenses}/${expenseId}`);
        
        // Populate form with expense data
        document.getElementById('expense-description').value = expense.description;
        document.getElementById('expense-amount').value = expense.amount;
        document.getElementById('expense-date').value = expense.date ? expense.date.split('T')[0] : '';
        document.getElementById('expense-category').value = expense.category;
        document.getElementById('expense-notes').value = expense.notes || '';
        document.getElementById('expense-client').value = expense.client_id || '';
        
        // Show modal
        const modal = document.getElementById('add-expense-modal');
        modal.querySelector('h2').textContent = 'Edit Expense';
        document.getElementById('add-expense-form').setAttribute('data-expense-id', expenseId);
        modal.style.display = 'block';
        
        // Close detail modal if open
        document.getElementById('expense-detail-modal').style.display = 'none';
        
    } catch (error) {
        console.error('Error fetching expense details:', error);
    }
}

// Client Management Functions
async function loadClients() {
    try {
        const clients = await fetchAPI(API.clients);
        updateClientsTable(clients);
    } catch (error) {
        console.error('Error loading clients:', error);
    }
}

function updateClientsTable(clients) {
    const container = document.getElementById('clients-table');
    
    if (!clients || clients.length === 0) {
        container.innerHTML = '<tr><td colspan="7" class="text-center py-4">No clients found</td></tr>';
        return;
    }
    
    let html = '';
    
    clients.forEach(client => {
        const initials = client.name.split(' ').map(name => name.charAt(0).toUpperCase()).join('').slice(0, 2);
        const statusBadge = getStatusBadge(client.status, 'client');
        const servicePlan = client.service_plan.charAt(0).toUpperCase() + client.service_plan.slice(1);
        
        // Find primary contact if available
        let primaryContact = 'Not set';
        if (client.contacts && client.contacts.length > 0) {
            const primary = client.contacts.find(contact => contact.is_primary);
            if (primary) {
                primaryContact = primary.name;
            } else {
                primaryContact = client.contacts[0].name;
            }
        }
        
        html += `
        <tr>
            <td>
                <div class="flex items-center">
                    <div class="bg-blue-100 rounded-full w-8 h-8 flex items-center justify-center mr-3">
                        <span class="text-blue-600 font-bold">${initials}</span>
                    </div>
                    <span>${client.name}</span>
                </div>
            </td>
            <td>${client.location}</td>
            <td>${statusBadge}</td>
            <td>${servicePlan}</td>
            <td>${primaryContact}</td>
            <td>${formatDate(client.onboarded_at)}</td>
            <td>
                <div class="flex space-x-2">
                    <button class="text-blue-600 hover:text-blue-800" onclick="viewClient(${client.id})"><i class="fas fa-eye"></i></button>
                    <button class="text-blue-600 hover:text-blue-800" onclick="editClient(${client.id})"><i class="fas fa-edit"></i></button>
                    ${currentUser.role === 'admin' || currentUser.role === 'manager' ? 
                      `<button class="text-red-600 hover:text-red-800" onclick="deleteClient(${client.id})"><i class="fas fa-trash"></i></button>` : ''}
                </div>
            </td>
        </tr>
        `;
    });
    
    container.innerHTML = html;
    document.getElementById('clients-count').textContent = `Showing ${clients.length} clients`;
    
    // Also populate client dropdowns in forms
    populateClientDropdowns(clients);
}
function populateClientDropdowns(clients) {
    const expenseClientDropdown = document.getElementById('expense-client');
    const taskClientDropdown = document.getElementById('task-client');
    
    if (!clients || clients.length === 0) {
        return;
    }
    
    // Clear existing options except the first one
    while (expenseClientDropdown.options.length > 1) {
        expenseClientDropdown.remove(1);
    }
    
    while (taskClientDropdown.options.length > 1) {
        taskClientDropdown.remove(1);
    }
    
    // Add client options
    clients.forEach(client => {
        const option = new Option(client.name, client.id);
        expenseClientDropdown.add(option.cloneNode(true));
        taskClientDropdown.add(option);
    });
}

async function viewClient(clientId) {
    try {
        const client = await fetchAPI(`${API.clients}/${clientId}`);
        
        // Update client profile section
        const profileSection = document.getElementById('client-profile-section');
        const profileContent = document.getElementById('client-profile-content');
        
        // Create client profile content with tabs
        const initials = client.name.split(' ').map(name => name.charAt(0).toUpperCase()).join('').slice(0, 2);
        const statusBadge = getStatusBadge(client.status, 'client');
        const servicePlan = client.service_plan.charAt(0).toUpperCase() + client.service_plan.slice(1);
        
        profileContent.innerHTML = `
        <div class="mb-6">
            <div class="flex items-center">
                <div class="bg-blue-100 rounded-full w-12 h-12 flex items-center justify-center mr-4">
                    <span class="text-blue-600 font-bold text-xl">${initials}</span>
                </div>
                <div>
                    <h3 class="text-xl font-bold text-gray-800">${client.name}</h3>
                    <div class="flex items-center mt-1">
                        <span class="mr-3">${statusBadge}</span>
                        <span class="text-gray-500">${client.location}</span>
                    </div>
                </div>
            </div>
        </div>
        
        <!-- Tabs Navigation -->
        <div class="border-b border-gray-200">
            <nav class="-mb-px flex space-x-8">
                <a href="#" class="client-tab whitespace-nowrap py-2 px-1 border-b-2 border-indigo-500 font-medium text-sm text-indigo-600" data-tab="overview">Overview</a>
                <a href="#" class="client-tab whitespace-nowrap py-2 px-1 border-b-2 border-transparent font-medium text-sm text-gray-500 hover:text-gray-700 hover:border-gray-300" data-tab="contacts">Contacts</a>
                <a href="#" class="client-tab whitespace-nowrap py-2 px-1 border-b-2 border-transparent font-medium text-sm text-gray-500 hover:text-gray-700 hover:border-gray-300" data-tab="quotations">Quotations</a>
                <a href="#" class="client-tab whitespace-nowrap py-2 px-1 border-b-2 border-transparent font-medium text-sm text-gray-500 hover:text-gray-700 hover:border-gray-300" data-tab="service-history">Service History</a>
                <a href="#" class="client-tab whitespace-nowrap py-2 px-1 border-b-2 border-transparent font-medium text-sm text-gray-500 hover:text-gray-700 hover:border-gray-300" data-tab="technical-docs">Technical Documentation</a>
            </nav>
        </div>
        
        <!-- Tab Content -->
        <div class="py-4">
            <!-- Overview Tab -->
            <div id="overview-tab" class="client-tab-content">
                <div class="grid grid-cols-2 gap-6">
                    <div>
                        <h4 class="text-lg font-semibold mb-3">Client Details</h4>
                        <div class="bg-gray-50 p-4 rounded-lg">
                            <div class="grid grid-cols-2 gap-4">
                                <div>
                                    <p class="text-sm text-gray-500">Location</p>
                                    <p class="font-medium">${client.location}</p>
                                </div>
                                <div>
                                    <p class="text-sm text-gray-500">Service Plan</p>
                                    <p class="font-medium">${servicePlan}</p>
                                </div>
                                <div>
                                    <p class="text-sm text-gray-500">Status</p>
                                    <p class="font-medium">${statusBadge}</p>
                                </div>
                                <div>
                                    <p class="text-sm text-gray-500">Onboarded</p>
                                    <p class="font-medium">${formatDate(client.onboarded_at) || 'Not yet'}</p>
                                </div>
                            </div>
                            ${client.notes ? `
                            <div class="mt-4">
                                <p class="text-sm text-gray-500">Notes</p>
                                <p class="mt-1">${client.notes}</p>
                            </div>
                            ` : ''}
                        </div>
                    </div>
                    
                    <div>
                        <h4 class="text-lg font-semibold mb-3">Primary Contact</h4>
                        <div class="bg-gray-50 p-4 rounded-lg">
                            ${getPrimaryContactHTML(client)}
                        </div>
                    </div>
                    
                    <div class="col-span-2">
                        <h4 class="text-lg font-semibold mb-3">Recent Activity</h4>
                        <div class="bg-gray-50 p-4 rounded-lg">
                            ${getRecentActivityHTML(client)}
                        </div>
                    </div>
                </div>
            </div>
            
            <!-- Contacts Tab -->
            <div id="contacts-tab" class="client-tab-content hidden">
                <div class="flex justify-between items-center mb-4">
                    <h4 class="text-lg font-semibold">Contact Information</h4>
                    <button class="px-3 py-1 bg-indigo-600 text-white rounded hover:bg-indigo-700 text-sm" onclick="addContact(${client.id})">
                        <i class="fas fa-plus mr-1"></i> Add Contact
                    </button>
                </div>
                
                <div class="bg-white rounded-lg shadow overflow-hidden">
                    <table class="min-w-full">
                        <thead>
                            <tr>
                                <th>Name</th>
                                <th>Role</th>
                                <th>Email</th>
                                <th>Phone</th>
                                <th>Primary</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${getContactsTableHTML(client)}
                        </tbody>
                    </table>
                </div>
            </div>
            
            <!-- Quotations Tab -->
            <div id="quotations-tab" class="client-tab-content hidden">
                <div class="flex justify-between items-center mb-4">
                    <h4 class="text-lg font-semibold">Quotations</h4>
                    <button class="px-3 py-1 bg-indigo-600 text-white rounded hover:bg-indigo-700 text-sm" onclick="addQuotation(${client.id})">
                        <i class="fas fa-plus mr-1"></i> Add Quotation
                    </button>
                </div>
                
                <div class="bg-white rounded-lg shadow overflow-hidden">
                    <table class="min-w-full">
                        <thead>
                            <tr>
                                <th>Version</th>
                                <th>Status</th>
                                <th>Created</th>
                                <th>Sent</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${getQuotationsTableHTML(client)}
                        </tbody>
                    </table>
                </div>
            </div>
            
            <!-- Service History Tab -->
            <div id="service-history-tab" class="client-tab-content hidden">
                <div class="flex justify-between items-center mb-4">
                    <h4 class="text-lg font-semibold">Service History</h4>
                    <button class="px-3 py-1 bg-indigo-600 text-white rounded hover:bg-indigo-700 text-sm" onclick="addServiceHistoryEntry(${client.id})">
                        <i class="fas fa-plus mr-1"></i> Add Entry
                    </button>
                </div>
                
                <div class="relative">
                    <div class="absolute top-0 bottom-0 left-6 w-1 bg-gray-200"></div>
                    <div class="space-y-6 ml-12">
                        ${getServiceHistoryHTML(client)}
                    </div>
                </div>
            </div>
            
            <!-- Technical Documentation Tab -->
            <div id="technical-docs-tab" class="client-tab-content hidden">
                <div class="flex justify-between items-center mb-4">
                    <h4 class="text-lg font-semibold">Technical Documentation</h4>
                    <button class="px-3 py-1 bg-indigo-600 text-white rounded hover:bg-indigo-700 text-sm" onclick="addTechnicalDoc(${client.id})">
                        <i class="fas fa-plus mr-1"></i> Add Documentation
                    </button>
                </div>
                
                <div class="grid grid-cols-1 gap-4">
                    ${getTechnicalDocsHTML(client)}
                </div>
            </div>
        </div>
        
        <!-- Actions -->
        <div class="mt-6 flex justify-end space-x-3">
            <button class="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50" onclick="editClient(${client.id})">
                Edit Client
            </button>
            <button class="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700" onclick="viewTasks(${client.id})">
                View Tasks
            </button>
        </div>
        `;
        
        // Setup tab switching
        setupClientTabs();
        
        // Scroll to client profile section
        profileSection.scrollIntoView({ behavior: 'smooth' });
        
    } catch (error) {
        console.error('Error fetching client details:', error);
    }
}
function getPrimaryContactHTML(client) {
    if (!client.contacts || client.contacts.length === 0) {
        return `
        <div class="text-center py-4">
            <p class="text-gray-500">No contacts found for this client.</p>
            <button class="mt-2 px-3 py-1 bg-indigo-600 text-white rounded hover:bg-indigo-700 text-sm" onclick="addContact(${client.id})">
                <i class="fas fa-plus mr-1"></i> Add Contact
            </button>
        </div>
        `;
    }
    
    // Find primary contact
    let primaryContact = client.contacts.find(contact => contact.is_primary);
    
    // If no primary contact, use the first one
    if (!primaryContact && client.contacts.length > 0) {
        primaryContact = client.contacts[0];
    }
    
    if (!primaryContact) {
        return `
        <div class="text-center py-4">
            <p class="text-gray-500">No primary contact set.</p>
            <button class="mt-2 px-3 py-1 bg-indigo-600 text-white rounded hover:bg-indigo-700 text-sm" onclick="addContact(${client.id})">
                <i class="fas fa-plus mr-1"></i> Add Contact
            </button>
        </div>
        `;
    }
    
    return `
    <div>
        <h5 class="font-semibold">${primaryContact.name}</h5>
        <p class="text-sm text-gray-500">${primaryContact.role || 'No role specified'}</p>
        
        <div class="mt-3 space-y-2">
            <div class="flex items-center">
                <i class="fas fa-envelope text-gray-400 mr-2"></i>
                <a href="mailto:${primaryContact.email}" class="text-blue-600 hover:underline">${primaryContact.email}</a>
            </div>
            ${primaryContact.phone ? `
            <div class="flex items-center">
                <i class="fas fa-phone text-gray-400 mr-2"></i>
                <a href="tel:${primaryContact.phone}" class="text-blue-600 hover:underline">${primaryContact.phone}</a>
            </div>
            ` : ''}
            ${primaryContact.department ? `
            <div class="flex items-center">
                <i class="fas fa-building text-gray-400 mr-2"></i>
                <span>${primaryContact.department}</span>
            </div>
            ` : ''}
        </div>
    </div>
    `;
}

function getRecentActivityHTML(client) {
    if (!client.service_history || client.service_history.length === 0) {
        return `<p class="text-center text-gray-500">No activity recorded yet.</p>`;
    }
    
    // Sort by date descending and take the most recent 3
    const recentActivity = [...client.service_history]
        .sort((a, b) => new Date(b.event_date) - new Date(a.event_date))
        .slice(0, 3);
    
    let html = '<div class="space-y-3">';
    
    recentActivity.forEach(activity => {
        const icon = getActivityIcon(activity.event_type);
        
        html += `
        <div class="flex items-start">
            <div class="flex-shrink-0 mr-3">
                <div class="bg-indigo-100 rounded-full p-2">
                    <i class="fas ${icon} text-indigo-600"></i>
                </div>
            </div>
            <div>
                <p class="font-medium">${activity.description}</p>
                <p class="text-sm text-gray-500">${formatDate(activity.event_date)} • ${activity.staff_name || 'System'}</p>
            </div>
        </div>
        `;
    });
    
    html += '</div>';
    return html;
}

function getActivityIcon(eventType) {
    switch (eventType.toLowerCase()) {
        case 'initial_contact': return 'fa-handshake';
        case 'quotation_sent': return 'fa-file-invoice';
        case 'installation': return 'fa-tools';
        case 'activation': return 'fa-satellite-dish';
        case 'issue': return 'fa-exclamation-triangle';
        case 'support': return 'fa-headset';
        case 'billing': return 'fa-file-invoice-dollar';
        default: return 'fa-calendar-check';
    }
}

function getContactsTableHTML(client) {
    if (!client.contacts || client.contacts.length === 0) {
        return `<tr><td colspan="6" class="text-center py-4">No contacts added yet.</td></tr>`;
    }
    
    let html = '';
    
    client.contacts.forEach(contact => {
        html += `
        <tr>
            <td>${contact.name}</td>
            <td>${contact.role || 'N/A'}</td>
            <td><a href="mailto:${contact.email}" class="text-blue-600 hover:underline">${contact.email}</a></td>
            <td>${contact.phone || 'N/A'}</td>
            <td>${contact.is_primary ? '<span class="badge badge-success">Primary</span>' : ''}</td>
            <td>
                <div class="flex space-x-2">
                    <button class="text-blue-600 hover:text-blue-800" onclick="editContact(${client.id}, ${contact.id})"><i class="fas fa-edit"></i></button>
                    <button class="text-red-600 hover:text-red-800" onclick="deleteContact(${client.id}, ${contact.id})"><i class="fas fa-trash"></i></button>
                </div>
            </td>
        </tr>
        `;
    });
    
    return html;
}

function getQuotationsTableHTML(client) {
    if (!client.quotations || client.quotations.length === 0) {
        return `<tr><td colspan="5" class="text-center py-4">No quotations added yet.</td></tr>`;
    }
    
    let html = '';
    
    // Sort by version descending
    const sortedQuotations = [...client.quotations].sort((a, b) => b.version - a.version);
    
    sortedQuotations.forEach(quotation => {
        const statusBadge = getQuotationStatusBadge(quotation.status);
        
        html += `
        <tr>
            <td>Version ${quotation.version}</td>
            <td>${statusBadge}</td>
            <td>${formatDate(quotation.created_at)}</td>
            <td>${formatDate(quotation.sent_at) || 'Not sent'}</td>
            <td>
                <div class="flex space-x-2">
                    <button class="text-blue-600 hover:text-blue-800" onclick="viewQuotation(${client.id}, ${quotation.id})"><i class="fas fa-eye"></i></button>
                    <button class="text-green-600 hover:text-green-800" onclick="downloadQuotationPDF(${client.id}, ${quotation.id})"><i class="fas fa-file-pdf"></i></button>
                    <button class="text-blue-600 hover:text-blue-800" onclick="editQuotation(${client.id}, ${quotation.id})"><i class="fas fa-edit"></i></button>
                </div>
            </td>
        </tr>
        `;
    });
    
    return html;
}

function getServiceHistoryHTML(client) {
    if (!client.service_history || client.service_history.length === 0) {
        return `<p class="text-center text-gray-500">No service history recorded yet.</p>`;
    }
    
    // Sort by date descending
    const sortedHistory = [...client.service_history].sort((a, b) => new Date(b.event_date) - new Date(a.event_date));
    
    let html = '';
    
    sortedHistory.forEach(entry => {
        const icon = getActivityIcon(entry.event_type);
        
        html += `
        <div class="relative">
            <div class="absolute -left-14 mt-1">
                <div class="bg-white rounded-full p-2 border border-gray-200">
                    <i class="fas ${icon} text-indigo-600"></i>
                </div>
            </div>
            <div class="bg-white p-4 rounded-lg shadow">
                <div class="flex justify-between items-start">
                    <div>
                        <h5 class="font-semibold">${entry.event_type.charAt(0).toUpperCase() + entry.event_type.slice(1).replace('_', ' ')}</h5>
                        <p class="text-sm text-gray-500">${formatDate(entry.event_date)} • ${entry.staff_name || 'System'}</p>
                    </div>
                    <div class="flex space-x-2">
                        <button class="text-blue-600 hover:text-blue-800" onclick="editServiceHistory(${client.id}, ${entry.id})"><i class="fas fa-edit"></i></button>
                        <button class="text-red-600 hover:text-red-800" onclick="deleteServiceHistory(${client.id}, ${entry.id})"><i class="fas fa-trash"></i></button>
                    </div>
                </div>
                <p class="mt-2">${entry.description}</p>
                ${entry.communication_channel ? `
                <p class="text-sm text-gray-500 mt-1">Communication method: ${entry.communication_channel}</p>
                ` : ''}
            </div>
        </div>
        `;
    });
    
    return html;
}
function getTechnicalDocsHTML(client) {
    if (!client.technical_docs || client.technical_docs.length === 0) {
        return `<p class="text-center text-gray-500">No technical documentation added yet.</p>`;
    }
    
    // Sort by date descending
    const sortedDocs = [...client.technical_docs].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    
    let html = '';
    
    sortedDocs.forEach(doc => {
        html += `
        <div class="bg-white p-4 rounded-lg shadow">
            <div class="flex justify-between items-start">
                <div>
                    <h5 class="font-semibold">${doc.doc_type.charAt(0).toUpperCase() + doc.doc_type.slice(1).replace('_', ' ')}</h5>
                    <p class="text-sm text-gray-500">Last updated: ${formatDate(doc.updated_at || doc.created_at)}</p>
                </div>
                <div class="flex space-x-2">
                    <button class="text-blue-600 hover:text-blue-800" onclick="viewTechnicalDoc(${client.id}, ${doc.id})"><i class="fas fa-eye"></i></button>
                    <button class="text-blue-600 hover:text-blue-800" onclick="editTechnicalDoc(${client.id}, ${doc.id})"><i class="fas fa-edit"></i></button>
                    <button class="text-red-600 hover:text-red-800" onclick="deleteTechnicalDoc(${client.id}, ${doc.id})"><i class="fas fa-trash"></i></button>
                </div>
            </div>
            <p class="mt-2 text-gray-700">${doc.content.length > 100 ? doc.content.substring(0, 100) + '...' : doc.content}</p>
        </div>
        `;
    });
    
    return html;
}

function setupClientTabs() {
    const tabButtons = document.querySelectorAll('.client-tab');
    const tabContents = document.querySelectorAll('.client-tab-content');
    
    tabButtons.forEach(button => {
        button.addEventListener('click', function(e) {
            e.preventDefault();
            
            // Remove active class from all tabs
            tabButtons.forEach(btn => {
                btn.classList.remove('border-indigo-500', 'text-indigo-600');
                btn.classList.add('border-transparent', 'text-gray-500');
            });
            
            // Add active class to clicked tab
            this.classList.remove('border-transparent', 'text-gray-500');
            this.classList.add('border-indigo-500', 'text-indigo-600');
            
            // Hide all tab contents
            tabContents.forEach(content => {
                content.classList.add('hidden');
            });
            
            // Show selected tab content
            const tabId = this.getAttribute('data-tab');
            document.getElementById(`${tabId}-tab`).classList.remove('hidden');
        });
    });
}

async function editClient(clientId) {
    try {
        const client = await fetchAPI(`${API.clients}/${clientId}`);
        
        // Populate form with client data
        document.getElementById('client-name').value = client.name;
        document.getElementById('client-location').value = client.location;
        document.getElementById('client-status').value = client.status;
        document.getElementById('client-plan').value = client.service_plan;
        document.getElementById('client-notes').value = client.notes || '';
        
        // Show modal
        const modal = document.getElementById('add-client-modal');
        modal.querySelector('h2').textContent = 'Edit Client';
        document.getElementById('add-client-form').setAttribute('data-client-id', clientId);
        modal.style.display = 'block';
        
    } catch (error) {
        console.error('Error fetching client details:', error);
    }
}

async function deleteClient(clientId) {
    if (!confirm('Are you sure you want to delete this client? This action cannot be undone.')) {
        return;
    }
    
    try {
        await fetchAPI(`${API.clients}/${clientId}`, { method: 'DELETE' });
        alert('Client deleted successfully');
        loadClients();
    } catch (error) {
        console.error('Error deleting client:', error);
        alert('Failed to delete client: ' + error.message);
    }
}

// Contact management functions
async function addContact(clientId) {
    // Reset the form
    document.getElementById('add-contact-form').reset();
    
    // Set the client ID
    document.getElementById('contact-client-id').value = clientId;
    
    // Show the modal
    const modal = document.getElementById('add-contact-modal');
    modal.querySelector('h2').textContent = 'Add Contact';
    document.getElementById('add-contact-form').removeAttribute('data-contact-id');
    modal.style.display = 'block';
}

async function editContact(clientId, contactId) {
    try {
        const contact = await fetchAPI(`${API.clients}/${clientId}/contacts/${contactId}`);
        
        // Populate form with contact data
        document.getElementById('contact-client-id').value = clientId;
        document.getElementById('contact-name').value = contact.name;
        document.getElementById('contact-role').value = contact.role || '';
        document.getElementById('contact-department').value = contact.department || '';
        document.getElementById('contact-email').value = contact.email;
        document.getElementById('contact-phone').value = contact.phone || '';
        document.getElementById('contact-preferred').value = contact.preferred_contact || 'email';
        document.getElementById('contact-primary').checked = contact.is_primary;
        
        // Show modal
        const modal = document.getElementById('add-contact-modal');
        modal.querySelector('h2').textContent = 'Edit Contact';
        document.getElementById('add-contact-form').setAttribute('data-contact-id', contactId);
        modal.style.display = 'block';
        
    } catch (error) {
        console.error('Error fetching contact details:', error);
    }
}

async function deleteContact(clientId, contactId) {
    if (!confirm('Are you sure you want to delete this contact?')) {
        return;
    }
    
    try {
        await fetchAPI(`${API.clients}/${clientId}/contacts/${contactId}`, { method: 'DELETE' });
        alert('Contact deleted successfully');
        
        // Refresh client view
        viewClient(clientId);
    } catch (error) {
        console.error('Error deleting contact:', error);
        alert('Failed to delete contact: ' + error.message);
    }
}

// Quotation management functions
async function addQuotation(clientId) {
    // Reset the form
    document.getElementById('add-quotation-form').reset();
    
    // Set the client ID
    document.getElementById('quotation-client-id').value = clientId;
    
    // Show the modal
    const modal = document.getElementById('add-quotation-modal');
    modal.querySelector('h2').textContent = 'Add Quotation';
    document.getElementById('add-quotation-form').removeAttribute('data-quotation-id');
    modal.style.display = 'block';
}
async function editQuotation(clientId, quotationId) {
    try {
        const quotation = await fetchAPI(`${API.clients}/${clientId}/quotations/${quotationId}`);
        
        // Populate form with quotation data
        document.getElementById('quotation-client-id').value = clientId;
        document.getElementById('quotation-html').value = quotation.html_content;
        document.getElementById('quotation-status').value = quotation.status;
        
        // Show modal
        const modal = document.getElementById('add-quotation-modal');
        modal.querySelector('h2').textContent = 'Edit Quotation';
        document.getElementById('add-quotation-form').setAttribute('data-quotation-id', quotationId);
        modal.style.display = 'block';
        
    } catch (error) {
        console.error('Error fetching quotation details:', error);
    }
}

async function viewQuotation(clientId, quotationId) {
    try {
        const quotation = await fetchAPI(`${API.clients}/${clientId}/quotations/${quotationId}`);
        
        // Create modal content
        const modalContent = `
        <div class="flex justify-between items-center mb-4">
            <h2 class="text-xl font-bold text-gray-800">Quotation Details</h2>
            <button class="text-gray-500 hover:text-gray-700 close-modal" data-modal="client-detail-modal">
                <i class="fas fa-times"></i>
            </button>
        </div>
        
        <div class="space-y-4">
            <div class="flex justify-between items-center">
                <div>
                    <h3 class="text-lg font-semibold">Version ${quotation.version}</h3>
                    <p class="text-sm text-gray-500">Created: ${formatDate(quotation.created_at)}</p>
                </div>
                <span>${getQuotationStatusBadge(quotation.status)}</span>
            </div>
            
            <div class="bg-gray-50 p-4 rounded-lg">
                <div id="quotation-preview" class="prose max-w-full">
                    ${quotation.html_content}
                </div>
            </div>
            
            <div class="flex justify-end space-x-3 mt-6">
                <button class="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700" onclick="downloadQuotationPDF(${clientId}, ${quotation.id})">
                    <i class="fas fa-file-pdf mr-2"></i> Download PDF
                </button>
                <button class="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700" onclick="editQuotation(${clientId}, ${quotation.id})">
                    Edit Quotation
                </button>
                <button class="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 close-modal" data-modal="client-detail-modal">
                    Close
                </button>
            </div>
        </div>
        `;
        
        // Update modal and show it
        const modal = document.getElementById('client-detail-modal');
        modal.querySelector('.modal-content').innerHTML = modalContent;
        modal.style.display = 'block';
        
        // Setup close button
        modal.querySelector('.close-modal').addEventListener('click', function() {
            modal.style.display = 'none';
        });
        
    } catch (error) {
        console.error('Error fetching quotation details:', error);
    }
}

async function downloadQuotationPDF(clientId, quotationId) {
    alert('PDF download functionality to be implemented');
    // In a real implementation, this would call an API endpoint that generates and returns a PDF
}

// Service history management functions
async function addServiceHistoryEntry(clientId) {
    // Reset the form
    document.getElementById('add-service-history-form').reset();
    
    // Set the client ID
    document.getElementById('service-history-client-id').value = clientId;
    
    // Set today's date as default
    document.getElementById('service-history-date').valueAsDate = new Date();
    
    // Show the modal
    const modal = document.getElementById('add-service-history-modal');
    modal.querySelector('h2').textContent = 'Add Service History Entry';
    document.getElementById('add-service-history-form').removeAttribute('data-history-id');
    modal.style.display = 'block';
}

async function editServiceHistory(clientId, historyId) {
    try {
        const history = await fetchAPI(`${API.clients}/${clientId}/service-history/${historyId}`);
        
        // Populate form with history data
        document.getElementById('service-history-client-id').value = clientId;
        document.getElementById('service-history-event-type').value = history.event_type;
        document.getElementById('service-history-date').value = history.event_date;
        document.getElementById('service-history-description').value = history.description;
        document.getElementById('service-history-communication').value = history.communication_channel || '';
        
        // Show modal
        const modal = document.getElementById('add-service-history-modal');
        modal.querySelector('h2').textContent = 'Edit Service History Entry';
        document.getElementById('add-service-history-form').setAttribute('data-history-id', historyId);
        modal.style.display = 'block';
        
    } catch (error) {
        console.error('Error fetching service history details:', error);
    }
}

async function deleteServiceHistory(clientId, historyId) {
    if (!confirm('Are you sure you want to delete this service history entry?')) {
        return;
    }
    
    try {
        await fetchAPI(`${API.clients}/${clientId}/service-history/${historyId}`, { method: 'DELETE' });
        alert('Service history entry deleted successfully');
        
        // Refresh client view
        viewClient(clientId);
    } catch (error) {
        console.error('Error deleting service history:', error);
        alert('Failed to delete service history entry: ' + error.message);
    }
}

// Technical documentation management functions
async function addTechnicalDoc(clientId) {
    // Reset the form
    document.getElementById('add-technical-doc-form').reset();
    
    // Set the client ID
    document.getElementById('technical-doc-client-id').value = clientId;
    
    // Show the modal
    const modal = document.getElementById('add-technical-doc-modal');
    modal.querySelector('h2').textContent = 'Add Technical Documentation';
    document.getElementById('add-technical-doc-form').removeAttribute('data-doc-id');
    modal.style.display = 'block';
}

async function editTechnicalDoc(clientId, docId) {
    try {
        const doc = await fetchAPI(`${API.clients}/${clientId}/technical-docs/${docId}`);
        
        // Populate form with doc data
        document.getElementById('technical-doc-client-id').value = clientId;
        document.getElementById('technical-doc-type').value = doc.doc_type;
        document.getElementById('technical-doc-content').value = doc.content;
        
        // Show modal
        const modal = document.getElementById('add-technical-doc-modal');
        modal.querySelector('h2').textContent = 'Edit Technical Documentation';
        document.getElementById('add-technical-doc-form').setAttribute('data-doc-id', docId);
        modal.style.display = 'block';
        
    } catch (error) {
        console.error('Error fetching technical doc details:', error);
    }
}
async function viewTechnicalDoc(clientId, docId) {
    try {
        const doc = await fetchAPI(`${API.clients}/${clientId}/technical-docs/${docId}`);
        
        // Create modal content
        const modalContent = `
        <div class="flex justify-between items-center mb-4">
            <h2 class="text-xl font-bold text-gray-800">Technical Documentation</h2>
            <button class="text-gray-500 hover:text-gray-700 close-modal" data-modal="client-detail-modal">
                <i class="fas fa-times"></i>
            </button>
        </div>
        
        <div class="space-y-4">
            <div class="flex justify-between items-center">
                <h3 class="text-lg font-semibold">${doc.doc_type.charAt(0).toUpperCase() + doc.doc_type.slice(1).replace('_', ' ')}</h3>
                <p class="text-sm text-gray-500">Last updated: ${formatDate(doc.updated_at || doc.created_at)}</p>
            </div>
            
            <div class="bg-gray-50 p-4 rounded-lg">
                <pre class="whitespace-pre-wrap">${doc.content}</pre>
            </div>
            
            <div class="flex justify-end space-x-3 mt-6">
                <button class="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700" onclick="editTechnicalDoc(${clientId}, ${doc.id})">
                    Edit Documentation
                </button>
                <button class="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 close-modal" data-modal="client-detail-modal">
                    Close
                </button>
            </div>
        </div>
        `;
        
        // Update modal and show it
        const modal = document.getElementById('client-detail-modal');
        modal.querySelector('.modal-content').innerHTML = modalContent;
        modal.style.display = 'block';
        
        // Setup close button
        modal.querySelector('.close-modal').addEventListener('click', function() {
            modal.style.display = 'none';
        });
        
    } catch (error) {
        console.error('Error fetching technical doc details:', error);
    }
}

async function deleteTechnicalDoc(clientId, docId) {
    if (!confirm('Are you sure you want to delete this technical document?')) {
        return;
    }
    
    try {
        await fetchAPI(`${API.clients}/${clientId}/technical-docs/${docId}`, { method: 'DELETE' });
        alert('Technical document deleted successfully');
        
        // Refresh client view
        viewClient(clientId);
    } catch (error) {
        console.error('Error deleting technical document:', error);
        alert('Failed to delete technical document: ' + error.message);
    }
}

async function viewTasks(clientId) {
    try {
        const client = await fetchAPI(`${API.clients}/${clientId}`);
        const tasks = await fetchAPI(`${API.tasks}?client_id=${clientId}`);
        
        // Create modal content
        const modalContent = `
        <div class="flex justify-between items-center mb-4">
            <h2 class="text-xl font-bold text-gray-800">Tasks for ${client.name}</h2>
            <button class="text-gray-500 hover:text-gray-700 close-modal" data-modal="client-detail-modal">
                <i class="fas fa-times"></i>
            </button>
        </div>
        
        <div class="space-y-4">
            ${tasks.length === 0 ? `
                <div class="text-center py-6">
                    <p class="text-gray-500">No tasks found for this client.</p>
                    <button class="mt-4 px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 text-sm" onclick="createClientTask(${clientId})">
                        <i class="fas fa-plus mr-1"></i> Create Task
                    </button>
                </div>
            ` : `
                <div class="bg-white rounded-lg shadow overflow-hidden">
                    <table class="min-w-full">
                        <thead>
                            <tr>
                                <th>Title</th>
                                <th>Priority</th>
                                <th>Status</th>
                                <th>Due Date</th>
                                <th>Assignee</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${tasks.map(task => `
                                <tr>
                                    <td>${task.title}</td>
                                    <td>${getPriorityBadge(task.priority)}</td>
                                    <td>${getStatusBadge(task.status, 'task')}</td>
                                    <td>${formatDate(task.due_date)}</td>
                                    <td>${task.assignee_name || 'Unassigned'}</td>
                                    <td>
                                        <div class="flex space-x-2">
                                            <button class="text-blue-600 hover:text-blue-800" onclick="viewTask(${task.id})"><i class="fas fa-eye"></i></button>
                                        </div>
                                    </td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
                
                <div class="flex justify-end">
                    <button class="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 text-sm" onclick="createClientTask(${clientId})">
                        <i class="fas fa-plus mr-1"></i> Create Task
                    </button>
                </div>
            `}
            
            <div class="flex justify-end space-x-3 mt-6">
                <button class="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 close-modal" data-modal="client-detail-modal">
                    Close
                </button>
            </div>
        </div>
        `;
        
        // Update modal and show it
        const modal = document.getElementById('client-detail-modal');
        modal.querySelector('.modal-content').innerHTML = modalContent;
        modal.style.display = 'block';
        
        // Setup close button
        modal.querySelector('.close-modal').addEventListener('click', function() {
            modal.style.display = 'none';
        });
        
    } catch (error) {
        console.error('Error fetching client tasks:', error);
    }
}

function createClientTask(clientId) {
    // Close the client detail modal
    document.getElementById('client-detail-modal').style.display = 'none';
    
    // Open the add task modal
    const modal = document.getElementById('add-task-modal');
    modal.querySelector('h2').textContent = 'Add New Task';
    document.getElementById('add-task-form').reset();
    document.getElementById('task-due-date').valueAsDate = new Date();
    document.getElementById('task-client').value = clientId;
    modal.style.display = 'block';
}

// Task Management Functions
async function loadTasks() {
    try {
        const tasks = await fetchAPI(API.tasks);
        updateTasksDisplay(tasks);
    } catch (error) {
        console.error('Error loading tasks:', error);
    }
}

function updateTasksDisplay(tasks) {
    const container = document.getElementById('my-tasks');
    
    if (!tasks || tasks.length === 0) {
        container.innerHTML = '<div class="text-center py-4">No tasks found</div>';
        return;
    }
    
    let html = '';
    
    tasks.forEach(task => {
        const priorityBadge = getPriorityBadge(task.priority);
        const statusClass = task.status === 'completed' ? 'bg-gray-50' : getPriorityBgClass(task.priority);
        
        html += `
        <div class="flex items-start justify-between p-3 ${statusClass} border border-gray-200 rounded-lg">
            <div class="flex items-start flex-grow">
                <input type="checkbox" class="mt-1 mr-3" ${task.status === 'completed' ? 'checked' : ''} data-task-id="${task.id}" onchange="toggleTaskCompletion(this)">
                <div class="flex-grow">
                    <div class="flex justify-between">
                        <h3 class="text-base font-medium text-gray-800">${task.title}</h3>
                        <span>${priorityBadge}</span>
                    </div>
                    <p class="text-sm text-gray-600 mt-1">${task.description || 'No description'}</p>
                    <div class="flex items-center mt-2 text-xs text-gray-500">
                        <span class="mr-3"><i class="far fa-calendar mr-1"></i> Due: ${formatDate(task.due_date) || 'No due date'}</span>
                        ${task.client_name ? `<span><i class="far fa-building mr-1"></i> Client: ${task.client_name}</span>` : ''}
                        ${task.assignee_name && task.assignee_id !== currentUser.id ? `<span class="ml-3"><i class="far fa-user mr-1"></i> Assigned to: ${task.assignee_name}</span>` : ''}
                    </div>
                </div>
            </div>
            <div class="ml-4 flex">
                <button class="text-gray-500 hover:text-gray-700" onclick="viewTask(${task.id})"><i class="fas fa-ellipsis-v"></i></button>
            </div>
        </div>
        `;
    });
    
    container.innerHTML = html;
    document.getElementById('tasks-count').textContent = `Showing ${tasks.length} tasks`;
}
function getPriorityBgClass(priority) {
    switch (priority) {
        case 'high': return 'bg-red-50'; 
        case 'medium': return 'bg-yellow-50'; 
        case 'low': return 'bg-blue-50'; 
        default: return 'bg-gray-50';
    }
}

async function loadTaskStats() {
    try {
        const stats = await fetchAPI(API.taskStats);
        
        // Update task statistics
        const completionRate = stats.completion_rate.toFixed(0);
        document.getElementById('task-completion-rate').textContent = `${completionRate}%`;
        document.getElementById('task-progress').style.width = `${completionRate}%`;
        
        // Update priority counts
        document.getElementById('high-priority-count').textContent = stats.tasks_by_priority.high || 0;
        document.getElementById('medium-priority-count').textContent = stats.tasks_by_priority.medium || 0;
        document.getElementById('low-priority-count').textContent = stats.tasks_by_priority.low || 0;
        document.getElementById('completed-count').textContent = stats.completed_tasks || 0;
        
    } catch (error) {
        console.error('Error loading task stats:', error);
    }
}

async function loadAssignedTasks() {
    try {
        const tasks = await fetchAPI(API.tasks + '?assigned_to_me=true&status=in_progress,pending');
        updateAssignedTasksDisplay(tasks);
    } catch (error) {
        console.error('Error loading assigned tasks:', error);
    }
}

function updateAssignedTasksDisplay(tasks) {
    const container = document.getElementById('assigned-tasks');
    
    if (!tasks || tasks.length === 0) {
        container.innerHTML = '<div class="text-center py-4">No tasks assigned to you</div>';
        document.getElementById('new-assignments-badge').textContent = '0';
        return;
    }
    
    let html = '';
    
    tasks.forEach(task => {
        const priorityBadge = getPriorityBadge(task.priority);
        
        html += `
        <div class="flex items-center justify-between">
            <div class="flex items-center">
                <input type="checkbox" class="mr-3" ${task.status === 'completed' ? 'checked' : ''} data-task-id="${task.id}" onchange="toggleTaskCompletion(this)">
                <div>
                    <p class="text-sm font-medium">${task.title}</p>
                    <p class="text-xs text-gray-500">Due: ${formatDate(task.due_date)}</p>
                </div>
            </div>
            <span>${priorityBadge}</span>
        </div>
        `;
    });
    
    container.innerHTML = html;
    document.getElementById('new-assignments-badge').textContent = tasks.length;
}

async function loadUpcomingDeadlines() {
    try {
        // Get tasks with deadlines in the next 7 days
        const today = new Date();
        const nextWeek = new Date();
        nextWeek.setDate(today.getDate() + 7);
        
        const tasks = await fetchAPI(`${API.tasks}?due_after=${today.toISOString().split('T')[0]}&due_before=${nextWeek.toISOString().split('T')[0]}&status=pending,in_progress`);
        updateUpcomingDeadlinesDisplay(tasks);
    } catch (error) {
        console.error('Error loading upcoming deadlines:', error);
    }
}

function updateUpcomingDeadlinesDisplay(tasks) {
    const container = document.getElementById('upcoming-deadlines');
    
    if (!tasks || tasks.length === 0) {
        container.innerHTML = '<div class="text-center py-4">No upcoming deadlines</div>';
        return;
    }
    
    // Sort by due date (ascending)
    const sortedTasks = [...tasks].sort((a, b) => new Date(a.due_date) - new Date(b.due_date));
    
    let html = '';
    
    sortedTasks.forEach(task => {
        const dueDate = new Date(task.due_date);
        const today = new Date();
        
        // Check if due date is today
        const isToday = dueDate.getDate() === today.getDate() &&
                       dueDate.getMonth() === today.getMonth() &&
                       dueDate.getFullYear() === today.getFullYear();
        
        // Check if due date is tomorrow
        const tomorrow = new Date();
        tomorrow.setDate(today.getDate() + 1);
        const isTomorrow = dueDate.getDate() === tomorrow.getDate() &&
                          dueDate.getMonth() === tomorrow.getMonth() &&
                          dueDate.getFullYear() === tomorrow.getFullYear();
        
        let dueDateText = formatDate(task.due_date);
        if (isToday) dueDateText = 'Today';
        if (isTomorrow) dueDateText = 'Tomorrow';
        
        html += `
        <div class="flex items-center justify-between">
            <div>
                <p class="text-sm font-medium">${task.title}</p>
                <p class="text-xs text-gray-500">${dueDateText}</p>
            </div>
            <span class="text-xs ${isToday ? 'text-red-600 font-bold' : 'text-gray-500'}">${formatDate(task.due_date)}</span>
        </div>
        `;
    });
    
    container.innerHTML = html;
}

async function viewTask(taskId) {
    try {
        const task = await fetchAPI(`${API.tasks}/${taskId}`);
        
        // Create modal content
        const modalContent = `
        <div class="flex justify-between items-center mb-4">
            <h2 class="text-xl font-bold text-gray-800">Task Details</h2>
            <button class="text-gray-500 hover:text-gray-700 close-modal" data-modal="task-detail-modal">
                <i class="fas fa-times"></i>
            </button>
        </div>
        
        <div class="space-y-4">
            <div class="flex justify-between items-start">
                <div>
                    <h3 class="text-lg font-semibold">${task.title}</h3>
                    <p class="text-sm text-gray-500">Created by ${task.owner_name}</p>
                </div>
                <div class="flex space-x-2">
                    <span>${getPriorityBadge(task.priority)}</span>
                    <span>${getStatusBadge(task.status, 'task')}</span>
                </div>
            </div>
            
            <div class="bg-gray-50 p-4 rounded-lg">
                <p class="text-gray-700">${task.description || 'No description provided.'}</p>
            </div>
            
            <div class="grid grid-cols-2 gap-4">
                <div>
                    <p class="text-sm text-gray-500">Due Date</p>
                    <p class="font-medium">${formatDate(task.due_date)}</p>
                </div>
                <div>
                    <p class="text-sm text-gray-500">Category</p>
                    <p class="font-medium">${task.category ? task.category.charAt(0).toUpperCase() + task.category.slice(1) : 'Uncategorized'}</p>
                </div>
                <div>
                    <p class="text-sm text-gray-500">Assigned To</p>
                    <p class="font-medium">${task.assignee_name || 'Unassigned'}</p>
                </div>
                ${task.client_name ? `
                <div>
                    <p class="text-sm text-gray-500">Client</p>
                    <p class="font-medium">${task.client_name}</p>
                </div>
                ` : ''}
            </div>
            
            <div>
                <p class="text-sm text-gray-500">Completion</p>
                <div class="flex items-center mt-1">
                    <div class="flex-grow mr-3">
                        <div class="progress">
                            <div class="progress-bar bg-green-500" style="width: ${task.completion_percentage}%"></div>
                        </div>
                    </div>
                    <span class="text-sm font-medium">${task.completion_percentage}%</span>
                </div>
            </div>
            
            <div class="flex justify-end space-x-3 mt-6">
                ${getTaskActionButtons(task)}
                <button class="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 close-modal" data-modal="task-detail-modal">
                    Close
                </button>
            </div>
        </div>
        `;
        
        // Update modal and show it
        const modal = document.getElementById('task-detail-modal');
        modal.querySelector('.modal-content').innerHTML = modalContent;
        modal.style.display = 'block';
        
        // Setup close button
        modal.querySelector('.close-modal').addEventListener('click', function() {
            modal.style.display = 'none';
        });
        
    } catch (error) {
        console.error('Error fetching task details:', error);
    }
}

function getTaskActionButtons(task) {
    let buttons = '';
    
    // Edit button for owners or admins
    if (task.owner_id === currentUser.id || currentUser.role === 'admin' || currentUser.role === 'manager') {
        buttons += `
        <button class="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700" onclick="editTask(${task.id})">
            Edit
        </button>
        `;
    }
    
    // Complete button for task assignees or owners
    if ((task.assignee_id === currentUser.id || task.owner_id === currentUser.id) && task.status !== 'completed') {
        buttons += `
        <button class="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700" onclick="completeTask(${task.id})">
            Mark Complete
        </button>
        `;
    }
    
    // Assign button for managers/admins or owner
    if (currentUser.role === 'admin' || currentUser.role === 'manager' || task.owner_id === currentUser.id) {
        buttons += `
        <button class="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700" onclick="assignTask(${task.id})">
            Assign
        </button>
        `;
    }
    
    return buttons;
}

async function toggleTaskCompletion(checkbox) {
    const taskId = checkbox.getAttribute('data-task-id');
    const isCompleted = checkbox.checked;
    
    try {
        await fetchAPI(`${API.tasks}/${taskId}/complete`, {
            method: 'POST',
            body: JSON.stringify({
                completion_percentage: isCompleted ? 100 : 0
            })
        });
        
        // Reload tasks to reflect change
        loadTasks();
        loadTaskStats();
        loadAssignedTasks();
        loadUpcomingDeadlines();
        
    } catch (error) {
        console.error('Error updating task completion:', error);
        // Revert checkbox state if failed
        checkbox.checked = !isCompleted;
    }
}

async function completeTask(taskId) {
    try {
        await fetchAPI(`${API.tasks}/${taskId}/complete`, {
            method: 'POST',
            body: JSON.stringify({
                completion_percentage: 100
            })
        });
        
        alert('Task marked as complete');
        
        // Close modal
        document.getElementById('task-detail-modal').style.display = 'none';
        
        // Reload task data
        loadTasks();
        loadTaskStats();
        loadAssignedTasks();
        loadUpcomingDeadlines();
        
    } catch (error) {
        console.error('Error completing task:', error);
        alert('Failed to complete task: ' + error.message);
    }
}

async function editTask(taskId) {
    try {
        const task = await fetchAPI(`${API.tasks}/${taskId}`);
        
        // Populate form with task data
        document.getElementById('task-title').value = task.title;
        document.getElementById('task-description').value = task.description || '';
        document.getElementById('task-priority').value = task.priority;
        document.getElementById('task-due-date').value = task.due_date ? task.due_date.split('T')[0] : '';
        document.getElementById('task-category').value = task.category || 'other';
        document.getElementById('task-client').value = task.client_id || '';
        document.getElementById('task-assignee').value = task.assignee_id || '';
        
        // Show modal
        const modal = document.getElementById('add-task-modal');
        modal.querySelector('h2').textContent = 'Edit Task';
        document.getElementById('add-task-form').setAttribute('data-task-id', taskId);
        modal.style.display = 'block';
        
        // Close detail modal if open
        document.getElementById('task-detail-modal').style.display = 'none';
        
    } catch (error) {
        console.error('Error fetching task details:', error);
    }
}

async function assignTask(taskId) {
    // First get the list of users
    try {
        const users = await fetchAPI(API.users);
        const task = await fetchAPI(`${API.tasks}/${taskId}`);
        
        // Create a select dropdown of users
        let userOptions = users.map(user => 
            `<option value="${user.id}" ${task.assignee_id === user.id ? 'selected' : ''}>${user.full_name} (${user.role})</option>`
        ).join('');
        
        // Ask for assignee
        const assigneeId = prompt(`Select user to assign task to:\n\n${userOptions}`);
        if (!assigneeId) return; // User cancelled
        
        // Assign the task
        await fetchAPI(`${API.tasks}/${taskId}/assign`, {
            method: 'POST',
            body: JSON.stringify({
                assignee_id: parseInt(assigneeId)
            })
        });
        
        alert('Task assigned successfully');
        
        // Close modal if open
        document.getElementById('task-detail-modal').style.display = 'none';
        
        // Reload task data
        loadTasks();
        
    } catch (error) {
        console.error('Error assigning task:', error);
        alert('Failed to assign task: ' + error.message);
    }
}

function setupForms() {
    // User form submission
    document.getElementById('add-user-form').addEventListener('submit', async function(e) {
        e.preventDefault();
        
        const userId = this.getAttribute('data-user-id');
        const isEdit = !!userId;
        
        const formData = {
            full_name: document.getElementById('full-name').value,
            email: document.getElementById('user-email').value,
            role: document.getElementById('user-role-select').value
        };
        
        // Only include password if it's provided or it's a new user
        const password = document.getElementById('user-password').value;
        if (password || !isEdit) {
            formData.password = password;
        }
        
        try {
            if (isEdit) {
                // Update existing user
                await fetchAPI(`${API.users}/${userId}`, {
                    method: 'PUT',
                    body: JSON.stringify(formData)
                });
                alert('User updated successfully');
            } else {
                // Create new user
                await fetchAPI(API.users, {
                    method: 'POST',
                    body: JSON.stringify(formData)
                });
                alert('User created successfully');
            }
            
            // Close modal
            document.getElementById('add-user-modal').style.display = 'none';
            
            // Refresh user list
            loadUsers();
            
        } catch (error) {
            console.error('Error saving user:', error);
            alert('Failed to save user: ' + error.message);
        }
    });
    
    // Expense form submission
    document.getElementById('add-expense-form').addEventListener('submit', async function(e) {
        e.preventDefault();
        
        const expenseId = this.getAttribute('data-expense-id');
        const isEdit = !!expenseId;
        
        const formData = {
            description: document.getElementById('expense-description').value,
            amount: parseFloat(document.getElementById('expense-amount').value),
            date: document.getElementById('expense-date').value,
            category: document.getElementById('expense-category').value,
            notes: document.getElementById('expense-notes').value || null,
            client_id: document.getElementById('expense-client').value || null
        };
        
        try {
            if (isEdit) {
                // Update existing expense
                await fetchAPI(`${API.expenses}/${expenseId}`, {
                    method: 'PUT',
                    body: JSON.stringify(formData)
                });
                alert('Expense updated successfully');
            } else {
                // Create new expense
                await fetchAPI(API.expenses, {
                    method: 'POST',
                    body: JSON.stringify(formData)
                });
                alert('Expense submitted successfully');
            }
            
            // Close modal
            document.getElementById('add-expense-modal').style.display = 'none';
            
            // Refresh expense data
            loadExpenses();
            loadExpenseStats();
            
        } catch (error) {
            console.error('Error saving expense:', error);
            alert('Failed to save expense: ' + error.message);
        }
    });
    
    // Client form submission
    document.getElementById('add-client-form').addEventListener('submit', async function(e) {
        e.preventDefault();
        
        const clientId = this.getAttribute('data-client-id');
        const isEdit = !!clientId;
        
        const formData = {
            name: document.getElementById('client-name').value,
            location: document.getElementById('client-location').value,
            status: document.getElementById('client-status').value,
            service_plan: document.getElementById('client-plan').value,
            notes: document.getElementById('client-notes').value || null
        };
        
        try {
            if (isEdit) {
                // Update existing client
                await fetchAPI(`${API.clients}/${clientId}`, {
                    method: 'PUT',
                    body: JSON.stringify(formData)
                });
                alert('Client updated successfully');
            } else {
                // Create new client
                await fetchAPI(API.clients, {
                    method: 'POST',
                    body: JSON.stringify(formData)
                });
                alert('Client created successfully');
            }
            
            // Close modal
            document.getElementById('add-client-modal').style.display = 'none';
            
            // Refresh client data
            loadClients();
            
        } catch (error) {
            console.error('Error saving client:', error);
            alert('Failed to save client: ' + error.message);
        }
    });
    
    // Task form submission
    document.getElementById('add-task-form').addEventListener('submit', async function(e) {
        e.preventDefault();
        
        const taskId = this.getAttribute('data-task-id');
        const isEdit = !!taskId;
        
        const formData = {
            title: document.getElementById('task-title').value,
            description: document.getElementById('task-description').value || null,
            priority: document.getElementById('task-priority').value,
            due_date: document.getElementById('task-due-date').value,
            category: document.getElementById('task-category').value,
            client_id: document.getElementById('task-client').value || null,
            assignee_id: document.getElementById('task-assignee').value || null
        };
        
        try {
            if (isEdit) {
                // Update existing task
                await fetchAPI(`${API.tasks}/${taskId}`, {
                    method: 'PUT',
                    body: JSON.stringify(formData)
                });
                alert('Task updated successfully');
            } else {
                // Create new task
                await fetchAPI(API.tasks, {
                    method: 'POST',
                    body: JSON.stringify(formData)
                });
                alert('Task created successfully');
            }
            
            // Close modal
            document.getElementById('add-task-modal').style.display = 'none';
            
            // Refresh task data
            loadTasks();
            loadTaskStats();
            loadAssignedTasks();
            loadUpcomingDeadlines();
            
        } catch (error) {
            console.error('Error saving task:', error);
            alert('Failed to save task: ' + error.message);
        }
    });
    
    // Contact form submission
    document.getElementById('add-contact-form').addEventListener('submit', async function(e) {
        e.preventDefault();
        
        const contactId = this.getAttribute('data-contact-id');
        const isEdit = !!contactId;
        const clientId = document.getElementById('contact-client-id').value;
        
        const formData = {
            client_id: parseInt(clientId),
            name: document.getElementById('contact-name').value,
            role: document.getElementById('contact-role').value || null,
            department: document.getElementById('contact-department').value || null,
            email: document.getElementById('contact-email').value,
            phone: document.getElementById('contact-phone').value || null,
            preferred_contact: document.getElementById('contact-preferred').value,
            is_primary: document.getElementById('contact-primary').checked
        };
        
        try {
            if (isEdit) {
                // Update existing contact
                await fetchAPI(`${API.clients}/${clientId}/contacts/${contactId}`, {
                    method: 'PUT',
                    body: JSON.stringify(formData)
                });
                alert('Contact updated successfully');
            } else {
                // Create new contact
                await fetchAPI(`${API.clients}/${clientId}/contacts`, {
                    method: 'POST',
                    body: JSON.stringify(formData)
                });
                alert('Contact created successfully');
            }
            
            // Close modal
            document.getElementById('add-contact-modal').style.display = 'none';
            
            // Refresh client view
            viewClient(clientId);
            
        } catch (error) {
            console.error('Error saving contact:', error);
            alert('Failed to save contact: ' + error.message);
        }
    });
    
    // Service history form submission
    document.getElementById('add-service-history-form').addEventListener('submit', async function(e) {
        e.preventDefault();
        
        const historyId = this.getAttribute('data-history-id');
        const isEdit = !!historyId;
        const clientId = document.getElementById('service-history-client-id').value;
        
        const formData = {
            client_id: parseInt(clientId),
            event_type: document.getElementById('service-history-event-type').value,
            event_date: document.getElementById('service-history-date').value,
            description: document.getElementById('service-history-description').value,
            communication_channel: document.getElementById('service-history-communication').value || null
        };
        
        try {
            if (isEdit) {
                // Update existing history entry
                await fetchAPI(`${API.clients}/${clientId}/service-history/${historyId}`, {
                    method: 'PUT',
                    body: JSON.stringify(formData)
                });
                alert('Service history entry updated successfully');
            } else {
                // Create new history entry
                await fetchAPI(`${API.clients}/${clientId}/service-history`, {
                    method: 'POST',
                    body: JSON.stringify(formData)
                });
                alert('Service history entry created successfully');
            }
            
            // Close modal
            document.getElementById('add-service-history-modal').style.display = 'none';
            
            // Refresh client view
            viewClient(clientId);
            
        } catch (error) {
            console.error('Error saving service history:', error);
            alert('Failed to save service history: ' + error.message);
        }
    });
    
    // Technical doc form submission
    document.getElementById('add-technical-doc-form').addEventListener('submit', async function(e) {
        e.preventDefault();
        
        const docId = this.getAttribute('data-doc-id');
        const isEdit = !!docId;
        const clientId = document.getElementById('technical-doc-client-id').value;
        
        const formData = {
            client_id: parseInt(clientId),
            doc_type: document.getElementById('technical-doc-type').value,
            content: document.getElementById('technical-doc-content').value
        };
        
        try {
            if (isEdit) {
                // Update existing doc
                await fetchAPI(`${API.clients}/${clientId}/technical-docs/${docId}`, {
                    method: 'PUT',
                    body: JSON.stringify(formData)
                });
                alert('Technical document updated successfully');
            } else {
                // Create new doc
                await fetchAPI(`${API.clients}/${clientId}/technical-docs`, {
                    method: 'POST',
                    body: JSON.stringify(formData)
                });
                alert('Technical document created successfully');
            }
            
            // Close modal
            document.getElementById('add-technical-doc-modal').style.display = 'none';
            
            // Refresh client view
            viewClient(clientId);
            
        } catch (error) {
            console.error('Error saving technical document:', error);
            alert('Failed to save technical document: ' + error.message);
        }
    });
    
    // Quotation form submission
    document.getElementById('add-quotation-form').addEventListener('submit', async function(e) {
        e.preventDefault();
        
        const quotationId = this.getAttribute('data-quotation-id');
        const isEdit = !!quotationId;
        const clientId = document.getElementById('quotation-client-id').value;
        
        const formData = {
            client_id: parseInt(clientId),
            html_content: document.getElementById('quotation-html').value,
            status: document.getElementById('quotation-status').value
        };
        
        try {
            if (isEdit) {
                // Update existing quotation
                await fetchAPI(`${API.clients}/${clientId}/quotations/${quotationId}`, {
                    method: 'PUT',
                    body: JSON.stringify(formData)
                });
                alert('Quotation updated successfully');
            } else {
                // Create new quotation
                await fetchAPI(`${API.clients}/${clientId}/quotations`, {
                    method: 'POST',
                    body: JSON.stringify(formData)
                });
                alert('Quotation created successfully');
            }
            
            // Close modal
            document.getElementById('add-quotation-modal').style.display = 'none';
            
            // Refresh client view
            viewClient(clientId);
            
        } catch (error) {
            console.error('Error saving quotation:', error);
            alert('Failed to save quotation: ' + error.message);
        }
    });
}

function exportExpensesCSV() {
    // Get expense data
    fetchAPI(API.expenses)
        .then(expenses => {
            if (!expenses || expenses.length === 0) {
                alert('No expenses to export');
                return;
            }
            
            // Create CSV content
            const headers = ['ID', 'Description', 'Amount', 'Category', 'Date', 'Status', 'Submitted By', 'Approved By', 'Reimbursed By', 'Client', 'Notes'];
            
            let csv = headers.join(',') + '\n';
            
            expenses.forEach(expense => {
                const row = [
                    expense.id,
                    `"${expense.description.replace(/"/g, '""')}"`,
                    expense.amount,
                    expense.category,
                    expense.date,
                    expense.status,
                    `"${expense.submitter_name.replace(/"/g, '""')}"`,
                    expense.approver_name ? `"${expense.approver_name.replace(/"/g, '""')}"` : '',
                    expense.reimburser_name ? `"${expense.reimburser_name.replace(/"/g, '""')}"` : '',
                    expense.client_name ? `"${expense.client_name.replace(/"/g, '""')}"` : '',
                    expense.notes ? `"${expense.notes.replace(/"/g, '""')}"` : ''
                ];
                
                csv += row.join(',') + '\n';
            });
            
            // Create download link
            const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.setAttribute('href', url);
            link.setAttribute('download', `expenses_${new Date().toISOString().split('T')[0]}.csv`);
            link.style.visibility = 'hidden';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        })
        .catch(error => {
            console.error('Error exporting expenses:', error);
            alert('Failed to export expenses: ' + error.message);
        });
}

function logout() {
    // Clear local storage
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    
    // Redirect to login
    window.location.href = '/';
}

// Initialize application on DOM load
document.addEventListener('DOMContentLoaded', initApp);
