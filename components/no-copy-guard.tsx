"use client";

import { PropsWithChildren, SyntheticEvent, useCallback } from "react";

type NoCopyGuardProps = PropsWithChildren<{
    className?: string;
    enabled?: boolean;
}>;

const envGuardEnabled = (process.env.NEXT_PUBLIC_ENABLE_PDF_WATERMARK ?? "false").toLowerCase() === "true";

export function NoCopyGuard({ children, className, enabled }: NoCopyGuardProps) {
    const isEnabled = enabled ?? envGuardEnabled;

    if (!isEnabled) {
        return <div className={className}>{children}</div>;
    }

    const blockade = useCallback((event: SyntheticEvent) => {
        event.preventDefault();
        event.stopPropagation();
    }, []);

    const wrapperClassName = className ? `select-none ${className}` : "select-none";

    return (
        <div
            className={wrapperClassName}
            style={{ userSelect: "none" }}
            onCopy={blockade}
            onCut={blockade}
            onPaste={blockade}
            onContextMenu={blockade}
            onDragStart={blockade}
        >
            {children}
        </div>
    );
}
