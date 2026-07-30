interface LightboxPhoto {
  src: string;
  alt: string;
  caption: string;
}

export function setupPhotoLightboxes() {
  document.querySelectorAll<HTMLElement>('[data-photo-gallery]').forEach((gallery) => {
    if (gallery.dataset.lightboxReady) return;
    gallery.dataset.lightboxReady = 'true';

    const dialog = gallery.querySelector<HTMLDialogElement>('[data-photo-dialog]');
    const image = dialog?.querySelector<HTMLImageElement>('[data-dialog-image]');
    const caption = dialog?.querySelector<HTMLElement>('[data-dialog-caption]');
    const counter = dialog?.querySelector<HTMLElement>('[data-dialog-counter]');
    const previous = dialog?.querySelector<HTMLButtonElement>('[data-dialog-previous]');
    const next = dialog?.querySelector<HTMLButtonElement>('[data-dialog-next]');
    if (!dialog || !image) return;

    let photos: LightboxPhoto[] = [];
    try {
      photos = JSON.parse(gallery.dataset.photoItems ?? '[]');
    } catch {
      return;
    }
    if (photos.length === 0) return;

    let activeIndex = 0;
    let touchStartX = 0;
    let touchStartY = 0;
    let trackingTouch = false;
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

    const preloadAdjacent = () => {
      if (photos.length < 2) return;
      for (const index of [(activeIndex - 1 + photos.length) % photos.length, (activeIndex + 1) % photos.length]) {
        const preload = new Image();
        preload.src = photos[index].src;
      }
    };

    const showPhoto = (index: number, direction = 0) => {
      activeIndex = (index + photos.length) % photos.length;
      const photo = photos[activeIndex];
      image.src = photo.src;
      image.alt = photo.alt;
      if (caption) caption.textContent = photo.caption;
      if (counter) counter.textContent = `${activeIndex + 1} / ${photos.length}`;
      if (direction && !reducedMotion.matches) {
        image.animate([
          { opacity: .45, transform: `translateX(${direction * 12}px)` },
          { opacity: 1, transform: 'translateX(0)' },
        ], { duration: 180, easing: 'ease-out' });
      }
      preloadAdjacent();
    };

    const showPrevious = () => showPhoto(activeIndex - 1, -1);
    const showNext = () => showPhoto(activeIndex + 1, 1);
    const hasMultiple = photos.length > 1;
    if (previous) previous.hidden = !hasMultiple;
    if (next) next.hidden = !hasMultiple;

    gallery.querySelectorAll<HTMLButtonElement>('[data-photo-index]').forEach((button) => {
      button.addEventListener('click', () => {
        showPhoto(Number(button.dataset.photoIndex ?? 0));
        dialog.showModal();
      });
    });

    previous?.addEventListener('click', showPrevious);
    next?.addEventListener('click', showNext);
    dialog.querySelector<HTMLButtonElement>('[data-dialog-close]')?.addEventListener('click', () => dialog.close());
    dialog.addEventListener('click', (event) => {
      if (event.target === dialog) dialog.close();
    });
    dialog.addEventListener('keydown', (event) => {
      if (event.key === 'ArrowLeft' && hasMultiple) {
        event.preventDefault();
        showPrevious();
      } else if (event.key === 'ArrowRight' && hasMultiple) {
        event.preventDefault();
        showNext();
      }
    });
    dialog.addEventListener('touchstart', (event) => {
      if (event.touches.length !== 1) {
        trackingTouch = false;
        return;
      }
      trackingTouch = true;
      touchStartX = event.touches[0].clientX;
      touchStartY = event.touches[0].clientY;
    }, { passive: true });
    dialog.addEventListener('touchend', (event) => {
      if (!trackingTouch || !hasMultiple || event.changedTouches.length !== 1) return;
      trackingTouch = false;
      const deltaX = event.changedTouches[0].clientX - touchStartX;
      const deltaY = event.changedTouches[0].clientY - touchStartY;
      if (Math.abs(deltaX) < 45 || Math.abs(deltaX) <= Math.abs(deltaY) * 1.2) return;
      if (deltaX > 0) showPrevious();
      else showNext();
    }, { passive: true });
  });
}
