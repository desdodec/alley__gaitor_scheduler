function updateHomeActions() {
  if (location.pathname !== '/') return;

  const operatorLink = document.querySelector('a[href="/operator"]');
  if (!operatorLink) return;

  operatorLink.textContent = 'RUN SESSIONS';
  operatorLink.setAttribute('href', '/sessions.html');
  operatorLink.removeAttribute('data-route');
}

updateHomeActions();

window.addEventListener('popstate', () => {
  queueMicrotask(updateHomeActions);
});

document.addEventListener('click', () => {
  queueMicrotask(updateHomeActions);
});
