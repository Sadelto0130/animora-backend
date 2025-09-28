import {S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { AWS_ACCESS_KEY, AWS_REGION, AWS_SECRET_ACCESS_KEY } from "../config.js";
import { imageName } from "./functions.js";

const s3 = new S3Client({
  region: AWS_REGION,
  credentials: {
    accessKeyId: AWS_ACCESS_KEY,
    secretAccessKey: AWS_SECRET_ACCESS_KEY,
  },
});

// Generar URL firmada
export const generateUploadURL = async () => {
  const command = new PutObjectCommand({
    Bucket: "petguard-appweb",
    Key: imageName(),
    ContentType: "image/jpeg",
  });

  // expiresIn está en segundos
  return await getSignedUrl(s3, command, { expiresIn: 60 });
};

