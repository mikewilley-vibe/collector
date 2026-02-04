"use client";
import React from "react";

type Props = {
  files: File[];
  setFiles: (files: File[]) => void;
  max?: number;
};

export default function ImageUpload({ files, setFiles, max = 6 }: Props) {
  function handleFiles(list: FileList | null) {
    if (!list || list.length === 0) return;

    const incoming = Array.from(list);
    const remaining = Math.max(0, max - files.length);
    const add = incoming.slice(0, remaining);

    setFiles([...files, ...add]);
  }

  function removeFile(idx: number) {
    setFiles(files.filter((_, i) => i !== idx));
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-2">
        {files.map((file, idx) => {
          const url = URL.createObjectURL(file);
          return (
            <div
              key={`${file.name}-${idx}`}
              className="relative w-24 h-24 border rounded overflow-hidden bg-gray-100"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={url} alt={file.name} className="object-cover w-full h-full" />
              <button
                type="button"
                className="absolute top-1 right-1 bg-white rounded-full px-2 text-xs text-red-600"
                onClick={() => removeFile(idx)}
              >
                ×
              </button>
            </div>
          );
        })}

        {files.length < max && (
          <label
            htmlFor="image-upload-input"
            className="w-24 h-24 border-2 border-dashed border-gray-300 rounded flex items-center justify-center text-gray-400 hover:border-blue-400 cursor-pointer"
          >
            +
          </label>
        )}
      </div>

      <input
        id="image-upload-input"
        type="file"
        accept="image/*,.heic,.heif"
        multiple
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
      />

      <div className="text-xs text-gray-500">
        {files.length}/{max} images
      </div>
    </div>
  );
}
