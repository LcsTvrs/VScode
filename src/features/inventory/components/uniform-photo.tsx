"use client";

import { Shirt } from "lucide-react";
import Image from "next/image";
import { useState } from "react";

export function UniformPhoto({ imageId, name, large = false }: { imageId?: string | null; name: string; large?: boolean }) {
  const [failedId, setFailedId] = useState<string | null>(null);
  return <span className={`uniform-photo${large ? " uniform-photo-large" : ""}`}>
    {imageId && imageId !== failedId
      ? <Image src={`/api/uniform-images/${encodeURIComponent(imageId)}`} alt={`Foto de ${name}`} width={large ? 76 : 42} height={large ? 76 : 42} unoptimized onError={() => setFailedId(imageId)} />
      : <Shirt size={large ? 26 : 18} aria-label="Uniforme sem foto" />}
  </span>;
}
