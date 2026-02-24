import type { BaseItemDto } from '@jellyfin/sdk/lib/generated-client/models/base-item-dto';
import { CollectionType } from '@jellyfin/sdk/lib/generated-client/models/collection-type';
import Button from '@mui/material/Button/Button';
import SvgIcon from '@mui/material/SvgIcon';
import React, { useMemo } from 'react';
import { Link, useLocation, useSearchParams } from 'react-router-dom';

import { MetaView } from 'apps/experimental/constants/metaView';
import { isLibraryPath } from 'apps/experimental/features/libraries/utils/path';
import { appRouter } from 'components/router/appRouter';
import { useApi } from 'hooks/useApi';
import useCurrentTab from 'hooks/useCurrentTab';
import { useUserViews } from 'hooks/useUserViews';
import globalize from 'lib/globalize';

const HOME_PATH = '/home';
const LIST_PATH = '/list';
const REQUEST_URL = 'https://request.weflix.me/';
const REQUEST_ICON_PATH = 'M16 4c.552 0 1 .448 1 1v4.2l5.213-3.65c.226-.158.538-.103.697.124.058.084.09.184.09.286v12.08c0 .276-.224.5-.5.5-.103 0-.203-.032-.287-.09L17 14.8V19c0 .552-.448 1-1 1H2c-.552 0-1-.448-1-1V5c0-.552.448-1 1-1h14zm-1 2H3v12h12V6zm-5 2v4h3l-4 4-4-4h3V8h2zm11 .841l-4 2.8v.718l4 2.8V8.84z';
const BOLD_TEXT_EFFECT = '0 0 0 currentColor, 0.02em 0 0 currentColor, -0.02em 0 0 currentColor';

const navButtonSx = {
    textTransform: 'none',
    borderRadius: 0,
    minWidth: 'auto',
    px: 1.25,
    fontSize: '1.2rem',
    lineHeight: 1.2,
    fontWeight: 400,
    '&:hover': {
        backgroundColor: 'transparent',
        fontWeight: 400,
        textShadow: BOLD_TEXT_EFFECT
    }
};

const activeNavButtonSx = {
    ...navButtonSx,
    fontWeight: 400,
    textShadow: BOLD_TEXT_EFFECT,
    borderBottom: '2px solid currentColor'
};

const requestButtonSx = {
    ...navButtonSx,
    borderRadius: '10px',
    px: 1.3,
    py: 1.45,
    minHeight: 0,
    alignSelf: 'center',
    '&:hover': {
        background: 'linear-gradient(180deg, rgba(255,255,255,0.36) 0%, rgba(255,255,255,0.20) 28%, rgba(255,255,255,0.12) 100%)'
    }
};

function getOrderedViews(views: BaseItemDto[] | undefined) {
    if (!views) return [];

    const getName = (view: BaseItemDto) => (view.Name || '').toLowerCase();
    const pickedIds = new Set<string>();
    const ordered: BaseItemDto[] = [];

    const pushMatch = (predicate: (view: BaseItemDto) => boolean) => {
        const match = views.find(view => {
            if (!view.Id || pickedIds.has(view.Id)) return false;
            return predicate(view);
        });

        if (match?.Id) {
            ordered.push(match);
            pickedIds.add(match.Id);
        }
    };

    pushMatch(view => view.CollectionType === CollectionType.Movies || getName(view) === 'movies');
    pushMatch(view => {
        const name = getName(view);
        const isAnime = name.includes('anime');
        return !isAnime && (view.CollectionType === CollectionType.Tvshows || name === 'tv shows' || (name.includes('tv') && name.includes('show')));
    });
    pushMatch(view => getName(view).includes('anime'));

    return ordered;
}

const getCurrentUserView = (
    userViews: BaseItemDto[] | undefined,
    pathname: string,
    libraryId: string | null,
    collectionType: string | null,
    tab: number
) => {
    const isUserViewPath = isLibraryPath(pathname) || [HOME_PATH, LIST_PATH].includes(pathname);
    if (!isUserViewPath) return undefined;

    if (collectionType === CollectionType.Livetv) {
        return userViews?.find(({ CollectionType: type }) => type === CollectionType.Livetv);
    }

    if (pathname === HOME_PATH && tab === 1) {
        return MetaView.Favorites;
    }

    // eslint-disable-next-line sonarjs/different-types-comparison
    return userViews?.find(({ Id: id }) => id === libraryId);
};

const UserViewNav = () => {
    const location = useLocation();
    const [ searchParams ] = useSearchParams();
    const libraryId = searchParams.get('topParentId') || searchParams.get('parentId');
    const collectionType = searchParams.get('collectionType');
    const { activeTab } = useCurrentTab();

    const { user } = useApi();
    const {
        data: userViews,
        isPending
    } = useUserViews(user?.Id);

    const orderedViews = useMemo(() => (
        getOrderedViews(userViews?.Items)
    ), [ userViews?.Items ]);

    const currentUserView = useMemo(() => (
        getCurrentUserView(userViews?.Items, location.pathname, libraryId, collectionType, activeTab)
    ), [ activeTab, collectionType, libraryId, location.pathname, userViews ]);

    if (isPending) return null;

    return (
        <>
            {orderedViews.map(view => (
                <Button
                    key={view.Id}
                    variant='text'
                    color='inherit'
                    sx={(view.Id === currentUserView?.Id) ? activeNavButtonSx : navButtonSx}
                    component={Link}
                    to={appRouter.getRouteUrl(view, { context: view.CollectionType }).substring(1)}
                >
                    {view.Name}
                </Button>
            ))}

            <Button
                variant='text'
                color='inherit'
                sx={(currentUserView?.Id === MetaView.Favorites.Id) ? activeNavButtonSx : navButtonSx}
                component={Link}
                to='/home?tab=1'
            >
                {globalize.translate(MetaView.Favorites.Name)}
            </Button>

            <span
                aria-hidden
                style={{
                    alignSelf: 'center',
                    display: 'inline-flex',
                    fontSize: '1.5rem',
                    lineHeight: 1,
                    opacity: 0.75,
                    padding: '0 0.45rem'
                }}
            >
                |
            </span>

            <Button
                variant='text'
                color='inherit'
                sx={requestButtonSx}
                startIcon={(
                    <SvgIcon fontSize='small' viewBox='0 0 24 24'>
                        <path d={REQUEST_ICON_PATH} />
                    </SvgIcon>
                )}
                component='a'
                href={REQUEST_URL}
                target='_blank'
                rel='noopener noreferrer'
            >
                Request
            </Button>
        </>
    );
};

export default UserViewNav;
