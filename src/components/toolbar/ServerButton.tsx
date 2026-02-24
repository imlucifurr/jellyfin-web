import Button from '@mui/material/Button/Button';
import React, { FC } from 'react';
import { Link } from 'react-router-dom';

const WEFIX_LOGO_URL = 'https://cdn.weflix.me/images/weflix.svg';

const ServerButton: FC = () => {
    return (
        <Button
            variant='text'
            size='large'
            color='inherit'
            aria-label='WeFlix'
            sx={{
                minWidth: 'auto',
                '&:hover': {
                    backgroundColor: 'transparent'
                }
            }}
            startIcon={
                <img
                    src={WEFIX_LOGO_URL}
                    alt='WeFlix'
                    style={{
                        height: '2.0em',
                        width: 'auto'
                    }}
                />
            }
            component={Link}
            to='/'
        />
    );
};

export default ServerButton;
