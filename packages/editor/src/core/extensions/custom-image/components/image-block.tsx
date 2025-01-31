import React, { useRef, useState, useCallback, useLayoutEffect, useEffect } from "react";
import { NodeSelection } from "@tiptap/pm/state";
// extensions
import { CustomImageNodeViewProps, ImageToolbarRoot } from "@/extensions/custom-image";
// helpers
import { cn } from "@/helpers/common";

const MIN_SIZE = 100;

type Pixel = `${number}px`;

type PixelAttribute<TDefault> = Pixel | TDefault;

export type ImageAttributes = {
  src: string | null;
  width: PixelAttribute<"35%" | number>;
  height: PixelAttribute<"auto" | number>;
  aspectRatio: number | null;
  id: string | null;
};

type Size = {
  width: PixelAttribute<"35%">;
  height: PixelAttribute<"auto">;
  aspectRatio: number | null;
};

const ensurePixelString = <TDefault,>(value: Pixel | TDefault | number | undefined | null, defaultValue?: TDefault) => {
  if (!value || value === defaultValue) {
    return defaultValue;
  }

  if (typeof value === "number") {
    return `${value}px` satisfies Pixel;
  }

  return value;
};

type CustomImageBlockProps = CustomImageNodeViewProps & {
  imageFromFileSystem: string;
  setFailedToLoadImage: (isError: boolean) => void;
  editorContainer: HTMLDivElement | null;
  setEditorContainer: (editorContainer: HTMLDivElement | null) => void;
};

export const CustomImageBlock: React.FC<CustomImageBlockProps> = (props) => {
  // props
  const {
    node,
    updateAttributes,
    setFailedToLoadImage,
    imageFromFileSystem,
    selected,
    getPos,
    editor,
    editorContainer,
    setEditorContainer,
  } = props;
  const { src: remoteImageSrc, width, height, aspectRatio } = node.attrs;
  // states
  const [size, setSize] = useState<Size>({
    width: ensurePixelString(width, "35%"),
    height: ensurePixelString(height, "auto"),
    aspectRatio: aspectRatio || 1,
  });
  const [isResizing, setIsResizing] = useState(false);
  const [initialResizeComplete, setInitialResizeComplete] = useState(false);
  // refs
  const containerRef = useRef<HTMLDivElement>(null);
  const containerRect = useRef<DOMRect | null>(null);
  const imageRef = useRef<HTMLImageElement>(null);

  const updateAttributesSafely = useCallback(
    (attributes: Partial<ImageAttributes>, errorMessage: string) => {
      try {
        updateAttributes(attributes);
      } catch (error) {
        console.error(`${errorMessage}:`, error);
      }
    },
    [updateAttributes]
  );

  const handleImageLoad = useCallback(() => {
    const img = imageRef.current;
    if (!img) return;
    let closestEditorContainer: HTMLDivElement | null = null;

    if (editorContainer) {
      closestEditorContainer = editorContainer;
    } else {
      closestEditorContainer = img.closest(".editor-container") as HTMLDivElement | null;
      if (!closestEditorContainer) {
        console.error("Editor container not found");
        return;
      }
    }
    if (!closestEditorContainer) {
      console.error("Editor container not found");
      return;
    }

    setEditorContainer(closestEditorContainer);
    const aspectRatio = img.naturalWidth / img.naturalHeight;

    if (width === "35%") {
      const editorWidth = closestEditorContainer.clientWidth;
      const initialWidth = Math.max(editorWidth * 0.35, MIN_SIZE);
      const initialHeight = initialWidth / aspectRatio;

      const initialComputedSize = {
        width: `${Math.round(initialWidth)}px` satisfies Pixel,
        height: `${Math.round(initialHeight)}px` satisfies Pixel,
        aspectRatio: aspectRatio,
      };

      setSize(initialComputedSize);
      updateAttributesSafely(
        initialComputedSize,
        "Failed to update attributes while initializing an image for the first time:"
      );
    } else {
      // as the aspect ratio in not stored for old images, we need to update the attrs
      if (!aspectRatio) {
        setSize((prevSize) => {
          const newSize = { ...prevSize, aspectRatio };
          updateAttributesSafely(
            newSize,
            "Failed to update attributes while initializing images with width but no aspect ratio:"
          );
          return newSize;
        });
      }
    }
    setInitialResizeComplete(true);
  }, [width, updateAttributes, editorContainer, aspectRatio]);

  // for real time resizing
  useLayoutEffect(() => {
    setSize((prevSize) => ({
      ...prevSize,
      width: ensurePixelString(width),
      height: ensurePixelString(height),
    }));
  }, [width, height]);

  const handleResize = useCallback(
    (e: MouseEvent | TouchEvent) => {
      if (!containerRef.current || !containerRect.current || !size.aspectRatio) return;

      const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;

      const newWidth = Math.max(clientX - containerRect.current.left, MIN_SIZE);
      const newHeight = newWidth / size.aspectRatio;

      setSize((prevSize) => ({ ...prevSize, width: `${newWidth}px`, height: `${newHeight}px` }));
    },
    [size]
  );

  const handleResizeEnd = useCallback(() => {
    setIsResizing(false);
    updateAttributesSafely(size, "Failed to update attributes at the end of resizing:");
  }, [size, updateAttributes]);

  const handleResizeStart = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsResizing(true);

    if (containerRef.current) {
      containerRect.current = containerRef.current.getBoundingClientRect();
    }
  }, []);

  useEffect(() => {
    if (isResizing) {
      window.addEventListener("mousemove", handleResize);
      window.addEventListener("mouseup", handleResizeEnd);
      window.addEventListener("mouseleave", handleResizeEnd);

      return () => {
        window.removeEventListener("mousemove", handleResize);
        window.removeEventListener("mouseup", handleResizeEnd);
        window.removeEventListener("mouseleave", handleResizeEnd);
      };
    }
  }, [isResizing, handleResize, handleResizeEnd]);

  const handleImageMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      const pos = getPos();
      const nodeSelection = NodeSelection.create(editor.state.doc, pos);
      editor.view.dispatch(editor.state.tr.setSelection(nodeSelection));
    },
    [editor, getPos]
  );

  // show the image loader if the remote image's src or preview image from filesystem is not set yet (while loading the image post upload) (or)
  // if the initial resize (from 35% width and "auto" height attrs to the actual size in px) is not complete
  const showImageLoader = !(remoteImageSrc || imageFromFileSystem) || !initialResizeComplete;
  // show the image utils only if the remote image's (post upload) src is set and the initial resize is complete (but not while we're showing the preview imageFromFileSystem)
  const showImageUtils = remoteImageSrc && initialResizeComplete;
  // show the image resizer only if the editor is editable, the remote image's (post upload) src is set and the initial resize is complete (but not while we're showing the preview imageFromFileSystem)
  const showImageResizer = editor.isEditable && remoteImageSrc && initialResizeComplete;
  // show the preview image from the file system if the remote image's src is not set
  const displayedImageSrc = remoteImageSrc ?? imageFromFileSystem;

  return (
    <div
      ref={containerRef}
      className="group/image-component relative inline-block max-w-full"
      onMouseDown={handleImageMouseDown}
      style={{
        width: size.width,
        aspectRatio: size.aspectRatio,
      }}
    >
      {showImageLoader && (
        <div
          className="animate-pulse bg-custom-background-80 rounded-md"
          style={{ width: size.width, height: size.height }}
        />
      )}
      <img
        ref={imageRef}
        src={displayedImageSrc}
        onLoad={handleImageLoad}
        onError={(e) => {
          console.error("Error loading image", e);
          setFailedToLoadImage(true);
        }}
        width={size.width}
        className={cn("image-component block rounded-md", {
          // hide the image while the background calculations of the image loader are in progress (to avoid flickering) and show the loader until then
          hidden: showImageLoader,
          "read-only-image": !editor.isEditable,
          "blur-sm opacity-80 loading-image": !remoteImageSrc,
        })}
        style={{
          width: size.width,
          aspectRatio: size.aspectRatio,
        }}
      />
      {showImageUtils && (
        <ImageToolbarRoot
          containerClassName={
            "absolute top-1 right-1 z-20 bg-black/40 rounded opacity-0 pointer-events-none group-hover/image-component:opacity-100 group-hover/image-component:pointer-events-auto transition-opacity"
          }
          image={{
            src: remoteImageSrc,
            aspectRatio: size.aspectRatio,
            height: size.height,
            width: size.width,
          }}
        />
      )}
      {selected && displayedImageSrc === remoteImageSrc && (
        <div className="absolute inset-0 size-full bg-custom-primary-500/30" />
      )}
      {showImageResizer && (
        <>
          <div
            className={cn(
              "absolute inset-0 border-2 border-custom-primary-100 pointer-events-none rounded-md transition-opacity duration-100 ease-in-out",
              {
                "opacity-100": isResizing,
                "opacity-0 group-hover/image-component:opacity-100": !isResizing,
              }
            )}
          />
          <div
            className={cn(
              "absolute bottom-0 right-0 translate-y-1/2 translate-x-1/2 size-4 rounded-full bg-custom-primary-100 border-2 border-white cursor-nwse-resize transition-opacity duration-100 ease-in-out",
              {
                "opacity-100 pointer-events-auto": isResizing,
                "opacity-0 pointer-events-none group-hover/image-component:opacity-100 group-hover/image-component:pointer-events-auto":
                  !isResizing,
              }
            )}
            onMouseDown={handleResizeStart}
          />
        </>
      )}
    </div>
  );
};
