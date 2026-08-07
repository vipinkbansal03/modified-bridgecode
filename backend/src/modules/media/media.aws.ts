import { S3Client, PutObjectCommand, CreateMultipartUploadCommand, UploadPartCommand, CompleteMultipartUploadCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const s3Client = new S3Client({
  region: process.env.AWS_REGION || "us-east-1",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || "dummy-key",
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || "dummy-secret",
  },
});

const BUCKET_NAME = process.env.AWS_S3_BUCKET || "modortho-media-staging";

export async function generatePresignedUploadUrl(key: string, contentType: string) {
  const command = new PutObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key,
    ContentType: contentType,
  });

  // Short-lived presigned URL (15 minutes)
  const url = await getSignedUrl(s3Client, command, { expiresIn: 900 });
  return url;
}

export async function createMultipartUpload(key: string, contentType: string) {
  const command = new CreateMultipartUploadCommand({
    Bucket: BUCKET_NAME,
    Key: key,
    ContentType: contentType,
  });
  const response = await s3Client.send(command);
  return response.UploadId;
}

export async function generatePresignedPartUrl(key: string, uploadId: string, partNumber: number) {
  const command = new UploadPartCommand({
    Bucket: BUCKET_NAME,
    Key: key,
    UploadId: uploadId,
    PartNumber: partNumber,
  });
  const url = await getSignedUrl(s3Client, command, { expiresIn: 900 });
  return url;
}

export async function completeMultipartUpload(key: string, uploadId: string, parts: { ETag: string; PartNumber: number }[]) {
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
