// Keep the original tutorial text readable in Russian.
document.documentElement.lang = 'ru';
try { const k='fb-fairytales:settings'; const s=JSON.parse(localStorage.getItem(k)||'{}');s.lang='ru';localStorage.setItem(k,JSON.stringify(s)); } catch (_) {}
