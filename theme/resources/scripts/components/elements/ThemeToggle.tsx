import React, { useEffect, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faMoon, faSun } from '@fortawesome/free-solid-svg-icons';
import { getTheme, subscribeTheme, Theme, toggleTheme } from '@/lib/theme';

const ThemeToggle = () => {
    const [theme, setTheme] = useState<Theme>(getTheme);

    useEffect(() => subscribeTheme(setTheme), []);

    const next = theme === 'dark' ? 'light' : 'dark';

    return (
        <button
            type={'button'}
            className={'pt-theme-toggle'}
            onClick={() => toggleTheme()}
            title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            data-next-theme={next}
        >
            <FontAwesomeIcon icon={theme === 'dark' ? faSun : faMoon} />
        </button>
    );
};

export default ThemeToggle;
