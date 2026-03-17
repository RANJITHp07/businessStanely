type UploadInitResponse = {
  uploadUrl: string;
  url: string;
  originalName: string;
  size: number;
  type: string;
};

type MultipartInitResponse = {
  uploadId: string;
  key: string;
  url: string;
  originalName: string;
  size: number;
  type: string;
  chunkSize: number;
  totalParts: number;
};

type PartUrlResponse = {
  uploadUrl: string;
};

type CompletePart = {
  ETag: string;
  PartNumber: number;
};

export type UploadProgress = {
  phase: "initializing" | "uploading" | "completing" | "done";
  percent: number;
  message: string;
};

type UploadOptions = {
  onProgress?: (progress: UploadProgress) => void;
  maxRetries?: number;
  multipartThresholdBytes?: number;
};

const DEFAULT_MAX_RETRIES = 3;
const DEFAULT_MULTIPART_THRESHOLD = 20 * 1024 * 1024; // 20MB

function notifyProgress(
  options: UploadOptions | undefined,
  progress: UploadProgress,
) {
  options?.onProgress?.(progress);
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function uploadBlobWithProgress(
  uploadUrl: string,
  blob: Blob,
  contentType: string,
  onProgress: (loaded: number) => void,
): Promise<string | null> {
  return await new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", uploadUrl, true);
    xhr.setRequestHeader("Content-Type", contentType);

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        onProgress(event.loaded);
      }
    };

    xhr.onerror = () => {
      return reject(new Error("Network error while uploading to S3"));
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(xhr.getResponseHeader("ETag"));
      } else {
        reject(new Error(`S3 upload failed with status ${xhr.status}`));
      }
    };

    xhr.send(blob);
  });
}

async function uploadSinglePartWithRetry(
  file: File,
  uploadUrl: string,
  options?: UploadOptions,
) {
  const retries = options?.maxRetries ?? DEFAULT_MAX_RETRIES;

  for (let attempt = 1; attempt <= retries; attempt += 1) {
    try {
      await uploadBlobWithProgress(uploadUrl, file, file.type, (loaded) => {
        notifyProgress(options, {
          phase: "uploading",
          percent: Math.min(99, Math.round((loaded / file.size) * 100)),
          message: `Uploading... ${Math.round((loaded / file.size) * 100)}%`,
        });
      });
      return;
    } catch (error) {
      if (attempt === retries) {
        throw error;
      }

      notifyProgress(options, {
        phase: "uploading",
        percent: 0,
        message: `Upload failed, retrying (${attempt}/${retries - 1})...`,
      });
      await sleep(500 * attempt);
    }
  }
}

async function uploadMultipartWithRetry(
  file: File,
  options?: UploadOptions,
): Promise<UploadInitResponse> {
  const initResponse = await fetch("/api/upload/multipart/init", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      fileName: file.name,
      fileSize: file.size,
      contentType: file.type,
    }),
  });

  if (!initResponse.ok) {
    const err = await initResponse.json().catch(() => ({}));
    throw new Error(err.error || "Failed to initialize multipart upload");
  }

  const uploadInit = (await initResponse.json()) as MultipartInitResponse;
  const retries = options?.maxRetries ?? DEFAULT_MAX_RETRIES;
  const completedParts: CompletePart[] = [];
  let committedBytes = 0;

  try {
    for (let partIndex = 0; partIndex < uploadInit.totalParts; partIndex += 1) {
      const partNumber = partIndex + 1;
      const start = partIndex * uploadInit.chunkSize;
      const end = Math.min(start + uploadInit.chunkSize, file.size);
      const chunk = file.slice(start, end);

      let uploaded = false;
      for (let attempt = 1; attempt <= retries; attempt += 1) {
        try {
          const partUrlResponse = await fetch(
            "/api/upload/multipart/part-url",
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                key: uploadInit.key,
                uploadId: uploadInit.uploadId,
                partNumber,
              }),
            },
          );

          if (!partUrlResponse.ok) {
            const err = await partUrlResponse.json().catch(() => ({}));
            throw new Error(
              err.error || `Failed to get upload URL for part ${partNumber}`,
            );
          }

          const partData = (await partUrlResponse.json()) as PartUrlResponse;

          const etag = await uploadBlobWithProgress(
            partData.uploadUrl,
            chunk,
            file.type,
            (loaded) => {
              const percent = Math.min(
                99,
                Math.round(((committedBytes + loaded) / file.size) * 100),
              );
              notifyProgress(options, {
                phase: "uploading",
                percent,
                message: `Uploading part ${partNumber}/${uploadInit.totalParts}...`,
              });
            },
          );

          if (!etag) {
            throw new Error(`Missing ETag for part ${partNumber}`);
          }

          completedParts.push({
            ETag: etag,
            PartNumber: partNumber,
          });
          committedBytes += chunk.size;
          uploaded = true;
          break;
        } catch (error) {
          if (attempt === retries) {
            throw error;
          }

          notifyProgress(options, {
            phase: "uploading",
            percent: Math.round((committedBytes / file.size) * 100),
            message: `Part ${partNumber} failed, retrying (${attempt}/${retries - 1})...`,
          });
          await sleep(500 * attempt);
        }
      }

      if (!uploaded) {
        throw new Error(`Failed to upload part ${partNumber}`);
      }
    }

    notifyProgress(options, {
      phase: "completing",
      percent: 99,
      message: "Finalizing upload...",
    });

    const completeResponse = await fetch("/api/upload/multipart/complete", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        key: uploadInit.key,
        uploadId: uploadInit.uploadId,
        originalName: uploadInit.originalName,
        size: uploadInit.size,
        type: uploadInit.type,
        parts: completedParts,
      }),
    });

    if (!completeResponse.ok) {
      const err = await completeResponse.json().catch(() => ({}));
      throw new Error(err.error || "Failed to complete multipart upload");
    }

    const completeData = (await completeResponse.json()) as Omit<
      UploadInitResponse,
      "uploadUrl"
    >;

    return {
      uploadUrl: "",
      url: completeData.url,
      originalName: completeData.originalName,
      size: completeData.size,
      type: completeData.type,
    };
  } catch (error) {
    await fetch("/api/upload/multipart/abort", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        key: uploadInit.key,
        uploadId: uploadInit.uploadId,
      }),
    }).catch(() => {
      // Best-effort cleanup for failed multipart uploads.
    });

    throw error;
  }
}

export async function uploadFileToS3Direct(
  file: File,
  options?: UploadOptions,
): Promise<UploadInitResponse> {
  notifyProgress(options, {
    phase: "initializing",
    percent: 0,
    message: "Preparing upload...",
  });

  const multipartThreshold =
    options?.multipartThresholdBytes ?? DEFAULT_MULTIPART_THRESHOLD;
  if (file.size > multipartThreshold) {
    const result = await uploadMultipartWithRetry(file, options);
    notifyProgress(options, {
      phase: "done",
      percent: 100,
      message: "Upload complete",
    });
    return result;
  }

  const initResponse = await fetch("/api/upload", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      fileName: file.name,
      fileSize: file.size,
      contentType: file.type,
    }),
  });

  if (!initResponse.ok) {
    const err = await initResponse.json().catch(() => ({}));
    throw new Error(err.error || "Failed to initialize upload");
  }

  const uploadInit = (await initResponse.json()) as UploadInitResponse;

  await uploadSinglePartWithRetry(file, uploadInit.uploadUrl, options);

  notifyProgress(options, {
    phase: "done",
    percent: 100,
    message: "Upload complete",
  });

  return uploadInit;
}
