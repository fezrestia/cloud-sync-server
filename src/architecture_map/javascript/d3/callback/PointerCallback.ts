/**
 * Pointer interaction Callback interface.
 */
export interface PointerCallback {
    onClick(): void;

    onDragStarted(thiz: any): void;
    onDragged(thiz: any): void;
    onDragStopped(thiz: any): void;

}

