(function () {
    const pass = localStorage.getItem('admin_password');
    if (!pass) {
        // Redirect to login if not authenticated
        const currentPath = window.location.pathname;
        if (!currentPath.endsWith('admin.html')) {
            window.location.href = '/admin.html';
        }
    }
})();

function logout() {
    localStorage.removeItem('admin_password');
    localStorage.removeItem('admin_tab');
    window.location.href = '/admin.html';
}
