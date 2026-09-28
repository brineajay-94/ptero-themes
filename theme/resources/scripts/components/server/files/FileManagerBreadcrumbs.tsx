import React, { useEffect, useState } from 'react';
import { ServerContext } from '@/state/server';
import { NavLink, useLocation } from 'react-router-dom';
import { encodePathSegments, hashToPath } from '@/helpers';

interface Props {
    renderLeft?: JSX.Element;
    withinFileEditor?: boolean;
    isNewFile?: boolean;
}

export default ({ renderLeft, withinFileEditor, isNewFile }: Props) => {
    const [file, setFile] = useState<string | null>(null);
    const id = ServerContext.useStoreState((state) => state.server.data!.id);
    const directory = ServerContext.useStoreState((state) => state.files.directory);
    const { hash } = useLocation();

    useEffect(() => {
        const path = hashToPath(hash);

        if (withinFileEditor && !isNewFile) {
            const name = path.split('/').pop() || null;
            setFile(name);
        }
    }, [withinFileEditor, isNewFile, hash]);

    const breadcrumbs = (): { name: string; path?: string }[] =>
        directory
            .split('/')
            .filter((directory) => !!directory)
            .map((directory, index, dirs) => {
                if (!withinFileEditor && index === dirs.length - 1) {
                    return { name: directory };
                }

                return { name: directory, path: `/${dirs.slice(0, index + 1).join('/')}` };
            });

    return (
        <div className={'fm-path'}>
            {renderLeft || <span className={'fm-path-pad'} />}
            <span className={'fm-path-root'}>home</span>
            <span className={'fm-path-sep'}>/</span>
            <NavLink className={'fm-path-link'} to={`/server/${id}/files`}>
                container
            </NavLink>
            <span className={'fm-path-sep'}>/</span>
            {breadcrumbs().map((crumb, index) =>
                crumb.path ? (
                    <React.Fragment key={index}>
                        <NavLink
                            className={'fm-path-link'}
                            to={`/server/${id}/files#${encodePathSegments(crumb.path)}`}
                        >
                            {crumb.name}
                        </NavLink>
                        <span className={'fm-path-sep'}>/</span>
                    </React.Fragment>
                ) : (
                    <span className={'fm-path-leaf'} key={index}>
                        {crumb.name}
                    </span>
                )
            )}
            {file && <span className={'fm-path-leaf'}>{file}</span>}
        </div>
    );
};
