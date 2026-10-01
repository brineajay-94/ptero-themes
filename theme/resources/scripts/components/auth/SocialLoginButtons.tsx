import React from 'react';
import { socialProviders, socialRedirectUrl } from '@/lib/brand';

/**
 * The real Google "G", inlined as SVG.
 *
 * The panel only ships @fortawesome/free-brands-svg-icons for a handful of
 * brands and does not include Google's, so pulling in the free-brands package
 * would mean changing the panel's dependencies for one button. The official
 * four-colour mark is four paths and always resolves.
 *
 * It is NOT monochrome-white like the other glyphs here. Google's brand rules
 * require the full-colour mark on a light background, and a one-colour version
 * is not something they license for third-party use - so the button keeps its
 * white surface and the logo keeps its colours.
 *
 * Paths from the Google brand mark (public domain, via Simple Icons).
 */
const GoogleMark: React.FC = () => (
    <svg viewBox={'0 0 48 48'} className={'pt-social-mark'} aria-hidden={'true'} focusable={'false'}>
        <path
            fill={'#EA4335'}
            d={
                'M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z'
            }
        />
        <path
            fill={'#4285F4'}
            d={
                'M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z'
            }
        />
        <path
            fill={'#FBBC05'}
            d={
                'M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z'
            }
        />
        <path
            fill={'#34A853'}
            d={
                'M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z'
            }
        />
    </svg>
);

/**
 * The Discord mark, inlined as SVG, for the same reason as the Google one.
 *
 * Discord's brand rules permit recolouring to a single colour on a light
 * background, and the button here is a white surface, so this one is
 * `currentColor` and follows the button's ink - unlike the Google mark, which is
 * required to stay four-colour.
 *
 * Path from the Discord brand icon via Simple Icons (CC0-1.0).
 */
const DiscordMark: React.FC = () => (
    <svg viewBox={'0 0 24 24'} className={'pt-social-mark'} aria-hidden={'true'} focusable={'false'}>
        <path
            fill={'currentColor'}
            d={
                'M20.317 4.3698a19.7913 19.7913 0 00-4.8851-1.5152.0741.0741 0 00-.0785.0371c-.211.3753-.4447.8648-.6083 1.2495-1.8447-.2762-3.68-.2762-5.4868 0-.1636-.3933-.4058-.8742-.6177-1.2495a.077.077 0 00-.0785-.037 19.7363 19.7363 0 00-4.8852 1.515.0699.0699 0 00-.0321.0277C.5334 9.0458-.319 13.5799.0992 18.0578a.0824.0824 0 00.0312.0561c2.0528 1.5076 4.0413 2.4228 5.9929 3.0294a.0777.0777 0 00.0842-.0276c.4616-.6304.8731-1.2952 1.226-1.9942a.076.076 0 00-.0416-.1057c-.6528-.2476-1.2743-.5495-1.8722-.8923a.077.077 0 01-.0076-.1277c.1258-.0943.2517-.1923.3718-.2914a.0743.0743 0 01.0776-.0105c3.9278 1.7933 8.18 1.7933 12.0614 0a.0739.0739 0 01.0785.0095c.1202.099.246.1981.3728.2924a.077.077 0 01-.0066.1276 12.2986 12.2986 0 01-1.873.8914.0766.0766 0 00-.0407.1067c.3604.698.7719 1.3628 1.225 1.9932a.076.076 0 00.0842.0286c1.961-.6067 3.9495-1.5219 6.0023-3.0294a.077.077 0 00.0313-.0552c.5004-5.177-.8382-9.6739-3.5485-13.6604a.061.061 0 00-.0312-.0286zM8.02 15.3312c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9555-2.4189 2.157-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.9555 2.4189-2.1568 2.4189zm7.9748 0c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9554-2.4189 2.1569-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.946 2.4189-2.1568 2.4189z'
            }
        />
    </svg>
);

const MARKS: Record<string, React.FC> = {
    google: GoogleMark,
    discord: DiscordMark,
};

/**
 * The row of social sign-in buttons, or nothing at all.
 *
 * Renders null when the admin has no usable provider configured - that is the
 * common case on a panel that has never touched Admin -> Social Login, and an
 * empty bordered box above the login form would be worse than nothing.
 *
 * A plain anchor, not a button with an onClick. The whole flow is server-side
 * redirects, so there is nothing to do in JavaScript: the browser is handed to
 * the provider and comes back to the panel's own callback. An anchor also means
 * it works with middle-click, "open in new tab", and right-click -> copy link,
 * which a div or a JS-navigating button would silently break.
 */
const SocialLoginButtons: React.FC = () => {
    const providers = socialProviders();

    if (providers.length === 0) {
        return null;
    }

    return (
        <div className={'pt-auth-social'}>
            <div className={'pt-auth-social-rule'}>
                <span>or continue with</span>
            </div>

            <div className={'pt-auth-social-row'}>
                {providers.map((provider) => {
                    const Mark = MARKS[provider.id];

                    return (
                        <a
                            key={provider.id}
                            className={`pt-auth-social-btn pt-auth-social-btn--${provider.id}`}
                            href={socialRedirectUrl(provider.id)}
                        >
                            {Mark && <Mark />}
                            <span>Continue with {provider.label}</span>
                        </a>
                    );
                })}
            </div>
        </div>
    );
};

export default SocialLoginButtons;
