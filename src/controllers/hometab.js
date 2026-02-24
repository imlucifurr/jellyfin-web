import * as userSettings from '../scripts/settings/userSettings';
import { getMovieHeroItems } from '../scripts/settings/webSettings';
import loading from '../components/loading/loading';
import focusManager from '../components/focusManager';
import { playbackManager } from '../components/playback/playbackmanager';
import homeSections from '../components/homesections/homesections';
import { ServerConnections } from 'lib/jellyfin-apiclient';
import escapeHtml from 'escape-html';
import globalize from 'lib/globalize';

import '../elements/emby-itemscontainer/emby-itemscontainer';

const HERO_IMAGE_DURATION_MS = 8000;

class HomeTab {
    constructor(view, params) {
        this.view = view;
        this.params = params;
        this.apiClient = ServerConnections.currentApiClient();
        this.heroContainer = ensureHeroContainer(view);
        this.heroClickHandler = onHeroClick.bind(this);
        this.onHeroVideoTimeUpdate = onHeroVideoTimeUpdate.bind(this);
        this.onHeroVideoMetadataLoaded = onHeroVideoMetadataLoaded.bind(this);
        this.onHeroVideoEnded = onHeroVideoEnded.bind(this);
        this.heroMuted = true;
        this.heroVideo = null;
        this.heroVolumeIconElement = null;
        this.heroQueueProgressElement = null;
        this.heroFallbackTimer = null;
        this.heroItems = [];
        this.activeHeroIndex = 0;
        this.heroItemId = null;
        this.sectionsContainer = view.querySelector('.sections');
        view.querySelector('.sections').addEventListener('settingschange', onHomeScreenSettingsChanged.bind(this));
    }
    onResume(options) {
        if (this.sectionsRendered) {
            const tasks = [];

            const sectionsContainer = this.sectionsContainer;

            if (sectionsContainer) {
                tasks.push(homeSections.resume(sectionsContainer, options));
            }

            if (this.heroRendered && !options?.refresh) {
                resumeHeroVideo(this);
            } else {
                tasks.push(this.loadMovieHero());
            }

            return Promise.all(tasks);
        }

        const tasks = [];

        loading.show();
        const view = this.view;
        const apiClient = this.apiClient;
        this.destroyHomeSections();
        this.sectionsRendered = true;
        tasks.push(this.loadMovieHero());

        tasks.push(apiClient.getCurrentUser()
            .then(user => homeSections.loadSections(view.querySelector('.sections'), apiClient, user, userSettings))
        );

        return Promise.all(tasks)
            .then(() => {
                if (options.autoFocus) {
                    focusManager.autoFocus(view);
                }
            }).catch(err => {
                console.error(err);
            }).finally(() => {
                loading.hide();
            });
    }

    loadMovieHero() {
        const container = this.heroContainer;
        if (!container) {
            return Promise.resolve();
        }

        return getMovieHeroItems().then(items => {
            const movieHeroItems = (Array.isArray(items) ? items : []).filter(isValidHeroItem);

            if (!movieHeroItems.length) {
                this.heroRendered = false;
                this.heroItems = [];
                this.activeHeroIndex = 0;
                this.heroItemId = null;
                this.heroVideo = null;
                this.heroVolumeIconElement = null;
                this.heroQueueProgressElement = null;
                clearHeroFallbackTimer(this);
                container.innerHTML = '';
                container.classList.add('hide');
                return;
            }

            this.heroItems = movieHeroItems;
            container.classList.remove('hide');
            renderHeroAtIndex(this, 0);
        }).catch(error => {
            console.error('Unable to render home movie hero', error);
        });
    }

    onPause() {
        const sectionsContainer = this.sectionsContainer;

        if (sectionsContainer) {
            homeSections.pause(sectionsContainer);
        }

        pauseHeroVideo(this);
    }
    destroy() {
        if (this.heroContainer && this.heroClickHandler) {
            this.heroContainer.removeEventListener('click', this.heroClickHandler);
        }

        detachHeroVideoListeners(this);
        clearHeroFallbackTimer(this);

        this.view = null;
        this.params = null;
        this.apiClient = null;
        this.heroItems = null;
        this.activeHeroIndex = 0;
        this.heroItemId = null;
        this.heroRendered = false;
        this.heroMuted = true;
        this.heroVideo = null;
        this.heroVolumeIconElement = null;
        this.heroQueueProgressElement = null;
        this.heroContainer = null;
        this.destroyHomeSections();
        this.sectionsContainer = null;
    }
    destroyHomeSections() {
        const sectionsContainer = this.sectionsContainer;

        if (sectionsContainer) {
            homeSections.destroySections(sectionsContainer);
        }
    }
}

function onHomeScreenSettingsChanged() {
    this.sectionsRendered = false;

    if (!this.paused) {
        this.onResume({
            refresh: true
        });
    }
}

function isValidHeroItem(item) {
    return !!item && typeof item === 'object' && !!item.backgroundImage;
}

function getHeroHtml({ title, summary, backgroundImage, logoImage, videoPreview, hasMovieId, heroCount, activeIndex, isMuted }) {
    const logoHtml = logoImage
        ? `<img class="movieHeroLogo" src="${logoImage}" alt="${title}">`
        : `<h1 class="movieHeroTitle">${title}</h1>`;

    let queueBarsHtml = '';
    for (let index = 0; index < heroCount; index++) {
        queueBarsHtml += `<button type="button" class="movieHeroQueueBar ${index === activeIndex ? 'movieHeroQueueBar-active' : ''}" data-hero-index="${index}" aria-label="Hero ${index + 1}"><span class="movieHeroQueueProgress"></span></button>`;
    }

    const backgroundMedia = videoPreview
        ? `<video class="movieHeroVideo" autoplay ${isMuted ? 'muted' : ''} playsinline preload="metadata" poster="${backgroundImage}"><source src="${videoPreview}" type="video/mp4"></video>`
        : `<img class="movieHeroBackgroundImage" src="${backgroundImage}" alt="${title}">`;

    const volumeIcon = isMuted ? 'volume_off' : 'volume_up';

    const actionsHtml = hasMovieId
        ? `<button is="emby-button" type="button" class="raised movieHeroButton" data-action="play"><svg class="movieHeroPlayIcon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M21.4086 9.35258C23.5305 10.5065 23.5305 13.4935 21.4086 14.6474L8.59662 21.6145C6.53435 22.736 4 21.2763 4 18.9671L4 5.0329C4 2.72368 6.53435 1.26402 8.59661 2.38548L21.4086 9.35258Z"/></svg>${globalize.translate('Play')}</button>
                    <button is="emby-button" type="button" class="raised button-flat movieHeroButton" data-action="info">${globalize.translate('ButtonInfo')}</button>`
        : `<button is="emby-button" type="button" class="raised button-flat movieHeroButton" disabled>Coming Soon</button>`;

    return `<section class="movieHero">
        <div class="movieHeroMedia">${backgroundMedia}</div>
        <div class="movieHeroContent padded-left padded-right">
            <div class="movieHeroContentInner">
                ${logoHtml}
                ${summary ? `<p class="movieHeroSummary">${summary}</p>` : ''}
                <div class="movieHeroActions">
                    ${actionsHtml}
                </div>
            </div>
        </div>
        <div class="movieHeroQueueControls">
            <button type="button" class="movieHeroVolumeButton" data-action="toggle-volume" aria-label="Toggle trailer audio">
                <span class="material-icons movieHeroVolumeIcon" aria-hidden="true">${volumeIcon}</span>
            </button>
            <div class="movieHeroQueue">${queueBarsHtml}</div>
        </div>
    </section>`;
}

function onHeroClick(event) {
    const volumeButton = event.target.closest('.movieHeroVolumeButton');
    if (volumeButton) {
        toggleHeroMuted(this);
        return;
    }

    const queueBar = event.target.closest('.movieHeroQueueBar');
    if (queueBar) {
        const heroIndex = Number.parseInt(queueBar.dataset.heroIndex || '', 10);
        if (!Number.isNaN(heroIndex)) {
            renderHeroAtIndex(this, heroIndex);
        }
        return;
    }

    const button = event.target.closest('.movieHeroButton');
    if (!button) {
        return;
    }

    const action = button.dataset.action;

    if (action === 'play') {
        if (this.heroItemId) {
            playbackManager.play({
                ids: [this.heroItemId],
                serverId: this.apiClient.serverId()
            });
            return;
        }

        const heroVideo = this.heroVideo;
        if (!heroVideo) {
            return;
        }

        if (heroVideo.paused) {
            heroVideo.play().catch(() => {
            });
        } else {
            heroVideo.pause();
        }
        return;
    }

    if (action === 'info' && this.heroItemId) {
        appRouter.showItem(this.heroItemId, this.apiClient.serverId());
    }
}

function resumeHeroVideo(context) {
    clearHeroFallbackTimer(context);

    const heroVideo = context.heroVideo;
    if (!heroVideo) {
        startHeroFallbackTimer(context);
        return;
    }

    applyHeroMutedState(context);
    heroVideo.play().catch(() => {
    });
}

function pauseHeroVideo(context) {
    clearHeroFallbackTimer(context);

    const heroVideo = context.heroVideo;
    if (!heroVideo) {
        return;
    }

    heroVideo.pause();
}

function ensureHeroContainer(view) {
    const existingContainer = view.querySelector('.movieHeroContainer');
    if (existingContainer) {
        return existingContainer;
    }

    const sections = view.querySelector('.sections');
    if (!sections || !sections.parentNode) {
        return null;
    }

    const createdContainer = document.createElement('div');
    createdContainer.className = 'movieHeroContainer';
    sections.parentNode.insertBefore(createdContainer, sections);
    return createdContainer;
}

function renderHeroAtIndex(context, targetIndex) {
    const heroItems = context.heroItems || [];
    if (!heroItems.length || !context.heroContainer) {
        return;
    }

    detachHeroVideoListeners(context);
    clearHeroFallbackTimer(context);

    const index = ((targetIndex % heroItems.length) + heroItems.length) % heroItems.length;
    context.activeHeroIndex = index;

    const heroItem = heroItems[index];
    const title = escapeHtml(heroItem.title || '');
    const summary = escapeHtml(heroItem.summary || '');
    const backgroundImage = escapeHtml(heroItem.backgroundImage || '');
    const logoImage = escapeHtml(heroItem.logoImage || '');
    const videoPreview = escapeHtml(heroItem.videoPreview || '');

    context.heroItemId = heroItem.idmovie || '';
    context.heroContainer.innerHTML = getHeroHtml({
        title,
        summary,
        backgroundImage,
        logoImage,
        videoPreview,
        hasMovieId: !!context.heroItemId,
        heroCount: heroItems.length,
        activeIndex: index,
        isMuted: context.heroMuted
    });

    context.heroContainer.removeEventListener('click', context.heroClickHandler);
    context.heroContainer.addEventListener('click', context.heroClickHandler);

    context.heroVideo = context.heroContainer.querySelector('.movieHeroVideo');
    context.heroVolumeIconElement = context.heroContainer.querySelector('.movieHeroVolumeIcon');
    context.heroQueueProgressElement = context.heroContainer.querySelector('.movieHeroQueueBar-active .movieHeroQueueProgress');
    context.heroRendered = true;

    updateHeroVolumeIcon(context);
    attachHeroVideoListeners(context);
    updateHeroQueueProgress(context, 0);
    resumeHeroVideo(context);
}

function queueNextHero(context) {
    const heroItems = context.heroItems || [];
    if (!heroItems.length) {
        return;
    }

    renderHeroAtIndex(context, context.activeHeroIndex + 1);
}

function updateHeroQueueProgress(context, progressRatio) {
    const indicator = context.heroQueueProgressElement;
    if (!indicator) {
        return;
    }

    const safeRatio = Math.min(1, Math.max(0, progressRatio));
    indicator.style.width = `${safeRatio * 100}%`;
}

function startHeroFallbackTimer(context) {
    const heroItems = context.heroItems || [];
    if (heroItems.length < 2) {
        return;
    }

    context.heroFallbackTimer = setTimeout(() => {
        context.heroFallbackTimer = null;
        queueNextHero(context);
    }, HERO_IMAGE_DURATION_MS);
}

function clearHeroFallbackTimer(context) {
    if (!context.heroFallbackTimer) {
        return;
    }

    clearTimeout(context.heroFallbackTimer);
    context.heroFallbackTimer = null;
}

function attachHeroVideoListeners(context) {
    const heroVideo = context.heroVideo;
    if (!heroVideo) {
        return;
    }

    heroVideo.addEventListener('timeupdate', context.onHeroVideoTimeUpdate);
    heroVideo.addEventListener('loadedmetadata', context.onHeroVideoMetadataLoaded);
    heroVideo.addEventListener('ended', context.onHeroVideoEnded);
}

function detachHeroVideoListeners(context) {
    const heroVideo = context.heroVideo;
    if (!heroVideo) {
        return;
    }

    heroVideo.removeEventListener('timeupdate', context.onHeroVideoTimeUpdate);
    heroVideo.removeEventListener('loadedmetadata', context.onHeroVideoMetadataLoaded);
    heroVideo.removeEventListener('ended', context.onHeroVideoEnded);
}

function onHeroVideoMetadataLoaded() {
    updateHeroQueueProgress(this, 0);
}

function onHeroVideoTimeUpdate() {
    const heroVideo = this.heroVideo;
    if (!heroVideo || !heroVideo.duration) {
        return;
    }

    updateHeroQueueProgress(this, heroVideo.currentTime / heroVideo.duration);
}

function onHeroVideoEnded() {
    updateHeroQueueProgress(this, 1);
    queueNextHero(this);
}

function toggleHeroMuted(context) {
    context.heroMuted = !context.heroMuted;
    applyHeroMutedState(context);
    updateHeroVolumeIcon(context);

    const heroVideo = context.heroVideo;
    if (heroVideo && heroVideo.paused) {
        heroVideo.play().catch(() => {
        });
    }
}

function applyHeroMutedState(context) {
    const heroVideo = context.heroVideo;
    if (!heroVideo) {
        return;
    }

    heroVideo.muted = context.heroMuted;
}

function updateHeroVolumeIcon(context) {
    const volumeIcon = context.heroVolumeIconElement;
    if (!volumeIcon) {
        return;
    }

    volumeIcon.textContent = context.heroMuted ? 'volume_off' : 'volume_up';
}

export default HomeTab;
