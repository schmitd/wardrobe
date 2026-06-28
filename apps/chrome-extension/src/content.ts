const getProductImage = () => {
  const ogImage = document.querySelector<HTMLMetaElement>('meta[property="og:image"], meta[name="twitter:image"]');
  if (ogImage?.content) return ogImage.content;

  const images = [...document.images]
    .filter((image) => image.naturalWidth >= 240 && image.naturalHeight >= 240)
    .sort((a, b) => b.naturalWidth * b.naturalHeight - a.naturalWidth * a.naturalHeight);

  return images[0]?.currentSrc || images[0]?.src || "";
};

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type !== "WARDROBE_COLLECT_PRODUCT") return false;

  const description =
    document.querySelector<HTMLMetaElement>('meta[name="description"], meta[property="og:description"]')
      ?.content ?? "";

  sendResponse({
    title: document.title,
    pageUrl: location.href,
    imageUrl: getProductImage(),
    description,
  });

  return true;
});
