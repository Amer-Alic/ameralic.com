// Shared site chrome — nav + footer.
// Renders into [data-site-nav] and [data-site-footer] placeholders.
(function () {
  var path = window.location.pathname.replace(/\/index\.html$/, '/').toLowerCase();

  function isCurrent(match) {
    if (match === '/') return path === '/' || path.endsWith('/homepage.html');
    if (match === 'writing') return path.indexOf('blog') !== -1 || path.indexOf('work-that-matters') !== -1;
    return path.indexOf(match) !== -1;
  }

  function navHTML() {
    var links = [
      { href: 'Blog.html', label: 'Writing', match: 'writing' },
      { href: 'Projects.html', label: 'Projects', match: 'project' },
      { href: 'About.html', label: 'About', match: 'about' }
    ];
    var items = links.map(function (l) {
      var current = isCurrent(l.match) ? ' aria-current="page"' : '';
      return '<li><a href="' + l.href + '"' + current + '>' + l.label + '</a></li>';
    }).join('');
    return (
      '<nav class="nav" aria-label="Primary">' +
        '<div class="nav__inner">' +
          '<a href="index.html" class="nav__brand" aria-label="Home">AA</a>' +
          '<ul class="nav__links">' + items + '</ul>' +
        '</div>' +
      '</nav>'
    );
  }

  function footerHTML() {
    var year = new Date().getFullYear();
    return (
      '<footer>' +
        '<ul class="socials" aria-label="Social links">' +
          '<li><a href="https://github.com/Amer-Alic" aria-label="GitHub" title="GitHub">' +
            '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 .5C5.73.5.98 5.24.98 11.52c0 4.85 3.14 8.96 7.5 10.41.55.1.75-.24.75-.53 0-.26-.01-1.13-.02-2.05-3.05.66-3.7-1.3-3.7-1.3-.5-1.27-1.22-1.61-1.22-1.61-1-.68.08-.67.08-.67 1.1.08 1.68 1.13 1.68 1.13.98 1.68 2.57 1.2 3.2.92.1-.71.38-1.2.7-1.47-2.43-.28-4.99-1.22-4.99-5.42 0-1.2.43-2.18 1.13-2.95-.11-.28-.49-1.4.11-2.91 0 0 .93-.3 3.04 1.13a10.5 10.5 0 0 1 5.54 0c2.11-1.43 3.03-1.13 3.03-1.13.6 1.51.22 2.63.11 2.91.7.77 1.12 1.75 1.12 2.95 0 4.22-2.57 5.14-5.01 5.41.39.34.74 1 .74 2.03 0 1.47-.01 2.66-.01 3.02 0 .29.2.64.76.53 4.35-1.45 7.49-5.56 7.49-10.41C23.02 5.24 18.27.5 12 .5Z"/></svg>' +
          '</a></li>' +
          '<li><a href="https://x.com/AmerAlicTweets" aria-label="X" title="X">' +
            '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M18.244 2H21.5l-7.53 8.61L22.75 22H16l-5.27-6.9L4.7 22H1.44l8.06-9.22L1.25 2H8.19l4.76 6.29L18.244 2Zm-2.37 18h1.86L7.22 4H5.23l10.644 16Z"/></svg>' +
          '</a></li>' +
        '</ul>' +
        '<p class="colophon">&copy; ' + year + ' Amer Alić</p>' +
      '</footer>'
    );
  }

  function mount(selector, html) {
    var el = document.querySelector(selector);
    if (el) el.innerHTML = html;
  }

  function init() {
    mount('[data-site-nav]', navHTML());
    mount('[data-site-footer]', footerHTML());
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
