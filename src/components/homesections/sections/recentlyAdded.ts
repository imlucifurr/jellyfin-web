import type { BaseItemDto } from '@jellyfin/sdk/lib/generated-client/models/base-item-dto';
import { BaseItemKind } from '@jellyfin/sdk/lib/generated-client/models/base-item-kind';
import type { UserDto } from '@jellyfin/sdk/lib/generated-client/models/user-dto';
import { CollectionType } from '@jellyfin/sdk/lib/generated-client/models/collection-type';
import escapeHtml from 'escape-html';
import type { ApiClient } from 'jellyfin-apiclient';

import cardBuilder from 'components/cardbuilder/cardBuilder';
import layoutManager from 'components/layoutManager';
import { appRouter } from 'components/router/appRouter';
import globalize from 'lib/globalize';
import { ServerConnections } from 'lib/jellyfin-apiclient';
import { getTvdbNewAndPopularCandidates, type TvdbCandidate } from 'lib/tvdb/client';
import { getBackdropShape, getPortraitShape, getSquareShape } from 'utils/card';

import type { SectionContainerElement, SectionOptions } from './section';

const TVDB_SECTION_TIMEOUT_MS = 1800;

function getFetchLatestItemsFn(
    serverId: string,
    parentId: string | undefined,
    collectionType: string | null | undefined,
    { enableOverflow }: SectionOptions
) {
    return function () {
        const apiClient = ServerConnections.getApiClient(serverId);
        let limit = 16;

        if (enableOverflow) {
            if (collectionType === CollectionType.Music) {
                limit = 30;
            }
        } else if (collectionType === CollectionType.Tvshows) {
            limit = 5;
        } else if (collectionType === CollectionType.Music) {
            limit = 9;
        } else {
            limit = 8;
        }

        const options = {
            Limit: limit,
            Fields: 'PrimaryImageAspectRatio,Path',
            ImageTypeLimit: 1,
            EnableImageTypes: 'Primary,Backdrop,Thumb',
            ParentId: parentId
        };

        return apiClient.getLatestItems(options);
    };
}

function getLatestItemsHtmlFn(
    itemType: BaseItemKind | undefined,
    viewType: string | null | undefined,
    { enableOverflow }: SectionOptions
) {
    return function (items: BaseItemDto[]) {
        const cardLayout = false;
        let shape;
        if (itemType === 'Channel' || viewType === 'movies' || viewType === 'books' || viewType === 'tvshows') {
            shape = getPortraitShape(enableOverflow);
        } else if (viewType === 'music' || viewType === 'homevideos') {
            shape = getSquareShape(enableOverflow);
        } else {
            shape = getBackdropShape(enableOverflow);
        }

        return cardBuilder.getCardsHtml({
            items: items,
            shape: shape,
            preferThumb: viewType !== 'movies' && viewType !== 'tvshows' && itemType !== 'Channel' && viewType !== 'music' ? 'auto' : null,
            showUnplayedIndicator: false,
            showChildCountIndicator: true,
            context: 'home',
            overlayText: false,
            centerText: !cardLayout,
            overlayPlayButton: viewType !== 'photos',
            allowBottomPadding: !enableOverflow && !cardLayout,
            cardLayout: cardLayout,
            showTitle: viewType !== 'photos',
            showYear: viewType === 'movies' || viewType === 'tvshows' || !viewType,
            showParentTitle: viewType === 'music' || viewType === 'tvshows' || !viewType || (cardLayout && (viewType === 'tvshows')),
            lines: 2
        });
    };
}

function renderLatestSection(
    elem: HTMLElement,
    apiClient: ApiClient,
    user: UserDto,
    parent: BaseItemDto,
    options: SectionOptions
) {
    let html = '';

    html += '<div class="sectionTitleContainer sectionTitleContainer-cards padded-left">';
    if (!layoutManager.tv) {
        html += '<a is="emby-linkbutton" href="' + appRouter.getRouteUrl(parent, {
            section: 'latest'
        }) + '" class="more button-flat button-flat-mini sectionTitleTextButton">';
        html += '<h2 class="sectionTitle sectionTitle-cards">';
        html += globalize.translate('LatestFromLibrary', escapeHtml(parent.Name));
        html += '</h2>';
        html += '<span class="material-icons chevron_right" aria-hidden="true"></span>';
        html += '</a>';
    } else {
        html += '<h2 class="sectionTitle sectionTitle-cards">' + globalize.translate('LatestFromLibrary', escapeHtml(parent.Name)) + '</h2>';
    }
    html += '</div>';

    if (options.enableOverflow) {
        html += '<div is="emby-scroller" class="padded-top-focusscale padded-bottom-focusscale" data-centerfocus="true">';
        html += '<div is="emby-itemscontainer" class="itemsContainer scrollSlider focuscontainer-x">';
    } else {
        html += '<div is="emby-itemscontainer" class="itemsContainer focuscontainer-x padded-left padded-right vertical-wrap">';
    }

    if (options.enableOverflow) {
        html += '</div>';
    }
    html += '</div>';

    elem.innerHTML = html;

    const itemsContainer: SectionContainerElement | null = elem.querySelector('.itemsContainer');
    if (!itemsContainer) return;
    itemsContainer.fetchData = getFetchLatestItemsFn(apiClient.serverId(), parent.Id, parent.CollectionType, options);
    itemsContainer.getItemsHtml = getLatestItemsHtmlFn(parent.Type, parent.CollectionType, options);
    itemsContainer.parentContainer = elem;
}

function getSectionItemsHtmlFn({ enableOverflow }: SectionOptions) {
    return function (items: BaseItemDto[]) {
        return cardBuilder.getCardsHtml({
            items,
            shape: getPortraitShape(enableOverflow),
            showUnplayedIndicator: false,
            showChildCountIndicator: true,
            context: 'home',
            overlayText: false,
            centerText: true,
            overlayPlayButton: true,
            allowBottomPadding: !enableOverflow,
            cardLayout: false,
            showTitle: true,
            showYear: true,
            showParentTitle: true,
            lines: 2
        });
    };
}

function renderCustomSection(
    elem: HTMLElement,
    title: string,
    fetchData: () => Promise<BaseItemDto[]>,
    options: SectionOptions
) {
    let html = '';

    html += '<div class="sectionTitleContainer sectionTitleContainer-cards padded-left">';
    html += '<h2 class="sectionTitle sectionTitle-cards">' + escapeHtml(title) + '</h2>';
    html += '</div>';

    if (options.enableOverflow) {
        html += '<div is="emby-scroller" class="padded-top-focusscale padded-bottom-focusscale" data-centerfocus="true">';
        html += '<div is="emby-itemscontainer" class="itemsContainer scrollSlider focuscontainer-x">';
    } else {
        html += '<div is="emby-itemscontainer" class="itemsContainer focuscontainer-x padded-left padded-right vertical-wrap">';
    }

    if (options.enableOverflow) {
        html += '</div>';
    }
    html += '</div>';

    elem.innerHTML = html;

    const itemsContainer: SectionContainerElement | null = elem.querySelector('.itemsContainer');
    if (!itemsContainer) {
        return;
    }

    itemsContainer.fetchData = fetchData;
    itemsContainer.getItemsHtml = getSectionItemsHtmlFn(options);
    itemsContainer.parentContainer = elem;
}

function normalizeTitle(title: string | null | undefined) {
    return (title ?? '')
        .toLowerCase()
        .replace(/\([^)]*\)/g, ' ')
        .replace(/[^a-z0-9]+/g, ' ')
        .trim();
}

function getLibraryItems(apiClient: ApiClient, userId: string) {
    return apiClient.getItems(userId, {
        Recursive: true,
        IncludeItemTypes: 'Movie,Series',
        Limit: 1000,
        Fields: 'Genres,CommunityRating,ProductionYear,UserData,Path,PremiereDate,DateCreated',
        SortBy: 'DateCreated',
        SortOrder: 'Descending',
        EnableTotalRecordCount: false
    }).then(result => result.Items ?? []);
}

function getWatchedItems(apiClient: ApiClient, userId: string) {
    return apiClient.getItems(userId, {
        Recursive: true,
        IncludeItemTypes: 'Movie,Series',
        Filters: 'IsPlayed',
        Limit: 200,
        Fields: 'Genres,DatePlayed,UserData',
        SortBy: 'DatePlayed',
        SortOrder: 'Descending',
        EnableTotalRecordCount: false
    }).then(result => result.Items ?? []);
}

function pickItemByCandidate(
    candidates: BaseItemDto[],
    tvdbCandidate: TvdbCandidate,
    usedIds: Set<string>
) {
    const matchingTypeItems = candidates.filter(item => {
        if (tvdbCandidate.recordType === 'movie') {
            return item.Type === 'Movie';
        }

        return item.Type === 'Series';
    });

    const notUsedItems = matchingTypeItems.filter(item => !item.Id || !usedIds.has(item.Id));
    if (!notUsedItems.length) {
        return null;
    }

    if (tvdbCandidate.year) {
        const exactYearItem = notUsedItems.find(item => item.ProductionYear === tvdbCandidate.year);
        if (exactYearItem) {
            return exactYearItem;
        }
    }

    return notUsedItems[0];
}

function matchTvdbCandidatesToLibrary(libraryItems: BaseItemDto[], tvdbCandidates: TvdbCandidate[]) {
    const libraryByTitle = new Map<string, BaseItemDto[]>();
    libraryItems.forEach(item => {
        const titleKey = normalizeTitle(item.Name);
        if (!titleKey) {
            return;
        }

        const existingItems = libraryByTitle.get(titleKey) ?? [];
        existingItems.push(item);
        libraryByTitle.set(titleKey, existingItems);
    });

    const usedIds = new Set<string>();
    const matched: BaseItemDto[] = [];

    tvdbCandidates.forEach(candidate => {
        const titleKey = normalizeTitle(candidate.title);
        if (!titleKey) {
            return;
        }

        const possibleItems = libraryByTitle.get(titleKey) ?? [];
        const pickedItem = pickItemByCandidate(possibleItems, candidate, usedIds);
        if (!pickedItem) {
            return;
        }

        if (pickedItem.Id) {
            usedIds.add(pickedItem.Id);
        }
        matched.push(pickedItem);
    });

    return matched;
}

function getItemReferenceDate(item: BaseItemDto) {
    const referenceDate = item.PremiereDate || item.DateCreated;
    if (!referenceDate) {
        return null;
    }

    const parsedDate = new Date(referenceDate);
    if (Number.isNaN(parsedDate.getTime())) {
        return null;
    }

    return parsedDate;
}

function isWithinLastMonths(item: BaseItemDto, months: number) {
    const referenceDate = getItemReferenceDate(item);
    if (!referenceDate) {
        return false;
    }

    const now = new Date();
    const thresholdDate = new Date(now);
    thresholdDate.setMonth(thresholdDate.getMonth() - months);

    return referenceDate >= thresholdDate;
}

function isWithinLastTwoMonths(item: BaseItemDto) {
    return isWithinLastMonths(item, 2);
}

function isWithinLastSixMonths(item: BaseItemDto) {
    return isWithinLastMonths(item, 6);
}

function sortByMostRecent(items: BaseItemDto[]) {
    return items.slice().sort((a, b) => {
        const aDate = getItemReferenceDate(a)?.getTime() ?? 0;
        const bDate = getItemReferenceDate(b)?.getTime() ?? 0;
        return bDate - aDate;
    });
}

function sortByRating(items: BaseItemDto[]) {
    return items.slice().sort((a, b) => {
        return (b.CommunityRating ?? 0) - (a.CommunityRating ?? 0);
    });
}

function setNewBadge(item: BaseItemDto) {
    const itemWithBadge = item as BaseItemDto & { IsRecentNewBadge?: boolean };
    itemWithBadge.IsRecentNewBadge = true;
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, fallback: T): Promise<T> {
    return Promise.race([
        promise,
        new Promise<T>(resolve => {
            setTimeout(() => resolve(fallback), timeoutMs);
        })
    ]);
}

async function getNewAndPopularItems(apiClient: ApiClient, userId: string) {
    try {
        const emptyCandidates = {
            newCandidates: [] as TvdbCandidate[],
            popularCandidates: [] as TvdbCandidate[]
        };

        const [libraryItems, tvdbCandidates] = await Promise.all([
            getLibraryItems(apiClient, userId),
            withTimeout(getTvdbNewAndPopularCandidates(80), TVDB_SECTION_TIMEOUT_MS, emptyCandidates)
        ]);

        const newItemsFromLibrary = sortByMostRecent(libraryItems.filter(isWithinLastTwoMonths));
        const newMatchesFromTvdb = matchTvdbCandidatesToLibrary(libraryItems, tvdbCandidates.newCandidates)
            .filter(isWithinLastTwoMonths);
        const popularMatchesFromTvdb = matchTvdbCandidatesToLibrary(libraryItems, tvdbCandidates.popularCandidates)
            .filter(isWithinLastSixMonths);
        const popularItemsFromLibrary = sortByRating(libraryItems.filter(isWithinLastSixMonths));

        const usedIds = new Set<string>();
        const mergedMatches: BaseItemDto[] = [];

        const appendUnique = (items: BaseItemDto[], markAsNew = false) => {
            items.forEach(item => {
                if (!item.Id) {
                    return;
                }

                if (usedIds.has(item.Id)) {
                    return;
                }

                usedIds.add(item.Id);
                if (markAsNew) {
                    setNewBadge(item);
                }
                mergedMatches.push(item);
            });
        };

        appendUnique(newItemsFromLibrary, true);
        appendUnique(newMatchesFromTvdb, true);
        appendUnique(popularMatchesFromTvdb);
        appendUnique(popularItemsFromLibrary);

        const matchedItems = mergedMatches.slice(0, 24);

        if (matchedItems.length) {
            return matchedItems;
        }

        return libraryItems
            .slice()
            .sort((a, b) => (b.CommunityRating ?? 0) - (a.CommunityRating ?? 0))
            .slice(0, 24);
    } catch (_error) {
        return [];
    }
}

function getGenreTasteProfile(items: BaseItemDto[]) {
    const genreWeights = new Map<string, number>();

    items.forEach((item, index) => {
        const recencyWeight = Math.max(1, 12 - Math.floor(index / 20));
        (item.Genres ?? []).forEach(genre => {
            const genreKey = genre.toLowerCase();
            const currentWeight = genreWeights.get(genreKey) ?? 0;
            genreWeights.set(genreKey, currentWeight + recencyWeight);
        });
    });

    return genreWeights;
}

async function getTopPicksItems(apiClient: ApiClient, userId: string) {
    try {
        const [libraryItems, watchedItems] = await Promise.all([
            getLibraryItems(apiClient, userId),
            getWatchedItems(apiClient, userId)
        ]);

        const tasteProfile = getGenreTasteProfile(watchedItems);
        const candidates = libraryItems
            .filter(item => !item.UserData?.Played)
            .map(item => {
                const genreBoost = (item.Genres ?? []).reduce((total, genre) => {
                    return total + (tasteProfile.get(genre.toLowerCase()) ?? 0);
                }, 0);

                const communityRatingBoost = (item.CommunityRating ?? 0) * 2;
                const totalScore = genreBoost + communityRatingBoost;

                return {
                    item,
                    totalScore
                };
            })
            .sort((a, b) => b.totalScore - a.totalScore)
            .map(entry => entry.item)
            .slice(0, 24);

        return candidates;
    } catch (_error) {
        return [];
    }
}

function renderDiscoverySections(
    elem: HTMLElement,
    apiClient: ApiClient,
    options: SectionOptions,
    userId: string
) {
    const newAndPopularSection = document.createElement('div');
    newAndPopularSection.classList.add('verticalSection');
    newAndPopularSection.classList.add('hide');
    elem.appendChild(newAndPopularSection);

    renderCustomSection(
        newAndPopularSection,
        'New and Popular',
        () => getNewAndPopularItems(apiClient, userId),
        options
    );

    const topPicksSection = document.createElement('div');
    topPicksSection.classList.add('verticalSection');
    topPicksSection.classList.add('hide');
    elem.appendChild(topPicksSection);

    renderCustomSection(
        topPicksSection,
        'Top picks for you',
        () => getTopPicksItems(apiClient, userId),
        options
    );
}

export function loadRecentlyAdded(
    elem: HTMLElement,
    apiClient: ApiClient,
    user: UserDto,
    userViews: BaseItemDto[],
    options: SectionOptions
) {
    elem.classList.remove('verticalSection');
    const excludeViewTypes = ['playlists', 'livetv', 'boxsets', 'channels', 'folders'];
    const userExcludeItems = user.Configuration?.LatestItemsExcludes ?? [];

    const getRecentlyAddedSortOrder = (item: BaseItemDto) => {
        const collectionType = item.CollectionType;
        const itemName = item.Name?.toLowerCase() ?? '';
        const isAnime = itemName.includes('anime');

        if (collectionType === CollectionType.Movies) {
            return 0;
        }

        if (collectionType === CollectionType.Tvshows && !isAnime) {
            return 1;
        }

        if (isAnime) {
            return 2;
        }

        return 3;
    };

    const sortedUserViews = [ ...userViews ].sort((a, b) => {
        const sortOrderDiff = getRecentlyAddedSortOrder(a) - getRecentlyAddedSortOrder(b);
        if (sortOrderDiff !== 0) {
            return sortOrderDiff;
        }

        return (a.Name ?? '').localeCompare(b.Name ?? '', undefined, { sensitivity: 'base' });
    });

    const userId = user.Id || apiClient.getCurrentUserId();
    let insertedDiscoverySections = false;

    sortedUserViews.forEach(item => {
        if (!item.Id || userExcludeItems.includes(item.Id)) {
            return;
        }

        if (item.CollectionType && excludeViewTypes.includes(item.CollectionType)) {
            return;
        }

        if (!insertedDiscoverySections && item.CollectionType === CollectionType.Movies) {
            renderDiscoverySections(elem, apiClient, options, userId);
            insertedDiscoverySections = true;
        }

        const frag = document.createElement('div');
        frag.classList.add('verticalSection');
        frag.classList.add('hide');
        elem.appendChild(frag);

        renderLatestSection(frag, apiClient, user, item, options);
    });
}
