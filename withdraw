// Submit Withdrawal Request - CORRECTED VERSION
function submitWithdrawRequest() {
    if (!isLoggedIn) {
        showError('Please login first');
        return;
    }
    
    const amount = parseInt(document.getElementById('withdrawAmount').value);
    const method = document.getElementById('withdrawMethod').value;
    const accountNumber = document.getElementById('withdrawAccountNumber').value.trim();
    const minWithdrawal = systemSettings.minWithdrawal || 200;
    
    if (!amount || amount < minWithdrawal) {
        showError(`Minimum withdrawal amount is ৳${minWithdrawal}`);
        return;
    }
    
    if (!accountNumber) {
        showError('Please enter your account number');
        return;
    }
    
    if (currentUser.balance < amount) {
        showError('Insufficient balance');
        return;
    }
    
    // Generate unique request ID
    const requestId = 'withdraw_' + Date.now();
    
    // Create withdrawal data
    const withdrawData = {
        username: currentUser.username,
        amount: amount,
        method: method,
        accountNumber: accountNumber,
        status: 'pending',
        timestamp: Date.now(),
        name: currentUser.name || currentUser.username
    };
    
    // 1. First deduct the balance from user account
    const newBalance = currentUser.balance - amount;
    
    database.ref(`users/${currentUser.username}/balance`).set(newBalance)
        .then(() => {
            // 2. Save the withdrawal request
            return database.ref(`withdrawRequests/${requestId}`).set(withdrawData);
        })
        .then(() => {
            // 3. Add transaction to user's history
            return database.ref(`users/${currentUser.username}/transactions/${requestId}`).set({
                type: 'withdrawal_request',
                amount: -amount,
                status: 'pending',
                timestamp: Date.now(),
                method: method,
                accountNumber: accountNumber,
                note: 'Withdrawal request submitted'
            });
        })
        .then(() => {
            // Update current user object
            currentUser.balance = newBalance;
            
            // Update UI
            updateUserUI();
            
            // Clear form
            document.getElementById('withdrawAmount').value = '';
            document.getElementById('withdrawAccountNumber').value = '';
            
            // Close modal
            const modalElement = document.getElementById('withdrawModal');
            const modal = bootstrap.Modal.getInstance(modalElement);
            if (modal) modal.hide();
            
            showSuccess(`Withdrawal request of ৳${amount} submitted! Balance updated. Admin will process payment within 24 hours.`);
        })
        .catch((error) => {
            showError('Failed to submit request: ' + error.message);
        });
}
