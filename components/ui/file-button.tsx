"use client";

import type * as React from "react";
import { useRef } from "react";
import { Button } from "@/components/ui/button";

/** A button that opens the file picker. The file is handed to onFile and never uploaded by this component. */
export function FileButton({
  accept,
  onFile,
  children,
  ...props
}: Omit<React.ComponentProps<typeof Button>, "onClick" | "onChange"> & {
  accept: string;
  onFile: (file: File) => void;
}) {
  const input = useRef<HTMLInputElement>(null);

  return (
    <>
      <Button {...props} onClick={() => input.current?.click()}>
        {children}
      </Button>
      <input
        ref={input}
        type="file"
        accept={accept}
        hidden
        onChange={(event) => {
          const file = event.target.files?.[0];
          // Clear it so choosing the same file twice still fires.
          event.target.value = "";
          if (file) onFile(file);
        }}
      />
    </>
  );
}
