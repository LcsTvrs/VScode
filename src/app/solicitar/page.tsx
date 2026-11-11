import type { Metadata } from "next";
import RequestUniformPage from "@/features/requests/components/public-request-page";

export const metadata: Metadata = {
  title: "Solicitar uniformes | Leroy Merlin",
  description: "Portal do colaborador: solicite seus uniformes e encaminhe o pedido para aprovação da loja.",
};

export default function RequestPage() {
  return <RequestUniformPage />;
}
