export function el(tag, attrs = {}, children = []) {
  const element = document.createElement(tag);

  for (const [key, value] of Object.entries(attrs)) {
    if (key === 'textContent') {
      element.textContent = value;
    } else if (key === 'className') {
      element.className = value;
    } else if (key.startsWith('on') && key.length > 2) {
      element.addEventListener(key.charAt(2).toLowerCase() + key.slice(3), value);
    } else {
      element.setAttribute(key, value);
    }
  }

  for (const child of children) {
    if (typeof child === 'string') {
      element.appendChild(document.createTextNode(child));
    } else if (child) {
      element.appendChild(child);
    }
  }

  return element;
}

export function favicon(favIconUrl) {
  const img = document.createElement('img');
  img.className = 'tab-favicon';
  img.src = favIconUrl || '';
  img.width = 12;
  img.height = 12;
  img.onerror = () => {
    img.style.background = '#444';
    img.removeAttribute('src');
  };
  return img;
}

export function faviconLg(favIconUrl) {
  const img = favicon(favIconUrl);
  img.className = 'snapshot-tab-favicon';
  img.width = 14;
  img.height = 14;
  return img;
}

export function clearChildren(element) {
  while (element.firstChild) {
    element.removeChild(element.firstChild);
  }
}
