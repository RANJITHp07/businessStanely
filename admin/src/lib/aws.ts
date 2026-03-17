import {
  AbortMultipartUploadCommand,
  CompleteMultipartUploadCommand,
  CreateMultipartUploadCommand,
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  UploadPartCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const s3Client = new S3Client({
  region: process.env.APP_AWS_REGION || "us-east-1",
  credentials: {
    accessKeyId: process.env.APP_AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.APP_AWS_SECRET_ACCESS_KEY!,
  },
});

const BUCKET_NAME = process.env.APP_AWS_S3_BUCKET_NAME!;

export async function uploadToS3(
  file: Buffer,
  fileName: string,
  contentType: string,
): Promise<string> {
  const key = `uploads/${Date.now()}_${fileName}`;

  const command = new PutObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key,
    Body: file,
    ContentType: contentType,
  });

  try {
    await s3Client.send(command);
    return key;
  } catch (error) {
    console.error("Error uploading to S3:", error);
    throw new Error("Failed to upload file to S3");
  }
}

export async function getSignedDownloadUrl(key: string): Promise<string> {
  const command = new GetObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key,
  });

  try {
    return await getSignedUrl(s3Client, command, { expiresIn: 3600 });
  } catch (error) {
    console.error("Error generating signed URL:", error);
    throw new Error("Failed to generate download URL");
  }
}

export async function deleteFromS3(key: string): Promise<void> {
  try {
    const command = new DeleteObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
    });

    await s3Client.send(command);
  } catch (error) {
    console.error("Error deleting from S3:", error);
    throw new Error("Failed to delete file from S3");
  }
}

export async function getPresignedUrl(key: string): Promise<string> {
  const command = new PutObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key,
  });

  return await getSignedUrl(s3Client, command, { expiresIn: 3600 });
}

export async function getPresignedUploadUrl(
  key: string,
  contentType: string,
  expiresIn = 900,
): Promise<string> {
  const command = new PutObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key,
    ContentType: contentType,
  });

  return await getSignedUrl(s3Client, command, { expiresIn });
}

export async function createMultipartUpload(
  key: string,
  contentType: string,
): Promise<string> {
  const command = new CreateMultipartUploadCommand({
    Bucket: BUCKET_NAME,
    Key: key,
    ContentType: contentType,
  });

  const response = await s3Client.send(command);
  if (!response.UploadId) {
    throw new Error("Failed to create multipart upload");
  }

  return response.UploadId;
}

export async function getMultipartPartUploadUrl(
  key: string,
  uploadId: string,
  partNumber: number,
  expiresIn = 900,
): Promise<string> {
  const command = new UploadPartCommand({
    Bucket: BUCKET_NAME,
    Key: key,
    UploadId: uploadId,
    PartNumber: partNumber,
  });

  return await getSignedUrl(s3Client, command, { expiresIn });
}

export async function completeMultipartUpload(
  key: string,
  uploadId: string,
  parts: Array<{ ETag: string; PartNumber: number }>,
): Promise<void> {
  const command = new CompleteMultipartUploadCommand({
    Bucket: BUCKET_NAME,
    Key: key,
    UploadId: uploadId,
    MultipartUpload: {
      Parts: parts,
    },
  });

  await s3Client.send(command);
}

export async function abortMultipartUpload(
  key: string,
  uploadId: string,
): Promise<void> {
  const command = new AbortMultipartUploadCommand({
    Bucket: BUCKET_NAME,
    Key: key,
    UploadId: uploadId,
  });

  await s3Client.send(command);
}
