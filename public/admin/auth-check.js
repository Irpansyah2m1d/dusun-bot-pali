(function () {
    const token = localStorage.getItem('admin_token');
    if (!token) {
        // Redirect to login if not authenticated
        const currentPath = window.location.pathname;
        if (!currentPath.endsWith('admin.html')) {
            window.location.href = '/admin.html';
        }
    }
})();

function logout() {
    localStorage.removeItem('admin_token');
    localStorage.removeItem('admin_user');
    localStorage.removeItem('admin_tab');
    window.location.href = '/admin.html';
}
