import type { MessageAttachment } from "@roster/api";

export interface Upload {
  done: Promise<MessageAttachment>;
  abort: () => void;
}

export function uploadAttachment(args: {
  file: File;
  projectId: string;
  onProgress: (fraction: number) => void;
}): Upload {
  const request = new XMLHttpRequest();

  const done = new Promise<MessageAttachment>((resolve, reject) => {
    const form = new FormData();
    form.append("projectId", args.projectId);
    form.append("file", args.file);

    request.open("POST", "/api/upload");
    request.responseType = "json";

    request.upload.addEventListener("progress", (event) => {
      if (event.lengthComputable) args.onProgress(event.loaded / event.total);
    });

    request.addEventListener("load", () => {
      const body = request.response as
        | MessageAttachment
        | { error?: string }
        | null;

      if (request.status >= 200 && request.status < 300 && body && "id" in body) {
        args.onProgress(1);
        resolve(body);
        return;
      }

      const message =
        body && "error" in body && body.error
          ? body.error
          : "Upload failed. Try again.";
      reject(new Error(message));
    });

    request.addEventListener("error", () =>
      reject(new Error("Upload failed. Check your connection.")),
    );
    request.addEventListener("abort", () => reject(new Error("Upload cancelled.")));

    request.send(form);
  });

  return { done, abort: () => request.abort() };
}
