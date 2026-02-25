import useScrollTrigger from '@mui/material/useScrollTrigger';
import React, { ReactElement } from 'react';

/**
 * Component that changes the elevation of a child component when scrolled.
 */
const ElevationScroll = ({ children, elevate = false }: { children: ReactElement, elevate?: boolean }) => {
    const trigger = useScrollTrigger({
        disableHysteresis: true,
        threshold: 0
    });

    const hasScrolled = trigger;
    const shouldElevate = elevate && hasScrolled;

    return React.cloneElement(children, {
        color: hasScrolled ? 'default' : 'transparent',
        elevation: shouldElevate ? 4 : 0
    });
};

export default ElevationScroll;
