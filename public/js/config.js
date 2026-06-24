window.SF = {
  // Работает на localhost и на хостинге (Render и т.д.), но не через file://
  isServer: location.protocol === 'http:' || location.protocol === 'https:',

  api(path) {
    return path;
  },

  authUrl() {
    return '/auth/google';
  },

  page(name) {
    return name;
  },

  fetch(url, options = {}) {
    const opts = { credentials: 'include', ...options };
    return window.fetch(this.api(url), opts);
  }
};

function setupAuthLinks() {
  document.querySelectorAll('[data-auth-link]').forEach(link => {
    if (!SF.isServer) {
      link.href = 'setup.html';
      link.addEventListener('click', (e) => {
        if (location.protocol === 'file:') {
          e.preventDefault();
          showToast('Запустите сервер: start.bat (нужен Node.js)', 'error');
        }
      });
    }
  });
}

document.addEventListener('DOMContentLoaded', setupAuthLinks);
