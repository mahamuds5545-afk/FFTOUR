// ==================== FIREBASE CONFIGURATION ====================
const firebaseConfig = {
    apiKey: "AIzaSyCN_MH6u2Bpo3bxfDC_dhC19U67LP8ZS_E",
    authDomain: "free-fire-22cac.firebaseapp.com",
    databaseURL: "https://free-fire-22cac-default-rtdb.firebaseio.com",
    projectId: "free-fire-22cac",
    storageBucket: "free-fire-22cac.firebasestorage.app",
    messagingSenderId: "554987602894",
    appId: "1:554987602894:web:51548645a15c0d1e8d619f",
    measurementId: "G-W2QYY1CQ8D"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const database = firebase.database();
const auth = firebase.auth();

// ==================== GLOBAL VARIABLES ====================
let currentUser = null;
let isLoggedIn = false;
let tournaments = [];
let userTransactions = [];
let systemSettings = {};
let userNotifications = [];

// ==================== INITIALIZATION ====================
document.addEventListener('DOMContentLoaded', function() {
    checkExistingLogin();
    loadSystemSettings();
    setupFirebaseListeners();
    
    // Withdraw modal event listeners
    const withdrawModal = document.getElementById('withdrawModal');
    if (withdrawModal) {
        withdrawModal.addEventListener('show.bs.modal', function() {
            if (currentUser) {
                document.getElementById('currentBalanceInModal').textContent = 
                    `৳${currentUser.balance || 0}`;
            }
        });
        
        // Real-time balance validation
        const withdrawAmountInput = document.getElementById('withdrawAmount');
        if (withdrawAmountInput) {
            withdrawAmountInput.addEventListener('input', function() {
                const amount = parseInt(this.value) || 0;
                const currentBalance = currentUser ? currentUser.balance : 0;
                const submitBtn = this.closest('.modal-content').querySelector('.btn-success');
                
                if (amount > currentBalance) {
                    this.classList.add('is-invalid');
                    if (submitBtn) submitBtn.disabled = true;
                } else {
                    this.classList.remove('is-invalid');
                    if (submitBtn) submitBtn.disabled = false;
                }
            });
        }
    }
});

// ==================== AUTHENTICATION SYSTEM ====================

// Check Existing Login
function checkExistingLogin() {
    const savedUserId = localStorage.getItem('ff_userId');
    const savedUsername = localStorage.getItem('ff_username');
    
    if (savedUserId && savedUsername) {
        autoLogin(savedUserId, savedUsername);
    }
}

// Auto Login
async function autoLogin(userId, username) {
    try {
        // First authenticate with Firebase
        const userCredential = await auth.signInAnonymously();
        
        // Load user data
        const userSnapshot = await database.ref('userProfiles/' + userId).once('value');
        
        if (userSnapshot.exists()) {
            const userData = userSnapshot.val();
            
            // Verify username matches
            if (userData.username === username) {
                currentUser = {
                    uid: userId,
                    username: userData.username,
                    name: userData.name,
                    ffid: userData.ffid,
                    balance: userData.balance || 0,
                    kills: userData.kills || 0,
                    wins: userData.wins || 0,
                    joinDate: userData.joinDate || new Date().toISOString()
                };
                
                isLoggedIn = true;
                showUserDashboard();
                updateUserUI();
                showSuccess('Welcome back!');
            } else {
                localStorage.removeItem('ff_userId');
                localStorage.removeItem('ff_username');
            }
        }
    } catch (error) {
        console.error('Auto login failed:', error);
        localStorage.removeItem('ff_userId');
        localStorage.removeItem('ff_username');
    }
}

// Register User
async function registerUser() {
    const name = document.getElementById('regName').value.trim();
    const username = document.getElementById('regUsername').value.trim();
    const password = document.getElementById('regPassword').value.trim();
    const ffid = document.getElementById('regFFID').value.trim();

    if (!name || !username || !password || !ffid) {
        showError('Please fill all fields');
        return;
    }

    // Validate username (only letters, numbers, underscore)
    if (!/^[a-zA-Z0-9_]{3,20}$/.test(username)) {
        showError('Username must be 3-20 characters (letters, numbers, underscore only)');
        return;
    }

    try {
        // 1. Check if username already exists
        const usernameRef = database.ref('usernameIndex/' + username);
        const usernameSnapshot = await usernameRef.once('value');
        
        if (usernameSnapshot.exists()) {
            throw new Error('Username already taken');
        }

        // 2. Create anonymous authentication
        const userCredential = await auth.signInAnonymously();
        const user = userCredential.user;
        const userId = user.uid;

        // 3. Prepare user data
        const userProfile = {
            name: name,
            username: username,
            password: password, // In production, hash this password
            ffid: ffid,
            balance: 0,
            kills: 0,
            wins: 0,
            matches: 0,
            joinDate: new Date().toISOString(),
            createdAt: Date.now(),
            lastLogin: Date.now()
        };

        // 4. Save data to two places simultaneously
        const updates = {};
        updates['userProfiles/' + userId] = userProfile;
        updates['usernameIndex/' + username] = userId;

        await database.ref().update(updates);

        // 5. Set current user
        currentUser = {
            uid: userId,
            username: username,
            name: name,
            ffid: ffid,
            balance: 0,
            kills: 0,
            wins: 0
        };
        
        isLoggedIn = true;

        // 6. Save to localStorage
        localStorage.setItem('ff_userId', userId);
        localStorage.setItem('ff_username', username);
        localStorage.setItem('ff_name', name);

        // 7. Update UI
        showUserDashboard();
        updateUserUI();

        // 8. Close modal and show success
        const modalElement = document.getElementById('loginModal');
        const modal = bootstrap.Modal.getInstance(modalElement);
        if (modal) modal.hide();

        showSuccess('Registration successful! Welcome to FF Tournament!');

    } catch (error) {
        console.error('Registration error:', error);
        showError('Registration failed: ' + error.message);
        
        // Sign out if authentication was created
        if (auth.currentUser) {
            await auth.signOut();
        }
    }
}

// User Login
async function userLogin() {
    const username = document.getElementById('loginUsername').value.trim();
    const password = document.getElementById('loginPassword').value.trim();
    const rememberMe = document.getElementById('rememberMe').checked;

    if (!username || !password) {
        showError('Please enter username and password');
        return;
    }

    try {
        // 1. Get userId from usernameIndex
        const usernameRef = database.ref('usernameIndex/' + username);
        const usernameSnapshot = await usernameRef.once('value');
        
        if (!usernameSnapshot.exists()) {
            throw new Error('User not found');
        }
        
        const userId = usernameSnapshot.val();

        // 2. Get user profile
        const userProfileRef = database.ref('userProfiles/' + userId);
        const userSnapshot = await userProfileRef.once('value');
        
        if (!userSnapshot.exists()) {
            throw new Error('User profile not found');
        }
        
        const userData = userSnapshot.val();

        // 3. Verify password
        if (userData.password !== password) {
            throw new Error('Invalid password');
        }

        // 4. Authenticate with Firebase
        const userCredential = await auth.signInAnonymously();
        
        // 5. Update last login
        await userProfileRef.update({
            lastLogin: Date.now()
        });

        // 6. Set current user
        currentUser = {
            uid: userId,
            username: userData.username,
            name: userData.name,
            ffid: userData.ffid,
            balance: userData.balance || 0,
            kills: userData.kills || 0,
            wins: userData.wins || 0,
            joinDate: userData.joinDate
        };
        
        isLoggedIn = true;

        // 7. Save to localStorage if remember me is checked
        if (rememberMe) {
            localStorage.setItem('ff_userId', userId);
            localStorage.setItem('ff_username', username);
            localStorage.setItem('ff_name', userData.name);
        }

        // 8. Update UI
        showUserDashboard();
        updateUserUI();

        // 9. Close modal
        const modalElement = document.getElementById('loginModal');
        const modal = bootstrap.Modal.getInstance(modalElement);
        if (modal) modal.hide();

        showSuccess('Login successful! Welcome back!');

    } catch (error) {
        console.error('Login error:', error);
        showError('Login failed: ' + error.message);
    }
}

// Show User Dashboard
function showUserDashboard() {
    document.getElementById('guestView').classList.add('d-none');
    document.getElementById('userDashboard').classList.remove('d-none');
    document.getElementById('userBalanceCard').classList.remove('d-none');
    document.getElementById('loggedInUser').classList.remove('d-none');
    document.getElementById('loginBtn').classList.add('d-none');
    document.getElementById('floatingWithdrawBtn').classList.remove('d-none');
    
    showSection('home');
}

// Logout
function logout() {
    auth.signOut().then(() => {
        currentUser = null;
        isLoggedIn = false;
        
        // Clear localStorage
        localStorage.removeItem('ff_userId');
        localStorage.removeItem('ff_username');
        localStorage.removeItem('ff_name');
        
        // Reset UI
        document.getElementById('guestView').classList.remove('d-none');
        document.getElementById('userDashboard').classList.add('d-none');
        document.getElementById('userBalanceCard').classList.add('d-none');
        document.getElementById('loggedInUser').classList.add('d-none');
        document.getElementById('loginBtn').classList.remove('d-none');
        document.getElementById('floatingWithdrawBtn').classList.add('d-none');
        
        showSection('home');
        showSuccess('Logged out successfully');
    }).catch((error) => {
        showError('Logout error: ' + error.message);
    });
}

// ==================== FIREBASE LISTENERS ====================

function setupFirebaseListeners() {
    // Listen for notices
    database.ref('notices').on('value', (snapshot) => {
        if (snapshot.exists()) {
            let noticeText = '';
            snapshot.forEach((child) => {
                const notice = child.val();
                if (notice.active) {
                    noticeText += ' 📢 ' + notice.message + ' | ';
                }
            });
            if (noticeText) {
                document.getElementById('noticeMarquee').innerHTML = noticeText;
            }
        }
    });
    
    // Listen for tournaments
    database.ref('tournaments').on('value', (snapshot) => {
        if (snapshot.exists()) {
            tournaments = [];
            snapshot.forEach((child) => {
                const tournament = child.val();
                tournament.id = child.key;
                tournaments.push(tournament);
            });
            
            // Update UI if user is logged in
            if (isLoggedIn) {
                displayTournaments();
                displayLiveTournament();
                displayUpcomingTournaments();
                displayActiveTournaments();
            }
        }
    });
    
    // Listen for user updates
    if (isLoggedIn && currentUser) {
        database.ref('userProfiles/' + currentUser.uid).on('value', (snapshot) => {
            if (snapshot.exists()) {
                const userData = snapshot.val();
                currentUser.balance = userData.balance || 0;
                currentUser.kills = userData.kills || 0;
                currentUser.wins = userData.wins || 0;
                updateUserUI();
                
                // Load transactions
                if (userData.transactions) {
                    userTransactions = [];
                    Object.keys(userData.transactions).forEach(key => {
                        const transaction = userData.transactions[key];
                        transaction.id = key;
                        userTransactions.push(transaction);
                    });
                    
                    userTransactions.sort((a, b) => b.timestamp - a.timestamp);
                    
                    if (!document.getElementById('historySection').classList.contains('d-none')) {
                        displayTransactions(userTransactions);
                    }
                }
            }
        });
    }
}

// ==================== USER UI FUNCTIONS ====================

// Update User UI
function updateUserUI() {
    if (!currentUser) return;
    
    // Update balance in navigation
    const userBalanceElement = document.getElementById('userBalance');
    if (userBalanceElement) {
        userBalanceElement.textContent = currentUser.balance || 0;
    }
    
    // Update profile card
    const profileCard = document.getElementById('userProfileCard');
    if (profileCard) {
        profileCard.innerHTML = `
            <img src="https://cdn-icons-png.flaticon.com/512/3135/3135715.png" alt="User" class="user-avatar mb-2">
            <h6>${currentUser.name || currentUser.username}</h6>
            <p class="small text-muted mb-2">FF ID: <span class="text-warning">${currentUser.ffid || 'N/A'}</span></p>
            <div class="d-flex justify-content-around">
                <div>
                    <small class="text-warning">Balance</small>
                    <p class="mb-0 ${currentUser.balance < 200 ? 'text-danger' : 'text-success'}">
                        ৳${currentUser.balance || 0}
                    </p>
                </div>
                <div>
                    <small class="text-warning">Kills</small>
                    <p class="mb-0">${currentUser.kills || 0}</p>
                </div>
                <div>
                    <small class="text-success">Wins</small>
                    <p class="mb-0">${currentUser.wins || 0}</p>
                </div>
            </div>
        `;
    }
    
    // Update floating withdraw button state
    const floatingBtn = document.getElementById('floatingWithdrawBtn');
    if (floatingBtn) {
        if (currentUser.balance < 200) {
            floatingBtn.disabled = true;
            floatingBtn.title = `Minimum ৳200 required (Your balance: ৳${currentUser.balance})`;
        } else {
            floatingBtn.disabled = false;
            floatingBtn.title = 'Withdraw Balance';
        }
    }
}

// ==================== WITHDRAWAL SYSTEM ====================

// Show Withdraw Modal
function showWithdrawModal() {
    if (!isLoggedIn) {
        showError('Please login first');
        return;
    }
    
    const minWithdrawal = systemSettings.minWithdrawal || 200;
    document.getElementById('withdrawAmount').min = minWithdrawal;
    document.getElementById('withdrawAmount').placeholder = `Minimum: ৳${minWithdrawal}`;
    
    // Show current balance in modal
    document.getElementById('currentBalanceInModal').textContent = 
        `৳${currentUser.balance || 0}`;
    
    const modal = new bootstrap.Modal(document.getElementById('withdrawModal'));
    modal.show();
}

// Submit Withdrawal Request
async function submitWithdrawRequest() {
    if (!isLoggedIn) {
        showError('Please login first');
        return;
    }
    
    const amount = parseInt(document.getElementById('withdrawAmount').value);
    const method = document.getElementById('withdrawMethod').value;
    const accountNumber = document.getElementById('withdrawAccountNumber').value.trim();
    const minWithdrawal = systemSettings.minWithdrawal || 200;
    
    // Validation
    if (!amount || amount < minWithdrawal) {
        showError(`Minimum withdrawal amount is ৳${minWithdrawal}`);
        return;
    }
    
    if (!accountNumber) {
        showError('Please enter your account number');
        return;
    }
    
    if (accountNumber.length < 11) {
        showError('Please enter a valid account number (at least 11 digits)');
        return;
    }
    
    if (currentUser.balance < amount) {
        showError(`Insufficient balance! Your balance is ৳${currentUser.balance}`);
        return;
    }
    
    // Generate unique request ID
    const requestId = 'withdraw_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    
    // Create withdrawal data
    const withdrawData = {
        username: currentUser.username,
        userId: currentUser.uid,
        name: currentUser.name || currentUser.username,
        amount: amount,
        method: method,
        accountNumber: accountNumber,
        status: 'pending',
        timestamp: Date.now(),
        userBalanceBefore: currentUser.balance,
        userBalanceAfter: currentUser.balance - amount
    };
    
    // Show loading
    const withdrawBtn = document.querySelector('#withdrawModal .btn-success');
    const originalText = withdrawBtn.innerHTML;
    withdrawBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processing...';
    withdrawBtn.disabled = true;
    
    try {
        // Use Firebase transaction for data consistency
        const userRef = database.ref('userProfiles/' + currentUser.uid);
        
        const transactionResult = await userRef.transaction((currentData) => {
            if (currentData) {
                // Check balance again
                if (currentData.balance < amount) {
                    throw new Error('Insufficient balance');
                }
                
                // Deduct balance
                currentData.balance -= amount;
                
                // Add transaction to history
                if (!currentData.transactions) {
                    currentData.transactions = {};
                }
                
                currentData.transactions[requestId] = {
                    type: 'withdrawal_request',
                    amount: -amount,
                    status: 'pending',
                    timestamp: Date.now(),
                    method: method,
                    accountNumber: accountNumber,
                    note: 'Withdrawal request submitted'
                };
                
                return currentData;
            }
            return currentData;
        });
        
        if (transactionResult.committed) {
            // Save withdrawal request
            await database.ref(`withdrawRequests/${requestId}`).set(withdrawData);
            
            // Update current user object
            currentUser.balance -= amount;
            
            // Update UI
            updateUserUI();
            
            // Clear form and close modal
            document.getElementById('withdrawAmount').value = '';
            document.getElementById('withdrawAccountNumber').value = '';
            
            const modalElement = document.getElementById('withdrawModal');
            const modal = bootstrap.Modal.getInstance(modalElement);
            if (modal) modal.hide();
            
            // Send admin notification
            sendWithdrawalNotificationToAdmin(requestId, amount);
            
            showSuccess(
                `✅ Withdrawal request of ৳${amount} submitted successfully!<br>` +
                `Balance deducted: ৳${amount}<br>` +
                `New balance: ৳${currentUser.balance}<br>` +
                `Admin will process payment within 24 hours.`
            );
        } else {
            throw new Error('Transaction failed');
        }
    } catch (error) {
        console.error('Withdrawal error:', error);
        showError('Failed to submit request: ' + error.message);
    } finally {
        // Reset button
        withdrawBtn.innerHTML = originalText;
        withdrawBtn.disabled = false;
    }
}

// Send notification to admin
function sendWithdrawalNotificationToAdmin(requestId, amount) {
    const notificationId = 'admin_notif_' + Date.now();
    const notificationData = {
        type: 'new_withdrawal',
        requestId: requestId,
        username: currentUser.username,
        amount: amount,
        timestamp: Date.now(),
        read: false
    };
    
    database.ref(`admin/notifications/${notificationId}`).set(notificationData)
        .catch(error => console.error('Failed to send admin notification:', error));
}

// ==================== HELPER FUNCTIONS ====================

function showSection(sectionName) {
    // Hide all sections
    document.querySelectorAll('#mainContent > section').forEach(section => {
        section.classList.add('d-none');
    });
    
    // Show selected section
    const section = document.getElementById(sectionName + 'Section');
    if (section) {
        section.classList.remove('d-none');
        
        // Load section data
        if (sectionName === 'tournaments' && isLoggedIn) {
            displayTournaments();
        } else if (sectionName === 'history' && isLoggedIn) {
            displayTransactions(userTransactions);
        } else if (sectionName === 'profile' && isLoggedIn) {
            loadProfileSection();
        }
    }
}

function loadSystemSettings() {
    database.ref('admin/settings').once('value')
        .then((snapshot) => {
            if (snapshot.exists()) {
                systemSettings = snapshot.val();
                if (systemSettings.minWithdrawal) {
                    document.getElementById('minWithdrawalText').textContent = 
                        `Minimum withdrawal: ৳${systemSettings.minWithdrawal}`;
                }
            }
        });
}

function showSuccess(message) {
    document.getElementById('successToastBody').innerHTML = message;
    const toast = new bootstrap.Toast(document.getElementById('successToast'));
    toast.show();
}

function showError(message) {
    document.getElementById('errorToastBody').textContent = message;
    const toast = new bootstrap.Toast(document.getElementById('errorToast'));
    toast.show();
}

// ==================== OTHER FUNCTIONS (from your original code) ====================
// Note: The following functions are included for completeness but may need adjustment
// based on your specific requirements

function showPaymentNumber() {
    const methodName = document.getElementById('paymentMethod').value;
    const infoDiv = document.getElementById('paymentNumberInfo');
    
    if (methodName) {
        const methodData = {
            'bkash': { number: '017XXXXXXXX', type: 'Personal' },
            'nagad': { number: '018XXXXXXXX', type: 'Personal' },
            'rocket': { number: '019XXXXXXXX', type: 'Personal' },
            'upay': { number: '015XXXXXXXX', type: 'Personal' }
        };
        
        if (methodData[methodName]) {
            document.getElementById('selectedMethodName').textContent = methodName;
            document.getElementById('paymentNumber').textContent = methodData[methodName].number;
            document.getElementById('paymentType').textContent = methodData[methodName].type;
            infoDiv.style.display = 'block';
        }
    } else {
        infoDiv.style.display = 'none';
    }
}

function submitRechargeRequest() {
    // Your recharge request implementation
    showError('Recharge function not implemented in this example');
}

function updateProfile() {
    // Your update profile implementation
    showError('Update profile function not implemented in this example');
}

// Make functions available globally
window.userLogin = userLogin;
window.registerUser = registerUser;
window.submitRechargeRequest = submitRechargeRequest;
window.updateProfile = updateProfile;
window.showSection = showSection;
window.logout = logout;
window.showWithdrawModal = showWithdrawModal;
window.submitWithdrawRequest = submitWithdrawRequest;
window.showPaymentNumber = showPaymentNumber;

// Note: Tournament related functions (displayTournaments, joinTournament, etc.)
// should be adapted to use the new userProfiles structure instead of users/{username}
