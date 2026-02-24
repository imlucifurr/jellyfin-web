import React, { StrictMode, useCallback, useState } from 'react';
import AppBar from '@mui/material/AppBar';
import Box from '@mui/material/Box';
import { type Theme } from '@mui/material/styles';
import useMediaQuery from '@mui/material/useMediaQuery';
import { Outlet, useLocation } from 'react-router-dom';

import AppBody from 'components/AppBody';
import CustomCss from 'components/CustomCss';
import ElevationScroll from 'components/ElevationScroll';
import ThemeCss from 'components/ThemeCss';
import { useApi } from 'hooks/useApi';

import AppToolbar from './components/AppToolbar';
import AppDrawer, { isDrawerPath } from './components/drawers/AppDrawer';

import './AppOverrides.scss';

export const Component = () => {
    const [ isDrawerActive, setIsDrawerActive ] = useState(false);
    const { user } = useApi();
    const location = useLocation();

    const isMediumScreen = useMediaQuery((t: Theme) => t.breakpoints.up('md'));
    const isDrawerAvailable = isDrawerPath(location.pathname) && Boolean(user) && !isMediumScreen;
    const isDrawerOpen = isDrawerActive && isDrawerAvailable;

    const onToggleDrawer = useCallback(() => {
        setIsDrawerActive(!isDrawerActive);
    }, [ isDrawerActive, setIsDrawerActive ]);

    return (
        <>
            <Box sx={{ position: 'relative', display: 'flex', height: '100%' }}>
                <StrictMode>
                    <ElevationScroll elevate={false}>
                        <AppBar
                            position='fixed'
                            sx={{
                                width: '100%',
                                ml: 0,
                                '&.MuiAppBar-colorTransparent': {
                                    backgroundColor: 'transparent',
                                    backgroundImage: 'linear-gradient(180deg, rgba(20, 20, 20, 0.82) 0%, rgba(20, 20, 20, 0.48) 56%, rgba(20, 20, 20, 0) 100%)',
                                    boxShadow: 'none'
                                },
                                '&.MuiAppBar-colorDefault': {
                                    backgroundColor: '#141414',
                                    backgroundImage: 'none'
                                },
                                '&.MuiPaper-elevation4': {
                                    backgroundColor: '#141414',
                                    backgroundImage: 'none'
                                }
                            }}
                        >
                            <AppToolbar
                                isDrawerAvailable={!isMediumScreen && isDrawerAvailable}
                                isDrawerOpen={isDrawerOpen}
                                onDrawerButtonClick={onToggleDrawer}
                            />
                        </AppBar>
                    </ElevationScroll>

                    {
                        isDrawerAvailable && (
                            <AppDrawer
                                open={isDrawerOpen}
                                onClose={onToggleDrawer}
                                onOpen={onToggleDrawer}
                            />
                        )
                    }
                </StrictMode>

                <Box
                    component='main'
                    sx={{
                        width: '100%',
                        flexGrow: 1
                    }}
                >
                    <AppBody>
                        <Outlet />
                    </AppBody>
                </Box>
            </Box>
            <ThemeCss />
            <CustomCss />
        </>
    );
};
