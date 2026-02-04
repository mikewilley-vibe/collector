"use client";
import React, { useRef } from "react";

type Props = {
  files: File[];
  setFiles: (files: File[]) => void;
  max?: number;
};

export default function ImageUpload({ files, setFiles, max = 6 }: Props) {
  const fileInput = useRef<HTMLInputElement>(null);

  function handleFiles(list: FileList | null) {
    if (!list || list.length === 0) return;

    const incoming = Array.from(list);
    const remaining = Math.max(0, max - files.length);
    const add = incoming.slice(0, remaining);

    setFiles([...files, ...add]);

    // allow selecting the same file again
    if (fileInput.current) fileInput.current.value = "";
  }

  function removeFile(idx: number) {
    setFiles(files.filter((_, i) => i !== idx));
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-2 mb-2">
        {files.map((file, idx) => {
          const url = URL.createObjectURL(file); // preview only
          return (
            <div
              key={`${file.name}-${file.size}-${idx}`}
              className="relative w-24 h-24 border rounded overflow-hidden bg-gray-100 flex items-center justify-center"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={url} alt={`upload-${idx}`} className="object-cover w-full h-full" />
              <button
                type="button"
                className="absolute top-1 right-1 bg-white bg-opacity-80 rounded-full px-2 py-0.5 text-xs text-red-600 hover:bg-opacity-100"
                onClick={() => removeFile(idx)}
                aria-label="Remove image"
              >
                ×
              </button>
            </div>
          );
        })}
      </div>
      {files.length < max && (
        <>
          <input
            ref={fileInput}
            id="image-upload-input"
            type="file"
            accept="image/*,.heic,.heif"
            multiple
            className="sr-only"
            onChange={(e) => handleFiles(e.target.files)}
            title="Upload images"
          />
          <label htmlFor="image-upload-input" className="w-full h-12 border-2 border-solid border-blue-500 rounded-full flex items-center justify-center text-blue-700 bg-blue-50 hover:bg-blue-100 hover:border-blue-700 font-semibold text-center px-6 transition-colors duration-150 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-400 mb-2 cursor-pointer">
            Add pictures here
          </label>
        </>
      )}

      {/* The input is now above, inside the label block for accessibility */}

      <div className="text-xs text-gray-500">
        {files.length}/{max} images. Tip: include front/back + close-ups of key details.
      </div>
    </div>
  );
}
