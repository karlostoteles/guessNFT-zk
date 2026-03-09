import { useState, useEffect } from 'react';

/**
 * Custom hook to detect media query matches.
 * Useful for responsive logic that can't be handled by CSS alone.
 */
export function useMediaQuery(query: string): boolean {
    const [matches, setMatches] = useState(false);

    useEffect(() => {
        const media = window.matchMedia(query);
        if (media.matches !== matches) {
            setMatches(media.matches);
        }

        const listener = () => setMatches(media.matches);
        media.addEventListener('change', listener);
        return () => media.removeEventListener('change', listener);
    }, [matches, query]);

    return matches;
}

export function useIsMobile() {
    return useMediaQuery('(max-width: 768px)');
}
