import type { PageAdapter, TargetSelectionSnapshot } from '../content/page-adapter.js';
import { KeyboardRouter } from '../content/keyboard.js';
import { RequestGovernor } from '../content/request-governor.js';
import { reducePanelAction } from '../core/actions.js';
import { Retry404 } from '../core/automation/retry-404.js';
import { Slideshow } from '../core/automation/slideshow.js';
import { createInitialPanelState, setAutomationState, setTargetState } from '../core/state.js';
import type { PanelAction, PanelState, TargetState } from '../core/types.js';
import { bumpUrlField } from '../core/url/rebuild-url.js';
import { collectUrlFields, selectDefaultField } from '../core/url/tokenize-fields.js';
import { parseUrl } from '../core/url/parse-url.js';
import { rebuildUrl } from '../core/url/rebuild-url.js';
import { applyImageUrl } from '../core/image/image-navigation.js';
import { renderPanel } from './render.js';

const ROOT_ID = 'image-trail-panel-root';
const STYLE_ID = 'image-trail-panel-style';
const STYLE_PATH = 'src/ui/styles/panel.css';

function toTargetState(snapshot: TargetSelectionSnapshot): TargetState {
  return {
    mode: snapshot.mode,
    picking: snapshot.picking,
    candidateCount: snapshot.candidateCount,
    selectedUrl: snapshot.selected?.url ?? null,
    selectedHandleId: snapshot.selected?.handleId ?? null,
    selectedDimensions: snapshot.selected ? `${snapshot.selected.width}×${snapshot.selected.height}` : null,
    message: snapshot.message,
  };
}

export class ImageTrailPanel {
  private root: HTMLElement | null = null;
  private state: PanelState = createInitialPanelState();
  private unsubscribeFromTarget: (() => void) | null = null;

  private readonly governor = new RequestGovernor();
  private readonly keyboard: KeyboardRouter;
  private readonly slideshow: Slideshow;
  private readonly retry: Retry404;

  constructor(private readonly pageAdapter: PageAdapter) {
    this.unsubscribeFromTarget = this.pageAdapter.subscribe((snapshot) => {
      this.state = setTargetState(this.state, toTargetState(snapshot));
      this.render();
    });

    this.keyboard = new KeyboardRouter((action) => this.handleKeyAction(action));

    this.slideshow = new Slideshow(
      (direction) => this.navigateBy(direction),
      (phase, count) => {
        this.state = setAutomationState(this.state, { slideshowPhase: phase, slideshowCount: count });
        this.render();
      },
    );

    this.retry = new Retry404(
      () => this.tryReloadCurrent(),
      (direction) => this.navigateBy(direction),
      (phase, attempt, max) => {
        this.state = setAutomationState(this.state, { retryPhase: phase, retriesUsed: attempt, retriesMax: max });
        this.render();
      },
    );
  }

  get visible(): boolean {
    return this.state.visible;
  }

  get statusMessage(): string {
    return this.state.message;
  }

  toggle(): PanelState {
    this.dispatch({ name: 'toggle-panel' });
    return this.state;
  }

  destroy(): void {
    this.state = reducePanelAction(this.state, { name: 'close-panel' });
    this.slideshow.destroy();
    this.retry.destroy();
    this.keyboard.disable();
    this.cleanupMountedElements();
  }

  private cleanupMountedElements(): void {
    this.pageAdapter.cleanup();
    document.getElementById(ROOT_ID)?.remove();
    document.getElementById(STYLE_ID)?.remove();
    this.root = null;
  }

  disconnect(): void {
    this.destroy();
    this.unsubscribeFromTarget?.();
    this.unsubscribeFromTarget = null;
  }

  private dispatch = (action: PanelAction): void => {
    if (action.name === 'start-target-picker') {
      this.state = reducePanelAction(this.state, action);
      this.pageAdapter.startPickMode();
      return;
    }

    if (action.name === 'stop-target-picker') {
      this.state = reducePanelAction(this.state, action);
      this.pageAdapter.stopPickMode();
      return;
    }

    if (action.name === 'slideshow-start') {
      this.state = reducePanelAction(this.state, action);
      this.slideshow.start();
      this.render();
      return;
    }

    if (action.name === 'slideshow-stop') {
      this.state = reducePanelAction(this.state, action);
      this.slideshow.stop();
      this.render();
      return;
    }

    if (action.name === 'slideshow-pause') {
      this.state = reducePanelAction(this.state, action);
      this.slideshow.pause();
      this.render();
      return;
    }

    if (action.name === 'slideshow-resume') {
      this.state = reducePanelAction(this.state, action);
      this.slideshow.resume();
      this.render();
      return;
    }

    if (action.name === 'retry-start') {
      this.state = reducePanelAction(this.state, action);
      this.retry.start();
      this.render();
      return;
    }

    if (action.name === 'retry-stop') {
      this.state = reducePanelAction(this.state, action);
      this.retry.stop();
      this.render();
      return;
    }

    if (action.name === 'stop-all') {
      this.slideshow.stop();
      this.retry.stop();
      this.state = reducePanelAction(this.state, action);
      this.render();
      return;
    }

    if (action.name === 'navigate-next') {
      this.navigateBy(1);
      return;
    }

    if (action.name === 'navigate-previous') {
      this.navigateBy(-1);
      return;
    }

    this.state = reducePanelAction(this.state, action);
    if (!this.state.visible) {
      this.slideshow.destroy();
      this.retry.destroy();
      this.keyboard.disable();
      this.cleanupMountedElements();
      return;
    }
    this.mount();
    this.keyboard.enable();
    this.pageAdapter.autoSelectSingleImage();
    this.render();
  };

  private handleKeyAction(action: string): void {
    switch (action) {
      case 'next':
        this.dispatch({ name: 'navigate-next' });
        break;
      case 'previous':
        this.dispatch({ name: 'navigate-previous' });
        break;
      case 'slideshow-toggle':
        if (this.slideshow.currentPhase === 'running') {
          this.dispatch({ name: 'slideshow-pause' });
        } else if (this.slideshow.currentPhase === 'paused') {
          this.dispatch({ name: 'slideshow-resume' });
        } else {
          this.dispatch({ name: 'slideshow-start' });
        }
        break;
      case 'stop':
        this.dispatch({ name: 'stop-all' });
        break;
      case 'panel-toggle':
        this.dispatch({ name: 'toggle-panel' });
        break;
      case 'retry':
        this.dispatch({ name: 'retry-start' });
        break;
      default:
        break;
    }
  }

  private navigateBy(delta: 1 | -1): void {
    const result = this.governor.request(() => {
      const snapshot = this.pageAdapter.getSnapshot();
      if (!snapshot.selected) return false;
      const image = document.querySelector<HTMLImageElement>(`[data-image-trail-handle="${snapshot.selected.handleId}"]`);
      if (!image) return false;
      const currentUrl = image.src;
      if (!currentUrl) return false;
      const model = parseUrl(currentUrl);
      const fields = collectUrlFields(model);
      const field = selectDefaultField(fields);
      if (!field) return false;
      const bumped = bumpUrlField(model, field, delta);
      const nextUrl = rebuildUrl(bumped);
      applyImageUrl(image, nextUrl);
      return true;
    });

    this.state = setAutomationState(this.state, {
      governorStatus: result.status === 'ok' ? 'ready' : result.status,
      requestsInLastMinute: this.governor.requestsInLastMinute(),
    });
    this.render();
  }

  private async tryReloadCurrent(): Promise<boolean> {
    const url = this.state.target.selectedUrl;
    if (!url) return false;
    return new Promise<boolean>((resolve) => {
      const snapshot = this.pageAdapter.getSnapshot();
      if (!snapshot.selected) {
        resolve(false);
        return;
      }
      const image = document.querySelector<HTMLImageElement>(`[data-image-trail-handle="${snapshot.selected.handleId}"]`);
      if (!image) {
        resolve(false);
        return;
      }
      const onLoad = () => { cleanup(); resolve(true); };
      const onError = () => { cleanup(); resolve(false); };
      const cleanup = () => { image.removeEventListener('load', onLoad); image.removeEventListener('error', onError); };
      image.addEventListener('load', onLoad, { once: true });
      image.addEventListener('error', onError, { once: true });
      image.src = url;
    });
  }

  private mount(): void {
    if (!this.root) {
      this.root = document.getElementById(ROOT_ID) ?? document.createElement('aside');
      this.root.id = ROOT_ID;
      this.root.className = 'image-trail-panel';
      this.root.setAttribute('role', 'dialog');
      this.root.setAttribute('aria-label', 'Image Trail panel');
      (document.body ?? document.documentElement).append(this.root);
    }

    if (!document.getElementById(STYLE_ID)) {
      const link = document.createElement('link');
      link.id = STYLE_ID;
      link.rel = 'stylesheet';
      link.href = chrome.runtime.getURL(STYLE_PATH);
      (document.head ?? document.documentElement).append(link);
    }
  }

  private render(): void {
    if (this.root) {
      renderPanel(
        { root: this.root, dispatch: this.dispatch, onPrevious: () => this.navigateBy(-1), onNext: () => this.navigateBy(1) },
        this.state,
      );
    }
  }
}
