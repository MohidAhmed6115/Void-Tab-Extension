// VoidTab — background.js (Service Worker)

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'open_incognito') {
    chrome.windows.create({
      url: message.url,
      incognito: true
    });
  }
  return true;
});
