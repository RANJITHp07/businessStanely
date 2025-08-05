"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { User } from "lucide-react";

interface S3ImageProps {
  s3Key?: string | null;
  fallback?: React.ReactNode;
  className?: string;
  alt?: string;
  width?: number;
  height?: number;
}

export function S3Image({
  s3Key,
  fallback,
  className,
  alt,
  width = 200,
  height = 200,
}: S3ImageProps) {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!s3Key) {
      setImageUrl(null);
      return;
    }

    if (s3Key.startsWith("data:") || s3Key.startsWith("http")) {
      setImageUrl(s3Key);
      return;
    }

    const fetchSignedUrl = async () => {
      setLoading(true);
      try {
        const response = await fetch(`/api/files/${encodeURIComponent(s3Key)}`);
        if (response.ok) {
          const { url } = await response.json();
          setImageUrl(url);
        }
      } catch (error) {
        console.error("Error fetching signed URL:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchSignedUrl();
  }, [s3Key]);

  if (className?.includes("Avatar") || className?.includes("h-20")) {
    return (
      <Avatar className={className}>
        <AvatarImage src={imageUrl || ""} alt={alt} />
        <AvatarFallback>
          {fallback || <User className="h-8 w-8" />}
        </AvatarFallback>
      </Avatar>
    );
  }

  if (!imageUrl && !loading) {
    return fallback ? <>{fallback}</> : null;
  }

  return (
    <Image
      src={imageUrl || ""}
      alt={alt || "S3 Image"}
      width={width}
      height={height}
      className={className}
      style={{ display: loading ? "none" : "block" }}
    />
  );
}