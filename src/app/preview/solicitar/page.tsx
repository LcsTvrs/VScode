import { notFound } from "next/navigation";
import RequestUniformPage from "@/features/requests/components/public-request-page";

export default function RequestLayoutPreview() {
  if (process.env.NODE_ENV !== "development") notFound();
  return <RequestUniformPage preview />;
}
