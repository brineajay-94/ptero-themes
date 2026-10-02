import React, { useEffect } from 'react';
import ContentContainer from '@/components/elements/ContentContainer';
import { CSSTransition } from 'react-transition-group';
import tw from 'twin.macro';
import FlashMessageRender from '@/components/FlashMessageRender';
import { brandName, themeCredit } from '@/lib/brand';

export interface PageContentBlockProps {
    title?: string;
    className?: string;
    showFlashKey?: string;
}

const PageContentBlock: React.FC<PageContentBlockProps> = ({ title, showFlashKey, className, children }) => {
    useEffect(() => {
        if (title) {
            document.title = title;
        }
    }, [title]);

    return (
        <CSSTransition timeout={150} classNames={'fade'} appear in>
            <>
                <ContentContainer css={tw`my-4 sm:my-10`} className={className}>
                    {showFlashKey && <FlashMessageRender byKey={showFlashKey} css={tw`mb-4`} />}
                    {children}
                </ContentContainer>
                <ContentContainer>
                    {/*
                     * The company name is the panel's own site name, read through
                     * brandName() like everywhere else in the theme - it used to
                     * be a hardcoded "brinecloud", which meant a renamed panel
                     * still credited the wrong company.
                     *
                     * The design credit comes from themeCredit(), which the rail
                     * also uses: it used to be written out here a second time with
                     * its own hardcoded name and its own hardcoded link, so the two
                     * credits on the same screen could name different people or
                     * point at different places.
                     */}
                    <p className={'pt-footer'}>
                        Powered by <strong>{brandName()}</strong> &copy; {new Date().getFullYear()}
                    </p>
                    <p className={'pt-footer-credit'}>
                        Design copyright{' '}
                        <a href={themeCredit().url} target={'_blank'} rel={'noopener noreferrer'}>
                            {themeCredit().name}
                        </a>
                    </p>
                </ContentContainer>
            </>
        </CSSTransition>
    );
};

export default PageContentBlock;
