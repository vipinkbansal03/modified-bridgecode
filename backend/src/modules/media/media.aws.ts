import { S3Client, PutObjectCommand, CreateMultipartUploadCommand, UploadPartCommand, CompleteMultipartUploadCommand, GetObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { randomUUID } from "node:crypto";

const s3Client = new S3Client({
  region: process.env.AWS_REGION || "us-east-1",
});

const BUCKET_NAME = process.env.AWS_S3_BUCKET;

function getBucketName() {
  if (!BUCKET_NAME) {
    throw new Error("AWS_S3_BUCKET is required for S3 media uploads.");
  }
  return BUCKET_NAME;
}

export async function generatePresignedUploadUrl(key: string, contentType: string) {
  const command = new PutObjectCommand({
    Bucket: getBucketName(),
    Key: key,
    ContentType: contentType,
  });

  // Short-lived presigned URL (15 minutes)
  const url = await getSignedUrl(s3Client, command, { expiresIn: 900 });
  return url;
}

export async function getObjectBuffer(key: string): Promise<Buffer> {
  const response = await s3Client.send(new GetObjectCommand({
    Bucket: getBucketName(),
    Key: key,
  }));

  if (!response.Body) {
    throw new Error(`S3 object has no body: ${key}`);
  }

  const chunks: Buffer[] = [];
  for await (const chunk of response.Body as AsyncIterable<Buffer | Uint8Array>) {
    chunks.push(Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

export async function deleteObject(key: string) {
  await s3Client.send(new DeleteObjectCommand({
    Bucket: getBucketName(),
    Key: key,
  }));
}

export async function uploadObjectBuffer(folder: string, filename: string, contentType: string, buffer: Buffer) {
  const cleanFolder = folder.replace(/^\/+|\/+$/g, "");
  const key = `${cleanFolder}/${randomUUID()}-${filename.replace(/^\/+|\/+$/g, "")}`;

  await s3Client.send(new PutObjectCommand({
    Bucket: getBucketName(),
    Key: key,
    Body: buffer,
    ContentType: contentType,
    CacheControl: "public, max-age=31536000, immutable",
  }));

  return key;
}

export async function createMultipartUpload(key: string, contentType: string) {
  const command = new CreateMultipartUploadCommand({
    Bucket: getBucketName(),
    Key: key,
    ContentType: contentType,
  });
  const response = await s3Client.send(command);
  return response.UploadId;
}

export async function generatePresignedPartUrl(key: string, uploadId: string, partNumber: number) {
  const command = new UploadPartCommand({
    Bucket: getBucketName(),
    Key: key,
    UploadId: uploadId,
    PartNumber: partNumber,
  });
  const url = await getSignedUrl(s3Client, command, { expiresIn: 900 });
  return url;
}

export async function completeMultipartUpload(key: string, uploadId: string, parts: { ETag: string; PartNumber: number }[]) {
  const command = new CompleteMultipartUploadCommand({
    Bucket: getBucketName(),
    Key: key,
    UploadId: uploadId,
    MultipartUpload: {
      Parts: parts,
    },
  });
  await s3Client.send(command);
}
