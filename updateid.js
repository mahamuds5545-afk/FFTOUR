// Update User UI
function updateUserUI() {
    // Update balance in navigation
    document.getElementById('userBalance').textContent = currentUser.balance || 0;
    
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
                    <p class="mb-0 text-success">৳${currentUser.balance || 0}</p>
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
}
