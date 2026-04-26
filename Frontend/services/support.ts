import { API_URL } from "../constants/Api";
import { normalizeApiErrorMessage } from "../utils/authSession";
import { SupportRequestPayload, SupportRequestResponse } from "../types/Support";

export async function submitSupportRequest(
   payload: SupportRequestPayload
): Promise<SupportRequestResponse> {
   const body = new FormData();
   body.append("name", payload.name);
   body.append("email", payload.email);
   body.append("topic", payload.topic);
   body.append("subject", payload.subject);
   body.append("message", payload.message);

   if (payload.attachment?.file) {
      body.append("attachment", payload.attachment.file);
   }

   const response = await fetch(`${API_URL}/contact`, {
      method: "POST",
      body,
   });

   const contentType = response.headers.get("content-type") || "";
   const data = contentType.includes("application/json") ? await response.json() : null;

   if (!response.ok) {
      const message = await normalizeApiErrorMessage(
         data?.message,
         "Unable to send your support request."
      );
      throw new Error(message);
   }

   return {
      message: data?.message || "Message sent successfully",
      referenceNumber: data?.referenceNumber || "",
      replyToEmail: data?.replyToEmail || payload.email,
      expectedResponseTime: data?.expectedResponseTime || "24-48 hours",
      supportEmail: data?.supportEmail || "supportdiscountmate@gmail.com",
      emailStatus: data?.emailStatus,
   };
}
